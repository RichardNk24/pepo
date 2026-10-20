import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { useApp } from "@pepo/session/AppProvider";
import { api } from "@pepo/api-client/api";
import { ThemeProvider, type ThemeName } from "@pepo/ui/Theme";
type Status = {
  active: boolean;
  theme: ThemeName;
  expiresAt: number | null;
  developmentPreview: boolean;
  billingAvailable: boolean;
  source: string | null;
};
const empty: Status = {
  active: false,
  theme: "classic",
  expiresAt: null,
  developmentPreview: false,
  billingAvailable: false,
  source: null,
};
const Context = createContext({
  status: empty,
  error: "",
  busy: false,
  refresh: async () => {},
  choose: async (_theme: ThemeName) => {},
  preview: async () => {},
  endPreview: async () => {},
});
export const usePremium = () => useContext(Context);
export function PremiumProvider({ children }: { children: ReactNode }) {
  const { profile, ready, demo } = useApp(),
    id = profile?.id;
  const owner = useRef(id);
  owner.current = id;
  const [record, setRecord] = useState<{ id: string; status: Status } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const status = record && record.id === id ? record.status : empty;
  const refresh = useCallback(async () => {
    if (!ready || !id || demo) return;
    try {
      const data = await api<Status>("/premium");
      if (owner.current === id) {
        setRecord({ id, status: data });
        setError("");
      }
    } catch (e) {
      if (owner.current === id)
        setError(e instanceof Error ? e.message : "Premium indisponible.");
    }
  }, [id, ready, demo]);
  useEffect(() => {
    setRecord(null);
    setError("");
    void refresh();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);
  useEffect(() => {
    if (!status.active || !status.expiresAt) return;
    const timer = setTimeout(
      () => {
        setRecord(null);
        void refresh();
      },
      Math.min(2147483647, Math.max(1, status.expiresAt - Date.now())),
    );
    return () => clearTimeout(timer);
  }, [status.active, status.expiresAt, refresh]);
  async function change(path: string, body?: unknown, method?: string) {
    if (!id || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<Status>(path, {
        method: method || (body ? "PATCH" : "POST"),
        body,
      });
      if (owner.current === id) setRecord({ id, status: data });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Context.Provider
      value={{
        status,
        error,
        busy,
        refresh,
        choose: (t) => change("/premium/theme", { theme: t }),
        preview: () => change("/premium/dev-preview"),
        endPreview: () => change("/premium/dev-preview", undefined, "DELETE"),
      }}
    >
      <ThemeProvider theme={status.active ? status.theme : "classic"}>
        {children}
      </ThemeProvider>
    </Context.Provider>
  );
}
