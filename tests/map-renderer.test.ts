import { describe, expect, it } from "vitest";
import {
  isExpoGoEnvironment,
  selectMapRenderer,
} from "../packages/maps/src/renderer";

describe("Google renderer selection", () => {
  it("recognizes current Expo Go with null legacy appOwnership", () => {
    expect(isExpoGoEnvironment("storeClient", null)).toBe(true);
    expect(isExpoGoEnvironment(undefined, "expo")).toBe(true);
    expect(isExpoGoEnvironment("bare", null)).toBe(false);
    expect(isExpoGoEnvironment("standalone", "standalone")).toBe(false);
  });
  it("keeps Google WebView in Expo Go even with native requested and an iOS key", () => {
    expect(
      selectMapRenderer({
        mode: "native",
        expoGo: true,
        googleMapUrl: "http://192.168.1.20:4000/maps/mobile",
        nativeKey: "test-key",
      }),
    ).toBe("google-web");
  });
  it("uses the hosted Google renderer by default in an installed app", () => {
    expect(
      selectMapRenderer({
        expoGo: false,
        googleMapUrl: "https://example.test/maps/mobile",
        nativeKey: "test-key",
      }),
    ).toBe("google-web");
  });
  it("uses native Google only in an installed app with its own SDK key", () => {
    expect(
      selectMapRenderer({
        mode: "native",
        expoGo: false,
        googleMapUrl: "https://example.test/maps/mobile",
        nativeKey: "test-key",
      }),
    ).toBe("google-native");
    expect(selectMapRenderer({ expoGo: false, nativeKey: "test-key" })).toBe(
      "google-native",
    );
  });
  it("reports missing configuration instead of choosing Apple or a fake map", () => {
    expect(selectMapRenderer({ expoGo: true, nativeKey: "test-key" })).toBe(
      "unconfigured",
    );
    expect(selectMapRenderer({ expoGo: false, nativeKey: "  " })).toBe(
      "unconfigured",
    );
  });
  it("keeps the illustrated map available only as an explicit demo choice", () => {
    expect(selectMapRenderer({ mode: "demo", expoGo: true })).toBe("demo");
  });
});
