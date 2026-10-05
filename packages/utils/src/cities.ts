import type {
  CityId,
  Place,
  PublicDriver,
  ActiveVehicleKind,
} from "@pepo/types/model";
export const CITIES: Record<
  CityId,
  { name: string; center: { latitude: number; longitude: number } }
> = {
  lubumbashi: {
    name: "Lubumbashi",
    center: { latitude: -11.664, longitude: 27.479 },
  },
  kinshasa: {
    name: "Kinshasa",
    center: { latitude: -4.316, longitude: 15.303 },
  },
  kolwezi: {
    name: "Kolwezi",
    center: { latitude: -10.716, longitude: 25.467 },
  },
};
const place = (
  id: string,
  name: string,
  address: string,
  city: CityId,
  latitude: number,
  longitude: number,
): Place => ({ id, name, address, city, latitude, longitude });
// Approximate curated landmarks, editable before a city pilot. Google search supplies actual places in live mode.
export const PLACES: Place[] = [
  place(
    "l-1",
    "Place de la Poste",
    "Centre-ville · Lubumbashi",
    "lubumbashi",
    -11.6645,
    27.4827,
  ),
  place(
    "l-2",
    "Marché Kenya",
    "Commune Kenya · Lubumbashi",
    "lubumbashi",
    -11.6878,
    27.4703,
  ),
  place(
    "l-3",
    "Golf Malela",
    "Quartier Golf · Lubumbashi",
    "lubumbashi",
    -11.6388,
    27.4715,
  ),
  place(
    "l-4",
    "Université de Lubumbashi",
    "Campus Kasapa · Lubumbashi",
    "lubumbashi",
    -11.6105,
    27.4834,
  ),
  place(
    "l-5",
    "Aéroport de Luano",
    "Luano · Lubumbashi",
    "lubumbashi",
    -11.5914,
    27.5309,
  ),
  place(
    "l-6",
    "Hyper Psaro",
    "Centre-ville · Lubumbashi",
    "lubumbashi",
    -11.6681,
    27.4781,
  ),
  place(
    "k-1",
    "Gare centrale",
    "Gombe · Kinshasa",
    "kinshasa",
    -4.3058,
    15.3176,
  ),
  place(
    "k-2",
    "Boulevard du 30 Juin",
    "Gombe · Kinshasa",
    "kinshasa",
    -4.3088,
    15.2995,
  ),
  place(
    "k-3",
    "Place des Évolués",
    "Gombe · Kinshasa",
    "kinshasa",
    -4.3049,
    15.3093,
  ),
  place(
    "k-4",
    "Marché de la Liberté",
    "Masina · Kinshasa",
    "kinshasa",
    -4.3903,
    15.4067,
  ),
  place(
    "k-5",
    "Université de Kinshasa",
    "Mont Amba · Kinshasa",
    "kinshasa",
    -4.4198,
    15.3087,
  ),
  place(
    "c-1",
    "Centre-ville Kolwezi",
    "Dilala · Kolwezi",
    "kolwezi",
    -10.7167,
    25.4667,
  ),
  place(
    "c-2",
    "Marché Manika",
    "Manika · Kolwezi",
    "kolwezi",
    -10.7216,
    25.4824,
  ),
  place("c-3", "Aéroport de Kolwezi", "Kolwezi", "kolwezi", -10.7659, 25.5057),
];
export const VEHICLES: {
  id: ActiveVehicleKind;
  name: string;
  detail: string;
  seats: number;
}[] = [
  { id: "moto", name: "Pepo", detail: "Simple. Rapide. Local.", seats: 1 },
  {
    id: "motoSend",
    name: "Pepo Send",
    detail: "Moto avec un espace pour vos colis.",
    seats: 1,
  },
  { id: "taxi", name: "Taxi", detail: "De la place pour vous.", seats: 4 },
  {
    id: "suv",
    name: "SUV",
    detail: "Plus d’espace pour vos déplacements.",
    seats: 4,
  },
  {
    id: "minibus",
    name: "Minibus",
    detail: "Pour vos déplacements en groupe.",
    seats: 6,
  },
  {
    id: "tricycle",
    name: "Petita",
    detail: "Pour les déplacements locaux.",
    seats: 2,
  },
  {
    id: "pickupTruck",
    name: "Pick-up",
    detail: "Pour vous et vos objets volumineux.",
    seats: 2,
  },
  {
    id: "truck",
    name: "Camion",
    detail: "Transport de marchandises · capacité à confirmer.",
    seats: 1,
  },
];
export const DEMO_DRIVERS: PublicDriver[] = [
  {
    id: "demo-patrick",
    name: "Patrick Mbuyi",
    verification: "demo",
    rating: 4.9,
    trips: 248,
    driver: {
      vehicle: "moto",
      model: "Haojue HJ125",
      plate: "LSH 2841 AB",
      helmet: true,
    },
  },
  {
    id: "demo-joseph",
    name: "Joseph Kabeya",
    verification: "demo",
    rating: 4.8,
    trips: 176,
    driver: {
      vehicle: "moto",
      model: "TVS HLX 125",
      plate: "LSH 1936 CD",
      helmet: true,
    },
  },
  {
    id: "demo-sarah",
    name: "Sarah Ilunga",
    verification: "demo",
    rating: 5,
    trips: 312,
    driver: {
      vehicle: "moto",
      model: "Bajaj Boxer",
      plate: "LSH 4287 EF",
      helmet: true,
    },
  },
];
