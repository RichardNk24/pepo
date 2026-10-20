import { useEffect, useState } from "react";
import { View } from "react-native";
import { api } from "@pepo/api-client/api";
import type { Trip, Language } from "@pepo/types/model";
import { Button, Txt, useUI } from "./UI";

const copy = {
  fr: { waiting: "Espèces : réception non confirmée", received: "Espèces : réception confirmée par le chauffeur", collect: "J’ai reçu les espèces", question: "Confirmez uniquement après avoir reçu le montant convenu du passager.", refresh: "Actualiser le paiement" },
  en: { waiting: "Cash: receipt not confirmed", received: "Cash: receipt confirmed by the driver", collect: "I received the cash", question: "Confirm only after receiving the agreed amount from the passenger.", refresh: "Refresh payment" },
  sw: { waiting: "Pesa taslimu: kupokea hakujathibitishwa", received: "Dereva amethibitisha kupokea pesa taslimu", collect: "Nimepokea pesa taslimu", question: "Thibitisha baada ya kupokea kiasi mlichokubaliana na abiria.", refresh: "Angalia malipo tena" },
  ln: { waiting: "Mbongo: bazali naino kozela bondimisi", received: "Sofele andimi ete azwi mbongo", collect: "Nazwi mbongo", question: "Ndima kaka soki ozwi motuya oyo boyokanaki na mopaya.", refresh: "Tala lisusu kofuta" },
};

export function TripReceipt({ trip, language, driver = false, demo = false }: {
  trip: Trip; language: Language; driver?: boolean; demo?: boolean;
}) {
  const ui = useUI();
  const [received, setReceived] = useState(trip.cashCollectedAt);
  const [busy, setBusy] = useState(false);
  const text = copy[language] || copy.fr;
  useEffect(() => { setReceived(trip.cashCollectedAt); }, [trip.id, trip.cashCollectedAt]);
  if (trip.status !== "completed" || demo) return null;
  async function run(collect: boolean) {
    if (busy) return;
    if (collect && !await ui.confirm(text.collect, text.question)) return;
    setBusy(true);
    try {
      const updated = await api<Trip>(`/trips/${trip.id}/${collect ? "cash-collected" : "receipt"}`, collect ? {method:"POST"} : {});
      setReceived(updated.cashCollectedAt);
    } catch (error) { ui.alert("Pepo", (error as Error).message); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 12, marginVertical: 12 }}>
    <Txt>{received ? text.received : text.waiting}</Txt>
    {driver && !received ? <Button title={text.collect} disabled={busy} onPress={() => run(true)} /> : null}
    <Button title={text.refresh} kind="secondary" disabled={busy} onPress={() => run(false)} />
  </View>;
}
