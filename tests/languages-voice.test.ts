import { describe, it, expect } from "vitest";
import { catalogs, translate } from "@pepo/i18n/catalog";
import { extra } from "@pepo/i18n/extra";
import { copyTranslations, translateCopy } from "@pepo/i18n/copy";
import {
  LANGUAGES,
  chooseSpeechLocale,
  safeLanguage,
  formatDate,
} from "@pepo/i18n/locale";
import { parseVoice } from "@pepo/voice/commands";
import { navigationUrl } from "@pepo/voice/navigation";
import { PLACES } from "@pepo/utils/cities";
describe("Four languages and explicit voice intents", () => {
  it("provides complete non-empty copy for every supported language", () => {
    for (const { id } of LANGUAGES) {
      expect(Object.keys(catalogs[id]).sort()).toEqual(
        Object.keys(catalogs.fr).sort(),
      );
      for (const key of Object.keys(catalogs.fr))
        expect(
          translate(id, key as keyof typeof catalogs.fr).trim().length,
        ).toBeGreaterThan(0);
      for (const key of Object.keys(extra))
        expect(
          translate(id, key as keyof typeof extra).trim().length,
        ).toBeGreaterThan(0);
    }
    for (const values of Object.values(copyTranslations)) {
      expect(values).toHaveLength(3);
      expect(values.every((v) => typeof v === "string" && v.trim())).toBe(true);
    }
    expect(safeLanguage("unknown")).toBe("fr");
    expect(safeLanguage("ln")).toBe("ln");
  });
  it("recognizes commands in French, English, Congolese Swahili and Lingala without executing actions", () => {
    for (const [text, language] of [
      ["Mon compte", "fr"],
      ["my account", "en"],
      ["akaunti yangu", "sw"],
      ["konti na ngai", "ln"],
    ] as const)
      expect(parseVoice(text, language, false)).toEqual({
        kind: "command",
        action: "account",
      });
    for (const [text, language] of [
      ["Aller à Institut Madini", "fr"],
      ["Go to Institut Madini", "en"],
      ["Nipeleke Institut Madini", "sw"],
      ["Mema ngai na Institut Madini", "ln"],
    ] as const)
      expect(parseVoice(text, language)).toEqual({
        kind: "destination",
        query: "institut madini",
      });
    expect(parseVoice("Où suis-je ?", "fr", false)).toEqual({
      kind: "command",
      action: "recenter",
    });
    expect(parseVoice("j’ai besoin d’aide", "fr", false)).toEqual({
      kind: "command",
      action: "help",
    });
    expect(parseVoice("terminer la course", "fr", false)).toEqual({
      kind: "command",
      action: "finishTrip",
    });
    expect(parseVoice("do not cancel the ride", "en", false).kind).toBe(
      "unknown",
    );
    expect(parseVoice("ne pas annuler la course", "fr").kind).toBe("unknown");
    expect(parseVoice("some unrelated sentence", "en", false).kind).toBe(
      "unknown",
    );
    expect(parseVoice("Institut Madini", "fr").kind).toBe("destination");
  });
  it("selects only an installed voice of the requested language", () => {
    expect(chooseSpeechLocale(["fr_FR", "en-US", "sw-KE"], "fr")).toBe("fr-FR");
    expect(chooseSpeechLocale(["fr-FR", "sw-TZ"], "sw")).toBe("sw-TZ");
    expect(chooseSpeechLocale(["fr-FR", "en-US"], "ln")).toBeNull();
    expect(chooseSpeechLocale(["ln-CG", "fr-FR"], "ln")).toBe("ln-CG");
    expect(chooseSpeechLocale([], "sw")).toBeNull();
  });
  it("leaves place names and messages outside the app catalog untouched and formats regional dates", () => {
    expect(translateCopy("ln", "Institut Madini")).toBe("Institut Madini");
    expect(translateCopy("sw", "Richard Nkulu")).toBe("Richard Nkulu");
    expect(translateCopy("en", "Mes informations")).toBe("My details");
    expect(
      formatDate(Date.UTC(2026, 9, 3), "ln", { year: "numeric" }),
    ).toContain("2026");
  });
  it("preserves coordinates and chosen stop order in the external navigation URL", () => {
    const url = new URL(
      navigationUrl(PLACES[2], "sw", PLACES[0], [PLACES[1], PLACES[3]]),
    );
    expect(url.searchParams.get("hl")).toBe("sw-CD");
    expect(url.searchParams.get("destination")).toBe(
      `${PLACES[2].latitude},${PLACES[2].longitude}`,
    );
    expect(url.searchParams.get("waypoints")).toBe(
      [PLACES[1], PLACES[3]]
        .map((p) => `${p.latitude},${p.longitude}`)
        .join("|"),
    );
  });
});
