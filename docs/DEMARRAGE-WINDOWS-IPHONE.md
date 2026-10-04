> Document conservé de la version précédente. Pour les commandes et chemins du monorepo, consultez [README.md](../README.md).

# Pepo sur Windows et iPhone 14 Pro

## 1. Tester dans Expo Go, sans compte Apple Developer

Cette édition utilise **Expo SDK 57 / React Native 0.86.3**, compatible avec le SDK 57 indiqué par ton Expo Go sur l’iPhone. Tu n’as besoin ni d’un Mac, ni de TestFlight, ni d’un abonnement Apple Developer pour l’ouvrir dans Expo Go.

1. Mets à jour **Expo Go** dans l’App Store de ton iPhone 14 Pro.
2. Extrais cette archive dans **un nouveau dossier**. N’utilise pas le `node_modules` ni le fichier `.env` de la précédente édition SDK 54.
3. Ouvre PowerShell dans le dossier `pepo` qui contient `package.json`. Installe Node.js **24 LTS** depuis https://nodejs.org/ si nécessaire. Arrête l’aperçu avec **Ctrl+C** s’il utilise ce terminal.
4. Lance :

```powershell
node --version
npm.cmd ci
npx.cmd expo login
npx.cmd expo start --go --lan
```

`npm.cmd ci` installe les dépendances ; la première installation demande Internet et peut prendre plusieurs minutes. Les suffixes `.cmd` évitent les restrictions PowerShell sur les scripts npm. `expo login` utilise un **compte Expo gratuit**, distinct d’Apple Developer. Crée ce compte sur https://expo.dev/signup si tu n’en as pas, puis connecte Expo Go au même compte.

5. Mets le PC et l’iPhone sur le **même Wi-Fi**. Accepte l’accès réseau privé de Node dans le pare-feu Windows s’il est demandé.
6. Laisse le terminal ouvert. Scanne son QR code avec l’**appareil photo de l’iPhone**, puis touche **Ouvrir dans Expo Go**.
7. Autorise l’accès au réseau local si iOS le demande. Sur l’accueil Pepo, touche **Explorer la démo**.

Aucun serveur, SMS réel ou compte conducteur n’est nécessaire pour ce premier essai. Les données fictives sont enregistrées séparément sur le téléphone : l’historique du navigateur du PC n’est pas transféré. Sans serveur cartes configuré, la carte utilise **Apple Maps sur iPhone dans Expo Go**, et le tracé de l’itinéraire est continu mais indicatif en mode démo. Les clés Google ne sont pas nécessaires à ce test.

### Si le QR code ne charge pas

Arrête Expo avec **Ctrl+C**, puis utilise un tunnel :

```powershell
npm.cmd install --global @expo/ngrok
npx.cmd expo start --go --tunnel
```

Le tunnel requiert Internet sur les deux appareils et peut être plus lent. Il concerne le serveur Expo ; il n’expose pas automatiquement ton API. Si l’iPhone refuse encore la connexion, vérifie les autorisations Expo Go > Réseau local dans les réglages iOS, et garde Expo au premier plan sur le PC.

### Pour les essais suivants

L’installation n’est à faire qu’une fois. Dans le même dossier :

```powershell
npm.cmd run start:go
```

Pour effacer uniquement le cache Metro : `npx.cmd expo start --go --lan --clear`.

### Aperçu web inclus

Tu peux également conserver l’aperçu précompilé : `node .\scripts\preview.cjs`, puis `http://localhost:8080`. `npm.cmd run web` lance la version web avec Expo.

### Un premier trajet en démo

1. Choisis **Moto**, **Confort** ou **Taxi** sur l’accueil.
2. Appuie sur **Où allez-vous ?**, puis choisis un repère.
3. Propose un prix, puis appuie sur **Trouver un conducteur**.
4. Accepte une offre ou clique **Négocier** ; le conducteur fictif répond.
5. Vérifie le modèle, la plaque et le code. Utilise les commandes de démonstration pour simuler l’arrivée, le départ et la fin.
6. Note la course et retrouve-la dans **Activités**.
7. Dans **Compte**, change de rôle pour tester le conducteur. Active la disponibilité ; une demande fictive apparaît. Après acceptation, le code du passager fictif est **4826**.

## 2. Installer une build de développement sur l’iPhone

**Cette étape est facultative et peut attendre.** Le test précédent fonctionne dans Expo Go avec le SDK 57. Pour une application Pepo indépendante, Google Maps natif sur iPhone et la publication future, utilise une **build de développement Pepo**.

