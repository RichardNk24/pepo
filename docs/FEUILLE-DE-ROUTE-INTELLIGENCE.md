# Pepo — de la vision à un pilote mesurable

Référence : [vision intégrale de Richard](VISION-PEPO.md), reçue le 3 octobre 2026. Ce document applique cette vision au code actuellement livré. Il prépare les évolutions ; il ne prétend pas qu'elles fonctionnent déjà.

**Objectif : des déplacements aboutis, compris, sûrs et économiquement viables pour les deux parties.** Commencer par un périmètre local maîtrisé, mesurer, puis étendre. La collecte de données ne constitue pas un objectif produit.

## 1. Ce qui existe, et ses limites

| Domaine | État constaté dans les sources | Conséquence |
|---|---|---|
| Lieux et références | `packages/utils/src/placeReferences.ts` retire les Plus Codes, classe jusqu'à trois références dans 300 m et conserve le point choisi. `apps/api/src/landmarks.ts` accepte noms, alias et entrées d'un catalogue local. | Base utile ; pas de preuve d'accessibilité, de périmètre ou de validation terrain structurée. Le seuil de 25 m n'est pas une certitude d'appartenance au lieu. |
| Recherche et entrées | Le picker propose les références/entrées disponibles ; Rider permet de modifier départ et destination. | Garder la sélection explicite ; les côtés d'entrée et coordonnées doivent être vérifiés. |
| Carte et itinéraires | Rendu Google partagé, étapes et optimisation d'ordre ; un repli estimé est distingué du routage Google. | Aucune connaissance propriétaire démontrée des restrictions, de la saison ou de l'état des routes. |
| Identité et sécurité | OTP, sessions, documents et selfies, revue administrative, contacts de confiance, PIN de course et contrôles de transition serveur. | Pas de liveness ou de comparaison biométrique automatique certifiées. La présence d'un document ne prouve pas l'identité. Les opérations d'assistance restent à organiser. |
| Langues et voix | Catalogues FR/EN/SW/LN, commandes déterministes, résumé vocal et ouverture de la navigation externe. | La disponibilité vocale dépend de l'appareil. Pas de navigation locale continue par landmarks ni de modèle dialectal validé. |
| Chauffeurs et temps réel | Applications distinctes, profils séparés, dispatch des chauffeurs disponibles/approuvés par ville et catégorie, invalidations autorisées par Socket.IO. | Pas de garantie de disponibilité, de délai ou de fonctionnement à grande échelle. |
| Prix et gains | `suggestedFare` dans `packages/utils/src/rules.ts` utilise base + distance par catégorie. Prix négocié, gains bruts. | Pas de calcul intégré des coûts carburant/temps/pickup/retour à vide, de revenu net ou de rentabilité. |
| Paiement | Préférences et capacités affichées ; paiement en espèces disponible dans le parcours. | Mobile Money, cartes, retraits et commissions ne doivent pas être annoncés comme exécutés. |
| Apprentissage collectif | Pas de pipeline propriétaire validé de traces agrégées ou de revue de candidats cartographiques. | Commencer par la validation manuelle et les observations nécessaires au pilote. |

