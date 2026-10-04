Je veux que cette vision devienne un **principe directeur permanent pour la conception de Pepo** et qu’elle influence les décisions produit, UX, architecture, backend, données, IA, sécurité, pricing et navigation.

# PEPO — Intelligent Mobility OS for Congo

Pepo ne doit pas être simplement une autre application de VTC qui met en relation un passager avec un taxi ou une moto.

Je veux construire une plateforme de mobilité **AI-native, profondément adaptée aux réalités locales de la RDC**, qui comprend comment les Congolais parlent, se déplacent, donnent des directions, utilisent leur téléphone, paient, évaluent la sécurité et gagnent leur vie comme chauffeurs.

L’objectif est qu’un utilisateur puisse ressentir :

> **« Cette application comprend réellement mon environnement. »**

Nous devons rechercher rapidement le Product-Market Fit, mais construire l’architecture de manière à ce que chaque course puisse progressivement rendre Pepo plus intelligent.

---

# 1. Principe fondamental : Local Intelligence Layer

Créer progressivement une couche propriétaire d’intelligence locale au-dessus des services cartographiques et technologiques externes.

Google Maps ou d’autres fournisseurs peuvent fournir une carte et des itinéraires de base.

Mais **Pepo doit comprendre le terrain.**

Cette Local Intelligence Layer doit progressivement apprendre :

- les véritables points de pickup/drop-off ;
- les entrées et sorties des bâtiments ;
- les entrées accessibles aux voitures ou motos ;
- les routes réellement utilisées ;
- les restrictions locales ;
- les routes dangereuses ou difficiles ;
- les routes impraticables selon les saisons ;
- les habitudes des conducteurs ;
- les landmarks utilisés par les habitants ;
- les noms populaires des lieux ;
- les variations linguistiques régionales ;
- les comportements de mobilité propres à chaque ville.

Chaque course doit potentiellement enrichir cette connaissance.

---

# 2. Pepo Places — une carte qui comprend réellement les lieux

Un lieu ne doit pas être simplement une latitude et une longitude.

Pour un mall, hôtel, université, hôpital, marché, immeuble ou autre POI important, Pepo doit progressivement pouvoir connaître :

- le périmètre du lieu ;
- ses différentes entrées ;
- l'entrée principale ;
- les entrées secondaires ;
- l'entrée voiture ;
- l'entrée moto ;
- l'entrée piétonne ;
- les parkings ;
- les barrières ;
- les niveaux lorsque cela est pertinent ;
- les zones autorisées pour pickup/drop-off ;
- les zones dangereuses ;
- les points où les chauffeurs s'arrêtent réellement.

L'interface cartographique doit rendre ces éléments extrêmement clairs.

Lorsqu'un utilisateur sélectionne un grand lieu, Pepo devrait pouvoir lui proposer directement :

**« Quelle entrée ? »**

ou choisir intelligemment l'entrée la plus appropriée.

---

# 3. Apprentissage cartographique par les trajets

Pepo doit apprendre du comportement collectif.

Exemple :

Si 500 conducteurs s'arrêtent systématiquement à 80 mètres du pin officiel d'un bâtiment, cela peut signifier que l'entrée réelle se trouve ailleurs.

Si presque tous les conducteurs évitent une route pourtant proposée par la carte, Pepo doit pouvoir détecter cette anomalie.

Si beaucoup de conducteurs ralentissent, font demi-tour ou ratent systématiquement le même virage, l'instruction de navigation est peut-être mauvaise.

Ces observations ne doivent pas automatiquement modifier la carte : elles doivent alimenter un système de confiance, de validation et éventuellement de modération.

Nous devons progressivement construire un **Pepo Mobility Graph** propriétaire.

---

# 4. Restrictions locales intelligentes

La navigation doit comprendre les règles locales.

Exemple concret : dans certaines parties du centre-ville de Lubumbashi, les motos peuvent être interdites ou limitées.

Si une destination se trouve dans une zone inaccessible à la catégorie de véhicule commandée, Pepo ne doit pas simplement générer un mauvais itinéraire.

Il doit comprendre :

1. le type de véhicule ;
2. la restriction ;
3. le meilleur point accessible ;
4. le meilleur endroit pour déposer le passager ;
5. éventuellement le trajet restant à pied ou une autre option de mobilité.

Ce moteur devra pouvoir gérer différentes règles selon les villes.

---

# 5. Pepo Language Intelligence

La RDC est multilingue.

