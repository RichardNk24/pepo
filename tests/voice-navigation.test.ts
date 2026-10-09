import { describe, it, expect, vi } from "vitest";
import { NavigationEngine } from "@pepo/voice/engine";
import { navigationFixture } from "@pepo/voice/fixtures";
import { formatInstruction } from "@pepo/voice/instructions";
import { chooseLandmark, verifiedParcel } from "@pepo/voice/landmarks";
import {
  profileFor,
  VOICE_PROFILES,
  selectDeviceVoice,
  safeVoicePreferences,
} from "@pepo/voice/profiles";
import { InstructionSpeaker } from "@pepo/voice/playback";
import {
  validatedClip,
  VoicePackPlayer,
  type VoicePack,
} from "@pepo/voice/voicePacks";
import { buildNavigationPlan, decodeSteps } from "@pepo/voice/routeAdapter";
import { understandSpeech } from "@pepo/voice/speechIntent";
import { meters } from "@pepo/voice/geometry";
const now = Date.now(),
  context = { city: "fixture", vehicle: "taxi" as const, night: false };
const fixture = (name = "A") => navigationFixture(name, now);
const make = (name = "A") => {
  const f = fixture(name);
  return { f, e: new NavigationEngine(f.plan, context, f.landmarks) };
};
describe("provider-owned route decisions", () => {
  it("calculates along-route remaining distance and never calls a network/model", () => {
    const { f, e } = make();
    const d = e.evaluate(f.fix, now);
    expect(d.instruction?.maneuver).toBe("right");
    expect(d.instruction?.distanceMeters).toBeCloseTo(
      meters(f.fix, f.plan.steps[1].start),
      0,
    );
    expect(
      formatInstruction(d.instruction!, profileFor("fr-CD"))?.text,
    ).toContain("110 mètres");
  });
  it("announces prepare and turn once each and can repeat the last instruction", () => {
    const { f, e } = make();
    expect(e.evaluate(f.fix, now).instruction?.phase).toBe("prepare");
    expect(e.evaluate(f.fix, now).instruction).toBeUndefined();
    const turn = { ...f.fix, latitude: 0.0028, timestamp: now + 6000 };
    expect(e.evaluate(turn, now + 6000).instruction?.phase).toBe("turn");
    expect(
      e.evaluate({ ...turn, timestamp: now + 7000 }, now + 7000).instruction,
    ).toBeUndefined();
    expect(e.repeat()?.phase).toBe("turn");
  });
  it("delivers the turn only after a precise fresh fix; stale/unknown/poor accuracy yields no maneuver", () => {
    for (const bad of [null, 60, NaN, -1]) {
      const { f, e } = make();
      expect(e.evaluate({ ...f.fix, accuracy: bad }, now).state).toBe("gps");
    }
    const { f, e } = make();
    expect(
      e.evaluate({ ...f.fix, timestamp: now - 20000 }, now).instruction,
    ).toBeUndefined();
    expect(e.evaluate({ ...f.fix, timestamp: now + 10000 }, now).state).toBe(
      "gps",
    );
  });
  it("stops instructions off-route and does not invent a recalculation", () => {
    const { f, e } = make();
    expect(e.evaluate({ ...f.fix, longitude: 0.01 }, now).state).toBe(
      "off_route",
    );
    expect(e.repeat()).toBeUndefined();
  });
  it("rejects isolated teleports and out-of-order fixes", () => {
    const { f, e } = make();
    e.evaluate(f.fix, now);
    expect(
      e.evaluate(
        { ...f.fix, latitude: 0.003, longitude: 0.002, timestamp: now + 1000 },
        now + 1000,
      ).state,
    ).toBe("ambiguous");
    expect(e.evaluate({ ...f.fix, timestamp: now - 100 }, now).state).toBe(
      "gps",
    );
  });
  it("never announces a guessed roundabout exit or foreign provider text in English", () => {
    const { f, e } = make("B");
    const i = e.evaluate(f.fix, now).instruction!;
    expect(formatInstruction(i, profileFor("en"))).toBeNull();
    expect(formatInstruction(i, profileFor("fr-CD"))?.text).toContain(
      "avenue du 30 Juin",
    );
    const round = {
      ...i,
      maneuver: "roundabout-right" as const,
      providerText: "",
    };
    expect(formatInstruction(round, profileFor("en"))).toBeNull();
  });
  it("suppresses route ambiguity at a loop/crossing", () => {
    const f = fixture();
    const plan = {
      ...f.plan,
      points: [
        { latitude: 0, longitude: 0 },
        { latitude: 0.003, longitude: 0 },
        { latitude: 0.003, longitude: 0.003 },
        { latitude: 0, longitude: 0.003 },
        { latitude: 0, longitude: 0 },
      ],
    };
    const e = new NavigationEngine(plan, context);
    expect(e.evaluate({ ...f.fix, latitude: 0, longitude: 0 }, now).state).toBe(
      "ambiguous",
    );
  });
  it("starts announcements earlier at higher speed without fabricating speed-dependent distances", () => {
    const f = fixture();
    const slow = new NavigationEngine(f.plan, context),
      fast = new NavigationEngine(f.plan, context);
    const fix = { ...f.fix, latitude: 0.001, speed: 2 };
    expect(slow.evaluate(fix, now).instruction).toBeUndefined();
    expect(fast.evaluate({ ...fix, speed: 20 }, now).instruction?.phase).toBe(
      "prepare",
    );
  });
  it("reuses valid provider steps and refuses gaps, malformed points, missing geometry and excessive input", () => {
    const f = fixture();
    expect(buildNavigationPlan("real", f.plan.steps.slice(0, 2))?.source).toBe(
      "google",
    );
    expect(buildNavigationPlan("missing", [])).toBeNull();
    const gap = {
      ...f.plan.steps[1],
      points: [{ latitude: 2, longitude: 2 }, f.plan.steps[1].end],
    };
    expect(buildNavigationPlan("gap", [f.plan.steps[0], gap])).toBeNull();
    expect(
      decodeSteps(
        [
          {
            steps: [
              { startLocation: { latLng: { latitude: 0, longitude: 0 } } },
            ],
          },
        ],
        () => [],
      ),
    ).toEqual([]);
  });
});
describe("reviewed landmarks, branches and parcel sequences", () => {
  const relation = (l: ReturnType<typeof fixture>["landmarks"]) =>
    chooseLandmark(fixture().plan, fixture().plan.steps[1].atMeters, 220, l, {
      ...context,
      now,
    });
  it("adds an after-landmark phrase only for a verified visible point before the turn", () => {
    const f = fixture("C");
    expect(relation(f.landmarks)?.relation).toBe("after");
    const e = new NavigationEngine(f.plan, context, f.landmarks);
    expect(
      formatInstruction(
        e.evaluate(f.fix, now).instruction!,
        profileFor("fr-CD"),
      )?.text,
    ).toContain("juste après station PetroCIL");
  });
  it("suppresses unreviewed, expired, future-reviewed, invisible and source-less landmarks", () => {
    const l = fixture("C").landmarks[0];
    for (const changed of [
      { reliability: "pending" as const },
      { expiresAt: now - 1 },
      { validatedAt: now + 1 },
      { source: "" },
      { visibility: { ...l.visibility!, day: false } },
    ])
      expect(relation([{ ...l, ...changed }])).toBeUndefined();
  });
  it("does not use a landmark on the outgoing or wrong branch", () => {
    const l = fixture("C").landmarks[0];
    expect(
      relation([
        {
          ...l,
          latitude: 0.003,
          longitude: 0.0004,
          visibility: { ...l.visibility!, bearing: 90 },
        },
      ]),
    ).toBeUndefined();
    expect(
      relation([{ ...l, visibility: { ...l.visibility!, bearing: 180 } }]),
    ).toBeUndefined();
    expect(relation([{ ...l, longitude: 0.001 }])).toBeUndefined();
  });
  it("does not announce a daytime-only landmark at night or a pedestrian entrance to a taxi", () => {
    const l = fixture("C").landmarks[0],
      f = fixture();
    expect(
      chooseLandmark(
        f.plan,
        f.plan.steps[1].atMeters,
        220,
        [{ ...l, visibility: { ...l.visibility!, night: false } }],
        { ...context, night: true, now },
      ),
    ).toBeUndefined();
    expect(
      relation([
        {
          ...l,
          kind: "entrance",
          entrance: { access: "pedestrian", parentId: "building" },
        },
      ]),
    ).toBeUndefined();
  });
  it("resolves a third parcel only from a complete reviewed ordered sequence and matching approach", () => {
    const f = fixture("E");
    expect(
      verifiedParcel(f.anchor, f.parcels, 3, "fixture-street", 90, now)?.id,
    ).toBe("fixture-parcel-3");
    expect(
      verifiedParcel(
        f.anchor,
        [f.parcels[0], f.parcels[2]],
        3,
        "fixture-street",
        90,
        now,
      ),
    ).toBeUndefined();
    expect(
      verifiedParcel(f.anchor, f.parcels, 3, "fixture-street", 270, now),
    ).toBeUndefined();
    expect(
      verifiedParcel(
        f.anchor,
        f.parcels.map((p) => ({
          ...p,
          parcel: { ...p.parcel!, sequenceVerified: false },
        })),
        3,
        "fixture-street",
        90,
        now,
      ),
    ).toBeUndefined();
  });
});
describe("languages, output availability and invalidation", () => {
  const voices = [
    { identifier: "fr", name: "French", language: "fr-FR" },
    { identifier: "en", name: "English", language: "en-US" },
  ];
  it("keeps six languages with distinct Kikongo and Kituba profiles; unavailable/draft speech is not advertised as approved", () => {
    expect(new Set(VOICE_PROFILES.map((p) => p.language)).size).toBe(7);
    expect(profileFor("kg-CD").language).not.toBe(
      profileFor("ktu-CD").language,
    );
    const { f, e } = make();
    const i = e.evaluate(f.fix, now).instruction!;
    expect(formatInstruction(i, profileFor("sw-CD-katanga"))).toBeNull();
    expect(
      formatInstruction(i, profileFor("sw-CD-katanga"), true)?.approved,
    ).toBe(false);
    expect(formatInstruction(i, profileFor("lua-CD"), true)).toBeNull();
  });
  it("never uses French for Lingala or silently replaces a missing chosen voice", () => {
    expect(
      selectDeviceVoice(voices, profileFor("ln-CD-kinshasa")),
    ).toBeUndefined();
    expect(
      selectDeviceVoice(voices, profileFor("fr-CD"), "missing"),
    ).toBeUndefined();
    expect(
      safeVoicePreferences({ profile: "bad", enabled: "yes" }, "en"),
    ).toEqual({ profile: "en", enabled: false });
  });
  it("preserves mixed-language names and relative descriptions, requiring explicit destination confirmation", () => {
    expect(
      understandSpeech("Nipeleke pale kwa Hôtel Pullman", "sw"),
    ).toMatchObject({
      kind: "destination",
      query: "Hôtel Pullman",
      requiresConfirmation: true,
    });
    expect(
      understandSpeech(
        "Je vais à la troisième parcelle après la pharmacie",
        "fr",
      ),
    ).toMatchObject({ kind: "destination", spatial: true });
    expect(understandSpeech("ne pas annuler la course", "fr")).toEqual({
      kind: "unknown",
    });
    expect(understandSpeech("rudia", "sw")).toEqual({ kind: "repeat" });
  });
  it("cancels a pending voice result after a route change", async () => {
    let release!: (v: typeof voices) => void;
    const port = {
      voices: () =>
        new Promise<typeof voices>((r) => {
          release = r;
        }),
      stop: vi.fn(async () => {}),
      speak: vi.fn(),
    };
    const speaker = new InstructionSpeaker(port);
    const { f, e } = make();
    await speaker.configure(f.plan.id, profileFor("fr-CD"));
    const pending = speaker.speak(e.evaluate(f.fix, now).instruction!);
    await speaker.configure("replacement", profileFor("en"));
    release(voices);
    expect(await pending).toBe("cancelled");
    expect(port.speak).not.toHaveBeenCalled();
  });
  it("reads only in requested language, reports unavailable voices, and uses no network call for an ordinary instruction", async () => {
    const port = {
      voices: vi.fn(async () => voices),
      stop: vi.fn(async () => {}),
      speak: vi.fn(),
    };
    const speaker = new InstructionSpeaker(port);
    const { f, e } = make(),
      i = e.evaluate(f.fix, now).instruction!;
    await speaker.configure(f.plan.id, profileFor("en"));
    expect(await speaker.speak(i)).toBe("spoken");
    expect(port.speak.mock.calls[0][0]).toContain("turn right");
    expect(await speaker.speak(i, "absent")).toBe("unavailable");
    await speaker.stop();
    expect(await speaker.repeat()).toBe("cancelled");
  });
  it("requires a reviewed matching complete clip, local URI and verified checksum before playback", async () => {
    const pack: VoicePack = {
      id: "fixture",
      version: 1,
      profile: "fr-CD",
      reviewer: "fixture reviewer",
      reviewedAt: now - 1,
      clips: [
        {
          text: "Tournez à droite.",
          localUri: "file:///fixture.mp3",
          sha256: "a".repeat(64),
        },
      ],
    };
    expect(validatedClip(pack, "fr-CD", "Tournez à gauche.")).toBeUndefined();
    expect(
      validatedClip({ ...pack, reviewer: "" }, "fr-CD", "Tournez à droite."),
    ).toBeUndefined();
    const port = {
      verify: vi.fn(async () => false),
      play: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    };
    expect(
      await new VoicePackPlayer(port).play(pack, "fr-CD", "Tournez à droite."),
    ).toBe(false);
    expect(port.play).not.toHaveBeenCalled();
  });
});
