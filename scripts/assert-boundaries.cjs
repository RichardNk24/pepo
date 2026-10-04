const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
let count = 0;
function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", ".expo"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      scan(p);
      continue;
    }
    if (!/\.tsx?$/.test(p)) continue;
    const source = fs.readFileSync(p, "utf8"),
      local = path.relative(root, p).replaceAll("\\", "/");
    for (const m of source.matchAll(
      /(?:from\s+|import\s*\(|require\s*\()\s*["']([^"']+)["']/g,
    )) {
      const spec = m[1];
      const resolved = spec.startsWith(".")
        ? path
            .relative(root, path.resolve(path.dirname(p), spec))
            .replaceAll("\\", "/")
        : spec;
      if (
        local.startsWith("apps/rider/") &&
        resolved.startsWith("apps/driver/")
      )
        throw new Error("Rider importe Driver : " + local);
      if (
        local.startsWith("apps/driver/") &&
        resolved.startsWith("apps/rider/")
      )
        throw new Error("Driver importe Rider : " + local);
      if (local.startsWith("packages/") && resolved.startsWith("apps/"))
        throw new Error("Package partagé dépend d’une application : " + local);
      if (
        /\.(png|jpe?g|svg|ttf)$/.test(spec) &&
        spec.startsWith(".") &&
        !fs.existsSync(path.resolve(path.dirname(p), spec))
      )
        throw new Error("Asset manquant : " + local + " " + spec);
    }
    count++;
  }
}
scan(path.join(root, "apps"));
scan(path.join(root, "packages"));
console.log("Frontières et assets vérifiés : " + count + " fichiers.");
