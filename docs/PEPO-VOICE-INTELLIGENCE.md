# Pepo Voice Intelligence — pilote v1

Ce correctif étend le projet avec la sécurité de nuit déjà intégrée. Il n’écrase pas les `.env`, images, clés, données ni les habitudes des utilisateurs. Il n’effectue aucun déploiement.

## Installer sous Windows

Arrêter Expo et l’API avec Ctrl+C. Extraire l’archive. Dans le dossier extrait contenant `installer.cjs` :

```powershell
node .\installer.cjs --project="C:\Users\Guest-PC\Documents\Pepo-monorepo\pepo" --check
node .\installer.cjs --project="C:\Users\Guest-PC\Documents\Pepo-monorepo\pepo"
cd "C:\Users\Guest-PC\Documents\Pepo-monorepo\pepo"
npm install
npm run check
```

L’installateur compare toutes les sources avant de modifier le projet, conserve les octets originaux dans `pepo-patch-backups/Pepo-Voice-Intelligence-…` et permet une restauration. Une seconde installation est sans effet. S’il indique « version locale différente », ne supprimer aucun fichier : comparer la version locale au correctif. Ce patch cible le dernier projet fourni avec le correctif Sécurité Nuit, pas une autre copie historique.

Démarrer l’API dans un terminal :

```powershell
npm run api
```

Dans un autre terminal :

```powershell
npm run start -w @pepo/rider -- --clear
```

Conserver l’URL IP actuelle de l’API dans `apps/rider/.env` et `apps/driver/.env`. Le port API reste 4000. Scanner dans Expo Go pour ce pilote ; aucun compte Apple Developer payant n’est nécessaire pour ces écrans. Les Live Activities restent une fonctionnalité native distincte.

## Tester sur un seul iPhone

1. Se connecter au vrai compte Rider, hors démo. Ouvrir **Mon compte → Voix et navigation**.
2. Sélectionner Français ou English. La langue de l’interface ne change pas. Choisir seulement une voix effectivement proposée par le téléphone. Désactiver le mode silencieux, monter le volume, toucher « Tester la prononciation ».
3. Ouvrir **Pepo Voice Intelligence Lab**. Ce lien et cet écran sont réservés aux sessions de développement.
4. Toucher Parler, dire une destination puis Terminer. Les niveaux indiquent la capture ; la transcription serveur s’affiche dans le champ après la capture et le traitement. Elle n’est pas diffusée en continu. Une recherche démarre sans bouton « comprendre » ; choisir explicitement le bon établissement. Aucune course n’est réservée dans le Lab.
5. Tester « Je vais au marché Kenya », « Nipeleke Hôtel Pullman » en profil Swahili et une phrase naturelle en Lingala, avec leur profil respectif. Vérifier réellement les noms et les branches proposés. Les capacités annoncées ne constituent pas une validation de transcription locale.
6. Tester A, B, C, F puis « Écouter cette simulation ». C comporte un repère fictif clairement étiqueté ; F doit suspendre le guidage. D présente une entrée distincte du centre du bâtiment ; E utilise une séquence fictive vérifiée et le résolveur de parcelles ; ces deux scénarios ne sont pas un accès automatique à un bâtiment réel.
7. Pendant une lecture, changer de profil, choisir G ou arrêter la voix : l’ancien audio doit être interrompu. G invalide la lecture ; les tests automatisés vérifient aussi une réponse tardive sur une ancienne route.
8. « Simuler sans réseau » désactive la recherche et le micro serveur dans le Lab. Cela ne coupe pas physiquement Internet et ne démontre pas à lui seul une voix hors ligne. Tester ensuite les simulations en mode avion pour vérifier la voix installée sur cet iPhone ; sans voix locale disponible, Pepo garde le texte.

Dans le navigateur, le micro du Lab utilise les capacités de reconnaissance du navigateur, différentes du recorder natif et d’OpenAI. Le test sur iPhone est donc nécessaire pour valider l’envoi audio réel, les permissions, le mode silencieux, le bruit et les latences.

## Guidage réel dans Driver

Démarrer Driver avec `npm run web -w @pepo/driver -- --clear` sur le laptop, ou `npm run start -w @pepo/driver -- --clear` pour Expo Go. Dans une course attribuée et active, le nouveau panneau **Guidage Pepo** utilise les étapes Google du trajet. Vers le pickup, une demande explicite calcule le trajet depuis un GPS récent ; en course, les étapes déjà enregistrées sont réutilisées. Les anciens trajets sans étapes ne donnent pas de directions inventées : utiliser Google Maps ou créer un nouveau trajet.

