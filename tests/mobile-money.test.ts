import { describe, expect, it } from "vitest";
import {
  moneyMethodsIssue,
  parseMoneyPhone,
  MONEY_NETWORKS,
} from "@pepo/utils/mobileMoney";
import type { PaymentMethod } from "@pepo/types/model";
describe("Mobile Money recognition and saved number rules", () => {
  it.each(
    MONEY_NETWORKS.flatMap((n) => n.prefixes.map((prefix) => [prefix, n.id])),
  )("recognizes %s as %s", (prefix, provider) => {
    for (const value of [
      `0${prefix}1234567`,
      `${prefix}1234567`,
      `+243 ${prefix} 123 4567`,
      `00243${prefix}1234567`,
    ])
      expect(parseMoneyPhone(value)).toMatchObject({
        status: "valid",
        provider,
        phone: "+243" + prefix + "1234567",
      });
  });
  it("recognizes partial input without allowing a save", () => {
    expect(parseMoneyPhone("099")).toEqual({
      status: "incomplete",
      provider: "airtel",
    });
    expect(parseMoneyPhone("+243 81")).toEqual({
      status: "incomplete",
      provider: "mpesa",
    });
    expect(parseMoneyPhone("")).toEqual({ status: "empty" });
  });
  it.each([
    "099123456789",
    "+33123456789",
    "0991234567x",
    "99+1234567",
    "++243991234567",
  ])("refuses invalid input without silently truncating %s", (v) => {
    expect(parseMoneyPhone(v).status).toBe("invalid");
  });
  it("refuses unsupported networks rather than guessing", () => {
    expect(parseMoneyPhone("0911234567").status).toBe("unsupported");
  });
  it("requires distinct phone numbers and a network that matches the prefix", () => {
    const first: PaymentMethod = {
      id: "1",
      phone: "+243991234567",
      provider: "airtel",
    };
    expect(moneyMethodsIssue([first, { ...first, id: "2" }])).toBe(
      "moneyDuplicate",
    );
    expect(moneyMethodsIssue([{ ...first, provider: "mpesa" }])).toBe(
      "moneyNetworkMismatch",
    );
  });
  it("keeps over-limit legacy records removable but refuses replacement/addition while still over limit", () => {
    const old: PaymentMethod[] = ["97", "98", "99"].map((prefix, i) => ({
      id: String(i),
      provider: "airtel",
      phone: "+243" + prefix + "1234567",
    }));
    expect(moneyMethodsIssue(old.slice(1), old)).toBeNull();
    expect(moneyMethodsIssue(old, old)).toBeNull();
    expect(
      moneyMethodsIssue([...old.slice(1), { ...old[0], id: "new" }], old),
    ).toBe("moneyTwoNumbers");
  });
  it("preserves legacy duplicate records unchanged while preventing any new duplicate", () => {
    const old: PaymentMethod[] = [
      { id: "1", provider: "airtel", phone: "+243811234567" },
      { id: "2", provider: "mpesa", phone: "+243811234567" },
    ];
    expect(moneyMethodsIssue(old, old)).toBeNull();
    expect(moneyMethodsIssue([...old, { ...old[1], id: "3" }], old)).toBe(
      "moneyDuplicate",
    );
  });
});
