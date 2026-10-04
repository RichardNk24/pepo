import { describe, it, expect } from "vitest";
import { createRoutePulse } from "@pepo/utils/routePulse";
import { googleMapDocument } from "@pepo/maps/googleDocument";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
const points = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 1 },
  { latitude: 1, longitude: 1 },
];
describe("Route light sweep", () => {
  it("repeats every three seconds and follows road corners", () => {
    const pulse = createRoutePulse(points);
    expect(pulse.frame(1400)).toEqual(pulse.frame(4400));
    const frame = pulse.frame(1400);
    expect(frame[0].color).toBe("#000000");
    expect(frame.at(-1)?.color).toBe("#c8b109");
    expect(
      frame
        .flatMap((p) => p.points)
        .some((p) => p.latitude === 0 && p.longitude === 1),
    ).toBe(true);
    expect(
      frame
        .flatMap((p) => p.points)
        .every((p) => p.latitude === 0 || p.longitude === 1),
    ).toBe(true);
    expect(
      pulse
        .frame(2700)
        .flatMap((p) => p.points)
        .at(-1),
    ).toEqual(points.at(-1));
  });
  it("handles missing or duplicate points without NaN", () => {
    for (const ps of [[], [points[0]], [points[0], points[0]]])
      expect(
        createRoutePulse(ps)
          .frame(1500)
          .every((p) => !p.points.length),
      ).toBe(true);
  });
  it.each(["test", "server"])(
    "runs the %s embedded Google script and cleans animation up",
    (runtime) => {
      const lines: any[] = [],
        frames = new Map<number, (n: number) => void>();
      let frameId = 0;
      class Shape {
        options: any;
        path: any[] = [];
        constructor(options: any) {
          this.options = options;
        }
        setPath(path: any[]) {
          this.path = path;
        }
        setOptions(options: any) {
          Object.assign(this.options, options);
        }
        setVisible() {}
        setPosition() {}
        setOpacity() {}
        setIcon() {}
        setCenter() {}
        setRadius() {}
      }
      class MapStub {
        addListener() {}
        getCenter() {
          return null;
        }
        setCenter() {}
        setZoom() {}
        fitBounds() {}
      }
      const document = {
        hidden: false,
        getElementById: () => ({ style: {} }),
        addEventListener() {},
        createElement: () => ({ style: {} }),
        body: { appendChild() {} },
        head: { appendChild() {} },
      };
      const context: any = {
        document,
        performance: { now: () => 0 },
        setTimeout: () => 1,
        clearTimeout() {},
        requestAnimationFrame: (cb: (t: number) => void) => {
          frames.set(++frameId, cb);
          return frameId;
        },
        cancelAnimationFrame: (id: number) => frames.delete(id),
        addEventListener() {},
        matchMedia: () => ({ matches: false, addEventListener() {} }),
      };
      context.window = context;
      context.parent = context;
      context.google = {
        maps: {
          Map: MapStub,
          Marker: Shape,
          Circle: Shape,
          Polyline: class extends Shape {
            constructor(o: any) {
              super(o);
              lines.push(this);
            }
          },
          Point: class {},
          Size: class {},
          LatLngBounds: class {
            extend() {}
          },
          SymbolPath: { CIRCLE: "circle" },
        },
      };
      vm.createContext(context);
      const html =
        runtime === "server"
          ? execFileSync(
              process.execPath,
              [
                "--import",
                "tsx",
                "-e",
                'import {googleMapDocument} from "./packages/maps/src/googleDocument.ts"; process.stdout.write(googleMapDocument("test-display-key"));',
              ],
              { cwd: process.cwd(), encoding: "utf8" },
            )
          : googleMapDocument("test-display-key");
      const script = html.match(/<script nonce="">([\s\S]*?)<\/script>/)![1];
      vm.runInContext(script, context);
      context.pepoInit();
      const state = {
        pickup: points[0],
        destination: points[2],
        route: { points },
        motionEnabled: true,
      };
      context.pepoUpdate(state);
      const callback = [...frames.values()][0];
      frames.clear();
      callback(1400);
      expect(
        lines.some(
          (line) =>
            line.options.strokeColor === "#000000" && line.path.length === 3,
        ),
      ).toBe(true);
      expect(
        lines
          .filter((line) => line.options.zIndex === 4)
          .some((line) => line.path.length > 1),
      ).toBe(true);
      context.pepoUpdate({ ...state, motionEnabled: false });
      expect(frames.size).toBe(0);
      expect(
        lines
          .filter((line) => line.options.zIndex === 4)
          .every((line) => !line.path.length),
      ).toBe(true);
      context.pepoUpdate({ ...state, picking: true });
      expect(frames.size).toBe(0);
      expect(lines.every((line) => !line.path.length)).toBe(true);
    },
  );
});
