import { api, RequestError } from "@pepo/api-client/api";
import { C } from "@pepo/config/tokens";
import { useI18n } from "@pepo/i18n/Context";
import { safetyText, type SafetyKey } from "@pepo/i18n/safety";
import type { CityId, TripSafetyState } from "@pepo/types/model";
import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Modal, Pressable, View } from "react-native";
import { Phone, Share2, ShieldCheck, X } from "lucide-react-native";
import { Button, IconButton, s, Txt } from "./UI";

export function NightNotice({
  city,
  demo,
  compact = false,
}: {
  city: CityId;
  demo: boolean;
  compact?: boolean;
}) {
  const [tier, setTier] = useState("day");
  const { language } = useI18n();
  useEffect(() => {
    if (demo) return;
    let disposed = false;
    const load = () => {
      if (AppState.currentState === "active")
        void api<{ enabled: boolean; tier: string }>(
          `/safety/policy?city=${city}`,
        )
          .then((v) => {
            if (!disposed) setTier(v.enabled ? v.tier : "day");
          })
          .catch(() => {});
    };
    load();
    const timer = setInterval(load, 60000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") load();
    });
    return () => {
      disposed = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [city, demo]);
  if (tier === "day") return null;
  return (
    <View style={{ gap: 4, paddingVertical: compact ? 2 : 12 }}>
      <Txt variant={compact ? "small" : "label"}>
        {safetyText(language, "night")}
      </Txt>
      {!compact && (
        <Txt variant="small" color={C.muted}>
          {safetyText(language, "notice")}
        </Txt>
      )}
    </View>
  );
}
export function TripSafety({
  tripId,
  demo,
  driver = false,
  onShare,
}: {
  tripId: string;
  demo: boolean;
  driver?: boolean;
  onShare: () => Promise<void>;
}) {
  const { language } = useI18n(),
    txt = (key: SafetyKey) => safetyText(language, key);
  const [state, setState] = useState<TripSafetyState>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false),
    [notice, setNotice] = useState(""),
    [failed, setFailed] = useState(false),
    [clock, setClock] = useState(Date.now()),
    [receipt, setReceipt] = useState<TripSafetyState["help"]>();
  const alive = useRef(true),
    loading = useRef(false),
    operating = useRef(false),
    offset = useRef(0),
    generation = useRef(0);
  const load = async () => {
    if (demo || loading.current) return;
    const gen = generation.current;
    loading.current = true;
    try {
      const v = await api<TripSafetyState>(`/trips/${tripId}/safety`);
      if (alive.current && generation.current === gen) {
        setState(v);
        setReceipt((previous) =>
          previous && (!v.help || v.help.createdAt < previous.createdAt)
            ? previous
            : v.help,
        );
        offset.current = v.serverTime - Date.now();
        setClock(Date.now());
        setFailed(false);
      }
    } catch {
      if (alive.current && generation.current === gen) setFailed(true);
    } finally {
      loading.current = false;
    }
  };
  useEffect(() => {
    alive.current = true;
    generation.current++;
    setReceipt(undefined);
    setState(undefined);
    setError("");
    setNotice("");
    const poll = () => {
      if (AppState.currentState === "active") {
        setClock(Date.now());
        void load();
      }
    };
    poll();
    const timer = setInterval(poll, 15000);
    const sub = AppState.addEventListener("change", (v) => {
      if (v === "active") poll();
    });
    return () => {
      alive.current = false;
      generation.current++;
      clearInterval(timer);
      sub.remove();
    };
  }, [tripId, demo]);
  const action = async (work: () => Promise<unknown>) => {
    if (operating.current || demo) return;
    operating.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      await load();
    } catch (e) {
      if (alive.current)
        setError(
          txt(
            e instanceof RequestError && e.status > 0 ? "unavailable" : "error",
          ),
        );
    } finally {
      operating.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const sendHelp = async () => {
    const v = await api<NonNullable<TripSafetyState["help"]>>(
      `/trips/${tripId}/safety/help`,
      { method: "POST" },
    );
    if (alive.current) setReceipt(v);
  };
  const help = () => action(sendHelp);
  const respond = (answer: "ok" | "help") =>
    action(async () => {
      await api(`/trips/${tripId}/safety/check/${state!.check!.id}`, {
        method: "POST",
        body: { answer },
      });
      if (answer === "help") await sendHelp();
    });
  const old =
    state?.lastLocationAt &&
    clock + offset.current - state.lastLocationAt > 45000;
  const helpStatus = receipt?.status || state?.help?.status;
  return (
    <View
      style={[
        s.card,
        {
          gap: 10,
          marginTop: 16,
          marginBottom: 12,
          borderColor: state?.check ? C.yellow : C.line,
        },
      ]}
    >
      <View style={s.row}>
        <ShieldCheck size={18} color={C.ink} />
        <Txt variant="label" style={{ flex: 1 }}>
          {txt(!state || state.tier === "day" ? "day" : "night")}
        </Txt>
      </View>
      {demo ? (
        <Txt variant="small">{txt("demo")}</Txt>
      ) : (
        <>
          {failed && (
            <Button
              title={txt("retry")}
              kind="secondary"
              compact
              onPress={load}
            />
          )}
          {failed && <Txt variant="small">{txt("loadError")}</Txt>}
          {state && (
            <Txt variant="small" color={C.muted}>
              {!state.lastLocationAt
                ? txt("missing")
                : `${txt("last")} · ${new Date(state.lastLocationAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}${old ? ` · ${txt("stale")}` : state.locationQuality === "imprecise" ? ` · ${txt("imprecise")}` : ""}`}
            </Txt>
          )}
          <Txt variant="small" color={C.muted}>
            {txt("limitations")}
          </Txt>
          {state?.check && (
            <View style={{ gap: 10 }} accessibilityLiveRegion="polite">
              <Txt variant="h3">{txt("check")}</Txt>
              <Txt variant="small">{txt(state.check.reason)}</Txt>
              <Button
                title={txt("ok")}
                disabled={busy}
                onPress={() => respond("ok")}
              />
              <Button
                title={txt("help")}
                kind="danger"
                disabled={busy}
                onPress={() => respond("help")}
              />
            </View>
          )}
          {!!helpStatus && (
            <Txt variant="small" accessibilityLiveRegion="polite">
              {txt(helpStatus)}
            </Txt>
          )}
          <Button
            compact
            title={txt("help")}
            kind="danger"
            disabled={busy}
            onPress={() => {
              setOpen(true);
              void help();
            }}
          />
        </>
      )}
      <Button
        title={txt("share")}
        icon={Share2}
        kind="secondary"
        compact
        onPress={onShare}
      />
      {!demo && (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            void action(async () => {
              await api(`/trips/${tripId}/share`, { method: "DELETE" });
              setNotice(txt("revoked"));
            })
          }
          disabled={busy}
          style={{ paddingVertical: 8 }}
        >
          <Txt variant="small" style={{ textAlign: "center" }}>
            {txt("revoke")}
          </Txt>
        </Pressable>
      )}
      {driver && !demo && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen(true)}
          style={{ paddingVertical: 8 }}
        >
          <Txt variant="small">{txt("stopReason")}</Txt>
        </Pressable>
      )}
      {!!error && (
        <Txt variant="small" accessibilityLiveRegion="assertive">
          {error}
        </Txt>
      )}
      {!!notice && (
        <Txt variant="small" accessibilityLiveRegion="polite">
          {notice}
        </Txt>
      )}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={s.scrim}>
          <View style={s.dialog}>
            <View style={s.rowBetween}>
              <Txt variant="h3" style={{ flex: 1 }}>
                {txt("help")}
              </Txt>
              <IconButton
                icon={X}
                label={txt("close")}
                onPress={() => setOpen(false)}
              />
            </View>
            <Txt>
              {helpStatus
                ? txt(helpStatus)
                : error || (busy ? txt("sending") : txt("noPhone"))}
            </Txt>
            {state?.supportPhone ? (
              <Button
                title={txt("call")}
                icon={Phone}
                onPress={() => Linking.openURL("tel:" + state.supportPhone)}
              />
            ) : (
              <Txt variant="small">{txt("noPhone")}</Txt>
            )}
            {!!error && (
              <Button title={txt("retry")} disabled={busy} onPress={help} />
            )}
            {driver && (
              <View style={{ gap: 8 }}>
                <Txt variant="label">{txt("stopReason")}</Txt>
                {(["checkpoint", "traffic", "vehicle", "other"] as const).map(
                  (reason) => (
                    <Button
                      key={reason}
                      compact
                      kind="secondary"
                      title={txt(reason)}
                      disabled={busy}
                      onPress={() =>
                        action(async () => {
                          await api(`/trips/${tripId}/safety/stop`, {
                            method: "POST",
                            body: { reason },
                          });
                          setNotice(txt("stopSaved"));
                          setOpen(false);
                        })
                      }
                    />
                  ),
                )}
              </View>
            )}
            <Button
              title={txt("close")}
              kind="secondary"
              onPress={() => setOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
