import { C } from "@pepo/config/tokens";
import type { TrustedContact } from "@pepo/types/model";
import { Button, Field, IconButton, Txt, s, useUI } from "./UI";
import { Plus, Star, Trash2, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  View,
} from "react-native";
export function ContactEditor({
  visible,
  onClose,
  initialContacts,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  initialContacts: TrustedContact[];
  onSave: (contacts: TrustedContact[]) => Promise<unknown>;
}) {
  const ui = useUI();
  const [contacts, setContacts] = useState<TrustedContact[]>([]),
    [adding, setAdding] = useState(false),
    [name, setName] = useState(""),
    [phone, setPhone] = useState("+243");
  useEffect(() => {
    if (visible) {
      setContacts(initialContacts);
      setAdding(false);
      setName("");
      setPhone("+243");
    }
  }, [visible]);
  const save = async (next: TrustedContact[]) => {
    await onSave(next);
    setContacts(next);
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#18211570",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 460,
              maxHeight: "90%",
              padding: 24,
              paddingBottom: 36,
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              backgroundColor: C.paper,
            }}
          >
            <View style={[s.rowBetween, { marginBottom: 12 }]}>
              <Txt variant="h2">Mes proches</Txt>
              <IconButton icon={X} label="Fermer" onPress={onClose} />
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 16 }}
            >
              <Txt>
                Choisissez jusqu’à trois personnes que vous pouvez appeler en
                cas de problème.
              </Txt>
              {contacts.map((c, i) => (
                <View key={c.phone} style={[s.card, { gap: 8 }]}>
                  <View style={s.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Txt variant="h3">{c.name}</Txt>
                      <Txt color={C.muted}>{c.phone}</Txt>
                      <Txt variant="small" color={C.green}>
                        {i === 0
                          ? "Contact principal"
                          : "Contact supplémentaire"}
                      </Txt>
                    </View>
                    <IconButton
                      icon={Trash2}
                      label={`Retirer ${c.name}`}
                      onPress={async () => {
                        if (await ui.confirm("Retirer ce contact ?", c.name))
                          await save(contacts.filter((_, j) => i !== j));
                      }}
                    />
                  </View>
                  {i > 0 && (
                    <Button
                      compact
                      title="Choisir comme contact principal"
                      kind="secondary"
                      icon={Star}
                      onPress={() =>
                        save([c, ...contacts.filter((_, j) => j !== i)])
                      }
                    />
                  )}
                </View>
              ))}
              {!adding && contacts.length < 3 && (
                <Button
                  title="Ajouter un proche"
                  kind="secondary"
                  icon={Plus}
                  onPress={() => setAdding(true)}
                />
              )}
              {adding && (
                <>
                  <Field
                    label="Son nom"
                    value={name}
                    onChangeText={setName}
                    placeholder="Prénom et nom"
                    maxLength={80}
                  />
                  <Field
                    label="Son numéro avec l’indicatif"
                    value={phone}
                    onChangeText={(v) => setPhone(v.replace(/[^+0-9]/g, ""))}
                    keyboardType="phone-pad"
                    placeholder="+243812345678"
                    maxLength={16}
                  />
                  <Txt variant="small" color={C.muted}>
                    Demandez son accord avant d’ajouter son numéro.
                  </Txt>
                  <Button
                    title="Enregistrer ce proche"
                    disabled={
                      name.trim().length < 2 || !/^\+[1-9]\d{7,14}$/.test(phone)
                    }
                    onPress={async () => {
                      if (contacts.some((c) => c.phone === phone))
                        throw new Error("Ce numéro est déjà enregistré.");
                      await save([...contacts, { name: name.trim(), phone }]);
                      setAdding(false);
                      setName("");
                      setPhone("+243");
                    }}
                  />
                  <Button
                    title="Annuler"
                    kind="secondary"
                    onPress={() => setAdding(false)}
                  />
                </>
              )}
              <Txt variant="small" color={C.muted}>
                Aucun SMS n’est envoyé automatiquement. Le contact principal est
                proposé dans l’espace Sécurité.
              </Txt>
              <Button title="Terminé" onPress={onClose} />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
