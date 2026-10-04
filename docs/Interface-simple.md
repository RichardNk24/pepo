> Document conservé de la version précédente. Pour les commandes et chemins du monorepo, consultez [README.md](../README.md).

# Interface Pepo simplifiée — 2 octobre 2026

Accueil : trois onglets (Explorer, Activités, Compte). Sécurité reste accessible dans Compte. Les véhicules sont proposés après la destination. Le calendrier est une icône. La localisation automatique au premier lancement reste en place ; le système du téléphone gère les autorisations.

Les panneaux possèdent trois positions : réduit, intermédiaire, agrandi. Faites glisser la poignée ou faites glisser la liste depuis son début ; une fois le panneau agrandi, la liste défile normalement. Touchez la poignée pour changer de position. Le panneau des offres laisse la barre du trajet visible.

La barre du trajet permet de modifier le départ et la destination. Le bouton + ouvre les étapes : jusqu’à trois, ajoutées avant la destination, avec suppression et changement d’ordre. Le serveur les transmet au calcul Google Routes et les conserve dans la course. Les données de courses existantes restent compatibles (étapes facultatives). Les conducteurs voient les étapes dans le récapitulatif de réservation.

Le bouton « Pour moi » ouvre les options du passager et du prix. Le montant de l’offre est aussi cliquable. Le calendrier à côté de Demander ouvre la programmation existante. Aucun service de notification ou rappel automatique n’est ajouté.

## Vos images PNG

Conservez vos fichiers actuels et ajoutez vos nouveaux fichiers dans `assets/vehicles/catalog/` :

| Catégorie    | Fichier                           |
| ------------ | --------------------------------- |
| Moto         | moto.png                          |
| Moto Confort | moto-confort.png (sinon moto.png) |
| Taxi         | taxi.png                          |
| SUV          | suv.png                           |
| 4×4          | 4x4.png                           |
| Minibus      | minibus.png                       |
| Tricycle     | tricycle.png                      |
| Camion       | camion.png                        |
| Pick-up      | pick-up truck.png (ou pickup.png) |

Les proportions sont conservées avec `resizeMode="contain"`. Metro détecte les PNG au démarrage, via `metro.config.cjs`. Après ajout/remplacement d’une image, arrêtez Expo et relancez avec `--clear`. Aucun PNG n’est requis pour lancer le catalogue : une illustration de remplacement apparaît si le fichier manque. Aucune image personnelle n’est fournie dans cette archive.

Les tarifs et places des nouveaux véhicules sont des valeurs de démonstration à adapter avant exploitation : `src/domain/rules.ts` et `src/data/cities.ts`. Le camion représente le transport de marchandises ; capacité et chargement doivent être convenus avec le conducteur. Les marqueurs sur la carte réutilisent vos images vues de dessus existantes.

## Vérification

`npm.cmd run check`, `npm.cmd run build:server` et les exports Expo web/iOS vérifient le code. `scripts/simple-ui-smoke.cjs` vérifie le parcours simplifié dans un navigateur avec une exportation web servie localement. La validation sur votre iPhone reste nécessaire pour les gestes tactiles et le rendu Google avec vos clés.
