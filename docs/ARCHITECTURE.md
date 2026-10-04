# Audit et architecture de la migration

## État constaté dans le dossier reçu

La stack existante est conservée : Expo SDK 57, Expo Router, React Native, Reanimated, Google Maps via WebView/navigateur ou rendu natif, TypeScript, Express 5, SQLite et Socket.IO. Le ZIP contenait déjà une API fonctionnelle de pilote malgré la description « pas encore de backend » : OTP, sessions, documents chiffrés, courses, négociation, cartes, revue administrative et règles de transition. Ces fonctions ont été déplacées plutôt que remplacées.

L’expérience passager se trouvait dans `app`, notamment `ride.tsx`, et ses composants dans `src/components`. Les éléments chauffeur étaient mélangés dans les pages d’accueil, de documents, de course et dans AppProvider. Les moteurs de cartes, types et règles étaient réellement partageables. L’internationalisation couvrait une partie du français/anglais/swahili mais de nombreux libellés restaient littéraux et le Lingala était absent.

Le dossier reçu ne contenait pas d’historique Git exploitable. La migration a été faite dans une copie séparée. Le fichier `migration-map.json` permet de retrouver les déplacements. Les caches, sorties de build, dépendances installées et secrets réels ne font pas partie de la livraison.

Ce fichier recense les destinations présentes dans la livraison. Les anciens scripts de lancement/aperçu et tests navigateur dépendant de la structure unique sont remplacés par les commandes à la racine et `scripts/smoke-ui.cjs`. Les fichiers `.env`, bases et clés de stockage ne sont pas déplacés dans les sources livrées ; `scripts/import-settings.cjs` permet de les reprendre localement depuis votre ancien dossier.

## Choix

npm workspaces suffit pour trois applications et les packages locaux. Un seul lockfile, des commandes à la racine, le Metro Expo standard et des exports de packages adaptés au web/natif évitent une couche Turborepo prématurée. Les composants métier restent dans leur application : VehicleOptions, picker, SnapSheet et recherche dans Rider ; demandes et actions chauffeur dans Driver.

`packages/session` conserve la mécanique commune d’authentification, de synchronisation et de démo, avec un rôle fixe transmis par l’application. Il n’impose pas un écran commun. Les rendus de carte et leurs assets sont partagés. Les fonctions pures sont utilisables par l’API sans dépendance à l’interface.

## Identité et profils

Une ligne centrale `users` est identifiée par le numéro de téléphone. Les tables `rider_profiles`, `driver_profiles` et `user_capabilities` distinguent les capacités et le véhicule, les documents, la disponibilité et les statistiques chauffeur. Les sessions contiennent leur rôle. Se connecter dans Rider ne transforme donc pas une session Driver et ne détruit pas son profil.

Le contrat historique `Profile.role = passenger | driver` reste une projection compatible pour les interfaces. Les nouveaux contrats utilisent `User`, `RiderProfile` et `DriverProfile`. ADMIN/SUPPORT sont réservés dans les capacités ; leur création publique n’est pas autorisée. L’administration existante utilise encore son jeton serveur, à remplacer par des comptes administratifs dédiés avant un déploiement d’équipe.

À l’ouverture de SQLite, les anciennes sessions et données de conducteur sont migrées de façon idempotente. Les fichiers chiffrés et leur clé de stockage ne changent pas. Le serveur et le dossier de données doivent être sauvegardés ensemble avant migration.

## API et temps réel

`apps/api/src/app.ts` compose les modules auth, users, riders, drivers, vehicles, pricing, payments, earnings, documents, maps, trips, support, admin, dispatch et realtime. `runtime.ts` rassemble le contexte de dépendances et les contrôles partagés ; SQLite reste le stockage existant.

Les endpoints historiques sont maintenus. Les ressources `/api/users/me`, `/api/riders/me`, `/api/drivers/me`, `/api/vehicles/me`, `/api/pricing/categories`, `/api/payments/methods` et `/api/earnings/summary` exposent des données existantes. Les moyens de paiement affichent explicitement les capacités actuellement activées. Il n’y a pas d’API de retrait simulant un paiement réel.

Une demande crée une course. Le dispatch choisit les profils chauffeur en ligne, approuvés, dans la bonne ville et catégorie, sans course assignée active. Des index de disponibilité et de ville évitent de charger tous les comptes en JavaScript. Socket.IO authentifie la session et envoie une invalidation aux comptes concernés ; les données sont relues par REST avec autorisation. Les sessions expirées/révoquées sont déconnectées. Les applis regroupent les rafales d’invalidation et utilisent un repli de synchronisation lorsque le socket est déconnecté.

Les statuts existants `scheduled`, `searching`, `accepted`, `arrived`, `in_progress`, `completed`, `cancelled` sont gardés. `assertTransition` centralise les transitions autorisées et le PIN ; ces contrôles ne reposent pas sur des booléens UI. Une offre négociée doit être choisie par le passager avant affectation. Les courses programmées utilisent le worker existant.

## Performance et évolution

Les rendus de carte et leurs sources WebView stables sont conservés. La géolocalisation est partagée, les messages de langue sont indexés, le dispatch filtre en SQL et les sockets évitent un polling HTTP systématique toutes les cinq secondes. Le Driver n’embarque pas VehicleOptions ou les photos d’accueil du Rider.

Cela ne constitue pas un benchmark de production. SQLite synchrone et certaines requêtes JSON conviennent au pilote sur une seule instance ; ils restent une limite à mesurer. Évoluer ensuite vers PostgreSQL et des champs indexés explicites, dispatch géographique, suivi d’événements durable, observabilité, coordination des tâches et adaptateur Socket.IO partagé lorsqu’un besoin mesuré le justifie. Ne pas lancer plusieurs workers de dispatch sur la même base sans coordination.

## Validation

Le rapport `VALIDATION.md` décrit les contrôles exécutés et leurs limites. Les tests automatisés ne remplacent pas la recette sur téléphones, la validation des vrais fournisseurs Google/SMS/voix, la revue linguistique ni les tests de charge.

## Référence des évolutions

La [vision Pepo](VISION-PEPO.md) et sa [feuille de route](FEUILLE-DE-ROUTE-INTELLIGENCE.md) guident les prochains choix. Elles préparent une couche locale de lieux, accès, observations revues, sécurité et économie chauffeur, tout en conservant le backend modulaire et les interfaces simples. Ces capacités futures ne sont pas présentées comme des services déjà implémentés.
