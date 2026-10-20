# Courses — persistance PostgreSQL, étape intermédiaire

## Portée exacte

Le module NestJS TripPersistenceModule réplique les courses SQLite dans PostgreSQL.
SQLite reste la source de vérité pour les routes, dispatch, sécurité, GPS et sockets.
Ce paquet ne constitue PAS le basculement complet des courses vers PostgreSQL,
ni une autorisation de lancer plusieurs instances API avec des SQLite séparés.
Ne supprimez pas SQLite. PostgreSQL seul ne restaure pas encore toutes les données
(messages, assistance, partages, profils chauffeurs et autres modules).

Fonctionnement : une file persistante est alimentée par des triggers SQLite dans
la transaction de chaque changement. Le worker NestJS copie 100 événements au
maximum par lot, une fois par seconde en fonctionnement normal. Il acquitte après
COMMIT PostgreSQL. Un arrêt entre COMMIT et acquittement rejoue sans régression.
Après erreur, reprise progressive jusqu’à 30 secondes entre tentatives.
Le démarrage échoue si PostgreSQL est indisponible ou si le premier lot est invalide.
En cours d’exécution, une panne PostgreSQL laisse la file intacte et les fonctions
historiques continuent via SQLite. Surveillez l’espace disque si la panne dure.

Une identité de source bloque la connexion accidentelle d’un autre SQLite au même
PostgreSQL. Restaurer un ancien SQLite nécessite une réconciliation explicite : ne
supprimez pas cette protection pour forcer une reprise. Un seul backend actif et
une seule base SQLite faisant autorité pendant cette étape.

Contraintes partielles dans les deux bases : un passager ne peut avoir qu’une course
searching/accepted/arrived/in_progress ; un chauffeur une course accepted/arrived/
in_progress. Plusieurs réservations scheduled restent possibles. Les doublons
historiques arrêtent l’installation des index ; ils ne sont jamais effacés.
Les profils absents de PostgreSQL sont insérés pour satisfaire les clés étrangères,
les profils PostgreSQL existants ne sont pas remplacés.

## Installation Windows

1. Arrêtez l’API (Ctrl+C), pas PostgreSQL. Cela permet une sauvegarde SQLite cohérente.
2. Installez le paquet depuis son dossier extrait :

```powershell
node .\installer.cjs --project="C:\Users\Guest-PC\Documents\Pepo-monorepo\pepo"
```

L’installateur vérifie tous les fichiers avant écriture, sauvegarde ceux remplacés,
et refuse les versions différentes. Il ne modifie ni .env, ni assets, ni bases.
Aucune dépendance npm supplémentaire.

3. Depuis la racine de Pepo, sauvegardez SQLite API arrêtée :

```powershell
Copy-Item .\apps\api\data\pepo.sqlite (".\apps\api\data\pepo.sqlite.backup-" + (Get-Date -Format yyyyMMdd-HHmmss))
npm run typecheck -w @pepo/api
npx vitest run tests/trip-replication.test.ts tests/postgres-auth.test.ts tests/night-safety.test.ts
```

Si DATA_DIR est personnalisé, utilisez le chemin correspondant pour la sauvegarde.
Sauvegardez également PostgreSQL avant migration, depuis la racine :

```powershell
docker compose -f .\docker-compose.backend.yml exec postgres pg_dump -U pepo -d pepo -Fc -f /tmp/pepo-before-trips.dump
docker compose -f .\docker-compose.backend.yml cp postgres:/tmp/pepo-before-trips.dump .\pepo-before-trips.dump
```

Adaptez le rôle et le nom de base si vous les avez changés. Le dump contient des
données privées : ne le commitez pas et ne le joignez pas à une archive du code.

4. Test PostgreSQL réel, schéma temporaire isolé (droit CREATE SCHEMA requis) :

```powershell
Set-Location .\apps\api
node --import tsx --env-file-if-exists=.env src/trips/persistence/test-trip-mirror-postgres.ts
Set-Location ..\..
```

Résultat attendu : PASS. Le schéma temporaire est supprimé à la fin. Si le processus
est tué brutalement, un schéma pepo_trip_test_* peut rester ; aucune table public
n’est utilisée par ce test.

5. Appliquez la nouvelle migration (ne modifiez jamais 001_core.sql) :

```powershell
npm run db:migrate -w @pepo/api
```

6. Ajoutez une seule ligne dans apps/api/.env :

```dotenv
TRIPS_POSTGRES_MIRROR_ENABLED=true
```

Conservez DATABASE_URL avec le port hôte 55432 et votre configuration auth actuelle.
Ne mettez pas cette variable dans le rider. Puis lancez `npm run api` à la racine.

## Vérification opérationnelle

Dans un autre terminal :

```powershell
cd "C:\Users\Guest-PC\Documents\Pepo-monorepo\pepo\apps\api"
node --import tsx --env-file-if-exists=.env src/trips/persistence/check-trip-mirror.ts
```

Après rattrapage, pending doit atteindre 0 et les nombres de courses doivent
correspondre pour une base PostgreSQL initialement vide de courses. Pendant les
mises à jour GPS, un petit retard transitoire est normal. synced_at est vide s’il
n’existe encore aucune course ; ce n’est pas une erreur.

Sur l’iPhone, créez une demande puis annulez-la. Vérifiez dans PostgreSQL :

```powershell
docker compose -f .\docker-compose.backend.yml exec postgres psql -U pepo -d pepo -c "SELECT id,status,vehicle,legacy_sequence FROM trips ORDER BY created_at DESC LIMIT 5;"
```

La dernière course doit être cancelled après synchronisation. Redémarrez l’API,
puis vérifiez l’historique dans Pepo et relancez le diagnostic. Une course complète
avec acceptation, PIN et arrivée reste à tester avec un compte chauffeur.

En développement uniquement, après un démarrage réussi, vous pouvez arrêter
PostgreSQL, créer puis annuler une demande, redémarrer PostgreSQL et vérifier que
pending revient à zéro. Ne supprimez aucun volume Docker.

## Désactivation et limites

Mettre TRIPS_POSTGRES_MIRROR_ENABLED=false arrête le worker au prochain redémarrage.
Les triggers continuent à conserver les changements pour permettre une reprise ;
les index restent actifs. Ce n’est pas une suppression des données.

Les suppressions physiques de courses sont refusées pendant cette transition.
La purge/rétention des courses devra disposer d’un événement de suppression avant
le basculement définitif. Les snapshots conservent les champs de la course, y
compris le PIN déjà présent dans SQLite : limiter l’accès aux bases et sauvegardes.

Étape suivante : migrer les lectures/écritures de tous les consommateurs de courses
vers un repository asynchrone PostgreSQL, puis déplacer les transactions métier,
les contrôles PIN, les tâches planifiées et les notifications vers un outbox PG.
Le dispatcher distribué/Redis n’est pas activé par ce paquet.

## Validation de livraison

TypeScript API : réussi. 32 tests ciblés : réussis (SQLite réel, PG simulé).
Test PostgreSQL réel fourni mais non exécuté dans l’environnement de préparation,
qui ne dispose pas d’un serveur PostgreSQL. Le parcours iPhone reste à vérifier
sur votre installation. Aucune affirmation de migration complète ou de validation
production.