Une simple traduction français → swahili ou français → lingala n'est pas suffisante.

Pepo doit progressivement comprendre :

- français congolais ;
- lingala ;
- swahili congolais ;
- code-switching français/lingala ;
- code-switching français/swahili ;
- noms populaires des lieux ;
- expressions locales ;
- prononciations locales.

Le swahili utilisé à Lubumbashi, Kolwezi, Likasi ou Kasumbalesa n'est pas nécessairement utilisé exactement de la même manière que celui de Tanzanie ou celui de Goma/Kalemie.

Nous devons donc penser éventuellement en variantes :

- Swahili — Lubumbashi/Haut-Katanga
- Swahili — Kolwezi/Lualaba
- Swahili — Goma/Kivu
- Lingala — Kinshasa
- Français — RDC

L'objectif n'est pas de caricaturer les accents ou dialectes, mais d'offrir une compréhension et une communication authentiquement naturelles.

---

# 6. Navigation vocale réellement locale

Je veux aller beaucoup plus loin qu'une voix disant :

« Dans 300 mètres, tournez à droite. »

Pepo doit progressivement être capable de générer des instructions comme :

« Continue tout droit. Après la station, tourne à gauche. »

ou :

« Continue jusqu'au grand bâtiment bleu. L'entrée est juste après. »

Les **landmarks** peuvent être plus utiles que des noms de rues mal connus ou absents.

Le système devrait combiner :

route + landmarks + contexte + restrictions + type de véhicule + langue.

Puis transformer cela en instruction vocale naturelle.

---

# 7. Voix, accents et code-switching

La voix Pepo doit être une partie importante de l'identité du produit.

À terme, explorer des voix adaptées aux régions et langues utilisées.

Le conducteur devrait pouvoir entendre des instructions dans la langue avec laquelle il est le plus à l'aise.

Lorsque cela correspond réellement à l'usage local, le système doit pouvoir comprendre et produire du code-switching naturel.

La voix doit rester :

- claire ;
- courte ;
- rassurante ;
- compréhensible dans le bruit ;
- non robotique ;
- adaptée à la conduite.

---

# 8. Recherche de destination conversationnelle

L'utilisateur ne devrait pas être obligé de connaître une adresse exacte.

Il pourrait écrire ou dire quelque chose comme :

« Amène-moi au mall, entrée côté parking. »

ou utiliser un nom populaire de lieu.

Pepo doit essayer de résoudre :

**intention → lieu → entrée → pickup/drop-off → route.**

L'IA conversationnelle doit particulièrement aider les personnes ayant une faible maîtrise des applications numériques.

---

# 9. Concevoir pour une faible littératie numérique

Une partie importante du marché peut ne pas être très à l'aise avec les applications complexes.

Donc :

**la sophistication doit être dans le système, pas dans l'interface.**

Pepo doit rester extrêmement simple.

Principes UX :

- grosses zones tactiles ;
- peu d'étapes ;
- langage simple ;
- forte utilisation des cartes ;
- icônes compréhensibles ;
- voix lorsque pertinente ;
- confirmations claires ;
- feedback haptique ;
- éviter les formulaires complexes ;
- éviter le jargon ;
- actions principales évidentes.

Un utilisateur doit pouvoir commander un trajet sans comprendre la technologie derrière Pepo.

---

# 10. Pepo Shield — sécurité AI-native

La sécurité doit protéger **le passager ET le conducteur**.

Je veux une architecture de sécurité multicouche plutôt qu'une simple vérification d'identité.

### Avant le trajet

Explorer :

- vérification du numéro de téléphone ;
- vérification du document d'identité ;
- selfie ;
- liveness detection ;
- comparaison document/selfie lorsque légalement et techniquement approprié ;
- détection des comptes multiples suspects ;
- sécurité de l'appareil ;
- vérifications renforcées pour les conducteurs ;
- contrôle des véhicules et documents nécessaires.

La vérification doit être extrêmement simple et, lorsque possible, prendre moins de 30 secondes côté utilisateur, sans sacrifier les contrôles nécessaires.

---

# 11. Sécurité pendant le trajet

Le système doit pouvoir rechercher des anomalies telles que :

- déviation importante de l'itinéraire ;
- arrêt inhabituellement long ;
- changement soudain de destination ;
- comportement inhabituel du compte ;
- changement suspect de téléphone/appareil ;
- course terminée dans un endroit très différent ;
- répétition de comportements signalés.

