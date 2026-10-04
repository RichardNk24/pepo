# Première brique : comprendre un lieu et son entrée

Livré le 3 octobre 2026. Chantier P1 « langage conversationnel » ; sa fiabilité dépend du catalogue de lieux et d'entrées vérifiés, priorité P0. Le problème visé est une demande comme « Amène-moi au mall, entrée parking » : chercher seulement la phrase entière peut manquer un nom connu ou l'accès demandé. La fréquence et le gain réel restent à mesurer auprès des passagers et chauffeurs du pilote.

## Ce qui fonctionne

Dans la recherche Rider connectée, le bouton **Comprendre ma demande** apparaît après deux caractères. Il concerne le champ actif : départ, destination ou étape. Les noms et alias reconnus localement donnent des suggestions sans OpenAI. Les accès déclarés sont proposés sous forme de lieux sélectionnables ; une suggestion ne commande jamais une course. L'utilisateur vérifie puis choisit, et l'entrée choisie est transmise au parcours existant.

Une demande moins claire peut être départagée par OpenAI parmi les candidats du catalogue propre à Pepo. Les coordonnées viennent exclusivement du serveur. Une réponse inconnue, incomplète, tardive ou invalide déclenche un repli. Une demande sans candidat local reste une recherche classique : le modèle ne découvre pas de lieux absents du catalogue. Le bouton est masqué en démo. Aucun appel OpenAI n'est effectué pendant la frappe ou un déplacement du picker.

Les libellés sont disponibles en français, anglais, swahili et Lingala. Les règles locales couvrent quelques tournures dans ces langues ; cela ne démontre pas une compréhension générale des dialectes. Faire relire les traductions et tester des demandes locales. Le micro conserve ses contraintes natives décrites dans `LANGUES-VOIX.md`.

## Intégrer

Remplacer les sources par cette archive en conservant vos `.env` réels et vos données. Aucune nouvelle dépendance n'est nécessaire. Node.js 24 est requis par le monorepo.

Dans **apps/api/.env**, ajouter :

```dotenv
OPENAI_API_KEY=VOTRE_CLE_SERVEUR
PEPO_AI_PLACES_ENABLED=true
OPENAI_PLACES_MODEL=gpt-4.1-mini
PEPO_AI_DAILY_CALL_LIMIT=20
PEPO_LANDMARKS_FILE=C:/chemin/vers/pepo/apps/api/landmarks.json
```

Adapter le chemin absolu. Ne jamais utiliser un préfixe `EXPO_PUBLIC_` pour cette clé, ni la placer dans Rider ou Driver. Le défaut est désactivé ; sans activation ou clé, le bouton garde la résolution locale et le repli classique. Le plafond par défaut est 100 tentatives par jour ; commencer avec 20 est possible. Une limite de 0 bloque OpenAI. Redémarrer l'API et Rider depuis la racine :

```sh
npm run api
# Dans un autre terminal
npm run start -w @pepo/rider -- --clear
```

Le plafond est enregistré dans la base SQLite existante, dans une table créée de manière idempotente. Sauvegarder les données avant la mise à jour. Redémarrer l'API ne remet pas ce compteur à zéro. Les applications utilisant des copies différentes de la base auront des compteurs indépendants.

## Alimenter le catalogue

Le format existant de `apps/api/src/landmarks.ts` est utilisé. Un fichier `[]` est valide, mais n'offre aucun candidat à l'IA. Pas de coordonnées réelles déduites des captures ou générées par le modèle.

| Champ | Contenu |
|---|---|
| `id` | Identifiant unique et stable, également unique parmi toutes les entrées |
| `name` | Nom usuel du lieu, vérifié |
| `city` | `lubumbashi`, `kinshasa` ou `kolwezi` |
| `latitude`, `longitude` | Nombres, position vérifiée du lieu |
| `address` | Quartier ou référence lisible, jusqu'à 500 caractères |
| `aliases` | Liste facultative de noms locaux, 15 maximum |
| `entrances` | Liste facultative, 10 maximum : chaque objet a `id`, `name`, `latitude`, `longitude` |

Le fichier est un tableau JSON de ces objets, jusqu'à 2 000 lieux. Le chargeur refuse un fichier invalide et revient à une liste vide. La résolution limite les lieux à 60 km du centre de la ville et les entrées à 1 km de leur lieu. Ces contrôles géographiques ne prouvent pas l'accessibilité. Vérifier les accès sur place, leurs noms et les droits d'utilisation des données avant publication. Cette livraison ne crée pas encore un workflow de revue, une provenance structurée, une gestion des portails fermés ou des restrictions par véhicule.

