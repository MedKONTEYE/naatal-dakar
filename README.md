# NAATAL DAKAR - Plateforme intelligente de gestion environnementale

**NAATAL DAKAR** est une initiative de la Ville de Dakar, coordonnée par la Direction de la Planification et du Développement Durable (DPDD).

## Contexte

Le programme s'articule autour de trois piliers :
- Le reverdissement de Dakar
- La salubrité et la gestion des déchets
- La mobilisation et la sensibilisation citoyennes

La période de la campagne (date de début et date de fin), les **informations
institutionnelles du programme** (nom, sigle, coordination, initiative, description) et
les **objectifs prévisionnels** sont **définis par l'administrateur** depuis la page
Paramètres. Ils pilotent automatiquement les libellés, les tableaux de bord, les rapports
et l'avancement affiché dans toute l'application.

Chaque donnée affichée est relue depuis MySQL : après un enregistrement, toutes les pages
et tous les onglets ouverts du navigateur se mettent à jour immédiatement (canal
`BroadcastChannel`), et les données sont systématiquement rafraîchies au retour sur
l'onglet ou la fenêtre. Aucune valeur métier n'est conservée dans le stockage local.

## Objectifs prévisionnels (modifiables par l'administrateur)
Les valeurs par défaut sont :
- 30 000 arbres à planter
- Taux de survie des arbres d'au moins 80 % à 12 mois
- 450 tonnes de déchets à collecter
- 100 000 citoyens à sensibiliser
- 25 000 participants actifs

L'administrateur peut les ajuster à tout moment depuis `/parametres` ; les indicateurs et
rapports utilisent immédiatement les nouvelles cibles.

## Architecture

```
naatal-dakar/
├── frontend/          # React + Vite + Tailwind CSS
├── backend/           # Node.js + Express + MySQL
├── package.json       # Scripts racine (concurrently)
└── README.md
```

## Prérequis
- Node.js 18+ 
- npm 9+
- MySQL 8+ ou MariaDB (XAMPP, WAMP, MAMP...)

## Installation et lancement

### Installation complète
```bash
npm run install:all
```

### Lancement en développement
```bash
npm run dev
```

L'application sera accessible sur :
- **Frontend** : http://localhost:5173
- **Backend** : http://localhost:5000
- **Health check** : http://localhost:5000/api/health

## Activation de MySQL

Le backend utilise MySQL/MariaDB comme base de données.

1. Démarrer le serveur MySQL (par exemple via XAMPP : bouton **Start** sur MySQL)
2. Copier `backend/.env.example` vers `backend/.env` si nécessaire
3. Configurer les variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` et `DB_NAME`
4. Initialiser la base et les tables (optionnel : le backend le fait aussi au démarrage) :
   ```bash
   cd backend
   npm run db:setup
   ```
5. Redémarrer le backend

La base `naatal_dakar` et ses tables sont créées automatiquement au premier démarrage.
Les données de démonstration sont insérées uniquement si les tables sont vides
(`DB_AUTO_SEED=true`).

## Compte administrateur et authentification

**Aucun mot de passe par défaut n'est fourni.** Au premier démarrage, si la table
`utilisateurs` est vide, le compte administrateur est créé avec les valeurs de
`backend/.env`. `ADMIN_PASSWORD` est obligatoire et doit respecter la politique suivante :

- 8 caractères minimum (72 octets maximum) ;
- au moins une minuscule, une majuscule, un chiffre et un caractère spécial.

Générez un secret JWT aléatoire et un mot de passe fort avant le premier lancement :

```bash
# Secret JWT (64+ caractères)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

```env
JWT_SECRET=<secret-généré>
ADMIN_NAME=Administrateur NAATAL
ADMIN_EMAIL=admin@naatal.dakar
ADMIN_PASSWORD=<mot-de-passe-fort-et-unique>
```

Pour créer ou réinitialiser le compte administrateur :

```bash
cd backend
npm run admin:create
# ou avec des valeurs personnalisées (le mot de passe n'est jamais affiché)
npm run admin:create -- --email=admin@dakar.sn --nom="Admin Dakar"
```

