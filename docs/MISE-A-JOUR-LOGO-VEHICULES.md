> Document conservé de la version précédente. Pour les commandes et chemins du monorepo, consultez [README.md](../README.md).

# Pepo — Logo et véhicules sur la carte

Correctif pour votre projet Pepo existant : seuls les fichiers ajoutés ou modifiés sont inclus.

## Installation Windows

1. Arrêtez Expo et le serveur avec Ctrl+C dans leurs terminaux.
2. Décompressez cette archive. Copiez le CONTENU du dossier `pepo` dans votre dossier de projet existant `Pepo-Maps-SDK57\pepo`. Fusionnez les dossiers et remplacez les fichiers portant le même nom. Ne supprimez pas votre projet existant.
3. Dans PowerShell, depuis votre dossier `pepo`, lancez :

```powershell
npm.cmd install
npm.cmd run server
```

4. Gardez ce terminal ouvert. Dans un second terminal, depuis le même dossier :

```powershell
npx.cmd expo start --go --lan --clear --port 8084
```

5. Scannez le nouveau QR code et rouvrez Pepo.

## Images : rangement et utilisation

| Fichier | Utilisation |
| --- | --- |
| assets/brand/pepo-logo.jpg | Logo sur l’accueil et l’onboarding ; configuration de l’icône et du lancement |
| assets/vehicles/car-top.png | Voiture vue du ciel sur la carte |
| assets/vehicles/moto-top.png | Moto vue du ciel sur la carte, y compris la catégorie Confort |

Les trois images originales sont déjà incluses, sans modification. Les marges transparentes sont compensées dans le code d’affichage pour garder des véhicules lisibles. Si vous remplacez plus tard les images par des fichiers de dimensions différentes, ajustez `src/maps/vehicleMetrics.ts`.

Le serveur fournit les images de véhicules à la carte Google : son redémarrage est nécessaire. Les six véhicules de démonstration alternent motos et voitures ; ils restent simulés et ne représentent pas des conducteurs disponibles. Le véhicule d’une course utilise son type moto, Confort ou taxi. Les illustrations de profil des cartes de sélection restent celles du projet.

Vos fichiers `.env` ne sont pas inclus dans ce correctif. L’icône de l’application Expo Go elle-même ne change pas ; les réglages d’icône et de lancement Pepo s’appliqueront lors d’une nouvelle compilation native de Pepo.

## Vérifications

TypeScript, compilation serveur, 12 tests liés aux cartes et exports Expo iOS/web réussis. Les deux images sont servies par le serveur avec le type image/png. Le rendu n’a pas été vérifié sur un iPhone physique. Ce correctif intègre les images ; il ne confirme pas la résolution d’un éventuel problème de connexion au serveur.

## Fichiers ajoutés ou modifiés

- `app/(tabs)/index.tsx`
- `app/onboarding.tsx`
- `app/ride.tsx`
- `src/components/DemoMap.tsx`
- `src/components/GoogleMap.native.tsx`
- `src/components/MapBoard.native.tsx`
- `src/components/MapBoard.web.tsx`
- `src/components/MapTypes.ts`
- `src/components/MapVehicle.tsx`
- `src/components/PepoLogo.tsx`
- `src/components/VehicleArt.tsx`
- `src/maps/demoFleet.ts`
- `src/maps/googleDocument.ts`
- `src/maps/vehicleMetrics.ts`
- `server/app.ts`
- `package.json`
- `package-lock.json`
- `Dockerfile`
- `app.config.ts`
- `assets/brand/pepo-logo.jpg`
- `assets/vehicles/car-top.png`
- `assets/vehicles/moto-top.png`
