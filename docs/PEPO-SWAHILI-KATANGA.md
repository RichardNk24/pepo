# Pepo · atelier Swahili du Grand Katanga

Cette phase ajoute un **vrai corpus privé de ta voix**, avec enregistrement, réécoute sur iPhone/Android, texte exact corrigé, classement par ville et test de reconnaissance. Elle ne prétend pas entraîner automatiquement un modèle, cloner ta voix ou activer des phrases de navigation non relues.

## 1. Créer la branche

Dans PowerShell, à la racine de ton projet :

```powershell
cd "C:\Users\Guest-PC\Documents\Pepo-monorepo\pepo"
git status --short
git switch -c feat/voice-swahili-katanga
```

Les modifications locales restent présentes. Si la branche existe déjà, utilise `git switch feat/voice-swahili-katanga`. Le dossier fourni est un patch pour la phase Voice Intelligence déjà installée ; ce n’est pas un nouveau projet.

## 2. Installer le dossier extrait

Arrête Expo et l’API avant de remplacer les sources. Depuis la racine du projet :

```powershell
$patch = Read-Host "Chemin du dossier Pepo-Swahili-Katanga extrait"
node (Join-Path $patch "installer.cjs") --project="C:\Users\Guest-PC\Documents\Pepo-monorepo\pepo" --check
node (Join-Path $patch "installer.cjs") --project="C:\Users\Guest-PC\Documents\Pepo-monorepo\pepo"
npm install
npm run check
```

L’installateur vérifie toutes les sources avant d’écrire, crée une sauvegarde, conserve `.env`, assets et données. En cas de différence locale, aucun fichier n’est remplacé : compare le fichier annoncé ; ne le supprime pas pour contourner le contrôle.

Dans **`apps/api/.env`**, ajoute manuellement :

```dotenv
PEPO_VOICE_CORPUS_ENABLED=true
```

La collecte et la réécoute n’utilisent pas OpenAI. Pour le bouton **Tester la reconnaissance**, conserve la configuration existante :

```dotenv
PEPO_VOICE_ENABLED=true
OPENAI_API_KEY=ta_cle_existante
PEPO_VOICE_DAILY_CALL_LIMIT=20
```

Garde ton modèle de transcription configuré s’il fonctionne déjà. Les tests et la recherche vocale normale partagent le même quota journalier et la même limite de concurrence. Une tentative envoyée au fournisseur consomme une place dans ce quota même en cas d’échec ; aucun nouvel appel automatique n’est effectué.

L’API de collecte est désactivée tant que `PEPO_VOICE_CORPUS_ENABLED` n’est pas `true`. L’écran est réservé au développement. N’expose pas cet atelier comme fonctionnalité générale avant d’avoir organisé le programme de contribution.

## 3. Démarrer et ouvrir l’atelier

Terminal 1 :

```powershell
npm run api
```

Terminal 2 :

```powershell
npm run start -w @pepo/rider -- --clear
```

Utilise Expo Go comme pour ta voix actuelle et connecte-toi à ton compte réel. Vérifie que `EXPO_PUBLIC_API_URL` dans `apps/rider/.env` pointe sur l’adresse actuelle de ton ordinateur.

**Mon compte → Voix et navigation → Pepo Voice Intelligence Lab → Enregistrer le swahili du Katanga.** L’atelier existe aussi dans Driver, sans besoin de deuxième téléphone.

1. Choisis la ville concernée et lis la consigne.
2. Appuie sur **Parler**, puis parle naturellement. Les barres montrent le niveau sonore. Appuie sur **Terminer** ; une pause peut aussi terminer la capture. Maximum : 12 secondes sur le téléphone.
3. L’enregistrement est sauvegardé sur ton API. **Réécouter** lit ton véritable audio.
4. Écris exactement ce que tu as prononcé, y compris le mélange français/swahili ou les variantes de noms. Ne remplace pas ce texte par une formulation standard que tu n’as pas dite.
5. Appuie sur **Valider le texte exact**.
6. Facultatif : **Tester la reconnaissance · 1 appel OpenAI**. Le texte reconnu apparaît avec ta référence et le temps de réponse.
7. Si le texte de référence était erroné, corrige-le et valide-le à nouveau. L’ancienne mesure sera retirée ; tu peux relancer le test.

