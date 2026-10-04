> Document conservé de la version précédente. Pour les commandes et chemins du monorepo, consultez [README.md](../README.md).

# Construire Pepo avec des bases claires

## Ce qui fonctionne dans cette version

Les écrans Expo Router appellent un contexte unique. Le contexte utilise soit une simulation locale clairement identifiée, soit les mêmes types métier exposés par le serveur. Les règles de réservation et de transition sont partagées avec le serveur ; celui-ci reste l’autorité en mode connecté.

L’API Express fournit les commandes HTTP. SQLite conserve comptes, sessions, OTP, courses, messages, signalements, documents et partages. Des index servent les courses d’un compte et les demandes par ville / véhicule. Les transitions critiques utilisent `BEGIN IMMEDIATE` : deux choix simultanés ne peuvent pas attribuer le même conducteur à deux passagers.

Socket.IO envoie seulement un événement « actualiser » aux comptes concernés. Les données sont relues par REST avec contrôle d’accès. Le code de départ n’est jamais diffusé dans un canal temps réel. Un rafraîchissement de secours toutes les cinq secondes et une reprise à l’ouverture de l’app complètent la synchronisation.

Les sessions mobiles sont stockées dans Expo SecureStore. Le web utilise le stockage navigateur pour le jeton ; il faut traiter la version web comme un client de pilote, limiter les scripts externes et la durcir avant une diffusion publique. L’app connectée ne persiste localement que les préférences, pas les documents ni le code. Une reprise de course après fermeture complète nécessite donc une connexion à l’API.

## Sécurité réellement implémentée

| Contrôle        | Comportement                                                                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OTP             | Six chiffres aléatoires, durée cinq minutes, cinq essais maximum, délai de renvoi et limitation HTTP. Le mode test ne prétend pas confirmer le numéro.                                               |
| Session         | Jeton aléatoire 256 bits, empreinte en base, expiration et révocation au logout.                                                                                                                     |
| Conducteur      | Véhicule et quatre pièces obligatoires pour approbation ; contrôle administrateur, statut en attente après modification.                                                                             |
| Départ          | Quatre chiffres générés au serveur, visibles seulement du passager. Le conducteur assigné doit être arrivé et fournir le code ; cinq erreurs bloquent le départ.                                     |
| Attribution     | Offre valide, prix négocié, conducteur disponible, contrôle atomique de sa course active.                                                                                                            |
| Confidentialité | Accès limité aux participants pour messages et position ; pas de téléphone ou PIN dans le lien public.                                                                                               |
| Documents       | Images limitées à 6 Mo, vérification de la signature du fichier, chiffrement AES-256-GCM, pièces privées accessibles à l’administrateur ; photo de visage approuvée visible aux passagers concernés. |
| Partage         | Jeton aléatoire, empreinte en base, durée quatre heures ; la position n’est plus affichée après fin / annulation.                                                                                    |
| Signalement     | Enregistrement serveur avec référence et consultation dans l’administration.                                                                                                                         |

La vérification documentaire demeure **humaine**. Un téléphone confirmé n’est pas une identité légale confirmée. Une photographie seule ne prouve pas la validité d’un document ni la présence réelle de son titulaire. Le pilote doit établir sa procédure locale de contrôle des originaux, des permis, du véhicule, des casques et des personnes.

## Un pilote à une seule instance

Le serveur livré peut démarrer sans PostgreSQL ni Redis pour simplifier les essais depuis ton PC. Il est conçu pour **une instance et un pilote**, pas pour des centaines de milliers de conducteurs. Les commandes, types et frontières sont séparés pour permettre une migration sans refaire les écrans.

Avant de répliquer le serveur :

1. Migrer les comptes, offres et courses vers PostgreSQL, avec contraintes / verrous transactionnels et colonnes d’état séparées.
2. Utiliser Redis pour l’adaptateur Socket.IO, la présence, les limitations distribuées, l’expiration d’offres et les files de notifications.
3. Déplacer les documents vers un stockage privé, avec gestion de clés, liens temporaires administrateur, politique de rétention et audit des accès.
4. Ajouter notifications push et tâches natives de localisation, avec consentement et tests de batterie / perte de réseau sur Android et iPhone.
5. Ajouter les fournisseurs SMS locaux, observabilité, sauvegardes restaurables, gestion des incidents et comptes administrateur individuels avec MFA. Le secret administrateur partagé de ce MVP n’est pas le modèle d’accès final.
6. Ajouter un dispatch par distance et zones GPS. Aujourd’hui, les demandes sont filtrées par ville, type et disponibilité ; aucune promesse de classement au mètre près.
7. Transformer les tarifs en règles administrables par pays, ville, véhicule et devise. Les montants actuels sont des paramètres indicatifs de test, pas une grille de marché vérifiée.

## Un produit adapté au terrain

L’accord de prix est explicite : offre du passager, réponse du conducteur, éventuelle contre-offre, sélection finale. Le prix accepté ne change pas pendant la course. Les personnes qui marchandent gardent une interaction familière, avec une trace de l’accord.

L’inscription reste courte. La collecte documentaire est repoussée au parcours conducteur ; un passager n’a pas à remplir ce dossier pour tester une réservation. Les textes distinguent téléphone confirmé, dossier approuvé et profil de démonstration.

Pour un pilote initial, choisir une seule ville, une zone et un petit groupe de conducteurs contrôlés. Observer le taux de demandes ayant une offre, le temps avant accord, l’écart proposé / accepté, les annulations, les incidents et les courses répétées. Aucun tableau d’analytique ou résultat de product-market fit n’est inventé par cette livraison.

Le nom, les villes, les véhicules, les images et les traductions sont centralisés. Pour un autre pays, il faut ajouter indicatif, devise, repères, couverture Maps, tarifs, paiements, fournisseurs SMS et règles opérationnelles ; l’app ne bascule pas automatiquement dans tout l’espace africain.

## Limites à traiter avant service réel

- GPS suivi uniquement au premier plan ; les liens peuvent afficher une dernière position ancienne, avec l’heure de mise à jour.
- Pas de service de secours intégré, de suivi garanti, de biométrie, de paiement Mobile Money, de facturation fiscale ni de rapprochement de paiement.
- Pas de dispatch géospatial fin, de mode vocal, d’USSD ou de réservation pour une personne sans smartphone dans cette version.
- Pas d’acceptation en dehors de la ville / zone configurée ; pas de service interurbain.
- Tests de terrain, de couverture mobile et de circulation nécessaires. L’export JavaScript iOS ne remplace pas une compilation native ni des tests physiques.

Ces limites sont documentées pour que les fonctionnalités de test, celles du pilote et les prochaines intégrations restent compréhensibles.