Une anomalie n'implique pas automatiquement un danger.

Le système doit utiliser des niveaux de confiance et des mécanismes anti-faux-positifs.

---

# 12. Safety Check

Pour certaines anomalies, Pepo pourrait demander simplement :

**« Tout va bien ? »**

Avec de grosses actions simples :

**Oui**

**J'ai besoin d'aide**

Selon le niveau de risque et les capacités disponibles, Pepo pourrait ensuite proposer :

- partager le trajet ;
- contacter un proche ;
- contacter le support ;
- déclencher un protocole d'urgence.

Les mécanismes exacts doivent être conçus selon les infrastructures et services réellement disponibles localement.

---

# 13. Protéger également les chauffeurs

Ne jamais construire la sécurité comme si seul le passager pouvait être victime.

Le chauffeur peut également prendre :

- un passager dangereux ;
- un faux compte ;
- quelqu'un utilisant un téléphone volé ;
- quelqu'un cherchant à l'attirer dans une zone dangereuse ;
- quelqu'un ayant des comportements problématiques répétés.

Le système de confiance doit donc être **bidirectionnel**.

---

# 14. Privacy by design

Cette intelligence ne doit pas devenir de la surveillance abusive.

Concevoir dès le départ :

- minimisation des données ;
- consentement lorsque nécessaire ;
- durée de conservation raisonnable ;
- chiffrement ;
- séparation des données sensibles ;
- permissions strictes ;
- audit des accès ;
- mécanismes de suppression appropriés ;
- conformité aux lois applicables.

Ne jamais utiliser des caractéristiques sensibles ou des proxies discriminatoires pour déterminer si quelqu'un est « dangereux ».

---

# 15. Driver Economics Intelligence

Un énorme problème à résoudre est l'économie du conducteur.

Des chauffeurs se plaignent que certaines plateformes proposent des prix qui ne reflètent pas suffisamment :

- le prix du carburant ;
- la distance réelle ;
- le temps passé ;
- les embouteillages ;
- le retour à vide ;
- l'usure du véhicule ;
- certaines routes difficiles ;
- les longues distances pour récupérer un passager.

Pepo doit éviter de construire sa croissance sur des courses structurellement non rentables pour les conducteurs.

---

# 16. Pricing intelligent et transparent

Explorer un modèle de tarification qui considère :

- distance ;
- durée estimée ;
- trafic ;
- catégorie du véhicule ;
- carburant ;
- distance conducteur → pickup ;
- distance pickup → destination ;
- conditions routières pertinentes ;
- demande/offre ;
- coûts opérationnels ;
- marge minimale raisonnable pour le conducteur ;
- commission Pepo.

L'objectif n'est pas simplement :

**« Quel est le prix maximum que le passager acceptera ? »**

mais plutôt :

**« Quel prix crée durablement de la valeur pour le passager, le conducteur et Pepo ? »**

---

# 17. Driver Earnings Transparency

Le conducteur doit comprendre immédiatement pourquoi une course lui est proposée.

Exemple :

Course : 18 500 FC  
Distance : 11,4 km  
Temps estimé : 27 min  
Pickup : 1,2 km  
Gain conducteur estimé : X

L'interface doit rester simple, mais la logique économique doit être transparente.

---

# 18. Ne pas surutiliser l'IA

L'IA ne doit pas être ajoutée pour faire moderne.

Pour chaque fonctionnalité, demander :

**Pourquoi faut-il de l'IA ici ?**

Si une règle déterministe, un algorithme classique ou une requête géospatiale donne un meilleur résultat, utiliser cela.

L'IA doit principalement intervenir là où elle apporte un avantage :

- compréhension du langage ;
- prédiction ;
- détection d'anomalies ;
- classification ;
- personnalisation ;
- reconnaissance de patterns ;
- intelligence contextuelle ;
- génération d'instructions naturelles.

---

# 19. Intelligence de demande

Pepo doit progressivement prédire où la demande apparaîtra.

Exemples :

- sorties d'écoles ;
- centres commerciaux ;
- marchés ;
- événements ;
- quartiers d'affaires ;
- météo ;
- horaires récurrents ;
- jours de paie ;
- périodes de forte activité.

Le conducteur pourrait recevoir :

**« Forte probabilité de demandes dans cette zone dans 10–15 minutes. »**

Mais éviter de déplacer inutilement des centaines de conducteurs vers le même endroit.

---

# 20. Architecture : préparer l'avenir sans surconstruire la V1

