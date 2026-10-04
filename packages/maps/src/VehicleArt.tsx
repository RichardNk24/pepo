import { C } from "@pepo/config/tokens";
import type { VehicleKind } from "@pepo/types/model";
import { Image } from "react-native";
import Svg,{
Circle,
Ellipse,
G,
Path,
Rect,
Image as SvgImage,
} from "react-native-svg";
import { MapVehicle } from "./MapVehicle";
import { VEHICLE_IMAGES } from "./vehicleCatalog.generated";
export { VEHICLE_IMAGES } from "./vehicleCatalog.generated";

const CATALOG_FRAMES = {
  moto: {
    width: 339,
    height: 735,
    viewBox: "0 182 339 339",
  },

  comfort: {
    width: 339,
    height: 735,
    viewBox: "0 182 339 339",
  },

  taxi: {
    width: 339,
    height: 735,
    // Ancien : 27 292 294 195
    // Beaucoup trop serré à gauche/droite.
    viewBox: "0 280 339 210",
  },

  suv: {
    width: 339,
    height: 735,
    // Plus de sécurité devant et derrière.
    viewBox: "0 255 339 225",
  },

  minibus: {
    width: 339,
    height: 735,
    // Ancien : 25 258 278 217
    // Le véhicule utilise quasiment toute la largeur.
    viewBox: "0 255 339 225",
  },

  truck: {
    width: 339,
    height: 735,
    viewBox: "0 250 339 275",
  },

  pickupTruck: {
    width: 339,
    height: 735,
    // Ton ancien cadrage était déjà plutôt bon,
    // mais celui-ci laisse une petite marge de sécurité.
    viewBox: "0 210 339 305",
  },

  tricycle: {
    width: 339,
    height: 735,
    // Ancien : 19 191 301 334
    viewBox: "0 190 339 340",
  },
};
export function VehicleArt({
  kind = "moto",
  width = 112,
  top = false,
}: {
  kind?: VehicleKind;
  width?: number;
  top?: boolean;
}) {
  if (top) return <MapVehicle kind={kind} width={width} />;
  const source = VEHICLE_IMAGES[kind];
  const frame = CATALOG_FRAMES[kind as keyof typeof CATALOG_FRAMES];

  if (source && frame) {
    return (
      <Svg
        width={width}
        height={width * 0.72}
        viewBox={frame.viewBox}
        preserveAspectRatio="xMidYMid meet"
      >
        <SvgImage
          href={source}
          x={0}
          y={0}
          width={frame.width}
          height={frame.height}
        />
      </Svg>
    );
  }
  if (source)
    return (
      <Image
        source={source}
        resizeMode="contain"
        style={{ width, height: width * 0.72 }}
        accessibilityLabel={kind}
      />
    );
  if (
    [
      "suv",
      "fourByFour",
      "truck",
      "pickupTruck",
      "tricycle",
      "minibus",
    ].includes(kind)
  )
    return (
      <Svg width={width} height={width * 0.56} viewBox="0 0 130 73">
        <Ellipse cx="65" cy="63" rx="58" ry="4" fill="#1B231515" />
        <Path
          d="M8 47 L12 31 L27 29 L34 12 L89 12 L102 30 L121 34 L124 54 L8 54 Z"
          fill={kind === "fourByFour" ? "#443D03" : C.yellow}
          stroke="#706405"
          strokeWidth="2"
        />
        <Path
          d="M32 28 L38 17 L58 17 L58 28 Z M64 17 L85 17 L95 28 L64 28 Z"
          fill="#BED3CF"
        />
        <Path
          d="M62 32 L62 49 M14 52 L116 52"
          stroke="#706405"
          strokeWidth="2"
        />
        <Rect x="35" y="8" width="50" height="3" rx="1" fill={C.ink} />
        <Circle cx="30" cy="54" r="12" fill={C.ink} />
        <Circle cx="30" cy="54" r="6" fill="#D9DED4" />
        <Circle cx="101" cy="54" r="12" fill={C.ink} />
        <Circle cx="101" cy="54" r="6" fill="#D9DED4" />
        <Rect x="114" y="35" width="9" height="6" rx="2" fill="#FFF7D8" />
      </Svg>
    );
  if (kind === "taxi")
    return (
      <Svg width={width} height={width * 0.56} viewBox="0 0 130 73">
        <Ellipse cx="65" cy="59" rx="57" ry="4" fill="#1B231515" />
        <Path
          d="M9 40 Q10 33 28 32 L43 17 Q50 13 75 16 L94 31 Q116 32 121 41 L120 52 L9 52Z"
          fill={C.yellow}
          stroke="#CFB13D"
          strokeWidth="1.5"
        />
        <Path
          d="M36 31 L47 20 L61 20 L61 31 Z M66 20 L77 20 L90 31 L66 31 Z"
          fill="#B9D3C8"
        />
        <Path d="M65 33 L65 49" stroke="#CCAA2F" />
        <Rect x="55" y="11" width="18" height="6" rx="2" fill="#232A27" />
        <Circle cx="31" cy="51" r="10" fill="#2B302A" />
        <Circle cx="31" cy="51" r="5" fill="#D9DED4" />
        <Circle cx="100" cy="51" r="10" fill="#2B302A" />
        <Circle cx="100" cy="51" r="5" fill="#D9DED4" />
        <Rect x="111" y="37" width="9" height="5" rx="2" fill="#FFF5C9" />
        <Rect x="10" y="38" width="5" height="6" rx="1" fill="#BC4E38" />
      </Svg>
    );
  return (
    <Svg width={width} height={width * 0.56} viewBox="0 0 130 73">
      <Ellipse cx="65" cy="61" rx="56" ry="4" fill="#1B231515" />
      <G fill="none" stroke="#252C27" strokeWidth="4">
        <Circle cx="28" cy="49" r="16" />
        <Circle cx="105" cy="49" r="16" />
      </G>
      <G fill="none" stroke="#A5ACA4" strokeWidth="2">
        <Circle cx="28" cy="49" r="10" />
        <Circle cx="105" cy="49" r="10" />
      </G>
      <Path
        d="M28 49 L45 32 L74 49 L105 49 L91 18"
        stroke="#373E35"
        strokeWidth="4"
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M39 33 L43 22 L60 22 L78 31 L73 43 L50 42Z"
        fill={kind === "comfort" ? "#C5D7CA" : C.yellow}
        stroke="#AD9E51"
        strokeWidth="1.2"
      />
      <Path
        d="M47 23 L65 23 L78 27"
        stroke="#262E29"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <Path
        d="M77 29 L89 22 L98 22"
        stroke={C.yellow}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <Path
        d="M87 19 L92 13 L101 13"
        stroke="#30372E"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <Circle
        cx="101"
        cy="21"
        r="5"
        fill="#FFF8DD"
        stroke="#3A4136"
        strokeWidth="2"
      />
      <Path
        d="M43 43 L71 45"
        stroke="#555E52"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <Path
        d="M14 29 L32 29 L40 34"
        stroke={C.yellow}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <Circle cx="28" cy="49" r="3" fill="#687462" />
      <Circle cx="105" cy="49" r="3" fill="#687462" />
    </Svg>
  );
}
