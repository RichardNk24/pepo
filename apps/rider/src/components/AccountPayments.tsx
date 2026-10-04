import { C } from "@pepo/config/tokens";
import { useApp } from "@pepo/session/AppProvider";
import type { MobileMoneyProvider } from "@pepo/types/model";
import { Button, Field, IconButton, Txt, s, useUI } from "@pepo/ui/UI";
import { formatPhone, phoneDigits } from "@pepo/utils/onboarding";
import * as Crypto from "expo-crypto";
import { Banknote, CreditCard, Smartphone, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
export const MONEY_PROVIDERS: {
  id: MobileMoneyProvider;
  name: string;
  color: string;
}[] = [
  { id: "airtel", name: "Airtel Money", color: "#BA202C" },
  { id: "mpesa", name: "M-Pesa", color: "#287B3F" },
  { id: "orange", name: "Orange Money", color: "#B25C00" },
  { id: "afri", name: "Afri Money", color: "#50338A" },
];
export function AccountPayments() {
  const app = useApp(),
    ui = useUI();
  const [provider, setProvider] = useState<MobileMoneyProvider>("airtel"),
    [phone, setPhone] = useState(""),
    [adding, setAdding] = useState(false);
  const methods = app.profile?.paymentMethods || [];
  const providerName = (id: MobileMoneyProvider) =>
    MONEY_PROVIDERS.find((p) => p.id === id)?.name;
  return (
    <View style={{ gap: 16 }}>
      <View style={[s.card, { backgroundColor: C.greenSoft, gap: 4 }]}>
        <View style={s.row}>
          <Banknote size={22} color={C.green} />
          <Txt variant="label">Espèces</Txt>
        </View>
        <Txt>Vous pouvez toujours payer à la fin de la course.</Txt>
      </View>
      {methods.map((m) => (
        <View
          key={m.id}
          style={[
            s.row,
            {
              padding: 12,
              borderWidth: 1,
              borderColor: C.line,
              borderRadius: 16,
            },
          ]}
        >
          <Smartphone size={22} />
          <View style={{ flex: 1 }}>
            <Txt variant="label">{providerName(m.provider)}</Txt>
            <Txt>+243 {formatPhone(m.phone.slice(4))}</Txt>
            <Txt variant="small" color={C.muted}>
              Numéro enregistré · non vérifié
            </Txt>
          </View>
          <IconButton
            icon={Trash2}
            label={`Retirer ${providerName(m.provider)}`}
            onPress={async () => {
              if (
                await ui.confirm(
                  "Retirer ce numéro ?",
                  "Vous pourrez le rajouter plus tard.",
                )
              )
                await app.updateProfile({
                  paymentMethods: methods.filter((x) => x.id !== m.id),
                });
            }}
          />
        </View>
      ))}
      {!adding ? (
        <Button
          title="Ajouter Mobile Money"
          kind="secondary"
          icon={Smartphone}
          disabled={methods.length >= 8}
          onPress={() => setAdding(true)}
        />
      ) : (
        <View style={{ gap: 12 }}>
          <Txt variant="h3">Quel service utilisez-vous ?</Txt>
          <View style={{ gap: 8 }}>
            {MONEY_PROVIDERS.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: provider === p.id }}
                onPress={() => setProvider(p.id)}
                style={[
                  s.row,
                  {
                    minHeight: 52,
                    borderRadius: 14,
                    padding: 12,
                    borderWidth: provider === p.id ? 2 : 1,
                    borderColor: provider === p.id ? C.ink : C.line,
                    backgroundColor: provider === p.id ? C.yellowSoft : C.paper,
                  },
                ]}
              >
                <View
                  style={{
                    backgroundColor: p.color,
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                  }}
                />
                <Txt variant="label">{p.name}</Txt>
              </Pressable>
            ))}
          </View>
          <Field
            label="Numéro de votre compte Mobile Money"
            value={formatPhone(phone)}
            onChangeText={(v) => setPhone(phoneDigits(v))}
            placeholder="99 96 44 033"
            keyboardType="phone-pad"
          />
          <Txt variant="small" color={C.muted}>
            Indicatif +243. N’entrez jamais votre code secret ou un code SMS.
          </Txt>
          <Button
            title="Enregistrer ce numéro"
            disabled={!/^[89]\d{8}$/.test(phone)}
            onPress={async () => {
              const number = "+243" + phone;
              if (
                methods.some(
                  (m) => m.phone === number && m.provider === provider,
                )
              )
                throw new Error(
                  "Ce numéro est déjà enregistré pour ce service.",
                );
              await app.updateProfile({
                paymentMethods: [
                  ...methods,
                  { id: Crypto.randomUUID(), provider, phone: number },
                ],
              });
              setAdding(false);
              setPhone("");
            }}
          />
          <Button
            title="Annuler"
            kind="secondary"
            onPress={() => setAdding(false)}
          />
        </View>
      )}
      <View style={[s.card, { gap: 10 }]}>
        <View style={s.row}>
          <CreditCard size={22} />
          <Txt variant="h3">Carte bancaire</Txt>
        </View>
        <Txt>La connexion au service de cartes n’est pas encore activée.</Txt>
        <Button
          title="Ajouter une carte"
          kind="secondary"
          icon={CreditCard}
          onPress={() =>
            ui.alert(
              "Carte bancaire",
              "L’ajout d’une carte sera ouvert avec un prestataire de paiement connecté à Pepo. Pour le moment, aucun numéro de carte ni code de sécurité n’est demandé.",
            )
          }
        />
      </View>
      <Txt color={C.muted}>
        Pour l’instant, ces numéros ne déclenchent aucun débit. Le paiement
        Mobile Money dans Pepo nécessite encore la connexion aux opérateurs.
      </Txt>
    </View>
  );
}