Nous voulons cette ambition, mais nous devons trouver rapidement le Product-Market Fit.

Donc ne construisons pas tout immédiatement.

Pour chaque grande fonctionnalité, classe-la :

**P0 — nécessaire au lancement**  
**P1 — nécessaire après premiers utilisateurs**  
**P2 — avantage compétitif**  
**P3 — recherche / futur**

L'architecture backend doit néanmoins permettre d'ajouter progressivement ces capacités sans devoir reconstruire Pepo entièrement.

---

# 21. Data Flywheel

Concevoir un flywheel :

**plus de trajets  
→ plus de données locales utiles  
→ meilleure carte  
→ meilleure navigation  
→ meilleurs pickups  
→ meilleure sécurité  
→ meilleure expérience  
→ davantage d'utilisateurs et de chauffeurs  
→ davantage de trajets**

Mais seules les données réellement nécessaires doivent être collectées.

---

# 22. Notre avantage compétitif potentiel

À terme, le moat de Pepo ne doit pas être uniquement son application.

Il doit devenir :

**la connaissance propriétaire de la mobilité congolaise.**

Pepo doit progressivement savoir :

- comment les gens appellent les lieux ;
- comment ils donnent des directions ;
- où les gens montent réellement ;
- où les chauffeurs s'arrêtent ;
- quelles routes sont réellement utilisées ;
- quelles restrictions existent ;
- comment les habitudes diffèrent selon les villes ;
- comment proposer un prix économiquement viable ;
- comment détecter des comportements inhabituels.

---

# 23. Product-Market Fit avant sophistication

Malgré cette vision ambitieuse, notre priorité immédiate est de trouver rapidement ce qui pousse réellement les Congolais à préférer Pepo.

Pour chaque feature proposée, demande :

1. Quel problème réel résout-elle ?
2. Passager, chauffeur ou les deux ?
3. À quelle fréquence ce problème arrive-t-il ?
4. Quelle est sa gravité ?
5. Les alternatives actuelles le résolvent-elles ?
6. Comment tester l'hypothèse rapidement ?
7. Quelle métrique valide l'hypothèse ?
8. Peut-on tester manuellement avant d'automatiser ?
9. Est-ce nécessaire pour le PMF ou simplement impressionnant techniquement ?

---

# 24. Ordre de priorité

Lorsque tu travailles avec moi sur Pepo, privilégie généralement :

**1. Sécurité et confiance**  
**2. Fiabilité du pickup/drop-off**  
**3. Simplicité d'utilisation**  
**4. Disponibilité des chauffeurs**  
**5. Économie viable pour les chauffeurs**  
**6. Prix acceptable pour le passager**  
**7. Navigation adaptée aux réalités locales**  
**8. Langues et voix locales**  
**9. Intelligence prédictive**  
**10. Sophistication supplémentaire**

Cet ordre peut changer si les données utilisateurs démontrent autre chose.

---

# 25. Comment je veux que tu travailles désormais sur Pepo

À partir de cette vision, ne sois pas simplement un assistant qui exécute mes demandes UI ou code.

Agis également comme :

- Product Architect ;
- AI Architect ;
- Mobility Systems Architect ;
- UX strategist ;
- Safety architect ;
- Data architect ;
- Backend architect ;
- Product-Market Fit sparring partner.

Quand je propose une fonctionnalité :

- analyse son impact sur l'ensemble de Pepo ;
- signale les conséquences backend/data/UX/sécurité ;
- identifie les edge cases ;
- propose une approche adaptée à la RDC ;
- évite de copier aveuglément Uber, Bolt, Yango ou d'autres plateformes ;
- distingue ce qu'il faut construire maintenant de ce qu'il faut préparer pour plus tard ;
- protège la simplicité de l'application ;
- conserve cette vision d'intelligence locale.

Nous pouvons nous inspirer des meilleurs standards mondiaux de mobilité, mais la question centrale doit toujours être :

> **« Quelle serait la meilleure expérience possible si ce produit avait été conçu dès le premier jour pour les réalités du Congo ? »**

## North Star

**Pepo doit devenir une plateforme de mobilité qui comprend le Congo — ses routes, ses lieux, ses langues, ses habitudes, ses contraintes, ses chauffeurs et ses passagers — suffisamment bien pour rendre chaque déplacement plus simple, plus sûr, plus naturel et économiquement durable.**

À partir de maintenant, utilise cette vision comme contexte permanent pour toutes nos décisions concernant Pepo.