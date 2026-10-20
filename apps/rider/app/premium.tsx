import { useEffect, useState } from "react";
import { Pressable, ScrollView, Share, View } from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Check,
  Crown,
  Palette,
  Receipt,
  ShieldCheck,
} from "lucide-react-native";
import { useApp } from "@pepo/session/AppProvider";
import { api } from "@pepo/api-client/api";
import { Button, IconButton, Screen, Txt } from "@pepo/ui/UI";
import { PepoLogo } from "@pepo/ui/PepoLogo";
import { palettes, ThemeProvider, type ThemeName } from "@pepo/ui/Theme";
import { usePremium } from "../src/components/PremiumProvider";

export default function Premium() {
  const router = useRouter(),
    premium = usePremium();
  const [theme, setTheme] = useState<ThemeName>("purple"),
    [annual, setAnnual] = useState(false),
    [summary, setSummary] = useState<Summary | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const { profile } = useApp();
  useEffect(() => {
    setSummary(null);
    setError("");
  }, [profile?.id]);
  const color = palettes[theme];
  async function loadSummary() {
    setLoading(true);
    setError("");
    try {
      setSummary(await api<Summary>("/premium/summary"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: 22, paddingBottom: 42, gap: 24 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <IconButton
            label="Retour"
            icon={ArrowLeft}
            onPress={() => router.back()}
          />
          <Txt variant="small">PEPO PREMIUM</Txt>
          <Crown size={24} color="#8000FF" />
        </View>
        <View
          style={{
            backgroundColor: "#210637",
            borderRadius: 32,
            padding: 26,
            gap: 18,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              width: 230,
              height: 230,
              borderRadius: 115,
              backgroundColor: "#5700A6",
              right: -75,
              top: -85,
            }}
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <ThemeProvider theme="purple">
              <PepoLogo size={48} />
            </ThemeProvider>
            <Txt style={{ color: "#E8D0FF", letterSpacing: 2 }}>PREMIUM</Txt>
          </View>
          <Txt variant="h1" style={{ color: "white" }}>
            Vos trajets.{"\n"}Votre signature.
          </Txt>
          <Txt style={{ color: "#E8D0FF" }}>
            Une touche personnelle. Le même Pepo, à votre image.
          </Txt>
          <View
            style={{
              alignSelf: "flex-start",
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 20,
              backgroundColor: "#FFFFFF20",
            }}
          >
            <Txt variant="small" style={{ color: "white" }}>
              {premium.status.active
                ? "Premium actif"
                : "À partir de 0,99 $ / mois"}
            </Txt>
          </View>
        </View>
        <View style={{ gap: 12 }}>
          <Txt variant="h2">Choisissez votre univers</Txt>
          <Txt color="#656B63">
            L’aperçu est gratuit. Votre choix s’applique à l’application avec
            Premium.
          </Txt>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {(["purple", "mono", "classic"] as ThemeName[]).map((t) => (
              <Pressable
                key={t}
                accessibilityRole="button"
                accessibilityState={{ selected: theme === t }}
                accessibilityLabel={names[t]}
                onPress={() => setTheme(t)}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 18,
                  borderWidth: 2,
                  borderColor: theme === t ? "#8000FF" : "#EAECE5",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <ThemeProvider theme={t}>
                  <PepoLogo size={42} />
                </ThemeProvider>
                <Txt variant="small">{names[t]}</Txt>
                {theme === t ? (
                  <Check size={16} color="#8000FF" />
                ) : (
                  <View style={{ height: 16 }} />
                )}
              </Pressable>
            ))}
          </View>
          <ThemeProvider theme={theme}>
            <View
              style={{
                backgroundColor: color.background,
                padding: 20,
                borderRadius: 24,
                gap: 14,
                borderWidth: 1,
                borderColor: color.line,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <PepoLogo size={36} />
                <Txt variant="h2">On y va ?</Txt>
              </View>
              <View
                style={{
                  backgroundColor: color.ink,
                  padding: 18,
                  borderRadius: 18,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Txt style={{ color: "white" }}>Où allez-vous ?</Txt>
                <View
                  style={{
                    backgroundColor: color.yellow,
                    borderRadius: 12,
                    padding: 10,
                  }}
                >
                  <Txt style={{ color: color.onAccent }}>→</Txt>
                </View>
              </View>
              <Txt variant="small" color="#656B63">
                Aperçu du thème · {names[theme]}
              </Txt>
            </View>
          </ThemeProvider>
          {premium.status.active && (
            <Button
              title={
                premium.status.theme === theme
                  ? "Thème actuel"
                  : "Appliquer ce thème"
              }
              disabled={premium.busy || premium.status.theme === theme}
              onPress={() => premium.choose(theme)}
            />
          )}
        </View>
        <View style={{ gap: 18 }}>
          <Feature
            icon={Palette}
            title="Trois styles, un seul compte"
            detail="Violet, noir et blanc ou jaune Pepo. Changez selon votre envie."
          />
          <Feature
            icon={Receipt}
            title="Votre mois en un coup d’œil"
            detail="Courses terminées, kilomètres et montants convenus, avec un bilan à partager."
          />
          <Feature
            icon={ShieldCheck}
            title="L’essentiel reste pour tout le monde"
            detail="Sécurité, voix, réservation et accès aux chauffeurs restent identiques, avec ou sans Premium."
          />
        </View>
        {!premium.status.active && (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {[false, true].map((a) => (
                <Pressable
                  key={String(a)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: annual === a }}
                  onPress={() => setAnnual(a)}
                  style={{
                    flex: 1,
                    borderWidth: 2,
                    borderColor: annual === a ? "#8000FF" : "#EAECE5",
                    borderRadius: 20,
                    padding: 16,
                    gap: 8,
                  }}
                >
                  <Txt>{a ? "Annuel" : "Mensuel"}</Txt>
                  <Txt variant="h2">{a ? "11,88 $" : "1 $"}</Txt>
                  <Txt variant="small" color="#656B63">
                    {a ? "par an · 0,99 $ / mois" : "par mois"}
                  </Txt>
                </Pressable>
              ))}
            </View>
            <Txt color="#656B63">
              {annual ? "11,88 $ en un seul paiement annuel." : "1 $ par mois."}{" "}
              {
                "Tarifs prévus en USD. Le prix final sera affiché par le store avant l’achat."
              }
            </Txt>
            <Button
              title="Abonnement bientôt disponible"
              onPress={() => {}}
              disabled
            />
            <Txt variant="small" color="#656B63">
              Aucun paiement n’est effectué dans cette version.
            </Txt>
          </View>
        )}
        {premium.status.active && (
          <View style={{ gap: 12 }}>
            <Txt variant="h2">Mon bilan mensuel</Txt>
            <Button
              title="Afficher mon bilan"
              kind="secondary"
              disabled={loading}
              onPress={() => loadSummary()}
            />
            {summary && (
              <View
                style={{
                  padding: 20,
                  borderRadius: 20,
                  backgroundColor: "#F3E8FF",
                  gap: 10,
                }}
              >
                <Txt variant="h2">{summary.trips} courses terminées</Txt>
                <Txt>
                  {summary.month} · {summary.distanceKm} km
                </Txt>
                <Txt>{summary.agreedAmount.toLocaleString()} FC convenus</Txt>
                <Txt variant="small" color="#656B63">
                  {summary.cashConfirmedAmount.toLocaleString()} FC en espèces
                  confirmés par les chauffeurs. Ce bilan n’est pas une preuve de
                  paiement.
                </Txt>
                <Button
                  title="Partager mon bilan"
                  kind="secondary"
                  onPress={() => {
                    void Share.share({
                      message: `Mon mois avec Pepo · ${summary.month}\n${summary.trips} courses terminées · ${summary.distanceKm} km\n${summary.agreedAmount} FC convenus`,
                    }).catch(() => setError("Partage indisponible."));
                  }}
                />
              </View>
            )}
          </View>
        )}
        {premium.status.developmentPreview && (
          <View
            style={{
              gap: 10,
              borderTopWidth: 1,
              borderColor: "#EAECE5",
              paddingTop: 16,
            }}
          >
            <Txt variant="small" color="#656B63">
              Développement · aperçu temporaire d’une heure, sans paiement.
            </Txt>
            <Button
              title="Activer l’aperçu Premium"
              kind="secondary"
              disabled={premium.busy}
              onPress={() => premium.preview()}
            />
            {premium.status.source === "development" && (
              <Button
                title="Terminer l’aperçu"
                kind="secondary"
                disabled={premium.busy}
                onPress={() => premium.endPreview()}
              />
            )}
          </View>
        )}
        {!!(premium.error || error) && (
          <View accessibilityLiveRegion="polite" style={{ gap: 8 }}>
            <Txt style={{ color: "#B94537" }}>{premium.error || error}</Txt>
            <Button
              title="Réessayer"
              kind="secondary"
              onPress={() => void premium.refresh()}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
const names = { purple: "Violet", mono: "Noir & blanc", classic: "Jaune Pepo" };
type Summary = {
  month: string;
  trips: number;
  distanceKm: number;
  agreedAmount: number;
  cashConfirmedAmount: number;
};
function Feature({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Palette;
  title: string;
  detail: string;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 14 }}>
      <View
        style={{
          width: 42,
          height: 42,
          backgroundColor: "#F3E8FF",
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={22} color="#8000FF" />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Txt style={{ fontFamily: "DMSans_700Bold" }}>{title}</Txt>
        <Txt color="#656B63">{detail}</Txt>
      </View>
    </View>
  );
}
