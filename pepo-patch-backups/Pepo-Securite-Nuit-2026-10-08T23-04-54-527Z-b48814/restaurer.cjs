#!/usr/bin/env node
/* No dependencies. Preflight the entire patch, back up original bytes, then write with rollback. */
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const flags = {},
  positional = [];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--check") flags.check = true;
  else if (a.startsWith("--project=")) flags.project = a.slice(10);
  else if (a === "--project") flags.project = process.argv[++i];
  else if (a.startsWith("--restore=")) flags.restore = a.slice(10);
  else if (a === "--restore") flags.restore = process.argv[++i];
  else if (a.startsWith("--")) throw new Error("Option inconnue : " + a);
  else positional.push(a);
}
const digest = (b) =>
  crypto
    .createHash("sha256")
    .update(
      b
        .toString("utf8")
        .replace(/^\uFEFF/, "")
        .replace(/\r\n/g, "\n"),
    )
    .digest("hex");
const raw = (p) => (fs.existsSync(p) ? fs.readFileSync(p) : null);
function fail(message) {
  throw new Error(message);
}
function confined(root, relative) {
  if (
    typeof relative !== "string" ||
    !relative ||
    relative.includes("\\") ||
    path.isAbsolute(relative) ||
    relative.split("/").some((x) => !x || x === "." || x === "..")
  )
    fail("Chemin non sûr : " + relative);
  if (
    relative
      .split("/")
      .some(
        (x) =>
          x.startsWith(".env") ||
          ["assets", "data", "uploads", "node_modules", ".git"].includes(x),
      )
  )
    fail("Fichier protégé : " + relative);
  const full = path.resolve(root, ...relative.split("/"));
  let p = root;
  for (const part of relative.split("/")) {
    p = path.join(p, part);
    let stat;
    try {
      stat = fs.lstatSync(p);
    } catch (e) {
      if (e.code !== "ENOENT" && e.code !== "ENOTDIR") throw e;
    }
    if (stat?.isSymbolicLink()) fail("Lien symbolique refusé : " + relative);
  }
  return full;
}
function writeAtomic(p, bytes) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + ".pepo-tmp-" + crypto.randomBytes(5).toString("hex");
  try {
    fs.writeFileSync(tmp, bytes);
    fs.renameSync(tmp, p);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}
