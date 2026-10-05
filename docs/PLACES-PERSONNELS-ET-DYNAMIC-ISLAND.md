# Lieux personnels et Dynamic Island

## Suggestions de destinations

Dans une recherche de destination connectée, Pepo affiche désormais les lieux enregistrés, les destinations suggérées à partir des courses terminées et les destinations récentes. L’utilisateur peut enregistrer un résultat comme maison, travail, école, hôpital ou favori, puis le retirer. Les lieux enregistrés restent privés au compte. Le réglage des suggestions personnalisées peut être désactivé depuis le même écran.

L’algorithme reste côté API : il classe un maximum de trois destinations répétées selon l’heure et le jour, et cinq lieux récents. Les courses de démonstration ne sont pas utilisées. Deux courses terminées vers un même lieu sont nécessaires pour une suggestion récurrente. Une sélection depuis la liste ou la carte n’est jamais enregistrée comme course terminée avant confirmation et fin réelles de la course.

## Dynamic Island et Live Activity

Rider utilise `expo-widgets` avec Expo SDK 57. Une activité commence quand une course passager passe à `searching`, puis suit les états `accepted`, `arrived` et `in_progress`. Elle se ferme après une annulation ou une arrivée. L’écran verrouillé et la Dynamic Island affichent uniquement l’état, la catégorie de véhicule et une consigne d’ouverture de Pepo. Ils n’affichent ni destination exacte, ni plaque, ni nom ou numéro du conducteur, ni code PIN.

Les mises à jour locales suivent les changements d’état reçus par Rider. Le serveur peut ensuite pousser les mêmes changements par APNs, même lorsque l’app est suspendue. Il ne pousse pas une position GPS par seconde et n’affiche pas de délai d’arrivée inventé : l’API actuelle ne fournit pas encore d’ETA chauffeur fiable.

### Activation iOS

1. Installer l’application Rider en build de développement, pas dans Expo Go. Depuis `apps/rider` :

   ```powershell
   npx eas-cli build --profile development --platform ios
   ```

2. Installer cette build sur l’iPhone, ouvrir une session passager réelle, puis réserver une course de test. La Live Activity apparaît sur l’écran verrouillé et la Dynamic Island des iPhone compatibles. Une course en mode Démo ne la déclenche pas.

3. Pour tester les actualisations APNs en arrière-plan, activer les notifications Live Activities pour l’identifiant `app.pepo.mobility` dans Apple Developer, puis renseigner les variables ci-dessous côté API. Les variables de production doivent être des secrets du serveur, jamais des variables `EXPO_PUBLIC_`.

   ```dotenv
   APNS_TEAM_ID=VOTRE_TEAM_ID
   APNS_KEY_ID=VOTRE_KEY_ID
   APNS_PRIVATE_KEY_PATH=C:/chemin-prive/AuthKey_XXXXXXXXXX.p8
   APNS_ENVIRONMENT=sandbox
   APNS_BUNDLE_ID=app.pepo.mobility
   ```

   `sandbox` correspond aux builds de développement; choisir `production` pour une build App Store. Garder la clé `.p8` hors du dépôt et hors des archives partagées. L’API enregistre uniquement le token lié à la course et au passager, remplace un token renouvelé, puis le supprime à la fin de la course.

### Vérifications réalisées et limites

Les tests API vérifient que seul le passager propriétaire d’une course active peut enregistrer ou révoquer un token, et rejettent les tokens ou langues invalides. Le code TypeScript couvre le pont Rider, l’API et les packages. Il reste à générer et installer une build iOS signée, à vérifier la présentation sur l’iPhone 14 Pro et à configurer APNs pour tester une mise à jour app suspendue. La Dynamic Island n’est pas disponible dans Expo Go.