L'administrateur peut **ajouter, modifier et supprimer** toutes les données.
Les routes d'écriture de l'API sont protégées par un jeton JWT et un contrôle des
permissions côté backend (voir « Gestion des utilisateurs et des rôles »).

- `POST /api/auth/login` : connexion (limitée en débit)
- `GET /api/auth/me` : profil connecté
- `PUT /api/auth/profile` : modification du profil
- `PUT /api/auth/password` : changement de mot de passe (mot de passe fort requis)

La page `/login` permet de se connecter. Une fois connecté, le nom et le rôle de
l'utilisateur apparaissent dans l'en-tête et les boutons d'écriture sont disponibles.
Sans connexion, l'application reste consultable en lecture seule : il s'agit d'un choix
fonctionnel, les données exposées étant des données environnementales agrégées et non
nominatives.

## Gestion des utilisateurs et des rôles

Le compte administrateur historique devient **Super Administrateur** au premier démarrage.
La page `/utilisateurs` (menu « Utilisateurs », visible selon les permissions) permet de :

- consulter, rechercher et filtrer les comptes (nom, email, téléphone, rôle, statut) ;
- ajouter un utilisateur avec mot de passe initial ou mot de passe temporaire généré ;
- modifier ses informations, son rôle et son statut ;
- activer / désactiver un compte (révocation immédiate des sessions) ;
- réinitialiser son mot de passe (jeton temporaire affiché une seule fois) ;
- supprimer un compte après confirmation.

Cinq rôles sont disponibles :

| Rôle | Portée |
| --- | --- |
| Super Administrateur | Accès complet, y compris la gestion des autres administrateurs. |
| Administrateur | Accès complet aux paramètres, aux objectifs et aux données, avec gestion des utilisateurs de rang inférieur. |
| Gestionnaire | Gestion des opérations et des activités de la mairie. |
| Agent | Saisie et mise à jour des données de terrain. |
| Utilisateur | Consultation des données de la plateforme. |

Permissions effectives par rôle :

| Permission | Super Admin | Administrateur | Gestionnaire | Agent | Utilisateur |
| --- | :-: | :-: | :-: | :-: | :-: |
| Consulter les utilisateurs (`users.read`) | ✅ | ✅ | — | — | — |
| Créer / modifier les utilisateurs (`users.manage`) | ✅ | ✅ | — | — | — |
| Supprimer les utilisateurs (`users.delete`) | ✅ | ✅ | — | — | — |
| Attribuer tous les rôles (`users.roles`) | ✅ | — | — | — | — |
| Gérer les paramètres (`settings.manage`) | ✅ | ✅ | — | — | — |
| Gérer les équipes et leurs clés (`teams.manage`) | ✅ | ✅ | — | — | — |
| Consulter les données (`operations.read`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Créer / modifier les données (`operations.write`) | ✅ | ✅ | ✅ | ✅ | — |
| Supprimer les données (`operations.delete`) | ✅ | ✅ | ✅ | — | — |

Règles de sécurité appliquées côté serveur :

- le rôle et les permissions sont **relus en base à chaque requête** : modifier le jeton
  ou le corps de la requête dans le navigateur ne donne aucun droit supplémentaire ;
- un utilisateur ne peut pas modifier son propre rôle, se désactiver ni se supprimer ;
- un administrateur ne peut agir que sur un compte de rang strictement inférieur et ne
  peut pas créer ni promouvoir un Super Administrateur ;
- le dernier Super Administrateur actif ne peut être ni rétrogradé, ni désactivé, ni supprimé ;
- un changement de rôle, une désactivation ou une réinitialisation de mot de passe
  incrémente la version de jeton et révoque immédiatement les sessions de l'utilisateur ;
- seul un Super Administrateur peut accorder des permissions supplémentaires à un compte.

API de gestion (jeton requis, `Cache-Control: no-store`) :

- `GET /api/users` : liste paginée, recherche `q`, filtres `role` et `statut`, statistiques ;
- `GET /api/users/:email` : fiche d'un utilisateur (adresse email encodée dans l'URL) ;
- `POST /api/users` : création ;
- `PUT /api/users/:email` : mise à jour ;
- `PATCH /api/users/:email/role` : changement de rôle ;
- `PATCH /api/users/:email/status` : activation / désactivation ;
- `POST /api/users/:email/reset-password` : réinitialisation du mot de passe ;
- `DELETE /api/users/:email` : suppression.

