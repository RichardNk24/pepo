> Document conservé de la version précédente. Pour les commandes et chemins du monorepo, consultez [README.md](../README.md).

# Une identité Pepo et des images remplaçables

La palette se trouve dans `src/theme/tokens.ts` : noir doux `#20221F`, jaune `#F5D54C`, blanc et vert de sécurité. Les textes utilisent DM Sans, intégrée au bundle. Aucun chargement de police externe n’est nécessaire à l’utilisation.

L’app reprend les principes de la maquette sans en copier la marque : espace pour la carte, commandes sobres, choix de véhicules en cartes, un conducteur identifiable et un prix visible. La ligne du trajet est continue, sombre et lisible ; aucun motif pointillé n’est utilisé pour l’itinéraire.

## Images des motos

Les icônes actuelles sont des dessins SVG intégrés au code. Elles n’utilisent pas de photos externes. La fonction `VehicleArt` gère les cartes de véhicule et le marqueur vu de dessus. Prépare idéalement des WebP / PNG transparents :

| Usage                             | Fichier proposé     | Ratio approximatif |
| --------------------------------- | ------------------- | ------------------ |
| Moto standard, vue latérale       | `moto-side.webp`    | 1,8:1              |
| Moto confort, vue latérale        | `comfort-side.webp` | 1,8:1              |
| Taxi, vue latérale                | `taxi-side.webp`    | 1,8:1              |
| Moto pour la carte, vue du dessus | `moto-top.webp`     | 1:1,65             |

Place-les dans `assets/vehicles/` puis remplace le registre dans `src/components/VehicleArt.tsx` :

```tsx
export const VEHICLE_IMAGES = {
  moto: require("../../assets/vehicles/moto-side.webp"),
  comfort: require("../../assets/vehicles/comfort-side.webp"),
  taxi: require("../../assets/vehicles/taxi-side.webp"),
  top: require("../../assets/vehicles/moto-top.webp"),
};
```

Les chemins doivent être statiques pour que Metro intègre les fichiers dans le bundle. La vue du dessus pointe vers le haut ; une rotation ultérieure peut suivre le cap GPS. La version livrée ne calcule pas encore le cap du marqueur à partir d’un historique de positions.

La carte Google web utilise actuellement des marqueurs vectoriels circulaires. Pour remplacer son marqueur conducteur par une photo du dessus, adapte le marqueur du moteur partagé `src/maps/googleDocument.ts` avec une icône Google Maps et ses dimensions ; le registre ci-dessus couvre les cartes Expo natives et les cartes démo.

## Les cartes

- `MapBoard.native.tsx` : Google WebView dans Expo Go SDK 57 lorsque le serveur cartes est configuré ; carte Apple de secours sans ce serveur ; SDK Google natif dans une future build configurée. Le tracé reste continu dans les deux cas.
- `MapBoard.web.tsx` : même moteur Google JavaScript que la WebView, sinon carte démo.
- `DemoMap.tsx` : dessin schématique explicitement identifié, destiné aux tests sans clé.
- `MapTypes.ts` : style Google partagé et propriétés communes.

La carte de démonstration n’est pas une cartographie officielle de Lubumbashi, Kinshasa ou Kolwezi. Les coordonnées du catalogue sont des repères approximatifs à valider avant le pilote. Quand Google est configuré, son attribution reste présente et la route provient du serveur Google Routes.

## Langues

`src/data/i18n.ts` centralise les libellés principaux en français, anglais et swahili. La langue est conservée dans les préférences. Plusieurs formulaires, contrôles administrateur et messages d’erreur sont encore en français. Une localisation intégrale et une relecture du swahili par des locuteurs des zones de lancement sont nécessaires avant diffusion locale.
