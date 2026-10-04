# Recherche de lieux : branches Google et noms familiers

## Problème et objectif

Priorité P0 pour la fiabilité du lieu d'arrivée. Les passagers, notamment ceux qui dictent un nom familier, doivent pouvoir reconnaître et choisir la bonne branche. Richard a observé le défaut sur Psaro et Pullman ; sa fréquence sur l'ensemble des utilisateurs reste inconnue.

La recherche conversationnelle s'arrêtait dès qu'un alias local correspondait. Même son repli pouvait retourner seulement des candidats locaux sans consulter Google. Un catalogue comportant « Psaro — La Plage » et l'alias « Psaro » empêchait ainsi la découverte des autres branches. La résolution acceptait également comme exacte une correspondance courte malgré un qualificatif de branche absent.

## Comportement livré

- La recherche saisie et la transcription vocale passent par le même moteur existant. Pour une requête de lieu, Google est désormais consulté même si le catalogue local possède une correspondance.
- Les résultats Google sont prioritaires et conservent leur ID, leur nom, leur adresse et leurs coordonnées Places. L'adresse n'est pas géocodée une seconde fois pour déplacer le point sur la rue.
- « Psarou » est normalisé vers « Psaro » comme terme de recherche. « Carrefour », « centre-ville », « dépôt » et « plage » restent des qualificatifs. Aucune de ces variantes ne sélectionne une branche automatiquement.
- « Pullman », « Hôtel Pullman », « Hôtel Karavia » et « Hôtel Caravia » recherchent le même hôtel sous « hotel pullman grand karavia ». « Marché Karavia » reste une recherche distincte.
- Un alias court, par exemple « Psaro », ne suffit plus à établir une correspondance exacte pour « Hyper Psaro Carrefour » lorsque cette branche n'est pas dans la fiche locale.
- Les différentes fiches Google restent distinctes par ID. Les homonymes distants et les entrées déclarées restent sélectionnables. Une copie locale n'est masquée que si son nom normalisé correspond à celui d'un établissement Google situé à moins de 150 m. Ce seuil est une règle de dédoublonnage, pas une preuve d'accès ou d'appartenance à un bâtiment.
- Les choix d'entrées déclarés au catalogue sont conservés avant le lieu parent. Leur accès doit toujours être vérifié sur le terrain.
- La liste est limitée à 20 suggestions. Les résultats disponibles dépendent de la réponse Google et du catalogue ; le correctif ne garantit pas l'existence de toutes les branches ni une entrée exacte.
- Si Google ne fournit pas de résultat exploitable, le catalogue reste disponible. L'IA facultative ne peut classer que ses IDs connus. Son classement ne supprime plus les autres candidats locaux.

## Coûts, délais et données

La recherche Google utilise Text Search New avec une page de 20 résultats et le contexte de la ville choisie. Les résultats géographiquement étrangers à la ville sont exclus par le contrôle de 60 km existant. Les attributions Google restent affichées ; les fiches avec attributions tierces non rendues restent exclues comme auparavant.

La recherche Google dispose de 8 secondes. Le moteur réutilise sa réponse pour le repli et n'effectue pas de seconde recherche Google pour le même appel. Si Google fournit des suggestions, aucun appel OpenAI de résolution de lieu n'est nécessaire. Le délai éventuel de l'IA reste de 4,5 secondes et ses quotas sont conservés. La transcription audio possède ses propres coûts et limites, inchangés.

L'utilisation Google augmente par rapport au comportement défectueux qui la sautait sur les alias locaux. La pause de saisie de 700 ms existante est conservée. Aucun cache persistant Google, aucune nouvelle collecte, aucun journal de texte vocal ou de coordonnées ne sont ajoutés. Aucun catalogue, portail ou point géographique n'est inventé ou modifié.

## Installation Windows

Appliquer sur le projet actuel, après les correctifs de recherche et de voix déjà intégrés. Le micro qui fonctionne n'est pas modifié. Les `.env`, clés, assets, catalogue et bases restent conservés. Aucun ajout de dépendance.

1. Extraire `Pepo-Recherche-Lieux-Google.zip`.
2. Arrêter le backend avec `Ctrl+C`.
3. Dans PowerShell à la racine du monorepo existant :

```powershell
$patch = Read-Host "Chemin du dossier extrait contenant installer.cjs"
node (Join-Path $patch "installer.cjs") .
```

L'installateur vérifie les versions avant d'écrire, sauvegarde les sources remplacées et refuse les conflits. S'il refuse un fichier, conserver la version locale et transmettre le message. Ne pas renommer ni supprimer ce fichier pour contourner le contrôle.

4. Relancer l'API :

```powershell
npm run api
```

Aucun `npm install` ni nouvelle build iOS n'est nécessaire. Dans l'application déjà ouverte, fermer puis rouvrir Itinéraire et refaire la recherche. Si Expo doit être relancé :

```powershell
npm exec --workspace=@pepo/rider -- expo start --go --clear
```

La clé Google serveur et Places API New doivent rester configurées. Sans elles, seul le catalogue est disponible. Ne pas publier les clés.

## Recette téléphone

Comparer saisie et dictée pour :

1. « Psaro » et « Je vais à Psarou » : vérifier les branches que Google retourne à Lubumbashi.
2. « Hyper Psaro Carrefour », « Psaro centre-ville », « dépôt Psaro », « Psaro La Plage » : vérifier que la précision est conservée, puis choisir explicitement le bon résultat.
3. « Pullman », « Hôtel Pullman », « Hôtel Caravia » : comparer le résultat Google et le point sur la carte.
4. « Marché Karavia » : vérifier que la recherche n'est pas remplacée par l'hôtel.
5. Lieu avec entrées déclarées : vérifier que leur choix reste disponible.

Pour Pullman, l'adresse publiée par Accor est bien « 55 Route du Golf ». Ce texte d'adresse ne signifie pas que le point est placé sur la route. Le résultat Google utilise `places.location`. L'entrée routable réelle reste une vérification distincte.

Réussite attendue : mêmes branches proposées pour une recherche saisie ou dictée équivalente ; branche explicitement précisée retrouvable quand Google la fournit ; aucun point Google remplacé par celui d'un alias local. Mesurer au pilote les mauvais choix, le temps pour trouver une branche, la latence et le coût des recherches. Ces mesures n'ont pas encore été réalisées.

## Vérification technique et limites

TypeScript, lint et 141 tests réussis, dont 18 nouveaux cas de régression sur les branches, les alias, les entrées, le repli, les qualificatifs et les coordonnées. Compilation du backend réussie. L'installateur est vérifié pour l'installation, la seconde exécution sans changement, le refus sans écriture des conflits et la préservation des configurations et données.

Les tests Google et OpenAI emploient des réponses simulées. Aucun appel Google réel ni contrôle terrain du point Pullman n'a été effectué ici. L'utilisateur a confirmé le fonctionnement réel du micro après le correctif précédent ; ce correctif ne touche pas sa capture ni son transfert. La qualité des variantes linguistiques reste à vérifier avec des locuteurs.

## Références fournisseur consultées le 4 octobre 2026

- Google Text Search New : https://developers.google.com/maps/documentation/places/web-service/text-search
- Ressource Places et localisation : https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places
- Hôtel et adresse officielle : https://pullman.accor.com/fr/hotels/lubumbashi/A0T4.html
