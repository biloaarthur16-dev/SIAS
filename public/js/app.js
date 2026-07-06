// ===========================================================================
//  Application de gestion d'un organisme de securite sociale (front-end SPA)
//  Couche "Interface". Dialogue avec le "Controleur" (API) via api.js.
// ===========================================================================

// --------------------------- Etat global -----------------------------------
let currentUser = null;
let currentPage = "dashboard";

// --------------------------- Utilitaires -----------------------------------
const $ = (sel) => document.querySelector(sel);

function esc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function money(n) {
  return (Number(n) || 0).toLocaleString("fr-FR") + " FCFA";
}

function dt(s) {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d)) return esc(s);
  return d.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric"
  });
}

function toast(message, type = "ok", title = "") {
  const box = document.createElement("div");
  box.className = `toast ${type}`;
  box.innerHTML = `${title ? `<div class="t-title">${esc(title)}</div>` : ""}<div>${esc(message)}</div>`;
  $("#toast-container").appendChild(box);
  setTimeout(() => box.remove(), 4200);
}

// --------------------------- Modale ----------------------------------------
function openModal(title, html) {
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = html;
  $("#modal-overlay").hidden = false;
}
function closeModal() {
  $("#modal-overlay").hidden = true;
  $("#modal-body").innerHTML = "";
}
$("#modal-close").addEventListener("click", closeModal);
$("#modal-overlay").addEventListener("click", (e) => {
  if (e.target.id === "modal-overlay") closeModal();
});

// Constructeur de formulaire generique dans la modale
function openForm({ title, fields, submitLabel = "Enregistrer", onSubmit }) {
  const inputs = fields
    .map((f) => {
      const cls = f.full ? "field full" : "field";
      const req = f.required ? "required" : "";
      let control;
      if (f.type === "select") {
        const opts = (f.options || [])
          .map((o) => `<option value="${esc(o.value)}" ${o.value === f.value ? "selected" : ""}>${esc(o.label)}</option>`)
          .join("");
        control = `<select name="${f.name}" ${req}>${f.placeholder ? `<option value="">${esc(f.placeholder)}</option>` : ""}${opts}</select>`;
      } else if (f.type === "html") {
        control = f.html;
      } else if (f.type === "textarea") {
        control = `<textarea name="${f.name}" placeholder="${esc(f.placeholder || "")}" ${req}>${esc(f.value || "")}</textarea>`;
      } else {
        control = `<input type="${f.type || "text"}" name="${f.name}" value="${esc(f.value || "")}" placeholder="${esc(f.placeholder || "")}" ${req} ${f.attrs || ""} />`;
      }
      return `<div class="${cls}">${f.label ? `<label>${esc(f.label)}${f.required ? " *" : ""}</label>` : ""}${control}${f.help ? `<span class="form-help">${esc(f.help)}</span>` : ""}</div>`;
    })
    .join("");

  openModal(
    title,
    `<form id="modal-form"><div class="form-grid">${inputs}</div>
     <div id="modal-form-error" class="form-error" hidden></div>
     <div class="form-actions">
       <button type="button" class="btn btn-ghost" id="modal-cancel">Annuler</button>
       <button type="submit" class="btn btn-primary">${esc(submitLabel)}</button>
     </div></form>`
  );

  $("#modal-cancel").addEventListener("click", closeModal);
  $("#modal-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const values = Object.fromEntries(fd.entries());
    const errBox = $("#modal-form-error");
    errBox.hidden = true;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await onSubmit(values);
      closeModal();
    } catch (err) {
      errBox.textContent = err.message || "Une erreur est survenue.";
      errBox.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// --------------------------- Badges ----------------------------------------
const FEUILLE_ETATS = {
  VIERGE: ["Vierge", "badge-grey"],
  REMPLIE_PARTIELLEMENT: ["Remplie partiellement", "badge-amber"],
  REMPLIE: ["Remplie", "badge-blue"],
  ENREGISTREE: ["Enregistrée", "badge-green"],
};
function feuilleBadge(etat) {
  const [label, cls] = FEUILLE_ETATS[etat] || [etat, "badge-grey"];
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}
function typeMedecinPill(type) {
  if (type === "GENERALISTE") return `<span class="pill pill-gen">Généraliste</span>`;
  if (type === "SPECIALISTE") return `<span class="pill pill-spec">Spécialiste</span>`;
  return "";
}

let SPECIALITES = [];

// ===========================================================================
//  AUTHENTIFICATION  (CU 1)
// ===========================================================================
$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = $("#login-error");
  errBox.hidden = true;
  const login = $("#login-input").value.trim();
  const password = $("#password-input").value;
  try {
    const { token, user } = await API.post("/auth/login", { login, password });
    API.setToken(token);
    currentUser = user;
    try {
      const specs = await API.get("/specialites");
      SPECIALITES = specs.map(s => ({ value: s.nom, label: s.nom }));
    } catch(e) {}
    enterApp();
  } catch (err) {
    let msg = err.message;
    if (err.data && err.data.tentativesRestantes != null)
      msg += ` (${err.data.tentativesRestantes} tentative(s) restante(s))`;
    errBox.textContent = msg;
    errBox.hidden = false;
  }
});

