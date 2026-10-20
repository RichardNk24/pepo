# Pepo — première course complète

## Ce que ce paquet ajoute

- Rejeu sûr de l’acceptation de la même offre et des transitions déjà réalisées :
  une réponse perdue puis une nouvelle tentative ne double pas le compteur de courses.
- Contrôle du rôle passager/chauffeur pour ces actions et pour la notation.
- Nouvelle vérification de la ville et du véhicule du chauffeur à l’acceptation.
- Dates d’arrivée au départ et d’annulation enregistrées.
- Confirmation explicite et datée des espèces reçues, réservée au chauffeur affecté
  après la fin de la course. Le montant vient du prix convenu côté serveur.
- Affichage dans Rider et Driver : réception non confirmée ou confirmée par le chauffeur.
  Le bouton Actualiser le paiement relit l’état serveur.
- Tests HTTP couvrant une course complète, le PIN, les répétitions, le paiement déclaré,
  la note, les compteurs, les gains et l’alimentation du miroir PostgreSQL.

La confirmation des espèces est une déclaration du chauffeur. Elle n’est ni un
paiement électronique vérifié ni une preuve indépendante de remise d’argent.
Les gains existants représentent le montant brut des courses terminées, pas un
solde bancaire ni une garantie d’encaissement. Mobile Money/cartes ne sont pas
traités par ce paquet. Les protections de nuit restent actives.

Le miroir NestJS/PostgreSQL précédent est conservé. Les routes métier modifiées
utilisent encore le routeur de compatibilité et SQLite. Il ne s’agit pas du
basculement complet du backend vers les contrôleurs NestJS/PostgreSQL.

## Installation

Arrêter l’API et les serveurs Expo. Dans le dossier extrait contenant installer.cjs :

```powershell
node .\installer.cjs --project="C:\Users\Guest-PC\Documents\Pepo-monorepo\pepo"
```

Toutes les versions sont vérifiées avant écriture ; sauvegarde automatique des
fichiers remplacés. Pas de modification de .env, des images ou des bases de données.
Les nouveaux champs sont stockés dans le JSON des courses déjà existant : aucune
nouvelle migration SQL et aucune nouvelle dépendance.

À la racine du projet :

```powershell
npm run typecheck -w @pepo/api
npm run typecheck -w @pepo/rider
npm run typecheck -w @pepo/driver
npx vitest run tests/ride-completion.test.ts tests/api.test.ts tests/night-safety.test.ts tests/trip-replication.test.ts tests/roles.test.ts tests/postgres-auth.test.ts tests/realtime.test.ts
```

Attendu : 61 tests passent. Ils créent leurs propres données temporaires et ne
modifient pas les cinq courses de votre base. Ils n’envoient pas de SMS payant.
L’authentification PostgreSQL et la réplication utilisent des doubles de test dans
ces suites ; les tests HTTP des courses utilisent réellement SQLite et les routes.

## Deux comptes, un seul iPhone

- iPhone / Expo Go : compte PASSAGER.
- Laptop / navigateur : compte CHAUFFEUR avec un autre numéro de test.
- API locale commune aux deux ; DEV_AUTH=true seulement dans cet environnement.
- Un autre onglet navigateur pour l’administration Pepo.

Ne passez pas en démo locale : les deux applications doivent avoir une API renseignée.
Dans apps/driver/.env, utilisez la même EXPO_PUBLIC_API_URL que le rider.
Le navigateur sur le laptop peut aussi joindre http://127.0.0.1:4000, mais conserver
la même IP Wi-Fi simplifie la comparaison. EXPO_PUBLIC_MAPS_API_URL vise aussi cette API.
Ne changez ni DATABASE_URL ni son port 55432 : c’est la liaison API→PostgreSQL.
Pour afficher les codes de développement dans le driver, EXPO_PUBLIC_DEV_AUTH=true
peut être utilisé en développement uniquement.

Terminal 1, racine du projet :

```powershell
npm run api
```

Terminal 2 :

```powershell
cd "C:\Users\Guest-PC\Documents\Pepo-monorepo\pepo\apps\rider"
npx expo start --go --clear --port 8081
```

Terminal 3 :

```powershell
cd "C:\Users\Guest-PC\Documents\Pepo-monorepo\pepo"
npm run web -w @pepo/driver -- --clear
```

Ouvrir http://localhost:8082 sur le laptop. Scanner le QR du Rider uniquement avec
l’iPhone. Le test web n’exige pas de compte Apple Developer payant.

