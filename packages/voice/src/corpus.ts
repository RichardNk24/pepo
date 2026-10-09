export const CORPUS_CITIES = [
  "lubumbashi",
  "likasi",
  "kolwezi",
  "kasumbalesa",
] as const;
export type CorpusCity = (typeof CORPUS_CITIES)[number];
export type CorpusKind = "destination" | "place_name" | "navigation";
export type CorpusSample = {
  id: string;
  city: CorpusCity;
  kind: CorpusKind;
  profile: "sw-CD-katanga";
  prompt: string;
  expectedText: string;
  reviewed: boolean;
  revision: number;
  seconds: number;
  createdAt: number;
  test?: {
    transcript: string;
    latencyMs: number;
    model: string;
    revision: number;
  };
};
// Instructions in French; the contributor supplies authentic Katangese Swahili.
// No invented regional translation is treated as approved navigation.
export const CORPUS_PROMPTS: { kind: CorpusKind; text: string }[] = [
  {
    kind: "destination",
    text: "Dis naturellement : je voudrais aller à un hôtel que tu connais.",
  },
  { kind: "destination", text: "Dis : amène-moi au marché de ton choix." },
  {
    kind: "destination",
    text: "Dis : je vais à l’hôpital, en précisant son nom.",
  },
  {
    kind: "destination",
    text: "Dis : je rentre à la maison, en précisant le quartier.",
  },
  {
    kind: "destination",
    text: "Dis seulement le nom d’un lieu, comme à un chauffeur.",
  },
  {
    kind: "destination",
    text: "Demande une branche précise d’un commerce qui en a plusieurs.",
  },
  {
    kind: "destination",
    text: "Utilise un ancien nom d’hôtel ou un surnom local.",
  },
  {
    kind: "destination",
    text: "Mélange swahili et français comme dans une conversation habituelle.",
  },
  {
    kind: "destination",
    text: "Corrige-toi : pas ce lieu, plutôt un autre lieu.",
  },
  {
    kind: "destination",
    text: "Dis une destination avec un repère voisin, sans inventer d’adresse.",
  },
  {
    kind: "place_name",
    text: "Prononce Hyper Psaro et une branche que tu connais réellement.",
  },
  {
    kind: "place_name",
    text: "Prononce Pullman, Karavia ou Caravia selon ton usage local.",
  },
  {
    kind: "place_name",
    text: "Prononce le nom d’un marché ou d’une école de ta ville.",
  },
  { kind: "place_name", text: "Prononce le nom d’un quartier de ta ville." },
  {
    kind: "place_name",
    text: "Prononce un lieu de Likasi, Kolwezi ou Kasumbalesa que tu connais.",
  },
  {
    kind: "navigation",
    text: "Traduis naturellement : tournez à droite dans 100 mètres.",
  },
  {
    kind: "navigation",
    text: "Traduis naturellement : tournez à gauche au prochain carrefour.",
  },
  { kind: "navigation", text: "Traduis naturellement : continuez tout droit." },
  {
    kind: "navigation",
    text: "Traduis naturellement : vous êtes arrivé à destination.",
  },
  {
    kind: "navigation",
    text: "Traduis naturellement : la position est imprécise, suivez la carte.",
  },
];