Tu peux préparer et lancer la build depuis Windows : EAS compile iOS dans le cloud. Il te faut un compte Expo et, pour installer une build signée sur ton iPhone physique, un compte Apple Developer approprié. Le projet ne contient pas tes identifiants ni un binaire iOS signé.

```powershell
npx expo install expo-dev-client
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile development
```

- `init` relie Pepo à ton projet Expo. Si EAS ne peut pas modifier `app.config.ts` automatiquement, conserve l’identifiant affiché et ajoute `EAS_PROJECT_ID=identifiant_du_projet` dans `.env` ; cette édition lit ce champ. Ajoute aussi cette variable à l’environnement EAS de la build.
- `device:create` enregistre ton iPhone pour la distribution interne. Suis le lien affiché sur l’iPhone.
- La build demandera les informations de signature. À la fin, ouvre le lien d’installation sur l’iPhone.
- Installe et ouvre **Pepo**, puis lance le serveur Expo sur le PC :

```powershell
npx expo start --dev-client --lan
```

Le PC et l’iPhone doivent être sur le même Wi-Fi. Autorise Expo / Node sur le réseau **privé** dans le pare-feu Windows si nécessaire. Scanne le QR code avec l’appareil photo puis ouvre Pepo. Si le réseau bloque la connexion Metro :

```powershell
npx expo start --dev-client --tunnel
```

Le tunnel Expo concerne Metro. Il **n’expose pas automatiquement ton serveur API**.

## 3. Google Maps sur iPhone

**Pour la carte Google dans Expo Go, commence par [GOOGLE-MAPS.md](GOOGLE-MAPS.md).** Elle fonctionne dans la WebView intégrée, sans compte Apple Developer. La suite concerne uniquement le futur SDK Google natif dans une build indépendante.

Crée un projet Google Cloud avec la facturation requise. Active **Maps SDK for iOS**. Crée une clé limitée au bundle iOS `app.pepo.mobility` et à cette API. Copie `.env.example` vers `.env` puis renseigne :

```dotenv
EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY=ta_cle_ios_restreinte
```

Pour EAS, ajoute cette variable aussi à l’environnement du projet Expo avant la build. Les clés Maps SDK embarquées sont publiques : leurs restrictions sont indispensables. Les secrets SMS, `ADMIN_TOKEN` et la clé Google Routes serveur restent exclusivement sur le serveur.

Reconstruis ensuite l’application iOS. Changer une clé native ou un plugin requiert une nouvelle build ; relancer Metro ne suffit pas.

- Dans une build iPhone avec clé : **Google Maps**, style clair Pepo, ligne continue.
- Sur iOS sans clé Google : carte Apple disponible en secours ; le style Google personnalisé ne s’applique pas à Apple Maps.
- Sur Android sans clé dans une build : carte démo explicite pour éviter une carte Google vide.
- Sur le web sans clé : carte démo explicite.

Pour les itinéraires routiers réels et la recherche Google, configure aussi le **serveur** : [MODE-CONNECTE.md](MODE-CONNECTE.md).

## 4. En cas de problème

| Symptôme                    | Action                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm` introuvable           | Réinstaller Node.js 24 et rouvrir PowerShell.                                                      |
| Dépendances incohérentes    | `npm ci`, puis `npx expo-doctor`.                                                                  |
| Ancien contenu              | Arrêter Metro, puis `npx expo start --go --lan --clear`.                                           |
| Expo Go refuse le SDK       | Vérifier que cette édition est ouverte : `expo` version 57 dans `package.json`, puis `npm.cmd ci`. |
| QR code inaccessible        | Même Wi-Fi, réseau privé, pare-feu ; essayer le tunnel Metro.                                      |
| L’iPhone ne joint pas l’API | L’URL API doit utiliser l’IP du PC, jamais `localhost`.                                            |
| Carte Google vide           | Vérifier clé, API activée, restrictions bundle, facturation et refaire la build.                   |
| GPS hors ville              | Choisir la bonne ville dans Compte ou un repère de départ.                                         |
| Photos refusées             | Autoriser la caméra / photothèque dans les réglages iPhone.                                        |

## Références officielles vérifiées pour cette livraison

- Compatibilité Expo Go : https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/
- Carte SDK 57 : https://docs.expo.dev/versions/v57.0.0/sdk/map-view/
- Build iPhone physique : https://docs.expo.dev/get-started/set-up-your-environment/?device=physical&mode=development-build&platform=ios
- EAS Build : https://docs.expo.dev/build/introduction/
- Google Maps dans React Native Maps : https://docs.expo.dev/versions/latest/sdk/map-view/

Les commandes de build sont fournies pour ton environnement. Aucun compte Apple/Expo n’a été connecté et aucune build native n’a été soumise pendant cette livraison.
