# Validation de la migration — 3 octobre 2026

Ce rapport concerne le monorepo livré, avec Pepo Rider, Pepo Driver et leur API commune. Les captures et rapports plus anciens conservés dans `docs` décrivent la version précédente ; ils ne prouvent pas la recette de cette migration.

## Contrôles exécutés

| Contrôle | Résultat |
|---|---|
| TypeScript strict, applications et packages | Réussi |
| Lint et contrôle des frontières/imports/assets | Réussi, 141 fichiers applicatifs contrôlés |
| Tests Vitest | 95 tests réussis dans 15 fichiers |
| Exports Expo Rider | Migration : web/iOS/Android réussis ; correctifs récents : web et iOS Rider revérifiés |
| Exports Expo Driver | Migration : web/iOS/Android réussis ; correctif Google : iOS revérifié |
| Compilation du backend | Réussie |
| Démarrage du backend compilé | Réussi avec configuration de production de test isolée |
| HTTP du backend compilé | `/health`, `/admin` et les deux assets véhicule : réponse 200, contenu non vide |
| Parcours Chromium Rider et Driver | Accueil, changement entre quatre langues et entrée en démo réussis |
| Recherche Rider | Deux champs, départ manuel conservé jusqu’à la course, boutons carte de 44 px et deux modes du picker vérifiés |
| Bulles du trajet Google | Couche supérieure, pointe ancrée, bords, changement de langue et masquage pendant le picker vérifiés avec un double Google |

Le contrôle navigateur utilise les exports réels des deux applications, sur un viewport mobile 390 × 844. Les captures ont été inspectées. Aucun appel Google, SMS ou service de reconnaissance vocale réel n'est utilisé dans ce contrôle.

## Couverture métier

Les tests existants de courses, autorisations, documents, calculs, cartes et ordre des étapes sont conservés. Les nouveaux contrôles vérifient notamment :

- Un même numéro correspond à un utilisateur central, avec sessions Rider et Driver indépendantes.
- La connexion ou l'édition dans Rider conserve le profil chauffeur, son véhicule et ses statistiques.
- La migration de l'ancienne base peut être exécutée deux fois sans duplication.
- Une course peut être créée, négociée, affectée, démarrée avec le PIN et terminée ; le montant brut rejoint les gains du chauffeur.
- Les participants autorisés reçoivent les événements Socket.IO ; les comptes extérieurs et sessions invalides sont exclus.
- Les catalogues français, anglais, swahili et Lingala contiennent les mêmes clés ; les noms de lieux restent inchangés.
- Les commandes vocales sont reconnues par la grammaire dans les quatre langues, y compris avec différentes apostrophes ou séparateurs.
- Une voix absente n'est pas remplacée silencieusement par une autre langue ; les liens de navigation conservent l'ordre validé des étapes.

## Reproduire

Depuis la racine, avec Node.js 24 et les exemples d'environnement adaptés :

```sh
npm ci
npm run check
npm run build:api
npm run export:all -w @pepo/rider
npm run export:all -w @pepo/driver
npx playwright install chromium
npm run smoke:web
node --import tsx scripts/smoke-map-labels.cjs
```

`smoke:web` sert temporairement les deux exports, lance Chromium puis ferme les serveurs. Il nécessite des exports web présents dans `apps/rider/dist` et `apps/driver/dist`. Les dépendances installées, bases de données et sorties de build sont exclues de l'archive : elles se recréent avec ces commandes.

## Correctif Google Maps après migration

La sélection native détecte Expo Go avec son environnement actuel, même si `appOwnership` est nul. Dans Expo Go, une URL cartes utilise le rendu Google hébergé, même avec le réglage `native`. Dans une build installée configurée, le fournisseur natif est explicitement Google. Sans configuration Google, un message est affiché ; Apple Maps n’est plus choisi automatiquement. Le mode illustré reste disponible avec `EXPO_PUBLIC_MAP_RENDERER=demo`. Six tests couvrent ces décisions et leurs cas de régression.

Le guide `GOOGLE-MAPS.md` utilise désormais les chemins et commandes du monorepo. Il reste nécessaire de reprendre les fichiers `.env` et de tester les vraies clés sur le téléphone ; les tests exécutés ici n’attestent pas que la configuration du PC utilisateur est déjà active.

## Lisibilité du trajet et recherche du départ

