# Messagerie privée NaataL

La messagerie permet à deux comptes NaataL d'échanger des messages privés en
temps réel. Elle est intégrée à l'application existante : React/Vite pour
l'interface, Express/MySQL pour l'API et Socket.IO pour la diffusion immédiate.
Tous les messages sont enregistrés dans MySQL **avant** d'être diffusés.

## 1. Fonctionnement général

1. Un utilisateur connecté ouvre **Messages** dans le menu latéral.
2. Il recherche un membre actif par nom ou adresse email.
3. Le serveur crée (ou réutilise) l'unique conversation privée entre les deux
   comptes.
4. Le message est validé, enregistré dans MySQL, puis émis par Socket.IO aux
   deux participants.
5. Le destinataire voit le message apparaître sans actualiser la page, reçoit
   une notification visuelle et un compteur de non-lus.
6. À l'ouverture de la conversation, son `last_read_at` est mis à jour et
   l'expéditeur reçoit l'accusé de lecture en temps réel.

## 2. Architecture

```
frontend/src/pages/Messages.jsx          Interface de discussion + recherche
frontend/src/context/MessagingContext.jsx Socket.IO, liste, non-lus, notifications
frontend/src/components/Avatar.jsx        Avatar avec initiales et présence

backend/src/controllers/messagesController.js  API REST et règles métier
backend/src/routes/messages.js                 Routes protégées par JWT
backend/src/realtime/socket.js                 Authentification et événements Socket.IO
backend/src/utils/conversations.js             Clé de paire, migration email, nettoyage

backend/src/config/schema.sql                  Tables créées automatiquement
backend/src/config/migrations/001_messagerie.sql Migration manuelle idempotente
backend/scripts/messaging-test.mjs             Test automatisé de bout en bout
```

Socket.IO utilise le **même serveur HTTP et le même port que l'API** (5000). En
développement, Vite relaie `/api` et `/socket.io` (WebSocket inclus) vers le
backend. Il n'y a donc pas de second port à ouvrir.

## 3. Base de données

La clé primaire de `utilisateurs` étant l'**email**, les tables de messagerie
référencent `utilisateurs(email)` et non un identifiant numérique.

### `conversations`

| Colonne | Type | Rôle |
| --- | --- | --- |
| `id` | BIGINT UNSIGNED | Identifiant de la conversation |
| `pair_key` | CHAR(64) | SHA-256 des deux emails triés, unique |
| `created_at` | TIMESTAMP | Création |
| `updated_at` | TIMESTAMP | Dernière activité |

`pair_key` empêche la duplication, y compris si deux utilisateurs cliquent en
même temps. La conversation est réutilisée dans les deux sens (A→B = B→A).

### `conversation_participants`

| Colonne | Type | Rôle |
| --- | --- | --- |
| `id` | BIGINT UNSIGNED | Identifiant |
| `conversation_id` | BIGINT UNSIGNED | Conversation |
| `user_email` | VARCHAR(190) | Compte participant |
| `last_read_at` | DATETIME | Dernière lecture (accusés + non-lus) |
| `joined_at` | TIMESTAMP | Adhésion |

Contrainte d'unicité `(conversation_id, user_email)`, index sur `user_email`,
clés étrangères `ON DELETE CASCADE` et `ON UPDATE CASCADE`.

### `messages`

| Colonne | Type | Rôle |
| --- | --- | --- |
| `id` | BIGINT UNSIGNED | Identifiant unique |
| `conversation_id` | BIGINT UNSIGNED | Conversation |
| `sender_id` | VARCHAR(190) | Email de l'expéditeur (jamais fourni par le client) |
| `content` | TEXT | Contenu validé (4 000 caractères max) |
| `created_at` | TIMESTAMP | Envoi |
| `updated_at` | TIMESTAMP | Modification / suppression |
| `is_deleted` | TINYINT(1) | Suppression logique |

Index `(conversation_id, id)` pour la pagination et index sur `sender_id`.

### Application de la migration

Le backend exécute `schema.sql` à chaque démarrage : les tables sont créées
automatiquement si elles manquent. Pour une application manuelle :

```bash
mysql -u <utilisateur> -p <base> < backend/src/config/migrations/001_messagerie.sql
```

Aucune table existante n'est supprimée ou modifiée par cette migration.

## 4. Variables d'environnement

Aucune variable supplémentaire n'est obligatoire. Les valeurs suivantes sont
optionnelles :

```env
# Origine(s) autorisée(s) pour l'API et Socket.IO (séparées par des virgules)
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173

# Limites anti-abus de la messagerie
MESSAGE_RATE_LIMIT_MAX=40          # messages / minute / utilisateur
CONVERSATION_RATE_LIMIT_MAX=40     # nouvelles conversations / heure / utilisateur
```

Les identifiants MySQL restent uniquement dans `backend/.env` et ne sont jamais
exposés au frontend.

## 5. Démarrage

```bash
# À la racine du projet
npm run install:all   # si ce n'est pas déjà fait
npm run dev
```

- Frontend : http://localhost:5173
- API : http://localhost:5000
- Socket.IO : `ws://localhost:5000/socket.io` (via le proxy Vite en développement)

Après ajout de nouvelles dépendances, redémarrez le backend et le frontend.

## 6. API REST

