import { C } from "@pepo/config/tokens";
import { useApp } from "@pepo/session/AppProvider";
import { Button, Field, Header, s, Screen, Txt, useUI } from "@pepo/ui/UI";
import {
  HeartHandshake,
  MessageSquare,
  Phone,
  Share2,
  ShieldCheck,
} from "lucide-react-native";
import { useState } from "react";
import { Linking, Platform, ScrollView, View } from "react-native";
import { ContactEditor } from "../src/components/ContactEditor";
export default function Help() {
  const app = useApp(),
    ui = useUI();
  const [contactEditor, setContactEditor] = useState(false),
    [detail, setDetail] = useState("");
  const contact = app.profile?.emergencyContact,
    trip = app.activeTrip;
  const sms = async () => {
    if (!contact)
      throw new Error("Ajoutez d’abord votre contact de confiance.");
    let text = `${app.demo ? "[DÉMO PEPO] " : ""}J’ai besoin d’aide. ${trip ? `Trajet ${trip.pickup.name} → ${trip.destination.name}. Conducteur : ${trip.driver?.name || "en attente"}, plaque ${trip.driver?.driver.plate || "non attribuée"}.` : ""}`;
    if (trip?.driverLocation && !app.demo)
      text += ` Dernière position : https://www.google.com/maps/search/?api=1&query=${trip.driverLocation.latitude},${trip.driverLocation.longitude}`;
    await Linking.openURL(
      `sms:${contact.phone}${Platform.OS === "ios" ? "&" : "?"}body=${encodeURIComponent(text)}`,
    );
  };
  return (
    <Screen>
      <Header title="On reste avec vous." back />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 24,
          paddingTop: 4,
          paddingBottom: 40,
        }}
      >
        <View style={[s.card, { backgroundColor: C.redSoft, gap: 13 }]}>
          <HeartHandshake size={34} color={C.red} />
          <Txt variant="h2">{app.t("sos")}</Txt>
          <Txt>
            En danger immédiat, contactez les secours locaux ou une personne de
            confiance. Choisissez ci-dessous une action à lancer depuis votre
            téléphone.
          </Txt>
          <Txt variant="small" color={C.red}>
            Ce bouton ne déclenche aucun appel automatique et aucun service
            d’urgence n’est alerté par Pepo.
          </Txt>
        </View>
        <View style={{ marginTop: 22, gap: 12 }}>
          <Txt variant="h3">{app.t("emergency")}</Txt>
          <Txt color={C.muted}>
            {contact
              ? `${contact.name} · ${contact.phone}`
              : "Ajoutez une personne qui peut vous aider."}
          </Txt>
          {contact ? (
            <>
              <Button
                title={`Appeler ${contact.name.split(" ")[0]}`}
                icon={Phone}
                onPress={async () => {
                  if (
                    await ui.confirm(
                      "Ouvrir l’appel ?",
                      `Le téléphone va ouvrir un appel vers ${contact.phone}.`,
                    )
                  )
                    await Linking.openURL("tel:" + contact.phone);
                }}
              />
              <Button
                title="Préparer un SMS d’aide"
                icon={MessageSquare}
                kind="secondary"
                onPress={sms}
              />
            </>
          ) : (
            <Button
              title={app.t("addContact")}
              kind="yellow"
              onPress={() => setContactEditor(true)}
            />
          )}
        </View>
        {trip?.driverId && (
          <Button
            style={{ marginTop: 13 }}
            title={app.t("share")}
            icon={Share2}
            kind="secondary"
            onPress={() => app.shareTrip(trip.id)}
          />
        )}
        <View style={{ marginTop: 28, gap: 14 }}>
          <Txt variant="h3">{app.t("support")}</Txt>
          <Txt variant="small" color={C.muted}>
            Décrivez un incident ou un comportement préoccupant. Ce formulaire
            ne remplace pas un appel d’urgence.
          </Txt>
          <Field
            value={detail}
            onChangeText={setDetail}
            placeholder="Que s’est-il passé ?"
            multiline
            maxLength={2000}
            style={{ height: 125, textAlignVertical: "top" }}
          />
          <Button
            title="Enregistrer mon signalement"
            kind="secondary"
            icon={ShieldCheck}
            disabled={detail.trim().length < 5}
            onPress={async () => {
              const id = await app.report("Sécurité", detail.trim(), trip?.id);
              setDetail("");
              ui.alert(
                "Signalement enregistré",
                `${app.demo ? "Enregistré dans la démo uniquement. Aucun opérateur alerté." : "Votre signalement est disponible pour l’équipe qui administre ce serveur. Aucun traitement immédiat n’est garanti."}\nRéférence : ${id.slice(0, 8).toUpperCase()}`,
              );
            }}
          />
        </View>
      </ScrollView>
      <ContactEditor
        initialContacts={
          app.profile?.trustedContacts ||
          (app.profile?.emergencyContact ? [app.profile.emergencyContact] : [])
        }
        onSave={(contacts) =>
          app.updateProfile({
            trustedContacts: contacts,
            emergencyContact: contacts[0] || null,
          })
        }
        visible={contactEditor}
        onClose={() => setContactEditor(false)}
      />
    </Screen>
  );
}
