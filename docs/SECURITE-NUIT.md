# Pepo la nuit — module pilote 1.0

Ce module ajoute des contrôles exécutés par le serveur, un suivi explicable et une aide privée pour le passager et le conducteur. Il n’utilise aucun appel OpenAI sur le chemin de sécurité. Une règle produit une vérification ou un dossier à examiner, pas un verdict de danger. Il ne garantit pas l’absence d’incident.

## Ce qui fonctionne

- Heure locale calculée sur le serveur : `Africa/Lubumbashi` pour Lubumbashi/Kolwezi, `Africa/Kinshasa` pour Kinshasa. Le téléphone ne choisit pas le mode. Jour 06h–18h, nuit 18h–22h et 05h–06h, nuit renforcée 22h–05h. Une course attribuée garde le niveau le plus exigeant observé jusqu’à sa fin.
- La nuit, offres, contre-offres acceptées, attribution et démarrage nécessitent une autorisation administrative valide, une identité approuvée et les quatre pièces du dossier. La note et les habitudes personnelles ne servent pas à autoriser une course. En production, le téléphone du conducteur doit aussi être vérifié par SMS. `DEV_AUTH=true` est réservé aux tests.
- L’autorisation dure 7 jours depuis le bouton admin, au maximum 30 jours depuis l’API. Elle est liée à la ville, au véhicule et aux dates des pièces contrôlées. Modifier ces données invalide l’autorisation. Elle ne remplace pas la vérification humaine des originaux ou leur validité juridique.
- GPS datant de moins de 45 secondes, reçu récemment, précision déclarée ≤80 m. Une arrivée ou un départ nocturne nécessite une position à moins de 200 m du départ convenu. Le PIN serveur reste obligatoire, privé au passager, limité à 5 essais. Il n’est pas inclus dans les données de sécurité ni les Live Activities.
- Une perte de réseau n’autorise aucun contournement du PIN ou du GPS. Le conducteur peut actualiser le GPS ou annuler avant le départ. Retirer une autorisation n’arrête pas arbitrairement une course déjà commencée.
- GPS chauffeur envoyé quand son application est ouverte : fixes de course espacés d’au moins 5 secondes, rafraîchissement au premier plan environ toutes les 20 secondes. Le serveur conserve les dates de capture et de réception. Une discussion ou un changement de statut ne rafraîchit pas la date du GPS.
- Arrêt durable et écart durable : question indépendante « Tout va bien ? » pour chacun des deux comptes connectés. Pour une réservation pour un proche, le contrôle passager est adressé à l’auteur de la réservation ; l’invité sans application ne reçoit pas de contrôle. L’admin peut voir son contact pour la prise en charge. Les réponses et demandes d’aide ne sont pas communiquées à l’autre participant. Pas de sanction automatique. Les GPS imprécis, ruptures de continuité et sauts isolés ne constituent pas une preuve d’écart.
- L’écart est comparé aux segments d’une route Google. Il n’est pas détecté contre un tracé estimé en ligne droite. Un arrêt proche de la destination ou d’une étape prévue ne déclenche pas le contrôle d’arrêt.
- « Contrôle / barrage », circulation, véhicule ou autre raison : contexte temporaire destiné à l’administration. Le suivi continue ; indiquer une raison ne neutralise pas les contrôles. Aucun barrage ni quartier prétendument dangereux n’est inventé sur la carte.
- Aide en un bouton, privée à son auteur, idempotente tant que son dossier est ouvert. État initial « enregistrée, personne ne l’a encore prise en charge », puis « prise en charge » seulement après l’action administrative. Une demande reste ouverte même si la course se termine ou est annulée.
- Partage volontaire, lien aléatoire valable 4 heures, révocable par son créateur. Un nouveau partage remplace ses précédents liens. Le partage de l’autre participant reste indépendant. Un lien créé avant ce module garde son expiration initiale, faute d’information sur son auteur.
- Accès sécurité depuis le bouclier de la carte et depuis la fiche de course. Traductions FR/EN/SW/LN ; une validation linguistique locale reste nécessaire avant diffusion.