## Préparer le chauffeur

1. Connectez-vous dans Driver avec le second numéro et le code de développement.
2. Choisissez Lubumbashi, comme le passager.
3. Renseignez le véhicule, modèle, plaque et les documents dans le parcours Driver.
4. Ouvrez http://localhost:4000/admin sur le laptop et authentifiez-vous avec votre
   ADMIN_TOKEN local (ne le partagez pas). Examinez puis approuvez ce dossier.
   L’inscription seule ne donne pas le droit de recevoir des courses.
5. Rechargez Driver, autorisez la localisation du navigateur et passez En ligne.
6. Pour le premier essai, utilisez le même type des deux côtés, par exemple taxi.

Pour tester la nuit, une approbation de nuit supplémentaire, des documents valides
et un GPS récent et précis sont nécessaires. Ne désactivez pas ces contrôles pour
faire passer un essai. Un laptop peut fournir un GPS trop imprécis pour cette étape :
commencez par le parcours fonctionnel en journée. Cela ne valide pas la sécurité de
nuit ni le suivi GPS réel d’un chauffeur en déplacement.

## Parcours à suivre

| Étape | Action | Résultat attendu |
| --- | --- | --- |
| 1 | Rider : choisir départ, destination et le véhicule du chauffeur | Estimation et offre proposées |
| 2 | Rider : demander la course | État searching, demande en attente |
| 3 | Driver en ligne : ouvrir la demande et proposer/accepter le prix | Offre envoyée au passager, encore searching |
| 4 | Rider : choisir cette offre | État accepted et chauffeur affecté |
| 5 | Driver : ouvrir la course et signaler son arrivée | État arrived |
| 6 | Lire le PIN dans Rider, le saisir dans Driver | État in_progress si le code est correct |
| 7 | Driver : terminer et confirmer l’arrivée à destination | État completed dans les deux apps |
| 8 | Driver : confirmer les espèces reçues | Horodatage serveur, confirmation visible |
| 9 | Rider : Actualiser le paiement puis noter le chauffeur | Confirmation et note enregistrées |
| 10 | Fermer puis rouvrir les applications, consulter Activité | La course reste terminée avec son montant |

Dans ce test sur table, il n’est pas nécessaire de conduire. Il valide les écrans
et échanges, pas la navigation sur route. Pour la recette terrain, réaliser ensuite
un trajet avec un vrai chauffeur équipé de son téléphone et vérifier GPS, distances,
ETA, navigation vocale, réseau intermittent, sécurité et réception des événements.
Les offres expirent après deux minutes : actualisez l’offre si besoin.

Une mauvaise saisie PIN doit être refusée. Cinq erreurs bloquent le départ ; ne les
faites pas sur la course que vous voulez terminer. Le chauffeur ne doit jamais voir
le PIN dans sa réponse serveur ou dans le partage public.

## Vérification PostgreSQL

Avec le miroir activé, après quelques secondes, à la racine du projet :

```powershell
docker compose -f .\docker-compose.backend.yml exec postgres psql -U pepo -d pepo -c "SELECT id,status,data->>'agreedPrice' AS amount,data->>'cashCollectedAt' AS cash_received_at FROM trips ORDER BY created_at DESC LIMIT 6;"
```

La nouvelle course doit être completed. Les cinq courses annulées restent cancelled.
Un cash_received_at vide signifie réception non confirmée. Ce champ n’est renseigné
qu’après la confirmation explicite du chauffeur.

## Si la demande n’apparaît pas

Vérifiez dans cet ordre : API identique, comptes distincts, même ville, même véhicule,
chauffeur approuvé et en ligne, aucune course active du chauffeur, fraîcheur du GPS.
Le dispatcher peut mettre quelques instants à recommander une demande. La position
sur la carte de simulation ne constitue pas un chauffeur connecté.

Ne créez pas de comptes/faux chauffeurs en production pour ce test. Les clés serveur
restent dans apps/api/.env. Ne collez pas vos tokens, documents ou PIN dans GitHub.

## Résultats de préparation

- Vérifications TypeScript API/UI/Rider/Driver : réussies.
- 61 tests ciblés : réussis.
- Compilation web Expo de Pepo Driver : réussie.
- Test visuel iPhone et navigateur, trajet réel et paiement réel : non exécutés ici.
- Traductions de la confirmation espèces en français/anglais/swahili/lingala fournies ;
  faire relire les formulations locales avant diffusion publique.

## Commit proposé

feat(rides): harden trip completion and add driver cash receipt confirmation
