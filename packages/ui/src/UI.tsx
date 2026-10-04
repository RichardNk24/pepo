import { API_URL,getToken } from "@pepo/api-client/api";
import { C,shadow } from "@pepo/config/tokens";
import { useI18n } from "@pepo/i18n/Context";
import { useRouter } from "expo-router";
import {
ArrowLeft,
Check,
ShieldCheck,
X,
type LucideIcon,
} from "lucide-react-native";
import React,{
createContext,
useContext,
useEffect,
useState,
type ReactNode,
} from "react";
import {
ActivityIndicator,
Image,
Modal,
Platform,
Pressable,
StyleSheet,
Text,
TextInput,
View,
type StyleProp,
type TextInputProps,
type TextProps,
type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Dialog = {
  title: string;
  body: string;
  confirm?: (value: boolean) => void;
  destructive?: boolean;
};
const UIContext = createContext<{
  alert: (title: string, body: string) => void;
  confirm: (
    title: string,
    body: string,
    destructive?: boolean,
  ) => Promise<boolean>;
}>({ alert: () => {}, confirm: async () => false });
export const useUI = () => useContext(UIContext);
export function UIProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = (value: boolean) => {
    dialog?.confirm?.(value);
    setDialog(null);
  };
  return (
    <UIContext.Provider
      value={{
        alert: (title, body) => setDialog({ title, body }),
        confirm: (title, body, destructive) =>
          new Promise((resolve) =>
            setDialog({ title, body, destructive, confirm: resolve }),
          ),
      }}
    >
      {children}
      <Modal
        visible={!!dialog}
        transparent
        animationType="fade"
        onRequestClose={() => close(false)}
      >
        <View style={s.scrim}>
          <View style={s.dialog} accessibilityViewIsModal>
            <View style={s.rowBetween}>
              <Txt variant="h2" style={{ flex: 1 }}>
                {dialog?.title}
              </Txt>
              <IconButton
                icon={X}
                label="Fermer"
                onPress={() => close(false)}
              />
            </View>
            <Txt color={C.muted} style={{ lineHeight: 24 }}>
              {dialog?.body}
            </Txt>
            <View style={[s.row, { marginTop: 12 }]}>
              {dialog?.confirm && (
                <Pressable
                  style={[
                    s.rawButton,
                    { flex: 1, backgroundColor: C.background },
                  ]}
                  onPress={() => close(false)}
                >
                  <Txt variant="label">Annuler</Txt>
                </Pressable>
              )}
              <Pressable
                style={[
                  s.rawButton,
                  {
                    flex: 1,
                    backgroundColor: dialog?.destructive ? C.red : C.ink,
                  },
                ]}
                onPress={() => close(true)}
              >
                <Txt variant="label" color="#fff">
                  {dialog?.confirm ? "Confirmer" : "Compris"}
                </Txt>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </UIContext.Provider>
  );
}
const variants = {
  h1: {
    fontSize: 38,
    lineHeight: 43,
    fontFamily: "DMSans_700Bold",
    letterSpacing: -1.7,
  },
  h2: {
    fontSize: 25,
    lineHeight: 31,
    fontFamily: "DMSans_700Bold",
    letterSpacing: -0.7,
  },
  h3: {
    fontSize: 19,
    lineHeight: 25,
    fontFamily: "DMSans_700Bold",
    letterSpacing: -0.35,
  },
  label: { fontSize: 15, lineHeight: 21, fontFamily: "DMSans_600SemiBold" },
  body: { fontSize: 15, lineHeight: 22, fontFamily: "DMSans_400Regular" },
  small: { fontSize: 12, lineHeight: 18, fontFamily: "DMSans_400Regular" },
  micro: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: "DMSans_600SemiBold",
    letterSpacing: 1.2,
  },
};
export function Txt({
  variant = "body",
  color = C.ink,
  style,
  translate: localized = true,
  ...props
}: TextProps & {
  variant?: keyof typeof variants;
  color?: string;
  translate?: boolean;
}) {
  const { text } = useI18n();
  const children = localized
    ? React.Children.map(props.children, (child) =>
        typeof child === "string" ? text(child) : child,
      )
    : props.children;
  return (
    <Text {...props} style={[{ color }, variants[variant], style]}>
      {children}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  kind = "primary",
  icon: Icon,
  disabled,
  style,
  compact,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void | Promise<unknown>;
  kind?: "primary" | "yellow" | "secondary" | "danger";
  icon?: LucideIcon;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  accessibilityLabel?: string;
}) {
  const { text } = useI18n();
  title = text(title);
  accessibilityLabel = accessibilityLabel ? text(accessibilityLabel) : title;
  const [loading, setLoading] = useState(false);
  const ui = useUI();
  const color = kind === "primary" || kind === "danger" ? C.paper : C.ink;
  const backgroundColor = {
    primary: C.ink,
    yellow: C.yellow,
    secondary: C.background,
    danger: C.red,
  }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: !!disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={async () => {
        setLoading(true);
        try {
          await onPress();
        } catch (e) {
          ui.alert("Pepo", (e as Error).message || "Une erreur est survenue.");
        } finally {
          setLoading(false);
        }
      }}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor,
          opacity: disabled ? 0.42 : pressed ? 0.85 : 1,
          minHeight: compact ? 43 : 55,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {Icon && <Icon size={18} color={color} strokeWidth={1.8} />}
          <Txt variant="label" color={color} numberOfLines={1}>
            {title}
          </Txt>
        </>
      )}
    </Pressable>
  );
}
export function IconButton({
  icon: Icon,
  label,
  onPress,
  style,
  color = C.ink,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  color?: string;
}) {
  const { text } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text(label)}
      onPress={onPress}
      style={({ pressed }) => [
        s.iconButton,
        { opacity: pressed ? 0.6 : 1 },
        style,
      ]}
    >
      <Icon size={21} color={color} strokeWidth={1.8} />
    </Pressable>
  );
}
export function Screen({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView edges={["top"]} style={[s.screen, style]}>
      {children}
    </SafeAreaView>
  );
}
export function Header({
  title,
  eyebrow,
  back = false,
  right,
}: {
  title: string;
  eyebrow?: string;
  back?: boolean;
  right?: ReactNode;
}) {
  const router = useRouter();
  const { text } = useI18n();
  title = text(title);
  eyebrow = eyebrow ? text(eyebrow) : undefined;
  return (
    <View style={s.header}>
      {back && (
        <IconButton
          icon={ArrowLeft}
          label="Retour"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
        />
      )}
      <View style={{ flex: 1, gap: 3 }}>
        {eyebrow && (
          <Txt variant="micro" color={C.muted}>
            {eyebrow.toUpperCase()}
          </Txt>
        )}
        <Txt variant="h2">{title}</Txt>
      </View>
      {right}
    </View>
  );
}
export function Tag({
  children,
  tone = "neutral",
  icon: Icon,
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "yellow";
  icon?: LucideIcon;
}) {
  const color = tone === "green" ? C.green : C.ink;
  return (
    <View
      style={[
        s.tag,
        {
          backgroundColor:
            tone === "green"
              ? C.greenSoft
              : tone === "yellow"
                ? C.yellowSoft
                : C.background,
        },
      ]}
    >
      {Icon && <Icon size={12} color={color} />}
      <Txt
        variant="small"
        color={color}
        style={{ fontFamily: "DMSans_600SemiBold" }}
      >
        {children}
      </Txt>
    </View>
  );
}
export function Avatar({
  name,
  size = 50,
  verified = false,
  imagePath,
}: {
  name: string;
  size?: number;
  verified?: boolean;
  imagePath?: string;
}) {
  const [uri, setUri] = useState<string>();
  useEffect(() => {
    let disposed = false;
    let objectUrl: string | undefined;
    setUri(undefined);
    if (!imagePath) return;
    if (Platform.OS !== "web") {
      setUri(API_URL + "/api" + imagePath);
      return;
    }
    fetch(API_URL + "/api" + imagePath, {
      headers: { Authorization: "Bearer " + getToken() },
    })
      .then(async (r) => {
        if (!r.ok) return;
        objectUrl = URL.createObjectURL(await r.blob());
        if (!disposed) setUri(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {});
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imagePath]);
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: C.yellowSoft,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "#F1E8C8",
          overflow: "hidden",
        }}
      >
        {uri ? (
          <Image
            source={{
              uri,
              ...(Platform.OS !== "web"
                ? { headers: { Authorization: "Bearer " + getToken() } }
                : {}),
            }}
            onError={() => setUri(undefined)}
            style={{ width: size, height: size }}
            accessibilityLabel={`Photo de ${name}`}
          />
        ) : (
          <Txt variant="h3" style={{ fontSize: size * 0.3 }}>
            {name
              .split(" ")
              .slice(0, 2)
              .map((w) => w[0])
              .join("")}
          </Txt>
        )}
      </View>
      {verified && (
        <View style={s.verified}>
          <ShieldCheck size={14} color="#fff" />
        </View>
      )}
    </View>
  );
}
export function Field(props: TextInputProps & { label?: string }) {
  const { text } = useI18n();
  return (
    <View style={{ gap: 7 }}>
      {props.label && (
        <Txt variant="small" color={C.muted}>
          {props.label}
        </Txt>
      )}
      <TextInput
        placeholderTextColor="#A1A49C"
        {...props}
        placeholder={props.placeholder ? text(props.placeholder) : undefined}
        accessibilityLabel={text(
          props.accessibilityLabel || props.label || props.placeholder || "",
        )}
        style={[s.input, props.style]}
      />
    </View>
  );
}
export function Divider() {
  return (
    <View style={{ height: 1, backgroundColor: C.line, marginVertical: 16 }} />
  );
}
export function CheckRow({ text }: { text: string }) {
  return (
    <View style={s.row}>
      <View
        style={{ backgroundColor: C.greenSoft, padding: 4, borderRadius: 20 }}
      >
        <Check color={C.green} size={13} />
      </View>
      <Txt variant="small" color={C.green}>
        {text}
      </Txt>
    </View>
  );
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  button: {
    minHeight: 55,
    borderRadius: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  rawButton: { padding: 15, alignItems: "center", borderRadius: 14 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.paper,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.line,
  },
  input: {
    minHeight: 55,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: C.background,
    fontFamily: "DMSans_400Regular",
    fontSize: 16,
    color: C.ink,
  },
  tag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  verified: {
    position: "absolute",
    bottom: -1,
    right: -1,
    borderRadius: 12,
    width: 23,
    height: 23,
    backgroundColor: C.green,
    borderWidth: 2,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: C.paper,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: C.line,
  },
  scrim: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#18211580",
    padding: 24,
  },
  dialog: {
    padding: 24,
    borderRadius: 24,
    backgroundColor: C.paper,
    gap: 16,
    width: "100%",
    maxWidth: 400,
    ...shadow,
  },
});
