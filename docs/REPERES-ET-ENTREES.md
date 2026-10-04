> Document conservé de la version précédente. Pour les commandes et chemins du monorepo, consultez [README.md](../README.md).

# PEPO : des références compréhensibles

## Ce qui change

Le repère, son animation et sa vibration restent en place. La reconnaissance utilise Geocoding et Nearby Search (Places API New) en parallèle après l'arrêt de la carte. Le rayon est limité à 300 mètres et trois références sont proposées au maximum.

- Un lieu géocodé à proximité immédiate peut donner le nom du lieu.
- Un établissement à 25 mètres ou moins donne son nom comme référence, avec une distance indicative. Cela ne certifie pas que le point est dans le bâtiment.
- Plus loin, le titre affiche « À proximité de … » avec la distance directe, sans promettre un accès routier.
- Sans référence, une rue reconnue est utilisée. Sinon : « Lieu choisi sur la carte », avec la ville. Les Plus Codes sont retirés.
- Une référence ne déplace jamais le point choisi. Une entrée ne change la destination que si l'utilisateur appuie sur son bouton.
- Le champ facultatif permet d'ajouter « portail bleu », « troisième parcelle », etc. Ces précisions viennent de l'utilisateur, pas d'une estimation inventée.
- La recherche affiche les références proches si la localisation est déjà autorisée, puis les lieux connus. Google Maps reste attribué lorsqu'il fournit les résultats.

## Configuration Google

Le serveur utilise la clé existante GOOGLE_MAPS_SERVER_KEY dans apps/api/.env. Dans son projet Google Cloud, activez Places API (New) et Geocoding API, autorisez-les dans les restrictions de cette clé, et vérifiez que la facturation est activée. N'ajoutez pas cette clé aux variables EXPO_PUBLIC.

Une reconnaissance peut faire deux requêtes Google : géocodage et recherche proche. Le délai de 400 ms après l'arrêt de la carte limite les appels pendant le glissement. Aucun appel Google n'est fait directement depuis le composant avec une clé secrète.

Sans Nearby Search disponible, la rue géocodée ou le catalogue PEPO restent utilisables. Un nom visible sur les tuiles Google peut manquer dans la réponse Places. Il n'est donc pas possible de garantir automatiquement tous les lieux de Lubumbashi ou Kinshasa.

La carte affiche davantage de catégories de lieux : écoles, hôtels, restaurants, hôpitaux, lieux publics. Google choisit les libellés visibles selon le zoom et les collisions. Ce réglage ne crée pas de fiches absentes de Google et ne garantit pas chaque nom à chaque niveau de zoom.

## Entrées locales et références connues

Si Google renvoie des entrées, elles sont proposées avec leurs coordonnées. Quand aucun libellé de côté n'est fourni, elles s'appellent « Entrée 1 », « Entrée 2 ». Il serait trompeur de deviner quel accès est du côté Pullman ou Route du Golf.

Pour les deux entrées du Complexe La Plage, ou pour les stades, écoles et bâtiments connus qui manquent, créez votre propre fichier server/landmarks.json. Ce fichier n'est pas fourni par le correctif et un fichier existant n'est pas écrasé. Il peut être rempli après vérification sur place. On peut changer son chemin avec PEPO_LANDMARKS_FILE dans apps/api/.env.

Le contenu est une liste JSON de fiches. Une liste vide valide est :

```json
[]
```

Chaque fiche contient les champs suivants :

| Champ | Valeur à renseigner |
| --- | --- |
| id | Un identifiant PEPO unique |
| name | Le nom que les habitants utilisent |
| aliases | Facultatif : liste de variantes, anciens noms ou orthographes |
| city | lubumbashi, kinshasa ou kolwezi |
| latitude, longitude | Coordonnées numériques vérifiées du repère |
| address | Quartier, avenue ou indication locale |
| entrances | Facultatif : liste des entrées vérifiées |

Chaque entrée contient id, name, latitude, longitude. Pour La Plage, name peut être « Entrée côté Pullman » ou « Entrée côté Route du Golf » une fois l'emplacement vérifié. Les coordonnées doivent être celles de l'accès utilisable, pas celles du centre du complexe.

Le catalogue est validé : 2 000 fiches au maximum, 10 entrées par fiche, coordonnées valides et ville admise. Un fichier invalide est ignoré ; vérifiez bien votre JSON. Les noms et alias du catalogue sont aussi consultés dans la recherche. Les références locales apparaissent dans le picker, mais elles ne sont pas ajoutées en tant que marqueurs permanents sur toute la carte.

## Ce qui reste à valider sur le terrain

Le côté accessible d'une avenue, les portails, les travaux, les clôtures et le passage des motos ne peuvent pas être déduits de la distance seule. Avant un lancement réel, vérifiez les principaux accès avec des chauffeurs locaux. Cette mise à jour ne certifie pas ces accès et ne fabrique pas de numéro de parcelle.

## Vérifications effectuées

64 tests automatisés réussis, TypeScript, compilation serveur et export iOS. Simulation d'interface : choix d'une référence, conservation du point précis, précision utilisateur, sélection explicite d'une entrée et masquage des anciennes références pendant un déplacement. Les réponses Google utilisées dans les tests sont simulées ; aucun contrôle réel d'Institut Maadini ou des entrées de La Plage n'a été effectué avec votre clé.