$("#logout-btn").addEventListener("click", async () => {
  try { await API.post("/auth/logout"); } catch {}
  API.setToken(null);
  currentUser = null;
  $("#app-view").hidden = true;
  $("#login-view").hidden = false;
  $("#login-form").reset();
});

$("#change-pwd-btn")?.addEventListener("click", () => {
  openForm({
    title: "Modifier mot de passe",
    submitLabel: "Enregistrer",
    fields: [
      { name: "password", label: "Nouveau mot de passe", type: "password", required: true }
    ],
    onSubmit: async (v) => {
      await API.put("/auth/password", v);
      toast("Mot de passe modifié avec succès.", "ok");
    }
  });
});

function roleLabel(role) {
  return role === "ASSUREUR" ? "Assureur (organisme)" : "Médecin";
}

function enterApp() {
  $("#login-view").hidden = true;
  $("#app-view").hidden = false;
  $("#role-badge").textContent = roleLabel(currentUser.role);
  $("#user-card").innerHTML = `
    <div class="name">${esc(currentUser.prenom)} ${esc(currentUser.nom)}</div>
    <div class="role">${esc(roleLabel(currentUser.role))}${currentUser.type ? " - " + (currentUser.type === "GENERALISTE" ? "Généraliste" : "Spécialiste") : ""}</div>`;
  buildNav();
  navigate("dashboard");
}

// ===========================================================================
//  NAVIGATION
// ===========================================================================
const NAV = [
  { id: "dashboard", label: "Tableau de bord", ico: "▦", sub: "Vue d'ensemble de l'activité", roles: ["ASSUREUR", "MEDECIN"] },
  { id: "assures", label: "Assurés", ico: "👤", sub: "Patients enregistrés dans le système", roles: ["ASSUREUR", "MEDECIN"] },
  { id: "medecins", label: "Médecins", ico: "🩺", sub: "Généralistes et spécialistes", roles: ["ASSUREUR"] },
  { id: "consultations", label: "Consultations", ico: "📅", sub: "Rendez-vous médicaux", roles: ["ASSUREUR", "MEDECIN"] },
  { id: "feuilles", label: "Feuilles de maladie", ico: "📋", sub: "Documents de soins à rembourser", roles: ["ASSUREUR", "MEDECIN"] },
  { id: "prescriptions", label: "Prescriptions", ico: "💊", sub: "Médicaments et consultations spécialisées", roles: ["MEDECIN"] },
  { id: "remboursements", label: "Remboursements", ico: "💳", sub: "Traitement et factures", roles: ["ASSUREUR"] },
];

function buildNav() {
  const nav = $("#main-nav");
  nav.innerHTML = NAV.filter((n) => n.roles.includes(currentUser.role))
    .map(
      (n) => `<button class="nav-item" data-page="${n.id}">
        <span class="nav-ico">${n.ico}</span><span>${esc(n.label)}</span></button>`
    )
    .join("");
  nav.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.page));
  });
}

function navigate(page) {
  currentPage = page;
  const meta = NAV.find((n) => n.id === page);
  $("#page-title").textContent = meta ? meta.label : "";
  $("#page-subtitle").textContent = meta ? meta.sub : "";
  document.querySelectorAll(".nav-item").forEach((b) =>
    b.classList.toggle("active", b.dataset.page === page)
  );
  $("#page-content").innerHTML = `<div class="empty">Chargement...</div>`;
  Pages[page]();
}

