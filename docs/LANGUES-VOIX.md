# Langues, navigation et commandes vocales

## Choix et persistance

Le catalogue `packages/i18n` expose `fr`, `en`, `sw` et `ln`. Le choix est disponible dès l’inscription puis dans le compte ; chaque application conserve sa préférence. Une ancienne valeur inconnue revient au français. Les dates suivent la locale régionale lorsqu’elle existe dans le moteur JavaScript. Les lieux, les contacts et les messages des personnes ne sont pas traduits.

Les clés explicites se trouvent dans `catalog.ts` et `extra.ts`. `copy.ts` traduit les textes existants du Rider sans réécrire toute son interface. Pour tout nouvel écran, utilisez `useI18n().t(key, params)` et des paramètres nommés. Évitez de construire une phrase traduite en assemblant plusieurs morceaux. Les textes venant d’un fournisseur externe ou certaines erreurs techniques peuvent encore rester dans la langue de ce fournisseur.

## Commandes disponibles

| Intention | Français | English | Kiswahili | Lingala |
|---|---|---|---|---|
| Destination | Aller à Institut Madini | Go to Institut Madini | Nipeleke Institut Madini | Mema ngai na Institut Madini |
| Compte | Mon compte | My account | Akaunti yangu | Konti na ngai |
| Historique | Mes courses | My rides | Safari zangu | Ba courses na ngai |
| Aide | Aide | Help | Msaada | Lisalisi |
| Retour | Retour | Back | Rudi | Zonga |
| Position | Ma position | My location | Eneo langu | Esika nazali |
| Arrivée chauffeur | Je suis arrivé | I have arrived | Nimefika | Nakomi |
| Démarrer chauffeur | Démarrer la course | Start the ride | Anza safari | Banda course |
| Terminer chauffeur | Terminer la course | Finish the ride | Maliza safari | Sukisa course |

Dans la recherche Rider, un nom de lieu prononcé seul est accepté. Il devient une requête visible ; l’utilisateur choisit le bon résultat. Les commandes d’une course sont limitées à l’écran Driver et au statut qui les autorise. Une arrivée, une fin ou une annulation demandée à la voix ouvre une confirmation. Le démarrage demande toujours le PIN du passager, validé côté API. Aucune phrase n’est envoyée à un modèle génératif pour agir librement sur le compte.

## Fonctionnement du micro

Le module natif `expo-speech-recognition` utilise le service du téléphone. Il est chargé seulement après un appui. Le micro n’écoute pas en permanence, s’arrête après une requête ou au plus tard après 12 secondes, et est coupé quand l’application quitte le premier plan ou change de langue. Aucun fichier audio n’est enregistré par Pepo. Le fournisseur vocal du téléphone peut toutefois traiter la reconnaissance sur Internet selon ses réglages ; le compte explique ce comportement.

Une build de développement ou de production doit inclure le plugin. Expo Go conserve le clavier et affiche une explication. Le service doit être présent, ses permissions autorisées et la langue proposée. Sur les systèmes qui ne publient pas la liste de reconnaissance, seul un essai français/anglais est permis ; Pepo ne suppose pas que le swahili ou le Lingala est pris en charge.

La synthèse utilise `expo-speech` et choisit exclusivement une voix de la langue demandée. Le Lingala est rarement proposé par les systèmes. Si la voix manque, l’app garde son interface traduite et explique la limitation. Un service vocal spécialisé pourrait être ajouté ensuite avec un contrat fournisseur, des mesures de qualité pour les accents RDC et un consentement clair ; aucun service payant ou transfert audio supplémentaire n’est activé ici.

Sur iPhone, testez aussi avec le mode silencieux désactivé si la lecture est inaudible.

## Navigation routière

Driver ouvre Google Maps avec les coordonnées de départ/destination et les étapes dans l’ordre validé. Pepo demande la locale sélectionnée. Le moteur de navigation conserve ses propres réglages de voix et ses langues disponibles. Pepo lit le résumé du trajet, mais ne fabrique pas de fausses instructions « tournez à gauche » à partir d’un tracé.

Les animations de carte, le picker et le calcul des étapes existants sont conservés. Les libellés Départ/Arrivée sont envoyés au rendu de carte sans recharger sa page à chaque changement de préférence.

## Recette sur appareil

Tester chaque langue sur Rider et Driver : sélection avant inscription, changement depuis le compte, fermeture/réouverture, lecture disponible/indisponible, permission refusée, service absent, début/fin d’écoute et passage en arrière-plan. Vérifier qu’un lieu ambigu est choisi visuellement et qu’aucune annulation, commande ou fin de course n’est déclenchée sans confirmation. Tester les formulations et accents avec des locuteurs de Kinshasa et Lubumbashi avant publication.

Références : [Expo Speech](https://docs.expo.dev/versions/latest/sdk/speech/), [module de reconnaissance](https://github.com/jamsch/expo-speech-recognition).