Cette collecte ne fournit pas une transcription en direct pendant la parole. Elle sépare volontairement l’enregistrement gratuit du test de reconnaissance. Les consignes sont en français : **c’est toi qui fournis le swahili authentique**, aucune traduction régionale inventée n’est présentée comme validée.

## 4. Premier corpus recommandé : 150 exemples

Commence calmement, à l’intérieur, téléphone à une distance normale de conversation. Réécoute chaque exemple. Ne parle pas en conduisant pour constituer ce corpus.

| Série | Volume | Objectif |
|---|---:|---|
| Lubumbashi | 20 consignes × 3 prises = 60 | Voix habituelle, formulation différente, débit un peu plus rapide |
| Likasi | 10 consignes × 3 prises = 30 | Lieux et tournures que tu connais réellement |
| Kolwezi | 10 consignes × 3 prises = 30 | Noms de quartiers, marchés, établissements et variantes |
| Kasumbalesa | 10 consignes × 3 prises = 30 | Usage local, repères et mélange de langues |

Le plafond initial est de 200 exemples par compte et rôle, 1 Mo par fichier. Ne renseigne pas une ville que tu ne connais pas simplement pour remplir le tableau. Le marquage Likasi/Kasumbalesa concerne le corpus ; il n’active pas de nouvelles villes de service dans les cartes ou les réservations.

Exemples de tâches : dire seulement le nom d’un lieu ; demander un hôtel avec son ancien nom ; préciser une branche d’Hyper Psaro que tu connais ; se corriger au milieu de la phrase ; mélanger swahili et français ; prononcer les distances et les instructions gauche/droite.

Pour les noms : relève les variantes réellement prononcées. **Psaro/Psarou n’identifie pas automatiquement une seule branche** ; **Karavia/Caravia** ne justifie pas d’inventer une entrée de l’hôtel. Les futures associations seront reliées à un établissement vérifié et à son identifiant Google.

## 5. Comprendre les résultats

**WER** mesure les erreurs de mots par rapport à ta référence (minuscules, ponctuation ignorée). 0 % signifie que les mots correspondent sur les exemples testés. Le taux peut dépasser 100 % en cas de nombreuses insertions.

La latence affichée mesure le temps de transcription côté fournisseur ; ce n’est pas le temps complet entre pression du micro et résultat sur le téléphone. Les exemples non testés ou non vérifiés sont exclus des mesures. Le moteur reçoit l’audio, l’indication swahili et le contexte régional, **jamais ta phrase de référence ni le nom cible comme réponse attendue**.

Une transcription correcte ne prouve pas que la bonne branche du commerce a été choisie. Cette phase mesure la parole ; la résolution des lieux et les coordonnées doivent être évaluées séparément. Les phrases de navigation enregistrées restent des contributions et ne remplacent pas automatiquement les annonces utilisées pendant une course.

Les données d’un seul locuteur ne permettent pas d’affirmer la qualité pour toute la région. Pour la suite, ajoute avec leur accord des contributeurs parlant à différents débits et avec différents accents. Réserve des locuteurs et des lieux aux tests : ne mesure pas uniquement sur les exemples qui auront servi à modifier le lexique.

## 6. Où sont les données ?

Le serveur utilise **son dossier de données existant** : table SQLite `voice_corpus` pour les références et fichiers chiffrés `voice-corpus/<id>.enc` pour l’audio. Les fichiers nécessitent la clé `storage.key` existante, ou la clé de stockage configurée. Sauvegarde les données avec cette clé ; ne supprime pas cette clé pour réinitialiser le corpus.