Les bulles Départ/Arrivée du rendu Google partagé sont dans la couche `floatPane`, au-dessus des tracés et de leur animation. Une petite pointe reste attachée au point sélectionné, même lorsque la bulle est décalée pour rester dans l'écran. Lorsque les deux points sont proches, l'arrivée se place sous le point si la place disponible le permet. Les contrôles des bulles utilisent un double technique de Google Maps ; ils ne constituent pas un test du service Google réel.

La recherche Rider contient maintenant deux champs : lieu de départ et destination. Chacun possède une action carte de 44 × 44 px. Choisir un départ conserve la recherche ouverte et active la destination. La sélection manuelle est transmise à la course et conservée face à la position GPS automatique. La recherche d'une étape garde son fonctionnement séparé. Les nouvelles étiquettes sont disponibles dans les quatre langues.

Après remplacement des sources, redémarrer l'API et Expo : le document HTML de Google Maps est servi par l'API, sa modification ne s'applique pas en redémarrant seulement l'application. Conserver les fichiers `.env` locaux et les données existantes.

## Première recherche conversationnelle

Les 16 nouveaux tests vérifient la résolution locale des noms et entrées dans quatre langues, les candidats compacts sans coordonnées, la validation des identifiants retournés, le cache et sa durée, la déduplication des appels simultanés, les plafonds et le repli lors d'erreurs fournisseur. Les contrôles HTTP vérifient l'authentification, la validation d'entrée, `allowAi=false` et le quota SQLite conservé après recréation de l'API. TypeScript, lint, 95 tests, compilation API et exports web/iOS Rider ont été revérifiés.

Le script connecté `smoke-place-intelligence.cjs` utilise un catalogue fictif et l'API locale, avec OpenAI désactivé. Il contrôle le bouton explicite, la suggestion d'entrée, le message de vérification et la transmission de cette entrée à la réservation. Les tests OpenAI utilisent uniquement des doubles ; aucun appel avec une vraie clé n'a été effectué. Voir [configuration et limites](RECHERCHE-INTELLIGENTE.md). La qualité en langues locales, le catalogue terrain et le coût fournisseur réel restent à mesurer.

## Limites et recette restante

Les exports iOS/Android valident les bundles JavaScript et les assets. Ils ne sont pas des IPA/APK signés. Cette migration n'a pas été testée sur un téléphone physique, ni sous forte charge. Les réponses des fournisseurs utilisées par les tests de cartes sont simulées.

Le micro nécessite une build native incluant `expo-speech-recognition`, et ne fonctionne pas dans Expo Go. La reconnaissance et la lecture en swahili ou en Lingala dépendent des services installés sur l'appareil. L'interface et la grammaire traduites ne garantissent pas qu'un téléphone dispose de ces voix. La navigation détaillée est confiée à Google Maps ; Pepo lit un résumé du trajet.

Avant un pilote réel, vérifier sur iPhone et Android : permissions, GPS, clavier, haptique du picker, panneau Vehicle Options, interruptions réseau, son, changement/persistance de langue, refus du micro et parcours Rider → Driver sur la même API. Faire relire le Lingala et le swahili congolais par des locuteurs. Vérifier les clés et restrictions Google, le fournisseur SMS et la revue des documents avec la configuration réelle.

Les paiements Mobile Money, cartes, commissions et retraits restent à connecter à des fournisseurs. Les gains affichés sont des montants bruts de courses. Pour une montée en charge, mesurer d'abord le pilote et prévoir un stockage et une coordination adaptés aux multiples instances ; aucun benchmark de production n'est revendiqué.


## Correctif du 4 octobre — recherche automatique et dictée Rider

La recherche de destination Rider utilise désormais une pause de saisie de 700 ms. Le bouton « Comprendre ma demande » n'est plus nécessaire. La dictée de destination native passe par expo-audio et le backend OpenAI, y compris dans Expo Go ; la restriction Expo Go mentionnée plus haut reste celle de l'ancien microphone de commandes, encore utilisé ailleurs.

Voir `RECHERCHE-AUTOMATIQUE-ET-VOIX.md` pour les paramètres, quotas et limites. TypeScript, lint, exports web/iOS Rider et build API vérifiés. Parcours navigateur connecté vérifié : phrase saisie → suggestion automatique → confirmation → destination de réservation, sans bouton de compréhension ni appel OpenAI payant. Le test utilise un catalogue fictif ; le micro matériel et le vrai fournisseur restent à valider sur téléphone.
