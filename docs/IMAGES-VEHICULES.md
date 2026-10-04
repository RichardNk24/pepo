> Document conservé de la version précédente. Pour les commandes et chemins du monorepo, consultez [README.md](../README.md).

# Pepo — Images des véhicules et projet complet

Cette archive contient :

- `projet-complet/pepo/` : tous les fichiers source du projet et un aperçu web à jour.
- `mise-a-jour/pepo/` : uniquement les fichiers de la mise à jour des images, minibus et lueur.
- `Installer-Pepo.ps1` : installation de la mise à jour avec sauvegarde des fichiers remplacés.

## Installation dans votre projet existant

1. Arrêtez le serveur et Expo (Ctrl+C dans chaque terminal).
2. Extrayez toute cette archive dans un dossier séparé, par exemple Documents/Pepo-Images.
3. Dans ce dossier, ouvrez PowerShell et lancez :

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Installer-Pepo.ps1 -Projet "C:\Users\Guest-PC\Documents\Pepo-Maps-SDK57\pepo"
```

Pour afficher seulement la liste des changements, ajoutez `-Apercu`.
L'installateur sauvegarde les fichiers existants concernés dans un dossier Pepo-Sauvegarde à côté du projet. Il copie ensuite seulement les fichiers de mise-a-jour. Il ne supprime aucun fichier. Il ne modifie pas .env, apps/api/.env, vehicleMetrics.ts, car-top.png, moto-top.png, le logo, package.json ou node_modules.
Les fichiers de code listés dans mise-a-jour seront remplacés ; leurs anciennes versions restent dans la sauvegarde. Si vous les avez personnalisés, comparez-les à la sauvegarde.

4. Relancez dans le dossier de votre projet :

```powershell
npm.cmd run server
```

Dans un deuxième terminal :

```powershell
npx.cmd expo start --go --lan --clear --port 8084
```

Pas de nouvelles dépendances à installer.

Alternative manuelle : fusionnez les dossiers de mise-a-jour/pepo dans votre dossier pepo ; acceptez le remplacement des seuls fichiers concernés. Ne remplacez pas votre projet par projet-complet pour installer cette mise à jour.

## Images

Fichiers originaux conservés dans assets/vehicles/catalog :

- taxi.png : voiture blanche pour Pepo Taxi.
- suv.png : SUV blanc pour Pepo SUV.
- minibus.png : minibus blanc pour Pepo Minibus.
- moto.png : moto pour Pepo Moto et Moto Confort.

Les marges blanches sont masquées par la fenêtre d'affichage SVG dans VehicleArt.tsx. Les proportions sont conservées. Les photos gardent leur fond blanc et ne sont pas retouchées. L'image d'un 4×4 n'a pas été fournie : cette catégorie conserve son illustration.
Les images sur la carte sont indépendantes et conservent vos fichiers actuels.

La catégorie Minibus est utilisable dans les demandes immédiates, programmées et l'inscription conducteur. Paramètres de démonstration : 6 places dans src/data/cities.ts, base 7000 FC + 2500 FC/km dans src/domain/rules.ts (arrondi de 500 FC, prix négociable). Ajustez-les avant le lancement réel.

## Projet complet

Le dossier projet-complet est autonome après npm.cmd install et configuration de .env / apps/api/.env à partir des exemples. Il contient les images de carte d'origine disponibles ici, pas les remplacements que vous avez faits sur votre PC. Votre projet existant conserve vos versions grâce à l'installateur.
Les dépendances, clés privées, données locales et compilations intermédiaires ne sont pas distribuées. Le code complet, les ressources, exemples de configuration, documentation, tests et aperçu web sont inclus.

Validation : 44 tests, TypeScript, compilation serveur, exports iOS et web réussis. L'installateur PowerShell n'a pas été exécuté sur Windows dans cet environnement. Le rendu physique sur iPhone reste à vérifier.
