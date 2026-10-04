import type { MobileMoneyProvider, PaymentMethod } from "@pepo/types/model";

export type SupportedMoneyProvider = Exclude<MobileMoneyProvider, "afri">;
// Prefix recognition proposes a network; it does not verify a wallet or its owner.
export const MONEY_NETWORKS: {
  id: SupportedMoneyProvider;
  name: string;
  prefixes: string[];
}[] = [
  { id: "airtel", name: "Airtel Money", prefixes: ["97", "98", "99"] },
  { id: "mpesa", name: "M-Pesa", prefixes: ["81", "82", "83"] },
  { id: "orange", name: "Orange Money", prefixes: ["84", "85", "89", "80"] },
];
export function parseMoneyPhone(value: string): {
  status: "empty" | "incomplete" | "invalid" | "unsupported" | "valid";
  provider?: SupportedMoneyProvider;
  phone?: string;
} {
  if (!value.trim()) return { status: "empty" };
  if (
    /[^\d+\s().-]/.test(value) ||
    (value.match(/\+/g)?.length || 0) > 1 ||
    (value.includes("+") && !value.trim().startsWith("+"))
  )
    return { status: "invalid" };
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00243")) digits = digits.slice(5);
  else if (digits.startsWith("243")) digits = digits.slice(3);
  else if (value.trim().startsWith("+") || digits.startsWith("00"))
    return { status: digits.length < 5 ? "incomplete" : "invalid" };
  if (digits.startsWith("0")) digits = digits.slice(1);
  const provider = MONEY_NETWORKS.find((n) =>
    n.prefixes.includes(digits.slice(0, 2)),
  )?.id;
  if (digits.length > 9) return { status: "invalid" };
  if (digits.length < 9) return { status: "incomplete", provider };
  if (!provider) return { status: "unsupported" };
  return { status: "valid", provider, phone: "+243" + digits };
}
export type MoneyIssue =
  | "moneyDuplicate"
  | "moneyNetworkMismatch"
  | "moneyTwoNumbers"
  | "moneyUnknownNetwork";
export function moneyMethodsIssue(
  methods: PaymentMethod[],
  existing: PaymentMethod[] = [],
): MoneyIssue | null {
  const ids = new Set<string>(),
    phones = new Map<string, boolean>();
  for (const method of methods) {
    const old = existing.find(
      (m) =>
        m.id === method.id &&
        m.provider === method.provider &&
        m.phone === method.phone,
    );
    if (
      ids.has(method.id) ||
      (phones.has(method.phone) && !(old && phones.get(method.phone)))
    )
      return "moneyDuplicate";
    ids.add(method.id);
    phones.set(method.phone, !!old);
    // Retain historical records unchanged so removing one never erases another.
    // No new Afri Money or mismatched network can be registered.
    if (!old) {
      const parsed = parseMoneyPhone(method.phone);
      if (method.provider === "afri" || parsed.status !== "valid")
        return "moneyUnknownNetwork";
      if (parsed.provider !== method.provider) return "moneyNetworkMismatch";
    }
  }
  for (const { id } of MONEY_NETWORKS) {
    const count = methods.filter((m) => m.provider === id).length;
    const previous = existing.filter((m) => m.provider === id).length;
    const hasNew = methods.some(
      (m) =>
        m.provider === id &&
        !existing.some(
          (e) =>
            e.id === m.id && e.provider === m.provider && e.phone === m.phone,
        ),
    );
    if (count > 2 && (count > previous || hasNew)) return "moneyTwoNumbers";
  }
  return null;
}