L'adresse email est la clé primaire de la table `utilisateurs` : elle identifie le
compte de façon unique, sert d'identifiant de session JWT et référence directement
les adhésions. Un changement d'email met à jour automatiquement les adhésions via
`ON UPDATE CASCADE` et renouvelle le jeton de l'utilisateur concerné.

## Gestion des équipes et des codes d’invitation

La page `/equipes` distingue deux usages :

- **Administrateurs autorisés** (`teams.manage`) : création, modification et
  suppression d’équipes, génération / régénération / désactivation des clés
  d’invitation, consultation et gestion des membres.
- **Utilisateurs connectés** : consultation des équipes et adhésion depuis
  **Mon compte** (`/compte`), rubrique **Mes équipes**.

### Côté administrateur

Chaque équipe possède un nom, une description, une zone, un responsable, un
statut et un compteur de membres. Les actions disponibles sont :

- **Créer une équipe** : le serveur génère immédiatement une clé active
  (`NDK-XXXXXXXX`) ;
- **Modifier une équipe** à tout moment ;
- **Supprimer une équipe** après confirmation : les adhésions sont retirées par
  la contrainte `ON DELETE CASCADE` et la clé disparaît avec l’équipe ;
- **Générer / régénérer une clé** : l’ancienne clé est immédiatement invalidée.
  Une durée de validité peut être choisie (7, 30, 90, 365 jours ou sans
  expiration) ;
- **Désactiver / réactiver une clé** sans supprimer l’équipe ;
- **Consulter les membres** et gérer leur adhésion : ajout par email, retrait,
  changement du rôle interne (`membre` ou `responsable`).

### Côté utilisateur

Depuis **Mon compte**, le bouton **« Rejoindre une équipe »** ouvre un champ de
saisie du code. La vérification est automatique pendant la frappe. Si le code
est valide, l’utilisateur confirme son adhésion. La rubrique **Mes équipes**
affiche ensuite ses équipes et permet de les quitter après confirmation.

Règles appliquées côté serveur :

- un code inconnu, désactivé ou expiré renvoie un message explicite ;
- un utilisateur ne peut pas rejoindre deux fois la même équipe : la contrainte
  d'unicité `(equipe_id, utilisateur_email)` et un contrôle explicite renvoient
  `409` en cas de doublon ;
- l’adhésion est enregistrée dans la table `membres_equipes` ; le compteur de
  membres de l’équipe est mis à jour ;
- quitter une équipe supprime uniquement l’adhésion de l’utilisateur, jamais
  l’équipe elle-même ;
- les rôles et permissions globaux de l’utilisateur restent inchangés : adhérer
  à une équipe ne donne aucun droit supplémentaire sur les autres modules ;
- seuls les titulaires de `teams.manage` (Super Administrateur ou
  Administrateur) peuvent créer, modifier, supprimer une équipe et gérer ses
  clés ;
- les tentatives de saisie de code sont limitées en débit pour éviter les
  énumérations.

API (jeton requis) :

- `GET /api/teams` : équipes, statut d’adhésion et clé (selon les droits) ;
- `GET /api/teams/mes-equipes` : équipes rejointes par l’utilisateur connecté ;
- `POST /api/teams/verifier-code` : vérification d’un code (`code`) ;
- `POST /api/teams/rejoindre` : adhésion avec un code valide (`code`) ;
- `DELETE /api/teams/mes-equipes/:id` : quitter une équipe ;
- `POST /api/teams` : création d’une équipe (`teams.manage`) ;
- `PUT /api/teams/:id` : modification d’une équipe (`teams.manage`) ;
- `DELETE /api/teams/:id` : suppression d’une équipe (`teams.manage`) ;
- `POST /api/teams/:id/code` : génération / régénération de la clé
  (`teams.manage`, durée facultative `expireDansJours`) ;
