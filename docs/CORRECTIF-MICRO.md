# Pepo — correctif de la recherche vocale

Cette mise à jour s’applique après Pepo-Recherche-Voix. Elle ne modifie ni les .env réels, ni les assets, ni les catalogues, ni les bases de données.

## Installation Windows

Dans le terminal à la racine de votre projet existant :

```powershell
$patch = Read-Host "Chemin du dossier Pepo-Correctif-Micro extrait"
node (Join-Path $patch "installer.cjs") .
```

L’installateur sauvegarde les fichiers remplacés et refuse un conflit de code. Le fichier .env.example ne fait pas partie de ce correctif.

Arrêter les anciens serveurs avec Ctrl+C. Relancer dans deux terminaux distincts :

```powershell
npm run api
```

```powershell
npm exec --workspace=@pepo/rider -- expo start --go --clear
```

Conserver votre OPENAI_API_KEY dans apps/api/.env. Pour activer explicitement le service vocal :

```dotenv
PEPO_VOICE_ENABLED=true
OPENAI_TRANSCRIPTION_MODEL=gpt-transcribe
```

Le plafond existant PEPO_VOICE_DAILY_CALL_LIMIT est conservé, avec 20 tentatives par jour par défaut pour toute l’API. Les erreurs du fournisseur comptent dans ce plafond. Il faut aussi que le compte OpenAI permette l’usage de l’API et de ce modèle. Ne jamais partager la clé.

## Comportement

- Le service est vérifié avant l’enregistrement. Un service non configuré ne demande plus de parler inutilement.
- L’audio est explicitement réactivé avant la préparation native.
- Pendant la capture, le champ affiche « Je vous écoute… » lorsqu’il est vide. Sous ce champ, les barres suivent le niveau sonore mesuré, avec le compteur de secondes. Elles indiquent le son, pas une reconnaissance de mots.
- « Terminer » ou une pause après la parole lance la transcription. Limite de capture : 12 secondes.
- La phrase transcrite apparaît dans le champ puis les lieux sont recherchés automatiquement. L’utilisateur confirme le lieu.
- Cette version utilise un fichier court : elle ne propose pas encore une transcription mot par mot pendant que vous parlez.
- Les voix faibles ne sont plus rejetées uniquement parce qu’elles restent sous le seuil de détection d’une pause. Une capture sans durée réelle et un niveau connu de silence restent rejetés.
- Le bouton garde une largeur stable ; les erreurs sont affichées séparément et ne compriment pas « Utiliser ma position ».
- La mention du fournisseur a été retirée de cet écran conformément à la demande produit. Le traitement audio temporaire via le backend et OpenAI est décrit dans RECHERCHE-AUTOMATIQUE-ET-VOIX.md. Les permissions du système restent requises.

## Test sur iPhone

1. Ouvrir le compte Rider connecté, hors démo.
2. Appuyer sur Parler. Autoriser Expo Go à utiliser le micro si demandé.
3. Dire « Je vais à Karavia » pendant quelques secondes. Les barres doivent réagir et le compteur doit avancer.
4. Appuyer sur Terminer. Le champ doit recevoir la phrase après la transcription, puis proposer les lieux.
5. Refaire avec Madini et Pullman. Tester aussi refus du micro, annulation et fermeture de l’écran.

Si les barres restent plates : vérifier Réglages iPhone → Apps → Expo Go → Microphone. Si les barres réagissent mais la transcription échoue, lire la ligne [pepo-voice] du terminal API/Expo. Ne transmettre que cette ligne, jamais le contenu du .env.

## Diagnostic

| Code | Cause à vérifier |
| --- | --- |
| VOICE_DISABLED / voice-disabled | Activation vocale, clé serveur, plafond positif, redémarrage API |
| VOICE_PROVIDER_AUTH | Clé ou autorisation du compte OpenAI |
| VOICE_PROVIDER_MODEL | Modèle non disponible pour ce compte |
| VOICE_PROVIDER_QUOTA | Quota ou facturation fournisseur |
| VOICE_QUOTA | Plafond local ou limite de demandes |
| VOICE_AUDIO_INVALID / empty-audio | Fichier non utilisable, durée ou capture interrompue |
| silence | Aucun niveau sonore utile capté |
| VOICE_EMPTY_TRANSCRIPT | Le fournisseur n’a renvoyé aucune phrase valide |
| VOICE_TIMEOUT | Délai de transcription dépassé |
| VOICE_PROVIDER_ERROR | Erreur fournisseur ou liaison réseau ; vérifier le statut HTTP affiché |

Les journaux ajoutés affichent seulement un code, un statut et éventuellement l’identifiant de requête fournisseur. Aucun audio, phrase, prompt ou clé n’est journalisé.

## Validation et limites

TypeScript, lint, 116 tests et bundle iOS Rider vérifiés. Les tests couvrent notamment voix faible, capture sans durée, indicateur de niveau, prévalidation sans appel payant, erreurs d’authentification fournisseur, réponse vide, quotas et annulation. Le fournisseur et le matériel sont simulés dans les tests. Aucun enregistrement sur iPhone physique ni appel avec votre clé OpenAI n’a été effectué ici. Les quatre langues sont disponibles dans l’interface ; la qualité des dialectes locaux reste à vérifier avec des locuteurs.
