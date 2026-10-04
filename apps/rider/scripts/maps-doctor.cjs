const fs = require("node:fs");
const path = require("node:path");
function envFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((l) => /^[A-Z][A-Z0-9_]*\s*=/.test(l))
      .map((l) => {
        const i = l.indexOf("=");
        return [
          l.slice(0, i).trim(),
          l
            .slice(i + 1)
            .trim()
            .replace(/^(["'])(.*)\1$/, "$2"),
        ];
      }),
  );
}
(async () => {
  const env = {
    ...envFile(path.join(__dirname, "..", ".env")),
    ...process.env,
  };
  const base = (
    env.EXPO_PUBLIC_MAPS_API_URL ||
    env.EXPO_PUBLIC_API_URL ||
    ""
  ).replace(/\/$/, "");
  if (!base)
    throw new Error(
      "Renseignez EXPO_PUBLIC_MAPS_API_URL dans .env. Voir ../../docs/GOOGLE-MAPS.md.",
    );
  const response = await fetch(base + "/api/maps/config", {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error("Le serveur cartes ne répond pas correctement.");
  const config = await response.json();
  console.log("Serveur accessible.");
  console.log(
    "Affichage Google : " +
      (config.googleMap
        ? "configuré"
        : "GOOGLE_MAPS_WEB_KEY manquante dans apps/api/.env"),
  );
  console.log(
    "Trajets et adresses : " +
      (config.googleRoutes
        ? "configurés"
        : "GOOGLE_MAPS_SERVER_KEY manquante dans apps/api/.env"),
  );
  if (!config.googleMap || !config.googleRoutes) process.exitCode = 1;
  console.log(
    "Ce contrôle ne fait pas d'appel Google facturable. Il ne vérifie pas la validité des clés ni le GPS de l'iPhone.",
  );
})().catch((e) => {
  console.error(
    "Cartes : " +
      (e.cause?.code === "ECONNREFUSED"
        ? "Démarrez npm.cmd run server, puis vérifiez l'IP et le pare-feu."
        : e.message),
  );
  process.exitCode = 1;
});
