# Pepo — Rider, Driver et API commune

Ce dossier est la continuation du Pepo fourni, organisé en **npm workspaces**. Le Rider conserve ses écrans, sa carte, ses photos, Vehicle Options, le panneau animé, les étapes et le parcours de réservation. Pepo Driver est une application séparée. Les deux utilisent la même API Express et la même base SQLite.

## Référence de conception

Pepo doit comprendre les réalités de mobilité congolaises : références et entrées fiables, simplicité, sécurité des deux parties, langues locales et économie du chauffeur. La [vision intégrale](docs/VISION-PEPO.md) guide les décisions ; la [feuille de route P0–P3](docs/FEUILLE-DE-ROUTE-INTELLIGENCE.md) distingue capacités existantes et évolutions à construire. Les instructions `AGENTS.md` rendent cette référence consultable lors des futures modifications du projet. Ces documents ne signifient pas que toutes les capacités d'intelligence décrites sont déjà implémentées.

## Installation

**Décompressez dans un nouveau dossier. Ne superposez pas cette archive à l’ancien projet.** Gardez votre ancien dossier pour revenir en arrière. Node.js **24 LTS** et npm sont requis. Installez les dépendances une seule fois à la racine :

```sh
npm ci
```

Pour une première exploration, laissez les URL d’API vides : les deux applis offrent une démo locale indépendante. Sur téléphone, une carte illustrée hors ligne se choisit explicitement avec `EXPO_PUBLIC_MAP_RENDERER=demo` dans le `.env` de chaque app. Pour Google Maps, suivez [le guide cartes](docs/GOOGLE-MAPS.md) ; une configuration manquante est désormais signalée au lieu d’afficher Apple Maps. Une course démo du Rider n’apparaît donc pas dans le Driver. Utilisez l’API commune pour tester leur communication réelle.

Ouvrez deux terminaux à la racine :

```sh
npm run rider
npm run driver
```

Rider utilise le port **8081**, Driver **8082**. Pour un aperçu navigateur : `npm run web:rider` et `npm run web:driver`.

## Reprendre votre configuration et vos données

Les clés du projet reçu ne sont pas incluses dans cette archive. Deux possibilités :

- Copiez les fichiers `.env.example` en `.env` dans `apps/rider`, `apps/driver` et `apps/api`, puis renseignez vos valeurs.
- Ou importez localement votre ancienne configuration, depuis la racine du nouveau dossier :

```sh
node scripts/import-settings.cjs --from "C:\chemin\vers\ancien\pepo"
```

L’import filtre les variables selon l’application et refuse d’écraser une configuration existante. Il ne modifie pas votre ancien projet. Il ne réutilise pas le projet EAS du Rider pour Driver.

Si vous aviez déjà une base dans `server/data`, arrêtez l’ancien serveur, sauvegardez **tout** ce dossier avec sa clé de stockage et ses documents chiffrés, puis ajoutez `--copy-data` à la commande. Si vous utilisiez un `DATA_DIR` personnalisé, copiez ce dossier vous-même dans `apps/api/data` avant le premier démarrage. La migration SQLite sépare les profils de façon idempotente ; sauvegardez la base avant de l’utiliser.

Les utilisateurs existants se reconnectent avec leur numéro. Le Rider reprend les anciennes préférences et la démo passager si elles sont encore présentes sur le téléphone. Les sessions et préférences sont désormais distinctes entre Rider et Driver.

## Connecter Rider et Driver

1. Dans `apps/api/.env`, configurez l’API. Pour des essais locaux sans SMS, `DEV_AUTH=true` renvoie un code de test. Ce mode est refusé en production.
2. Lancez `npm run api` depuis la racine. L’API écoute normalement sur **4000**.
3. Dans les deux applications, configurez `EXPO_PUBLIC_API_URL` avec **la même URL**. Sur téléphone, utilisez l’adresse Wi-Fi du PC, par exemple `http://192.168.1.20:4000`, jamais `localhost`.
4. Configurez également `EXPO_PUBLIC_MAPS_API_URL` si vous utilisez la page Google Maps fournie par l’API. Les clés serveur restent dans `apps/api/.env`.
5. Redémarrez Expo après toute modification des variables publiques.

Le chauffeur ajoute son véhicule et ses documents. Un administrateur doit les approuver avant qu’il puisse recevoir des demandes réelles. L’outil de revue existant reste disponible à `/admin`. Il utilise `ADMIN_TOKEN` côté serveur. Le dispatch sélectionne les chauffeurs disponibles de la bonne ville et catégorie ; Socket.IO signale les changements aux comptes concernés. Le fonctionnement de négociation existant est conservé : le chauffeur propose un prix, le passager choisit l’offre.

## Langues et voix

Français, English, Kiswahili et Lingala sont disponibles depuis l’accueil d’inscription et les paramètres du compte. Les libellés, les écrans de commande, les messages de l’interface et les indications de départ/arrivée utilisent le catalogue commun. Les noms des lieux et les messages écrits par les utilisateurs restent intacts.