Activer les annonces dans les réglages puis démarrer le guidage. Le GPS doit avoir moins de 15 secondes et une précision de 35 m ou meilleure. Les annonces sont préparées à partir de la distance **le long** de la route, de la vitesse GPS lorsqu’elle est disponible, du type de manœuvre et des repères vérifiés. Une préparation puis un rappel sont possibles, sans répétition incessante. Le bouton Répéter et les commandes « répète » / « repeat » / « rudia » sont prévus. Le micro partagé transmet aussi les commandes de course existantes, avec leurs confirmations et le PIN conservés.

Le guidage Pepo de ce pilote fonctionne **au premier plan**. Il s’arrête en arrière-plan ; il ne promet pas du GPS ou du son en continu lorsque iOS suspend Expo Go. Le bouton Google Maps existant reste disponible pour une navigation externe. Une sortie de route suspend les annonces : ce pilote ne possède pas de moteur de recalcul hors ligne et ne lance pas de boucle de recalcul payante.

## Couverture linguistique réelle

| Profil | Transcription native | Navigation parlée de ce pilote |
|---|---|---|
| Français RDC | Adaptateur OpenAI existant | Formulations déterministes et texte Google français ; voix système requise |
| English | Même adaptateur | Manœuvres simples ; pas de sortie de rond-point traduite ou inventée |
| Swahili Grand Katanga | Test terrain, qualité locale non mesurée | Aperçus de phrases seulement, non validés par des locuteurs locaux |
| Lingala Kinshasa | Expérimental, qualité locale non mesurée | Aperçus de phrases seulement, non validés par des locuteurs locaux |
| Tshiluba | Désactivé par défaut | En préparation |
| Kikongo | Désactivé par défaut | En préparation, distinct du kituba |
| Kituba / Kikongo ya leta | Désactivé par défaut | En préparation, distinct du kikongo |

Six groupes linguistiques donnent sept profils afin de distinguer les variétés kongo. L’interface conserve ses quatre langues existantes. Aucune voix locale naturelle n’est fournie ou prétendue validée. Un profil ne remplace jamais silencieusement une voix manquante par une autre langue.

La clé `OPENAI_API_KEY` reste uniquement dans `apps/api/.env`. Le chemin existant utilise `PEPO_VOICE_ENABLED=true` (ou son ancien fallback `PEPO_AI_PLACES_ENABLED`) et `PEPO_VOICE_DAILY_CALL_LIMIT`. Le fournisseur est isolé dans `apps/api/src/voice/providers.ts`. Les limites, authentification, suppression du buffer et absence de relance automatique sont conservées. Ne pas activer `PEPO_VOICE_EXPERIMENTAL_LANGUAGES=true` pour des utilisateurs avant une campagne de tests : ce drapeau ne crée aucune compétence linguistique.

## Repères réels et revue interne

Aucun PetroCIL, portail ou point de parcelle fictif n’est ajouté au catalogue réel. La nouvelle table SQLite `voice_geo` est créée automatiquement au démarrage. Les suggestions personnelles et lieux sauvegardés restent dans leurs mécanismes existants.

API authentifiée :

- `GET /api/voice/capabilities` : capacités et absence de mesure terrain explicites.
- `GET /api/voice/landmarks?city=lubumbashi` : uniquement les repères vérifiés et encore valides.
- `POST /api/voice/landmarks/contributions` : proposition dans la ville de l’acteur, état `pending`, aucun droit de s’auto-valider.
- `GET /api/admin/voice-landmarks` : liste interne protégée par l’authentification admin existante.
- `POST /api/admin/voice-landmarks/:id/review` : validation/rejet terrain, visibilité et sens d’approche obligatoires pour approuver.
- `POST /api/trips/:id/voice-navigation` : réservé au chauffeur attribué à une course active, GPS récent.

Une contribution contient `name`, `city`, `latitude`, `longitude`, `kind`, `aliases` et une `source` de collecte réelle. Types : fuel, market, school, hospital, pharmacy, roundabout, bridge, intersection, building, entrance, pickup, transfer, parcel. Une entrée distingue `access: vehicle|pedestrian`, `parentId`, éventuellement `allowedVehicles`. La revue ajoute `validatedAt`, `expiresAt` (180 jours), `reliability` et `visibility: {day,night,bearing,tolerance}`. Le bearing est le sens d’approche depuis lequel la visibilité a été constatée, pas une orientation devinée.

Exemple de **structure à compléter après collecte**, pas des coordonnées réelles à importer :

```json
{"name":"Nom constaté sur place","city":"lubumbashi","latitude":-11.0,"longitude":27.0,"kind":"fuel","aliases":[],"source":"Référence de fiche terrain et autorisation de réutilisation"}
```

