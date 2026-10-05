# Lieux enregistrés et destinations personnalisées

## Version livrée

Le backend fournit trois fonctions privées au compte passager : les lieux enregistrés, les destinations fréquentes et les lieux récemment visités. Les suggestions sont calculées localement par l’API à partir des courses terminées. Aucune phrase, position ou historique personnel n’est envoyé à OpenAI pour ce classement; il ne consomme donc pas de tokens.

Le classement couvre au plus 300 courses terminées des 365 derniers jours, dans la ville du compte. Il tient compte de la répétition, de la récence, du jour de la semaine, du caractère semaine/week-end et de l’heure locale de départ (`Africa/Lubumbashi`). Il faut au moins deux courses vers un même lieu avant qu’il apparaisse comme destination fréquente. Les lieux récents sont disponibles dès les premières courses. Deux Google Place IDs différents restent deux lieux distincts; seuls des repères choisis par pin à moins de 70 m peuvent être regroupés.

Le prix n’influence pas encore le classement : les courses enregistrent un prix proposé ou négocié, pas une confirmation fiable du montant effectivement payé. Le classer comme une dépense réelle créerait un signal trompeur. Quand un paiement final vérifié sera disponible, son usage pourra être ajouté séparément.

## Endpoints

Tous les endpoints ci-dessous requièrent `Authorization: Bearer <session>`. Les réponses personnelles utilisent `Cache-Control: private, no-store`.

### Obtenir les suggestions, les lieux récents et les lieux enregistrés

```http
GET /api/places/suggestions?city=lubumbashi
```

La ville doit correspondre à la ville actuelle du compte.

```json
{
  "savedPlaces": [],
  "suggestions": [
    {
      "place": {
        "id": "google-place-id",
        "name": "Université de Lubumbashi",
        "address": "Campus de Kasapa, Lubumbashi",
        "city": "lubumbashi",
        "latitude": -11.6,
        "longitude": 27.4
      },
      "visitCount": 5,
      "lastVisitedAt": 1791190800000,
      "reason": "usual_time"
    }
  ],
  "recent": [],
  "completedTripsAnalyzed": 12,
  "personalizationEnabled": true,
  "generatedAt": 1791194400000
}
```

`reason` est un code à traduire dans l’application : `frequent` ou `usual_time`. `savedPlaces` est renvoyé ici pour que l’écran « Où allez-vous ? » puisse charger ses contenus en une seule requête.

### Lire et enregistrer les lieux personnels

```http
GET /api/me/saved-places
```

```http
PUT /api/me/saved-places/{id-stable}
Content-Type: application/json
```

```json
{
  "category": "home",
  "label": "Maison",
  "note": "Entrée près de la pharmacie",
  "place": {
    "id": "google-place-id",
    "name": "Avenue des Écoles",
    "address": "Lubumbashi",
    "city": "lubumbashi",
    "latitude": -11.6,
    "longitude": 27.4
  }
}
```

Catégories : `home`, `work`, `school`, `hospital`, `favorite`, `custom`. L’identifiant stable est généré par le client (UUID recommandé). `PUT` crée ou met à jour le même lieu et peut être réessayé sans créer de doublon, utile en cas de réseau mobile instable. L’API accepte jusqu’à 30 lieux par compte. `note` peut contenir une indication courte, par exemple une entrée ou un repère connu.

```http
DELETE /api/me/saved-places/{id-stable}
```

Le même lieu enregistré peut être choisi comme point de départ ou destination; le rôle dépend du champ que l’écran remplit.

### Contrôler la personnalisation

```http
GET /api/me/place-preferences
PUT /api/me/place-preferences
Content-Type: application/json

{"personalizedSuggestions": false}
```

La personnalisation est activée par défaut. La désactiver masque les destinations apprises et les lieux récents, sans retirer les lieux enregistrés ni l’historique de course.

## Client mobile

`packages/api-client/src/maps.ts` expose déjà :

- `getPersonalPlaceSuggestions(city?)`
- `getSavedPlaces()`
- `savePlace(input)`
- `deleteSavedPlace(id)`
- `getPlacePersonalizationPreferences()`
- `setPlacePersonalizationPreferences(preferences)`

L’écran peut afficher au maximum trois destinations apprises, les lieux enregistrés en tête et les récents ensuite. Les codes de raison sont destinés à être localisés en français, anglais, swahili ou lingala côté application.

## Stockage et performances

- `saved_places` conserve les lieux et notes séparément des profils, avec une clé de compte et un index de lecture.
- `place_preferences` conserve l’activation personnelle.
- Les suggestions relisent un ensemble borné de courses terminées via un index SQLite `(riderId, city, status, createdAt)`; aucun profil comportemental supplémentaire n’est nécessaire.
- Les requêtes sont filtrées par l’identifiant du compte authentifié; les lieux d’un passager ne sont jamais exposés à un autre compte.
