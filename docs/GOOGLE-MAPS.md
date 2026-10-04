# Pepo monorepo — Google Maps sur Windows et iPhone

Le rendu Google utilise une carte claire, la position GPS suivie quand Pepo est ouverte, l’orientation du téléphone, un pin avec ombre pour choisir un lieu, des adresses Google et un trajet routier continu avec heure d’arrivée estimée.

**Ton iPhone 14 Pro peut tester cette carte dans Expo Go SDK 57, sans compte Apple Developer.** Google Maps est affiché dans une WebView intégrée. Le GPS et la boussole viennent des capteurs natifs du téléphone. Une future build indépendante pourra utiliser le SDK Google natif avec le même modèle de données.

## 1. Installer cette version

Extrais l’archive dans un nouveau dossier. Ouvre PowerShell dans le dossier `pepo`, là où se trouve `package.json`. Utilise Node.js 24 LTS ou plus récent.

```powershell
npm.cmd ci
if (!(Test-Path apps\rider\.env)) { Copy-Item apps\rider\.env.example apps\rider\.env }
if (!(Test-Path apps\api\.env)) { Copy-Item apps\api\.env.example apps\api\.env }
```

Les commandes de copie sont à faire une seule fois dans ce nouveau dossier. Si tu as déjà créé tes fichiers `.env`, modifie-les sans les écraser.

## Pourquoi Apple Maps apparaissait

Le composant natif utilisait automatiquement Apple Maps sur iPhone lorsque le rendu Google ne pouvait pas être choisi. La connexion au compte Rider ne définit pas le fournisseur cartographique. La migration ne copie pas vos secrets : les variables doivent être reprises dans les fichiers des nouvelles applications.

Le correctif reconnaît aussi Expo Go via `executionEnvironment=storeClient`, même si `appOwnership` vaut `null`. Avec une URL cartes, Expo Go utilise la WebView Google, y compris si le réglage ancien vaut `native`. Sans configuration Google utilisable, Pepo affiche une explication au lieu de basculer vers Apple. Le rendu natif d’une build installée utilise explicitement le fournisseur Google.

Pour une carte illustrée hors ligne, choisissez explicitement `EXPO_PUBLIC_MAP_RENDERER=demo`. Cette carte est indiquée comme une simulation.

## 2. Préparer Google Cloud

Dans ton projet Google Cloud, active la facturation et ces quatre API :

| API                 | Fonction dans Pepo                         |
| ------------------- | ------------------------------------------ |
| Maps JavaScript API | Carte Google dans Expo Go et le navigateur |
| Routes API          | Trajet routier, distance et durée          |
| Places API (New)    | Recherche de lieux                         |
| Geocoding API       | Adresse du point choisi sous le pin        |

Une clé qui active uniquement « Maps SDK for iOS » ou l’ancienne « Directions API » ne suffit pas à ce parcours.

Utilise **deux clés du même projet Google**, avec des restrictions adaptées :

- **Clé d’affichage** : limitée à Maps JavaScript API, avec restriction « Sites Web ». Autorise l’adresse où le serveur affiche la carte, par exemple `http://192.168.11.102:4000/*`. Pour tester le navigateur du PC, ajoute `http://localhost:4000/*` et `http://127.0.0.1:4000/*`. Remplace cette IP par celle de ton PC.
- **Clé serveur** : limitée à Routes API, Places API (New) et Geocoding API. En production, restreins-la à l’IP publique du serveur. Les restrictions par référent web ou bundle iOS ne conviennent pas aux appels Node du serveur. L’IP locale `192.168...` n’est pas l’IP publique de sortie.

Les changements de restrictions peuvent demander quelques minutes pour prendre effet. Ne colle pas ta clé serveur dans un champ `EXPO_PUBLIC_*` ni dans un message. Ces champs sont intégrés au code de l’application et sont publics.

## 3. Remplir les deux fichiers

Dans **`apps/rider/.env`** :

