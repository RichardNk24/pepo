/** Run locally against the previous Pepo folder. Values are never printed or included in exports. */
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2),
  at = args.indexOf("--from");
if (at < 0 || !args[at + 1]) {
  console.error(
    'Usage: node scripts/import-settings.cjs --from "ancien-dossier-pepo" [--copy-data]',
  );
  process.exit(1);
}
const previous = path.resolve(args[at + 1]);
if (previous === root || !fs.existsSync(path.join(previous, "package.json")))
  throw new Error("Choisissez le dossier de votre ancien projet Pepo.");
const read = (file) =>
  fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
const mobile = read(path.join(previous, ".env"));
const server = read(path.join(previous, "server", ".env"));
const publicKeys = [
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_DEV_AUTH",
  "EXPO_PUBLIC_MAPS_API_URL",
  "EXPO_PUBLIC_MAP_RENDERER",
  "EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY",
  "EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY",
  "EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY",
];
const serverKeys = [
  "PORT",
  "NODE_ENV",
  "PUBLIC_URL",
  "CORS_ORIGINS",
  "DEV_AUTH",
  "ADMIN_TOKEN",
  "STORAGE_KEY",
  "GOOGLE_MAPS_SERVER_KEY",
  "GOOGLE_MAPS_WEB_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM",
];
const write = (app, values, keys) => {
  const file = path.join(root, "apps", app, ".env");
  if (fs.existsSync(file))
    throw new Error(
      `apps/${app}/.env existe déjà. Aucun fichier existant ne sera écrasé.`,
    );
  const lines = keys
    .filter((key) => values[key] !== undefined)
    .map((key) => `${key}=${JSON.stringify(values[key])}`);
  if (lines.length)
    fs.writeFileSync(file, lines.join("\n") + "\n", {
      mode: 0o600,
      flag: "wx",
    });
};
// Preflight every target before writing any of them.
for (const app of ["rider", "driver", "api"])
  if (fs.existsSync(path.join(root, "apps", app, ".env")))
    throw new Error(`apps/${app}/.env existe déjà. Import annulé.`);
const oldData = path.join(previous, "server", "data"),
  newData = path.join(root, "apps", "api", "data");
if (args.includes("--copy-data") && fs.existsSync(newData))
  throw new Error("apps/api/data existe déjà. Copie annulée.");
write("rider", mobile, [...publicKeys, "EAS_PROJECT_ID"]);
write("driver", mobile, publicKeys);
write(
  "api",
  {
    ...server,
    DATA_DIR: "data",
    CORS_ORIGINS:
      server.CORS_ORIGINS || "http://localhost:8081,http://localhost:8082",
  },
  [...serverKeys, "DATA_DIR"],
);
if (args.includes("--copy-data") && fs.existsSync(oldData))
  fs.cpSync(oldData, newData, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
console.log(
  "Configuration importée sans afficher de clés. Le projet précédent est conservé. Configurez un projet EAS distinct pour Pepo Driver.",
);
