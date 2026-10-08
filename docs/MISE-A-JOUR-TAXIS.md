> Document conservé de la version précédente. Pour les commandes et chemins du monorepo, consultez [README.md](../README.md).

# Taxis de démonstration et passager invité

Extraire l’archive dans un dossier séparé. Copier les dossiers `app`, `src` et `server` dans le projet existant en fusionnant les dossiers et en remplaçant les fichiers de code. Conserver les fichiers `.env`, `apps/api/.env` et le dossier `apps/api/data` existants. Aucune nouvelle dépendance.

## Carte inaccessible dans Expo Go

Un `/health` accessible ne garantit pas que `/maps/mobile` charge. Ouvrir sur l’iPhone `http://192.168.11.100:4000/maps/mobile`. Comparer avec l’adresse désormais affichée par Pepo en cas d’erreur. Vérifier dans le `.env` à la racine : `EXPO_PUBLIC_MAPS_API_URL=http://192.168.11.100:4000`. Utiliser l’IP réelle du PC si elle a changé. Si Safari affiche la carte à la même adresse mais pas Expo Go, vérifier l’autorisation Réseau local d’Expo Go sur l’iPhone. Le bouton Réessayer recrée la WebView, sans cache. La cause sur le téléphone reste à confirmer ; aucun accès à son réseau n’a été possible depuis l’environnement de développement.

Redémarrer le serveur :

```powershell
node --experimental-sqlite --env-file-if-exists=apps/api/.env --import tsx server/index.ts
```

Puis Expo dans un deuxième terminal :

```powershell
npx.cmd expo start --go --lan --clear --port 8084
```

## Fonctionnalités

- Six taxis fixes à proximité du point de départ en mode Démo, sur l’accueil et pendant le choix/la recherche d’une course. Positions synthétiques : ni disponibilité réelle, ni position garantie sur une route. Ils disparaissent lors du choix au repère et après attribution d’un conducteur.
- Une course pour un proche : nom, téléphone international et confirmation de son accord et du lieu de départ. Le réservant garde la gestion de la course et transmet lui-même le code de départ. Aucun SMS automatique au passager invité.
- Les coordonnées du passager invité sont persistées avec la course. Le téléphone n’est partagé avec un conducteur qu’après son attribution. L’identité et le téléphone de l’invité ne sont pas présentés comme vérifiés.
- Repère GPS noir orienté, ombre ronde et correction du calcul de trajet conservés.

## Validation

TypeScript et 32 tests réussis, dont un test serveur de persistance, propriété de réservation et confidentialité du numéro invité. Export iOS et web réussi. Simulation du moteur cartographique : six véhicules stables, sans duplication, masqués dans le sélecteur et hors démo. Rendu final et accès réseau à confirmer sur l’iPhone ; aucun appel Google réel pendant ces vérifications.
