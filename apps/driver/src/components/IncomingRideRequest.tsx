import { C } from "@pepo/config/tokens";
import { useApp } from "@pepo/session/AppProvider";
import type { Trip } from "@pepo/types/model";
import { Button, IconButton, Tag, Txt, s } from "@pepo/ui/UI";
import { fare } from "@pepo/utils/rules";
import { Minus, Plus } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { RouteSummary } from "./RouteSummary";
export function IncomingRideRequest({ trip }: { trip: Trip }) {
  const app = useApp();
  const [price, setPrice] = useState(trip.proposedPrice);
  const offer = trip.offers.find((o) => o.driver.id === app.profile?.id);
  return (
    <View style={[s.card, { gap: 14, marginBottom: 12 }]}>
      <View style={s.rowBetween}>
        <Txt variant="h3">{trip.guest?.name || trip.riderName}</Txt>
        {trip.guest && (
          <Txt variant="small">
            Réservée par {trip.riderName} · passager invité
          </Txt>
        )}
        <Tag>
          {trip.riderPhoneVerified
            ? app.t("unverified")
            : app.demo
              ? "Profil démo"
              : "Téléphone non confirmé"}
        </Tag>
      </View>
      <RouteSummary
        pickup={trip.pickup}
        destination={trip.destination}
        stops={trip.stops}
      />
      <View style={s.rowBetween}>
        <Txt variant="small" color={C.muted}>
          {trip.route.distanceKm} km · {trip.route.durationMin} min
        </Txt>
        <Txt variant="h3">{fare(trip.proposedPrice)}</Txt>
      </View>
      {offer?.status === "countered" ? (
        <>
          <Txt>Le passager propose {fare(offer.riderCounter!)}.</Txt>
          <Button
            title={`Accepter ${fare(offer.riderCounter!)}`}
            compact
            onPress={() => app.acceptCounter(trip.id, offer.id)}
          />
        </>
      ) : offer ? (
        <>
          <Tag tone="yellow">Offre de {fare(offer.price)} envoyée</Tag>
          <Txt variant="small" color={C.muted}>
            En attente du choix du passager. L’offre expire après 2 minutes.
          </Txt>
          <Button
            title="Actualiser mon offre"
            kind="secondary"
            compact
            onPress={() => app.submitOffer(trip.id, price)}
          />
        </>
      ) : (
        <>
          <View style={s.rowBetween}>
            <IconButton
              icon={Minus}
              label="Baisser le prix"
              onPress={() => setPrice((p) => Math.max(500, p - 500))}
            />
            <Txt variant="h3">{fare(price)}</Txt>
            <IconButton
              icon={Plus}
              label="Augmenter le prix"
              onPress={() => setPrice((p) => Math.min(500000, p + 500))}
            />
          </View>
          <Button
            compact
            title={
              price === trip.proposedPrice
                ? `Accepter ${fare(price)}`
                : `Proposer ${fare(price)}`
            }
            onPress={() => app.submitOffer(trip.id, price)}
          />
        </>
      )}
    </View>
  );
}