## Maîtrise des appels et données

- Endpoint authentifié `POST /api/places/resolve`, avec `query`, `city`, `language` et `allowAi`. L'autorisation IA vaut `false` par défaut ; Rider l'active seulement au clic, après un avertissement visible sur l'envoi de la phrase à OpenAI.
- Validation stricte : phrase de 2 à 300 caractères, ville et langue autorisées. Limite de 6 demandes par utilisateur et minute, 2 appels fournisseur simultanés par instance, plafond journalier persistant en UTC.
- Maximum 12 lieux candidats puis 24 fiches compactes comprenant les entrées. Seuls leurs identifiants, noms et quelques alias sont envoyés, avec la phrase, la ville et la langue. Aucun GPS, historique de course, téléphone, profil ni résultat Google n'est inclus dans le contexte du modèle.
- Réponse structurée : jusqu'à 3 identifiants autorisés, vérifiés après réception. Maximum 160 tokens de sortie, délai fournisseur de 4,5 secondes et aucune nouvelle tentative automatique. Les tentatives échouées consomment aussi le quota Pepo ; cela n'est pas une mesure exacte de facturation fournisseur.
- Cache mémoire de 200 réponses, durée de 5 minutes, identifiants seulement. Les demandes identiques simultanées partagent un appel. Le contexte du catalogue, la langue et le modèle font partie de la clé. Les résultats reprennent toujours les coordonnées du catalogue courant.
- `store: false` dans la requête Responses. Cela ne constitue pas une garantie d'absence de conservation chez le fournisseur ; vérifier les conditions applicables au compte avant le pilote.
- La phrase n'est pas journalisée par ce module. Un filtre simple écarte certains numéros, adresses e-mail et URL avant OpenAI ; il ne détecte pas toutes les données personnelles. L'interface demande de ne pas en saisir. Les compteurs internes de tokens sont agrégés et ne sont pas encore exposés dans l'administration.

Le chemin classique peut toujours appeler Google selon votre configuration ; ses coûts sont distincts. Aucun pourcentage d'économie ni qualité de compréhension réelle n'est garanti. Le cache et la limite de concurrence sont propres à une instance ; avant plusieurs instances, prévoir une coordination partagée et mesurer la charge. SQLite convient ici au périmètre pilote, pas à une promesse de capacité illimitée.

## Fichiers et vérification

Logique serveur : `apps/api/src/map-search/intelligence.ts` et `routes.ts`. Client : `packages/api-client/src/maps.ts`, `apps/rider/src/components/PlaceSearch.tsx` et `packages/i18n/src/extra.ts`. Configuration : `apps/api/.env.example`. Tests : les deux fichiers `tests/place-intelligence*.test.ts` et `scripts/smoke-place-intelligence.cjs`.

```sh
npm run check
npm run build:api
```

Pour le contrôle Chromium connecté, exporter Rider web avec `EXPO_PUBLIC_API_URL=http://127.0.0.1:4019` et `EXPO_PUBLIC_MAP_RENDERER=demo`, puis exécuter `node --import tsx scripts/smoke-place-intelligence.cjs`. Ces variables sont réservées à ce contrôle. Sous PowerShell, les définir avec `$env:EXPO_PUBLIC_API_URL='http://127.0.0.1:4019'` et `$env:EXPO_PUBLIC_MAP_RENDERER='demo'` ; lancer `npx expo export --platform web` depuis `apps/rider`, puis revenir à la racine pour le script. Retirer ces variables de la session après le test. Le script utilise un catalogue fictif isolé et ne fait aucun appel OpenAI payant.

Les tests fournisseur utilisent des doubles : aucun appel avec une vraie clé n'a été effectué. Après configuration de votre compte, vérifier une demande ambiguë contrôlée, les droits sur le modèle et le budget du compte. Ne pas confondre résolution locale réussie et appel réel au modèle.

Mesurer sur un petit catalogue validé : taux de bonne suggestion et bonne entrée, demandes de clarification, proportion résolue localement, latence, échecs et tokens par demande. Comparer avec la recherche classique avant d'étendre.

Documentation officielle : [Responses](https://developers.openai.com/api/reference/resources/responses/methods/create), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini).
