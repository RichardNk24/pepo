# Correctif du transfert vocal

Les barres jaunes qui bougent indiquent que le téléphone reçoit du son. Dans cette version, un contrôle authentifié du service vocal réussit avant le démarrage de l'enregistrement. L'erreur après « Terminer » concerne donc le transfert audio ou la transcription. Elle ne permet pas, à elle seule, de déterminer quelle étape échoue.

Ce correctif remplace l'envoi du fichier audio par le transfert multipart natif d'Expo FileSystem. Le fichier est envoyé après sa finalisation, avec le jeton de la session Pepo. Le transfert et la réponse disposent ensemble de 45 secondes ; l'appel de transcription côté serveur dispose de 25 secondes, contre 11 précédemment. Le délai partagé de 16 secondes des requêtes JSON ne s'applique plus à cet envoi audio. Aucun nouvel essai automatique ne déclenche un second appel payant.

L'annulation interrompt le transfert avant le nettoyage du fichier. Le texte transcrit remplit le champ sélectionné, puis la recherche automatique existante prend le relais. Ce transfert ne fournit pas de transcription en direct pendant l'enregistrement : les barres montrent le son capté et le texte arrive après « Terminer ».

## Installation Windows

Ce correctif s'applique après **Pepo-Correctif-Micro**. Il conserve les `.env`, clés, assets, catalogue de lieux et bases de données. Il ne modifie pas `.env.example` et n'ajoute aucune dépendance. Il refuse les conflits de version avant toute modification et sauvegarde les sources remplacées dans `apps/api/data/voice-update-backups/`.

1. Extraire `Pepo-Transfert-Voix.zip`.
2. Arrêter le backend et Expo avec `Ctrl+C` dans leurs terminaux.
3. Depuis la racine du projet existant, là où se trouve le dossier `apps`, exécuter :

```powershell
$patch = Read-Host "Chemin du dossier Pepo-Transfert-Voix extrait contenant installer.cjs"
node (Join-Path $patch "installer.cjs") .
```

Si l'installateur refuse un fichier différent, conserver ce fichier et transmettre le message de conflit. Ne pas supprimer ni renommer la version locale pour contourner le contrôle.

4. Relancer le backend dans un terminal :

```powershell
npm run api
```

5. Dans un autre terminal à la même racine, relancer Expo Go avec le cache vidé :

```powershell
npm exec --workspace=@pepo/rider -- expo start --go --clear
```

Aucun `npm install` n'est requis pour ce correctif.

## Test sur iPhone

Garder l'adresse actuelle qui fonctionne, sans changer l'IP pour ce test. Ouvrir l'application, être connecté hors démo, puis ouvrir Itinéraire. Toucher « Parler », dire « Je vais à Pullman », attendre quelques secondes et toucher « Terminer ». Attendre la transcription. Le texte doit apparaître dans le champ destination et les résultats doivent suivre. Confirmer le lieu avant de commander une course.

La transcription nécessite toujours un service vocal activé, une clé OpenAI valide et un quota disponible sur le backend. Le correctif préserve ces réglages.

## Si l'erreur persiste

Copier les lignes `[pepo-voice]` du terminal Expo **et du terminal backend**, pour le même essai. Elles contiennent des codes, des durées, le nombre d'octets et un identifiant de trace ; elles n'impriment ni l'audio, ni la transcription, ni les clés.

| Trace | Ce qu'elle permet de vérifier |
| --- | --- |
| Expo : `VOICE_UPLOAD_START` | Le fichier audio finalisé est prêt à être envoyé. |
| Backend : `VOICE_REQUEST_RECEIVED` | La requête authentifiée est arrivée au service vocal. |
| Backend : `VOICE_AUDIO_RECEIVED` | Le fichier a été reçu et son conteneur validé. |
| Backend : `VOICE_PROVIDER_STARTED` | L'appel de transcription commence. |
| Backend : `VOICE_PROVIDER_RESPONSE` | OpenAI a renvoyé un statut HTTP. |
| Expo : `VOICE_UPLOAD_COMPLETE` | Une transcription valide a été reçue par l'application. |
| `VOICE_UPLOAD_NETWORK` | Le transfert natif a échoué ; vérifier les étapes arrivées au backend. |
| `VOICE_UPLOAD_TIMEOUT` / `VOICE_TIMEOUT` | Le délai du téléphone / du fournisseur a été dépassé. |
| `VOICE_PROVIDER_AUTH` / `VOICE_PROVIDER_MODEL` | Le fournisseur a rejeté la clé / le modèle configuré. |

Un identifiant identique permet de relier les deux terminaux. Les traces détaillées sont réservées au développement. Un code réseau seul ne prouve pas que le micro a échoué.

## Validation effectuée

- `npm run check` : TypeScript, lint et 123 tests réussis, dont les cas de succès, délai, annulation, absence de nouvel essai et réponses invalides du transfert vocal.
- Compilation du backend réussie.
- Export iOS réussi.
- Installateur vérifié : installation, seconde exécution sans modification, refus des conflits et préservation des fichiers de configuration.

Le transfert sur un iPhone physique et un appel OpenAI réel n'ont pas été exécutés dans cet environnement. Les langues française, anglaise, swahili et lingala possèdent le nouveau message de délai ; la qualité linguistique reste à valider avec des locuteurs.
