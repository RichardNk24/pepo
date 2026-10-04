> Document conservé de la version précédente. Pour les commandes et chemins du monorepo, consultez [README.md](../README.md).

# Deux appareils, un vrai serveur

## A. Un pilote local sans SMS réel

Le mode connecté utilise de vrais comptes persistés et des échanges entre appareils. Pour tester sans envoyer de SMS, il dispose d’un mode de développement explicite. Ce mode ne prouve pas la possession du numéro de téléphone.

### 1. Configuration du serveur

```powershell
Copy-Item .\server\.env.example .\server\.env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copie le secret généré dans `ADMIN_TOKEN`. Génère un **deuxième** secret indépendant pour `STORAGE_KEY` (64 caractères hexadécimaux). Garde `DEV_AUTH=true` et `NODE_ENV=development` pour ce test local. Si `STORAGE_KEY` n’est pas défini en développement, le serveur génère et conserve une clé privée dans `apps/api/data/storage.key`.

Trouve l’adresse Wi-Fi du PC avec `ipconfig`. Remplace l’exemple de `PUBLIC_URL` par cette IP, par exemple `http://192.168.1.42:4000`. Le serveur écoute sur le port 4000.

```powershell
npm run server
```

Ouvre `http://localhost:4000/health`. Le résultat doit indiquer `ok: true`. N’ouvre l’accès au port 4000 que sur le réseau privé de test.

### 2. Configuration de l’app

Copie `.env.example` vers `.env`, puis :

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.42:4000
EXPO_PUBLIC_DEV_AUTH=true
```

Redémarre Metro avec `npx.cmd expo start --go --lan` pour charger les nouvelles variables dans Expo Go SDK 57. Inscris le passager sur un appareil et le conducteur sur l’autre avec **des numéros différents**. Les codes de développement s’affichent dans l’app et aucun SMS n’est envoyé. Les téléphones de ces comptes sont marqués non confirmés sur le serveur.

### 3. Approuver un conducteur de test

Sur le compte conducteur, ouvre **Compte → Vérification du conducteur**, enregistre le véhicule et dépose quatre images **fictives** pour les tests. Le serveur chiffre les fichiers et met le dossier en attente. N’importe quel dépôt ou changement de véhicule retire l’approbation antérieure.

Sur le PC, ouvre `http://localhost:4000/admin/`. Entre le secret `ADMIN_TOKEN`. Examine les quatre pièces puis approuve le dossier de test. L’app récupère le nouveau statut ; le conducteur peut passer en ligne.

Le conducteur reçoit les demandes de **sa ville** et du **type de véhicule enregistré**. Par exemple, un conducteur `Moto` ne reçoit pas une demande `Taxi`. Dans cette version, « proximité » correspond à la ville et à la disponibilité ; le classement par distance GPS reste une évolution du dispatch.

### 4. Essai complet entre comptes

1. Le passager choisit les lieux et envoie son prix.
2. Le conducteur accepte ce prix ou propose un autre montant.
3. Le passager peut faire une contre-offre ; le conducteur peut l’accepter.
4. Le passager choisit une offre. Le prix final et le conducteur sont attribués atomiquement.
5. Le conducteur confirme son arrivée.
6. Le passager donne le code affiché **après** avoir comparé le visage, le véhicule et la plaque.
7. Le conducteur saisit ce code. Cinq erreurs bloquent le départ ; il faut annuler cette course et contacter l’équipe.
8. Le conducteur démarre et termine la course. Le passager peut donner une note.

Les messages circulent entre ces deux comptes. Le conducteur ne reçoit jamais le code de départ via l’API. Les courses, messages et signalements restent en base après redémarrage du serveur.

## B. Google Maps et itinéraires

Pour la carte Google dans Expo Go, suis [GOOGLE-MAPS.md](GOOGLE-MAPS.md). Le serveur sert la page Google et ses itinéraires même pendant un test de réservation démo.

Utilise des clés distinctes et restreintes :

