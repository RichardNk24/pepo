# Paiements et retour au compte

## Objectif et périmètre

Priorité P1 pour rendre les réglages de paiement compréhensibles : un seul numéro à saisir, reconnaissance du réseau et une sortie visible depuis Sécurité et assistance. Le défaut du bouton carte et le retour difficile ont été signalés par Richard ; leur fréquence globale n'est pas mesurée.

Livré : enregistrement des numéros, contrôles client/API et interface Rider. Partiel : le bouton carte répond et explique la disponibilité réelle. Dépendant d'un prestataire : encaissement Mobile Money et enregistrement/paiement d'une carte. Aucun paiement réel n'est ajouté par ce correctif.

## Installation Windows

Extraire `Pepo-Paiements-Compte.zip`. Arrêter l'API et Expo avec Ctrl+C. Dans PowerShell à la racine du projet existant (le dossier qui contient `apps` et `packages`) :

```powershell
$patch = Read-Host "Chemin du dossier extrait contenant installer.cjs"
node (Join-Path $patch "installer.cjs") .
```

L'installateur compare les sources attendues avant toute modification et sauvegarde les fichiers remplacés. Il est réexécutable. En cas de conflit, transmettre le message et conserver le fichier : ne pas le renommer/supprimer pour contourner la vérification. Aucun `.env`, secret, base, catalogue ou asset existant n'est remplacé. Les sources cartographiques et vocales ne sont pas modifiées. Aucun ajout de dépendance ni nouvelle build native nécessaire.

### Tes trois logos

Copier tes PNG transparents d'origine ici, avec ces noms exacts :

```text
apps/rider/assets/payments/airtel-money-logo.png
apps/rider/assets/payments/m-pesa-logo.png
apps/rider/assets/payments/orange-money-logo.png
```

Les fichiers présents sont conservés par l'installateur. S'ils manquent, le correctif fournit de minuscules PNG transparents de secours : l'interface affiche alors le nom du réseau. Ce ne sont pas des logos officiels. Remplacer ces fichiers de secours par tes trois images pour voir tes logos. Le composant préserve les proportions et ajoute un fond blanc pour Airtel/M-Pesa, noir pour Orange ; aucun changement de fond du PNG n'est nécessaire.

Relancer dans deux terminaux :

```powershell
npm run api
```

```powershell
npm exec --workspace=@pepo/rider -- expo start --go --clear
```

Si tu utilises une application de développement installée, remplacer `--go` par `--dev-client`. Conserver les URLs et clés actuelles dans les `.env`.

## Comportement

- Dans Compte > Mes paiements > Ajouter un numéro : un seul champ, réseau affiché pendant la saisie, puis Enregistrer ce numéro. Pas de sélection manuelle du réseau.
- Numéros RDC acceptés en format local `099 123 4567`, national `991234567`, international `+243 99 123 4567` ou `00243…`. Stockage canonique en `+243…`.
- Airtel : 097/098/099 ; M-Pesa : 081/082/083 ; Orange : 080/084/085/089. Le préfixe propose le réseau ; il ne prouve pas l'existence du portefeuille ou la propriété du numéro.
- Deux numéros maximum par réseau, doublons refusés et numéro complet exigé. Ces règles sont contrôlées par l'API, pas seulement par le bouton.
- Aucun nouvel Afri Money proposé. Les anciennes données sont conservées et supprimables ; un ancien numéro Afri s'affiche comme « Ancien numéro enregistré ». Une ancienne incohérence réseau/préfixe ou un ancien dépassement ne supprime pas les données restantes.
- Suppression avec confirmation dans le même panneau. Les erreurs restent visibles dans ce panneau.
- Visa/Mastercard sont présentées par un visuel de carte. Ajouter une carte ouvre une vue avec retour dans le panneau, au lieu d'une seconde alerte masquée derrière la fenêtre.
- Sécurité et assistance s'ouvre comme Besoin d'aide, en modal de navigation avec flèche Retour. Le retour conserve la page Compte précédente.
- Les nouvelles clés de texte existent en français, anglais, swahili et lingala. Une relecture par des locuteurs reste à faire.

## Cartes et paiements réels

L'API actuelle annonce `card.enabled=false` et `mobileMoney.enabled=false`. Les numéros sont enregistrés dans le profil ; ils ne constituent pas une autorisation de débit. Le bouton carte est maintenant réactif, mais aucune carte n'est enregistrée.

Il faut choisir/configurer le prestataire disponible pour l'entité marchande en RDC afin d'activer un vrai parcours carte. Utiliser sa tokenisation/son interface de paiement, puis confirmer côté serveur et traiter les webhooks de façon idempotente. Ce raccordement n'est pas livré. Aucun numéro de carte, CVV ou identifiant PayPal n'est demandé, stocké ou envoyé par ce correctif. Le champ de profil refuse les données de carte.

## Architecture et données

La reconnaissance et les limites résident dans `packages/utils/src/mobileMoney.ts`, fonction pure partagée entre Rider et API. Les mises à jour gardent le contrat de profil authentifié existant. Pas de migration, nouveaux journaux de numéros, appel IA ou appel à un opérateur. Les numéros restent dans le stockage de profil existant et peuvent être supprimés par leur propriétaire. L'accès et la conservation suivent le profil existant ; aucun nouveau chiffrement au repos n'est livré.

## Vérification

- `npm run check` : typechecks, frontières/assets, lint et 163 tests passent. Couverture ajoutée pour formats, préfixes, limites, doublons, réseau incohérent, retrait, données historiques et refus d'Afri côté serveur.
- Build API et exports Rider web/iOS réussis.
- Parcours web démo vérifiés dans Chromium, écran de 390 px : détection/sauvegarde, refus du troisième numéro, suppression, ouverture carte et retour Sécurité > Compte. Aucune erreur JavaScript. Cette recette ne remplace pas un essai iOS/Android ni un paiement réel.
- Le contrôle de l'installateur vérifie installation, seconde exécution sans changement, conservation des vrais PNG/.env et refus d'un conflit avant toute écriture.
- Recette téléphone à effectuer : saisie avec le clavier iOS/Android, deux numéros de chaque réseau, refus du troisième, suppression puis nouvel ajout, logos réels, bouton carte et retour Sécurité > Compte. Aucun encaissement réel ni tokenisation carte testé.

Mesure de succès au pilote : numéro correct enregistré sans choisir un réseau, aucun doublon ou troisième numéro accepté, retour au compte en un geste, aucun bouton silencieux. Latence et compréhension terrain ne sont pas encore mesurées.
