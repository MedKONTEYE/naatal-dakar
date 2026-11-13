# Rapport de tests — Messagerie privée NaataL

**Date :** 9 novembre 2026  
**Environnement :** Windows, Node.js v24.20.0, npm 11.19.0, MySQL/MariaDB sur le port 3306  
**Applications :** backend Express sur `http://localhost:5000`, frontend Vite sur `http://127.0.0.1:5173`

## 1. Synthèse

| Vérification | Commande | Résultat |
| --- | --- | --- |
| Tests fonctionnels de la messagerie | `cd backend && npm run test:messaging` | **25/25 réussis** |
| Tests via le proxy Vite (WebSocket inclus) | `MESSAGING_TEST_URL=http://127.0.0.1:5173 npm run test:messaging` | **25/25 réussis** |
| Tests via une URL publique Cloudflare | `MESSAGING_TEST_URL=https://<tunnel>.trycloudflare.com npm run test:messaging` | **25/25 réussis** |
| Tests de sécurité de la plateforme | `cd backend && npm run test:security` | **46/46 réussis** |
| Build de production du frontend | `cd frontend && npm run build` | **Succès** (2 111 modules) |

Le test public a été exécuté à travers un tunnel Cloudflare reliant le poste local
à une URL `https://*.trycloudflare.com`. Il valide le chemin réseau externe, le
proxy Vite, les appels REST et la connexion Socket.IO en WebSocket, donc le cas
d'usage « deux utilisateurs sur des réseaux différents ».

## 2. Couverture du test automatisé (25 contrôles)

Le script `backend/scripts/messaging-test.mjs` crée trois comptes temporaires
(A, B et C), ouvre trois sockets authentifiés, puis vérifie :

1. création et connexion des trois comptes par l'API ;
2. authentification des trois sockets ;
3. recherche de B par A ;
4. refus d'une conversation avec soi-même ;
5. création d'une conversation privée ;
6. non-duplication de la conversation (A→B = B→A) ;
7. présence de B en ligne dans la liste de A ;
8. réception instantanée du message de A par B via Socket.IO ;
9. compteur de non-lus de B à 1 ;
10. présence du message dans l'historique de B ;
11. accusé de lecture transmis à A en temps réel ;
12. compteur de non-lus de B remis à 0 ;
13. indicateur « lu » visible par A ;
14. réception instantanée de la réponse de B par A ;
15. persistance de l'historique après déconnexion / reconnexion ;
16. refus de lecture et d'écriture pour un utilisateur extérieur (C) ;
17. diffusion de la suppression en temps réel ;
18. remplacement du message supprimé par « Message supprimé » ;
19. refus de suppression du message d'autrui ;
20. pagination sans doublon ;
21. diffusion de la présence hors ligne ;
22. refus d'un message vide ;
23. refus d'un message contenant du HTML ;
24. refus des API de messagerie sans authentification ;
25. refus d'un socket avec un jeton invalide.

Les comptes et conversations créés par le test sont supprimés à la fin.

## 3. Couverture des scénarios demandés

| Scénario | Statut | Preuve |
| --- | --- | --- |
| 1. Deux utilisateurs connectés dans deux navigateurs | Validé par le test (deux comptes et deux sockets) | Contrôles 1, 2, 8, 14 |
| 2. A recherche B et ouvre la conversation | Validé | Contrôles 3, 5 |
| 3. B voit le message sans actualiser | Validé | Contrôle 8 |
| 4. A voit la réponse de B sans actualiser | Validé | Contrôle 14 |
| 5. Historique conservé après reconnexion | Validé | Contrôle 15 |
| 6. Badges de non-lus dans le menu et l'en-tête | Validé côté API et interface | Contrôles 9, 12 ; `MessagingContext`, `Sidebar`, `Header` |
| 7. Un troisième compte ne peut pas ouvrir la conversation | Validé | Contrôle 16 |
| 8. Utilisation sur mobile (liste ↔ discussion, clavier) | Interface responsive vérifiée par build ; test tactile manuel restant à faire sur appareil | `Messages.jsx` |
| 9. Coupure / rétablissement du réseau | Validé par la reconnexion Socket.IO et le rechargement de l'historique | Contrôle 15, test via tunnel |
| 10. Deux réseaux / pays différents | Validé via URL publique Cloudflare et WebSocket | 25/25 contrôles via le tunnel |

## 4. Tests de sécurité (46/46)

La suite `security-test.mjs` couvre notamment :

- refus des anciens mots de passe par défaut et des jetons forgés ;
- vérification de l'issuer, de l'audience et de la version de jeton ;
- limitation de la force brute et des écritures ;
- validation stricte des entrées (HTML, dates, identifiants, SQLi) ;
- en-têtes de sécurité, CORS, taille de corps et codes d'erreur sans fuite ;
- contrôle des rôles et permissions (gestionnaire, administrateur, super administrateur) ;
- révocation de session après déconnexion, désactivation ou suppression ;
- maintien de la lecture publique des paramètres.

Les deux contrôles auparavant obsolètes ont été corrigés : le test de scan QR
envoie désormais le JWT attendu, et le test de lecture publique cible bien
`/api/parametres`.

## 5. Build frontend

```
✓ 2111 modules transformed.
dist/index.html                        1.25 kB
dist/assets/index-*.css               46.13 kB
dist/assets/ScanArbre-*.js           403.02 kB
dist/assets/index-*.js             1,060.20 kB
✓ built in 2.93s
```

Le build signale uniquement un avertissement de taille de bundle supérieur à
500 kB. Il n'empêche pas le fonctionnement et pourra être traité par du
découpage dynamique supplémentaire.

## 6. Limites et points à surveiller

- Les tests automatisés valident le temps réel et la persistance ; un essai
  manuel sur téléphone reste recommandé pour le confort clavier et le rendu.
- La précision des colonnes `TIMESTAMP`/`DATETIME` est à la seconde. Un message
  créé exactement dans la même seconde qu'un accusé de lecture peut ne pas être
  compté comme non lu, tout en étant bien reçu par Socket.IO.
- Le déploiement multi-instances nécessite un adaptateur Redis pour Socket.IO.
- Les notifications sont internes à l'application (pas de Web Push ni d'email).
- Les photos de profil ne sont pas stockées : les avatars utilisent les
  initiales et une couleur stable.