```dotenv
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_MAPS_API_URL=http://192.168.11.102:4000
EXPO_PUBLIC_MAP_RENDERER=google
```

Cela active les cartes réelles tout en conservant les courses et conducteurs fictifs du mode démo. Les SMS et les dossiers conducteurs ne sont pas nécessaires pour tester la map.

Dans **`apps/api/.env`** :

```dotenv
PORT=4000
NODE_ENV=development
DEV_AUTH=true
PUBLIC_URL=http://192.168.11.102:4000
GOOGLE_MAPS_WEB_KEY=TA_CLE_AFFICHAGE
GOOGLE_MAPS_SERVER_KEY=TA_CLE_SERVEUR
```

Conserve également les lignes `CORS_ORIGINS`, `ADMIN_TOKEN`, etc. du fichier exemple. Les deux clés sont différentes. La clé d’affichage est publique et doit être restreinte aux sites autorisés ; la clé serveur reste uniquement sur le serveur.

**Comment trouver l’IP du PC ?** Elle est affichée dans l’adresse Expo (`exp://192.168...:8081` ou `8082`). Tu peux aussi taper `ipconfig` dans PowerShell et lire l’« Adresse IPv4 » de la connexion Wi-Fi active. Le PC et l’iPhone doivent être sur le même Wi-Fi. Sur l’iPhone, `localhost` désignerait l’iPhone lui-même.

## 4. Lancer deux terminaux

Dans le **premier terminal**, toujours dans le dossier `pepo` :

```powershell
npm.cmd run server
```

Laisse-le ouvert. Sur Safari de l’iPhone, ouvre `http://192.168.11.102:4000/health` : un résultat `ok` confirme que le téléphone atteint le serveur. Remplace l’IP par celle de ton PC. Autorise Node sur le réseau privé dans le pare-feu Windows si nécessaire.

Dans le **second terminal** :

```powershell
npm.cmd run maps:doctor
npm.cmd run start -w @pepo/rider -- --clear
```

Le diagnostic vérifie que le serveur est joignable et que les champs des clés sont remplis ; il ne fait aucun appel Google facturable et ne valide pas les restrictions des clés. Scanne ensuite le QR code avec l’appareil photo de l’iPhone. Ouvre dans Expo Go, puis choisis **Explorer la démo**.

Si Expo utilise 8082 ou un autre port, ajoute aussi l’origine web correspondante à `CORS_ORIGINS` pour tester le navigateur. Le téléphone en WebView ouvre directement la page du serveur cartes.

Les prochains jours, il suffit de relancer ces deux commandes : `npm.cmd run server`, puis `npm.cmd run rider`. Après un changement de `.env` Expo, arrête et redémarre Metro avec `--clear`. Après un changement de `apps/api/.env`, redémarre le serveur.

## 5. Essayer la map

1. Appuie sur **Ma position** et autorise la localisation. Sur iOS, active « Position exacte » pour Expo Go. Le point bleu indique le téléphone ; le cercle indique l’incertitude annoncée par le GPS.
2. Tourne le téléphone : la flèche autour du point bleu et la boussole indiquent la direction. Le nord de la carte reste en haut. Si l’orientation demande une calibration, éloigne le téléphone d’un aimant ou d’une coque magnétique et tourne-le doucement.
3. Déplace la carte : elle cesse de suivre tes mouvements. **Ma position** réactive le suivi. Le point de rendez-vous déjà confirmé reste fixé.
4. Appuie sur **Où allez-vous ?**, puis **Choisir sur la carte**. Déplace la carte ou touche le lieu souhaité. Le pin se soulève avec son ombre et se pose après le mouvement. Confirme le lieu une fois l’adresse chargée.
5. Pour changer le départ, appuie sur la ligne **Départ** et utilise le même choix sur la carte. Tu peux choisir un repère visible même si le GPS est imprécis.
6. Tu peux également saisir un quartier ou une adresse dans la recherche. Les repères sans recherche sont les exemples locaux ; les résultats de recherche proviennent de Google si la clé serveur est configurée.
7. Le trajet routier apparaît avec une ligne noire continue, dessinée progressivement. L’écran indique distance, durée et **À destination vers…**, dans le fuseau de la ville. Cette estimation suppose un départ immédiat et exclut l’attente du conducteur.
8. Choisis le véhicule, propose ton prix, puis **Trouver un conducteur**. Les réponses restent fictives tant que `EXPO_PUBLIC_API_URL` est vide. Les cartes réelles ne transforment pas un compte démo en compte réel.

