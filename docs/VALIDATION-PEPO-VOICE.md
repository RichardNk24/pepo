# Validation Pepo Voice Intelligence

Vérifications effectuées le 9 octobre 2026 dans l’environnement Linux/Node 24, à partir du dernier projet fourni avec le patch Sécurité Nuit.

| Vérification | Résultat |
|---|---|
| TypeScript, tous les workspaces | Réussi |
| Frontières de packages et présence des images | Réussi |
| ESLint | Réussi |
| Vitest, suite complète | 28 fichiers, 226 tests réussis |
| Dont sécurité de nuit existante | 18 tests réussis |
| Dont nouvelle navigation, voix et repères | 20 tests du moteur, 5 tests API géographique, 3 tests évaluation/heure locale |
| API compilée avec les packages partagés | Réussi |
| Export Metro/Hermes iOS Rider | Réussi |
| Export Metro/Hermes iOS Driver | Réussi |
| Export web Rider et Driver | Réussi |
| Installateur sur copie isolée du projet | Réussi |

L’installateur a été exécuté en mode vérification, installation, seconde installation sans effet et restauration. Des fichiers témoins `.env`, image et données sont restés identiques. Les hashes tolèrent BOM/CRLF Windows et la restauration restitue les octets originaux. Un conflit de source empêche toute installation ; une modification postérieure empêche la restauration de l’ensemble, sans écrasement partiel.

Les nouveaux tests vérifient : distance curviligne, préparation/rappel sans répétition, GPS ancien/futur/imprécis, sortie de route, boucles ambiguës, saut GPS, géométrie invalide, texte avenue provenant du fournisseur, absence de sortie de rond-point inventée, repères anciens/incertains/invisibles, mauvaise branche, sens d’approche, entrées piétonnes, séquence de parcelles complète, séparation kikongo/kituba, voix absente, commandes mixtes avec confirmation, réponse audio tardive invalidée, checksum du port de pack, statistiques de corpus et réévaluation de la visibilité au passage à la nuit.

Les appels OpenAI/Google dans les tests sont simulés. Aucun benchmark réel de transcription congolaise ni test audio physique n’a été effectué. L’export iOS est une compilation JavaScript/Hermes, pas une installation signée sur iPhone, ni une preuve de permissions natives. L’export web ne constitue pas une validation visuelle interactive du microphone dans chaque navigateur.

À vérifier sur le seul iPhone : vrai compte connecté, micro et niveaux, texte après capture, choix du bon établissement, prononciation, volume/mode silencieux, changement de langue pendant une annonce, mode avion, interruptions et bruit. Le Lab fournit les scénarios fictifs ; le guidage Driver réel nécessite ensuite une course active, un GPS frais et des étapes routières Google.

Le pilote ne livre pas encore de corpus terrain validé SW/LN, packs enregistrés natifs, cache audio téléchargé, revue de séquences de parcelles ou guidage natif continu en arrière-plan. Ces éléments sont explicitement décrits comme prochaines étapes dans le guide.
