import { describe, expect, it } from "vitest";
import {
  cityFromLocation,
  formatPhone,
  phoneDigits,
} from "@pepo/utils/onboarding";
import { CITIES } from "@pepo/utils/cities";
describe("Onboarding phone and GPS", () => {
  it("formats nine digits as 2 2 2 3 without changing the phone", () => {
    expect(formatPhone("999644033")).toBe("99 96 44 033");
    expect(phoneDigits(formatPhone("999644033"))).toBe("999644033");
    expect(formatPhone("99964")).toBe("99 96 4");
  });
  it("accepts pasted national and international numbers", () => {
    expect(phoneDigits("0999644033")).toBe("999644033");
    expect(phoneDigits("+243 99 96 44 033")).toBe("999644033");
    expect(phoneDigits("99 96 44 0330")).toBe("999644033");
  });
  it("finds supported cities and refuses to silently assign a distant city", () => {
    for (const [id, city] of Object.entries(CITIES))
      expect(cityFromLocation(city.center)).toBe(id);
    expect(cityFromLocation({ latitude: 45.5, longitude: -73.6 })).toBeNull();
    expect(cityFromLocation({ latitude: NaN, longitude: 27 })).toBeNull();
  });
});
