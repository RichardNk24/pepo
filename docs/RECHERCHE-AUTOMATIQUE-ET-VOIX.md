# Recherche automatique et dictée — Pepo Rider

Livraison du 4 octobre 2026. Ce document remplace, pour la recherche de destination, l'ancien parcours qui imposait « Comprendre ma demande ».

## Comportement livré

- Après 700 ms sans nouvelle frappe : une seule recherche authentifiée. Deux caractères minimum. Aucun bouton de compréhension. Les réponses devenues obsolètes sont ignorées et les requêtes client interrompues.
- Priorité aux noms et alias du catalogue ; complétion partielle locale, puis désambiguïsation OpenAI uniquement pour les demandes de plusieurs mots quand nécessaire et autorisée par le serveur. Le modèle ne produit que des identifiants de fiches existantes ; il ne crée aucune coordonnée.
- Les alias Karavia, Caravia, Hôtel Karavia et Hôtel Caravia complètent la fiche `lshi-accor-pullman` du catalogue Lubumbashi fourni. Source de ces appellations : Richard, 4 octobre 2026. Pas de remplacement du catalogue ni ajout de position. La fiche doit déjà exister.
- Sur iPhone/Android, « Parler » enregistre via expo-audio, disponible dans Expo Go SDK 57. La phrase est transcrite par le backend, apparaît dans le champ et déclenche la même recherche automatique.
- Une pause d'environ 1,5 seconde après un son détecté termine l'enregistrement. Le bouton « Terminé » reste disponible en environnement bruyant. Limite locale : 12 secondes. La détection utilise le niveau sonore, pas une reconnaissance parfaite de la fin d'une phrase.
- Ce microphone recherche uniquement un lieu. Il ne lance pas de commande de navigation, ne change pas automatiquement le départ et ne commande jamais une course. Le passager touche le bon résultat pour confirmer.
- Sur le navigateur, le composant existant utilise la reconnaissance du navigateur ; sa disponibilité dépend de ce dernier. La nouvelle transcription serveur vise les enregistrements natifs Expo Go/build iOS et Android.

## Installation du correctif

Extraire `Pepo-Recherche-Voix` dans un dossier distinct du projet existant. Arrêter Expo et l'API. Depuis la racine du monorepo, PowerShell :

```powershell
$patch = Read-Host "Chemin du dossier Pepo-Recherche-Voix extrait"
node (Join-Path $patch "installer.cjs") .
```

Si l'installation réussit :

```powershell
npm install
npm run api
```

Puis dans un autre terminal à la racine :

```powershell
npm exec --workspace=@pepo/rider -- expo start --go --clear
```

Scanner le nouveau QR. Le script sauvegarde les sources remplacées dans `apps/api/data/voice-update-backups`. Il ne touche pas aux `.env` réels, clés, assets, catalogue de lieux ni bases SQLite. Si un fichier source à modifier a été personnalisé depuis la livraison précédente, il s'arrête avant toute écriture et affiche le chemin concerné. Ne pas forcer : comparer ce fichier avec la version du correctif. Les dépendances audio sont fusionnées dans le package Rider ; `npm install` remet le lockfile local à jour si nécessaire.

## Configuration et coûts bornés

Conserver les adresses API déjà fonctionnelles et la clé OpenAI **dans apps/api/.env uniquement**. Le flag vocal suit `PEPO_AI_PLACES_ENABLED` si absent. Pour le régler séparément :

```dotenv
PEPO_VOICE_ENABLED=true
OPENAI_TRANSCRIPTION_MODEL=gpt-transcribe
PEPO_VOICE_DAILY_CALL_LIMIT=20
```

Le modèle est configurable : sa disponibilité dépend du compte OpenAI. Aucun repli payant automatique et aucune relance automatique après erreur. Le budget vocal compte les tentatives, y compris les erreurs du fournisseur. Les tentatives audio ont un coût distinct des tokens du modèle de résolution ; les recherches locales connues n'appellent pas ce dernier.

Recherche : quota journalier existant `PEPO_AI_DAILY_CALL_LIMIT`, six appels modèle maximum par compte et par minute, deux appels modèle simultanés, cache de décisions en mémoire cinq minutes. Quarante requêtes de recherche HTTP par compte/minute permettent la saisie automatique sans saturer les six appels payants. Les requêtes déjà parties peuvent être facturées même si l'utilisateur continue à écrire ; l'annulation client ne garantit pas l'annulation d'un coût fournisseur.

