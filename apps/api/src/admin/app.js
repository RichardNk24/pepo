let token = "";
let objectUrls = [];
const $ = (id) => document.getElementById(id);
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
async function call(path, body) {
  const response = await fetch("/api/admin" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + token,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    let message = "Accès refusé ou serveur indisponible.";
    try {
      message = (await response.json()).error || message;
    } catch {}
    throw new Error(message);
  }
  return response;
}
async function refresh() {
  $("status").textContent = "";
  try {
    const [drivers, incidents, identities] = await Promise.all([
      (await call("/drivers")).json(),
      (await call("/incidents")).json(),
      (await call("/identities")).json(),
    ]);
    objectUrls.forEach(URL.revokeObjectURL);
    objectUrls = [];
    $("drivers").replaceChildren();
    $("incidents").replaceChildren();
    $("identities").replaceChildren();
    if (!identities.length)
      $("identities").append(node("p", "Aucune identité en attente."));
    for (const person of identities) {
      const card = node("article", undefined, "driver");
      card.append(node("h3", person.name), node("p", person.phone));
      const docs = node("div", undefined, "documents");
      for (const [kind, title] of Object.entries({
        identity: "Pièce d’identité",
        selfie: "Selfie récent",
        avatar: "Photo de profil",
      })) {
        const figure = node("figure");
        figure.append(node("figcaption", title));
        if (person.documents?.[kind]) {
          try {
            const blob = await (
              await call("/drivers/" + person.id + "/documents/" + kind)
            ).blob();
            const url = URL.createObjectURL(blob);
            objectUrls.push(url);
            const img = node("img");
            img.src = url;
            img.alt = title;
            figure.prepend(img);
          } catch {
            figure.append(node("p", "Document indisponible."));
          }
        } else figure.append(node("p", "Non fourni."));
        docs.append(figure);
      }
      card.append(docs);
      const actions = node("div", undefined, "actions");
      for (const [approved, label] of [
        [true, "Valider l’identité"],
        [false, "Demander de nouvelles pièces"],
      ]) {
        const button = node("button", label, approved ? "approve" : "reject");
        button.disabled =
          approved && !(person.documents?.identity && person.documents?.selfie);
        button.onclick = async () => {
          if (
            !confirm(
              approved
                ? "J’ai contrôlé le document et comparé les visages. Valider cette identité ?"
                : "Refuser ces pièces ?",
            )
          )
            return;
          button.disabled = true;
          try {
            await call("/identities/" + person.id + "/review", { approved });
            await refresh();
          } catch (e) {
            $("status").textContent = e.message;
            button.disabled = false;
          }
        };
        actions.append(button);
      }
      card.append(actions);
      $("identities").append(card);
    }
    if (!drivers.length)
      $("drivers").append(node("p", "Aucun dossier en attente."));
    for (const d of drivers) {
      const card = node("article", undefined, "driver");
      card.append(
        node("h3", d.name),
        node("p", d.phone + " · " + d.city),
        node(
          "p",
          (d.driver?.model || "Véhicule manquant") +
            " · " +
            (d.driver?.plate || "Plaque manquante"),
        ),
      );
      const docs = node("div", undefined, "documents");
      for (const [kind, title] of Object.entries({
        identity: "Identité",
        license: "Permis",
        vehicle: "Véhicule",
        selfie: "Visage",
      })) {
        const figure = node("figure");
        figure.append(node("figcaption", title));
        if (d.documents?.[kind]) {
          try {
            const blob = await (
              await call("/drivers/" + d.id + "/documents/" + kind)
            ).blob();
            const url = URL.createObjectURL(blob);
            objectUrls.push(url);
            const img = node("img");
            img.src = url;
            img.alt = title;
            figure.prepend(img);
          } catch {
            figure.append(node("p", "Document indisponible."));
          }
        } else figure.append(node("p", "Non fourni."));
        docs.append(figure);
      }
      card.append(docs);
      const actions = node("div", undefined, "actions");
      for (const [approved, label, cls] of [
        [true, "Approuver le dossier", "approve"],
        [false, "Refuser le dossier", "reject"],
      ]) {
        const b = node("button", label, cls);
        b.onclick = async () => {
          if (
            !confirm(
              approved
                ? "Confirmez que vous avez contrôlé le dossier et les originaux."
                : "Refuser ce dossier ?",
            )
          )
            return;
          b.disabled = true;
          try {
            await call("/drivers/" + d.id + "/review", { approved });
            await refresh();
          } catch (e) {
            $("status").textContent = e.message;
          } finally {
            b.disabled = false;
          }
        };
        actions.append(b);
      }
      card.append(actions);
      $("drivers").append(card);
    }
    if (!incidents.length)
      $("incidents").append(node("p", "Aucun signalement."));
    for (const i of incidents) {
      const card = node("article", undefined, "incident");
      card.append(
        node("h3", i.category + " · " + i.id.slice(0, 8).toUpperCase()),
        node(
          "p",
          new Date(i.createdAt).toLocaleString("fr-FR") +
            " · compte " +
            i.userId,
        ),
        node("pre", i.detail),
      );
      $("incidents").append(card);
    }
    await refreshSafety();
    $("login").hidden = true;
    $("workspace").hidden = false;
  } catch (e) {
    $("status").textContent = e.message;
  }
}
$("login-form").onsubmit = async (e) => {
  e.preventDefault();
  token = $("token").value;
  $("token").value = "";
  await refresh();
};
$("refresh").onclick = refresh;
$("logout").onclick = () => {
  token = "";
  objectUrls.forEach(URL.revokeObjectURL);
  objectUrls = [];
  $("drivers").replaceChildren();
  $("identities").replaceChildren();
  $("incidents").replaceChildren();
  $("night-drivers").replaceChildren();
  $("safety-queue").replaceChildren();
  $("workspace").hidden = true;
  $("login").hidden = false;
  $("status").textContent = "";
};