- `PATCH /api/teams/:id/code` : activation / désactivation de la clé
  (`teams.manage`, champ `actif`) ;
- `GET /api/teams/:id/membres` : membres de l’équipe (administrateur autorisé
  ou membre de l’équipe) ;
- `POST /api/teams/:id/membres` : ajout d’un membre par email (`teams.manage`) ;
- `PATCH /api/teams/:id/membres/:email` : rôle dans l'équipe (`membre` ou
  `responsable`, `teams.manage`, email encodé) ;
- `DELETE /api/teams/:id/membres/:email` : retrait d'un membre (`teams.manage`,
  email encodé).

La table `membres_equipes` est créée automatiquement au démarrage. Les bases
existantes reçoivent les colonnes `description`, `code_invitation`,
`code_invitation_actif` et `code_invitation_expire_le`, un code unique pour
chaque équipe déjà enregistrée, puis l'index d'unicité correspondant. La colonne
`utilisateur_email` remplace l'ancien identifiant numérique : les adhésions sont
converties à partir de l'email du compte, avec `ON DELETE CASCADE` et
`ON UPDATE CASCADE` vers `utilisateurs(email)`.

## Période de campagne

La période n'est pas figée dans le code : elle est stockée en base
(`parametres_campagne`, ligne unique) et **seul un titulaire de la permission
`settings.manage`** (Super Administrateur ou Administrateur) peut la modifier depuis
`/parametres`.

Règles métier appliquées côté serveur :

- la date de début et la date de fin sont obligatoires et au format `AAAA-MM-JJ` ;
- la date de fin doit être égale ou postérieure à la date de début ;
- la durée est calculée automatiquement (jours inclus) et limitée à 1 095 jours ;
- le statut (`Planifiée`, `En cours`, `Terminée`) est **déduit des dates**, jamais saisi
  manuellement : aucune incohérence possible entre le calendrier et l'affichage ;
- chaque modification est tracée (auteur et date) et l'ensemble de l'application est mis
  à jour immédiatement : tableau de bord, barre latérale, rapports et libellé
  « Campagne N jours — Mois / Mois AAAA ».

API :

- `GET /api/campagne` : période, statut, durée, avancement et libellé (lecture publique) ;
- `PUT /api/campagne` : mise à jour de `dateDebut` et `dateFin` (jeton + `settings.manage`).

## Informations du programme et objectifs

Les informations institutionnelles sont stockées dans `parametres_programme` (ligne
unique) et les objectifs dans `objectifs` (ligne unique). La lecture est publique ;
l'écriture est réservée à la permission `settings.manage` (Super Administrateur ou
Administrateur).

API :

- `GET /api/parametres` : informations du programme, objectifs et calendrier de campagne ;
- `PUT /api/parametres/programme` : nom, sigle, coordination, initiative et description ;
- `PUT /api/parametres/objectifs` : arbres, taux de survie, déchets, citoyens sensibilisés
  et participants actifs.

Règles métier :

- le nom du programme est obligatoire (2 à 150 caractères) ;
- les objectifs sont des nombres positifs ; le taux de survie est plafonné à 100 % ;
- chaque modification est tracée (auteur et date) pour les informations du programme et les
  objectifs ;
- les rôles, permissions et écrans d'administration ne sont visibles que par les
  administrateurs ; les autorisations réelles restent vérifiées côté serveur à chaque
  requête.

## Sécurité

Mesures appliquées :

- **Authentification** : JWT signé en HS256 avec issuer/audience contrôlés, expiration
  limitée à 7 jours maximum ; mots de passe hachés avec bcrypt (coût 12).
- **Révocation de session** : chaque connexion embarque une version de jeton ; la
  déconnexion, un changement de mot de passe ou une réinitialisation administrateur
  invalident immédiatement les jetons existants.
- **Anti-force brute** : limitation de débit sur la connexion (10 tentatives / 15 min par
  IP et email) et sur les écritures ; limitation globale de l'API.