## Seuils initiaux à calibrer sur le terrain

| Contrôle | Jour / nuit | Nuit renforcée |
| --- | --- | --- |
| Arrêt hors étape prévue | 5 min de GPS continu | 3 min |
| Écart à une route Google | >450 m + précision, pendant 2 min | pendant 90 s |
| Absence de position exploitable | 3 min | 2 min |
| Délai sans réponse à arrêt/écart | 2 min | 90 s |
| Délai minimal entre nouveaux contrôles | 10 min | 10 min |

Le délai est exécuté par un worker toutes les 15 secondes. Les délais ne sont pas des SLA. Une absence de réponse à un contrôle d’arrêt/écart ouvre un dossier `check_unanswered` à examiner. Une perte de GPS seule reste une interruption technique et n’ouvre pas automatiquement une demande d’urgence. Elle peut afficher une vérification, sans accusation.

Les seuils se trouvent dans `apps/api/src/safety/policy.ts`. Les modifier demande des tests et une revue ; ils ne viennent pas d’un modèle de langage. Les points GPS reçus sont déclarés par le téléphone : ces contrôles ne prouvent pas l’absence de falsification GPS.

## Mise en service

1. Installer le patch, puis redémarrer l’API et Expo. Node 24 minimum, comme le projet actuel. Aucune nouvelle dépendance native ou service payant n’est ajouté.
2. Ouvrir `http://ADRESSE-DU-PC:4000/admin`. Utiliser le `ADMIN_TOKEN` déjà défini dans `apps/api/.env`. Ne jamais le placer dans les variables `EXPO_PUBLIC_*` ni dans les applications mobiles.
3. Approuver d’abord l’identité, puis les quatre pièces du conducteur et son véhicule. Dans « Pepo la nuit · Autorisations », autoriser 7 jours après la revue réelle. Les anciens dossiers approuvés n’obtiennent pas automatiquement une autorisation nocturne.
4. Ouvrir l’application Driver, autoriser la localisation, passer en ligne et garder l’application ouverte. Vérifier que son GPS est exploitable. Sans dossier nocturne et GPS, il ne recevra pas les demandes de nuit.
5. Facultatif : ajouter à `apps/api/.env` `SAFETY_SUPPORT_PHONE=+243...` avec un vrai numéro de votre assistance. Redémarrer l’API. L’application affichera un bouton d’appel ; elle ne compose pas ce numéro sans action de l’utilisateur. Sans numéro configuré, elle affiche honnêtement cette absence. Aucun numéro de secours n’est inventé.
6. Garder une équipe responsable de la file `/admin`, avec une procédure de contact et d’escalade. La file s’actualise toutes les 15 secondes quand la page est visible ; les demandes explicites passent avant les contrôles sans réponse. Le bouton « Prendre en charge » implique de contacter la personne ; il n’envoie pas lui-même un SMS, un appel ou une notification aux secours.

## Tester maintenant

Tests automatiques, depuis la racine du monorepo :

```powershell
npx vitest run tests/night-safety.test.ts
npm run check
npm run build:api
```

Le premier test utilise une base SQLite temporaire et une horloge injectée en mémoire. Il simule la nuit même si vous testez de jour, sans toucher à vos comptes, vos courses, vos clés ou votre base réelle. L’heure de nuit n’est pas modifiable via l’API publique ou une variable de téléphone.

Test manuel à deux comptes/appareils distincts, sans déplacement dangereux :

