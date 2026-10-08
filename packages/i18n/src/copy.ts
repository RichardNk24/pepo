import { translateSafetyCopy } from "./safety";
import type { Language } from "@pepo/types/model";
import { catalogs } from "./catalog";
export const copyTranslations: Record<
  string,
  readonly [string, string, string]
> = {
  "Ma position": ["My location", "Eneo langu", "Esika nazali"],
  "Votre offre": ["Your offer", "Bei yako", "Ntalo na yo"],
  "Votre offre · à confirmer": [
    "Your offer · to confirm",
    "Bei yako · thibitisha",
    "Ntalo na yo · esengeli kondima",
  ],
  "Pour moi": ["For me", "Kwa ajili yangu", "Mpo na ngai"],
  "Pour quelqu’un d’autre": [
    "For someone else",
    "Kwa mtu mwingine",
    "Mpo na moto mosusu",
  ],
  "Pour la démo, utilisez le code 2468.": [
    "Use code 2468 for the demo.",
    "Tumia msimbo 2468 kwa jaribio.",
    "Na demo, salela code 2468.",
  ],
  Recommandés: ["Recommended", "Zinazopendekezwa", "Oyo tolingisi"],
  "Plus rapide": ["Faster", "Haraka zaidi", "Mbangu koleka"],
  "Moins cher": ["Cheaper", "Bei nafuu", "Ntalo moke"],
  "À négocier": ["Negotiable", "Bei ya kujadiliana", "Ntalo ya koyokana"],
  "à négocier": ["negotiable", "bei ya kujadiliana", "ntalo ya koyokana"],
  Négocier: ["Negotiate", "Jadili bei", "Yokana na ntalo"],
  "Prix convenu": ["Agreed fare", "Bei mliyokubaliana", "Ntalo bondimi"],
  "Montant convenu": [
    "Agreed amount",
    "Kiasi mlichokubaliana",
    "Mbongo bondimi",
  ],
  "Offre expirée": ["Offer expired", "Bei imepitwa na wakati", "Offre esili"],
  "On en discute ?": [
    "Shall we discuss the price?",
    "Tujadiliane bei?",
    "Toyokana na ntalo?",
  ],
  "On reste avec vous.": [
    "We are here for you.",
    "Tuko pamoja nawe.",
    "Tozali elongo na yo.",
  ],
  "Baisser mon offre": [
    "Lower my offer",
    "Punguza bei yangu",
    "Kitisa ntalo na ngai",
  ],
  "Augmenter mon offre": [
    "Increase my offer",
    "Ongeza bei yangu",
    "Matisa ntalo na ngai",
  ],
  "Baisser la contre-offre": [
    "Lower the counteroffer",
    "Punguza bei nyingine",
    "Kitisa ntalo mosusu",
  ],
  "Augmenter la contre-offre": [
    "Increase the counteroffer",
    "Ongeza bei nyingine",
    "Matisa ntalo mosusu",
  ],
  "Envoyer ma contre-offre": [
    "Send my counteroffer",
    "Tuma bei nyingine",
    "Tinda ntalo mosusu",
  ],
  "Options du passager et du prix": [
    "Passenger and fare options",
    "Chaguo za abiria na bei",
    "Ba options ya passager mpe ntalo",
  ],
  "Passager et offre": [
    "Passenger and fare",
    "Abiria na bei",
    "Passager mpe ntalo",
  ],
  "Nom du passager": ["Passenger name", "Jina la abiria", "Nkombo ya passager"],
  "Téléphone du passager": [
    "Passenger phone",
    "Simu ya abiria",
    "Telefone ya passager",
  ],
  "Autre passager": ["Another passenger", "Abiria mwingine", "Passager mosusu"],
  "Passager fictif": [
    "Demo passenger",
    "Abiria wa majaribio",
    "Passager ya demo",
  ],
  "Passager invité · téléphone non vérifié": [
    "Guest passenger · phone not verified",
    "Abiria mgeni · simu haijathibitishwa",
    "Passager mosusu · telefone endimami te",
  ],
  "Passager · téléphone confirmé": [
    "Passenger · phone confirmed",
    "Abiria · simu imethibitishwa",
    "Passager · telefone endimami",
  ],
  "Passager · téléphone non confirmé": [
    "Passenger · phone not confirmed",
    "Abiria · simu haijathibitishwa",
    "Passager · telefone endimami te",
  ],
  "Le passager est d’accord pour partager son numéro avec le conducteur et j’ai vérifié son lieu de départ.":
    [
      "The passenger agrees to share their number with the driver and I checked the pickup.",
      "Abiria amekubali kushiriki namba yake na dereva na nimeangalia mahali pa kuanzia.",
      "Passager andimi kopesa mokumbi nimero na ye mpe natali esika ya départ.",
    ],
  "Touchez le départ dans la barre de la carte pour indiquer où le conducteur doit retrouver cette personne. Vous gardez le suivi de la course.":
    [
      "Tap the pickup in the map bar to show where to meet this person. You can follow the ride.",
      "Bonyeza mahali pa kuanzia kwenye ramani ili kuonyesha dereva atakutana na mtu huyu wapi. Unaweza kufuatilia safari.",
      "Fina départ na barre ya karte mpo na kolakisa esika mokumbi akokutana na moto oyo. Okoki kolanda course.",
    ],
  "Transmettez le code de départ au passager. Aucun SMS automatique n’est envoyé.":
    [
      "Give the pickup code to the passenger. No SMS is sent automatically.",
      "Mpe abiria msimbo wa kuanza. SMS haitumwi yenyewe.",
      "Pesa passager code ya départ. SMS etindamaka yango moko te.",
    ],
  "Votre trajet continue.": [
    "Your ride continues.",
    "Safari yako inaendelea.",
    "Course na yo ezali kokoba.",
  ],
  "Retrouver ma course": [
    "Return to my ride",
    "Rudi kwenye safari yangu",
    "Zonga na course na ngai",
  ],
  "Voir tout le trajet": [
    "Show the whole route",
    "Onyesha njia yote",
    "Lakisa nzela mobimba",
  ],
  "Recalculer le trajet": [
    "Recalculate route",
    "Hesabu njia tena",
    "Tanga nzela lisusu",
  ],
  "Retour à l’accueil": ["Back to home", "Rudi mwanzo", "Zonga na accueil"],
  "Retour à la recherche": [
    "Back to search",
    "Rudi kutafuta",
    "Zonga na koluka",
  ],
  "Revenir à ma position": [
    "Return to my location",
    "Rudi kwenye eneo langu",
    "Zonga na esika nazali",
  ],
  "Modifier le départ": ["Edit pickup", "Badilisha kuanzia", "Bongola départ"],
  "Modifier la destination": [
    "Edit destination",
    "Badilisha mwisho",
    "Bongola destination",
  ],
  "Ajouter ou modifier les étapes": [
    "Add or edit stops",
    "Ongeza au badilisha vituo",
    "Bakisa to bongola ba arrêts",
  ],
  "Étapes du trajet": ["Ride stops", "Vituo vya safari", "Ba arrêts ya course"],
  "Ajouter une étape": ["Add a stop", "Ongeza kituo", "Bakisa arrêt"],
  "Supprimer cette étape": [
    "Remove this stop",
    "Ondoa kituo hiki",
    "Longola arrêt oyo",
  ],
  "Avancer cette étape": [
    "Move this stop earlier",
    "Sogeza kituo hiki mbele",
    "Tia arrêt oyo liboso",
  ],
  "3 étapes maximum.": ["Up to 3 stops.", "Vituo 3 tu.", "Ba arrêts 3 kaka."],
  "Calcul de l’ordre…": [
    "Calculating stop order…",
    "Tunapanga vituo…",
    "Tozali kobongisa ba arrêts…",
  ],
  "Ordre conseillé": [
    "Suggested order",
    "Mpangilio unaopendekezwa",
    "Molongo oyo tolingisi",
  ],
  "Garder mon ordre": [
    "Keep my order",
    "Tumia mpangilio wangu",
    "Bomba molongo na ngai",
  ],
  "Vos étapes seront suivies dans cet ordre.": [
    "Your stops will be visited in this order.",
    "Vituo vitafuatwa katika mpangilio huu.",
    "Ba arrêts na yo ekolanda molongo oyo.",
  ],
  "Étapes organisées selon le trajet routier. La destination reste à la fin.": [
    "Stops ordered along the road route. The destination stays last.",
    "Vituo vimepangwa kulingana na barabara. Mwisho wa safari unabaki mwisho.",
    "Ba arrêts ebongisami kolanda nzela. Destination etikali na suka.",
  ],
  "Ordre estimé en démo, sans les contraintes des routes.": [
    "Demo order estimate, without road constraints.",
    "Mpangilio wa makadirio bila hali za barabara.",
    "Molongo ya estimation na demo, kozanga mibeko ya nzela.",
  ],
  "Destination finale :": [
    "Final destination:",
    "Mwisho wa safari:",
    "Destination ya suka:",
  ],
  "Départ :": ["Pickup:", "Kuanzia:", "Départ:"],
  "Où voulez-vous aller ?": [
    "Where do you want to go?",
    "Unataka kwenda wapi?",
    "Olingi kokende wapi?",
  ],
  "Où vous retrouver ?": [
    "Where should we meet you?",
    "Tukupate wapi?",
    "Tokutana na yo wapi?",
  ],
  "Déplacez la carte sous le repère.": [
    "Move the map under the pin.",
    "Sogeza ramani chini ya alama.",
    "Tambwisa karte na nse ya repère.",
  ],
  "Relâchez la carte pour choisir cet endroit.": [
    "Release the map to choose this spot.",
    "Achia ramani kuchagua eneo hili.",
    "Tika karte mpo na kopona esika oyo.",
  ],
  "Choisir cette destination": [
    "Choose this destination",
    "Chagua mwisho huu",
    "Pona destination oyo",
  ],
  "Confirmer ce départ": [
    "Confirm pickup",
    "Thibitisha kuanzia",
    "Ndima départ oyo",
  ],
  "Choisir sur la carte": [
    "Choose on the map",
    "Chagua kwenye ramani",
    "Pona na karte",
  ],
  "Placez le repère": ["Place the pin", "Weka alama", "Tia repère"],
  "Lieu choisi sur la carte": [
    "Place chosen on the map",
    "Eneo lililochaguliwa kwenye ramani",
    "Esika oponi na karte",
  ],
  "Adresse indisponible. Le point choisi est conservé.": [
    "Address unavailable. Your chosen point is kept.",
    "Anwani haipatikani. Alama yako imehifadhiwa.",
    "Adresse ezali te. Esika oponi ebombami.",
  ],
  "Recherche du lieu…": [
    "Finding the place…",
    "Tunatafuta eneo…",
    "Tozali koluka esika…",
  ],
  "Recherche d’une référence proche…": [
    "Finding a nearby landmark…",
    "Tunatafuta alama ya karibu…",
    "Tozali koluka référence ya pembeni…",
  ],
  "Calcul indisponible. Réessayez sur la carte.": [
    "Route calculation unavailable. Try again on the map.",
    "Hesabu ya njia haipatikani. Jaribu tena kwenye ramani.",
    "Kotanga nzela ezali te. Meka lisusu na karte.",
  ],
  "Voir les lieux proches et les entrées": [
    "Nearby places and entrances",
    "Maeneo ya karibu na milango",
    "Bisika ya pembeni mpe ba entrées",
  ],
  "Masquer les références": [
    "Hide landmarks",
    "Ficha alama za eneo",
    "Bomba ba références",
  ],
  "Une référence garde votre point. Choisir une entrée change la destination.":
    [
      "A landmark keeps your point. Choosing an entrance changes the destination.",
      "Alama ya eneo inahifadhi sehemu yako. Kuchagua mlango kunabadilisha mwisho.",
      "Référence ebombi esika na yo. Kopona entrée ebongoli destination.",
    ],
  "LIEUX CONNUS": ["KNOWN PLACES", "MAENEO YANAYOJULIKANA", "BISIKA EYEBAKA"],
  "LIEUX ET RÉFÉRENCES": [
    "PLACES AND LANDMARKS",
    "MAENEO NA ALAMA",
    "BISIKA MPE BA RÉFÉRENCES",
  ],
  RÉSULTATS: ["RESULTS", "MATOKEO", "MATANGI"],
  "Précision : portail bleu, en face de l’école…": [
    "More details: blue gate, opposite the school…",
    "Maelezo: lango la bluu, mbele ya shule…",
    "Malako: portail ya bleu, liboso ya eteyelo…",
  ],
  "Référence · env.": [
    "Landmark · approx.",
    "Alama · karibu",
    "Référence · pene",
  ],
  "m à vol d’oiseau": [
    "m in a straight line",
    "m kwa mstari wa moja kwa moja",
    "m na ligne droite",
  ],
  "Aucun lieu trouvé. Essayez un quartier ou une autre adresse.": [
    "No place found. Try an area or another address.",
    "Eneo halijapatikana. Jaribu mtaa au anwani nyingine.",
    "Esika emonani te. Meka quartier to adresse mosusu.",
  ],
  "Ma langue": ["My language", "Lugha yangu", "Monoko na ngai"],
  "Langue et localisation": [
    "Language and location",
    "Lugha na eneo",
    "Monoko mpe esika",
  ],
  "Ma localisation": [
    "My location settings",
    "Mipangilio ya eneo langu",
    "Ba réglages ya esika nazali",
  ],
  "Ville du compte :": [
    "Account city:",
    "Mji wa akaunti:",
    "Engumba ya konti:",
  ],
  "Actualiser avec ma position": [
    "Update from my location",
    "Sasisha kwa eneo langu",
    "Bongisa na esika nazali",
  ],
  "Position actualisée": [
    "Location updated",
    "Eneo limesasishwa",
    "Esika ebongisami",
  ],
  "Partager ma position": [
    "Share my location",
    "Shiriki eneo langu",
    "Kabola esika nazali",
  ],
  "Partagez votre position pour trouver votre ville.": [
    "Share your location to find your city.",
    "Shiriki eneo lako ili kupata mji wako.",
    "Kabola esika ozali mpo na komona engumba na yo.",
  ],
  "Touchez Ma position pour vous situer": [
    "Tap My location to find yourself",
    "Bonyeza Eneo langu kujiona",
    "Fina Esika nazali mpo na komimona",
  ],
  "Recherche de votre position…": [
    "Finding your location…",
    "Tunatafuta eneo lako…",
    "Tozali koluka esika ozali…",
  ],
  "Dernière position · signal à actualiser": [
    "Last location · update needed",
    "Eneo la mwisho · sasisha",
    "Esika ya suka · esengeli kobongisa",
  ],
  "Localisation désactivée": [
    "Location disabled",
    "Eneo limezimwa",
    "Localisation ekangami",
  ],
  "En dehors de la zone": [
    "Outside the service area",
    "Nje ya eneo la huduma",
    "Libanda ya esika ya servisi",
  ],
  "Activez le GPS du téléphone": [
    "Enable your phone's GPS",
    "Washa GPS ya simu",
    "Fungola GPS ya telefone",
  ],
  "Activez la localisation du téléphone, puis réessayez.": [
    "Enable your phone's location, then try again.",
    "Washa eneo la simu, kisha jaribu tena.",
    "Fungola localisation ya telefone mpe meka lisusu.",
  ],
  "Autorisez la localisation dans les réglages d’Expo Go, ou choisissez un lieu sur la carte.":
    [
      "Allow location in Expo Go settings, or choose on the map.",
      "Ruhusu eneo katika mipangilio ya Expo Go, au chagua kwenye ramani.",
      "Pesa nzela ya localisation na Expo Go, to pona na karte.",
    ],
  "Impossible de lire la position. Vérifiez les réglages de localisation.": [
    "Cannot read your location. Check location settings.",
    "Eneo halisomeki. Angalia mipangilio ya eneo.",
    "Tokoki kotanga esika te. Tala ba réglages ya localisation.",
  ],
  "Signal GPS indisponible. Réessayez à l’extérieur.": [
    "GPS unavailable. Try again outdoors.",
    "GPS haipatikani. Jaribu nje.",
    "GPS ezali te. Meka libanda.",
  ],
  "Le GPS met du temps à répondre. Réessayez à l’extérieur ou choisissez sur la carte.":
    [
      "GPS is taking time. Try outdoors or choose on the map.",
      "GPS inachelewa. Jaribu nje au chagua kwenye ramani.",
      "GPS ezali kozela. Meka libanda to pona na karte.",
    ],
  "La position reçue est invalide.": [
    "Invalid location received.",
    "Eneo lililopokelewa si sahihi.",
    "Esika etindami ezali malamu te.",
  ],
  "Votre position est hors des villes actuellement desservies par Pepo.": [
    "Your location is outside Pepo's current cities.",
    "Eneo lako liko nje ya miji ya Pepo.",
    "Esika ozali ezali libanda ya bingumba ya Pepo.",
  ],
  "Votre position est hors des villes desservies pour le moment.": [
    "Your location is outside the current service area.",
    "Eneo lako liko nje ya huduma kwa sasa.",
    "Esika ozali ezali libanda ya esika ya servisi sikoyo.",
  ],
  "Pepo ne dessert pas encore votre position actuelle.": [
    "Pepo does not serve your location yet.",
    "Pepo haijahudumia eneo lako bado.",
    "Pepo esalaka naino na esika ozali te.",
  ],
  "Votre position est en dehors de la ville choisie. Choisissez votre ville dans Compte, ou utilisez la carte.":
    [
      "Your location is outside the selected city. Check Account or use the map.",
      "Eneo lako liko nje ya mji uliochaguliwa. Angalia Akaunti au tumia ramani.",
      "Esika ozali ezali libanda ya engumba oponi. Tala Konti to salela karte.",
    ],
  "Autorisations du téléphone": [
    "Phone permissions",
    "Ruhusa za simu",
    "Ba autorisations ya telefone",
  ],
  "Ouvrez les autorisations de ce site dans votre navigateur.": [
    "Open this site's permissions in your browser.",
    "Fungua ruhusa za tovuti kwenye kivinjari.",
    "Fungola ba autorisations ya site na navigateur.",
  ],
  "Faisons\nconnaissance.": [
    "Let's get\nto know you.",
    "Tufahamiane.",
    "Toyebana.",
  ],
  "Un dernier\npetit code.": [
    "One last\ncode.",
    "Msimbo wa mwisho.",
    "Code moko\nya suka.",
  ],
  "Une inscription simple. Et vous voilà en route.": [
    "A simple signup, then you're on your way.",
    "Usajili rahisi, kisha uko njiani.",
    "Inscription ya pete, mpe okoki kokende.",
  ],
  "Entrer dans Pepo": ["Enter Pepo", "Ingia Pepo", "Kota na Pepo"],
  "Votre téléphone sera confirmé par un code.": [
    "A code will confirm your phone.",
    "Msimbo utathibitisha simu yako.",
    "Code ekondima telefone na yo.",
  ],
  "Votre numéro, sans l’indicatif +243": [
    "Your number, without +243",
    "Namba yako bila +243",
    "Nimero na yo kozanga +243",
  ],
  "Code de confirmation": [
    "Confirmation code",
    "Msimbo wa uthibitisho",
    "Code ya kondima",
  ],
  "Renvoyer le code": ["Resend code", "Tuma msimbo tena", "Tinda code lisusu"],
  "Mode démo": ["Demo mode", "Hali ya majaribio", "Mode demo"],
  "Test local": ["Local test", "Jaribio la hapa", "Test ya awa"],
  "Test local sans SMS": [
    "Local test without SMS",
    "Jaribio bila SMS",
    "Test ya awa kozanga SMS",
  ],
  "Ce code de test ne vérifie pas une identité réelle.": [
    "This test code does not verify a real identity.",
    "Msimbo wa jaribio hauthibitishi utambulisho halisi.",
    "Code ya test endimaka identité ya solo te.",
  ],
  "Mode démo : utilisez des informations fictives pour tester.": [
    "Demo: use made-up details to test.",
    "Jaribio: tumia taarifa za majaribio.",
    "Demo: salela makambo ya komeka.",
  ],
  "La démo fonctionne sans compte ni paiement.": [
    "The demo needs no account or payment.",
    "Jaribio halihitaji akaunti wala malipo.",
    "Demo esengeli na konti to kofuta te.",
  ],
  "LA MOBILITÉ, À VOTRE FAÇON": [
    "GET AROUND YOUR WAY",
    "SAFIRI KWA NAMNA YAKO",
    "TAMBOLA NDENGE OLINGI",
  ],
  "RDC · ON Y VA": ["DRC · LET'S GO", "DRC · TWENDE", "RDC · TOKende"],
  "Explorer la ville": ["Explore the city", "Gundua mji", "Tala engumba"],
  "Une passagère avec un motard Pepo": [
    "A passenger on a Pepo bike",
    "Abiria kwenye pikipiki ya Pepo",
    "Passager na moto ya Pepo",
  ],
  "Une passagère à bord d’un taxi Pepo": [
    "A passenger in a Pepo taxi",
    "Abiria ndani ya teksi ya Pepo",
    "Passager na taxi ya Pepo",
  ],
  "Carte de la République démocratique du Congo": [
    "Map of the Democratic Republic of the Congo",
    "Ramani ya Jamhuri ya Kidemokrasia ya Kongo",
    "Karte ya République démocratique du Congo",
  ],
  "VOTRE VILLE. VOS HISTOIRES.": [
    "YOUR CITY. YOUR STORIES.",
    "MJI WAKO. HADITHI ZAKO.",
    "ENGUMBA NA YO. MAKAMBO NA YO.",
  ],
  "VOUS COMPTEZ.": ["YOU MATTER.", "UNAJALIWA.", "OZALI NA NTINA."],
  "Mon compte": ["My account", "Akaunti yangu", "Konti na ngai"],
  "Mes informations": ["My details", "Taarifa zangu", "Makambo na ngai"],
  "Modifier mon profil": [
    "Edit my profile",
    "Badilisha wasifu wangu",
    "Bongola profil na ngai",
  ],
  "Votre nom": ["Your name", "Jina lako", "Nkombo na yo"],
  "Votre téléphone": ["Your phone", "Simu yako", "Telefone na yo"],
  "Enregistrer mon nom": [
    "Save my name",
    "Hifadhi jina langu",
    "Bomba nkombo na ngai",
  ],
  "Il sert à vous connecter. Son changement nécessite une nouvelle confirmation par SMS.":
    [
      "This number is used to sign in. Changing it needs another SMS confirmation.",
      "Namba hii hutumika kuingia. Kuibadilisha kunahitaji SMS mpya.",
      "Nimero oyo esalisaka kokota. Kobongola yango esengi code ya SMS ya sika.",
    ],
  "Se déconnecter ?": ["Sign out?", "Unataka kutoka?", "Obima na konti?"],
  "Vous retrouverez votre compte avec votre numéro de téléphone.": [
    "You can sign back in with your phone number.",
    "Unaweza kurudi kwa namba yako.",
    "Okokota lisusu na nimero na yo.",
  ],
  "Vous avez déjà une course active.": [
    "You already have an active ride.",
    "Tayari una safari inayoendelea.",
    "Ozali déjà na course ezali kosalema.",
  ],
  "Terminez ou annulez votre course avant de vous déconnecter.": [
    "Complete or cancel your ride before signing out.",
    "Maliza au ghairi safari kabla ya kutoka.",
    "Sukisa to longola course liboso ya kobima.",
  ],
  "Terminez ou annulez votre course avant de changer ces informations.": [
    "Complete or cancel your ride before changing these details.",
    "Maliza au ghairi safari kabla ya kubadilisha taarifa.",
    "Sukisa to longola course liboso ya kobongola makambo oyo.",
  ],
  "Votre visage": ["Your face", "Uso wako", "Elongi na yo"],
  "Ma photo": ["My photo", "Picha yangu", "Foto na ngai"],
  "Modifier ma photo de profil": [
    "Edit profile photo",
    "Badilisha picha ya wasifu",
    "Bongola foto ya profil",
  ],
  "Changer ma photo": [
    "Change my photo",
    "Badilisha picha yangu",
    "Bongola foto na ngai",
  ],
  "Prendre une photo": ["Take a photo", "Piga picha", "Kanga foto"],
  "Choisir dans mes photos": [
    "Choose from my photos",
    "Chagua kwenye picha zangu",
    "Pona na ba fotos na ngai",
  ],
  "Une photo nette aide le conducteur à vous reconnaître.": [
    "A clear photo helps your driver recognize you.",
    "Picha safi husaidia dereva kukutambua.",
    "Foto ya polele esalisaka mokumbi ayeba yo.",
  ],
  "Ajouter une photo ne valide pas votre identité.": [
    "Adding a photo does not verify your identity.",
    "Picha pekee haithibitishi utambulisho wako.",
    "Kobakisa foto endimaka identité te.",
  ],
  "Autorisez les photos ou la caméra dans les réglages du téléphone.": [
    "Allow photos or camera in phone settings.",
    "Ruhusu picha au kamera katika mipangilio ya simu.",
    "Pesa nzela ya foto to kamera na ba réglages ya telefone.",
  ],
  "Autorisez l’accès à la caméra ou aux photos dans les réglages.": [
    "Allow camera or photos in settings.",
    "Ruhusu kamera au picha katika mipangilio.",
    "Pesa nzela ya kamera to foto na ba réglages.",
  ],
  "Mon identité": ["My identity", "Utambulisho wangu", "Identité na ngai"],
  "Pièce d’identité et selfie": [
    "ID and selfie",
    "Kitambulisho na selfie",
    "Pièce d’identité mpe selfie",
  ],
  "Pièce d’identité": ["Identity document", "Kitambulisho", "Pièce d’identité"],
  "Votre pièce et votre selfie": [
    "Your ID and selfie",
    "Kitambulisho chako na selfie",
    "Pièce na yo mpe selfie",
  ],
  "DEUX ÉTAPES SIMPLES": [
    "TWO SIMPLE STEPS",
    "HATUA MBILI RAHISI",
    "MAKAMBO MIBALE YA PETE",
  ],
  "Document officiel lisible.": [
    "A readable official document.",
    "Hati rasmi inayosomeka.",
    "Mokanda ya leta oyo etangamaka malamu.",
  ],
  "Document reçu ·": [
    "Document received ·",
    "Hati imepokelewa ·",
    "Mokanda eyambami ·",
  ],
  "Prendre mon selfie": [
    "Take my selfie",
    "Piga selfie yangu",
    "Kanga selfie na ngai",
  ],
  "Prenez un selfie maintenant, sans filtre et visage découvert. Notre équipe le compare à votre pièce d’identité.":
    [
      "Take a selfie now, without filters and with your face visible. Our team compares it with your ID.",
      "Piga selfie sasa bila kichujio na uso uonekane. Timu yetu inalinganisha na kitambulisho.",
      "Kanga selfie sikoyo, kozanga filtre mpe elongi polele. Équipe ekotala yango elongo na pièce na yo.",
    ],
  "Vos documents restent privés. Notre équipe compare votre pièce d’identité et votre selfie. Ajouter une photo de profil ne suffit pas.":
    [
      "Your documents stay private. Our team compares your ID and selfie. A profile photo alone is not enough.",
      "Nyaraka zako ni za binafsi. Timu yetu inalinganisha kitambulisho na selfie. Picha ya wasifu pekee haitoshi.",
      "Mikanda na yo etikali privé. Équipe etalaka pièce mpe selfie. Foto ya profil kaka ekoki te.",
    ],
  "Vos informations servent à votre compte et à la sécurité de vos courses. Aucune géolocalisation sans votre autorisation.":
    [
      "Your details support your account and ride safety. Location is used only with permission.",
      "Taarifa zako ni za akaunti na usalama wa safari. Eneo hutumika kwa ruhusa yako tu.",
      "Makambo na yo esalelaka konti mpe bobateli ya course. Localisation kaka na nzela na yo.",
    ],
  "Identité examinée": [
    "Identity reviewed",
    "Utambulisho umekaguliwa",
    "Identité etalami",
  ],
  "Identité examinée par Pepo": [
    "Identity reviewed by Pepo",
    "Utambulisho umekaguliwa na Pepo",
    "Identité etalami na Pepo",
  ],
  "Vérification manuelle": [
    "Manual review",
    "Ukaguzi wa timu",
    "Équipe nde etalaka",
  ],
  "Documents à examiner": [
    "Documents to review",
    "Nyaraka za kukagua",
    "Mikanda ya kotala",
  ],
  "Documents à corriger": [
    "Documents need correction",
    "Nyaraka zinahitaji marekebisho",
    "Mikanda ya kobongisa",
  ],
  "À corriger": ["Needs correction", "Rekebisha", "Bongisa"],
  Approuvé: ["Approved", "Imekubaliwa", "Endimami"],
  "Dossier approuvé": [
    "Profile approved",
    "Wasifu umekubaliwa",
    "Dossier endimami",
  ],
  "Votre dossier": ["Your documents", "Nyaraka zako", "Dossier na yo"],
  "Mon véhicule et mon dossier": [
    "My vehicle and documents",
    "Gari na nyaraka zangu",
    "Motuka mpe dossier na ngai",
  ],
  "Votre véhicule": ["Your vehicle", "Gari lako", "Motuka na yo"],
  Modèle: ["Model", "Aina ya gari", "Modèle"],
  "Plaque d’immatriculation": ["License plate", "Namba ya gari", "Plaque"],
  "Enregistrer le véhicule": ["Save vehicle", "Hifadhi gari", "Bomba motuka"],
  "Véhicule et plaque": [
    "Vehicle and plate",
    "Gari na namba",
    "Motuka mpe plaque",
  ],
  "Photo nette du véhicule et de la plaque.": [
    "Clear vehicle and license plate photo.",
    "Picha safi ya gari na namba yake.",
    "Foto ya polele ya motuka mpe plaque.",
  ],
  "Permis de conduire": [
    "Driving license",
    "Leseni ya udereva",
    "Permis ya kokumba",
  ],
  "Nom et date de validité visibles.": [
    "Name and expiry date visible.",
    "Jina na tarehe ya mwisho vionekane.",
    "Nkombo mpe date ya suka emonana.",
  ],
  "Les quatre documents": [
    "The four documents",
    "Nyaraka nne",
    "Mikanda minei",
  ],
  "Les documents pour conduire": [
    "Documents for driving",
    "Nyaraka za udereva",
    "Mikanda ya kokumba",
  ],
  "L’équipe Pepo examine votre dossier avant de le valider. Si vous changez vos documents, un nouvel examen sera nécessaire.":
    [
      "Pepo reviews your documents before approval. Changed documents need a new review.",
      "Pepo inakagua nyaraka kabla ya kukubali. Ukibadilisha zinahitaji ukaguzi mpya.",
      "Pepo etalaka dossier liboso ya kondima. Soki obongoli mikanda, esengeli kotala lisusu.",
    ],
  "Votre dossier et votre véhicule devront être approuvés avant de recevoir des courses réelles.":
    [
      "Your documents and vehicle need approval before real requests.",
      "Nyaraka na gari lazima zikubaliwe kabla ya maombi halisi.",
      "Dossier mpe motuka esengeli kondimama liboso ya ba courses ya solo.",
    ],
  "Ajoutez vos documents et attendez l’approbation de votre dossier.": [
    "Add documents and wait for approval.",
    "Ongeza nyaraka na subiri zikubaliwe.",
    "Bakisa mikanda mpe zela bandima dossier.",
  ],
  "En mode démo, utilisez uniquement des photos et documents fictifs.": [
    "Use only made-up photos and documents in the demo.",
    "Tumia picha na nyaraka za majaribio tu.",
    "Na demo, salela kaka foto mpe mikanda ya komeka.",
  ],
  "CONDUCTEUR PEPO": ["PEPO DRIVER", "DEREVA WA PEPO", "MOKUMBI PEPO"],
  "Mes paiements": ["My payments", "Malipo yangu", "Kofuta na ngai"],
  "Espèces, Mobile Money et carte": [
    "Cash, Mobile Money and card",
    "Taslimu, Mobile Money na kadi",
    "Mbongo na maboko, Mobile Money mpe carte",
  ],
  "Mobile Money et espèces": [
    "Mobile Money and cash",
    "Mobile Money na taslimu",
    "Mobile Money mpe mbongo na maboko",
  ],
  "Ajouter Mobile Money": [
    "Add Mobile Money",
    "Ongeza Mobile Money",
    "Bakisa Mobile Money",
  ],
  "Quel service utilisez-vous ?": [
    "Which service do you use?",
    "Unatumia huduma gani?",
    "Osalelaka servisi nini?",
  ],
  "Numéro de votre compte Mobile Money": [
    "Your Mobile Money number",
    "Namba ya Mobile Money",
    "Nimero ya Mobile Money na yo",
  ],
  "Numéro enregistré · non vérifié": [
    "Saved number · not verified",
    "Namba imehifadhiwa · haijathibitishwa",
    "Nimero ebombami · endimami te",
  ],
  "Indicatif +243. N’entrez jamais votre code secret ou un code SMS.": [
    "Country code +243. Never enter your PIN or an SMS code.",
    "Msimbo wa nchi +243. Usiweke PIN yako au msimbo wa SMS.",
    "Indicatif +243. Kokoma code secret to code ya SMS te.",
  ],
  "Enregistrer ce numéro": [
    "Save this number",
    "Hifadhi namba",
    "Bomba nimero oyo",
  ],
  "Ce numéro est déjà enregistré.": [
    "This number is already saved.",
    "Namba hii imehifadhiwa tayari.",
    "Nimero oyo ebombami déjà.",
  ],
  "Ce numéro est déjà enregistré pour ce service.": [
    "This number is already saved for this service.",
    "Namba hii imehifadhiwa kwa huduma hii.",
    "Nimero oyo ebombami déjà na servisi oyo.",
  ],
  "Retirer ce numéro ?": [
    "Remove this number?",
    "Ondoa namba hii?",
    "Longola nimero oyo?",
  ],
  "Vous pourrez le rajouter plus tard.": [
    "You can add it again later.",
    "Unaweza kuongeza tena baadaye.",
    "Okoki kobakisa yango lisusu nsima.",
  ],
  "Ajouter une carte": ["Add a card", "Ongeza kadi", "Bakisa carte"],
  "Carte bancaire": ["Bank card", "Kadi ya benki", "Carte ya banque"],
  "L’ajout d’une carte sera ouvert avec un prestataire de paiement connecté à Pepo. Pour le moment, aucun numéro de carte ni code de sécurité n’est demandé.":
    [
      "Cards will be available after connecting a payment provider. No card number or security code is requested now.",
      "Kadi zitapatikana baada ya kuunganisha mtoa malipo. Kwa sasa hakuna namba ya kadi wala msimbo unaoombwa.",
      "Carte ekofungwama nsima ya kokangisa prestataire. Sikoyo, nimero ya carte to code secret esengami te.",
    ],
  "Pour l’instant, ces numéros ne déclenchent aucun débit. Le paiement Mobile Money dans Pepo nécessite encore la connexion aux opérateurs.":
    [
      "These numbers do not trigger charges yet. Mobile Money payments still need operator integration.",
      "Namba hizi hazitoi pesa sasa. Malipo ya Mobile Money yanahitaji kuunganishwa na waendeshaji.",
      "Nimero oyo ebimisaka mbongo te sikoyo. Kofuta Mobile Money esengi kokangisa ba opérateurs.",
    ],
  "Vous pouvez toujours payer à la fin de la course.": [
    "You can pay at the end of your ride.",
    "Unaweza kulipa mwishoni mwa safari.",
    "Okoki kofuta ntango course esili.",
  ],
  "Mes proches": [
    "My trusted people",
    "Watu wangu wa kuaminika",
    "Bato na ngai ya confiance",
  ],
  "Mes contacts de confiance": [
    "My trusted contacts",
    "Watu wangu wa kuaminika",
    "Bato na ngai ya confiance",
  ],
  "Ajouter un proche": [
    "Add a trusted person",
    "Ongeza mtu wa kuaminika",
    "Bakisa moto ya confiance",
  ],
  "Contact principal": [
    "Main contact",
    "Mtu mkuu wa mawasiliano",
    "Moto ya liboso ya confiance",
  ],
  "Contact supplémentaire": [
    "Additional contact",
    "Mtu mwingine",
    "Moto mosusu ya confiance",
  ],
  "Choisir comme contact principal": [
    "Use as main contact",
    "Chagua mtu mkuu",
    "Pona lokola moto ya liboso",
  ],
  "Choisissez jusqu’à trois personnes que vous pouvez appeler en cas de problème.":
    [
      "Choose up to three people you can call for help.",
      "Chagua watu watatu wa kupigia ukiwa na tatizo.",
      "Pona bato misato oyo okoki kobenga soki mokakatano ezali.",
    ],
  "Demandez son accord avant d’ajouter son numéro.": [
    "Ask permission before adding their number.",
    "Omba ruhusa kabla ya kuongeza namba.",
    "Senga andima liboso ya kobakisa nimero na ye.",
  ],
  "Ajoutez une personne qui peut vous aider.": [
    "Add someone who can help you.",
    "Ongeza mtu anayeweza kusaidia.",
    "Bakisa moto oyo akoki kosalisa yo.",
  ],
  "Ajoutez d’abord votre contact de confiance.": [
    "First add a trusted contact.",
    "Ongeza kwanza mtu wa kuaminika.",
    "Bakisa liboso moto ya confiance.",
  ],
  "Son nom": ["Their name", "Jina lake", "Nkombo na ye"],
  "Son numéro avec l’indicatif": [
    "Their number with country code",
    "Namba yake na msimbo wa nchi",
    "Nimero na ye na indicatif",
  ],
  "Prénom et nom": [
    "First and last name",
    "Jina la kwanza na la mwisho",
    "Nkombo mpe prénom",
  ],
  "Enregistrer ce proche": [
    "Save trusted person",
    "Hifadhi mtu huyu",
    "Bomba moto oyo",
  ],
  "Retirer ce contact ?": [
    "Remove this contact?",
    "Ondoa mtu huyu?",
    "Longola contact oyo?",
  ],
  "Aucun SMS n’est envoyé automatiquement. Le contact principal est proposé dans l’espace Sécurité.":
    [
      "No SMS is sent automatically. Your main contact appears under Safety.",
      "SMS haitumwi yenyewe. Mtu mkuu anaonekana kwenye Usalama.",
      "SMS etindamaka yango moko te. Moto ya liboso amonisami na Bobateli.",
    ],
  "1 proche enregistré": [
    "1 trusted person saved",
    "Mtu 1 amehifadhiwa",
    "Moto 1 abombami",
  ],
  "Mes réglages": ["My settings", "Mipangilio yangu", "Ba réglages na ngai"],
  "Sécurité et assistance": [
    "Safety and support",
    "Usalama na msaada",
    "Bobateli mpe lisalisi",
  ],
  "Partager une course, signaler un problème": [
    "Share a ride, report a problem",
    "Shiriki safari, ripoti tatizo",
    "Kabola course, yebisa mokakatano",
  ],
  "Un message pour vous retrouver plus facilement.": [
    "A message to help you meet.",
    "Ujumbe wa kusaidia kukutana.",
    "Nsango mpo na kokutana malamu.",
  ],
  "Votre message…": ["Your message…", "Ujumbe wako…", "Nsango na yo…"],
  "Envoyer le message": ["Send message", "Tuma ujumbe", "Tinda nsango"],
  "Conversation simulée en mode démo.": [
    "Simulated demo conversation.",
    "Mazungumzo ya majaribio.",
    "Lisolo ya demo.",
  ],
  "Messagerie privée entre les participants à la course.": [
    "Private chat for ride participants.",
    "Mazungumzo binafsi ya washiriki wa safari.",
    "Lisolo privé kati ya bato ya course.",
  ],
  "Bonjour ! Je suis près du point de départ. À tout de suite. (Démo)": [
    "Hello! I'm near the pickup. See you soon. (Demo)",
    "Habari! Niko karibu na kuanzia. Tutaonana. (Jaribio)",
    "Mbote! Nazali pembeni ya départ. Tokomonana. (Demo)",
  ],
  "Merci, je vous attends au point de départ. (Démo)": [
    "Thanks, I'm waiting at pickup. (Demo)",
    "Asante, nakusubiri mahali pa kuanzia. (Jaribio)",
    "Matondo, nazali kozela yo na départ. (Demo)",
  ],
  "Le numéro sera disponible après confirmation de la course.": [
    "The number appears after confirming the ride.",
    "Namba itaonekana baada ya kuthibitisha safari.",
    "Nimero ekomonana nsima ya kondima course.",
  ],
  "Aucun conducteur n’est encore confirmé.": [
    "No driver confirmed yet.",
    "Dereva hajathibitishwa bado.",
    "Mokumbi andimami naino te.",
  ],
  "Appel en mode démo": ["Demo call", "Simu ya majaribio", "Appel ya demo"],
  "Ce profil est fictif. Aucun appel réel n’est lancé.": [
    "This is a demo profile. No real call starts.",
    "Wasifu ni wa majaribio. Hakuna simu halisi.",
    "Profil ezali ya demo. Appel ya solo ezali te.",
  ],
  "Ouvrir l’appel ?": ["Open phone call?", "Fungua simu?", "Fungola appel?"],
  "Partagez le lien de votre course avec une personne de confiance.": [
    "Share your ride link with someone you trust.",
    "Shiriki kiungo cha safari na mtu wa kuaminika.",
    "Kabola lien ya course na moto ya confiance.",
  ],
  "Le partage démo ne contient aucun suivi réel.": [
    "Demo sharing has no real tracking.",
    "Jaribio halina ufuatiliaji halisi.",
    "Partage ya demo ezali na suivi ya solo te.",
  ],
  "Suivi disponible quand l’application du conducteur est ouverte.": [
    "Tracking works while the driver's app is open.",
    "Ufuatiliaji unafanya kazi programu ya dereva ikiwa wazi.",
    "Suivi esalaka ntango aplikasyo ya mokumbi efungwami.",
  ],
  "Ce bouton ne déclenche aucun appel automatique et aucun service d’urgence n’est alerté par Pepo.":
    [
      "This button does not call or alert emergency services automatically.",
      "Kitufe hiki hakipigi simu wala kuarifu huduma za dharura chenyewe.",
      "Bouton oyo ebengaka to eyebisaka secours yango moko te.",
    ],
  "En danger immédiat, contactez les secours locaux ou une personne de confiance. Choisissez ci-dessous une action à lancer depuis votre téléphone.":
    [
      "In immediate danger, contact local emergency services or a trusted person. Choose an action below.",
      "Ukiwa hatarini, piga huduma za dharura au mtu wa kuaminika. Chagua hatua hapa chini.",
      "Soki ozali na danger sikoyo, benga secours to moto ya confiance. Pona likambo na nse.",
    ],
  "Choisissez un appel, un SMS ou un signalement. Aucun service d’urgence n’est alerté automatiquement.":
    [
      "Choose a call, SMS or report. Emergency services are not alerted automatically.",
      "Chagua simu, SMS au taarifa. Huduma za dharura hazipewi taarifa zenyewe.",
      "Pona appel, SMS to signalement. Secours eyebisami yango moko te.",
    ],
  "Préparer un SMS d’aide": [
    "Prepare a help SMS",
    "Andaa SMS ya msaada",
    "Bongisa SMS ya lisalisi",
  ],
  "Que s’est-il passé ?": [
    "What happened?",
    "Nini kimetokea?",
    "Nini esalemaki?",
  ],
  "Décrivez un incident ou un comportement préoccupant. Ce formulaire ne remplace pas un appel d’urgence.":
    [
      "Describe an incident or worrying behavior. This form does not replace an emergency call.",
      "Eleza tukio au tabia ya wasiwasi. Fomu hii si badala ya simu ya dharura.",
      "Yebisa incident to bizaleli ya mabe. Formulaire oyo ezwi esika ya appel ya secours te.",
    ],
  "Enregistrer mon signalement": [
    "Save my report",
    "Hifadhi taarifa yangu",
    "Bomba signalement na ngai",
  ],
  "Signalement enregistré": [
    "Report saved",
    "Taarifa imehifadhiwa",
    "Signalement ebombami",
  ],
  "Enregistré dans la démo uniquement. Aucun opérateur alerté.": [
    "Saved only in the demo. No operator is notified.",
    "Imehifadhiwa kwenye jaribio tu. Hakuna mhudumu aliyejulishwa.",
    "Ebombami kaka na demo. Moto moko ayebisami te.",
  ],
  "Votre signalement est disponible pour l’équipe qui administre ce serveur. Aucun traitement immédiat n’est garanti.":
    [
      "Your report is available to the server's support team. Immediate handling is not guaranteed.",
      "Taarifa inapatikana kwa timu ya huduma. Kushughulikiwa mara moja hakuhakikishwi.",
      "Signalement ezali mpo na équipe. Kosalisa sikoyo elakelami te.",
    ],
  "Vérifiez le casque avant de monter.": [
    "Check the helmet before riding.",
    "Angalia kofia kabla ya kupanda.",
    "Tala casque liboso ya komata.",
  ],
  "Annuler la course ?": [
    "Cancel the ride?",
    "Ghairi safari?",
    "Longola course?",
  ],
  "Le conducteur et le passager seront informés de l’annulation.": [
    "The driver and passenger will be told.",
    "Dereva na abiria watajulishwa.",
    "Mokumbi mpe passager bakoyebisama.",
  ],
  "Course annulée": [
    "Ride cancelled",
    "Safari imeghairiwa",
    "Course elongolami",
  ],
  "Course terminée": ["Ride completed", "Safari imekamilika", "Course esili"],
  "Course pour": ["Ride for", "Safari kwa", "Course mpo na"],
  "Votre avis :": ["Your rating:", "Maoni yako:", "Avis na yo:"],
  "/ 5 · Merci !": ["/ 5 · Thank you!", "/ 5 · Asante!", "/ 5 · Matondo!"],
  "Terminer la course ?": [
    "Complete the ride?",
    "Maliza safari?",
    "Sukisa course?",
  ],
  "Confirmez que vous avez atteint la destination avec le passager.": [
    "Confirm that you reached the destination with the passenger.",
    "Thibitisha mmefika mwisho na abiria.",
    "Ndima ete okomi na destination na passager.",
  ],
  "Passager démo · code 4826": [
    "Demo passenger · code 4826",
    "Abiria wa jaribio · msimbo 4826",
    "Passager ya demo · code 4826",
  ],
  "COMMANDES DE DÉMONSTRATION": [
    "DEMO CONTROLS",
    "AMRI ZA MAJARIBIO",
    "MITINDO YA DEMO",
  ],
  "Simuler l’arrivée": ["Simulate arrival", "Jaribu kufika", "Meka arrivée"],
  "Simuler le départ avec le code": [
    "Simulate start with code",
    "Jaribu kuanza kwa msimbo",
    "Meka départ na code",
  ],
  "Simuler la fin du trajet": [
    "Simulate completion",
    "Jaribu kumaliza",
    "Meka suka ya course",
  ],
  "Compte de démonstration": [
    "Demo account",
    "Akaunti ya majaribio",
    "Konti ya demo",
  ],
  "Profil démo": ["Demo profile", "Wasifu wa majaribio", "Profil ya demo"],
  "MONTANTS CONVENUS": [
    "AGREED AMOUNTS",
    "KIASI MLILICHOKUBALIANA",
    "MBONGO BONDIMI",
  ],
  "REVENUS CONVENUS": [
    "AGREED RIDE AMOUNTS",
    "KIASI CHA SAFARI",
    "MBONGO YA BA COURSES",
  ],
  "TRAJETS TERMINÉS": [
    "COMPLETED RIDES",
    "SAFARI ZILIZOKAMILIKA",
    "BA COURSES ESILI",
  ],
  "Les trajets de cette catégorie apparaîtront ici.": [
    "Rides in this category appear here.",
    "Safari za kundi hili zitaonekana hapa.",
    "Ba courses ya catégorie oyo ekomonana awa.",
  ],
  "Départ immédiat": ["Leave now", "Ondoka sasa", "Départ sikoyo"],
  "Départ programmé": [
    "Scheduled pickup",
    "Kuanzia kulikopangwa",
    "Départ eprogrammé",
  ],
  "Départ prévu :": [
    "Pickup scheduled:",
    "Kuanzia kulikopangwa:",
    "Départ prévu:",
  ],
  "Arrivée estimée :": [
    "Estimated arrival:",
    "Kufika kwa makadirio:",
    "Arrivée ya estimation:",
  ],
  "Programmer une course": [
    "Schedule a ride",
    "Panga safari",
    "Programme course",
  ],
  "Programmer la course": [
    "Schedule this ride",
    "Panga safari hii",
    "Programme course oyo",
  ],
  "Programmer un départ": [
    "Schedule pickup",
    "Panga kuanzia",
    "Programme départ",
  ],
  "Voir mes courses programmées": [
    "See scheduled rides",
    "Ona safari zilizopangwa",
    "Tala ba courses eprogrammé",
  ],
  Programmé: ["Scheduled", "Imepangwa", "Eprogrammé"],
  Programmés: ["Scheduled", "Zimepangwa", "Eprogrammé"],
  "Modifier l’heure": ["Change time", "Badilisha saa", "Bongola ngonga"],
  "Choisissez une heure": ["Choose a time", "Chagua saa", "Pona ngonga"],
  "Quand partez-vous ?": [
    "When are you leaving?",
    "Unaondoka lini?",
    "Okokende ntango nini?",
  ],
  "Un départ prévu, en toute clarté": [
    "Plan your departure clearly",
    "Panga kuondoka kwa uwazi",
    "Bongisa départ polele",
  ],
  "Heure locale de": ["Local time in", "Saa za eneo la", "Ngonga ya"],
  "Plus de créneau aujourd’hui. Choisissez demain.": [
    "No more times today. Choose tomorrow.",
    "Hakuna saa leo. Chagua kesho.",
    "Ngonga ezali lisusu te lelo. Pona lobi.",
  ],
  ". De 30 minutes à 30 jours à l’avance.": [
    ". From 30 minutes to 30 days ahead.",
    ". Dakika 30 hadi siku 30 mapema.",
    ". Kobanda miniti 30 kino mikolo 30 liboso.",
  ],
  "La durée dépend de la circulation et des arrêts.": [
    "Duration depends on traffic and stops.",
    "Muda hutegemea msongamano na vituo.",
    "Ntango etalelaka circulation mpe ba arrêts.",
  ],
  "La recherche commence 15 minutes avant le départ. Rouvrez Pepo pour choisir votre conducteur et confirmer le prix.":
    [
      "Search starts 15 minutes before pickup. Reopen Pepo to choose a driver and confirm the fare.",
      "Kutafuta huanza dakika 15 kabla ya kuondoka. Fungua Pepo kuchagua dereva na kuthibitisha bei.",
      "Koluka ebandaka miniti 15 liboso ya départ. Fungola Pepo mpo na kopona mokumbi mpe kondima ntalo.",
    ],
  "La recherche commence 15 minutes avant. Rouvrez Pepo à ce moment pour choisir une offre. La disponibilité d’un conducteur et le prix restent à confirmer.":
    [
      "Search starts 15 minutes before pickup. Reopen Pepo to choose an offer. Driver availability and fare still need confirmation.",
      "Kutafuta huanza dakika 15 kabla. Fungua Pepo kuchagua bei. Dereva na bei bado zinahitaji kuthibitishwa.",
      "Koluka ebandaka miniti 15 liboso. Fungola Pepo mpo na kopona offre. Mokumbi mpe ntalo esengeli kondima.",
    ],
  "Aucun rappel par notification n’est envoyé dans cette version.": [
    "This version sends no reminder notification.",
    "Toleo hili halitumi arifa ya kukumbusha.",
    "Version oyo etindaka notification ya kokundola te.",
  ],
  "En démo, la recherche se lance uniquement lorsque Pepo est ouvert.": [
    "Demo search runs only while Pepo is open.",
    "Jaribio hutafuta Pepo ikiwa wazi tu.",
    "Na demo, koluka esalaka kaka soki Pepo efungwami.",
  ],
  "Annuler la réservation": [
    "Cancel reservation",
    "Ghairi nafasi",
    "Longola réservation",
  ],
  "Partir maintenant": ["Leave now", "Ondoka sasa", "Kende sikoyo"],
  "Annulez cette réservation puis créez une course pour maintenant.": [
    "Cancel this reservation, then book a ride now.",
    "Ghairi nafasi hii, kisha omba safari ya sasa.",
    "Longola réservation oyo mpe demande course ya sikoyo.",
  ],
  "Cette réservation n’est plus modifiable.": [
    "This reservation can no longer be changed.",
    "Nafasi hii haiwezi kubadilishwa tena.",
    "Réservation oyo ekoki kobongwama lisusu te.",
  ],
  "Gardez une heure entre deux départs programmés.": [
    "Keep an hour between scheduled pickups.",
    "Weka saa moja kati ya safari zilizopangwa.",
    "Tika ngonga moko kati ya ba départs eprogrammé.",
  ],
  "Gardez une heure entre deux départs programmés, avec au maximum 10 réservations à venir.":
    [
      "Keep an hour between scheduled pickups, with up to 10 future reservations.",
      "Weka saa moja kati ya safari, nafasi 10 za baadaye tu.",
      "Tika ngonga moko kati ya ba départs, na ba réservations 10 kaka.",
    ],
  "Connexion interrompue · Appuyez pour réessayer": [
    "Connection lost · Tap to retry",
    "Muunganisho umekatika · Bonyeza ujaribu",
    "Connexion ekatani · Fina mpo na komeka",
  ],
  "La demande a échoué. Réessayez.": [
    "Request failed. Try again.",
    "Ombi limeshindwa. Jaribu tena.",
    "Demande esimbi te. Meka lisusu.",
  ],
  "Le serveur a renvoyé une réponse invalide.": [
    "The server returned an invalid response.",
    "Seva imerudisha jibu lisilo sahihi.",
    "Serveur epesi eyano ya malamu te.",
  ],
  "Impossible de joindre Pepo. Vérifiez votre connexion et réessayez.": [
    "Cannot reach Pepo. Check your connection and try again.",
    "Pepo haipatikani. Angalia muunganisho na ujaribu tena.",
    "Pepo eyokani te. Tala connexion mpe meka lisusu.",
  ],
  "Impossible de joindre les cartes. Vérifiez Internet et le serveur, puis réessayez.":
    [
      "Cannot reach maps. Check the Internet and server, then retry.",
      "Ramani hazipatikani. Angalia intaneti na seva, kisha jaribu.",
      "Tokoki kokangisa karte te. Tala Internet mpe serveur, meka lisusu.",
    ],
  "Le service cartographique est indisponible.": [
    "Map service unavailable.",
    "Huduma ya ramani haipatikani.",
    "Servisi ya karte ezali te.",
  ],
  "La connexion au service de cartes n’est pas encore activée.": [
    "The map service is not connected yet.",
    "Huduma ya ramani haijaunganishwa bado.",
    "Servisi ya karte ekangisami naino te.",
  ],
  "Une carte réelle est nécessaire. Activez Google Maps pour choisir un point.":
    [
      "A real map is needed. Enable Google Maps to pick a point.",
      "Ramani halisi inahitajika. Washa Google Maps kuchagua eneo.",
      "Karte ya solo esengeli. Fungola Google Maps mpo na kopona esika.",
    ],
  "Course introuvable.": [
    "Ride not found.",
    "Safari haijapatikana.",
    "Course emonani te.",
  ],
  "Cette offre a expiré.": [
    "This offer has expired.",
    "Bei hii imepitwa na wakati.",
    "Offre oyo esili.",
  ],
  "Cette course ne peut plus être notée.": [
    "This ride can no longer be rated.",
    "Safari hii haiwezi kupewa maoni tena.",
    "Okoki kopesa avis lisusu na course oyo te.",
  ],
  "Prix invalide.": [
    "Invalid fare.",
    "Bei si sahihi.",
    "Ntalo ezali malamu te.",
  ],
  "Reconnectez-vous pour continuer.": [
    "Sign in again to continue.",
    "Ingia tena kuendelea.",
    "Kota lisusu mpo na kokoba.",
  ],
  "Cette installation est connectée au serveur. Utilisez votre numéro.": [
    "This app is connected. Use your phone number.",
    "Programu imeunganishwa. Tumia namba yako.",
    "Aplikasyo ekangami na serveur. Salela nimero na yo.",
  ],
  "Cette action est réservée à la démo.": [
    "This action is for the demo only.",
    "Hatua hii ni ya majaribio tu.",
    "Likambo oyo ezali kaka mpo na demo.",
  ],
  "Utilisez l’application Pepo Driver pour conduire.": [
    "Use Pepo Driver to drive.",
    "Tumia Pepo Driver kuendesha.",
    "Salela Pepo Driver mpo na kokumba.",
  ],
  "Passez en ligne pour répondre.": [
    "Go online to reply.",
    "Kuwa tayari kujibu.",
    "Fungola disponibilité mpo na koyanola.",
  ],
  "Impossible d’afficher cet écran. Réessayez.": [
    "Cannot show this screen. Try again.",
    "Ukurasa hauonekani. Jaribu tena.",
    "Tokoki kolakisa écran te. Meka lisusu.",
  ],
  "Un petit détour.": [
    "A small detour.",
    "Mchepuko mdogo.",
    "Nzela mosusu moke.",
  ],
  "Une erreur est survenue.": [
    "An error occurred.",
    "Hitilafu imetokea.",
    "Mokakatano esalemi.",
  ],
  "Des réponses simples": [
    "Simple answers",
    "Majibu rahisi",
    "Ba eyano ya pete",
  ],
  "en attente": ["pending", "inasubiri", "ezali kozela"],
  "non attribuée": ["not assigned", "haijatolewa", "epesami te"],
  "· code": ["· code", "· msimbo", "· code"],
  "· en attente": ["· pending", "· inasubiri", "· ezali kozela"],
  "· orientation à calibrer": [
    "· calibrate heading",
    "· rekebisha mwelekeo",
    "· bongisa direction",
  ],
  "Agrandir ou réduire le panneau": [
    "Expand or collapse panel",
    "Panua au punguza sehemu",
    "Matisa to kitisa panneau",
  ],
};
const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
const indexed = new Map(
  Object.entries(copyTranslations).map(([source, values]) => [
    normalize(source),
    values,
  ]),
);
const baseIndex = new Map(
  Object.entries(catalogs.fr).map(([key, value]) => [
    normalize(value),
    key as keyof typeof catalogs.fr,
  ]),
);
export function translateCopy(language: Language, source: string) {
  if (language === "fr" || !source.trim()) return source;
  const normalized = normalize(source);
  const safety = translateSafetyCopy(language, normalized);
  if (safety) return safety;
  const match = indexed.get(normalized);
  if (match) return match[({ en: 0, sw: 1, ln: 2 } as const)[language]];
  const key = baseIndex.get(normalized);
  if (key) return catalogs[language][key];
  return source;
}