- **Validation des entrées** : longueurs, formats (email, date, identifiants), énumérations
  métier, coordonnées GPS, taille des objets JSON. Requêtes SQL entièrement paramétrées.
- **Base de données** : `multipleStatements` désactivé sur le pool applicatif.
- **Erreurs** : aucune pile d'appels ni détail SQL renvoyé au client.
- **Transport/API** : Helmet, CORS limité aux origines configurées, corps de requête
  limités à 100 Ko, `Cache-Control: no-store` sur **toutes** les réponses de l'API afin
  qu'aucun navigateur ou proxy ne réutilise une donnée périmée.
- **Frontend** : CSP stricte injectée dans le build de production, en-têtes de sécurité
  sur le serveur de prévisualisation, jeton supprimé automatiquement en cas de 401.
- **Secrets** : `.env` ignoré par Git ; `.env.example` ne contient aucune valeur réelle.
- **Dépendances** : `npm audit` ne remonte aucune vulnérabilité connue.

Tests de sécurité automatisés (serveur démarré) :

```bash
cd backend
npm run test:security
```

> Le script exécute 46 contrôles (authentification, révocation, force brute, CORS,
> en-têtes, limites de corps, validation des entrées, rejet des balises HTML et contrôle
> des privilèges sur la gestion des utilisateurs).
>
> Le test de révocation effectue une déconnexion : il invalide les sessions
> administrateur en cours. Reconnectez-vous ensuite normalement. Le script crée puis
> supprime automatiquement ses comptes de test.

### Checklist avant mise en production

1. Utiliser HTTPS et un reverse proxy (Nginx, Traefik...), puis `TRUST_PROXY=true`.
2. Passer `NODE_ENV=production` et définir `CORS_ORIGIN` sur le domaine réel.
3. Créer un utilisateur MySQL dédié avec des droits limités (pas `root`, pas de mot de passe vide).
4. Générer un `JWT_SECRET` unique et un `ADMIN_PASSWORD` fort, puis les conserver hors du dépôt.
5. Désactiver `DB_AUTO_SEED` après l'initialisation.
6. Sauvegarder la base et surveiller les journaux d'erreurs et les réponses HTTP 429.

## Fonctionnalités

- **Tableau de bord** - Vue globale avec KPIs, graphiques et activités récentes
- **Carte interactive** - Localisation des interventions à Dakar (Leaflet)
- **Gestion des interventions** - CRUD complet avec filtres et validation
- **Reverdissement** - CRUD complet des opérations de plantation (villes/sites, espèces, arbres plantés, survivants, non survivants, date, entretien), suivi du taux de survie
- **Scan des arbres (QR code)** - Lecture du QR code d'un arbre pour afficher sa fiche et sa localisation sur une carte
- **Salubrité et déchets** - Suivi des collectes par zone et période
- **Mobilisation citoyenne** - Sensibilisation, écoles, caravanes
- **Équipes et bénévoles** - Gestion des équipes, codes d’invitation uniques et adhésion depuis l’espace personnel
- **Rapports et statistiques** - Export CSV/PDF
- **Paramètres et administration** - Configuration du programme, période de campagne pilotée par l'administrateur et gestion du compte administrateur
- **Gestion des utilisateurs** - CRUD complet, rôles, permissions, activation/désactivation, réinitialisation de mot de passe et statistiques
- **Messagerie privée** - Conversations entre membres, messages instantanés (Socket.IO), non-lus, accusés de lecture, présence et historique paginé
- **Authentification** - Connexion JWT, révocation de session et protection des opérations d'écriture
- **Synchronisation des données** - Toute modification enregistrée en base est immédiatement visible sur toutes les pages et tous les onglets ouverts

## Opérations de plantation

La page **Reverdissement** permet à tout compte disposant de `operations.write`
d'ajouter et de modifier une opération de plantation (ville/site, espèces, arbres plantés,
survivants, non survivants, date, entretien, responsable). La suppression requiert
`operations.delete`.

Chaque enregistrement est immédiatement visible dans le tableau de bord, les rapports et
tous les onglets ouverts : les indicateurs sont recalculés depuis MySQL.