1. Débuter une réservation de nuit avec un conducteur autorisé et GPS précis. Vérifier que la plaque, la photo approuvée et le départ correspondent. Avant d’être au départ, « Arrivé » doit être refusé. Au départ, le bon PIN doit permettre le démarrage ; le conducteur ne doit jamais voir le PIN du passager.
2. Depuis le bouclier, appuyer « Besoin d’aide ». La demande doit apparaître en attente dans `/admin`. Appuyer à nouveau ne crée pas un second dossier ouvert pour cette personne et cette course.
3. Sur `/admin`, prendre la demande en charge. L’auteur voit l’état changer après actualisation (environ 15 secondes au premier plan). L’autre participant ne voit pas son dossier. Clôturer seulement après avoir vérifié la situation.
4. Partager le trajet, ouvrir le lien dans Safari, puis « Arrêter mon partage ». Le lien doit cesser de fonctionner. Une position reçue doit porter la date du GPS, pas celle d’un message.
5. Fermer ou passer Driver à l’arrière-plan. Rider doit afficher une position ancienne ; il ne doit pas présenter le véhicule comme suivi en temps réel. Revenir dans Driver et vérifier la reprise.
6. Pour un arrêt, rester immobile après démarrage sur un emplacement sécurisé hors destination/étape, avec Driver au premier plan. Attendre le seuil : chacun doit pouvoir répondre pour lui-même. Utiliser les tests automatiques pour les écarts de route ; inutile de créer un détour dangereux pour essayer.
7. Couper le Wi-Fi avant l’envoi d’aide. L’application doit signaler « demande non confirmée », proposer un nouvel essai et conserver le bouton d’appel si un numéro a déjà été reçu. Elle ne doit pas annoncer une prise en charge fictive.
8. Refaire les écrans en anglais, français, swahili et lingala, avec texte agrandi. Tester Android et iPhone réels avant diffusion.

## Données et limites de production

Le module conserve un état courant par conducteur/course, pas un historique de tous les fixes. L’état d’observation est retiré à la fin de la course ; le GPS de disponibilité expire après une heure sans mise à jour. Les observations sans mise à jour sont purgées après 24 heures. Nettoyage horaire : contrôles et audit au-delà de 30 jours, dossiers clos au-delà de 30 jours après clôture. Les demandes ouvertes restent disponibles pour traitement. Les autorisations expirées sont purgées. La raison d’arrêt expire après 10 minutes. Les données historiques de courses déjà conservées par Pepo ne sont pas effacées par ce patch ; leur politique de conservation doit être définie séparément.

Les tables supplémentaires sont créées automatiquement avec `CREATE TABLE IF NOT EXISTS`. Aucun fichier `.env`, image, document, compte, course ou base existante n’est remplacé par l’installateur. Un retour à la version précédente des sources laisse ces tables additionnelles dans la base ; il ne les détruit pas.

La base SQLite et les sauvegardes doivent être protégées sur le serveur ; ce module n’ajoute pas de chiffrement SQLite. L’admin utilise encore le secret administratif partagé du projet. L’audit enregistre action, référence et date, sans identité d’opérateur individualisée. Avant une exploitation multi-opérateurs, ajouter comptes nominatifs, MFA, permissions minimales et attribution des prises en charge. Servir l’admin et l’API en HTTPS en production.

Architecture réelle : API Express, SQLite, Socket.IO et applications Expo. Le worker fourni tourne dans le processus API actuel, adapté à un pilote sur une instance. Avant une forte montée en charge : mesurer avec les volumes réels, migrer les états/file et la coordination des workers vers une base partagée, ajouter observabilité, supervision et stratégie de reprise. Pas de benchmark de grande échelle ni promesse de disponibilité avec ce patch.

**Ce qui nécessite encore une intégration dédiée :** localisation en arrière-plan dans un development build et permissions adaptées ; notifications fiables vers les personnes/équipes lorsque les applications sont suspendues ; permanence humaine et accords de secours ; authentification admin nominative ; vérification de présence réelle et résistance à la falsification GPS. Expo Go ne fournit pas un suivi nocturne permanent en arrière-plan. La navigation Google externe déjà utilisée passe Driver à l’arrière-plan : le panneau l’indique comme une interruption, sans prétendre surveiller le GPS. Les Live Activities existantes n’acheminent pas ces contrôles ou demandes d’aide.

Les SMS OTP existants ne sont pas transformés en SMS d’alerte. Ce module n’effectue pas de paiement, n’envoie pas automatiquement vos trajets à vos contacts et n’utilise pas vos habitudes ou vos dépenses pour décider qui est « sûr ».