Une première résolution conversationnelle est maintenant livrée : noms/alias déterministes, puis OpenAI facultatif sur une courte liste du catalogue, avec choix explicite, quota et repli. Voir [le guide d'intégration](RECHERCHE-INTELLIGENTE.md). Elle ne fournit pas la validation terrain, la provenance, les restrictions d'accès ou la revue du catalogue. L'amélioration des suggestions réelles et leur coût restent à mesurer au pilote.

Ce constat est une lecture ciblée des sources, pas un audit juridique, un audit exhaustif de sécurité ou un essai en production. Voir [validation](VALIDATION.md).

## 2. Priorités P0–P3

P0 = nécessaire au lancement du périmètre choisi ; P1 = après premiers utilisateurs ; P2 = différenciation à partir de données suffisantes ; P3 = recherche. Une fonctionnalité P0 non prête est un manque à traiter ou un motif de réduire le périmètre, pas une promesse de lancement.

| Capacité de la vision | Priorité | Première étape concrète | Validation attendue |
|---|---|---|---|
| Sécurité avant course et protections chauffeur/passager | P0 | Revue réelle des chauffeurs/véhicules, téléphone, PIN, accès serveur et protocole d'aide testé | Course interdite sans conditions requises ; aide joignable et exercice réalisé des deux côtés |
| Références et entrées fiables | P0 | Petit catalogue vérifié avec chauffeurs, noms locaux et accès exacts | Moins de pickups ratés/appels de clarification ; aucune entrée inventée |
| Simplicité pour faible littératie | P0 | Tests accompagnés de commande complète ; gros boutons, peu d'étapes, confirmation | Réussite sans aide, erreurs et temps mesurés avec des profils variés |
| Disponibilité et communication Rider/Driver | P0 | Pilote sur une zone desservie, réseau lent et reprise de session | Affectations réalisables ; pas de double affectation ni de course silencieusement perdue |
| Économie chauffeur et tarif transparent | P0 | Barème local daté, mesure des coûts, affichage brut/coûts estimés et distance vers départ lorsque connus | Acceptation et marge estimée rapprochées des coûts observés ; pas de garantie de gain |
| Restrictions routières connues sur le périmètre pilote | P0 | Vérification terrain et source datée avant toute règle d'accès ; limiter le service si aucun routage fiable | Aucun trajet présenté comme autorisé sur un accès connu interdit |
| FR/EN/SW/LN et repli clavier/carte | P0 | Relecture locale des actions essentielles et tests de compréhension | Les tâches essentielles restent possibles sans voix |
| Privacy by design | P0 | Inventaire des données, accès, conservation, suppression et revue des fournisseurs avant collecte nouvelle | Contrôles d'accès et suppression testés ; absence de traces collectées hors objectif |
| Entrées par véhicule, barrières, parkings, périmètres | P1 | Enrichir les fiches utiles, sans modéliser chaque bâtiment | Compatibilité et choix d'accès compréhensibles et vérifiés |
| Observations de pickup/drop-off | P1 | Signalement volontaire, file de revue et provenance | Un signal ne modifie jamais directement une fiche publiée |
| Safety Check sur anomalies | P1 | Règles prudentes, qualité GPS et temporisation, « Tout va bien ? » | Faux positifs et délai d'aide mesurés ; pas de sanction automatique |
| Évolution du stockage et coordination | P1, ou plus tôt si mesure le justifie | Mesurer latence/charge ; migrer stockage et tâches quand la limite est atteinte | Intégrité des courses et reprise après incident ; migration testée |
| Langage conversationnel, alias et entrée demandée | P1 | Résolution déterministe des noms connus puis suggestions désambiguïsées | Confirmation avant sélection ; taux de mauvaises résolutions suivi |
| Navigation vocale locale par landmarks | P2 | Instructions sur itinéraire validé, repères visibles, concision et repli | Compréhension en conduite/bruit sans instructions inventées |
| Mobility Graph et détection de patterns cartographiques | P2 | Agrégation d'observations autorisées + candidats soumis à revue | Gain mesuré par rapport au catalogue manuel ; biais et fraîcheur contrôlés |
| Pricing contextuel/ETA et coûts difficiles | P2 | Modèle comparé au barème de référence avec incertitude | Meilleure calibration sans prix opaque ou discrimination |
| Prévision de demande et repositionnement | P2 | Expérience limitée, capacité de zone et déplacement à vide suivis | Gain chauffeur supérieur au coût induit ; pas d'afflux collectif inutile |
| Variantes régionales, accents, code-switching avancé | P2/P3 | Corpus autorisé et tests locaux ; commencer par compréhension | Résultats évalués par langue/ville ; repli explicite |
| Liveness et biométrie automatisée | P3 pour la solution propriétaire | Évaluer besoin, fournisseur et cadre applicable ; revue humaine conservée | Qualité/faux rejets, protection des données et possibilité de recours |
| Graph routier/routage propriétaire complet | P3 | Seulement si données, opérations et besoin démontrés | Comparaison terrain ; droits d'usage et coût de maintenance maîtrisés |

## 3. Premier chantier recommandé : Pepo Places vérifié

Le code possède déjà la proximité, les références, les alias et les entrées. Le meilleur prolongement immédiat est d'améliorer la **fiabilité** de ces informations. Ne pas commencer par un chatbot ou un modèle prédictif sans corpus vérifié.

Hypothèse : une référence familière et une entrée accessible réduisent les appels pour se retrouver, les annulations et le temps perdu par les deux parties. Tester d'abord un petit groupe de lieux du périmètre pilote : hôpitaux, écoles, marchés, hôtels et lieux publics choisis avec les utilisateurs.

Pour chaque lieu : recueillir son nom usuel, alias, ville/quartier, entrée réellement utilisée, côté d'accès, véhicules admis, provenance, date de vérification et motif éventuel de limitation. Les exemples de Richard — Institut Maadini, Complexe La Plage, côtés Pullman et Route du Golf — sont des **candidats à vérifier**, pas des données géographiques validées. Ne pas déduire les coordonnées ou l'autorisation d'accès d'une capture.

Parcours cible : sélectionner le lieu → afficher « Quelle entrée ? » seulement si plusieurs accès utiles sont validés → choisir un accès compatible → afficher départ/arrivée lisibles → confirmer. Sans accès fiable : conserver le point manuel et une référence qualifiée, proposer une précision libre, ne pas déplacer silencieusement le repère.

Cas limites : portail fermé, accès piéton seulement, route en sens unique, deux lieux homonymes, géolocalisation incertaine, repère juste de l'autre côté d'un mur, véhicule changé après choix d'entrée, réseau perdu et restriction périmée. Une restriction doit être réévaluée à la confirmation et à un changement de véhicule/itinéraire. Ne jamais promettre une entrée accessible parce qu'elle est géométriquement proche.

### Contrats à préparer, pas encore implémentés

| Objet | Informations minimales proposées | Usage |
|---|---|---|
| `LocalPlace` | ID Pepo stable, ville, nom usuel, alias avec langue/variante, localisation, source et état de revue | Recherche locale et référence lisible |
| `AccessPoint` | Lieu parent, point exact, libellé, usages départ/arrivée, véhicules compatibles, accessibilité et dates de validité | Choix d'entrée ; point routé différent du centre du bâtiment |
| `LocalRestriction` | Géométrie utile, véhicule, direction/horaire/saison si confirmé, source, vérification, expiration | Détermination d'accès ; pas une sanction ni une suspicion personnelle |
| `Evidence` | Origine propre/fournisseur/utilisateur, date, précision, autorisation d'usage, référence de revue | Traçabilité et fraîcheur |
| `Observation` | Objectif explicite, course autorisée si nécessaire, point/qualité GPS minimisés, catégorie du signal, conservation | Candidat à vérifier, jamais publication automatique |
| `ReviewDecision` | Candidat, décision, motif, auteur autorisé, version et date | Publication, correction, retrait et audit |

Cycle proposé : **signal → candidat → revue → validation → publication → réévaluation/expiration**. Conserver les versions et permettre de retirer rapidement une information erronée. Deux observations issues de la même personne ne sont pas deux confirmations indépendantes. Une information Google et une observation Pepo doivent rester identifiables séparément.

## 4. Architecture progressive

Conserver l'API modulaire existante. Introduire les capacités ci-dessous quand le chantier correspondant est construit, plutôt que créer maintenant des services vides :

- **Places** : catalogue vérifié, alias, accès et restrictions ; fonctions géographiques pures partageables, publication contrôlée par l'API.
- **Pricing** : paramètres par ville/véhicule, version du calcul, devis et explication courte ; calcul serveur faisant autorité.
- **Safety** : signaux qualifiés, checks et actions d'assistance ; autorisations des deux parties et journal des accès sensibles.
- **Language** : normalisation et résolution locale, commandes puis propositions conversationnelles ; pas de décision engageante prise par le modèle.
- **Observations / Review** : événements nécessaires, filtrage, agrégation et file de validation. Les modèles consomment uniquement des données autorisées et utiles.

La couche fournisseur doit rester distincte du savoir local Pepo. Garder attribution, limites de conservation et provenance ; vérifier les conditions des services avant mise en cache durable, agrégation ou entraînement. Ne pas supposer que toutes les données reçues peuvent alimenter un graphe propriétaire.

Pas de nouveau stockage biométrique ou de GPS permanent dans cette phase documentaire. Lors d'une implémentation : migrations idempotentes, accès testés, conservation définie et feature flag/repli si la capacité dépend d'un service. Mesurer latence p95, erreurs, coût par course et reprise après coupure ; choisir ensuite index, cache, worker ou changement de base.

## 5. Économie du chauffeur : première méthode à tester

Le barème actuel ne suffit pas à démontrer une marge. Une première estimation explicable peut utiliser des paramètres locaux datés :

`coûts estimés = carburant + entretien/usure + coût du temps + coûts opérationnels pertinents`

La distance et le temps doivent distinguer **approche vers le départ**, **course**, et éventuel **retour à vide estimé**. Le retour à vide n'est pas une distance connue d'avance : le présenter comme scénario, ne pas le facturer comme certitude. Indiquer quand trafic, consommation ou distance d'approche ne sont pas connus.

`recette chauffeur = prix course − commission applicable`

`marge estimée = recette chauffeur − coûts estimés`

Ces formules sont une conception à valider, pas le moteur livré. Ne pas mélanger coût du temps, revenu et argent encaissé. Définir la commission quand le modèle économique sera arrêté ; ne pas inventer son taux. Présenter peu d'informations à l'écran : prix proposé, distance/temps vers le passager, distance/temps de course, montant chauffeur après commission si connu ; détail sur demande.

Collecter volontairement quelques relevés de coûts et carnets de courses avec des conducteurs de chaque catégorie. Tester un barème versionné avant tout modèle d'IA. Un devis négocié reste soumis à confirmation ; afficher ce qui change en cas d'étape, destination, attente ou véhicule modifiés.

## 6. Sécurité et vie privée comme exigences de lancement

Préserver OTP, PIN, revue des documents et validations serveur. Compléter les procédures réelles pour passager **et** conducteur, les accès support/admin et le traitement des incidents. Une urgence ne doit pas dépendre uniquement d'un score ou d'une connexion Internet parfaite.

Pour un futur Safety Check : tenir compte de l'incertitude GPS, de la qualité réseau, des changements validés d'étapes et des arrêts ordinaires. Demander simplement « Tout va bien ? », puis proposer une aide réellement disponible. Ne pas annoncer une intervention policière/urgence automatique sans dispositif opérationnel local. Mesurer les faux positifs et autoriser correction/recours. Ne pas transformer un quartier ou une langue en score de danger d'une personne.

Avant une nouvelle collecte, documenter finalité, données minimales, personnes autorisées, durée de conservation, suppression, chiffrement et base/consentement applicable à faire vérifier. Définir des durées par catégorie ; ne pas choisir une durée illimitée « pour l'IA ». Séparer justificatifs d'identité, détails d'incident et données cartographiques. Un retrait de permission doit empêcher les nouvelles collectes concernées ; démo et comptes de test n'alimentent pas les connaissances terrain.

## 7. Mesures pour le Product-Market Fit

Mesure centrale proposée : **courses abouties sans difficulté de rendez-vous, avec coûts chauffeur connus et expérience comprise**. Éviter une métrique composite opaque : suivre séparément ses composantes et les incidents. Aucun objectif numérique n'est prétendu validé avant une base mesurée.

| Question | Mesure / test de départ | Garde-fou |
|---|---|---|
| Peut-on commander sans être accompagné ? | Réussite d'une tâche complète, nombre d'aides et temps observés | Inclure niveaux de littératie/langues différents ; consentement des participants |
| Les parties se retrouvent-elles ? | Temps d'attente au rendez-vous, appels de clarification, mauvais accès, annulations | Ne pas demander d'enregistrement du contenu des appels |
| Les chauffeurs gagnent-ils de façon viable ? | Acceptation, coût d'approche, revenu brut et marge estimée/observée par catégorie | Paramètres datés ; ne pas attribuer une estimation à un gain garanti |
| Y a-t-il assez de disponibilité ? | Affectation, attente, annulation faute de chauffeur | Distinguer démo et courses réelles ; limiter géographiquement le pilote |
| L'aide fonctionne-t-elle ? | Exercices d'assistance, délai et issue, signalements qualifiés | Ne pas interpréter zéro signalement comme zéro incident |
| Les utilisateurs reviennent-ils ? | Retour après une première course réussie, raisons d'abandon en entretien | Agrégats utiles ; pas de collecte intrusive pour profiler les individus |
| Les nouveautés améliorent-elles le service ? | Avant/après ou petit essai comparatif sur périmètres comparables | Tenir compte du contexte ; possibilité de retirer une règle erronée |

Pour chaque expérimentation : hypothèse, responsable, périmètre, métrique de base, critère de réussite défini avant l'essai, coût/opérations nécessaires et condition d'arrêt. Tester manuellement avant automatisation lorsque possible.

## 8. Comment utiliser cette référence

`AGENTS.md` demande aux agents de lire cette vision lors des futures évolutions. Le README pointe vers ces documents. Une nouvelle conversation ou un outil qui ne lit pas le projet peut avoir besoin de cette référence jointe ; la persistance du fichier ne vaut pas mémoire universelle.

Prochain lot proposé : **formaliser le catalogue d'accès vérifié et son cycle de revue**, puis brancher le choix d'entrée sur le véhicule et tester avec des chauffeurs à Lubumbashi. Aucun accès, aucune interdiction actuelle de motos ni aucun tarif local n'est déclaré vérifié dans ce document.