// Helpers de rendu de tableau
function tablePanel({ title, sub, action, columns, rows, empty }) {
  return `<div class="panel">
    <div class="panel-head">
      <div><h3>${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ""}</div>
      ${action || ""}
    </div>
    <div class="panel-body"><div class="table-wrap">
      ${rows.length === 0
        ? `<div class="empty"><div class="big">📭</div>${esc(empty || "Aucune donnee.")}</div>`
        : `<table class="data"><thead><tr>${columns.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
           <tbody>${rows.join("")}</tbody></table>`}
    </div></div></div>`;
}

const can = (role) => currentUser.role === role;

// ===========================================================================
//  PAGES
// ===========================================================================
const Pages = {};

// ----------------------------- Tableau de bord -----------------------------
Pages.dashboard = async () => {
  const stats = await API.get("/stats");
  const statCard = (label, value, ico, sub) => `<div class="stat-card"><div class="label">${esc(label)}</div>
        <div class="value">${typeof value === "number" ? value : esc(value)}</div>
        ${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>`;

  const cards = [
    statCard("Assurés", stats.assures, "👤", "Total inscrits"),
    statCard("Médecins", stats.medecins, "⚕️", "Actifs"),
    statCard("Consultations", stats.consultations, "🩺", "Réalisées"),
    statCard("Feuilles", stats.feuilles, "📄", `${stats.feuillesEnregistrees} enregistrées`),
  ];
  if (can("ASSUREUR")) {
    cards.push(
      statCard("Remboursements", stats.remboursements, "💳", "Effectués"),
      statCard("Total remboursé", money(stats.montantTotalRembourse), "💰", "Dépenses")
    );
  }

  const guideAssureur = `
    <ul class="timeline">
      <li><div><div class="ev-name">1. Inscrire un assure</div><div class="ev-meta">Menu Assures &rarr; Inscrire un assure</div></div></li>
      <li><div><div class="ev-name">2. Attribuer un medecin traitant</div><div class="ev-meta">Menu Assures &rarr; bouton Medecin traitant</div></div></li>
      <li><div><div class="ev-name">3. Completer la feuille de maladie</div><div class="ev-meta">Menu Feuilles &rarr; Completer (passe a "Enregistree")</div></div></li>
      <li><div><div class="ev-name">4. Effectuer le remboursement</div><div class="ev-meta">100% généraliste / 80% spécialiste (avec ordonnance d'orientation) / 30% sans parcours</div></div></li>
      <li><div><div class="ev-name">5. Imprimer la facture</div><div class="ev-meta">Menu Remboursements &rarr; Facture</div></div></li>
    </ul>`;
  const guideMedecin = `
    <ul class="timeline">
      <li><div><div class="ev-name">1. Enregistrer une consultation</div><div class="ev-meta">Menu Consultations &rarr; Nouvelle consultation</div></div></li>
      <li><div><div class="ev-name">2. Prescrire medicaments / consultation specialisee</div><div class="ev-meta">Menu Prescriptions</div></div></li>
      <li><div><div class="ev-name">3. Enregistrer la feuille de maladie</div><div class="ev-meta">Menu Feuilles &rarr; Nouvelle feuille (montant des soins + diagnostic)</div></div></li>
    </ul>`;

  let chartsHtml = "";
  if (can("ASSUREUR")) {
    chartsHtml = `
      <div class="charts-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 30px;">
        <div class="panel" style="padding: 20px;">
          <h3 style="margin-top:0;">Répartition des Médecins</h3>
          <div style="position: relative; height: 280px; width: 100%;">
            <canvas id="medecinsChart"></canvas>
          </div>
        </div>
        <div class="panel" style="padding: 20px;">
          <h3 style="margin-top:0;">État des Feuilles de Maladie</h3>
          <div style="position: relative; height: 280px; width: 100%;">
            <canvas id="feuillesChart"></canvas>
          </div>
        </div>
      </div>
    `;
  }

  $("#page-content").innerHTML = `
    <div class="page-header">
      <div><h2 class="page-title">Tableau de Bord</h2><p class="page-sub">Vue d'ensemble de la plateforme</p></div>
    </div>
    <div class="dashboard-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">${cards.join("")}</div>
    ${chartsHtml}
    <div class="panel" style="margin-top: 2rem;">
      <div class="panel-head"><h3>Guide Rapide (${can("ASSUREUR") ? "Assureur" : "Medecin"})</h3></div>
      <div class="panel-body" style="padding:20px 24px">${can("ASSUREUR") ? guideAssureur : guideMedecin}</div>
    </div>
  `;

  // Render charts if Chart.js is loaded and we are an Assureur
  if (can("ASSUREUR") && window.Chart) {
    try {
      const specsData = await API.get("/medecins");
      const genCount = specsData.filter(m => m.type === "GENERALISTE").length;
      const specCount = specsData.filter(m => m.type === "SPECIALISTE").length;
      
      new Chart(document.getElementById('medecinsChart'), {
        type: 'pie',
        data: {
          labels: ['Généralistes', 'Spécialistes'],
          datasets: [{
            data: [genCount, specCount],
            backgroundColor: ['#3b82f6', '#10b981'],
            borderWidth: 0
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });

      const fData = await API.get("/feuilles");
      const vierge = fData.filter(f => f.etat === "VIERGE").length;
      const partiel = fData.filter(f => f.etat === "REMPLIE_PARTIELLEMENT").length;
      const enreg = fData.filter(f => f.etat === "ENREGISTREE").length;

      new Chart(document.getElementById('feuillesChart'), {
        type: 'bar',
        data: {
          labels: ['Vierge', 'Partielle', 'Enregistrée'],
          datasets: [{
            label: 'Nombre de feuilles',
            data: [vierge, partiel, enreg],
            backgroundColor: ['#9ca3af', '#f59e0b', '#10b981'],
            borderRadius: 4
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
      });
    } catch(err) {
      console.error("Error rendering charts:", err);
    }
  }
};

// ----------------------------- Assures -------------------------------------
Pages.assures = async () => {
  const assures = await API.get("/assures");
  const action = can("ASSUREUR")
    ? `<button class="btn btn-primary" data-act="add-assure">+ Inscrire un assuré</button>`
    : "";
  const rows = assures.map(
    (a) => `<tr>
      <td class="cell-strong">${esc(a.prenom)} ${esc(a.nom)}<div class="cell-muted">${esc(a.id)}</div></td>
      <td>${esc(a.email)}<div class="cell-muted">${esc(a.tel || "")}</div></td>
      <td>${esc(a.profession || "-")}</td>
      <td>${a.groupeSanguin ? `<span class="pill">${esc(a.groupeSanguin)}</span>` : "-"}</td>
      <td>${a.allergies ? `<span class="badge badge-red" title="${esc(a.allergies)}">⚠ ${esc(a.allergies.length > 22 ? a.allergies.slice(0, 22) + '...' : a.allergies)}</span>` : '<span class="cell-muted">Aucune</span>'}</td>
      <td>${a.medecinTraitant ? esc(a.medecinTraitant) : '<span class="badge badge-grey">Aucun</span>'}</td>
      <td><div class="row-actions">${can("ASSUREUR")
        ? `<button class="btn btn-soft btn-sm" data-act="med-traitant" data-id="${a.id}">Médecin traitant</button>
           <button class="btn btn-danger btn-sm" data-act="delete-assure" data-id="${a.id}">🗑</button>`
        : ""}</div></td>
    </tr>`
  );
  $("#page-content").innerHTML = tablePanel({
    title: "Assurés",
    sub: "Liste des patients bénéficiaires",
    action,
    columns: ["Assuré", "Contact", "Profession", "Groupe", "Allergies", "Médecin traitant", ""],
    rows,
    empty: "Aucun assuré enregistré.",
  });
};

// ----------------------------- Medecins ------------------------------------
Pages.medecins = async () => {
  const medecins = await API.get("/medecins");
  const action = can("ASSUREUR")
    ? `<button class="btn btn-primary" data-act="add-medecin">+ Enregistrer un médecin</button>
       <button class="btn btn-soft" data-act="add-specialite">+ Ajouter une spécialité</button>`
    : "";
  const columns = can("ASSUREUR") 
    ? ["Médecin", "Type", "Spécialité", "Contact", "Identifiant", "État", ""] 
    : ["Médecin", "Type", "Spécialité", "Contact", "État"];
    
  const rows = medecins.map(
    (m) => `<tr>
      <td class="cell-strong">${esc(m.prenom)} ${esc(m.nom)}<div class="cell-muted">${esc(m.id)}</div></td>
      <td>${typeMedecinPill(m.type)}</td>
      <td>${m.specialite ? esc(m.specialite) : '<span class="cell-muted">Médecine générale</span>'}</td>
      <td>${esc(m.email || "-")}<div class="cell-muted">${esc(m.tel || "")}</div></td>
      ${can("ASSUREUR") ? `<td><code>${esc(m.login)}</code></td>` : ""}
      <td>${(m.etat === "Désactivé")
        ? '<span class="badge badge-grey">Désactivé</span>'
        : '<span class="badge badge-green">Actif</span>'}</td>
      ${can("ASSUREUR") ? `<td><div class="row-actions">${
        m.etat === "Désactivé"
          ? '<span class="cell-muted">—</span>'
          : `<button class="btn btn-danger btn-sm" data-act="desactiver-medecin" data-id="${m.id}">Désactiver</button>`
      }</div></td>` : ""}
    </tr>`
  );
  $("#page-content").innerHTML = tablePanel({
    title: "Médecins",
    sub: "Généralistes (remb. 100%) · Spécialistes (80% avec orientation / 30% sans parcours)",
    action,
    columns,
    rows,
    empty: "Aucun médecin enregistré.",
  });
};

// ----------------------------- Consultations -------------------------------
Pages.consultations = async () => {
  const list = await API.get("/consultations");
  const rows = list.map(
    (c) => `<tr>
      <td class="cell-strong">${esc(c.id)}</td>
      <td>${esc(c.assure)}</td>
      <td>${esc(c.medecin)}</td>
      <td>${dt(c.date)}</td>
      <td>${esc(c.motif || "-")}</td>
      <td><span class="badge badge-blue">${esc(c.etat)}</span></td>
      ${can("ASSUREUR") ? `<td><div class="row-actions"><button class="btn btn-danger btn-sm" data-act="delete-consultation" data-id="${c.id}">🗑</button></div></td>` : ""}
    </tr>`
  );
  $("#page-content").innerHTML = tablePanel({
    title: "Consultations",
    sub: "Rendez-vous entre assurés et médecins",
    action: `<button class="btn btn-primary" data-act="add-consultation">+ Nouvelle consultation</button>`,
    columns: can("ASSUREUR") ? ["Référence", "Assuré", "Médecin", "Date", "Motif", "État", ""] : ["Référence", "Assuré", "Médecin", "Date", "Motif", "État"],
    rows,
    empty: "Aucune consultation enregistree.",
  });
};

// ----------------------------- Feuilles de maladie -------------------------
Pages.feuilles = async () => {
  const list = await API.get("/feuilles");
  const action = can("MEDECIN")
    ? `<button class="btn btn-primary" data-act="add-feuille">+ Nouvelle feuille</button>`
    : "";
  const rows = list.map((f) => {
    let actBtns = "";
    if (can("ASSUREUR") && f.etat === "REMPLIE_PARTIELLEMENT")
      actBtns += `<button class="btn btn-soft btn-sm" data-act="completer-feuille" data-id="${f.id}">Completer</button>`;
    if (can("ASSUREUR") && f.etat === "ENREGISTREE" && !f.rembourse)
      actBtns += `<button class="btn btn-cyan btn-sm" data-act="rembourser" data-id="${f.id}">Rembourser</button>`;
    return `<tr>
      <td class="cell-strong">${esc(f.id)}</td>
      <td>${esc(f.assure)}</td>
      <td>${esc(f.medecin)} ${typeMedecinPill(f.medecinType)}</td>
      <td>${money(f.montantSoins)}</td>
      <td>${feuilleBadge(f.etat)}</td>
      <td>${f.rembourse ? '<span class="badge badge-green">Remboursee</span>' : '<span class="badge badge-grey">Non</span>'}</td>
      <td><div class="row-actions">${actBtns}</div></td>
    </tr>`;
  });
  $("#page-content").innerHTML = tablePanel({
    title: "Feuilles de maladie",
    sub: "Cycle : Vierge → Remplie partiellement (medecin) → Enregistree (assureur)",
    action,
    columns: ["Reference", "Assure", "Medecin", "Montant soins", "Etat", "Remboursement", ""],
    rows,
    empty: "Aucune feuille de maladie.",
  });
};

// ----------------------------- Prescriptions -------------------------------
Pages.prescriptions = async () => {
  const list = await API.get("/prescriptions");
  const rows = list.map((p) =>
    p.type === "MEDICAMENT"
      ? `<tr>
          <td class="cell-strong">${esc(p.id)}</td>
          <td><span class="badge badge-blue">Medicament</span></td>
          <td>${esc(p.nom)}</td>
          <td>${money(p.prix)}</td>
          <td>${esc(p.consultationId)}</td>
          <td>${dt(p.date)}</td></tr>`
      : `<tr>
          <td class="cell-strong">${esc(p.id)}</td>
          <td><span class="badge badge-amber">Consultation specialisee</span></td>
          <td>${esc(p.specialiteRecommandee || "-")}${p.motif ? `<div class="cell-muted">${esc(p.motif)}</div>` : ""}</td>
          <td>-</td>
          <td>${esc(p.consultationId)}</td>
          <td>${dt(p.date)}</td></tr>`
  );
  $("#page-content").innerHTML = `<div class="panel">
    <div class="panel-head">
      <div><h3>Prescriptions</h3><p>Emises lors d'une consultation</p></div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-soft" data-act="presc-medicament">💊 Prescrire medicament</button>
        <button class="btn btn-primary" data-act="presc-consultation">🩺 Prescrire consultation</button>
      </div>
    </div>
    <div class="panel-body"><div class="table-wrap">
      ${rows.length === 0
        ? `<div class="empty"><div class="big">📭</div>Aucune prescription.</div>`
        : `<table class="data"><thead><tr><th>Reference</th><th>Type</th><th>Detail</th><th>Prix</th><th>Consultation</th><th>Date</th></tr></thead><tbody>${rows.join("")}</tbody></table>`}
    </div></div></div>`;
};

// ----------------------------- Remboursements ------------------------------
Pages.remboursements = async () => {
  const list = await API.get("/remboursements");
  const rows = list.map(
    (r) => `<tr>
      <td class="cell-strong">${esc(r.id)}</td>
      <td>${esc(r.assure)}</td>
      <td>${money(r.montantSoins)}</td>
      <td><span class="pill ${r.taux === 100 ? "pill-gen" : "pill-spec"}">${r.taux}%</span></td>
      <td class="cell-strong">${money(r.montant)}</td>
      <td>${r.modePaiement === "VIREMENT" ? '<span class="badge badge-blue">Virement</span>' : '<span class="badge badge-grey">Especes</span>'}</td>
      <td><span class="badge badge-green">${esc(r.etat)}</span></td>
      <td><div class="row-actions"><button class="btn btn-soft btn-sm" data-act="facture" data-id="${r.id}">🖨 Facture</button></div></td>
    </tr>`
  );
  $("#page-content").innerHTML = tablePanel({
    title: "Remboursements",
    sub: "Généraliste 100% · Spécialiste 80% (avec orientation) / 30% (sans parcours de soins)",
    action: `<button class="btn btn-primary" data-act="effectuer-remb">+ Effectuer un remboursement</button>`,
    columns: ["Reference", "Assure", "Montant soins", "Taux", "Rembourse", "Mode", "Etat", ""],
    rows,
    empty: "Aucun remboursement effectue.",
  });
};

// ===========================================================================
//  ACTIONS (delegation d'evenements sur le contenu de page)
// ===========================================================================
$("#page-content").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const id = btn.dataset.id;
  const act = btn.dataset.act;
  if (Actions[act]) Actions[act](id);
});

const Actions = {};

// CU 2 : Inscrire un assure
Actions["add-assure"] = () => {
  openForm({
    title: "Inscrire un assure",
    submitLabel: "Inscrire",
    fields: [
      { name: "nom", label: "Nom", required: true },
      { name: "prenom", label: "Prenom", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "tel", label: "Telephone" },
      { name: "age", label: "Age", type: "number" },
      { name: "groupeSanguin", label: "Groupe sanguin", type: "select", placeholder: "Choisir",
        options: ["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((g) => ({ value: g, label: g })) },
      { name: "profession", label: "Profession", full: true },
      { name: "allergies", label: "Allergies connues", full: true, placeholder: "Séparées par des virgules" },
    ],
    onSubmit: async (v) => {
      await API.post("/assures", v);
      toast("Assure inscrit avec succes.", "ok", "Inscription reussie");
      if (currentPage === "assures") Pages.assures();
    },
  });
};

// CU 3 : Enregistrer medecin traitant
Actions["med-traitant"] = async (id) => {
  const medecins = await API.get("/medecins");
  const assure = await API.get(`/assures/${id}`);
  openForm({
    title: `Medecin traitant - ${assure.prenom} ${assure.nom}`,
    submitLabel: "Associer",
    fields: [
      { name: "medecinId", label: "Selectionner un medecin", type: "select", required: true, full: true,
        value: assure.medecinTraitantId || "",
        placeholder: "Choisir un medecin",
        options: medecins.map((m) => ({
          value: m.id,
          label: `${m.prenom} ${m.nom} - ${m.type === "GENERALISTE" ? "Generaliste" : "Specialiste " + (m.specialite || "")}`,
        })) },
    ],
    onSubmit: async (v) => {
      const r = await API.put(`/assures/${id}/medecin-traitant`, v);
      toast(r.miseAJour ? "Medecin traitant mis a jour." : "Medecin traitant associe.", "ok");
      if (currentPage === "assures") Pages.assures();
    },
  });
};

// Enregistrer un medecin
Actions["add-medecin"] = () => {
  openForm({
    title: "Enregistrer un médecin",
    submitLabel: "Enregistrer",
    fields: [
      { name: "nom", label: "Nom", required: true },
      { name: "prenom", label: "Prénom", required: true },
      { name: "type", label: "Type", type: "select", required: true, placeholder: "Choisir",
        options: [{ value: "GENERALISTE", label: "Généraliste" }, { value: "SPECIALISTE", label: "Spécialiste" }] },
      { name: "specialite", label: "Spécialité (si spécialiste)", type: "select", placeholder: "Choisir une spécialité", options: SPECIALITES },
      { name: "email", label: "Email", type: "email" },
      { name: "tel", label: "Telephone" },
      { name: "login", label: "Identifiant de connexion", help: "Laisser vide pour generer automatiquement" },
      { name: "password", label: "Mot de passe", help: "Par defaut : med123" },
    ],
    onSubmit: async (v) => {
      const m = await API.post("/medecins", v);
      toast(`Medecin enregistre. Connexion : ${m.login} / ${m.motDePasseParDefaut}`, "ok", "Medecin cree");
      if (currentPage === "medecins") Pages.medecins();
    },
  });
};

// Ajouter une specialite
Actions["add-specialite"] = () => {
  openForm({
    title: "Ajouter une spécialité",
    submitLabel: "Ajouter",
    fields: [
      { name: "nom", label: "Nom de la spécialité", required: true },
    ],
    onSubmit: async (v) => {
      await API.post("/specialites", v);
      toast("Spécialité ajoutée.", "ok");
      const specs = await API.get("/specialites");
      SPECIALITES = specs.map(s => ({ value: s.nom, label: s.nom }));
      if (currentPage === "medecins") Pages.medecins();
    },
  });
};

// Nouvelle consultation
Actions["add-consultation"] = async () => {
  const [assures, medecins] = await Promise.all([API.get("/assures"), API.get("/medecins")]);
  const fields = [
    { name: "assureId", label: "Assuré", type: "select", required: true, placeholder: "Choisir un assuré",
      options: assures.map((a) => ({ value: a.id, label: `${a.prenom} ${a.nom}` })) },
  ];
  if (!can("MEDECIN")) {
    fields.push({ name: "medecinId", label: "Médecin", type: "select", required: true, placeholder: "Choisir un médecin",
      options: medecins.map((m) => ({ value: m.id, label: `${m.prenom} ${m.nom}` })) });
  }
  fields.push({ name: "date", label: "Date", type: "date", value: new Date().toISOString().slice(0, 10) });
  fields.push({ name: "motif", label: "Motif", full: true });

  openForm({
    title: "Nouvelle consultation",
    submitLabel: "Enregistrer",
    fields,
    onSubmit: async (v) => {
      await API.post("/consultations", v);
      toast("Consultation enregistree.", "ok");
      if (currentPage === "consultations") Pages.consultations();
    },
  });
};

// CU 4 : Enregistrer feuille de maladie (medecin)
Actions["add-feuille"] = async () => {
  const [assures, consultations] = await Promise.all([
    API.get("/assures"),
    API.get("/consultations"),
  ]);
  openForm({
    title: "Nouvelle feuille de maladie",
    submitLabel: "Enregistrer",
    fields: [
      { name: "assureId", label: "Assure", type: "select", required: true, placeholder: "Choisir un assure",
        options: assures.map((a) => ({ value: a.id, label: `${a.prenom} ${a.nom}` })) },
      { name: "consultationId", label: "Consultation liée", type: "select", placeholder: "(optionnel)",
        options: consultations.map((c) => ({ value: c.id, label: `${c.id} - ${c.assure} (${dt(c.date)})` })) },
      { name: "montantSoins", label: "Acte médical", type: "select", required: true,
        options: [
          { value: "15000", label: "Consultation simple (15 000 FCFA)" },
          { value: "25000", label: "Consultation spécialisée (25 000 FCFA)" },
          { value: "50000", label: "Acte technique / Chirurgie (50 000 FCFA)" }
        ] },
      { name: "contenu", label: "Diagnostic / traitement", type: "textarea", full: true,
        placeholder: "Symptômes, diagnostic, soins prodigués..." },
    ],
    onSubmit: async (v) => {
      await API.post("/feuilles", v);
      toast("Feuille de maladie enregistree (remplie partiellement).", "ok");
      if (currentPage === "feuilles") Pages.feuilles();
    },
  });
};

// CU 9 : Completer une feuille de maladie (assureur)
Actions["completer-feuille"] = async (id) => {
  const f = await API.get(`/feuilles/${id}`);
  let prescHtml = "<em>Aucune prescription liée.</em>";
  if (f.consultationId) {
    const prescriptions = await API.get(`/prescriptions?consultationId=${f.consultationId}`);
    if (prescriptions.length > 0) {
      prescHtml = `<ul style="margin:0;padding-left:1.5rem">` + prescriptions.map(p => `<li>${p.type === 'MEDICAMENT' ? 'Médicament : ' + esc(p.nom) : 'Orientation : ' + esc(p.specialiteRecommandee)}</li>`).join('') + `</ul>`;
    }
  }

  openForm({
    title: `Compléter la feuille ${f.id}`,
    submitLabel: "Compléter et enregistrer",
    fields: [
      { name: "info", type: "html", full: true, html: `<div style="background:#f4f4f5;padding:10px;border-radius:6px;margin-bottom:15px;font-size:14px"><strong>Prescriptions de la consultation :</strong><br>${prescHtml}</div>` },
      { name: "montantTotal", label: "Montant total validé (FCFA)", type: "number", value: f.montantTotal,
        help: `Montant des soins déclaré par le médecin : ${money(f.montantSoins)}` },
      { name: "contenu", label: "Complément d'information", type: "textarea", full: true, value: f.contenu },
    ],
    onSubmit: async (v) => {
      await API.put(`/feuilles/${id}/completer`, v);
      toast("Feuille completee et enregistree.", "ok");
      if (currentPage === "feuilles") Pages.feuilles();
    },
  });
};

// CU 6 : Prescrire medicament
Actions["presc-medicament"] = async () => {
  const consultations = await API.get("/consultations");
  openForm({
    title: "Prescrire un medicament",
    submitLabel: "Prescrire",
    fields: [
      { name: "consultationId", label: "Consultation", type: "select", required: true, placeholder: "Choisir",
        options: consultations.map((c) => ({ value: c.id, label: `${c.id} - ${c.assure}` })) },
      { name: "nom", label: "Nom du medicament", required: true },
      { name: "prix", label: "Prix (FCFA)", type: "number" },
    ],
    onSubmit: async (v) => {
      await API.post("/prescriptions/medicament", v);
      toast("Medicament prescrit.", "ok");
      if (currentPage === "prescriptions") Pages.prescriptions();
    },
  });
};

// CU 5 : Prescrire une consultation chez un specialiste
Actions["presc-consultation"] = async () => {
  const [consultations, specialistes] = await Promise.all([
    API.get("/consultations"),
    API.get("/medecins?type=SPECIALISTE"),
  ]);
  openForm({
    title: "Prescrire une consultation spécialisée",
    submitLabel: "Prescrire",
    fields: [
      { name: "consultationId", label: "Consultation d'origine", type: "select", required: true, placeholder: "Choisir",
        options: consultations.map((c) => ({ value: c.id, label: `${c.id} - ${c.assure}` })) },
      { name: "specialisteId", label: "Spécialiste recommandé", type: "select", placeholder: "(optionnel)",
        options: specialistes.map((m) => ({ value: m.id, label: `${m.prenom} ${m.nom} - ${m.specialite || ""}` })) },
      { name: "specialiteRecommandee", label: "Ou spécialité recommandée", type: "select", placeholder: "Choisir une spécialité", options: SPECIALITES },
      { name: "motif", label: "Motif de la recommandation", type: "textarea", full: true },
    ],
    onSubmit: async (v) => {
      await API.post("/prescriptions/consultation", v);
      toast("Consultation specialisee prescrite.", "ok");
      if (currentPage === "prescriptions") Pages.prescriptions();
    },
  });
};

// CU 7 : Effectuer un remboursement
Actions["effectuer-remb"] = async () => {
  const feuilles = await API.get("/feuilles");
  const eligibles = feuilles.filter((f) => f.etat === "ENREGISTREE" && !f.rembourse);
  if (eligibles.length === 0) {
    toast("Aucune feuille enregistree en attente de remboursement.", "err", "Impossible");
    return;
  }
  openForm({
    title: "Effectuer un remboursement",
    submitLabel: "Rembourser",
    fields: [
      { name: "feuilleId", label: "Feuille de maladie", type: "select", required: true, placeholder: "Choisir",
        options: eligibles.map((f) => ({
          value: f.id,
          label: `${f.id} - ${f.assure} - ${money(f.montantSoins)} (${f.medecinType === "GENERALISTE" ? "100% remb." : "80% avec orientation / 30% sans"})`,
        })) },
      { name: "modePaiement", label: "Mode de remboursement", type: "select", required: true,
        options: [{ value: "VIREMENT", label: "Virement bancaire" }, { value: "ESPECES", label: "Especes" }] },
    ],
    onSubmit: async (v) => {
      const r = await API.post("/remboursements", v);
      toast(`Remboursement de ${money(r.montant)} effectue (taux ${r.taux}%).`, "ok", "Remboursement");
      if (currentPage === "feuilles") Pages.feuilles();
      else if (currentPage === "remboursements") Pages.remboursements();
    },
  });
};
Actions["rembourser"] = async (feuilleId) => {
  openForm({
    title: "Effectuer un remboursement",
    submitLabel: "Rembourser",
    fields: [
      { name: "modePaiement", label: "Mode de remboursement", type: "select", required: true, full: true,
        options: [{ value: "VIREMENT", label: "Virement bancaire" }, { value: "ESPECES", label: "Especes" }] },
    ],
    onSubmit: async (v) => {
      const r = await API.post("/remboursements", { feuilleId, modePaiement: v.modePaiement });
      toast(`Remboursement de ${money(r.montant)} effectue (taux ${r.taux}%).`, "ok", "Remboursement");
      Pages.feuilles();
    },
  });
};

// CU 8 : Imprimer facture
Actions["facture"] = async (id) => {
  const f = await API.get(`/remboursements/${id}/facture`);
  const html = `<div id="print-area" class="facture">
    <div class="f-head">
      <div><h2>Organisme de Securite Sociale</h2><div class="cell-muted">Justificatif de remboursement</div></div>
      <div style="text-align:right"><div class="cell-strong">Facture ${esc(f.numero)}</div><div class="cell-muted">${dt(f.date)}</div></div>
    </div>
    <table class="f-rows">
      <tr><td>Assure</td><td>${esc(f.assure ? f.assure.prenom + " " + f.assure.nom : "-")}</td></tr>
      <tr><td>Medecin</td><td>${esc(f.medecin ? f.medecin.nom : "-")} (${esc(f.medecin ? (f.medecin.type === "GENERALISTE" ? "Generaliste" : "Specialiste") : "-")})</td></tr>
      <tr><td>Feuille de maladie</td><td>${esc(f.feuille ? f.feuille.id : "-")}</td></tr>
      <tr><td>Montant des soins</td><td>${money(f.montantSoins)}</td></tr>
      <tr><td>Taux applique</td><td>${f.taux}%</td></tr>
      <tr><td>Mode de paiement</td><td>${f.modePaiement === "VIREMENT" ? "Virement bancaire" : "Especes"}</td></tr>
    </table>
    <div class="f-total"><span>Montant rembourse</span><span>${money(f.montantRembourse)}</span></div>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" id="modal-cancel">Fermer</button>
    <button class="btn btn-primary" onclick="window.print()">🖨 Imprimer</button>
  </div>`;
  openModal("Facture de remboursement", html);
  $("#modal-cancel").addEventListener("click", closeModal);
};

// Suppression
Actions["delete-assure"] = async (id) => {
  if (!confirm("Voulez-vous vraiment supprimer cet assuré ?")) return;
  await API.delete(`/assures/${id}`);
  toast("Assuré supprimé.", "ok");
  Pages.assures();
};

// CU 11 : Desactiver un medecin (il ne pourra plus se connecter ni exercer)
Actions["desactiver-medecin"] = async (id) => {
  if (!confirm("Désactiver ce médecin ? Il ne pourra plus se connecter ni exercer.")) return;
  await API.put(`/medecins/${id}/desactiver`);
  toast("Médecin désactivé.", "ok");
  Pages.medecins();
};

Actions["delete-consultation"] = async (id) => {
  if (!confirm("Voulez-vous vraiment supprimer cette consultation ?")) return;
  await API.delete(`/consultations/${id}`);
  toast("Consultation supprimée.", "ok");
  Pages.consultations();
};

// ===========================================================================
//  DEMARRAGE : reprise de session si un jeton existe
// ===========================================================================
(async function bootstrap() {
  if (API.token) {
    try {
      const { user } = await API.get("/auth/me");
      currentUser = user;
      enterApp();
      return;
    } catch {
      API.setToken(null);
    }
  }
  $("#login-view").hidden = false;
})();
