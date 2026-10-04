import { C } from "@pepo/config/tokens";
import { useApp } from "@pepo/session/AppProvider";
import { useLocation } from "@pepo/session/LocationProvider";
import type { Language } from "@pepo/types/model";
import {
  Button,
  Field,
  Header,
  IconButton,
  s,
  Screen,
  Tag,
  Txt,
  useUI,
} from "@pepo/ui/UI";
import { CITIES } from "@pepo/utils/cities";
import { cityFromLocation, formatPhone } from "@pepo/utils/onboarding";
import { useVoice } from "@pepo/voice/useVoice";
import { useRouter } from "expo-router";
import {
  Camera,
  ChevronRight,
  FileBadge2,
  Globe2,
  HelpCircle,
  LogOut,
  MapPin,
  Repeat2,
  Settings2,
  ShieldCheck,
  UserRound,
  UsersRound,
  Wallet,
  X,
} from "lucide-react-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { AccountPayments } from "../../src/components/AccountPayments";
import { AccountPhoto } from "../../src/components/AccountPhoto";
import { ContactEditor } from "../../src/components/ContactEditor";
type Panel = "profile" | "photo" | "payments" | "settings" | null;
export default function Account() {
  const voice = useVoice();
  const app = useApp(),
    router = useRouter(),
    ui = useUI(),
    location = useLocation();
  const [contact, setContact] = useState(false),
    [panel, setPanel] = useState<Panel>(null),
    [name, setName] = useState(app.profile?.name || "");
  const identity = app.profile?.identityVerification;
  const identityText =
    identity === "verified"
      ? "Identité examinée par Pepo"
      : identity === "pending"
        ? "Documents à examiner"
        : identity === "rejected"
          ? "Documents à corriger"
          : "Pièce d’identité et selfie";
  const contacts =
    app.profile?.trustedContacts ||
    (app.profile?.emergencyContact ? [app.profile.emergencyContact] : []);
  const row = (
    label: string,
    detail: string,
    Icon: typeof UserRound,
    onPress: () => void,
  ) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        {
          minHeight: 82,
          paddingVertical: 16,
          paddingHorizontal: 14,
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: C.line,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View
        style={{ padding: 10, borderRadius: 14, backgroundColor: C.yellowSoft }}
      >
        <Icon size={23} color={C.ink} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Txt variant="label" style={{ fontSize: 17 }}>
          {label}
        </Txt>
        <Txt color={C.muted} style={{ fontSize: 14, lineHeight: 20 }}>
          {detail}
        </Txt>
      </View>
      <ChevronRight size={19} color={C.muted} />
    </Pressable>
  );
  const title =
    panel === "profile"
      ? "Mes informations"
      : panel === "photo"
        ? "Ma photo"
        : panel === "payments"
          ? "Mes paiements"
          : "Mes réglages";
  const openProfile = () => {
    setName(app.profile?.name || "");
    setPanel("profile");
  };
  return (
    <Screen>
      <Header title="Mon compte" />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: 4,
          paddingBottom: 32,
          gap: 22,
        }}
      >
        <View style={[s.card, { padding: 18, gap: 16 }]}>
          <View style={[s.row, { gap: 16 }]}>
            <AccountPhoto onPress={() => setPanel("photo")} />
            <View style={{ flex: 1, gap: 5 }}>
              <Txt variant="h2" style={{ fontSize: 23 }}>
                {app.profile?.name}
              </Txt>
              <Txt color={C.muted}>
                {app.profile?.phone?.startsWith("+243")
                  ? "+243 " + formatPhone(app.profile.phone.slice(4))
                  : app.profile?.phone}
              </Txt>
              <Tag
                tone={
                  app.demo
                    ? "yellow"
                    : identity === "verified"
                      ? "green"
                      : "neutral"
                }
              >
                {app.demo
                  ? "Compte de démonstration"
                  : identity === "verified"
                    ? "Identité examinée"
                    : app.profile?.role === "driver"
                      ? "Conducteur"
                      : "Passager"}
              </Tag>
            </View>
          </View>
          <Button
            title="Modifier mon profil"
            kind="secondary"
            icon={UserRound}
            onPress={openProfile}
          />
        </View>
        {app.demo && (
          <Txt variant="small" color={C.muted}>
            Mode démo : utilisez des informations fictives pour tester.
          </Txt>
        )}
        <View
          style={{
            borderRadius: 20,
            borderWidth: 1,
            borderColor: C.line,
            overflow: "hidden",
          }}
        >
          {row("Mon identité", identityText, FileBadge2, () =>
            router.push("/documents"),
          )}
          {row(
            "Mes paiements",
            app.profile?.paymentMethods?.length
              ? "Mobile Money et espèces"
              : "Espèces, Mobile Money et carte",
            Wallet,
            () => setPanel("payments"),
          )}
          {row(
            "Mes contacts de confiance",
            contacts.length
              ? contacts.length === 1
                ? "1 proche enregistré"
                : `${contacts.length} proches enregistrés`
              : "Ajouter un proche",
            UsersRound,
            () => setContact(true),
          )}
          {row(
            "Sécurité et assistance",
            "Partager une course, signaler un problème",
            ShieldCheck,
            () => router.push("/(tabs)/safety"),
          )}
        </View>
        <View
          style={{
            borderRadius: 20,
            borderWidth: 1,
            borderColor: C.line,
            overflow: "hidden",
          }}
        >
          {row("Mes réglages", "Langue et localisation", Settings2, () =>
            setPanel("settings"),
          )}
          {row("Besoin d’aide ?", "Des réponses simples", HelpCircle, () =>
            router.push("/help"),
          )}
          {app.profile?.role === "driver" &&
            row(
              "Mon véhicule et mon dossier",
              "Les documents pour conduire",
              Repeat2,
              () => router.push("/documents"),
            )}
        </View>
        <Button
          title={app.t("signOut")}
          kind="secondary"
          icon={LogOut}
          onPress={async () => {
            if (
              await ui.confirm(
                "Se déconnecter ?",
                "Vous retrouverez votre compte avec votre numéro de téléphone.",
              )
            ) {
              await app.signOut();
              router.replace("/onboarding");
            }
          }}
        />
        <Txt variant="small" color={C.muted} style={{ textAlign: "center" }}>
          pepo · 1.1.1
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
      <Modal
        visible={panel !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPanel(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "#18211570",
              justifyContent: "flex-end",
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: 460,
                maxHeight: "90%",
                backgroundColor: C.paper,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                padding: 22,
                paddingBottom: 30,
              }}
            >
              <View style={[s.rowBetween, { marginBottom: 16 }]}>
                <Txt variant="h2">{title}</Txt>
                <IconButton
                  icon={X}
                  label="Fermer"
                  onPress={() => setPanel(null)}
                />
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: 18, paddingBottom: 10 }}
              >
                {panel === "photo" && <AccountPhoto open />}
                {panel === "profile" && (
                  <>
                    <Button
                      title="Changer ma photo"
                      kind="secondary"
                      icon={Camera}
                      onPress={() => setPanel("photo")}
                    />
                    <Field
                      label="Votre nom"
                      value={name}
                      onChangeText={setName}
                      maxLength={80}
                      autoCapitalize="words"
                    />
                    <View style={[s.card, { gap: 4 }]}>
                      <Txt variant="label">Votre téléphone</Txt>
                      <Txt>{app.profile?.phone}</Txt>
                      <Txt variant="small" color={C.muted}>
                        Il sert à vous connecter. Son changement nécessite une
                        nouvelle confirmation par SMS.
                      </Txt>
                    </View>
                    <Button
                      title="Enregistrer mon nom"
                      disabled={name.trim().length < 2}
                      onPress={async () => {
                        await app.updateProfile({ name: name.trim() });
                        setPanel(null);
                      }}
                    />
                  </>
                )}
                {panel === "payments" && <AccountPayments />}
                {panel === "settings" && (
                  <>
                    <View style={s.row}>
                      <Globe2 size={22} />
                      <Txt variant="h3">Ma langue</Txt>
                    </View>
                    {(
                      [
                        { id: "fr", name: "Français" },
                        { id: "en", name: "English" },
                        { id: "sw", name: "Kiswahili" },
                        { id: "ln", name: "Lingala" },
                      ] as { id: Language; name: string }[]
                    ).map((l) => (
                      <Button
                        key={l.id}
                        title={l.name}
                        kind={
                          app.settings.language === l.id
                            ? "yellow"
                            : "secondary"
                        }
                        onPress={() => app.setLanguage(l.id)}
                      />
                    ))}
                    <Txt variant="small" color={C.muted}>
                      {app.t("voicePrivacy")}
                    </Txt>
                    <Button
                      title={app.t("listen")}
                      kind="secondary"
                      onPress={() => voice.speak(app.t("voiceGuide"))}
                    />
                    {voice.message ? (
                      <Txt color={C.muted}>{voice.message}</Txt>
                    ) : null}
                    <Txt variant="small">{app.t("voiceGuide")}</Txt>
                    <View style={s.row}>
                      <MapPin size={22} />
                      <Txt variant="h3">Ma localisation</Txt>
                    </View>
                    <Txt>
                      Ville du compte : {CITIES[app.settings.city].name}
                    </Txt>
                    <Button
                      title="Actualiser avec ma position"
                      kind="secondary"
                      onPress={async () => {
                        const fix = await location.enable();
                        const city = cityFromLocation(fix);
                        if (!city)
                          throw new Error(
                            "Votre position est hors des villes desservies pour le moment.",
                          );
                        await app.updateProfile({ city });
                        ui.alert("Position actualisée", CITIES[city].name);
                      }}
                    />
                    <Button
                      title="Autorisations du téléphone"
                      kind="secondary"
                      onPress={() => {
                        if (Platform.OS === "web")
                          ui.alert(
                            "Localisation",
                            "Ouvrez les autorisations de ce site dans votre navigateur.",
                          );
                        else void Linking.openSettings();
                      }}
                    />
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}
