(function () {
  "use strict";

  const API = "../api/index.php";

  /** TIA-598-C (12 colores, se repiten en cables mayores) */
  const FIBER_COLORS = [
    "#007edf",
    "#ff6a00",
    "#00a854",
    "#5c4033",
    "#8194a8",
    "#e8e8e8",
    "#e60026",
    "#1a1a1a",
    "#e6de00",
    "#6b2d9e",
    "#d4007a",
    "#00c4c4",
  ];

  const state = {
    map: null,
    mode: "",
    mufaLayer: null,
    terminalLayer: null,
    cableLayer: null,
    cableDraft: [],
    cableDraftLine: null,
    markers: new Map(),
    cables: new Map(),
    selectedId: null,
    selectedType: null,
    pendingPoint: null,
  };

  let hierarchyCache = { buildings: [], orphan_sites: [] };
  let netSelection = null;
  let powerListCache = [];
  let fiberModal = { cableId: null, map: {}, editingIndex: null };

  const iconMufa = L.divIcon({
    className: "fa-marker fa-mufa",
    html: '<div style="width:14px;height:14px;border-radius:50%;background:#f59e0b;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

  const iconTerminal = L.divIcon({
    className: "fa-marker fa-terminal",
    html: '<div style="width:14px;height:14px;border-radius:3px;background:#22c55e;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

  function fiberColor(i) {
    return FIBER_COLORS[(i - 1) % FIBER_COLORS.length];
  }

  function isLightHex(hex) {
    const h = hex.replace("#", "");
    if (h.length !== 6) return false;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 155;
  }

  function normalizeFiberMap(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    Object.keys(raw).forEach((k) => {
      const v = raw[k];
      if (v && typeof v === "object") {
        out[String(k)] = {
          target: v.target != null ? String(v.target) : "",
          note: v.note != null ? String(v.note) : "",
        };
      }
    });
    return out;
  }

  function setStatus(t) {
    const el = document.getElementById("status");
    if (el) el.textContent = t;
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll(".tools button[data-mode]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
    const none = document.getElementById("mode-none");
    if (none) none.classList.toggle("active", mode === "");
    const cable = mode === "cable";
    const fin = document.getElementById("cable-finish");
    const can = document.getElementById("cable-cancel");
    if (fin) fin.disabled = !cable || state.cableDraft.length < 2;
    if (can) can.disabled = !cable || state.cableDraft.length === 0;
    if (mode !== "cable") clearCableDraft(false);
    setStatus(
      mode === "mufa"
        ? "Clic en el mapa para colocar una mufa."
        : mode === "terminal"
          ? "Clic en el mapa para colocar un terminal."
          : mode === "cable"
            ? "Clics: vértices del cable / manga. Luego «Finalizar cable»."
            : "Listo."
    );
  }

  function clearCableDraft(redraw) {
    state.cableDraft = [];
    if (state.cableDraftLine && state.map) {
      state.map.removeLayer(state.cableDraftLine);
      state.cableDraftLine = null;
    }
    if (redraw && state.mode === "cable") {
      const fin = document.getElementById("cable-finish");
      const can = document.getElementById("cable-cancel");
      if (fin) fin.disabled = true;
      if (can) can.disabled = true;
    }
  }

  async function api(method, resource, body, id) {
    let url = `${API}?resource=${encodeURIComponent(resource)}`;
    if (id != null) url += `&id=${encodeURIComponent(String(id))}`;
    const opt = { method, headers: { Accept: "application/json" } };
    if (body != null && method !== "GET" && method !== "DELETE") {
      opt.headers["Content-Type"] = "application/json";
      opt.body = JSON.stringify(body);
    }
    const res = await fetch(url, opt);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(text.slice(0, 200) || "Respuesta no JSON");
    }
    if (!data.ok) throw new Error(data.error || res.statusText);
    return data;
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function flyTo(lat, lng) {
    if (!state.map) return;
    state.map.flyTo([lat, lng], Math.max(state.map.getZoom(), 16), { duration: 0.6 });
  }

  /* ---------- Pestañas ---------- */
  function switchTab(name) {
    document.querySelectorAll(".main-tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === name);
      b.setAttribute("aria-selected", b.dataset.tab === name ? "true" : "false");
    });
    document.querySelectorAll(".tab-panel").forEach((p) => {
      const on = p.dataset.panel === name;
      p.classList.toggle("active", on);
      p.hidden = !on;
    });
    if (name === "map" && state.map) {
      setTimeout(() => state.map.invalidateSize(), 200);
    }
    if (name === "network") loadHierarchy();
    if (name === "budget") loadBudgetData();
  }

  document.querySelectorAll(".main-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  /* ---------- Jerarquía / PON planos ---------- */
  async function loadHierarchy() {
    try {
      const res = await api("GET", "hierarchy");
      const d = res.data || {};
      hierarchyCache = {
        buildings: d.buildings || [],
        orphan_sites: d.orphan_sites || [],
      };
      renderNetworkTree();
      fillSiteAndPonSelects();
      if (netSelection) renderNetDetail();
    } catch (e) {
      console.error(e);
      document.getElementById("network-tree").innerHTML =
        `<p class="sub">Error: ${escapeHtml(e.message)}</p>`;
    }
  }

  function forEachSite(fn) {
    (hierarchyCache.buildings || []).forEach((b) => {
      (b.sites || []).forEach((s) => fn(s, b));
    });
    (hierarchyCache.orphan_sites || []).forEach((s) => fn(s, null));
  }

  function flattenPons() {
    const list = [];
    forEachSite((site, building) => {
      const pref = building
        ? `${building.name} / ${site.name}`
        : `(sin edif.) / ${site.name}`;
      (site.olts || []).forEach((olt) => {
        (olt.olt_cards || []).forEach((card) => {
          (card.pons || []).forEach((pon) => {
            list.push({
              id: pon.id,
              label: `${pref} / ${olt.name} / ${card.label} / PON ${pon.pon_number}${
                pon.label ? " " + pon.label : ""
              }`,
            });
          });
        });
      });
    });
    return list;
  }

  function fillSiteAndPonSelects() {
    const siteSel = document.getElementById("f-site-id");
    const ponSel = document.getElementById("f-linked-pon-id");
    if (siteSel) {
      const v = siteSel.value;
      siteSel.innerHTML = '<option value="">— Ninguno —</option>';
      (hierarchyCache.buildings || []).forEach((b) => {
        siteSel.innerHTML += `<optgroup label="${escapeHtml(b.name || "Edificio")}">`;
        (b.sites || []).forEach((s) => {
          siteSel.innerHTML += `<option value="${s.id}">${escapeHtml(s.name || "Site")}</option>`;
        });
        siteSel.innerHTML += `</optgroup>`;
      });
      if ((hierarchyCache.orphan_sites || []).length) {
        siteSel.innerHTML += `<optgroup label="Sin edificio">`;
        hierarchyCache.orphan_sites.forEach((s) => {
          siteSel.innerHTML += `<option value="${s.id}">${escapeHtml(s.name || "Site")}</option>`;
        });
        siteSel.innerHTML += `</optgroup>`;
      }
      if (v) siteSel.value = v;
    }
    if (ponSel) {
      const v = ponSel.value;
      ponSel.innerHTML = '<option value="">— Ninguno —</option>';
      flattenPons().forEach((p) => {
        ponSel.innerHTML += `<option value="${p.id}">${escapeHtml(p.label)}</option>`;
      });
      if (v) ponSel.value = v;
    }
    fillFiberTargetSelect(document.getElementById("fiber-ed-target"));
  }

  function fillFiberTargetSelect(sel) {
    if (!sel) return;
    const v = sel.value;
    sel.innerHTML = '<option value="">— Libre —</option>';
    flattenPons().forEach((p) => {
      sel.innerHTML += `<option value="pon:${p.id}">${escapeHtml(p.label)}</option>`;
    });
    cache.mufas.forEach((m) => {
      sel.innerHTML += `<option value="mufa:${m.id}">Mufa: ${escapeHtml(m.name || "#" + m.id)}</option>`;
    });
    if (v) sel.value = v;
  }

  function renderSiteSubtree(site) {
    let html = `<div class="nt-site" data-id="${site.id}">
        <div class="nt-head" data-sel="site" data-id="${site.id}" data-building-id="${
          site.building_id != null ? site.building_id : ""
        }">
          <span>${escapeHtml(site.name || "Site")}</span>
          <button type="button" class="btn-sm" data-add-olt="${site.id}">＋ OLT</button>
        </div>`;
    (site.olts || []).forEach((olt) => {
      html += `<div class="nt-olt" data-id="${olt.id}">
          <div class="nt-head" data-sel="olt" data-id="${olt.id}" data-site-id="${site.id}">
            <span>OLT: ${escapeHtml(olt.name || "#" + olt.id)}</span>
            <button type="button" class="btn-sm" data-add-card="${olt.id}">＋ Tarjeta</button>
          </div>`;
      (olt.olt_cards || []).forEach((card) => {
        html += `<div class="nt-card" data-id="${card.id}">
            <div class="nt-head" data-sel="card" data-id="${card.id}" data-olt-id="${olt.id}">
              <span>${escapeHtml(card.label || "Tarjeta")}</span>
              <button type="button" class="btn-sm" data-add-pon="${card.id}">＋ PON</button>
            </div>`;
        (card.pons || []).forEach((pon) => {
          html += `<div class="nt-pon" data-sel="pon" data-id="${pon.id}" data-card-id="${card.id}">
              <span>PON ${pon.pon_number} ${escapeHtml(pon.label || "")}</span>
              <span class="nt-mini">#${pon.id}</span>
            </div>`;
        });
        html += `</div>`;
      });
      html += `</div>`;
    });
    html += `</div>`;
    return html;
  }

  function renderNetworkTree() {
    const el = document.getElementById("network-tree");
    const blds = hierarchyCache.buildings || [];
    const orphans = hierarchyCache.orphan_sites || [];
    if (!blds.length && !orphans.length) {
      el.innerHTML =
        '<p class="sub">Orden: <strong>Edificio</strong> → <strong>Site</strong> (cabecera) → OLT → tarjeta → PON. Pulsa «＋ Edificio».</p>';
      return;
    }
    let html = "";
    blds.forEach((b) => {
      html += `<div class="nt-building" data-id="${b.id}">
        <div class="nt-head nt-building-head" data-sel="building" data-id="${b.id}">
          <span>Edificio: ${escapeHtml(b.name || "#" + b.id)}</span>
          <button type="button" class="btn-sm" data-add-site="${b.id}">＋ Site</button>
        </div>`;
      (b.sites || []).forEach((site) => {
        html += renderSiteSubtree(site);
      });
      html += `</div>`;
    });
    if (orphans.length) {
      html += `<div class="nt-orphan"><p class="sub" style="margin:0.6rem 0 0.35rem">Sites sin edificio</p>`;
      orphans.forEach((site) => {
        html += renderSiteSubtree(site);
      });
      html += `</div>`;
    }
    el.innerHTML = html;
  }

  document.getElementById("network-tree").addEventListener("click", async (ev) => {
    const addSiteUnder = ev.target.closest("[data-add-site]");
    if (addSiteUnder) {
      const name = prompt("Nombre del site (cabecera / POP lógico) en este edificio?");
      if (!name) return;
      try {
        await api("POST", "sites", {
          building_id: Number(addSiteUnder.dataset.addSite),
          name,
          notes: "",
        });
        await loadHierarchy();
      } catch (e) {
        alert(e.message);
      }
      return;
    }
    const addOlt = ev.target.closest("[data-add-olt]");
    const addCard = ev.target.closest("[data-add-card]");
    const addPon = ev.target.closest("[data-add-pon]");
    if (addOlt) {
      const name = prompt("Nombre del OLT?");
      if (!name) return;
      try {
        await api("POST", "olts", { site_id: Number(addOlt.dataset.addOlt), name, notes: "" });
        await loadHierarchy();
      } catch (e) {
        alert(e.message);
      }
      return;
    }
    if (addCard) {
      const label = prompt("Nombre de la tarjeta (ej. Tarjeta 1)?", "Tarjeta 1");
      if (!label) return;
      try {
        await api("POST", "olt_cards", {
          olt_id: Number(addCard.dataset.addCard),
          label,
          sort_order: 0,
          notes: "",
        });
        await loadHierarchy();
      } catch (e) {
        alert(e.message);
      }
      return;
    }
    if (addPon) {
      const num = parseInt(prompt("Número de PON (puerto)?", "1"), 10);
      if (Number.isNaN(num)) return;
      try {
        await api("POST", "pons", {
          olt_card_id: Number(addPon.dataset.addPon),
          pon_number: num,
          label: "",
          notes: "",
        });
        await loadHierarchy();
      } catch (e) {
        alert(e.message);
      }
      return;
    }
    const ponEl = ev.target.closest(".nt-pon[data-sel=pon]");
    if (ponEl) {
      netSelection = { type: "pon", id: Number(ponEl.dataset.id) };
      document.querySelectorAll(".nt-pon").forEach((n) => n.classList.remove("selected"));
      ponEl.classList.add("selected");
      await loadPonDetail(Number(ponEl.dataset.id));
      return;
    }
    const head = ev.target.closest(".nt-head[data-sel]");
    if (head && !ev.target.closest("button")) {
      const t = head.dataset.sel;
      const id = Number(head.dataset.id);
      netSelection = { type: t, id };
      document.querySelectorAll(".nt-pon").forEach((n) => n.classList.remove("selected"));
      renderNetDetail();
    }
  });

  document.getElementById("btn-add-building").addEventListener("click", async () => {
    const name = prompt("Nombre del edificio / sala / POP físico?");
    if (!name) return;
    try {
      await api("POST", "buildings", { name, address: "", notes: "" });
      await loadHierarchy();
    } catch (e) {
      alert(e.message);
    }
  });
  document.getElementById("btn-add-orphan-site").addEventListener("click", async () => {
    const name = prompt("Nombre del site sin edificio (solo migración o temporal)?");
    if (!name) return;
    try {
      await api("POST", "sites", { name, notes: "", building_id: null });
      await loadHierarchy();
    } catch (e) {
      alert(e.message);
    }
  });
  document.getElementById("btn-refresh-tree").addEventListener("click", () => loadHierarchy());

  function findSite(id) {
    let found = null;
    forEachSite((s) => {
      if (s.id === id) found = s;
    });
    return found;
  }

  function findBuilding(id) {
    return (hierarchyCache.buildings || []).find((b) => b.id === id);
  }

  function findOlt(id) {
    let r = null;
    forEachSite((site, building) => {
      const o = (site.olts || []).find((x) => x.id === id);
      if (o) r = { building, site, olt: o };
    });
    return r;
  }
  function findCard(id) {
    let r = null;
    forEachSite((site, building) => {
      for (const o of site.olts || []) {
        const c = (o.olt_cards || []).find((x) => x.id === id);
        if (c) r = { building, site, olt: o, card: c };
      }
    });
    return r;
  }
  function findPon(id) {
    let r = null;
    forEachSite((site, building) => {
      for (const o of site.olts || []) {
        for (const c of o.olt_cards || []) {
          const p = (c.pons || []).find((x) => x.id === id);
          if (p) r = { building, site, olt: o, card: c, pon: p };
        }
      }
    });
    return r;
  }

  function buildingOptionsHtml(selectedId) {
    let h = '<option value="">— Sin edificio —</option>';
    (hierarchyCache.buildings || []).forEach((b) => {
      const sel = Number(selectedId) === b.id ? " selected" : "";
      h += `<option value="${b.id}"${sel}>${escapeHtml(b.name || "#" + b.id)}</option>`;
    });
    return h;
  }

  function renderNetDetail() {
    const title = document.getElementById("net-detail-title");
    const box = document.getElementById("network-detail");
    if (!netSelection) {
      title.textContent = "Detalle";
      box.innerHTML = '<p class="sub">Selecciona un elemento en el árbol.</p>';
      return;
    }
    const { type, id } = netSelection;
    if (type === "building") {
      const b = findBuilding(id);
      if (!b) return;
      title.textContent = "Edificio";
      box.innerHTML = `
        <div class="form-grid">
          <label>Nombre<input type="text" id="nd-bname" value="${escapeHtml(b.name)}" /></label>
          <label>Dirección / ref.<input type="text" id="nd-baddr" value="${escapeHtml(b.address || "")}" /></label>
          <label>Lat (opc.)<input type="text" id="nd-blat" value="${b.lat != null ? b.lat : ""}" /></label>
          <label>Lng (opc.)<input type="text" id="nd-blng" value="${b.lng != null ? b.lng : ""}" /></label>
          <label>Notas<textarea id="nd-bnotes">${escapeHtml(b.notes || "")}</textarea></label>
          <div class="toolbar-row">
            <button type="button" class="btn-sm btn-primary" id="nd-save-b">Guardar</button>
            <button type="button" class="btn-sm" id="nd-del-b" style="border-color:#b91c1c;color:#fca5a5">Borrar edificio</button>
          </div>
        </div>
        <p class="sub" style="margin-top:0.75rem">Al borrar, los sites pasan a «sin edificio» (no se pierden).</p>`;
      document.getElementById("nd-save-b").onclick = async () => {
        try {
          await api("PUT", "buildings", {
            id,
            name: document.getElementById("nd-bname").value,
            address: document.getElementById("nd-baddr").value,
            lat: document.getElementById("nd-blat").value || null,
            lng: document.getElementById("nd-blng").value || null,
            notes: document.getElementById("nd-bnotes").value,
          });
          await loadHierarchy();
        } catch (e) {
          alert(e.message);
        }
      };
      document.getElementById("nd-del-b").onclick = async () => {
        if (!confirm("¿Borrar edificio? Los sites quedarán sin edificio.")) return;
        try {
          await api("DELETE", "buildings", null, id);
          netSelection = null;
          await loadHierarchy();
          renderNetDetail();
        } catch (e) {
          alert(e.message);
        }
      };
    }
    if (type === "site") {
      const s = findSite(id);
      if (!s) return;
      title.textContent = "Site (cabecera)";
      box.innerHTML = `
        <div class="form-grid">
          <label>Edificio físico<select id="nd-building-id">${buildingOptionsHtml(s.building_id)}</select></label>
          <label>Nombre<input type="text" id="nd-name" value="${escapeHtml(s.name)}" /></label>
          <label>Lat (opc.)<input type="text" id="nd-lat" value="${s.lat != null ? s.lat : ""}" /></label>
          <label>Lng (opc.)<input type="text" id="nd-lng" value="${s.lng != null ? s.lng : ""}" /></label>
          <label>Notas<textarea id="nd-notes">${escapeHtml(s.notes || "")}</textarea></label>
          <div class="toolbar-row">
            <button type="button" class="btn-sm btn-primary" id="nd-save-site">Guardar</button>
            <button type="button" class="btn-sm" id="nd-del-site" style="border-color:#b91c1c;color:#fca5a5">Borrar site</button>
          </div>
        </div>`;
      document.getElementById("nd-save-site").onclick = async () => {
        try {
          const bid = document.getElementById("nd-building-id").value;
          await api("PUT", "sites", {
            id,
            building_id: bid === "" ? null : parseInt(bid, 10),
            name: document.getElementById("nd-name").value,
            lat: document.getElementById("nd-lat").value || null,
            lng: document.getElementById("nd-lng").value || null,
            notes: document.getElementById("nd-notes").value,
          });
          await loadHierarchy();
        } catch (e) {
          alert(e.message);
        }
      };
      document.getElementById("nd-del-site").onclick = async () => {
        if (!confirm("¿Borrar site y todo lo que cuelga (OLT, PON…)?")) return;
        try {
          await api("DELETE", "sites", null, id);
          netSelection = null;
          await loadHierarchy();
          renderNetDetail();
        } catch (e) {
          alert(e.message);
        }
      };
    }
    if (type === "olt") {
      const x = findOlt(id);
      if (!x) return;
      title.textContent = "OLT";
      box.innerHTML = `
        <div class="form-grid">
          <label>Nombre<input type="text" id="nd-name" value="${escapeHtml(x.olt.name)}" /></label>
          <label>Notas<textarea id="nd-notes">${escapeHtml(x.olt.notes || "")}</textarea></label>
          <div class="toolbar-row">
            <button type="button" class="btn-sm btn-primary" id="nd-save">Guardar</button>
            <button type="button" class="btn-sm" id="nd-del" style="border-color:#b91c1c">Borrar OLT</button>
          </div>
        </div>`;
      document.getElementById("nd-save").onclick = async () => {
        try {
          await api("PUT", "olts", {
            id,
            site_id: x.site.id,
            name: document.getElementById("nd-name").value,
            notes: document.getElementById("nd-notes").value,
          });
          await loadHierarchy();
        } catch (e) {
          alert(e.message);
        }
      };
      document.getElementById("nd-del").onclick = async () => {
        if (!confirm("¿Borrar OLT y tarjetas/PON?")) return;
        try {
          await api("DELETE", "olts", null, id);
          netSelection = null;
          await loadHierarchy();
          renderNetDetail();
        } catch (e) {
          alert(e.message);
        }
      };
    }
    if (type === "card") {
      const x = findCard(id);
      if (!x) return;
      title.textContent = "Tarjeta OLT";
      box.innerHTML = `
        <div class="form-grid">
          <label>Etiqueta (ej. Tarjeta 1)<input type="text" id="nd-label" value="${escapeHtml(x.card.label)}" /></label>
          <label>Orden<input type="number" id="nd-ord" value="${x.card.sort_order || 0}" /></label>
          <label>Notas<textarea id="nd-notes">${escapeHtml(x.card.notes || "")}</textarea></label>
          <div class="toolbar-row">
            <button type="button" class="btn-sm btn-primary" id="nd-save">Guardar</button>
            <button type="button" class="btn-sm" id="nd-del" style="border-color:#b91c1c">Borrar tarjeta</button>
          </div>
        </div>`;
      document.getElementById("nd-save").onclick = async () => {
        try {
          await api("PUT", "olt_cards", {
            id,
            olt_id: x.olt.id,
            label: document.getElementById("nd-label").value,
            sort_order: parseInt(document.getElementById("nd-ord").value, 10) || 0,
            notes: document.getElementById("nd-notes").value,
          });
          await loadHierarchy();
        } catch (e) {
          alert(e.message);
        }
      };
      document.getElementById("nd-del").onclick = async () => {
        if (!confirm("¿Borrar tarjeta y sus PON?")) return;
        try {
          await api("DELETE", "olt_cards", null, id);
          netSelection = null;
          await loadHierarchy();
          renderNetDetail();
        } catch (e) {
          alert(e.message);
        }
      };
    }
    if (type === "pon") {
      loadPonDetail(id);
    }
  }

  async function loadPonDetail(ponId) {
    const x = findPon(ponId);
    const title = document.getElementById("net-detail-title");
    const box = document.getElementById("network-detail");
    if (!x) return;
    title.textContent = "PON y potencias";
    try {
      const r2 = await fetch(`${API}?resource=pon_power_readings&pon_id=${ponId}`);
      const j = await r2.json();
      powerListCache = j.ok ? j.data : [];
    } catch {
      powerListCache = [];
    }
    let rows = "";
    powerListCache.forEach((r) => {
      rows += `<tr><td>${escapeHtml(r.stage_name)}</td><td>${r.dbm != null ? r.dbm : "—"}</td>
        <td>${r.mufa_id ? "mufa #" + r.mufa_id : "—"}</td>
        <td><button type="button" class="btn-sm" data-del-pow="${r.id}">✕</button></td></tr>`;
    });
    const crumb = [
      x.building ? x.building.name : null,
      x.site.name,
      x.olt.name,
      x.card.label,
    ]
      .filter(Boolean)
      .map((t) => escapeHtml(t))
      .join(" → ");
    box.innerHTML = `
      <p class="sub">${crumb}</p>
      <div class="form-grid">
        <label>Nº PON<input type="number" id="nd-ponn" value="${x.pon.pon_number}" /></label>
        <label>Etiqueta<input type="text" id="nd-plab" value="${escapeHtml(x.pon.label || "")}" /></label>
        <label>Notas<textarea id="nd-pnotes">${escapeHtml(x.pon.notes || "")}</textarea></label>
        <div class="toolbar-row">
          <button type="button" class="btn-sm btn-primary" id="nd-save-pon">Guardar PON</button>
        </div>
      </div>
      <h3 class="panel-title" style="margin-top:1rem;font-size:0.95rem">Lecturas de potencia (dBm)</h3>
      <p class="sub">Tramos: en OLT, tras splitter, en mufa, etc.</p>
      <table class="power-table"><thead><tr><th>Etapa</th><th>dBm</th><th>Mufa ref.</th><th></th></tr></thead>
      <tbody>${rows || "<tr><td colspan=4>Sin lecturas</td></tr>"}</tbody></table>
      <div class="form-grid" style="margin-top:0.75rem">
        <label>Nueva etapa (nombre)<input type="text" id="pw-stage" placeholder="Ej. Tras splitter 1:8" /></label>
        <label>dBm<input type="text" id="pw-dbm" placeholder="-18.5" /></label>
        <label>Mufa (opcional)<select id="pw-mufa"><option value="">—</option></select></label>
        <label>Nota<input type="text" id="pw-note" /></label>
        <button type="button" class="btn-sm btn-primary" id="pw-add">Añadir lectura</button>
      </div>`;
    const msel = document.getElementById("pw-mufa");
    cache.mufas.forEach((m) => {
      msel.innerHTML += `<option value="${m.id}">${escapeHtml(m.name || "#" + m.id)}</option>`;
    });
    document.getElementById("nd-save-pon").onclick = async () => {
      try {
        await api("PUT", "pons", {
          id: ponId,
          olt_card_id: x.card.id,
          pon_number: parseInt(document.getElementById("nd-ponn").value, 10) || 1,
          label: document.getElementById("nd-plab").value,
          notes: document.getElementById("nd-pnotes").value,
        });
        await loadHierarchy();
      } catch (e) {
        alert(e.message);
      }
    };
    document.getElementById("pw-add").onclick = async () => {
      try {
        await api("POST", "pon_power_readings", {
          pon_id: ponId,
          mufa_id: document.getElementById("pw-mufa").value || null,
          stage_name: document.getElementById("pw-stage").value,
          dbm: document.getElementById("pw-dbm").value,
          notes: document.getElementById("pw-note").value,
          sort_order: powerListCache.length,
        });
        await loadPonDetail(ponId);
        await loadHierarchy();
      } catch (e) {
        alert(e.message);
      }
    };
    box.querySelectorAll("[data-del-pow]").forEach((b) => {
      b.onclick = async () => {
        if (!confirm("¿Borrar lectura?")) return;
        try {
          await api("DELETE", "pon_power_readings", null, Number(b.dataset.delPow));
          await loadPonDetail(ponId);
        } catch (e) {
          alert(e.message);
        }
      };
    });
  }

  /* ---------- Presupuesto ---------- */
  let budgetProjectId = null;

  async function loadBudgetData() {
    try {
      const [cat, proj] = await Promise.all([
        api("GET", "price_catalog"),
        api("GET", "budget_projects"),
      ]);
      renderCatalog(cat.data || []);
      const sel = document.getElementById("budget-project-select");
      const old = budgetProjectId;
      sel.innerHTML = '<option value="">— Elegir proyecto —</option>';
      (proj.data || []).forEach((p) => {
        sel.innerHTML += `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
      });
      if (old) sel.value = String(old);
      sel.onchange = () => {
        budgetProjectId = sel.value ? Number(sel.value) : null;
        loadLines();
      };
      if (budgetProjectId) await loadLines();
    } catch (e) {
      console.error(e);
    }
  }

  function renderCatalog(rows) {
    const el = document.getElementById("catalog-list");
    let h =
      '<table class="data-table"><thead><tr><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Unidad</th><th></th></tr></thead><tbody>';
    rows.forEach((r) => {
      h += `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.category)}</td>
        <td>${Number(r.unit_price).toFixed(2)}</td><td>${escapeHtml(r.unit_label)}</td>
        <td><button type="button" class="btn-sm" data-del-cat="${r.id}">✕</button></td></tr>`;
    });
    h += "</tbody></table>";
    el.innerHTML = h || "<p class=sub>Vacío</p>";
    el.querySelectorAll("[data-del-cat]").forEach((b) => {
      b.onclick = async () => {
        try {
          await api("DELETE", "price_catalog", null, Number(b.dataset.delCat));
          loadBudgetData();
        } catch (e) {
          alert(e.message);
        }
      };
    });
  }

  async function loadLines() {
    const el = document.getElementById("lines-list");
    const tot = document.getElementById("project-total");
    if (!budgetProjectId) {
      el.innerHTML = "";
      tot.textContent = "Total: 0,00 €";
      return;
    }
    try {
      const url = `${API}?resource=budget_lines&project_id=${budgetProjectId}`;
      const r = await fetch(url);
      const j = await r.json();
      const lines = j.ok ? j.data : [];
      let sum = 0;
      let h =
        '<table class="data-table"><thead><tr><th>Concepto</th><th>Cat.</th><th>Cant.</th><th>P.unit</th><th>Total</th><th></th></tr></thead><tbody>';
      lines.forEach((ln) => {
        sum += ln.line_total || 0;
        h += `<tr><td>${escapeHtml(ln.description)}</td><td>${escapeHtml(ln.category)}</td>
          <td>${ln.qty}</td><td>${Number(ln.unit_price).toFixed(2)}</td>
          <td>${Number(ln.line_total).toFixed(2)}</td>
          <td><button type="button" class="btn-sm" data-del-line="${ln.id}">✕</button></td></tr>`;
      });
      h += "</tbody></table>";
      el.innerHTML = h;
      tot.textContent = `Total: ${sum.toFixed(2)} €`;
      el.querySelectorAll("[data-del-line]").forEach((b) => {
        b.onclick = async () => {
          try {
            await api("DELETE", "budget_lines", null, Number(b.dataset.delLine));
            loadLines();
          } catch (e) {
            alert(e.message);
          }
        };
      });
    } catch (e) {
      alert(e.message);
    }
  }

  document.getElementById("form-catalog").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      await api("POST", "price_catalog", {
        name: document.getElementById("cat-name").value,
        category: document.getElementById("cat-category").value,
        unit_price: parseFloat(document.getElementById("cat-price").value),
        unit_label: document.getElementById("cat-unit").value || "ud",
        notes: "",
      });
      ev.target.reset();
      document.getElementById("cat-unit").value = "ud";
      loadBudgetData();
    } catch (e) {
      alert(e.message);
    }
  });

  document.getElementById("form-project").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      const res = await api("POST", "budget_projects", {
        name: document.getElementById("proj-name").value,
        notes: "",
      });
      document.getElementById("proj-name").value = "";
      await loadBudgetData();
      budgetProjectId = res.id;
      document.getElementById("budget-project-select").value = String(res.id);
      loadLines();
    } catch (e) {
      alert(e.message);
    }
  });

  document.getElementById("form-line").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!budgetProjectId) {
      alert("Elige un proyecto.");
      return;
    }
    try {
      await api("POST", "budget_lines", {
        project_id: budgetProjectId,
        description: document.getElementById("line-desc").value,
        category: document.getElementById("line-cat").value,
        qty: parseFloat(document.getElementById("line-qty").value) || 1,
        unit_price: parseFloat(document.getElementById("line-price").value),
      });
      ev.target.reset();
      document.getElementById("line-qty").value = "1";
      loadLines();
    } catch (e) {
      alert(e.message);
    }
  });

  /* ---------- Mapa (existente ampliado) ---------- */
  function renderMarker(type, row) {
    const id = row.id;
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    const icon = type === "mufas" ? iconMufa : iconTerminal;
    const key = `${type}-${id}`;
    if (state.markers.has(key)) {
      state.markers.get(key).setLatLng([lat, lng]);
      return;
    }
    const m = L.marker([lat, lng], { icon }).addTo(type === "mufas" ? state.mufaLayer : state.terminalLayer);
    m.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      selectItem(type, id);
      openModalFromRow(type, row);
    });
    state.markers.set(key, m);
  }

  function renderCable(row) {
    const id = row.id;
    const path = row.path || [];
    const key = `cables-${id}`;
    const latlngs = path.map((p) => L.latLng(p[0], p[1]));
    const color = row.color || "#2563eb";
    if (state.cables.has(key)) {
      const pl = state.cables.get(key);
      pl.setLatLngs(latlngs);
      pl.setStyle({ color });
      return;
    }
    const pl = L.polyline(latlngs, { color, weight: 4, opacity: 0.85 }).addTo(state.cableLayer);
    pl.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      selectItem("cables", id);
      openModalFromRow("cables", row);
    });
    state.cables.set(key, pl);
  }

  function removeMarker(type, id) {
    const key = `${type}-${id}`;
    const m = state.markers.get(key);
    if (m) {
      state.map.removeLayer(m);
      state.markers.delete(key);
    }
  }

  function removeCable(id) {
    const key = `cables-${id}`;
    const pl = state.cables.get(key);
    if (pl) {
      state.map.removeLayer(pl);
      state.cables.delete(key);
    }
  }

  function selectItem(type, id) {
    state.selectedType = type;
    state.selectedId = id;
    document.querySelectorAll(".item").forEach((el) => {
      el.classList.toggle("selected", el.dataset.type === type && Number(el.dataset.id) === id);
    });
  }

  let cache = { mufas: [], terminals: [], cables: [] };

  async function loadAll() {
    setStatus("Cargando…");
    try {
      const [mufas, terminals, cables] = await Promise.all([
        api("GET", "mufas"),
        api("GET", "terminals"),
        api("GET", "cables"),
      ]);
      cache.mufas = mufas.data;
      cache.terminals = terminals.data;
      cache.cables = cables.data;

      state.markers.forEach((m) => state.map.removeLayer(m));
      state.markers.clear();
      state.cables.forEach((pl) => state.map.removeLayer(pl));
      state.cables.clear();

      cache.mufas.forEach((r) => renderMarker("mufas", r));
      cache.terminals.forEach((r) => renderMarker("terminals", r));
      cache.cables.forEach((r) => renderCable(r));

      renderLists();
      fillSiteAndPonSelects();
      fitBounds();
      setStatus("Listo.");
    } catch (e) {
      console.error(e);
      setStatus("Error: " + e.message);
    }
  }

  function fitBounds() {
    const layers = L.featureGroup([state.mufaLayer, state.terminalLayer, state.cableLayer]);
    if (layers.getLayers().length === 0) {
      state.map.setView([40.4168, -3.7038], 6);
      return;
    }
    const b = layers.getBounds();
    if (b.isValid()) state.map.fitBounds(b.pad(0.15));
  }

  function renderLists() {
    const el = document.getElementById("lists");
    const block = (title, type, rows, emptyMsg) => {
      let h = `<h2>${title}</h2>`;
      if (!rows.length) h += `<p class="sub" style="margin:0 0 .5rem">${emptyMsg}</p>`;
      rows.forEach((r) => {
        let meta =
          type === "cables"
            ? `${(r.path || []).length} pts · ${r.fiber_count} fibras`
            : `${Number(r.lat).toFixed(5)}, ${Number(r.lng).toFixed(5)}`;
        if (type === "cables" && (r.manga_label || r.splice_count)) {
          meta += ` · ${escapeHtml(r.manga_label || "")}${r.splice_count ? " · " + r.splice_count + " empalmes" : ""}`;
        }
        const fiberBtn =
          type === "cables"
            ? `<button type="button" data-act="fibers">Fibras</button>`
            : "";
        h += `<div class="item" data-type="${type}" data-id="${r.id}">
          <div>
            <div class="title">${escapeHtml(r.name || "(sin nombre)")}</div>
            <div class="meta">${meta}</div>
          </div>
          <div class="actions">
            <button type="button" data-act="fly">Ver</button>
            <button type="button" data-act="edit">Editar</button>
            ${fiberBtn}
            <button type="button" data-act="del" class="del">Borrar</button>
          </div>
        </div>`;
      });
      return h;
    };
    el.innerHTML =
      block("Mufas", "mufas", cache.mufas, "Ninguna mufa aún.") +
      block("Terminales", "terminals", cache.terminals, "Ningún terminal aún.") +
      block("Cables", "cables", cache.cables, "Ningún cable aún.");

    el.querySelectorAll(".item").forEach((node) => {
      node.addEventListener("click", (ev) => {
        const btn = ev.target.closest("button");
        const type = node.dataset.type;
        const id = Number(node.dataset.id);
        const row = findRow(type, id);
        if (!row) return;
        if (!btn) {
          selectItem(type, id);
          return;
        }
        const act = btn.dataset.act;
        if (act === "fly") {
          selectItem(type, id);
          if (type === "cables") {
            const path = row.path || [];
            if (path.length) flyTo(path[0][0], path[0][1]);
          } else flyTo(Number(row.lat), Number(row.lng));
        }
        if (act === "edit") {
          selectItem(type, id);
          openModalFromRow(type, row);
        }
        if (act === "fibers") {
          selectItem(type, id);
          openFiberModal(row);
        }
        if (act === "del") {
          if (!confirm("¿Borrar este elemento?")) return;
          deleteItem(type, id);
        }
      });
    });
  }

  function findRow(type, id) {
    const list = type === "mufas" ? cache.mufas : type === "terminals" ? cache.terminals : cache.cables;
    return list.find((x) => x.id === id);
  }

  async function deleteItem(type, id) {
    try {
      await api("DELETE", type, null, id);
      if (type === "cables") removeCable(id);
      else removeMarker(type, id);
      await loadAll();
    } catch (e) {
      alert(e.message);
    }
  }

  const backdrop = document.getElementById("modal-backdrop");
  const form = document.getElementById("modal-form");

  function showModal(show) {
    backdrop.classList.toggle("open", show);
    backdrop.setAttribute("aria-hidden", show ? "false" : "true");
  }

  async function openModalFromRow(type, row) {
    await loadHierarchy();
    document.getElementById("modal-title").textContent =
      type === "mufas" ? "Mufa" : type === "terminals" ? "Terminal" : "Cable";
    document.getElementById("f-type").value = type;
    document.getElementById("f-id").value = row.id != null ? row.id : "";
    document.getElementById("f-name").value = row.name || "";
    document.getElementById("f-notes").value = row.notes || "";

    document.getElementById("f-mufa-extra").style.display = type === "mufas" ? "block" : "none";
    document.getElementById("f-terminal-extra").style.display = type === "terminals" ? "block" : "none";
    document.getElementById("f-cable-extra").style.display = type === "cables" ? "block" : "none";
    document.getElementById("f-latlng-row").style.display = type === "cables" ? "none" : "grid";
    document.getElementById("btn-fiber-map").style.display = type === "cables" && row.id ? "inline-block" : "none";

    if (type === "mufas") {
      document.getElementById("f-lat").value = row.lat != null ? row.lat : "";
      document.getElementById("f-lng").value = row.lng != null ? row.lng : "";
      document.getElementById("f-model").value = row.model || "";
      document.getElementById("f-splice").value = row.splice_count ?? 0;
      document.getElementById("f-site-id").value = row.site_id != null ? row.site_id : "";
      document.getElementById("f-linked-pon-id").value = row.linked_pon_id != null ? row.linked_pon_id : "";
    }
    if (type === "terminals") {
      document.getElementById("f-lat").value = row.lat != null ? row.lat : "";
      document.getElementById("f-lng").value = row.lng != null ? row.lng : "";
      document.getElementById("f-ports").value = row.port_count ?? 8;
    }
    if (type === "cables") {
      document.getElementById("f-fibers").value = row.fiber_count ?? 12;
      document.getElementById("f-color").value = row.color || "#2563eb";
      document.getElementById("f-manga").value = row.manga_label || "";
      document.getElementById("f-splice-cable").value = row.splice_count ?? 0;
    }

    state.pendingPoint = null;
    showModal(true);
  }

  async function openNewAtPoint(type, lat, lng) {
    await openModalFromRow(type, {
      name: type === "mufas" ? "Mufa" : "Terminal",
      lat,
      lng,
      model: "",
      splice_count: 0,
      port_count: 8,
      notes: "",
      site_id: null,
      linked_pon_id: null,
    });
    document.getElementById("f-id").value = "";
  }

  function openNewCable(path) {
    document.getElementById("modal-title").textContent = "Nuevo cable / manga";
    document.getElementById("f-type").value = "cables";
    document.getElementById("f-id").value = "";
    document.getElementById("f-name").value = "Manga";
    document.getElementById("f-notes").value = "";
    document.getElementById("f-fibers").value = 12;
    document.getElementById("f-color").value = "#2563eb";
    document.getElementById("f-manga").value = "";
    document.getElementById("f-splice-cable").value = 0;
    document.getElementById("f-mufa-extra").style.display = "none";
    document.getElementById("f-terminal-extra").style.display = "none";
    document.getElementById("f-cable-extra").style.display = "block";
    document.getElementById("f-latlng-row").style.display = "none";
    document.getElementById("btn-fiber-map").style.display = "none";
    state.pendingPoint = { path };
    showModal(true);
  }

  document.querySelectorAll("#fiber-presets button").forEach((b) => {
    b.addEventListener("click", () => {
      document.getElementById("f-fibers").value = b.dataset.fibers;
    });
  });

  document.getElementById("btn-fiber-map").addEventListener("click", () => {
    const id = document.getElementById("f-id").value;
    if (!id) return;
    const row = findRow("cables", Number(id));
    if (row) openFiberModal(row);
  });

  function openFiberModal(row) {
    fiberModal.cableId = row.id;
    fiberModal.map = normalizeFiberMap(row.fiber_map);
    fiberModal.editingIndex = null;
    document.getElementById("fiber-modal-title").textContent =
      "Pelos · " + (row.name || "Cable #" + row.id);
    renderFiberGrid(row.fiber_count || 12);
    document.getElementById("fiber-editor").hidden = true;
    document.getElementById("fiber-modal-backdrop").classList.add("open");
    document.getElementById("fiber-modal-backdrop").setAttribute("aria-hidden", "false");
  }

  function renderFiberGrid(n) {
    const grid = document.getElementById("fiber-grid");
    grid.innerHTML = "";
    const count = Math.max(1, Math.min(288, parseInt(String(n), 10) || 12));
    for (let i = 1; i <= count; i++) {
      const c = fiberColor(i);
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "fiber-dot" + (isLightHex(c) ? "" : " light-fg");
      dot.style.background = c;
      dot.textContent = i;
      const entry = fiberModal.map[String(i)];
      if (entry && (entry.target || entry.note)) dot.classList.add("linked");
      dot.title = entry && entry.note ? entry.note : "Pelo " + i;
      dot.addEventListener("click", () => openFiberEditor(i));
      grid.appendChild(dot);
    }
  }

  function openFiberEditor(i) {
    fiberModal.editingIndex = i;
    document.getElementById("fiber-ed-index").textContent = String(i);
    const entry = fiberModal.map[String(i)] || { target: "", note: "" };
    const sel = document.getElementById("fiber-ed-target");
    fillFiberTargetSelect(sel);
    sel.value = entry.target || "";
    document.getElementById("fiber-ed-note").value = entry.note || "";
    document.getElementById("fiber-editor").hidden = false;
  }

  document.getElementById("fiber-ed-cancel").addEventListener("click", () => {
    document.getElementById("fiber-editor").hidden = true;
  });
  document.getElementById("fiber-ed-save").addEventListener("click", () => {
    const i = fiberModal.editingIndex;
    if (!i) return;
    fiberModal.map[String(i)] = {
      target: document.getElementById("fiber-ed-target").value,
      note: document.getElementById("fiber-ed-note").value,
    };
    const row = findRow("cables", fiberModal.cableId);
    renderFiberGrid(row ? row.fiber_count : 12);
    document.getElementById("fiber-editor").hidden = true;
  });

  document.getElementById("fiber-modal-close").addEventListener("click", () => {
    document.getElementById("fiber-modal-backdrop").classList.remove("open");
    document.getElementById("fiber-modal-backdrop").setAttribute("aria-hidden", "true");
  });

  document.getElementById("fiber-modal-save").addEventListener("click", async () => {
    const id = fiberModal.cableId;
    const row = findRow("cables", id);
    if (!row) return;
    try {
      await api("PUT", "cables", {
        id,
        name: row.name,
        fiber_count: row.fiber_count,
        color: row.color,
        notes: row.notes,
        splice_count: row.splice_count || 0,
        manga_label: row.manga_label || "",
        path: row.path,
        fiber_map: fiberModal.map,
      });
      document.getElementById("fiber-modal-backdrop").classList.remove("open");
      await loadAll();
    } catch (e) {
      alert(e.message);
    }
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const type = document.getElementById("f-type").value;
    const idStr = document.getElementById("f-id").value;
    const id = idStr ? Number(idStr) : 0;

    try {
      if (type === "mufas") {
        const sid = document.getElementById("f-site-id").value;
        const pid = document.getElementById("f-linked-pon-id").value;
        const body = {
          id,
          name: document.getElementById("f-name").value,
          lat: parseFloat(document.getElementById("f-lat").value),
          lng: parseFloat(document.getElementById("f-lng").value),
          model: document.getElementById("f-model").value,
          splice_count: parseInt(document.getElementById("f-splice").value, 10) || 0,
          notes: document.getElementById("f-notes").value,
          site_id: sid ? parseInt(sid, 10) : null,
          linked_pon_id: pid ? parseInt(pid, 10) : null,
        };
        if (id) await api("PUT", "mufas", body);
        else await api("POST", "mufas", body);
      } else if (type === "terminals") {
        const body = {
          id,
          name: document.getElementById("f-name").value,
          lat: parseFloat(document.getElementById("f-lat").value),
          lng: parseFloat(document.getElementById("f-lng").value),
          port_count: parseInt(document.getElementById("f-ports").value, 10) || 8,
          notes: document.getElementById("f-notes").value,
        };
        if (id) await api("PUT", "terminals", body);
        else await api("POST", "terminals", body);
      } else if (type === "cables") {
        const path = state.pendingPoint && state.pendingPoint.path ? state.pendingPoint.path : null;
        const fiberMap = normalizeFiberMap(
          id ? (findRow("cables", id) && findRow("cables", id).fiber_map) || {} : {}
        );
        const body = {
          id,
          name: document.getElementById("f-name").value,
          fiber_count: parseInt(document.getElementById("f-fibers").value, 10) || 12,
          color: document.getElementById("f-color").value,
          notes: document.getElementById("f-notes").value,
          splice_count: parseInt(document.getElementById("f-splice-cable").value, 10) || 0,
          manga_label: document.getElementById("f-manga").value,
          fiber_map: fiberMap,
        };
        if (path) body.path = path;
        else {
          const existing = findRow("cables", id);
          if (existing && existing.path) body.path = existing.path;
        }
        if (id) {
          const ex = findRow("cables", id);
          if (ex && ex.fiber_map) body.fiber_map = normalizeFiberMap(ex.fiber_map);
          if (!body.path || body.path.length < 2) {
            if (ex && ex.path) body.path = ex.path;
          }
          await api("PUT", "cables", body);
        } else {
          if (!body.path || body.path.length < 2) {
            alert("Falta trazado del cable.");
            return;
          }
          await api("POST", "cables", body);
        }
      }
      showModal(false);
      clearCableDraft(true);
      setMode("");
      await loadAll();
    } catch (e) {
      alert(e.message);
    }
  });

  document.getElementById("modal-cancel").addEventListener("click", () => {
    showModal(false);
    state.pendingPoint = null;
  });
  backdrop.addEventListener("click", (ev) => {
    if (ev.target === backdrop) {
      showModal(false);
      state.pendingPoint = null;
    }
  });

  function initMap() {
    state.map = L.map("map", { preferCanvas: true }).setView([40.4168, -3.7038], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(state.map);

    state.mufaLayer = L.layerGroup().addTo(state.map);
    state.terminalLayer = L.layerGroup().addTo(state.map);
    state.cableLayer = L.layerGroup().addTo(state.map);

    state.map.on("click", async (e) => {
      if (state.mode === "mufa") {
        await openNewAtPoint("mufas", e.latlng.lat, e.latlng.lng);
      } else if (state.mode === "terminal") {
        await openNewAtPoint("terminals", e.latlng.lat, e.latlng.lng);
      } else if (state.mode === "cable") {
        state.cableDraft.push([e.latlng.lat, e.latlng.lng]);
        if (state.cableDraftLine) {
          state.cableDraftLine.setLatLngs(state.cableDraft.map((p) => L.latLng(p[0], p[1])));
        } else {
          state.cableDraftLine = L.polyline(
            state.cableDraft.map((p) => L.latLng(p[0], p[1])),
            { color: "#94a3b8", dashArray: "6 6", weight: 3 }
          ).addTo(state.map);
        }
        document.getElementById("cable-finish").disabled = state.cableDraft.length < 2;
        document.getElementById("cable-cancel").disabled = state.cableDraft.length === 0;
      }
    });
  }

  document.getElementById("mode-none").addEventListener("click", () => setMode(""));
  document.getElementById("mode-mufa").addEventListener("click", () => setMode("mufa"));
  document.getElementById("mode-terminal").addEventListener("click", () => setMode("terminal"));
  document.getElementById("mode-cable").addEventListener("click", () => {
    setMode("cable");
    clearCableDraft(false);
  });

  document.getElementById("cable-finish").addEventListener("click", () => {
    if (state.cableDraft.length < 2) return;
    const path = state.cableDraft.map((p) => [p[0], p[1]]);
    openNewCable(path);
  });

  document.getElementById("cable-cancel").addEventListener("click", () => {
    clearCableDraft(true);
    document.getElementById("cable-finish").disabled = true;
    document.getElementById("cable-cancel").disabled = true;
    setStatus("Trazado cancelado.");
  });

  initMap();
  loadAll();
})();