Dans le choix d’un lieu, **Parler** permet de dire une destination ou une commande de navigation. Le lieu reconnu est affiché dans la recherche ; une course n’est jamais commandée automatiquement par la voix. Driver permet aussi de lire le résumé du trajet et d’ouvrir la navigation du téléphone.

**Le micro nécessite une build installée avec le module vocal : il n’est pas disponible dans Expo Go.** Les deux applis contiennent sa configuration et `expo-dev-client`. Après création et installation de votre build de développement, démarrez avec :

```sh
npm run dev -w @pepo/rider
npm run dev -w @pepo/driver
```

Chaque téléphone propose ses propres langues de reconnaissance et de lecture. Pepo vérifie celles disponibles et garde le clavier/la carte si une langue manque, notamment le Lingala. Le choix de langue dans Pepo ne force pas Google Maps à proposer une voix routière absente du téléphone. Consultez [le guide langues et voix](docs/LANGUES-VOIX.md).

## Structure

| Dossier | Responsabilité |
|---|---|
| `apps/rider` | Expérience passager existante, réservation et Vehicle Options |
| `apps/driver` | Disponibilité, demandes, documents, course et résumé des gains |
| `apps/api` | Authentification, données, cartes, dispatch, statuts et temps réel |
| `packages/types` | Contrats de données communs |
| `packages/api-client` | Transport HTTP et stockage des sessions |
| `packages/session` | Session, synchronisation et géolocalisation communes |
| `packages/ui` / `config` | Éléments génériques, identité visuelle et tokens |
| `packages/maps` | Rendu cartographique, véhicules et animations communes |
| `packages/utils` | Règles métier et calculs sans interface |
| `packages/i18n` / `voice` | Traductions, formats régionaux et interactions vocales |

Les anciens chemins Rider sont conservés comme petits réexports lorsqu’ils facilitaient la compatibilité. Les nouveaux imports utilisent les packages. Voir [audit et architecture](docs/ARCHITECTURE.md) et [migration-map.json](migration-map.json).

## Recherche de lieux avec OpenAI, à activer

Rider connecté propose **Comprendre ma demande** pour le départ, la destination ou une étape. Le catalogue Pepo et ses alias sont utilisés en premier ; OpenAI peut départager une courte liste de candidats après ce clic. Le modèle ne fournit jamais de coordonnées ni de nouvelles entrées. La sélection reste explicite.

Voir [configuration, catalogue et limites](docs/RECHERCHE-INTELLIGENTE.md). La clé reste dans `apps/api/.env`, l'IA est désactivée par défaut et le quota journalier persiste en base. Il faut alimenter un catalogue local vérifié pour disposer de candidats : cette livraison n'ajoute pas de données terrain inventées.

## Vérifications et builds

```sh
npm run check
npm run build:api
npm run export:rider
npm run export:driver
npm run build:web -w @pepo/rider
npm run build:web -w @pepo/driver
```

Pour exporter les trois plateformes de chaque application, utilisez `npm run export:all -w @pepo/rider` et `npm run export:all -w @pepo/driver`. Après les exports web, le contrôle navigateur se lance avec `npx playwright install chromium`, puis `npm run smoke:web`.

Le lint vérifie aussi les frontières entre applications et les assets référencés. Les tests couvrent les autorisations, les courses, les documents, les cartes, les étapes, les langues et la migration d’un compte à deux profils. Les exports Expo vérifient les bundles JavaScript ; ils ne constituent pas des IPA/APK signés ni des essais sur téléphone.

Les résultats exécutés et leurs limites sont détaillés dans [le rapport de validation](docs/VALIDATION.md).

Pour servir le backend compilé : depuis `apps/api`, `npm run production`. Configurez `NODE_ENV=production`, `DEV_AUTH=false`, un fournisseur SMS, `ADMIN_TOKEN`, `STORAGE_KEY` et une URL HTTPS dans son `.env`. La base et les documents doivent rester sur un stockage persistant sauvegardé. L’accès navigateur doit être limité aux origines autorisées.

## Ce qui reste avant un lancement public

Cette livraison pose une fondation fonctionnelle de pilote, pas une infrastructure validée à grande échelle. SQLite convient à ce déploiement sur une instance ; une montée en charge multi-instance nécessitera notamment PostgreSQL, une coordination du dispatch, un adaptateur Socket.IO partagé et des mesures de charge. Mobile Money, cartes bancaires, commissions et retraits ne sont pas exécutés : les numéros enregistrés restent des préférences. Le Driver affiche un montant brut de courses, pas un solde à retirer.

Faites valider les formulations en Lingala et en swahili congolais avec vos utilisateurs. Testez sur iPhone et Android : micro, permissions, GPS, réseau lent, lancement natif et courses entre les deux applis. Les parcours existants de sécurité et de documents restent à compléter par les opérations réelles de l’équipe Pepo.