Voix : session authentifiée, six requêtes par compte/minute, deux transcriptions simultanées, 1 Mo maximum, conteneur WAV PCM ou M4A/MP4 reconnu et durée déclarée entre 0,35 et 15 secondes ; requête fournisseur bornée à 11 secondes. Contrôle de durée par métadonnées de conteneur, pas un décodage complet de l'audio. Vingt tentatives vocales par jour UTC par défaut, quota conservé en SQLite après redémarrage. Ces limites conviennent au pilote mono-instance ; une flotte de serveurs nécessite un limiteur partagé et des métriques de charge.

## Données et consentement d'usage

Le micro ne démarre qu'après un appui et l'autorisation système. Une mention indique que la voix part vers OpenAI. Fermeture de l'écran, annulation et passage en arrière-plan interrompent le parcours ; un texte retardé ne peut pas modifier un nouveau champ.

Le fichier temporaire est supprimé sur le téléphone après traitement ou annulation (nettoyage au mieux si arrêt brutal du processus). Le serveur traite l'audio en mémoire, n'écrit pas de fichier audio, et n'enregistre ni audio ni transcription dans SQLite ou ses logs applicatifs. La base conserve des compteurs de quota, pas les phrases. La transcription reste dans le champ de saisie. Les phrases nécessitant une désambiguïsation peuvent être transmises à OpenAI ; la recherche classique peut interroger Google selon la configuration existante.

Les durées et contrôles de conservation propres à OpenAI dépendent du service et des options du compte : aucune promesse de « zéro conservation » fournisseur. En production, utiliser HTTPS ; le HTTP sur IP Wi-Fi sert uniquement au développement local. Aucune nouvelle collecte de traces GPS, ni apprentissage automatique depuis les demandes.

## Tests à faire sur ton téléphone

1. Hors démo, ville Lubumbashi, taper « Je vais à l'hôtel Caravia ». Pullman doit être proposé sans appuyer sur Comprendre.
2. Taper « Amène-moi à Madini », puis « La plage de Lubumbashi ».
3. Appuyer sur Parler, autoriser le micro, dire « Je vais à l'hôtel Karavia », puis faire une pause. Vérifier le texte et choisir le lieu.
4. Dans le bruit, toucher Terminé. Tester Annuler, fermer l'écran pendant l'écoute, et revenir à la saisie.
5. Refuser le micro ou couper Internet : la saisie et le choix sur carte restent accessibles.
6. Vérifier le français d'abord, puis anglais, swahili et lingala avec des locuteurs. Les traductions UI sont présentes ; la reconnaissance d'accents, des noms et des variantes régionales n'est pas garantie par les tests techniques.

Si le serveur refuse la voix : vérifier la clé et son accès au modèle, le flag vocal et le quota. Si l'iPhone refuse le micro : vérifier les autorisations Expo Go dans Réglages. Une build de développement installée avant l'ajout d'expo-audio doit être reconstruite ; Expo Go ne nécessite pas cette build.

## Validation technique

- TypeScript et lint : vérifiés sur le monorepo.
- 112 tests automatisés réussis, dont alias multilingues écrits, enregistrement avec double taps/silence/bruit, annulation pendant préparation ou transcription, nettoyage, autorisation API, uploads invalides/trop longs/trop gros, quota persistant et absence de retries.
- Exports Rider web et iOS et compilation API : réussis.
- Parcours navigateur connecté : phrase saisie, suggestion automatique, confirmation et transmission à la réservation réussis avec catalogue fictif ; absence du bouton Comprendre vérifiée.
- Installateur testé sur le ZIP précédent : conservation des réglages personnalisés, des .env, du catalogue et d’un asset ; seconde exécution sans changements ; refus des conflits avant écriture.
- Aucun appel payant OpenAI réel et aucun enregistrement physique iPhone/Android effectué ici. Le fournisseur est simulé dans les tests ; valider la reconnaissance avec ta clé et ton téléphone reste nécessaire.

## Sources techniques

- Expo SDK 57, expo-audio et permissions : https://docs.expo.dev/versions/v57.0.0/sdk/audio/
- OpenAI transcription : https://developers.openai.com/api/docs/guides/speech-to-text
- Modèles et dépréciations : https://developers.openai.com/api/docs/deprecations
- Conservation fournisseur : https://developers.openai.com/api/docs/guides/your-data