API :

- `GET /api/trees` : opérations de plantation et statistiques ;
- `POST /api/trees` : création (jeton + `operations.write`) ;
- `PUT /api/trees/:id` : modification (jeton + `operations.write`) ;
- `DELETE /api/trees/:id` : suppression (jeton + `operations.delete`).

Règle de cohérence : la somme des arbres survivants et non survivants ne peut pas
dépasser le nombre d'arbres plantés.

## Scan des arbres par QR code

Chaque arbre de démonstration possède un identifiant (`ARB-001` à `ARB-006`) et un QR code
encodant une URL du type `https://naatal.dakar/arbre/ARB-001`.

Depuis la page **Scanner un arbre** (`/scan-arbre`), il est possible de :

- scanner le QR code avec la caméra du téléphone ;
- importer une photo du QR code ;
- saisir directement le code de l'arbre.

La fiche affichée contient l'espèce, le site, le quartier, la date de plantation, les
mesures, l'état, l'entretien et la localisation (carte Leaflet + lien OpenStreetMap).
Des QR codes de démonstration sont également affichés en bas de la page pour tester
la fonctionnalité sans arbre imprimé.

### API

- `GET /api/trees/arbres` : liste des arbres identifiés par QR code
- `GET /api/trees/scan/:code` : fiche d'un arbre à partir du contenu du QR code
  (identifiant `ARB-001`, URL `.../arbre/ARB-001` ou format `NAATAL-DAKAR:TREE:ARB-001`)

> L'accès à la caméra nécessite un contexte sécurisé (HTTPS ou `localhost`).

## Données

Les interventions, plantations, équipes, campagnes, utilisateurs, informations du
programme et objectifs prévisionnels sont stockés dans MySQL. Les données de
démonstration ne sont insérées qu'à la première initialisation (`DB_AUTO_SEED=true`) ;
ensuite, ce sont les modifications enregistrées par l'administrateur qui font foi.

Les objectifs prévisionnels restent distincts des réalisations : les réalisations ne sont
jamais plafonnées par les objectifs, seule la barre de progression est limitée à 100 %.
Le graphique d'évolution est une projection calculée à partir de la campagne et des
réalisations enregistrées.

## Technologies

**Frontend:** React, Vite, JavaScript, Tailwind CSS, React Router, Lucide React, Recharts, Leaflet/React Leaflet, Axios, html5-qrcode, qrcode.react, Socket.IO Client
**Backend:** Node.js, Express.js, MySQL/MariaDB (mysql2), JWT, bcryptjs, CORS, dotenv, express-validator, Helmet, Socket.IO
**Outils:** concurrently

## Licence
MIT - Ville de Dakar, Direction de la Planification et du Développement Durable (DPDD)

## Partage en ligne avec un camarade (tunnel Cloudflare)

Pour montrer l'application a distance sans la deployer sur un serveur :

1. Installer `cloudflared` (une seule fois) :
   ```powershell
   winget install --id Cloudflare.cloudflared
   ```
2. Demarrer MySQL (XAMPP/WAMP/MAMP ou service Windows).
3. Lancer le script depuis le dossier `naatal-dakar` :
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\partager-en-ligne.ps1
   ```
   ou simplement :
   ```powershell
   npm run share
   ```
4. Le script demarre le backend (port 5000) et le frontend (port 5173) si
   necessaire, ouvre le tunnel, affiche l'URL publique du type
   `https://....trycloudflare.com` et la copie dans le presse-papiers.

Notes :

- L'URL est temporaire : elle change a chaque lancement et cesse de fonctionner
  des que le tunnel, l'ordinateur ou la connexion Internet s'arrete.
- Le backend n'est pas expose directement : le serveur Vite relaie `/api` vers
  `http://localhost:5000`.
- Les journaux du backend, du frontend et de `cloudflared` sont ecrits dans
  `logs/`.
- Pour disposer d'un lien permanent avec un nom de domaine fixe, il faut creer
  un tunnel nomme Cloudflare (`cloudflared tunnel create ...`) et utiliser un
  domaine gere par Cloudflare.

