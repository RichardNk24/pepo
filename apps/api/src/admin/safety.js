/* Uses the existing in-memory admin session. No token is stored in this page. */
async function refreshSafety() {
  const drivers = await (await call("/safety/drivers")).json();
  $("night-drivers").replaceChildren();
  for (const d of drivers) {
    const card = node("article", undefined, "incident");
    card.append(
      node("h3", d.name + " · " + d.city),
      node("p", (d.model || "") + " · " + (d.plate || "")),
      node(
        "p",
        d.nightApproved
          ? "Autorisé jusqu’au " + new Date(d.expiresAt).toLocaleString("fr-FR")
          : "Autorisation de nuit absente ou expirée.",
      ),
    );
    const b = node(
      "button",
      d.nightApproved ? "Retirer l’autorisation" : "Autoriser 7 jours",
      "secondary",
    );
    b.disabled = !d.nightApproved && !d.canApprove;
    b.onclick = async () => {
      if (
        !confirm(
          d.nightApproved
            ? "Retirer cette autorisation ? Les nouvelles prises en charge nocturnes seront bloquées."
            : "J’ai effectué la revue d’identité, du véhicule et de la procédure de nuit. Autoriser 7 jours ?",
        )
      )
        return;
      b.disabled = true;
      try {
        await call("/safety/drivers/" + d.id, {
          approved: !d.nightApproved,
          validDays: 7,
        });
        await refreshSafety();
      } catch (e) {
        $("status").textContent = e.message;
        b.disabled = false;
      }
    };
    card.append(b);
    $("night-drivers").append(card);
  }
  await refreshSafetyQueue();
}
let queueLoading = false;
async function refreshSafetyQueue() {
  if (queueLoading || !token) return;
  queueLoading = true;
  try {
    const container = $("safety-queue");
    container.replaceChildren();
    for (const status of ["queued", "acknowledged"]) {
      const items = await (await call("/safety/queue?status=" + status)).json();
      container.append(
        node(
          "h3",
          status === "queued"
            ? "À prendre en charge"
            : "En cours de prise en charge",
        ),
      );
      if (!items.length) container.append(node("p", "Aucune demande."));
      for (const item of items) {
        const card = node("article", undefined, "incident");
        card.append(
          node(
            "h3",
            (item.name || item.userId) +
              " · " +
              (item.role === "driver" ? "Conducteur" : "Passager"),
          ),
          node(
            "p",
            new Date(item.createdAt).toLocaleString("fr-FR") +
              " · " +
              (item.source === "manual" || item.source === "check_help"
                ? "Aide demandée"
                : "Vérification sans réponse · à examiner"),
          ),
          node("p", "Référence " + item.id),
        );
        if (item.trip) {
          card.append(
            node(
              "p",
              item.trip.pickup +
                " → " +
                item.trip.destination +
                " · " +
                item.trip.status +
                " · " +
                (item.trip.plate || ""),
            ),
          );
          if (item.trip.lastLocationAt)
            card.append(
              node(
                "p",
                "Dernier GPS : " +
                  new Date(item.trip.lastLocationAt).toLocaleString("fr-FR") +
                  " · " +
                  item.trip.locationQuality,
              ),
            );
          if (item.trip.lastLocation && item.trip.lastLocationAt) {
            const a = node("a", "Dernière position reçue · Google Maps");
            a.href =
              "https://www.google.com/maps/search/?api=1&query=" +
              item.trip.lastLocation.latitude +
              "," +
              item.trip.lastLocation.longitude;
            a.target = "_blank";
            a.rel = "noreferrer";
            card.append(a);
          }
        }
        if (item.context)
          card.append(
            node(
              "p",
              "Contexte indiqué par le conducteur : " + item.context.reason,
            ),
          );
        if (/^\+[1-9]\d{7,14}$/.test(item.phone || "")) {
          const a = node("a", "Appeler · " + item.phone);
          a.href = "tel:" + item.phone;
          card.append(node("p"), a);
        }
        if (item.guest && /^\+[1-9]\d{7,14}$/.test(item.guest.phone || "")) {
          const a = node(
            "a",
            "Passager invité · " + item.guest.name + " · " + item.guest.phone,
          );
          a.href = "tel:" + item.guest.phone;
          card.append(node("p"), a);
        }
        const action = status === "queued" ? "acknowledge" : "resolve";
        const b = node(
          "button",
          status === "queued"
            ? "Prendre en charge"
            : "Clôturer après vérification",
        );
        b.onclick = async () => {
          if (
            !confirm(
              status === "queued"
                ? "Je prends cette demande en charge et vais contacter la personne."
                : "J’ai vérifié la situation. Clôturer cette demande ?",
            )
          )
            return;
          b.disabled = true;
          try {
            await call("/safety/queue/" + item.id, { action });
            await refreshSafety();
          } catch (e) {
            $("status").textContent = e.message;
            b.disabled = false;
          }
        };
        card.append(node("p"), b);
        container.append(card);
      }
    }
  } finally {
    queueLoading = false;
  }
}
$("safety-refresh").onclick = () =>
  refreshSafety().catch((e) => {
    $("status").textContent = e.message;
  });

setInterval(() => {
  if (token && !document.hidden && !$("workspace").hidden)
    void refreshSafetyQueue().catch((e) => {
      $("status").textContent = e.message;
    });
}, 15000);