Ces coordonnées illustratives ne sont pas une station ; l’API vérifie les limites de ville. Envoyer uniquement une position effectivement relevée. Ne pas publier un domicile privé ou un repère sans droit de réutilisation. La revue est pour l’instant une **API interne**, pas un nouvel écran admin.

Le résolveur refuse les repères anciens, sans source, invisibles la nuit, sur une branche incorrecte, sur une boucle ambiguë ou accessibles seulement aux piétons pour une entrée véhicule. La phrase « juste après » exige un repère sur le tronçon d’approche avant le virage. Il ne déduit pas automatiquement « derrière » ou « troisième parcelle » dans les destinations ; ces demandes restent à confirmer par un point exact.

Le résolveur pur de parcelles exige une séquence ordonnée complète, un tronçon, un sens, une ancre et une revue. L’API refuse l’approbation isolée d’une parcelle. Le workflow de validation de séquences complètes et la production d’annonces de parcelles sur trajets réels restent une étape suivante. D et E sont des tests de données/résolution, pas une fonctionnalité réelle déjà déployée.

## Coût, cache et hors ligne

Le moteur de manœuvres n’appelle aucun LLM ni fournisseur réseau : **0 token LLM pour une annonce ordinaire**. La transcription audio réelle reste un appel STT facturable ; la préparation du trajet utilise Google selon sa tarification. Le Lab n’active pas l’IA générative pour ses recherches. La recherche Rider conserve le pipeline existant.

Le lecteur conserve au maximum 64 formulations **texte** en mémoire. Il n’existe pas encore de cache audio synthétisé livré. `voicePacks.ts` fournit le contrat d’un pack versionné/revu et le lecteur vérifiant phrase complète, langue, URI locale et checksum via un port. Il n’est pas encore branché à un téléchargement/stockage natif ni à une collection d’enregistrements livrés. Aucune concaténation de fragments ne doit fabriquer un virage. Les prochaines étapes requièrent de vrais enregistrements de locuteurs et une implémentation du port natif.

Le trajet préparé reste en mémoire durant la session de guidage, pas sur disque pour un redémarrage hors ligne. Une voix système téléchargée peut fonctionner hors ligne, selon l’appareil ; tester et ne pas l’afficher comme garantie. Aucun moteur cartographique local n’est ajouté.

## Mesurer avant d’activer SW/LN pour la conduite

Le script local accepte un corpus JSONL de références et résultats **déjà collectés avec consentement**, sans envoyer d’audio ni de position :

```powershell
node --import tsx scripts/evaluate-voice-corpus.ts "C:\chemin\corpus.jsonl"
```

Une ligne :

```json
{"profile":"sw-CD-katanga","expectedText":"Phrase relue par un locuteur","transcript":"Résultat réellement observé","latencyMs":1600,"expectedPlaceId":"identifiant vérifié","predictedPlaceId":"identifiant effectivement choisi"}
```

Le rapport mesure WER, précision du choix de lieu, latence p50/p95, avec nombre d’échantillons par profil. Une destination sans choix correct compte comme erreur. Les latences manquantes ne sont pas inventées. Ne pas confondre les fixtures automatisées avec des résultats de terrain. Le WER seul ne suffit pas : vérifier les erreurs de noms propres, variantes mixtes, accents, bruit et mauvaises branches. `telemetry.ts` propose un buffer borné de métriques sans audio/GPS ; aucune télémétrie distante n’est activée.

Comparer au minimum OpenAI (adaptateur conservé), Google Cloud Speech et Azure sur **le même corpus local**, avant de choisir un gagnant. Aucun appel payant ni benchmark avec des locuteurs congolais n’a été exécuté pour ce correctif.

Sources techniques officielles consultées le 9 octobre 2026 :
- https://developers.openai.com/api/docs/guides/speech-to-text
- https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages
- https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support
- https://docs.expo.dev/versions/v57.0.0/sdk/speech/
- https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes

Google Cloud Speech documente des modèles/langues swahili et lingala ; cela ne valide pas automatiquement l’accent katangais. Azure documente notamment des locales swahili KE/TZ ; cela ne démontre pas une couverture lingala. La clé Google Maps n’active pas à elle seule Cloud Speech. L’interface fournisseur permet d’ajouter un adaptateur après mesure ; seul l’adaptateur OpenAI est branché ici.

## Validation et limites

Lire `docs/VALIDATION-PEPO-VOICE.md` pour les vérifications effectivement exécutées. Restent à réaliser : essais physiques iPhone/Android, sortie réelle avec GPS, interruption/appels et bruit, revue des phrases SW/LN, collecte d’entrées légales et visibles, packs audio locaux, revue de séquences de parcelles, support natif en arrière-plan. Ce pilote est une base opérationnelle progressive, pas une promesse de navigation sûre dans les six langues dès aujourd’hui.