## Comptes utilisateurs

**Toute l'application est protégée.** Un visiteur non connecté est redirigé vers
`/login` ; après connexion, il retrouve automatiquement la page qu'il avait
demandée. Les API de données (`dashboard`, `interventions`, `trees`, `waste`,
`citizens`, `teams`, `reports`) exigent également un jeton JWT valide. Seules
les informations institutionnelles (`/api/parametres`, `/api/campagne`) restent
lisibles publiquement pour l'écran de connexion.

### Créer un compte

Depuis la page `/login`, l'onglet **Créer un compte** permet à un utilisateur de
s'inscrire avec son nom, son email, un téléphone facultatif et un mot de passe.
Le compte est créé avec le rôle `utilisateur` (accès en lecture seule) : le rôle
n'est jamais choisi par le formulaire, ce qui empêche toute élévation de
privilèges. Une fois le compte créé, l'utilisateur est redirigé vers l'onglet
**Se connecter**, avec son email prérempli et un message confirmant
l'inscription : il se connecte ensuite avec son email et son mot de passe. Le
compte peut être promu par un administrateur depuis la page **Utilisateurs**.

Le mot de passe doit contenir au moins 8 caractères, avec une majuscule, une
minuscule, un chiffre et un caractère spécial. Les inscriptions sont limitées à
10 par heure et par adresse IP/email.

### Se connecter et gérer son compte

Une fois connecté, l'utilisateur accède à **Mon compte** (`/compte`) depuis son
nom dans l'en-tête ou depuis le menu latéral. Il peut y :

- consulter ses informations et son rôle ;
- modifier son nom, son email et son téléphone ;
- changer son mot de passe (les autres sessions sont alors déconnectées) ;
- se déconnecter.

### API d'authentification

- `POST /api/auth/register` : créer un compte (`nom`, `email`, `telephone`,
  `password`, `confirmPassword`) ; la connexion se fait ensuite via
  `POST /api/auth/login` ;
- `POST /api/auth/login` : se connecter ;
- `GET /api/auth/me` : relire le profil connecté ;
- `PUT /api/auth/profile` : modifier nom, email et téléphone ;
- `PUT /api/auth/password` : changer le mot de passe et renouveler la session ;
- `POST /api/auth/logout` : révoquer la session courante.

## Messagerie privée

La rubrique **Messages** du menu permet à deux comptes d'échanger en privé. Les
messages sont enregistrés dans MySQL puis diffusés immédiatement par Socket.IO
(même port que l'API, via le proxy Vite). L'interface affiche les conversations
triées par activité, le dernier message, les non-lus, la présence en ligne, les
accusés de lecture et permet de charger progressivement l'historique.

API (jeton requis) :

- `GET /api/messages/conversations` : conversations de l'utilisateur connecté ;
- `POST /api/messages/conversations` : démarrer / retrouver une conversation (`email`) ;
- `GET /api/messages/users?q=...` : rechercher un membre actif ;
- `GET /api/messages/conversations/:id/messages` : historique paginé (`before`, `limit`) ;
- `POST /api/messages/conversations/:id/messages` : envoyer un message (`content`) ;
- `POST /api/messages/conversations/:id/read` : marquer comme lu ;
- `DELETE /api/messages/:id` : supprimer son propre message (suppression logique).

Règles principales : conversation unique par paire d'utilisateurs, interdiction
de s'écrire à soi-même, accès réservé aux deux participants, suppression limitée
à l'auteur, validation et limitation de débit des envois. Les tables
`conversations`, `conversation_participants` et `messages` sont créées
automatiquement au démarrage ; la migration manuelle se trouve dans
`backend/src/config/migrations/001_messagerie.sql`.

Documentation complète : **[MESSAGERIE.md](./MESSAGERIE.md)**.  
Rapport de tests : **[RAPPORT_TESTS_MESSAGERIE.md](./RAPPORT_TESTS_MESSAGERIE.md)**.

Test automatisé (serveur démarré) :

```bash
cd backend
npm run test:messaging
```