Toutes les routes exigent `Authorization: Bearer <JWT>`.

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/api/messages/conversations` | Conversations, dernier message, non-lus, présence |
| POST | `/api/messages/conversations` | Démarrer / retrouver une conversation (`email`) |
| GET | `/api/messages/users?q=...` | Rechercher un membre actif (2 caractères min.) |
| GET | `/api/messages/conversations/:id/messages` | Historique paginé (`before`, `limit`) |
| POST | `/api/messages/conversations/:id/messages` | Envoyer un message (`content`) |
| POST | `/api/messages/conversations/:id/read` | Marquer la conversation comme lue |
| DELETE | `/api/messages/:id` | Supprimer son propre message |

Règles :

- impossible de démarrer une conversation avec soi-même ;
- impossible de contacter un compte désactivé ;
- une conversation privée n'est jamais dupliquée ;
- un non-membre reçoit `404` (l'existence de la conversation n'est pas révélée) ;
- seul l'auteur peut supprimer son message ; l'interlocuteur reçoit
  « Message supprimé » ;
- les messages sont limités à 4 000 caractères, les balises HTML et les messages
  vides sont refusés ;
- la pagination utilise un curseur (`before=<id>`) pour ne pas ralentir
  l'application sur les longues discussions.

## 7. Événements Socket.IO

Authentification : le client envoie le JWT dans `auth.token`. Le serveur vérifie
la signature, l'issuer, l'audience, le statut du compte et la version de jeton.

| Événement | Sens | Contenu |
| --- | --- | --- |
| `presence:ready` | serveur → client | Confirmation de connexion |
| `presence:update` | serveur → interlocuteurs | `{ email, online }` |
| `message:new` | serveur → participants | `{ message, conversationId }` |
| `message:deleted` | serveur → participants | `{ messageId, conversationId, deletedBy }` |
| `conversation:read` | serveur → interlocuteur | `{ conversationId, readerEmail, readAt }` |
| `conversation:new` | serveur → participants | `{ conversationId }` |

La reconnexion est automatique (`reconnection: true`) avec un délai progressif.
Au retour de la connexion, le client recharge la liste des conversations et la
discussion ouverte pour récupérer les messages manqués.

## 8. Sécurité

- Authentification JWT réutilisée, vérifiée à chaque requête REST et à la
  poignée de main Socket.IO.
- Révocation immédiate des sockets en cas de changement d'email, de rôle, de
  statut ou de suppression du compte.
- `sender_id` toujours déduit du jeton, jamais du corps de la requête.
- Contrôle d'appartenance avant toute lecture, écriture, suppression ou accusé
  de lecture.
- Aucune donnée d'une conversation n'est diffusée hors de ses participants.
- Validation et nettoyage des contenus (longueur, caractères de contrôle,
  balises HTML).
- Limitation de débit dédiée aux messages, aux nouvelles conversations et aux
  recherches ; limitation globale de l'API existante.
- Requêtes SQL entièrement paramétrées ; aucune information MySQL au frontend.
- La présence n'est diffusée qu'aux interlocuteurs directs.

## 9. Tests automatisés

Le serveur doit être démarré, puis :

```bash
cd backend
npm run test:messaging
```

Le script crée trois comptes temporaires, trois sockets et vérifie 25 contrôles :
recherche, conversation unique, envoi et réception instantanée, compteurs de
non-lus, accusés de lecture, réponse, persistance après reconnexion, refus d'un
utilisateur extérieur, suppression, pagination, présence, validation des
contenus, authentification REST et refus d'un socket non authentifié. Les
comptes et conversations de test sont supprimés à la fin.

La même suite peut être exécutée à travers le proxy Vite ou une URL publique
Cloudflare pour valider le chemin réseau réel :

```bash
MESSAGING_TEST_URL=http://127.0.0.1:5173 npm run test:messaging
MESSAGING_TEST_URL=https://<tunnel>.trycloudflare.com npm run test:messaging
```

Résultats détaillés et couverture des scénarios :
**[RAPPORT_TESTS_MESSAGERIE.md](./RAPPORT_TESTS_MESSAGERIE.md)**.

### Scénarios manuels

1. Connecter A dans un navigateur et B dans un autre (ou navigation privée).
2. A recherche B et ouvre la conversation.
3. A envoie un message : B le voit immédiatement sans actualiser.
4. B répond : A le voit immédiatement.
5. Fermer les sessions, se reconnecter : l'historique est conservé.
6. Vérifier les badges de non-lus dans le menu et l'en-tête.
7. Vérifier qu'un troisième compte ne peut pas ouvrir la conversation par URL.
8. Tester sur mobile (liste ↔ discussion, clavier, retour à la ligne).
9. Couper puis rétablir le réseau : Socket.IO se reconnecte et recharge la
   discussion.
10. Tester entre deux réseaux différents via le tunnel Cloudflare
    (`npm run share`) : le proxy Vite relaie `/socket.io` en WebSocket.

## 10. Points d'amélioration connus

- **Photos de profil** : la table `utilisateurs` ne stocke pas encore d'image.
  L'interface affiche donc des avatars avec initiales et couleur stable. Ajouter
  une colonne `avatar_url` et un stockage d'images permettra de les remplacer.
- **Notifications hors application** : les notifications sont visuelles et
  internes. Les notifications navigateur (Web Push) et l'envoi d'emails
  pourraient être ajoutés.
- **Indicateur de saisie** (« en train d'écrire ») non implémenté.
- **Pièces jointes, messages vocaux, réactions** non implémentés.
- **Conversations de groupe** : le schéma `conversation_participants` est prêt,
  mais l'interface et les règles sont volontairement limitées au 1 à 1.
- **Déploiement multi-instances** : Socket.IO nécessiterait l'adaptateur Redis
  pour diffuser entre plusieurs serveurs Node.
- **Suppression de compte** : le nettoyage des conversations orphelines est
  effectué par l'API de gestion des utilisateurs. Une suppression directe en
  base doit être suivie du même nettoyage.
