const { build } = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");
process.chdir(path.resolve(__dirname, ".."));

const dependencies = Object.keys(
  require("../apps/api/package.json").dependencies,
).filter((n) => !n.startsWith("@pepo/"));
build({
  entryPoints: ["apps/api/src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  outfile: "apps/api/dist/index.cjs",
  external: dependencies,
  sourcemap: true,
})
  .then(() => {
    fs.cpSync("apps/api/src/admin", "apps/api/dist/admin", { recursive: true });
    fs.mkdirSync("apps/api/dist/map-assets", { recursive: true });
    fs.cpSync("packages/maps/assets/vehicles", "apps/api/dist/map-assets", {
      recursive: true,
    });
    console.log("API built with shared pure packages and map assets.");
  })
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