| Variable                              | Côté                           | Service / restriction                                           |
| ------------------------------------- | ------------------------------ | --------------------------------------------------------------- |
| `EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY`     | Build mobile                   | Maps SDK for iOS, bundle `app.pepo.mobility`                    |
| `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` | Build mobile                   | Maps SDK for Android, package + SHA-1 de signature              |
| `EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY`     | Web                            | Maps JavaScript API, référents HTTP autorisés                   |
| `GOOGLE_MAPS_WEB_KEY`                 | Serveur, clé publique de rendu | Maps JavaScript API, référents de la page `/maps/mobile`        |
| `GOOGLE_MAPS_SERVER_KEY`              | Serveur seulement              | Routes API + Places API (New) + Geocoding, IP serveur autorisée |

Le serveur appelle Google **Routes API v2** et **Places Text Search (New)**. Il recalcule l’itinéraire au moment de la réservation : il n’accepte pas un prix de référence ou une distance arbitraire fournis par l’app. La polyline est dessinée **en ligne continue**, avec extrémités et jointures arrondies sur la carte native.

Sans clé serveur, les repères et routes sont **indicatifs**, signalés comme tels. Une erreur Google configuré affiche une erreur et ne passe pas silencieusement à une fausse route réelle. Le calcul Google utilise le mode **DRIVE** ; il faut valider la couverture et les règles locales pour les motos avant tout lancement opérationnel. Ce produit ne promet pas une navigation moto spécialisée.

Références : https://developers.google.com/maps/documentation/routes/compute_route_directions et https://developers.google.com/maps/documentation/places/web-service/text-search

## C. SMS réel et serveur hébergé

Configure Twilio ou remplace l’adaptateur `sendSms` par un fournisseur local accepté par ton opérateur. Les identifiants restent dans `apps/api/.env` :

```dotenv
DEV_AUTH=false
NODE_ENV=production
PUBLIC_URL=https://ton-domaine-api.example
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=...
ADMIN_TOKEN=secret_independant
STORAGE_KEY=64_caracteres_hexadecimaux
```

La livraison contient l’adaptateur HTTP Twilio, mais aucun envoi réel n’a été effectué. Il faut tester la livraison SMS en RDC avec ton compte fournisseur et les conditions applicables. Le serveur refuse `DEV_AUTH=true` en production et requiert les secrets et une URL HTTPS. Utilise une **nouvelle base de production** ; ne recycle pas les sessions ni les comptes de développement.

En production, `EXPO_PUBLIC_DEV_AUTH=false` et `EXPO_PUBLIC_API_URL` pointe vers cette API HTTPS. Configure `CORS_ORIGINS` avec les origines web effectivement utilisées. Les apps natives n’utilisent pas CORS comme un navigateur.

### Hébergement fourni

```powershell
npm run build:server
npm run server:production
```

Un `Dockerfile` et `compose.yaml` sont inclus pour un serveur pilote à une seule instance. Configure `apps/api/.env` avant `docker compose up --build -d`. Place un reverse proxy HTTPS devant l’API et protège `/admin` aussi au niveau réseau. Sauvegarde **la base SQLite et la clé de chiffrement** ensemble, sans exposer les documents. Le conteneur n’a pas été construit dans l’environnement de cette livraison.

## D. Ce qui exige un fournisseur ou un développement complémentaire

- **Mobile Money** : pas de connecteur Airtel / M-Pesa / Orange livré ; le paiement disponible est en espèces.
- **SOS opérationnel** : pas de centre de surveillance ni d’alerte automatique aux secours. Les boutons ouvrent un appel / SMS choisi et les signalements sont enregistrés.
- **Arrière-plan** : le suivi GPS fonctionne quand l’app conducteur est ouverte et autorisée. Pas de notifications push ni de suivi garanti après verrouillage de l’écran.
- **Identité** : revue humaine des quatre pièces, pas d’authentification biométrique, de preuve de vie ou de contrôle automatisé des registres. Les passagers sont identifiés par compte et téléphone confirmé par SMS ; leur identité légale n’est pas vérifiée dans ce MVP.
- **Hors smartphone / USSD / langues supplémentaires** : architecture prévue pour de nouveaux canaux, mais aucun canal USSD ou appel vocal automatisé n’est implémenté.

La documentation [ARCHITECTURE-ET-PILOTE.md](ARCHITECTURE-ET-PILOTE.md) décrit les évolutions nécessaires pour grandir au-delà de ce pilote.
