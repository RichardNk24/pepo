import { C } from "@pepo/config/tokens";
import { useApp } from "@pepo/session/AppProvider";
import { Button, Header, Screen, Txt, s } from "@pepo/ui/UI";
import { useRouter } from "expo-router";
import {
  ArrowUpRight,
  HeartHandshake,
  HardHat as Helmet,
  KeyRound,
  Share2,
  ShieldCheck,
  UsersRound,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ContactEditor } from "../../src/components/ContactEditor";
export default function Safety() {
  const app = useApp(),
    router = useRouter();
  const [contact, setContact] = useState(false);
  const tips = [
    { icon: Helmet, title: app.t("helmet"), detail: app.t("helmetDetail") },
    {
      icon: KeyRound,
      title: app.t("checkDriver"),
      detail: app.t("checkDriverDetail"),
    },
    {
      icon: Share2,
      title: app.t("share"),
      detail:
        "Partagez le lien de votre course avec une personne de confiance.",
    },
  ];
  return (
    <Screen>
      <Header title={app.t("safety")} eyebrow="VOUS COMPTEZ." />
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingTop: 4,
          paddingBottom: 30,
        }}
      >
        <View style={safety.hero}>
          <View style={safety.symbol}>
            <ShieldCheck size={42} color={C.green} strokeWidth={1.5} />
          </View>
          <Txt
            variant="h1"
            style={{ fontSize: 33, lineHeight: 38, marginTop: 20 }}
          >
            {app.t("safetyTitle")}
          </Txt>
          <Txt color={C.green} style={{ marginTop: 11 }}>
            {app.t("safetyDescription")}
          </Txt>
        </View>
        <Pressable
          onPress={() => setContact(true)}
          style={[s.card, { marginTop: 20, gap: 12 }]}
        >
          <View style={s.rowBetween}>
            <View style={s.row}>
              <UsersRound color={C.ink} size={22} />
              <Txt variant="h3">{app.t("emergency")}</Txt>
            </View>
            <ArrowUpRight size={18} color={C.muted} />
          </View>
          <Txt color={C.muted}>
            {app.profile?.emergencyContact
              ? `${app.profile.emergencyContact.name} · ${app.profile.emergencyContact.phone}`
              : app.t("addContact")}
          </Txt>
        </Pressable>
        <Txt
          variant="micro"
          color={C.muted}
          style={{ marginTop: 28, marginBottom: 18 }}
        >
          {app.t("safetyGuide").toUpperCase()}
        </Txt>
        {tips.map((t) => (
          <View
            key={t.title}
            style={[
              s.row,
              { alignItems: "flex-start", marginBottom: 22, gap: 15 },
            ]}
          >
            <View
              style={{
                padding: 12,
                borderRadius: 15,
                backgroundColor: C.background,
              }}
            >
              <t.icon size={22} color={C.ink} strokeWidth={1.5} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Txt variant="label">{t.title}</Txt>
              <Txt variant="small" color={C.muted}>
                {t.detail}
              </Txt>
            </View>
          </View>
        ))}
        <Button
          title={app.t("sos")}
          icon={HeartHandshake}
          kind="yellow"
          onPress={() => router.push("/help")}
        />
        <Txt
          variant="small"
          color={C.muted}
          style={{ textAlign: "center", marginTop: 12 }}
        >
          Choisissez un appel, un SMS ou un signalement. Aucun service d’urgence
          n’est alerté automatiquement.
        </Txt>
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
        visible={contact}
        onClose={() => setContact(false)}
      />
    </Screen>
  );
}
const safety = StyleSheet.create({
  hero: { padding: 25, backgroundColor: C.greenSoft, borderRadius: 26 },
  symbol: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: "#DCEBDB",
    alignItems: "center",
    justifyContent: "center",
  },
});