function locked(root, work) {
  const lock = path.join(root, "pepo-security-install.lock");
  let fd;
  try {
    fd = fs.openSync(lock, "wx");
    fs.writeFileSync(fd, String(process.pid));
    return work();
  } finally {
    if (fd !== undefined) {
      fs.closeSync(fd);
      fs.unlinkSync(lock);
    }
  }
}
function main() {
  if (Number(process.versions.node.split(".")[0]) < 24)
    fail("Utilisez Node 24 ou plus récent, comme votre monorepo.");
  const root = fs.realpathSync(
    path.resolve(flags.project || positional[0] || "."),
  );
  if (
    !fs.existsSync(path.join(root, "apps/rider/package.json")) ||
    !fs.existsSync(path.join(root, "apps/api/package.json"))
  )
    fail(
      "Le chemin ne correspond pas à la racine du monorepo Pepo (apps/rider et apps/api requis).",
    );
  const restore =
    flags.restore ||
    (path.basename(__filename) === "restaurer.cjs" ? __dirname : null);
  if (restore) {
    const backup = fs.realpathSync(path.resolve(restore));
    const saved = JSON.parse(
      fs.readFileSync(path.join(backup, "state.json"), "utf8"),
    );
    const plan = [];
    for (const entry of saved.files) {
      const full = confined(root, entry.path),
        content = raw(full),
        actual = content ? digest(content) : null;
      if (actual === entry.before) continue;
      if (actual !== entry.after)
        fail(
          "Restauration arrêtée : modification ultérieure de " +
            entry.path +
            ". Aucun fichier n’a été modifié.",
        );
      const bytes =
        entry.before === null
          ? null
          : fs.readFileSync(confined(backup, "copies/" + entry.path));
      if (bytes && digest(bytes) !== entry.before)
        fail("Copie de sauvegarde endommagée : " + entry.path);
      plan.push({ full, bytes, current: content });
    }
    if (flags.check) {
      console.log(
        "Restauration possible : " +
          plan.length +
          " fichiers. Aucune modification.",
      );
      return;
    }
    locked(root, () => {
      const written = [];
      try {
        for (const item of plan) {
          if (item.bytes) writeAtomic(item.full, item.bytes);
          else fs.unlinkSync(item.full);
          written.push(item);
        }
      } catch (e) {
        for (const item of written.reverse()) {
          if (item.current) writeAtomic(item.full, item.current);
          else if (fs.existsSync(item.full)) fs.unlinkSync(item.full);
        }
        throw e;
      }
    });
    console.log(
      "Sources restaurées : " +
        plan.length +
        " fichiers. La base de données n’a pas été remplacée. Redémarrez l’API et Expo.",
    );
    return;
  }
  const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, "manifest.json"), "utf8"),
  );
  const plan = [],
    conflicts = [];
  for (const entry of manifest.files) {
    const full = confined(root, entry.path),
      content = raw(full),
      actual = content ? digest(content) : null;
    const source = confined(__dirname, "files/" + entry.path),
      next = fs.readFileSync(source);
    if (digest(next) !== entry.after)
      fail("Patch endommagé : " + entry.path + ". Retéléchargez l’archive.");
    if (actual === entry.after) continue;
    if (actual !== entry.before) {
      conflicts.push(
        entry.path +
          (actual === null
            ? " : fichier de base absent"
            : " : version locale différente"),
      );
      continue;
    }
    plan.push({ ...entry, full, next, content });
  }
  if (conflicts.length)
    fail(
      "Installation arrêtée. Aucun fichier n’a été modifié.\n" +
        conflicts.join("\n") +
        "\nNe supprimez pas ces fichiers et ne forcez pas l’installation. Il faut comparer les versions.",
    );
  if (!plan.length) {
    console.log("Pepo Sécurité Nuit est déjà installé. Aucune modification.");
    return;
  }
  if (flags.check) {
    console.log(
      "Vérification réussie : " +
        plan.length +
        " fichiers à installer. Vos .env, images et données sont préservés. Aucune modification.",
    );
    return;
  }
  locked(root, () => {
    // Recheck immediately under the lock before writing or backing up any project file.
    for (const entry of plan) {
      const current = raw(entry.full);
      if ((current ? digest(current) : null) !== entry.before)
        fail("Le fichier a changé pendant la vérification : " + entry.path);
    }
    const stamp =
      new Date().toISOString().replace(/[:.]/g, "-") +
      "-" +
      crypto.randomBytes(3).toString("hex");
    const backup = path.join(
      confined(root, "pepo-patch-backups"),
      "Pepo-Securite-Nuit-" + stamp,
    );
    fs.mkdirSync(backup, { recursive: true });
    for (const entry of plan)
      if (entry.content)
        writeAtomic(confined(backup, "copies/" + entry.path), entry.content);
    fs.writeFileSync(
      path.join(backup, "state.json"),
      JSON.stringify(
        {
          patch: manifest.name,
          files: plan.map(({ path, before, after }) => ({
            path,
            before,
            after,
          })),
        },
        null,
        2,
      ),
    );
    fs.copyFileSync(__filename, path.join(backup, "restaurer.cjs"));
    const written = [];
    try {
      for (const entry of plan) {
        writeAtomic(entry.full, entry.next);
        written.push(entry);
      }
    } catch (e) {
      for (const entry of written.reverse()) {
        if (entry.content) writeAtomic(entry.full, entry.content);
        else if (fs.existsSync(entry.full)) fs.unlinkSync(entry.full);
      }
      fail(
        "Échec de l’écriture ; sources précédentes restaurées. " + e.message,
      );
    }
    console.log(
      "Installation terminée : " +
        plan.length +
        " fichiers.\nSauvegarde : " +
        backup +
        "\nVos .env, assets et données sont préservés.\nRedémarrez l’API puis Expo avec --clear. Lisez docs/SECURITE-NUIT.md pour autoriser les conducteurs de nuit.",
    );
  });
}
try {
  main();
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