La réécoute passe par une requête authentifiée : aucun lien audio public. Les copies temporaires du téléphone sont supprimées lors de l’arrêt, du changement d’exemple ou de la fermeture normale de l’écran. Un arrêt brutal du système peut laisser un fichier dans le cache système. Les exemples serveur restent jusqu’à leur suppression explicite. **Supprimer cet exemple** enlève sa référence et son fichier audio, après confirmation.

Valider le texte veut dire « relu par le contributeur », pas « approuvé pour un guidage routier ». Aucune publication globale, aucun clonage de voix et aucun entraînement automatique ne sont déclenchés.

## 7. Exporter ton corpus depuis le PC

Le script fournit les vrais fichiers audio avec un `manifest.json` et les paires testées dans `evaluation.jsonl`. Le dossier d’export n’existait pas auparavant ; le script refuse d’écraser un dossier.

Tu peux obtenir une session de ton propre compte de développement dans PowerShell. Remplace seulement l’adresse API ; saisis le même numéro que dans Rider :

```powershell
$api = "http://192.168.11.100:4000"
$phone = Read-Host "Ton numéro au format +243..."
$otp = Invoke-RestMethod -Method Post -Uri "$api/api/auth/request" -ContentType "application/json" -Body (@{ phone = $phone } | ConvertTo-Json)
$code = if ($otp.devCode) { "$($otp.devCode)" } else { Read-Host "Code reçu" }
$session = Invoke-RestMethod -Method Post -Uri "$api/api/auth/verify" -ContentType "application/json" -Body (@{ phone = $phone; code = $code; name = "Richard"; role = "passenger"; city = "lubumbashi" } | ConvertTo-Json)
$env:PEPO_CORPUS_TOKEN = $session.token
node --import tsx scripts/export-voice-corpus.ts "--url=$api" "--output=voice-corpus-katanga-001"
Remove-Item Env:PEPO_CORPUS_TOKEN
node --import tsx scripts/evaluate-voice-corpus.ts voice-corpus-katanga-001/evaluation.jsonl
```

Aucun jeton ou clé OpenAI n’est écrit dans les fichiers exportés. L’export contient ta voix et tes phrases : choisis explicitement à qui tu le transmets. Le rôle doit correspondre à celui utilisé pour enregistrer, `passenger` pour Rider, `driver` pour Driver. Une autre session du même compte peut recevoir le même corpus ; un autre compte n’y a pas accès.

Le script exporte uniquement les exemples relus. Si tu n’as encore lancé aucun test, `evaluation.jsonl` sera vide : c’est normal, `manifest.json` et les audios restent utilisables pour la prochaine revue.

## 8. Critères de validation sur ton iPhone

- Capture : barres en mouvement, puis exemple sauvegardé.
- Réécoute : ta voix réelle, pas une voix de synthèse.
- Correction : texte exact conservé après fermeture/réouverture.
- Test : résultat reconnu visible, pas de réservation déclenchée.
- Séparation : autre compte sans accès ; test sans clé indisponible, collecte toujours possible.
- Cycle audio : commencer à parler arrête la réécoute ; passer en arrière-plan annule la capture.
- Suppression : l’exemple disparaît de la liste, du fichier et des prochains exports.

Le code est vérifié automatiquement ; le microphone réel, les autorisations iOS et la qualité du swahili doivent être vérifiés sur ton téléphone. La prochaine phase peut utiliser ces contributions pour bâtir un lexique régional validé, tester les homonymes et préparer des annonces de navigation relues. Lingala restera un chantier distinct après ce premier corpus.

Message de commit proposé :

```text
feat(voice): add private Katangese Swahili corpus workshop

- capture and replay owner-authenticated speech samples by city
- review reference transcripts and compare recognition results
- share transcription quotas and concurrency limits
- encrypt stored audio and support deletion and dataset export
```
