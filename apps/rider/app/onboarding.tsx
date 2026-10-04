import { C } from "@pepo/config/tokens";
import { LANGUAGES } from "@pepo/i18n/locale";
import { useApp } from "@pepo/session/AppProvider";
import { useLocation } from "@pepo/session/LocationProvider";
import type { CityId, Role } from "@pepo/types/model";
import { PepoLogo } from "@pepo/ui/PepoLogo";
import { Button, Field, IconButton, Screen, Tag, Txt, s } from "@pepo/ui/UI";
import { CITIES } from "@pepo/utils/cities";
import {
  cityFromLocation,
  formatPhone,
  phoneDigits,
} from "@pepo/utils/onboarding";
import * as Haptics from "expo-haptics";
import { Redirect, useRouter } from "expo-router";
import { ArrowLeft, ArrowRight } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { WelcomePhotos } from "../src/components/WelcomePhotos";

export default function Onboarding() {
  const app = useApp(),
    router = useRouter();
  const [step, setStep] = useState(0),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [devCode, setDevCode] = useState<string>();
  const role: Role = "passenger";
  const [city, setCity] = useState<CityId | null>(null);
  const location = useLocation();
  const phoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tap = () => {
    if (Platform.OS !== "web") void Haptics.selectionAsync().catch(() => {});
  };
  useEffect(
    () => () => {
      if (phoneTimer.current) clearTimeout(phoneTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (location.fix && !location.stale)
      setCity(cityFromLocation(location.fix));
    else setCity(null);
  }, [location.fix, location.stale]);
  const changePhone = (value: string) => {
    const next = phoneDigits(value);
    if (phoneTimer.current) clearTimeout(phoneTimer.current);
    if (next !== phone) {
      if (next.length === 9 && phone.length < 9 && /^[89]\d{8}$/.test(next)) {
        if (Platform.OS !== "web")
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          ).catch(() => {});
        phoneTimer.current = setTimeout(() => Keyboard.dismiss(), 250);
      } else tap();
    }
    setPhone(next);
  };
  if (app.profile) return <Redirect href="/(tabs)" />;
  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={o.top}>
            <View style={s.row}>
              <PepoLogo size={42} />
              <Txt variant="h2" style={{ letterSpacing: -1.5 }}>
                pepo
              </Txt>
            </View>
            <Tag tone="yellow">RDC · ON Y VA</Tag>
          </View>
          {step === 0 ? (
            <>
              <View style={o.hero}>
                <WelcomePhotos />
              </View>
              <View style={o.copy}>
                <Txt variant="micro" color={C.muted}>
                  LA MOBILITÉ, À VOTRE FAÇON
                </Txt>
                <Txt
                  variant="h1"
                  style={{
                    fontSize: 40,
                    lineHeight: 44,
                    marginTop: 10,
                    marginBottom: 12,
                  }}
                >
                  {app.t("welcome")}
                </Txt>
                <Txt color={C.muted} style={{ lineHeight: 24, maxWidth: 325 }}>
                  {app.t("welcomeSub")}
                </Txt>
              </View>
              <View style={o.actions}>
                <View
                  style={[
                    s.row,
                    { flexWrap: "wrap", justifyContent: "center" },
                  ]}
                >
                  {LANGUAGES.map((l) => (
                    <Button
                      key={l.id}
                      compact
                      title={l.label}
                      kind={
                        app.settings.language === l.id ? "yellow" : "secondary"
                      }
                      style={{ paddingHorizontal: 10, minWidth: 65 }}
                      onPress={() => app.setLanguage(l.id)}
                    />
                  ))}
                </View>
                <Button
                  title={app.t("getStarted")}
                  icon={ArrowRight}
                  onPress={() => setStep(1)}
                />
                {app.demo && (
                  <Button
                    title={app.t("tryDemo")}
                    kind="secondary"
                    onPress={async () => {
                      await app.enterDemo();
                      router.replace("/(tabs)");
                    }}
                  />
                )}
                <Txt
                  variant="small"
                  color={C.muted}
                  style={{ textAlign: "center" }}
                >
                  {app.demo
                    ? "La démo fonctionne sans compte ni paiement."
                    : "Votre téléphone sera confirmé par un code."}
                </Txt>
              </View>
            </>
          ) : (
            <View style={{ flex: 1, padding: 24, gap: 22 }}>
              <View style={s.rowBetween}>
                <IconButton
                  icon={ArrowLeft}
                  label={app.t("back")}
                  onPress={() => setStep(step - 1)}
                />
                <Txt variant="micro" color={C.muted}>
                  {step === 1 ? "01" : "02"} / 02
                </Txt>
              </View>
              <View style={{ gap: 8 }}>
                <Txt variant="h1">
                  {step === 1
                    ? "Faisons\nconnaissance."
                    : "Un dernier\npetit code."}
                </Txt>
                <Txt color={C.muted}>
                  {step === 1
                    ? "Une inscription simple. Et vous voilà en route."
                    : `Confirmez le numéro +243 ${formatPhone(phone)}.`}
                </Txt>
              </View>
              {step === 1 ? (
                <>
                  <Field
                    label={app.t("name")}
                    value={name}
                    onChangeText={setName}
                    placeholder="Prénom et nom"
                    autoCapitalize="words"
                    autoComplete="name"
                    maxLength={80}
                  />
                  <View style={{ gap: 7 }}>
                    <Txt variant="small" color={C.muted}>
                      {app.t("phone")}
                    </Txt>
                    <View style={[s.input, s.row]}>
                      <Txt variant="label">+243</Txt>
                      <TextInput
                        accessibilityLabel="Votre numéro, sans l’indicatif +243"
                        value={formatPhone(phone)}
                        onChangeText={changePhone}
                        placeholder="99 96 44 033"
                        placeholderTextColor={C.muted}
                        keyboardType="phone-pad"
                        autoComplete="tel-national"
                        textContentType="telephoneNumber"
                        onBlur={() => {
                          if (phoneTimer.current)
                            clearTimeout(phoneTimer.current);
                        }}
                        style={{
                          flex: 1,
                          minHeight: 42,
                          paddingHorizontal: 8,
                          fontSize: 18,
                          color: C.ink,
                          fontFamily: "DMSans_400Regular",
                        }}
                      />
                    </View>
                  </View>
                  <View style={{ gap: 8 }}>
                    <Txt variant="small" color={city ? C.green : C.muted}>
                      {city
                        ? `Position détectée · ${CITIES[city].name}`
                        : location.status === "searching"
                          ? "Recherche de votre position…"
                          : location.fix
                            ? "Pepo ne dessert pas encore votre position actuelle."
                            : "Partagez votre position pour trouver votre ville."}
                    </Txt>
                    {!city && (
                      <Button
                        compact
                        title="Partager ma position"
                        kind="secondary"
                        onPress={async () => {
                          tap();
                          const fix = await location.enable();
                          const detected = cityFromLocation(fix);
                          setCity(detected);
                          if (!detected)
                            throw new Error(
                              "Votre position est hors des villes actuellement desservies par Pepo.",
                            );
                        }}
                      />
                    )}
                  </View>
                  <Button
                    title={app.t("continue")}
                    disabled={
                      name.trim().length < 2 ||
                      !/^[89]\d{8}$/.test(phone) ||
                      !city
                    }
                    onPress={async () => {
                      tap();
                      Keyboard.dismiss();
                      const test = await app.requestOtp("+243" + phone);
                      setDevCode(test);
                      setStep(2);
                    }}
                  />
                  <Txt variant="small" color={C.muted}>
                    Vos informations servent à votre compte et à la sécurité de
                    vos courses. Aucune géolocalisation sans votre autorisation.
                  </Txt>
                </>
              ) : (
                <>
                  {devCode && (
                    <View
                      style={[
                        s.card,
                        { backgroundColor: C.yellowSoft, gap: 7 },
                      ]}
                    >
                      <Txt variant="label">
                        {app.demo ? "Mode démo" : "Test local sans SMS"} · code{" "}
                        {devCode}
                      </Txt>
                      <Txt variant="small" color={C.muted}>
                        Ce code de test ne vérifie pas une identité réelle.
                      </Txt>
                    </View>
                  )}
                  <Field
                    label="Code de confirmation"
                    value={code}
                    onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
                    placeholder={app.demo ? "0000" : "000000"}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    maxLength={app.demo ? 4 : 6}
                    style={{
                      fontSize: 30,
                      letterSpacing: 9,
                      textAlign: "center",
                    }}
                  />
                  <Button
                    title="Entrer dans Pepo"
                    disabled={code.length !== (app.demo ? 4 : 6)}
                    onPress={async () => {
                      tap();
                      const fix = await location.enable();
                      const detectedCity = cityFromLocation(fix);
                      if (!detectedCity)
                        throw new Error(
                          "Pepo ne dessert pas encore votre position actuelle.",
                        );
                      await app.signIn({
                        name,
                        phone: "+243" + phone,
                        code,
                        role,
                        city: detectedCity,
                      });
                      router.replace("/(tabs)");
                    }}
                  />
                  <Button
                    title="Renvoyer le code"
                    kind="secondary"
                    onPress={async () => {
                      setDevCode(await app.requestOtp("+243" + phone));
                    }}
                  />
                </>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
const o = StyleSheet.create({
  top: {
    paddingHorizontal: 26,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hero: { paddingHorizontal: 24, marginTop: 26 },
  copy: { paddingHorizontal: 28, paddingTop: 18 },
  actions: { padding: 28, paddingTop: 30, gap: 12, marginTop: "auto" },
  role: {
    flex: 1,
    minHeight: 103,
    borderRadius: 18,
    padding: 14,
    gap: 9,
    borderWidth: 1.5,
  },
  city: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20 },
});
