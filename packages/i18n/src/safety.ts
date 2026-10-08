import type { Language } from "@pepo/types/model";
const copy = {
  day: [
    "Sécurité du trajet",
    "Trip safety",
    "Usalama wa safari",
    "Bobateli ya mobembo",
  ],
  night: ["Pepo la nuit", "Pepo at night", "Pepo usiku", "Pepo na butu"],
  notice: [
    "La nuit, le dossier du conducteur et le GPS sont vérifiés avant le départ.",
    "At night, driver approval and GPS are checked before departure.",
    "Usiku, idhini ya dereva na GPS hukaguliwa kabla ya kuondoka.",
    "Na butu, kondima mokumbi mpe GPS etalelami liboso ya kolongwa.",
  ],
  limitations: [
    "Le suivi GPS dépend de l’application du conducteur ouverte et du réseau.",
    "GPS tracking requires the driver app to be open and connected.",
    "Ufuatiliaji wa GPS unahitaji programu ya dereva iwe wazi na mtandao.",
    "Kolanda GPS esengaka ete appli ya mokumbi ezala polele mpe réseau ezala.",
  ],
  check: [
    "Tout va bien ?",
    "Is everything OK?",
    "Kila kitu kiko sawa?",
    "Nyonso ezali malamu?",
  ],
  stop: [
    "Un arrêt prolongé a été observé.",
    "A longer stop was observed.",
    "Kusimama kwa muda mrefu kumetambuliwa.",
    "Bomonaki ete mobembo etelemi ntango molai.",
  ],
  deviation: [
    "Le trajet s’écarte du parcours prévu.",
    "The trip has moved away from the planned route.",
    "Safari imeacha njia iliyopangwa.",
    "Mobembo epengwi na nzela oyo ebongisamaki.",
  ],
  gps_unavailable: [
    "La position n’a pas été actualisée récemment.",
    "The location has not been updated recently.",
    "Mahali hapajasasishwa hivi karibuni.",
    "Esika etindikami lisusu te banda mwa ntango.",
  ],
  ok: [
    "Oui, tout va bien",
    "Yes, all OK",
    "Ndiyo, niko sawa",
    "Ee, nyonso malamu",
  ],
  help: ["Besoin d’aide", "I need help", "Nahitaji msaada", "Nalingi lisalisi"],
  queued: [
    "Demande enregistrée. Personne ne l’a encore prise en charge.",
    "Request saved. No one has taken it yet.",
    "Ombi limehifadhiwa. Hakuna aliyelipokea bado.",
    "Bosengi ekomami. Moto azwi yango naino te.",
  ],
  acknowledged: [
    "Une personne de Pepo a pris en charge votre demande.",
    "A Pepo operator has taken your request.",
    "Mhudumu wa Pepo amepokea ombi lako.",
    "Moto ya Pepo azwi bosengi na yo.",
  ],
  resolved: [
    "Demande clôturée par Pepo.",
    "Request closed by Pepo.",
    "Ombi limefungwa na Pepo.",
    "Pepo esilisi bosengi.",
  ],
  call: [
    "Appeler l’assistance",
    "Call support",
    "Piga simu kwa msaada",
    "Benga lisalisi",
  ],
  noPhone: [
    "Aucun numéro d’assistance n’est configuré. En cas de danger immédiat, contactez les secours locaux ou une personne de confiance.",
    "No support number is configured. In immediate danger, contact local emergency services or someone you trust.",
    "Namba ya msaada haijawekwa. Katika hatari ya haraka, wasiliana na huduma za dharura au mtu unayemwamini.",
    "Numéro ya lisalisi etyami te. Soki likama ezali sikoyo, benga secours ya esika to moto oyo otyelaka motema.",
  ],
  sending: ["Envoi en cours…", "Sending…", "Tunatuma…", "Tozali kotinda…"],
  unavailable: [
    "Action indisponible pour cette course. Actualisez puis réessayez.",
    "Action unavailable for this trip. Refresh and retry.",
    "Kitendo hakipatikani kwa safari hii. Sasisha na ujaribu tena.",
    "Likambo oyo ekoki kosalema te mpo na mobembo oyo. Actualiser mpe meka lisusu.",
  ],
  error: [
    "Connexion interrompue. Votre demande n’est pas confirmée. Réessayez.",
    "Connection interrupted. Your request is not confirmed. Retry.",
    "Mtandao umekatika. Ombi lako halijathibitishwa. Jaribu tena.",
    "Réseau ekatani. Bosengi na yo endimami te. Meka lisusu.",
  ],
  loadError: [
    "État de sécurité indisponible. Réessayez.",
    "Safety status unavailable. Retry.",
    "Hali ya usalama haipatikani. Jaribu tena.",
    "État ya bobateli ezali te. Meka lisusu.",
  ],
  retry: ["Réessayer", "Retry", "Jaribu tena", "Meka lisusu"],
  close: ["Fermer", "Close", "Funga", "Kanga"],
  last: [
    "Dernière position reçue",
    "Last location received",
    "Mahali pa mwisho palipopokelewa",
    "Esika ya nsuka oyo ezwami",
  ],
  missing: [
    "Position en attente",
    "Waiting for location",
    "Tunasubiri mahali",
    "Tozali kozela esika",
  ],
  stale: [
    "Position ancienne",
    "Old location",
    "Mahali pa zamani",
    "Esika ya kala",
  ],
  imprecise: [
    "GPS imprécis",
    "GPS imprecise",
    "GPS si sahihi",
    "GPS ezali ya sikisiki te",
  ],
  share: [
    "Partager le trajet",
    "Share trip",
    "Shiriki safari",
    "Kabola mobembo",
  ],
  revoke: [
    "Arrêter mon partage",
    "Stop my sharing",
    "Acha kushiriki kwangu",
    "Tika kokabola na ngai",
  ],
  revoked: [
    "Vos liens de suivi ont été désactivés.",
    "Your tracking links were disabled.",
    "Viungo vyako vya ufuatiliaji vimezimwa.",
    "Liens na yo ya kolanda ekangami.",
  ],
  stopReason: [
    "Signaler un arrêt",
    "Report a stop",
    "Ripoti kusimama",
    "Yebisa kotelema",
  ],
  checkpoint: [
    "Contrôle / barrage",
    "Checkpoint",
    "Kizuizi / ukaguzi",
    "Contrôle / barrage",
  ],
  traffic: ["Circulation", "Traffic", "Msongamano", "Mbilinga ya mituka"],
  vehicle: [
    "Problème du véhicule",
    "Vehicle issue",
    "Tatizo la gari",
    "Mokakatano ya motuka",
  ],
  other: ["Autre raison", "Other reason", "Sababu nyingine", "Ntina mosusu"],
  stopSaved: [
    "Raison enregistrée. Le suivi continue.",
    "Reason saved. Monitoring continues.",
    "Sababu imehifadhiwa. Ufuatiliaji unaendelea.",
    "Ntina ekomami. Kolanda ekobi.",
  ],
  demo: [
    "Démo : aucune surveillance ni assistance réelle.",
    "Demo: no real monitoring or support.",
    "Mfano: hakuna ufuatiliaji au msaada wa kweli.",
    "Démo: kolanda mpe lisalisi ya solo ezali te.",
  ],
  NIGHT_REVIEW_REQUIRED: [
    "Ce conducteur doit être autorisé pour les courses de nuit.",
    "This driver needs approval for night trips.",
    "Dereva huyu anahitaji idhini kwa safari za usiku.",
    "Mokumbi oyo asengeli kondimama mpo na mobembo ya butu.",
  ],
  SAFETY_GPS_REQUIRED: [
    "Actualisez le GPS puis réessayez.",
    "Refresh GPS and retry.",
    "Sasisha GPS na ujaribu tena.",
    "Zwa GPS ya sika mpe meka lisusu.",
  ],
  SAFETY_PICKUP_DISTANCE: [
    "Rejoignez le point de départ puis réessayez.",
    "Reach the pickup point and retry.",
    "Fika mahali pa kuchukulia na ujaribu tena.",
    "Koma na esika ya kolongwa mpe meka lisusu.",
  ],
} as const;
const safetyIndex = new Map<string, readonly string[]>(
  Object.values(copy).map((values) => [values[0], values]),
);
export function translateSafetyCopy(language: Language, source: string) {
  if (
    [
      "Actualisez la position GPS du conducteur avant cette course de nuit.",
      "Cette position GPS est trop ancienne. Actualisez-la.",
      "Actualisez la position GPS avant de confirmer le départ.",
    ].includes(source)
  )
    return safetyText(language, "SAFETY_GPS_REQUIRED");
  if (
    source ===
    "Rejoignez le point de départ avant de confirmer l’arrivée ou le départ."
  )
    return safetyText(language, "SAFETY_PICKUP_DISTANCE");
  return safetyIndex.get(source)?.[
    ({ fr: 0, en: 1, sw: 2, ln: 3 } as const)[language]
  ];
}
export type SafetyKey = keyof typeof copy;
export function safetyText(language: Language, key: SafetyKey) {
  return copy[key][({ fr: 0, en: 1, sw: 2, ln: 3 } as const)[language] ?? 0];
}
