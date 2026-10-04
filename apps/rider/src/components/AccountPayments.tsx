import { C } from "@pepo/config/tokens";
import { useApp } from "@pepo/session/AppProvider";
import { Button, Field, IconButton, Txt, s } from "@pepo/ui/UI";
import { formatPhone } from "@pepo/utils/onboarding";
import {
  MONEY_NETWORKS,
  moneyMethodsIssue,
  parseMoneyPhone,
} from "@pepo/utils/mobileMoney";
import * as Crypto from "expo-crypto";
import {
  ArrowLeft,
  Banknote,
  Check,
  CreditCard,
  Smartphone,
  Trash2,
} from "lucide-react-native";
import { useState } from "react";
import { Keyboard, Pressable, View } from "react-native";
import { MobileMoneyLogo } from "./MobileMoneyLogo";
export const MONEY_PROVIDERS = MONEY_NETWORKS;

export function AccountPayments() {
  const app = useApp();
  const [phone, setPhone] = useState("");
  const [adding, setAdding] = useState(false),
    [card, setCard] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const methods = app.profile?.paymentMethods || [];
  const parsed = parseMoneyPhone(phone);
  const detected = MONEY_NETWORKS.find((n) => n.id === parsed.provider);
  const count = methods.filter((m) => m.provider === parsed.provider).length;
  const duplicate =
    !!parsed.phone && methods.some((m) => m.phone === parsed.phone);
  const canSave =
    parsed.status === "valid" && count < 2 && !duplicate && !saving;
  const save = async () => {
    if (!canSave || !parsed.phone || !parsed.provider) return;
    const next = [
      ...methods,
      {
        id: Crypto.randomUUID(),
        provider: parsed.provider,
        phone: parsed.phone,
      },
    ];
    const issue = moneyMethodsIssue(next, methods);
    if (issue) {
      setError(app.t(issue));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await app.updateProfile({ paymentMethods: next });
      Keyboard.dismiss();
      setAdding(false);
      setPhone("");
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const remove = async (id: string) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await app.updateProfile({
        paymentMethods: methods.filter((m) => m.id !== id),
      });
      setRemoving(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  // Keep card navigation inside this sheet instead of opening a hidden second Modal.
  // A provider must tokenize cards; profile PATCH must never collect card credentials.
  if (card)
    return (
      <View style={{ gap: 18 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={app.t("paymentBack")}
          onPress={() => setCard(false)}
          style={[s.row, { minHeight: 44 }]}
        >
          <ArrowLeft size={21} />
          <Txt>{app.t("paymentBack")}</Txt>
        </Pressable>
        <View
          style={{
            backgroundColor: C.ink,
            borderRadius: 22,
            padding: 24,
            gap: 28,
          }}
        >
          <CreditCard size={30} color={C.yellow} />
          <Txt variant="h2" color={C.paper}>
            {app.t("paymentCard")}
          </Txt>
          <View style={s.row}>
            <Txt translate={false} variant="label" color={C.paper}>
              VISA
            </Txt>
            <Txt translate={false} variant="label" color={C.paper}>
              Mastercard
            </Txt>
          </View>
        </View>
        <Txt variant="h3">{app.t("paymentCardSoon")}</Txt>
        <Txt color={C.muted}>{app.t("paymentCardNotConnected")}</Txt>
        <Button
          title={app.t("paymentBack")}
          kind="secondary"
          onPress={() => setCard(false)}
        />
      </View>
    );
  return (
    <View style={{ gap: 18 }}>
      <View style={[s.card, { backgroundColor: C.greenSoft, gap: 6 }]}>
        <View style={s.row}>
          <Banknote size={22} color={C.green} />
          <Txt variant="label">{app.t("paymentCash")}</Txt>
        </View>
        <Txt variant="small">{app.t("paymentCashHint")}</Txt>
      </View>
      <View style={{ gap: 12 }}>
        <Txt variant="h3">Mobile Money</Txt>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {MONEY_NETWORKS.map((n) => (
            <View key={n.id} style={{ flex: 1, alignItems: "center", gap: 6 }}>
              <MobileMoneyLogo provider={n.id} />
              <Txt translate={false} style={{ fontSize: 12 }} numberOfLines={1}>
                {n.name}
              </Txt>
            </View>
          ))}
        </View>
        {methods.map((m) => {
          const network = MONEY_NETWORKS.find((n) => n.id === m.provider);
          return (
            <View
              key={m.id}
              style={{
                borderWidth: 1,
                borderColor: C.line,
                borderRadius: 16,
                padding: 12,
                gap: 10,
              }}
            >
              <View style={[s.row, { gap: 12 }]}>
                {network ? (
                  <MobileMoneyLogo provider={network.id} />
                ) : (
                  <Smartphone size={24} color={C.muted} />
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt translate={false} variant="label">
                    {network?.name || app.t("moneyLegacy")}
                  </Txt>
                  <Txt translate={false}>
                    +243 {formatPhone(m.phone.slice(4))}
                  </Txt>
                  <Txt variant="small" color={C.muted}>
                    {app.t("moneySavedUnverified")}
                  </Txt>
                </View>
                <IconButton
                  icon={Trash2}
                  label={app.t("moneyRemove")}
                  onPress={() => {
                    if (!saving) {
                      setRemoving(m.id);
                      setError("");
                    }
                  }}
                />
              </View>
              {removing === m.id && (
                <View style={{ gap: 8 }}>
                  <Txt>{app.t("moneyRemoveQuestion")}</Txt>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Button
                      title={app.t("cancel")}
                      compact
                      kind="secondary"
                      disabled={saving}
                      style={{ flex: 1 }}
                      onPress={() => setRemoving(null)}
                    />
                    <Button
                      title={app.t("moneyRemove")}
                      compact
                      kind="danger"
                      disabled={saving}
                      style={{ flex: 1 }}
                      onPress={() => remove(m.id)}
                    />
                  </View>
                </View>
              )}
            </View>
          );
        })}
        {saved && (
          <View style={s.row}>
            <Check size={17} color={C.green} />
            <Txt color={C.green}>{app.t("moneySaved")}</Txt>
          </View>
        )}
        {!adding ? (
          <Button
            title={app.t("moneyAdd")}
            icon={Smartphone}
            kind="secondary"
            disabled={
              saving ||
              MONEY_NETWORKS.every(
                (n) => methods.filter((m) => m.provider === n.id).length >= 2,
              )
            }
            onPress={() => {
              setAdding(true);
              setSaved(false);
              setError("");
              setRemoving(null);
            }}
          />
        ) : (
          <View
            style={{
              gap: 10,
              borderRadius: 18,
              padding: 14,
              backgroundColor: C.background,
            }}
          >
            <Field
              label={app.t("moneyPhone")}
              accessibilityLabel={app.t("moneyPhone")}
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                setError("");
              }}
              editable={!saving}
              keyboardType="phone-pad"
              autoComplete="tel"
              placeholder="099 123 4567"
              maxLength={24}
            />
            <Txt variant="small" color={C.muted}>
              {app.t("moneyFormats")}
            </Txt>
            {detected && (
              <View style={s.row}>
                <MobileMoneyLogo provider={detected.id} />
                <View style={{ flex: 1 }}>
                  <Txt translate={false} variant="label">
                    {detected.name}
                  </Txt>
                  <Txt variant="small" color={C.muted}>
                    {app.t("moneyDetected")}
                  </Txt>
                </View>
              </View>
            )}
            {(duplicate ||
              count >= 2 ||
              parsed.status === "invalid" ||
              parsed.status === "unsupported") && (
              <Txt color={C.red} accessibilityLiveRegion="polite">
                {app.t(
                  duplicate
                    ? "moneyDuplicate"
                    : count >= 2
                      ? "moneyTwoNumbers"
                      : parsed.status === "unsupported"
                        ? "moneyUnknownNetwork"
                        : "moneyInvalidPhone",
                )}
              </Txt>
            )}
            <Button
              title={app.t("moneySave")}
              icon={Check}
              kind="yellow"
              disabled={!canSave}
              onPress={save}
            />
            <Button
              title={app.t("cancel")}
              kind="secondary"
              disabled={saving}
              compact
              onPress={() => {
                setAdding(false);
                setPhone("");
                setError("");
              }}
            />
          </View>
        )}
        {!!error && (
          <Txt color={C.red} accessibilityLiveRegion="polite">
            {error}
          </Txt>
        )}
        <Txt variant="small" color={C.muted}>
          {app.t("moneyStoredOnly")}
        </Txt>
      </View>
      <View style={[s.card, { gap: 12 }]}>
        <View style={s.row}>
          <CreditCard size={23} />
          <Txt variant="h3">{app.t("paymentCard")}</Txt>
        </View>
        <View style={s.row}>
          <Txt translate={false} variant="label">
            VISA
          </Txt>
          <Txt translate={false} variant="label">
            Mastercard
          </Txt>
        </View>
        <Button
          title={app.t("paymentAddCard")}
          kind="secondary"
          icon={CreditCard}
          disabled={saving}
          onPress={() => {
            Keyboard.dismiss();
            setCard(true);
          }}
        />
      </View>
    </View>
  );
}
