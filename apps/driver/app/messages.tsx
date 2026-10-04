import { C } from "@pepo/config/tokens";
import { formatDate } from "@pepo/i18n/locale";
import { useApp } from "@pepo/session/AppProvider";
import type { ChatMessage } from "@pepo/types/model";
import { Button, Field, Header, Screen, Tag, Txt, s } from "@pepo/ui/UI";
import { useLocalSearchParams } from "expo-router";
import { Send, ShieldCheck } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
export default function Messages() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    app = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [text, setText] = useState(""),
    [error, setError] = useState("");
  const scroll = useRef<ScrollView>(null);
  const trip = app.trips.find((t) => t.id === id);
  const name =
    app.profile?.role === "driver" ? trip?.riderName : trip?.driver?.name;
  const active =
    !!trip && ["accepted", "arrived", "in_progress"].includes(trip.status);
  useEffect(() => {
    let disposed = false;
    const load = async () => {
      try {
        const m = await app.loadMessages(id);
        if (!disposed) {
          setMessages(m);
          setError("");
        }
      } catch (e) {
        if (!disposed) setError((e as Error).message);
      }
    };
    void load();
    const timer = setInterval(load, 2500);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [id]);
  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Header
          title={name || "Messages"}
          back
          right={
            <Tag tone="green" icon={ShieldCheck}>
              Pepo
            </Tag>
          }
        />
        <View style={{ paddingHorizontal: 24, paddingBottom: 14 }}>
          <Txt variant="small" color={C.muted}>
            {app.demo
              ? "Conversation simulée en mode démo."
              : "Messagerie privée entre les participants à la course."}
          </Txt>
        </View>
        <ScrollView
          ref={scroll}
          style={{ flex: 1, backgroundColor: C.background }}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          onContentSizeChange={() =>
            scroll.current?.scrollToEnd({ animated: true })
          }
        >
          {!messages.length && (
            <Txt
              variant="small"
              color={C.muted}
              style={{ textAlign: "center", paddingTop: 35 }}
            >
              Un message pour vous retrouver plus facilement.
            </Txt>
          )}
          {messages.map((m) => (
            <View
              key={m.id}
              style={[
                mstyle.bubble,
                {
                  alignSelf:
                    m.senderId === app.profile?.id ? "flex-end" : "flex-start",
                  backgroundColor:
                    m.senderId === app.profile?.id ? C.ink : C.paper,
                },
              ]}
            >
              <Txt
                translate={false}
                color={m.senderId === app.profile?.id ? "#fff" : C.ink}
              >
                {m.text}
              </Txt>
              <Txt
                variant="small"
                color={m.senderId === app.profile?.id ? "#B5BDAA" : C.muted}
                style={{ fontSize: 10, alignSelf: "flex-end", marginTop: 5 }}
              >
                {formatDate(m.createdAt, app.settings.language, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Txt>
            </View>
          ))}
          {error && <Txt color={C.red}>{error}</Txt>}
        </ScrollView>
        <View style={[s.row, { padding: 18, alignItems: "flex-end" }]}>
          <View style={{ flex: 1 }}>
            <Field
              value={text}
              onChangeText={setText}
              placeholder={active ? "Votre message…" : "Course terminée"}
              multiline
              maxLength={1000}
              editable={active}
            />
          </View>
          <Button
            title=""
            accessibilityLabel="Envoyer le message"
            icon={Send}
            disabled={!text.trim() || !active}
            style={{ width: 54, paddingHorizontal: 0 }}
            onPress={async () => {
              await app.sendMessage(id, text.trim());
              setText("");
              setMessages(await app.loadMessages(id));
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
const mstyle = StyleSheet.create({
  bubble: { maxWidth: "85%", padding: 15, borderRadius: 20 },
});
