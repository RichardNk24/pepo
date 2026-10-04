> Document conservé de la version précédente. Pour les commandes et chemins du monorepo, consultez [README.md](../README.md).

# Pepo — Localisation, véhicules et départs programmés

## Installation sur le projet existant

1. Arrêter le serveur et Expo avec Ctrl+C dans leurs terminaux.
2. Décompresser `Pepo-Reservations-Lueur-Correctif.zip`.
3. Copier le contenu de son dossier `pepo` dans le dossier de projet existant. Fusionner les dossiers et remplacer les fichiers portant le même nom.
4. Relancer dans un premier terminal ouvert à la racine de `pepo` :

```powershell
npm.cmd run server
```

Dans un deuxième terminal, au même emplacement :

```powershell
npx.cmd expo start --go --lan --clear --port 8084
```

Les dépendances ne changent pas. Aucune réinstallation npm n’est nécessaire pour ce correctif.

Les images `assets/vehicles/car-top.png`, `moto-top.png`, le logo, les réglages `src/maps/vehicleMetrics.ts` et les fichiers `.env` sont conservés. L’archive contient uniquement les fichiers ajoutés ou modifiés. Le serveur ajoute automatiquement une version à l’URL des véhicules à partir de la date de modification de l’image. Après remplacement d’une image, recharger la carte suffit normalement à récupérer cette version.

## Localisation

Au premier lancement sur mobile, Pepo demande la permission de localisation lorsque l’app est active. Une permission déjà accordée est réutilisée ; un refus n’entraîne pas de demandes répétées. Le choix manuel du point de départ reste possible.

Compte → Localisation ouvre les réglages de l’application. Dans Expo Go, il s’agit des permissions d’Expo Go. La position est suivie lorsque l’application est active. Cette version ne demande pas le suivi permanent en arrière-plan. Le système iOS détermine les choix proposés, notamment l’autorisation ponctuelle ou pendant l’utilisation.

Référence : https://docs.expo.dev/versions/latest/sdk/location/

## Choix d’un véhicule

Moto, Moto Confort, Taxi, SUV et 4×4 ont chacun une catégorie, une capacité de passagers et un barème indicatif. Les paramètres sont dans `src/data/cities.ts` et `src/domain/rules.ts`. Les prix restent négociables et ne sont confirmés qu’après acceptation d’une offre.

Le catalogue utilise de grandes lignes de sélection avec image, capacité et prix. Le filtre « Moins cher » classe les catégories selon leur prix proposé. La poignée au-dessus de la liste permet de donner davantage de place à la carte ou à la liste. Aucun délai d’arrivée fictif n’est présenté comme une disponibilité réelle.

Les SUV et 4×4 utilisent des illustrations vectorielles provisoires. Pour les remplacer par de vraies images de profil, déposer par exemple `suv-side.png` et `4x4-side.png` dans `assets/vehicles/catalog/`, puis les déclarer dans `VEHICLE_IMAGES` de `src/components/VehicleArt.tsx` :

```ts
export const VEHICLE_IMAGES = {
  suv: require("../../assets/vehicles/catalog/suv-side.png"),
  fourByFour: require("../../assets/vehicles/catalog/4x4-side.png"),
};
```

Ajouter ces déclarations seulement lorsque les fichiers existent. L’affichage de profil utilise `contain` pour respecter les proportions. Sur la carte, les catégories auto partagent pour le moment le taxi vu du ciel ; les deux catégories moto partagent le motard.

## Programmer une course

Depuis l’accueil, toucher « Programmer », choisir la destination puis la date et l’heure. Sur la réservation, le bouton « Maintenant · ou programmer » ouvre aussi le calendrier.

- Départ de 30 minutes à 30 jours à l’avance, par créneaux de 30 minutes.
- Heures affichées dans le fuseau de la ville du départ : Kinshasa ou Lubumbashi/Kolwezi, même si le téléphone se trouve ailleurs.
- Jusqu’à 10 réservations à venir, avec au moins une heure entre deux départs.
- Réservation visible dans Activités → Programmés ; modification de l’heure et annulation possibles avant le lancement de la recherche.
- Recherche lancée 15 minutes avant le départ, sans confirmation automatique d’un conducteur ou du tarif.
- Une course active empêche le lancement simultané d’une autre recherche pour le même compte.
- Un créneau resté sans conducteur confirmé expire 30 minutes après l’heure prévue. Un trajet déjà accepté n’est pas annulé par cette règle.

En mode connecté, la réservation est enregistrée en SQLite. Le serveur vérifie les départs toutes les 15 secondes et reprend après redémarrage. Il doit rester lancé pour déclencher les recherches. Pour un service exploité, le serveur devra être hébergé et surveillé en continu.

En démo, la réservation est enregistrée localement et la simulation reprend quand Pepo est ouvert. Cette version n’envoie pas de rappels push/SMS et ne suit pas les vols. Le passager doit rouvrir Pepo pour choisir une offre. L’heure de départ programmée ne garantit pas la disponibilité d’un conducteur. La durée du trajet affichée lors de la réservation n’est pas une prévision du trafic futur.

## Lueur du trajet

La ligne de base reste continue et noire, avec un contour blanc. Une lueur parcourt la géométrie du trajet du départ à la destination en trois secondes, puis recommence. La tête est jaune olive et la traîne s’assombrit : `#C8B109`, `#9C8B07`, `#706405`, `#443D03`, `#181601`, `#000000`.

Le dégradé suit les virages du trajet. Le calcul est partagé entre la carte Google intégrée et la carte native. L’animation est suspendue hors de l’écran actif et avec « Réduire les animations ». Le changement de trajet ou le passage au choix d’un point nettoie la précédente animation. Le plan schématique de secours sur le web conserve une ligne statique.

## Vérification sur iPhone

1. Vérifier la demande de localisation avec une permission non encore décidée ; si elle est déjà accordée, le système peut ne pas afficher de nouvelle fenêtre.
2. Choisir un trajet et observer la lueur dans le sens départ → destination.
3. Changer de catégorie ; vérifier le nouveau prix proposé, puis proposer un autre prix.
4. Programmer pour demain, retrouver la réservation dans Activités, modifier l’heure et annuler.
5. Vérifier que le nouveau taxi et ses proportions sont conservés après installation.

Vérifications automatisées : compilation TypeScript et serveur, tests de réservation/autorisation/persistance, fuseaux horaires et animation. Les exports iOS/web sont vérifiés séparément ; cela ne remplace pas un essai sur un iPhone physique.