Le choix par pin garde les coordonnées exactes confirmées. Une adresse Google trouvée à proximité ne déplace jamais le point. Si aucune adresse n’existe, le point peut être confirmé avec ses coordonnées. Si Google Routes est configuré mais échoue, la demande de course est bloquée jusqu’à un nouveau calcul réussi.

## Dépannage rapide

| Ce que tu vois                         | Ce qu’il faut vérifier                                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| « Google Maps à configurer »           | Vérifier `apps/rider/.env`, l’URL cartes et le redémarrage Metro ; la clé iOS seule ne suffit pas dans Expo Go |
| Carte ne répond pas                    | Serveur ouvert, bonne IP, Wi-Fi commun, accès Safari à `/health`, pare-feu privé                               |
| Clé Google refusée ou carte sombre     | Maps JavaScript API, facturation, restriction web correspondant exactement à l’IP et au port 4000              |
| Carte visible mais trajet indisponible | Routes API et clé serveur ; un lieu accessible par une route ; bouton Recalculer le trajet                     |
| Adresse indisponible                   | Geocoding API ; les coordonnées confirmées restent utilisables                                                 |
| Recherche sans résultat                | Places API (New), orthographe, ville choisie ; utiliser le pin                                                 |
| Position en dehors de la zone          | Vérifier le GPS et le lieu choisi ; la zone de réservation actuelle est de 60 km autour du centre configuré    |
| GPS lent ou imprécis                   | Position exacte iOS, localisation active, essayer à l’extérieur, vérifier le cercle bleu                       |
| Expo Go indique une incompatibilité    | Cette archive est SDK 57 ; utiliser le dossier neuf, `npm.cmd ci`, puis `--clear`                              |

Le suivi livré est **au premier plan**, quand Pepo est ouverte. Le suivi après verrouillage / fermeture, les notifications natives et la navigation vocale ne font pas partie de cette mise à jour. Les trajets utilisent le routage routier `DRIVE` : Google ne propose pas le mode spécialisé deux-roues en RDC. Il faut toujours respecter les règles locales et vérifier sur le terrain les accès praticables.

## Mode connecté et future carte native

Pour de vraies courses entre Rider et Driver, configure `EXPO_PUBLIC_API_URL` avec la même URL dans `apps/rider/.env` et `apps/driver/.env`, puis suis le [README](../README.md). La clé serveur et les quatre API restent les mêmes. `EXPO_PUBLIC_MAPS_API_URL` peut être laissé vide pour réutiliser l’URL de l’API.

Une future build Pepo indépendante peut utiliser `EXPO_PUBLIC_MAP_RENDERER=native`, `EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY` et/ou `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY`, avec les SDK correspondants et une reconstruction native. Dans Expo Go avec le serveur cartes, Pepo conserve le rendu Google WebView. Une clé iOS dans `.env` ne remplace pas la configuration du binaire Expo Go.

## Références officielles

- [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)
- [WebView dans Expo Go](https://docs.expo.dev/versions/latest/sdk/webview/)
- [Google Routes : calculer un trajet](https://developers.google.com/maps/documentation/routes/compute_route_directions)
- [Google : restrictions des clés](https://developers.google.com/maps/api-security-best-practices)
- [Couverture et modes deux-roues](https://developers.google.com/maps/documentation/routes/coverage)
