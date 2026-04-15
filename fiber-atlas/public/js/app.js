(function () {
  "use strict";

  const GOOGLE_MAPS_KEY_STORAGE = "fiber-atlas-google-maps-key";

  /* Clave Google del panel (localStorage): hidratar window al arrancar para que el fondo Google
     se active al recargar aunque index.html deje la variable vacía. */
  try {
    if (typeof window !== "undefined") {
      const g = localStorage.getItem(GOOGLE_MAPS_KEY_STORAGE);
      const gOk = g && String(g).trim();
      const wG =
        window.FIBER_ATLAS_GOOGLE_MAPS_KEY != null
          ? String(window.FIBER_ATLAS_GOOGLE_MAPS_KEY).trim()
          : "";
      if (gOk && !wG) window.FIBER_ATLAS_GOOGLE_MAPS_KEY = gOk;
    }
  } catch (_) {}

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

  const TIA_PELO_NAMES = [
    "",
    "Azul",
    "Naranja",
    "Verde",
    "Marrón",
    "Pizarra",
    "Blanco",
    "Rojo",
    "Negro",
    "Amarillo",
    "Violeta",
    "Rosa",
    "Aguamarina",
  ];

  const state = {
    map: null,
    mode: "",
    mufaLayer: null,
    terminalLayer: null,
    cableLayer: null,
    buildingLayer: null,
    /** id → L.Marker (edificios con GPS; no mezclar con state.markers que loadAll vacía) */
    buildingMarkers: new Map(),
    cableDraft: [],
    cableDraftLine: null,
    markers: new Map(),
    cables: new Map(),
    selectedId: null,
    selectedType: null,
    pendingPoint: null,
    /** Site (cabecera) y edificio activo al colocar elementos desde el mapa */
    mapFieldContext: { siteId: null, buildingId: null },
    /** Al editar mufa/cable en modal, no bloquear su propio PON en el desplegable */
    modalPonExclude: null,
    /** Bucket de cabecera (site id o -1): unicidad PON solo dentro de este site */
    modalPonScopeKey: -1,
    /** Impresión mapa por zona: bounds = área tras 2 clics; pickingStep 1/2 = esperando esquinas */
    printZone: { bounds: null, pickingStep: 0, cornerA: null },
    /** Capa teselas activa (solo una base a la vez) */
    baseTileLayer: null,
    /** Mufa modal: lista editable de splitters antes de guardar */
    mufaSplittersDraft: [],
    mufaSplitterDlgIdx: null,
    /** Evita guardar vista del mapa antes del primer fitBounds (corría moveend con Madrid y bloqueaba el encuadre). */
    mapViewPersistenceEnabled: false,
  };

  let hierarchyCache = { buildings: [], orphan_sites: [] };
  let netSelection = null;
  let powerListCache = [];
  let fiberModal = { cableId: null, map: {}, editingIndex: null, fiberCount: 12 };

  function mufaMapFillHex(row) {
    if (!row || !Number(row.splitter_use_fiber_color)) return null;
    const spls = getMufaSplitters(row);
    const first = spls[0];
    if (first && first.input_fiber >= 1 && first.input_fiber <= 12) {
      return fiberColor(first.input_fiber);
    }
    let n = first ? first.source_pon_number : null;
    if ((n == null || n === "") && first && first.linked_pon_id) {
      const x = findPon(Number(first.linked_pon_id));
      if (x) n = x.pon.pon_number;
    }
    if ((n == null || n === "") && row.splitter_source_pon_number) {
      n = row.splitter_source_pon_number;
    }
    if ((n == null || n === "") && row.splitter_linked_pon_id) {
      const x = findPon(Number(row.splitter_linked_pon_id));
      if (x) n = x.pon.pon_number;
    }
    n = Number(n);
    if (!Number.isFinite(n) || n < 1) return null;
    return fiberColor(n);
  }

  function iconMufaFor(row) {
    const fill = mufaMapFillHex(row) || "#f59e0b";
    return L.divIcon({
      className: "fa-marker fa-mufa",
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${fill};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  }

  function iconTerminalFor(markerColor) {
    const hex =
      {
        green: "#22c55e",
        yellow: "#eab308",
        red: "#ef4444",
      }[markerColor] || "#22c55e";
    return L.divIcon({
      className: "fa-marker fa-terminal",
      html: `<div style="width:14px;height:14px;border-radius:3px;background:${hex};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  }

  const iconBuilding = L.icon({
    iconUrl: "img/icon-edificio.svg",
    iconSize: [44, 44],
    iconAnchor: [22, 40],
    popupAnchor: [0, -34],
    className: "fa-building-leaflet-icon",
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

  function syncFiberSpecCustomVisibility() {
    const sel = document.getElementById("f-fiber-spec");
    const wrap = document.getElementById("f-fiber-spec-custom-wrap");
    if (!sel || !wrap) return;
    wrap.hidden = sel.value !== "__custom__";
  }

  function getFiberSpecFromForm() {
    const sel = document.getElementById("f-fiber-spec");
    const custom = document.getElementById("f-fiber-spec-custom");
    if (!sel) return "";
    if (sel.value === "__custom__") {
      return custom ? custom.value.trim() : "";
    }
    return sel.value || "";
  }

  function setFiberSpecOnForm(spec) {
    const sel = document.getElementById("f-fiber-spec");
    const custom = document.getElementById("f-fiber-spec-custom");
    if (!sel || !custom) return;
    const s = spec != null ? String(spec).trim() : "";
    let matched = false;
    for (let oi = 0; oi < sel.options.length; oi++) {
      const opt = sel.options[oi];
      if (opt.value && opt.value !== "__custom__" && opt.value === s) {
        sel.value = opt.value;
        matched = true;
        break;
      }
    }
    if (!matched && s) {
      sel.value = "__custom__";
      custom.value = s;
    } else if (!matched) {
      sel.value = "";
      custom.value = "";
    } else {
      custom.value = "";
    }
    syncFiberSpecCustomVisibility();
  }

  function setStatus(t) {
    const el = document.getElementById("status");
    if (el) el.textContent = t;
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll(".tools button[data-mode]").forEach((btn) => {
      const dm = btn.getAttribute("data-mode");
      const same = mode === "" ? dm === "" : dm === mode;
      btn.classList.toggle("active", same);
    });
    const cable = mode === "cable";
    const fin = document.getElementById("cable-finish");
    const can = document.getElementById("cable-cancel");
    if (fin) fin.disabled = !cable || state.cableDraft.length < 2;
    if (can) can.disabled = !cable || state.cableDraft.length === 0;
    if (mode !== "cable") clearCableDraft(false);
    setStatus(
      mode === "org_building"
        ? "Edificio: clic en el mapa (casa, local, POP físico). Solo organización."
        : mode === "org_site"
          ? state.mapFieldContext.buildingId
            ? `Site: clic mapa. Edificio: ${findBuilding(state.mapFieldContext.buildingId)?.name || "?"}`
            : "Site: primero clic en «Edificio: …» en el árbol de red."
          : mode === "mufa"
            ? state.mapFieldContext.siteId
              ? `Mufa: clic mapa. Site: ${findSite(state.mapFieldContext.siteId)?.name || "?"}`
              : "Mufa: clic mapa. Elige site en árbol."
            : mode === "terminal"
              ? "Terminal: clic mapa."
              : mode === "cable"
                ? "Cable: clic en mapa o en mufa/terminal/cable para anclar vértices. Luego «Finalizar cable»."
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

  /** Modo cable: añade vértice desde mapa o desde marcador/polilínea (misma lógica). */
  function appendCableDraftVertex(lat, lng) {
    if (state.mode !== "cable" || !state.map) return;
    state.cableDraft.push([lat, lng]);
    if (state.cableDraftLine) {
      state.cableDraftLine.setLatLngs(state.cableDraft.map((p) => L.latLng(p[0], p[1])));
    } else if (state.cableDraft.length >= 2) {
      state.cableDraftLine = L.polyline(
        state.cableDraft.map((p) => L.latLng(p[0], p[1])),
        { color: "#94a3b8", dashArray: "6 6", weight: 3 }
      ).addTo(state.map);
    }
    const fin = document.getElementById("cable-finish");
    const can = document.getElementById("cable-cancel");
    if (fin) fin.disabled = state.cableDraft.length < 2;
    if (can) can.disabled = state.cableDraft.length === 0;
    setStatus(
      `Cable: ${state.cableDraft.length} punto(s). Clic en mapa, mufa, terminal o cable existente; luego «Finalizar cable».`
    );
  }

  async function api(method, resource, body, id, query) {
    let url = `${API}?resource=${encodeURIComponent(resource)}`;
    if (id != null) url += `&id=${encodeURIComponent(String(id))}`;
    if (query && typeof query === "object") {
      Object.keys(query).forEach((k) => {
        const v = query[k];
        if (v === null || v === undefined || v === "") return;
        url += `&${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`;
      });
    }
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

  /** Ciudad → false; coordenadas → { lat, lng } (ordena si parece lng,lat). */
  function parseLatLngFromSearch(raw) {
    const t = String(raw).trim();
    const pair = (a, b) => {
      let lat = a;
      let lng = b;
      if (Math.abs(lat) > 90 && Math.abs(b) <= 90) {
        lat = b;
        lng = a;
      }
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
      return null;
    };
    let m = t.match(/^(-?\d{1,3}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)$/);
    if (m) {
      const p = pair(parseFloat(m[1]), parseFloat(m[2]));
      if (p) return p;
    }
    m = t.match(/^(-?\d{1,3}(?:\.\d+)?)\s+(-?\d{1,3}(?:\.\d+)?)$/);
    if (m) {
      const p = pair(parseFloat(m[1]), parseFloat(m[2]));
      if (p) return p;
    }
    return null;
  }

  function initMapSearchControl(map) {
    const SearchControl = L.Control.extend({
      options: { position: "topleft" },
      onAdd() {
        const wrap = L.DomUtil.create("div", "leaflet-bar fa-map-search");
        const form = L.DomUtil.create("form", "fa-map-search-form", wrap);
        const input = L.DomUtil.create("input", "fa-map-search-input", form);
        input.type = "search";
        input.placeholder = "Ciudad o lat, lng";
        input.setAttribute("aria-label", "Buscar ciudad o coordenadas (latitud, longitud)");
        input.autocomplete = "off";
        const btn = L.DomUtil.create("button", "fa-map-search-btn", form);
        btn.type = "submit";
        btn.textContent = "Buscar";

        L.DomEvent.disableClickPropagation(wrap);
        L.DomEvent.disableScrollPropagation(wrap);
        L.DomEvent.on(form, "submit", L.DomEvent.stopPropagation);

        form.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const q = input.value.trim();
          if (!q) return;
          const parsed = parseLatLngFromSearch(q);
          if (parsed) {
            flyTo(parsed.lat, parsed.lng);
            setStatus(
              `Coordenadas: ${parsed.lat.toFixed(5)}, ${parsed.lng.toFixed(5)}`
            );
            return;
          }
          setStatus("Buscando lugar…");
          try {
            const url =
              "https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=0&q=" +
              encodeURIComponent(q);
            const res = await fetch(url, {
              headers: { "Accept-Language": "es,en" },
              referrerPolicy: "strict-origin-when-cross-origin",
            });
            if (!res.ok) throw new Error(res.statusText || String(res.status));
            const data = await res.json();
            if (!Array.isArray(data) || !data.length) {
              setStatus("Sin resultados para esa búsqueda.");
              return;
            }
            const top = data[0];
            const lat = parseFloat(top.lat);
            const lon = parseFloat(top.lon);
            if (top.boundingbox && top.boundingbox.length === 4) {
              const s = parseFloat(top.boundingbox[0]);
              const n = parseFloat(top.boundingbox[1]);
              const w = parseFloat(top.boundingbox[2]);
              const e = parseFloat(top.boundingbox[3]);
              map.fitBounds(
                [
                  [s, w],
                  [n, e],
                ],
                { maxZoom: 16, padding: [28, 28], animate: true }
              );
            } else {
              flyTo(lat, lon);
            }
            const label = (top.display_name || q).slice(0, 100);
            setStatus(label);
          } catch (err) {
            console.error(err);
            setStatus("No se pudo buscar (red o servicio). Intente de nuevo.");
          }
        });

        return wrap;
      },
    });
    new SearchControl().addTo(map);
  }

  const TREE_DEL_RESOURCE = {
    building: "buildings",
    site: "sites",
    olt: "olts",
    card: "olt_cards",
    pon: "pons",
  };

  const TREE_DEL_CONFIRM = {
    building: "¿Borrar edificio? Los sites quedarán sin edificio.",
    site: "¿Borrar site y todo lo que cuelga (OLT, PON…)?",
    olt: "¿Borrar OLT y tarjetas / PON asociados?",
    card: "¿Borrar tarjeta y sus PON?",
    pon: "¿Borrar este PON?",
  };

  /* ---------- Proyectos de mapa (árbol en barra izquierda; localStorage) ---------- */
  const MAP_PROJECTS_KEY = "FA_MAP_PROJECTS_V1";
  const ACTIVE_MAP_PROJECT_KEY = "FA_ACTIVE_MAP_PROJECT";
  const ACTIVE_MAP_SECTION_KEY = "FA_ACTIVE_MAP_SECTION";
  const MAP_PROJECT_EXPAND_KEY = "FA_MAP_PROJECT_EXPAND_V1";
  /** Si es "1", el mapa también muestra mufas/cables/… sin map_scope (datos antiguos). */
  const FA_MAP_INCLUDE_UNSCOPED_KEY = "FA_MAP_INCLUDE_UNSCOPED";
  /** Último centro y zoom del mapa (V2: V1 guardaba Madrid antes de cargar datos y bloqueaba fitBounds). */
  const FA_MAP_VIEW_KEY = "FA_MAP_LAST_VIEW_V2";

  function readStoredMapView() {
    try {
      const s = localStorage.getItem(FA_MAP_VIEW_KEY);
      if (!s) return null;
      const j = JSON.parse(s);
      const lat = Number(j.lat);
      const lng = Number(j.lng);
      const zoom = Number(j.zoom);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom)) return null;
      if (lat < -85 || lat > 85 || lng < -180 || lng > 180) return null;
      if (zoom < 1 || zoom > 22) return null;
      return { lat, lng, zoom };
    } catch {
      return null;
    }
  }

  function saveStoredMapView() {
    if (!state.map || !state.mapViewPersistenceEnabled) return;
    try {
      const c = state.map.getCenter();
      const z = state.map.getZoom();
      localStorage.setItem(FA_MAP_VIEW_KEY, JSON.stringify({ lat: c.lat, lng: c.lng, zoom: z }));
    } catch (_) {}
  }

  function applyStoredMapView() {
    const v = readStoredMapView();
    if (!v || !state.map) return false;
    state.map.setView([v.lat, v.lng], v.zoom, { animate: false });
    return true;
  }

  let projectWizardGate = false;

  function newMapEntityId() {
    return "m" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
  }

  function loadMapProjects() {
    try {
      const raw = localStorage.getItem(MAP_PROJECTS_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.filter(
        (p) =>
          p &&
          typeof p.id === "string" &&
          typeof p.name === "string" &&
          Array.isArray(p.sections)
      );
    } catch (_) {
      return [];
    }
  }

  function saveMapProjects(arr) {
    try {
      localStorage.setItem(MAP_PROJECTS_KEY, JSON.stringify(arr));
    } catch (_) {}
  }

  function loadExpandMap() {
    try {
      const o = JSON.parse(localStorage.getItem(MAP_PROJECT_EXPAND_KEY) || "{}");
      return o && typeof o === "object" ? o : {};
    } catch (_) {
      return {};
    }
  }

  function saveExpandMap(o) {
    try {
      localStorage.setItem(MAP_PROJECT_EXPAND_KEY, JSON.stringify(o));
    } catch (_) {}
  }

  function projectUiExpanded(pid) {
    const o = loadExpandMap();
    if (Object.prototype.hasOwnProperty.call(o, pid)) return !!o[pid];
    return true;
  }

  function setProjectUiExpanded(pid, v) {
    const o = loadExpandMap();
    o[pid] = v;
    saveExpandMap(o);
  }

  function getActiveProjectSection() {
    return {
      projectId: localStorage.getItem(ACTIVE_MAP_PROJECT_KEY) || "",
      sectionId: localStorage.getItem(ACTIVE_MAP_SECTION_KEY) || "",
    };
  }

  function setActiveProjectSection(projectId, sectionId) {
    try {
      localStorage.setItem(ACTIVE_MAP_PROJECT_KEY, projectId);
      localStorage.setItem(ACTIVE_MAP_SECTION_KEY, sectionId);
    } catch (_) {}
  }

  function ensureActiveProjectValid() {
    const projects = loadMapProjects();
    if (!projects.length) return;
    let { projectId, sectionId } = getActiveProjectSection();
    const p = projects.find((x) => x.id === projectId);
    if (!p || !p.sections.length) {
      const q = projects[0];
      setActiveProjectSection(q.id, q.sections[0].id);
      return;
    }
    if (!p.sections.some((s) => s.id === sectionId)) {
      setActiveProjectSection(projectId, p.sections[0].id);
    }
  }

  function getActiveMapScopeKey() {
    const { projectId, sectionId } = getActiveProjectSection();
    if (!projectId || !sectionId) return "";
    return `${projectId}|${sectionId}`;
  }

  function mapScopeQueryParams() {
    const key = getActiveMapScopeKey();
    if (!key) return {};
    const inc = localStorage.getItem(FA_MAP_INCLUDE_UNSCOPED_KEY) === "1";
    return { map_scope: key, include_unscoped: inc ? "1" : "0" };
  }

  function mapScopeForCreate() {
    const k = getActiveMapScopeKey();
    return k ? { map_scope: k } : {};
  }

  function mapScopeForPutRow(type, row) {
    if (row && row.map_scope != null && String(row.map_scope).trim() !== "") {
      return { map_scope: String(row.map_scope) };
    }
    return mapScopeForCreate();
  }

  function mapScopeForPutBuilding(bid) {
    const b = findBuilding(bid);
    if (b && b.map_scope != null && String(b.map_scope).trim() !== "") {
      return { map_scope: String(b.map_scope) };
    }
    return mapScopeForCreate();
  }

  function updateMapWorkContextBanner() {
    const wrap = document.getElementById("map-work-context-banner");
    const el = document.getElementById("map-work-context-text");
    if (!wrap || !el) return;
    const projects = loadMapProjects();
    if (!projects.length) {
      wrap.hidden = true;
      el.textContent = "";
      return;
    }
    ensureActiveProjectValid();
    const { projectId, sectionId } = getActiveProjectSection();
    const p = projects.find((x) => x.id === projectId);
    const s = p && p.sections.find((x) => x.id === sectionId);
    if (p && s) {
      el.textContent = `${p.name} → ${s.name}`;
      wrap.hidden = false;
    } else {
      wrap.hidden = true;
      el.textContent = "";
    }
  }

  function closeProjectWizard() {
    const bd = document.getElementById("modal-project-backdrop");
    if (!bd) return;
    bd.classList.remove("open");
    bd.setAttribute("aria-hidden", "true");
    projectWizardGate = false;
  }

  function openProjectWizard(opts) {
    opts = opts || {};
    const bd = document.getElementById("modal-project-backdrop");
    const title = document.getElementById("modal-project-wizard-title");
    const nameRow = document.getElementById("proj-wizard-project-fields");
    const nameIn = document.getElementById("proj-wizard-name");
    const secIn = document.getElementById("proj-wizard-section");
    const hid = document.getElementById("proj-wizard-add-section-for");
    const hint = document.getElementById("proj-wizard-hint");
    const cancel = document.getElementById("proj-wizard-cancel");
    const sub = document.getElementById("proj-wizard-submit");
    if (!bd || !nameRow || !hid || !secIn) return;
    projectWizardGate = !!opts.gate;
    if (nameIn) nameIn.value = "";
    secIn.value = "";
    if (opts.addSectionToProjectId) {
      hid.value = opts.addSectionToProjectId;
      nameRow.hidden = true;
      if (nameIn) nameIn.removeAttribute("required");
      const p = loadMapProjects().find((x) => x.id === opts.addSectionToProjectId);
      if (title) title.textContent = "Nueva sección";
      if (hint) hint.textContent = p ? `Dentro del proyecto «${p.name}».` : "";
      if (sub) sub.textContent = "Añadir sección";
      if (cancel) cancel.hidden = false;
    } else {
      hid.value = "";
      nameRow.hidden = false;
      if (nameIn) nameIn.setAttribute("required", "required");
      if (title) title.textContent = opts.gate ? "Primer proyecto de trabajo" : "Nuevo proyecto";
      if (hint)
        hint.textContent = opts.gate
          ? "Indique el nombre del proyecto y una sección interna (zona, nodo, tramo…). Son obligatorios antes de usar el mapa."
          : "Cada proyecto puede tener varias secciones. La primera queda activa al crear.";
      if (sub) sub.textContent = opts.gate ? "Crear y continuar" : "Crear proyecto";
      if (cancel) cancel.hidden = !!opts.gate;
    }
    bd.classList.add("open");
    bd.setAttribute("aria-hidden", "false");
    if (nameRow && !nameRow.hidden && nameIn) nameIn.focus();
    else secIn.focus();
  }

  function renderNavProjectTree() {
    const host = document.getElementById("nav-project-tree");
    if (!host) return;
    host.innerHTML = "";
    const projects = loadMapProjects();
    ensureActiveProjectValid();
    const { projectId: ap, sectionId: as } = getActiveProjectSection();
    projects.forEach((p) => {
      const exp = projectUiExpanded(p.id);
      const row = document.createElement("div");
      row.className = "nav-tree-project";
      const head = document.createElement("div");
      head.className = "nav-tree-project-head";
      const caret = document.createElement("span");
      caret.className = "nav-tree-caret";
      caret.setAttribute("role", "button");
      caret.tabIndex = 0;
      caret.textContent = exp ? "▼" : "▶";
      const title = document.createElement("span");
      title.className = "nav-tree-project-title";
      title.textContent = p.name;
      const addSec = document.createElement("button");
      addSec.type = "button";
      addSec.className = "nav-tree-add-section";
      addSec.textContent = "＋";
      addSec.title = "Nueva sección en este proyecto";
      addSec.addEventListener("click", (e) => {
        e.stopPropagation();
        openProjectWizard({ addSectionToProjectId: p.id });
      });
      const toggle = () => {
        setProjectUiExpanded(p.id, !projectUiExpanded(p.id));
        renderNavProjectTree();
      };
      caret.addEventListener("click", (e) => {
        e.stopPropagation();
        toggle();
      });
      caret.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
      title.addEventListener("click", () => toggle());
      head.append(caret, title, addSec);
      row.appendChild(head);
      const actions = document.createElement("div");
      actions.className = "nav-tree-project-actions";
      const btnDl = document.createElement("button");
      btnDl.type = "button";
      btnDl.className = "btn-sm nav-tree-action-dl";
      btnDl.textContent = "↓ Backup";
      btnDl.title = "Descargar JSON del mapa de este proyecto";
      btnDl.addEventListener("click", (e) => {
        e.stopPropagation();
        void downloadProjectBackup(p.id, p.name);
      });
      const btnDel = document.createElement("button");
      btnDel.type = "button";
      btnDel.className = "btn-sm nav-tree-action-del";
      btnDel.textContent = "Eliminar…";
      btnDel.title = "Eliminar proyecto (confirmación obligatoria)";
      btnDel.addEventListener("click", (e) => {
        e.stopPropagation();
        openDeleteProjectModal(p.id, p.name);
      });
      actions.append(btnDl, btnDel);
      row.appendChild(actions);
      const sections = document.createElement("div");
      sections.className = "nav-tree-sections";
      if (!exp) sections.hidden = true;
      p.sections.forEach((s) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "nav-tree-section" + (ap === p.id && as === s.id ? " active" : "");
        b.textContent = s.name;
        b.title = s.name;
        b.addEventListener("click", () => {
          setActiveProjectSection(p.id, s.id);
          switchTab("map");
          renderNavProjectTree();
          updateMapWorkContextBanner();
          void loadAll();
          void loadHierarchy();
        });
        sections.appendChild(b);
      });
      row.appendChild(sections);
      host.appendChild(row);
    });
  }

  const PHRASE_DELETE_PROJECT = "BORRAR PROYECTO";
  const PHRASE_IMPORT_PROJECT = "IMPORTAR PROYECTO";

  let delProjectState = null;
  let importPendingBundle = null;

  function removeProjectFromLocalList(projectId) {
    const projects = loadMapProjects().filter((p) => p.id !== projectId);
    saveMapProjects(projects);
    const ex = loadExpandMap();
    delete ex[projectId];
    saveExpandMap(ex);
    const { projectId: cur } = getActiveProjectSection();
    if (cur === projectId) {
      if (projects.length) {
        const q = projects[0];
        const sid = q.sections[0] && q.sections[0].id ? q.sections[0].id : "";
        setActiveProjectSection(q.id, sid);
      } else {
        try {
          localStorage.removeItem(ACTIVE_MAP_PROJECT_KEY);
          localStorage.removeItem(ACTIVE_MAP_SECTION_KEY);
        } catch (_) {}
        openProjectWizard({ gate: true });
      }
    }
  }

  function openDeleteProjectModal(projectId, projectName) {
    delProjectState = { id: projectId, name: projectName };
    const bd = document.getElementById("modal-del-project-backdrop");
    const warn = document.getElementById("modal-del-project-warn");
    const ph = document.getElementById("del-project-phrase");
    const cc = document.getElementById("del-project-confirm");
    const chk = document.getElementById("del-project-purge-server");
    const hint = document.getElementById("del-project-soft-hint");
    if (warn) {
      warn.innerHTML = `Va a quitar del menú el proyecto <strong>${escapeHtml(projectName || "")}</strong> y todas sus secciones. Si marca borrar en servidor, se eliminan del mapa las mufas, cables, terminales y edificios (GPS) ligados a este proyecto.`;
    }
    if (ph) ph.value = "";
    if (cc) cc.disabled = true;
    if (chk) chk.checked = true;
    if (hint) hint.hidden = true;
    if (bd) {
      bd.classList.add("open");
      bd.setAttribute("aria-hidden", "false");
    }
    if (ph) ph.focus();
  }

  function closeDeleteProjectModal() {
    delProjectState = null;
    const bd = document.getElementById("modal-del-project-backdrop");
    if (bd) {
      bd.classList.remove("open");
      bd.setAttribute("aria-hidden", "true");
    }
  }

  function syncDeleteProjectConfirmEnabled() {
    const ph = document.getElementById("del-project-phrase");
    const cc = document.getElementById("del-project-confirm");
    if (!ph || !cc) return;
    cc.disabled = ph.value.trim() !== PHRASE_DELETE_PROJECT;
  }

  function openImportProjectModal() {
    const bd = document.getElementById("modal-import-project-backdrop");
    const ph = document.getElementById("import-project-phrase");
    const cc = document.getElementById("import-project-confirm");
    if (ph) ph.value = "";
    if (cc) cc.disabled = true;
    if (bd) {
      bd.classList.add("open");
      bd.setAttribute("aria-hidden", "false");
    }
    if (ph) ph.focus();
  }

  function closeImportProjectModal() {
    importPendingBundle = null;
    const bd = document.getElementById("modal-import-project-backdrop");
    if (bd) {
      bd.classList.remove("open");
      bd.setAttribute("aria-hidden", "true");
    }
  }

  function syncImportProjectConfirmEnabled() {
    const ph = document.getElementById("import-project-phrase");
    const cc = document.getElementById("import-project-confirm");
    if (!ph || !cc) return;
    cc.disabled = ph.value.trim() !== PHRASE_IMPORT_PROJECT;
  }

  async function downloadProjectBackup(projectId, projectName) {
    try {
      const res = await api("GET", "map_project_bundle", null, null, { project_id: projectId });
      const ent = res.data || {};
      const proj = loadMapProjects().find((x) => x.id === projectId);
      const bundle = {
        version: 1,
        exportedAt: new Date().toISOString(),
        project: proj
          ? { id: proj.id, name: proj.name, sections: proj.sections }
          : { id: projectId, name: projectName || "Proyecto", sections: [] },
        entities: ent,
      };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe = String(projectName || "proyecto")
        .replace(/[^\w\-.]+/g, "_")
        .slice(0, 48);
      a.download = `fiber-atlas-proyecto-${safe}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Backup del proyecto descargado.");
    } catch (e) {
      alert(e.message || String(e));
    }
  }

  async function runImportProjectBundle(data) {
    const entities = data.entities || {};
    const oldProj = data.project;
    if (!oldProj || !Array.isArray(oldProj.sections)) {
      throw new Error("Archivo inválido: falta project.sections");
    }
    const newPid = newMapEntityId();
    const sectionMap = new Map();
    const sections = [];
    const srcSecs = oldProj.sections.length
      ? oldProj.sections
      : [{ id: "__def", name: "Sección" }];
    srcSecs.forEach((s) => {
      const nid = newMapEntityId();
      sectionMap.set(String(s.id), nid);
      sections.push({ id: nid, name: s.name || "Sección" });
    });
    const defaultSecId = sections[0].id;
    function scopeForOldRow(mapScopeVal) {
      const t = String(mapScopeVal || "").split("|");
      if (t.length >= 2 && sectionMap.has(t[1])) return `${newPid}|${sectionMap.get(t[1])}`;
      return `${newPid}|${defaultSecId}`;
    }
    const projects = loadMapProjects();
    projects.push({
      id: newPid,
      name: `${oldProj.name || "Proyecto"} (importado)`,
      sections,
    });
    saveMapProjects(projects);
    setProjectUiExpanded(newPid, true);
    setActiveProjectSection(newPid, defaultSecId);

    const mMap = new Map();
    const cMap = new Map();

    for (const b of entities.buildings || []) {
      await api("POST", "buildings", {
        name: b.name || "",
        address: b.address || "",
        lat: b.lat !== null && b.lat !== undefined && b.lat !== "" ? Number(b.lat) : null,
        lng: b.lng !== null && b.lng !== undefined && b.lng !== "" ? Number(b.lng) : null,
        notes: b.notes || "",
        map_scope: scopeForOldRow(b.map_scope),
      });
    }

    for (const m of entities.mufas || []) {
      const r = await api("POST", "mufas", {
        name: m.name || "",
        lat: Number(m.lat),
        lng: Number(m.lng),
        model: m.model || "",
        splice_count: Number(m.splice_count) || 0,
        notes: m.notes || "",
        site_id: m.site_id != null && m.site_id !== "" ? Number(m.site_id) : null,
        source_pon_id:
          m.linked_pon_id != null && m.linked_pon_id !== "" ? Number(m.linked_pon_id) : null,
        map_scope: scopeForOldRow(m.map_scope),
      });
      if (r.id != null) mMap.set(m.id, r.id);
    }

    for (const c of entities.cables || []) {
      const path = c.path || [];
      if (path.length < 2) continue;
      const r = await api("POST", "cables", {
        name: c.name || "",
        fiber_count: Number(c.fiber_count) || 12,
        fiber_spec: c.fiber_spec || "",
        path,
        color: c.color || "#2563eb",
        notes: c.notes || "",
        splice_count: Number(c.splice_count) || 0,
        manga_label: c.manga_label || "",
        fiber_map: c.fiber_map && typeof c.fiber_map === "object" ? c.fiber_map : {},
        site_id: c.site_id != null && c.site_id !== "" ? Number(c.site_id) : null,
        source_pon_id:
          c.source_pon_id != null && c.source_pon_id !== "" ? Number(c.source_pon_id) : null,
        map_scope: scopeForOldRow(c.map_scope),
      });
      if (r.id != null) cMap.set(c.id, r.id);
    }

    for (const t of entities.terminals || []) {
      const hadCable = t.drop_cable_id != null && Number(t.drop_cable_id) > 0;
      const dm =
        t.drop_mufa_id != null && Number(t.drop_mufa_id) > 0 && mMap.has(t.drop_mufa_id)
          ? mMap.get(t.drop_mufa_id)
          : null;
      const dc =
        t.drop_cable_id != null && Number(t.drop_cable_id) > 0 && cMap.has(t.drop_cable_id)
          ? cMap.get(t.drop_cable_id)
          : null;
      const drop_attach = hadCable && dc ? "cable" : "mufa";
      await api("POST", "terminals", {
        name: t.name || "",
        lat: Number(t.lat),
        lng: Number(t.lng),
        port_count: Number(t.port_count) || 8,
        marker_color: t.marker_color || "green",
        drop_fiber: t.drop_fiber != null && t.drop_fiber !== "" ? Number(t.drop_fiber) : null,
        drop_attach,
        drop_mufa_id: drop_attach === "mufa" ? dm : null,
        drop_cable_id: drop_attach === "cable" ? dc : null,
        splitter_ref: t.splitter_ref || "",
        notes: t.notes || "",
        map_scope: scopeForOldRow(t.map_scope),
      });
    }
  }

  function wireDeleteImportModals() {
    const delBd = document.getElementById("modal-del-project-backdrop");
    const delPh = document.getElementById("del-project-phrase");
    const delCc = document.getElementById("del-project-cancel");
    const delOk = document.getElementById("del-project-confirm");
    const delChk = document.getElementById("del-project-purge-server");
    const delHint = document.getElementById("del-project-soft-hint");
    if (delBd && !delBd.dataset.faBound) {
      delBd.dataset.faBound = "1";
      delPh?.addEventListener("input", syncDeleteProjectConfirmEnabled);
      delChk?.addEventListener("change", () => {
        if (delHint) delHint.hidden = !!(delChk && delChk.checked);
      });
      delCc?.addEventListener("click", () => closeDeleteProjectModal());
      delBd.addEventListener("click", (ev) => {
        if (ev.target === delBd) closeDeleteProjectModal();
      });
      delOk?.addEventListener("click", async () => {
        if (!delProjectState || !delPh || delPh.value.trim() !== PHRASE_DELETE_PROJECT) return;
        const purge = delChk && delChk.checked;
        try {
          if (purge) {
            await api("POST", "map_project_purge", { project_id: delProjectState.id });
          }
        } catch (e) {
          alert(e.message || String(e));
          return;
        }
        removeProjectFromLocalList(delProjectState.id);
        closeDeleteProjectModal();
        renderNavProjectTree();
        updateMapWorkContextBanner();
        void loadAll();
        void loadHierarchy();
        setStatus(
          purge
            ? "Proyecto eliminado del menú y datos del mapa borrados en el servidor."
            : "Proyecto quitado solo del menú (datos en servidor sin borrar)."
        );
      });
    }

    const impBd = document.getElementById("modal-import-project-backdrop");
    const impPh = document.getElementById("import-project-phrase");
    const impCc = document.getElementById("import-project-cancel");
    const impOk = document.getElementById("import-project-confirm");
    const impBtn = document.getElementById("nav-btn-import-project");
    const impFile = document.getElementById("nav-import-file");
    if (impBtn && impFile && !impBtn.dataset.faBound) {
      impBtn.dataset.faBound = "1";
      impBtn.addEventListener("click", () => impFile.click());
      impFile.addEventListener("change", async () => {
        const f = impFile.files && impFile.files[0];
        impFile.value = "";
        if (!f) return;
        try {
          const text = await f.text();
          const data = JSON.parse(text);
          if (!data || data.version !== 1 || !data.entities || typeof data.entities !== "object") {
            throw new Error("Archivo no reconocido (se espera version: 1 y entities).");
          }
          importPendingBundle = data;
          const ent = data.entities;
          const nb = (ent.buildings || []).length;
          const nm = (ent.mufas || []).length;
          const nc = (ent.cables || []).length;
          const nt = (ent.terminals || []).length;
          const sum = document.getElementById("import-project-summary");
          if (sum) {
            sum.textContent = `Archivo: «${f.name}». Proyecto en archivo: «${data.project && data.project.name ? data.project.name : "?"}». Contiene: ${nb} edificios, ${nm} mufas, ${nc} cables, ${nt} terminales.`;
          }
          openImportProjectModal();
        } catch (e) {
          alert(e.message || "No se pudo leer el JSON.");
        }
      });
    }
    if (impBd && !impBd.dataset.faBound) {
      impBd.dataset.faBound = "1";
      impPh?.addEventListener("input", syncImportProjectConfirmEnabled);
      impCc?.addEventListener("click", () => closeImportProjectModal());
      impBd.addEventListener("click", (ev) => {
        if (ev.target === impBd) closeImportProjectModal();
      });
      impOk?.addEventListener("click", async () => {
        if (!importPendingBundle || !impPh || impPh.value.trim() !== PHRASE_IMPORT_PROJECT) return;
        setStatus("Importando proyecto…");
        try {
          await runImportProjectBundle(importPendingBundle);
          closeImportProjectModal();
          renderNavProjectTree();
          updateMapWorkContextBanner();
          switchTab("map");
          void loadAll();
          void loadHierarchy();
          setStatus("Importación completada. Revise el mapa y el inventario.");
        } catch (e) {
          alert(e.message || String(e));
          setStatus("Error en la importación.");
        }
      });
    }
  }

  function initMapProjectsUi() {
    const form = document.getElementById("form-project-wizard");
    const cancel = document.getElementById("proj-wizard-cancel");
    const newBtn = document.getElementById("nav-btn-new-project");
    if (form && !form.dataset.bound) {
      form.dataset.bound = "1";
      form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const addTo = (document.getElementById("proj-wizard-add-section-for") || {}).value || "";
        const secIn = document.getElementById("proj-wizard-section");
        const nameIn = document.getElementById("proj-wizard-name");
        const sec = secIn ? secIn.value.trim() : "";
        const pname = nameIn ? nameIn.value.trim() : "";
        if (!sec) {
          setStatus("Indique el nombre de la sección.");
          return;
        }
        let projects = loadMapProjects();
        if (addTo.trim()) {
          const proj = projects.find((x) => x.id === addTo.trim());
          if (!proj) return;
          const sid = newMapEntityId();
          proj.sections.push({ id: sid, name: sec });
          saveMapProjects(projects);
          setActiveProjectSection(proj.id, sid);
        } else {
          if (!pname) {
            setStatus("Indique el nombre del proyecto.");
            return;
          }
          const pid = newMapEntityId();
          const sid = newMapEntityId();
          projects.push({ id: pid, name: pname, sections: [{ id: sid, name: sec }] });
          saveMapProjects(projects);
          setProjectUiExpanded(pid, true);
          setActiveProjectSection(pid, sid);
        }
        closeProjectWizard();
        renderNavProjectTree();
        updateMapWorkContextBanner();
        setStatus("Proyecto / sección listos.");
        void loadAll();
        void loadHierarchy();
      });
    }
    if (cancel && !cancel.dataset.bound) {
      cancel.dataset.bound = "1";
      cancel.addEventListener("click", () => {
        if (projectWizardGate) return;
        closeProjectWizard();
      });
    }
    if (newBtn && !newBtn.dataset.bound) {
      newBtn.dataset.bound = "1";
      newBtn.addEventListener("click", () => openProjectWizard({}));
    }
    const projects = loadMapProjects();
    if (!projects.length) {
      openProjectWizard({ gate: true });
    } else {
      ensureActiveProjectValid();
      renderNavProjectTree();
      updateMapWorkContextBanner();
    }
    const unscopedCb = document.getElementById("map-include-unscoped");
    if (unscopedCb && !unscopedCb.dataset.faBound) {
      unscopedCb.dataset.faBound = "1";
      try {
        unscopedCb.checked = localStorage.getItem(FA_MAP_INCLUDE_UNSCOPED_KEY) === "1";
      } catch (_) {}
      unscopedCb.addEventListener("change", () => {
        try {
          if (unscopedCb.checked) localStorage.setItem(FA_MAP_INCLUDE_UNSCOPED_KEY, "1");
          else localStorage.removeItem(FA_MAP_INCLUDE_UNSCOPED_KEY);
        } catch (_) {}
        void loadAll();
        void loadHierarchy();
      });
    }
    wireDeleteImportModals();
  }

  /* ---------- Pestañas / barra lateral ---------- */
  function switchTab(name) {
    document.querySelectorAll(".nav-item[data-tab]").forEach((b) => {
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
      updateMapWorkContextBanner();
    }
    if (name === "network") loadHierarchy();
    if (name === "budget") loadBudgetData();
  }

  document.querySelectorAll(".nav-item[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  /* ---------- Jerarquía / PON planos ---------- */
  let siteOrderById = new Map();
  let orderedSiteRows = [];

  function rebuildSiteOrderMap() {
    siteOrderById = new Map();
    orderedSiteRows = [];
    let n = 0;
    const blds = [...(hierarchyCache.buildings || [])].sort((a, b) => a.id - b.id);
    blds.forEach((b) => {
      const sites = [...(b.sites || [])].sort((a, c) => a.id - c.id);
      sites.forEach((s) => {
        n += 1;
        siteOrderById.set(s.id, n);
        orderedSiteRows.push({ site: s, building: b, n });
      });
    });
    const orphans = [...(hierarchyCache.orphan_sites || [])].sort((a, b) => a.id - b.id);
    orphans.forEach((s) => {
      n += 1;
      siteOrderById.set(s.id, n);
      orderedSiteRows.push({ site: s, building: null, n });
    });
  }

  function oltIndexInSite(site, oltId) {
    const olts = [...(site.olts || [])].sort((a, b) => a.id - b.id);
    const i = olts.findIndex((o) => o.id === oltId);
    return i >= 0 ? i + 1 : 0;
  }

  function cardIndexInOlt(olt, cardId) {
    const cards = [...(olt.olt_cards || [])].sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id));
    const i = cards.findIndex((c) => c.id === cardId);
    return i >= 0 ? i + 1 : 0;
  }

  /** Etiqueta S#·O#·T#·P# para filas con PON (mufa, cable, etc.). */
  function ponCascadeLabel(row) {
    if (!row) return "";
    const ponId = row.source_pon_id || row.linked_pon_id;
    let x = ponId ? findPon(Number(ponId)) : null;
    if (!x && row.source_olt_card_id && row.source_pon_number) {
      const pack = findCard(row.source_olt_card_id);
      if (pack) {
        const sn = siteOrderById.get(pack.site.id) ?? "?";
        const oi = oltIndexInSite(pack.site, pack.olt.id);
        const ti = cardIndexInOlt(pack.olt, pack.card.id);
        return `S${sn}·O${oi}·T${ti}·P${row.source_pon_number}`;
      }
      return "";
    }
    if (!x) return "";
    const sn = siteOrderById.get(x.site.id) ?? "?";
    const oi = oltIndexInSite(x.site, x.olt.id);
    const ti = cardIndexInOlt(x.olt, x.card.id);
    const pn = x.pon.pon_number ?? "?";
    return `S${sn}·O${oi}·T${ti}·P${pn}`;
  }

  function terminalMountLabel(row) {
    if (!row) return "";
    const parts = [];
    if (row.drop_mufa_id) {
      const m = cache.mufas.find((x) => x.id === row.drop_mufa_id);
      parts.push(m ? `Mufa: ${m.name || "#" + m.id}` : `Mufa #${row.drop_mufa_id}`);
    } else if (row.drop_cable_id) {
      const c = cache.cables.find((x) => x.id === row.drop_cable_id);
      parts.push(c ? `Manga: ${c.name || "#" + c.id}` : `Cable #${row.drop_cable_id}`);
    }
    const sr = row.splitter_ref != null ? String(row.splitter_ref).trim() : "";
    if (sr) parts.push(sr);
    return parts.join(" · ");
  }

  function fillPonCascadeSiteOptions(prefix) {
    const sel = document.getElementById(`${prefix}-site`);
    if (!sel) return;
    if (!orderedSiteRows.length) rebuildSiteOrderMap();
    const prev = sel.value;
    sel.innerHTML = '<option value="">—</option>';
    orderedSiteRows.forEach(({ site, n }) => {
      sel.innerHTML += `<option value="${site.id}">S${n} ${escapeHtml(site.name || "")}</option>`;
    });
    if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
  }

  function fillPonCascadeOltOptions(prefix, siteId) {
    const sel = document.getElementById(`${prefix}-olt`);
    if (!sel) return;
    const sid = siteId ? Number(siteId) : 0;
    const site = sid ? findSite(sid) : null;
    const prev = sel.value;
    sel.innerHTML = '<option value="">—</option>';
    if (!site) {
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    const olts = [...(site.olts || [])].sort((a, b) => a.id - b.id);
    olts.forEach((o, idx) => {
      sel.innerHTML += `<option value="${o.id}">O${idx + 1} ${escapeHtml(o.name || "")}</option>`;
    });
    if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
  }

  function fillPonCascadeCardOptions(prefix, oltId) {
    const sel = document.getElementById(`${prefix}-card`);
    if (!sel) return;
    const oid = oltId ? Number(oltId) : 0;
    const pack = oid ? findOlt(oid) : null;
    const prev = sel.value;
    sel.innerHTML = '<option value="">—</option>';
    if (!pack) {
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    const cards = [...(pack.olt.olt_cards || [])].sort(
      (a, b) => (a.sort_order - b.sort_order) || (a.id - b.id),
    );
    cards.forEach((c, idx) => {
      sel.innerHTML += `<option value="${c.id}">T${idx + 1} ${escapeHtml(c.label || "")}</option>`;
    });
    if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
  }

  function getMufaSplitters(row) {
    if (!row) return [];
    let raw = row.splitters_json;
    if (raw == null) raw = "[]";
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch (e) {
        raw = [];
      }
    }
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.filter((x) => x && typeof x === "object");
    }
    if (Number(row.splitter_enabled) === 1) {
      const sc = row.splitter_source_olt_card_id;
      const pn = row.splitter_source_pon_number;
      if (sc && pn) {
        return [
          {
            qty: row.splitter_qty != null ? row.splitter_qty : 1,
            ratio: row.splitter_type != null ? String(row.splitter_type) : "",
            input_fiber: null,
            linked_pon_id: row.splitter_linked_pon_id,
            source_olt_card_id: sc,
            source_pon_number: pn,
            source_pon_id: row.splitter_linked_pon_id,
          },
        ];
      }
    }
    return [];
  }

  function splitterEntryToPonSlot(entry) {
    if (!entry) return null;
    const pid = entry.linked_pon_id || entry.source_pon_id;
    if (pid) {
      const x = findPon(Number(pid));
      if (x) return { cardId: x.card.id, ponNum: x.pon.pon_number };
    }
    if (entry.source_olt_card_id && entry.source_pon_number) {
      return { cardId: entry.source_olt_card_id, ponNum: entry.source_pon_number };
    }
    return null;
  }

  function fiberPeloIsEmpty(map, i) {
    const e = map[String(i)];
    return !e || (!String(e.target || "").trim() && !String(e.note || "").trim());
  }

  /** True si el pelo i del mapa está asignado y el destino es esta mufa (p. ej. mufa:12). */
  function fiberMapSlotTargetsMufa(map, i, mufaId) {
    const mid = Number(mufaId);
    if (!mid) return false;
    if (fiberPeloIsEmpty(map, i)) return false;
    const t = String(map[String(i)].target || "").trim();
    const want = `mufa:${mid}`;
    if (t === want) return true;
    return t
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .includes(want);
  }

  function parseSplitterBranchCount(ratio) {
    const m = String(ratio || "").match(/^1:(\d+)/i);
    if (!m) return 0;
    return Math.min(64, Math.max(0, parseInt(m[1], 10) || 0));
  }

  function applyMufaSplittersToFiberMap(map, fiberCount, mufaRow) {
    const fc = Math.max(1, Math.min(288, fiberCount));
    const splitters = getMufaSplitters(mufaRow);
    if (!splitters.length) return normalizeFiberMap(map);
    const out = normalizeFiberMap(map);
    const used = new Set();
    for (let i = 1; i <= fc; i++) {
      if (!fiberPeloIsEmpty(out, i)) used.add(i);
    }
    splitters.forEach((spl) => {
      const inp = Number(spl.input_fiber);
      if (inp >= 1 && inp <= fc && fiberPeloIsEmpty(out, inp)) {
        out[String(inp)] = {
          target: `mufa:${mufaRow.id}`,
          note: `Splitter ${spl.ratio || "?"} · entrada TIA ${inp}`,
        };
        used.add(inp);
      }
      const branches = parseSplitterBranchCount(spl.ratio);
      const wantOut = branches > 1 ? Math.min(branches - 1, fc) : 0;
      let added = 0;
      for (let i = 1; i <= fc && added < wantOut; i++) {
        if (used.has(i)) continue;
        if (!fiberPeloIsEmpty(out, i)) continue;
        added++;
        out[String(i)] = {
          target: `mufa:${mufaRow.id}`,
          note: `Splitter ${spl.ratio || "?"} · salida ${added}/${wantOut}`,
        };
        used.add(i);
      }
    });
    return out;
  }

  function findCableEndMufaIdFromPath(path) {
    if (!path || path.length < 2) return null;
    const p1 = path[path.length - 1];
    const n1 = neighborsWithin(p1[0], p1[1], CABLE_ANCHOR_RADIUS_M, 8);
    const m1 = n1.find((x) => x.kind === "mufa");
    return m1 ? m1.id : null;
  }

  /** Resuelve mufa/cable/terminal a par (tarjeta, número PON). */
  function rowToPonSlot(row) {
    if (!row) return null;
    const pid = row.source_pon_id || row.linked_pon_id;
    if (pid) {
      const x = findPon(Number(pid));
      if (x) return { cardId: x.card.id, ponNum: x.pon.pon_number };
    }
    if (row.source_olt_card_id && row.source_pon_number) {
      return { cardId: row.source_olt_card_id, ponNum: row.source_pon_number };
    }
    return null;
  }

  function faPonScopeKey(raw) {
    if (raw === null || raw === undefined || raw === "") return -1;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : -1;
  }

  /** Mapa "cardId:ponNum" → lista de ocupantes { kind, id, label, siteId }. */
  function buildPonSlotClaimMap() {
    const map = new Map();
    const add = (cardId, ponNum, entry) => {
      if (!cardId || ponNum < 1 || ponNum > 16) return;
      const k = `${cardId}:${ponNum}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(entry);
    };
    (cache.mufas || []).forEach((m) => {
      const s = rowToPonSlot(m);
      if (s) {
        add(s.cardId, s.ponNum, {
          kind: "mufa",
          id: m.id,
          label: m.name || "Mufa #" + m.id,
          siteId: m.site_id,
        });
      }
      getMufaSplitters(m).forEach((ent, si) => {
        const s2 = splitterEntryToPonSlot(ent);
        if (s2) {
          add(s2.cardId, s2.ponNum, {
            kind: "mufa",
            id: m.id,
            label: (m.name || "Mufa #" + m.id) + " (spl" + (si + 1) + ")",
            siteId: m.site_id,
          });
        }
      });
    });
    (cache.cables || []).forEach((c) => {
      const s = rowToPonSlot(c);
      if (s) {
        add(s.cardId, s.ponNum, {
          kind: "cable",
          id: c.id,
          label: c.name || "Cable #" + c.id,
          siteId: c.site_id,
        });
      }
    });
    (cache.terminals || []).forEach((t) => {
      const s = rowToPonSlot(t);
      if (s) {
        add(s.cardId, s.ponNum, {
          kind: "terminal",
          id: t.id,
          label: t.name || "Term #" + t.id,
          siteId: null,
        });
      }
    });
    return map;
  }

  function slotBlockedByOthers(cardId, ponNum, exclude) {
    const sk = state.modalPonScopeKey;
    const all = buildPonSlotClaimMap().get(`${cardId}:${ponNum}`) || [];
    const users = all.filter((u) => {
      if (u.kind === "terminal") return true;
      return faPonScopeKey(u.siteId) === sk;
    });
    return users.some((u) => !exclude || exclude.kind !== u.kind || exclude.id !== u.id);
  }

  function ponSelectValueToSlotNum(cardId, value) {
    const v = String(value || "").trim();
    if (!v || !cardId) return null;
    if (v.startsWith("slot:")) {
      const p = v.split(":");
      const c = parseInt(p[1], 10);
      const n = parseInt(p[2], 10);
      if (c === Number(cardId) && n >= 1 && n <= 16) return n;
      return null;
    }
    const pid = parseInt(v, 10);
    if (!pid) return null;
    const x = findPon(pid);
    if (x && x.card.id === Number(cardId)) return x.pon.pon_number;
    return null;
  }

  /** Origen PON de la mufa según el formulario principal (modal). */
  function getMainMufaPonSlotFromModal() {
    const ponEl = document.getElementById("f-mufa-src-pon");
    const raw = ponEl && ponEl.value ? String(ponEl.value).trim() : "";
    const p = ponFieldsFromRawPon(raw);
    if (p.source_olt_card_id && p.source_pon_number) {
      return { cardId: p.source_olt_card_id, ponNum: p.source_pon_number };
    }
    return null;
  }

  /**
   * Buckets de cabecera (site) a considerar al bloquear PON/pelos en el submodal splitter:
   * site de la mufa, site elegido en la cascada del splitter y site de la tarjeta OLT.
   */
  function bucketSetForSplitterBlocking(cardId) {
    const buckets = new Set();
    buckets.add(state.modalPonScopeKey);
    const sspl = document.getElementById("f-mufa-spldlg-site")?.value;
    if (sspl && String(sspl).trim()) buckets.add(faPonScopeKey(sspl));
    const cid = Number(cardId);
    if (cid > 0) {
      const pk = findCard(cid);
      if (pk && pk.site && pk.site.id != null && pk.site.id !== "") {
        buckets.add(faPonScopeKey(pk.site.id));
      }
    }
    return buckets;
  }

  function entityMatchesSplitterBuckets(siteIdRaw, buckets) {
    return buckets.has(faPonScopeKey(siteIdRaw));
  }

  /**
   * Puertos P1–P16 ya ocupados para la tarjeta, que no deben ofrecerse al elegir PON de un splitter.
   * Incluye origen PON de esta mufa, otros splitters (borrador + resto de mufas/mangas mismo site), terminales.
   */
  function getBlockedPonNumsForSplitterDialog(cardId, editIdx) {
    const blocked = new Set();
    const cid = Number(cardId);
    if (!cid) return blocked;
    const buckets = bucketSetForSplitterBlocking(cid);
    const curMid =
      state.modalPonExclude && state.modalPonExclude.kind === "mufa" ? state.modalPonExclude.id : null;

    const main = getMainMufaPonSlotFromModal();
    if (main && main.cardId === cid) blocked.add(main.ponNum);

    state.mufaSplittersDraft.forEach((s, i) => {
      if (editIdx !== null && editIdx !== undefined && i === editIdx) return;
      const sl = splitterEntryToPonSlot(s);
      if (sl && sl.cardId === cid) blocked.add(sl.ponNum);
    });

    (cache.mufas || []).forEach((m) => {
      if (curMid != null && m.id === curMid) return;
      if (!entityMatchesSplitterBuckets(m.site_id, buckets)) return;
      const s = rowToPonSlot(m);
      if (s && s.cardId === cid) blocked.add(s.ponNum);
      getMufaSplitters(m).forEach((ent) => {
        const s2 = splitterEntryToPonSlot(ent);
        if (s2 && s2.cardId === cid) blocked.add(s2.ponNum);
      });
    });

    (cache.cables || []).forEach((c) => {
      if (!entityMatchesSplitterBuckets(c.site_id, buckets)) return;
      const s = rowToPonSlot(c);
      if (s && s.cardId === cid) blocked.add(s.ponNum);
    });

    (cache.terminals || []).forEach((t) => {
      const s = rowToPonSlot(t);
      if (s && s.cardId === cid) blocked.add(s.ponNum);
    });

    return blocked;
  }

  function fillPonCascadePonOptions(prefix, cardId, opts) {
    const optObj = opts !== undefined && opts !== null && typeof opts === "object" && !Array.isArray(opts) ? opts : null;
    const useSplDlg =
      optObj &&
      Object.prototype.hasOwnProperty.call(optObj, "splitterDlgEditIdx");
    const splitterEditIdx = useSplDlg ? optObj.splitterDlgEditIdx : undefined;

    const sel = document.getElementById(`${prefix}-pon`);
    if (!sel) return;
    const cid = cardId ? Number(cardId) : 0;
    const pack = cid ? findCard(cid) : null;
    const prev = sel.value;
    const exclude = state.modalPonExclude;
    sel.innerHTML = '<option value="">—</option>';
    if (!pack) {
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    const byNum = new Map();
    (pack.card.pons || []).forEach((p) => byNum.set(p.pon_number, p));
    const prevSlot = ponSelectValueToSlotNum(cid, prev);
    const blockedSpl =
      useSplDlg ? getBlockedPonNumsForSplitterDialog(cid, splitterEditIdx) : null;
    for (let n = 1; n <= 16; n++) {
      let hide = false;
      if (useSplDlg) {
        if (blockedSpl.has(n) && prevSlot !== n) hide = true;
      } else if (slotBlockedByOthers(cid, n, exclude) && prevSlot !== n) {
        hide = true;
      }
      if (hide) continue;
      const p = byNum.get(n);
      const val = p ? String(p.id) : `slot:${cid}:${n}`;
      const lab = p ? `P${n} ${escapeHtml(p.label || "").trim()}`.trim() : `P${n}`;
      sel.innerHTML += `<option value="${val}">${lab}</option>`;
    }
    if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
  }

  function fillPonCascadePonOptionsAuto(prefix, cardId) {
    if (prefix === "f-mufa-spldlg") {
      fillPonCascadePonOptions(prefix, cardId, { splitterDlgEditIdx: state.mufaSplitterDlgIdx });
    } else {
      fillPonCascadePonOptions(prefix, cardId);
    }
  }

  /** Si el submodal splitter está abierto, recarga inventario y actualiza PON y pelos. */
  async function refreshSpldlgIfOpen() {
    const bd = document.getElementById("mufa-splitter-dlg-backdrop");
    if (!bd || !bd.classList.contains("open")) return;
    await fetchInventoryIntoCache();
    const c = document.getElementById("f-mufa-spldlg-card")?.value;
    if (c) fillPonCascadePonOptionsAuto("f-mufa-spldlg", c);
    const selIf = document.getElementById("f-mufa-spldlg-input-fiber");
    const cur = selIf && selIf.value ? parseInt(selIf.value, 10) : NaN;
    fillSpldlgInputFiberSelect(
      state.mufaSplitterDlgIdx,
      Number.isFinite(cur) && cur >= 1 && cur <= 12 ? cur : null,
    );
  }

  function resetPonCascade(prefix, clearSite) {
    const ss = document.getElementById(`${prefix}-site`);
    const os = document.getElementById(`${prefix}-olt`);
    const cs = document.getElementById(`${prefix}-card`);
    const ps = document.getElementById(`${prefix}-pon`);
    if (!ss || !os || !cs || !ps) return;
    if (clearSite) ss.value = "";
    fillPonCascadeOltOptions(prefix, clearSite ? null : ss.value);
    os.disabled = !ss.value;
    if (!ss.value) {
      os.innerHTML = '<option value="">—</option>';
      os.disabled = true;
    }
    fillPonCascadeCardOptions(prefix, null);
    cs.innerHTML = '<option value="">—</option>';
    cs.disabled = true;
    fillPonCascadePonOptionsAuto(prefix, null);
    ps.innerHTML = '<option value="">—</option>';
    ps.disabled = true;
  }

  function applyPonCascadeFromPonId(prefix, ponId) {
    if (!ponId) {
      resetPonCascade(prefix, true);
      return;
    }
    const x = findPon(Number(ponId));
    if (!x) {
      resetPonCascade(prefix, true);
      return;
    }
    fillPonCascadeSiteOptions(prefix);
    const siteSel = document.getElementById(`${prefix}-site`);
    siteSel.value = String(x.site.id);
    fillPonCascadeOltOptions(prefix, x.site.id);
    const oltSel = document.getElementById(`${prefix}-olt`);
    oltSel.disabled = false;
    oltSel.value = String(x.olt.id);
    fillPonCascadeCardOptions(prefix, x.olt.id);
    const cardSel = document.getElementById(`${prefix}-card`);
    cardSel.disabled = false;
    cardSel.value = String(x.card.id);
    fillPonCascadePonOptionsAuto(prefix, x.card.id);
    const ponSel = document.getElementById(`${prefix}-pon`);
    ponSel.disabled = false;
    if ([...ponSel.options].some((o) => o.value === String(x.pon.id))) {
      ponSel.value = String(x.pon.id);
    } else {
      const pn = x.pon.pon_number;
      ponSel.value =
        pn >= 1 && pn <= 16 ? `slot:${x.card.id}:${pn}` : String(x.pon.id);
    }
  }

  function applyPonCascadeFromSlot(prefix, cardId, ponNum) {
    const cid = Number(cardId);
    const num = Number(ponNum);
    if (!cid || num < 1 || num > 16) {
      resetPonCascade(prefix, true);
      return;
    }
    const pack = findCard(cid);
    if (!pack) {
      resetPonCascade(prefix, true);
      return;
    }
    fillPonCascadeSiteOptions(prefix);
    document.getElementById(`${prefix}-site`).value = String(pack.site.id);
    fillPonCascadeOltOptions(prefix, pack.site.id);
    const oltSel = document.getElementById(`${prefix}-olt`);
    oltSel.disabled = false;
    oltSel.value = String(pack.olt.id);
    fillPonCascadeCardOptions(prefix, pack.olt.id);
    const cardSel = document.getElementById(`${prefix}-card`);
    cardSel.disabled = false;
    cardSel.value = String(pack.card.id);
    fillPonCascadePonOptionsAuto(prefix, pack.card.id);
    const ponSel = document.getElementById(`${prefix}-pon`);
    ponSel.disabled = false;
    const p = (pack.card.pons || []).find((pon) => pon.pon_number === num);
    ponSel.value = p ? String(p.id) : `slot:${cid}:${num}`;
  }

  function ponFieldsFromRawPon(rawPon) {
    const raw = rawPon && String(rawPon).trim ? String(rawPon).trim() : "";
    let source_pon_id = null;
    let source_olt_card_id = null;
    let source_pon_number = null;
    if (raw.startsWith("slot:")) {
      const p = raw.split(":");
      source_olt_card_id = parseInt(p[1], 10) || null;
      source_pon_number = parseInt(p[2], 10) || null;
      if (!(source_olt_card_id > 0 && source_pon_number >= 1 && source_pon_number <= 16)) {
        source_olt_card_id = null;
        source_pon_number = null;
      }
    } else if (raw) {
      const pid = parseInt(raw, 10);
      if (pid > 0) {
        const x = findPon(pid);
        if (x) {
          source_pon_id = pid;
          source_olt_card_id = x.card.id;
          source_pon_number = x.pon.pon_number;
        }
      }
    }
    return { source_pon_id, source_olt_card_id, source_pon_number };
  }

  function fillTermDropSelects() {
    const ms = document.getElementById("f-term-drop-mufa");
    const cs = document.getElementById("f-term-drop-cable");
    if (!ms || !cs) return;
    const pm = ms.value;
    const pc = cs.value;
    ms.innerHTML = '<option value="">—</option>';
    cache.mufas.forEach((m) => {
      ms.innerHTML += `<option value="${m.id}">${escapeHtml(m.name || "Mufa #" + m.id)}</option>`;
    });
    cs.innerHTML = '<option value="">—</option>';
    cache.cables.forEach((c) => {
      cs.innerHTML += `<option value="${c.id}">${escapeHtml(c.name || "Cable #" + c.id)}</option>`;
    });
    if (pm && [...ms.options].some((o) => o.value === pm)) ms.value = pm;
    if (pc && [...cs.options].some((o) => o.value === pc)) cs.value = pc;
  }

  function syncTermDropAttachUi() {
    const rad = document.querySelector('input[name="f-term-drop-src"]:checked');
    const attach = rad && rad.value ? rad.value : "mufa";
    const ms = document.getElementById("f-term-drop-mufa");
    const cs = document.getElementById("f-term-drop-cable");
    if (!ms || !cs) return;
    if (attach === "mufa") {
      ms.disabled = false;
      cs.disabled = true;
      cs.value = "";
    } else {
      cs.disabled = false;
      ms.disabled = true;
      ms.value = "";
    }
  }

  function wirePonCascadeListeners(prefix) {
    const siteEl = document.getElementById(`${prefix}-site`);
    if (!siteEl || siteEl.dataset.faPonWired) return;
    siteEl.dataset.faPonWired = "1";
    siteEl.addEventListener("change", () => {
      fillPonCascadeOltOptions(prefix, siteEl.value);
      const oltEl = document.getElementById(`${prefix}-olt`);
      if (!siteEl.value) {
        oltEl.innerHTML = '<option value="">—</option>';
        oltEl.disabled = true;
      }
      fillPonCascadeCardOptions(prefix, null);
      const cEl = document.getElementById(`${prefix}-card`);
      cEl.innerHTML = '<option value="">—</option>';
      cEl.disabled = true;
      fillPonCascadePonOptionsAuto(prefix, null);
      const pEl = document.getElementById(`${prefix}-pon`);
      pEl.innerHTML = '<option value="">—</option>';
      pEl.disabled = true;
      if (prefix === "f-mufa-spldlg") void refreshSpldlgIfOpen();
    });
    document.getElementById(`${prefix}-olt`).addEventListener("change", (e) => {
      const v = e.target.value;
      fillPonCascadeCardOptions(prefix, v);
      const cEl = document.getElementById(`${prefix}-card`);
      if (!v) {
        cEl.innerHTML = '<option value="">—</option>';
        cEl.disabled = true;
      }
      fillPonCascadePonOptionsAuto(prefix, null);
      const pEl = document.getElementById(`${prefix}-pon`);
      pEl.innerHTML = '<option value="">—</option>';
      pEl.disabled = true;
    });
    document.getElementById(`${prefix}-card`).addEventListener("change", (e) => {
      const v = e.target.value;
      if (prefix === "f-mufa-spldlg") {
        const pEl = document.getElementById(`${prefix}-pon`);
        if (!v) {
          pEl.innerHTML = '<option value="">—</option>';
          pEl.disabled = true;
          const selIf = document.getElementById("f-mufa-spldlg-input-fiber");
          const cur = selIf && selIf.value ? parseInt(selIf.value, 10) : NaN;
          fillSpldlgInputFiberSelect(
            state.mufaSplitterDlgIdx,
            Number.isFinite(cur) && cur >= 1 && cur <= 12 ? cur : null,
          );
        } else {
          void refreshSpldlgIfOpen();
        }
        return;
      }
      fillPonCascadePonOptionsAuto(prefix, v);
      const pEl = document.getElementById(`${prefix}-pon`);
      if (!v) {
        pEl.innerHTML = '<option value="">—</option>';
        pEl.disabled = true;
      }
    });
  }

  async function fetchInventoryIntoCache() {
    const qs = mapScopeQueryParams();
    const [mufas, terminals, cables] = await Promise.all([
      api("GET", "mufas", null, null, qs),
      api("GET", "terminals", null, null, qs),
      api("GET", "cables", null, null, qs),
    ]);
    cache.mufas = mufas.data;
    cache.terminals = terminals.data;
    cache.cables = cables.data;
  }

  async function refreshInventoryForDetail() {
    await fetchInventoryIntoCache();
    renderNetDetail();
  }

  async function loadHierarchy() {
    try {
      const res = await api("GET", "hierarchy");
      const d = res.data || {};
      hierarchyCache = {
        buildings: d.buildings || [],
        orphan_sites: d.orphan_sites || [],
      };
      rebuildSiteOrderMap();
      renderAllHierarchyTrees();
      fillSiteAndPonSelects();
      updateMapActiveSiteBanner();
      syncBuildingMarkers();
      if (netSelection) {
        if (netSelection.type === "card") {
          await refreshInventoryForDetail();
        } else {
          renderNetDetail();
        }
      }
    } catch (e) {
      console.error(e);
      const msg = `<p class="sub">Error: ${escapeHtml(e.message)}</p>`;
      const ne = document.getElementById("network-tree");
      if (ne) ne.innerHTML = msg;
      const mb = document.getElementById("map-hierarchy-body");
      if (mb) mb.innerHTML = msg;
    }
  }

  function forEachSite(fn) {
    (hierarchyCache.buildings || []).forEach((b) => {
      (b.sites || []).forEach((s) => fn(s, b));
    });
    (hierarchyCache.orphan_sites || []).forEach((s) => fn(s, null));
  }

  function bindBuildingMarkerClick(mk, bid) {
    mk.off("click");
    mk.on("click", async (ev) => {
      L.DomEvent.stopPropagation(ev);
      if (state.mode === "cable") {
        await loadHierarchy();
        const br = findBuilding(bid);
        const la = br && br.lat != null ? Number(br.lat) : NaN;
        const ln = br && br.lng != null ? Number(br.lng) : NaN;
        if (Number.isFinite(la) && Number.isFinite(ln)) {
          appendCableDraftVertex(la, ln);
        } else {
          setStatus("Cable: este edificio no tiene GPS; use el mapa o una mufa.");
        }
        return;
      }
      await loadHierarchy();
      const br = findBuilding(bid);
      if (!br) return;
      /** Igual que clic en «Edificio: …» en el árbol: activa ＋ Site (en POP) / modo ＋ Site en mapa */
      netSelection = { type: "building", id: bid };
      applyMapFieldContextFromSelection("building", bid);
      setStatus(
        "POP activo en Red acceso. Use «＋ Site (en POP)» o herramienta «＋ Site» + clic en mapa. El modal es para editar datos.",
      );
      await openBuildingModal({
        id: br.id,
        name: br.name,
        address: br.address || "",
        lat: br.lat,
        lng: br.lng,
        notes: br.notes || "",
      });
    });
  }

  function syncBuildingMarkers() {
    if (!state.map || !state.buildingLayer) return;
    const scopeKey = getActiveMapScopeKey();
    const allowUnscoped = localStorage.getItem(FA_MAP_INCLUDE_UNSCOPED_KEY) === "1";
    function buildingVisibleForMapScope(b) {
      if (!scopeKey) return true;
      const ms = b.map_scope != null ? String(b.map_scope).trim() : "";
      if (ms === scopeKey) return true;
      if (!ms && allowUnscoped) return true;
      return false;
    }
    const seen = new Set();
    (hierarchyCache.buildings || []).forEach((b) => {
      if (!buildingVisibleForMapScope(b)) return;
      const lat = b.lat != null && b.lat !== "" ? Number(b.lat) : NaN;
      const lng = b.lng != null && b.lng !== "" ? Number(b.lng) : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      seen.add(b.id);
      const label = b.name || "Edificio";
      let mk = state.buildingMarkers.get(b.id);
      if (mk) {
        mk.setLatLng([lat, lng]);
        const tt = mk.getTooltip();
        if (tt) tt.setContent(escapeHtml(label));
      } else {
        mk = L.marker([lat, lng], { icon: iconBuilding });
        mk.bindTooltip(escapeHtml(label), { sticky: true });
        mk.addTo(state.buildingLayer);
        state.buildingMarkers.set(b.id, mk);
      }
      bindBuildingMarkerClick(mk, b.id);
    });
    state.buildingMarkers.forEach((mk, id) => {
      if (!seen.has(id)) {
        state.buildingLayer.removeLayer(mk);
        state.buildingMarkers.delete(id);
      }
    });
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
    const fillSiteSelect = (el, emptyLabel) => {
      if (!el) return;
      const v = el.value;
      el.innerHTML = `<option value="">${emptyLabel}</option>`;
      (hierarchyCache.buildings || []).forEach((b) => {
        el.innerHTML += `<optgroup label="${escapeHtml(b.name || "Edificio")}">`;
        (b.sites || []).forEach((s) => {
          el.innerHTML += `<option value="${s.id}">${escapeHtml(s.name || "Site")}</option>`;
        });
        el.innerHTML += `</optgroup>`;
      });
      if ((hierarchyCache.orphan_sites || []).length) {
        el.innerHTML += `<optgroup label="Sin edificio">`;
        hierarchyCache.orphan_sites.forEach((s) => {
          el.innerHTML += `<option value="${s.id}">${escapeHtml(s.name || "Site")}</option>`;
        });
        el.innerHTML += `</optgroup>`;
      }
      if (v && [...el.options].some((o) => o.value === v)) el.value = v;
    };
    fillSiteSelect(document.getElementById("f-site-id"), "— Ninguno —");
    fillSiteSelect(document.getElementById("f-cable-scope-site"), "— Ninguno —");
      fillPonCascadeSiteOptions("f-mufa-src");
      fillPonCascadeSiteOptions("f-mufa-spldlg");
      fillPonCascadeSiteOptions("f-cable-src");
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
    cache.terminals.forEach((t) => {
      sel.innerHTML += `<option value="terminal:${t.id}">Terminal: ${escapeHtml(t.name || "#" + t.id)}</option>`;
    });
    if (v) sel.value = v;
  }

  function renderSiteSubtree(site, activeSiteId) {
    const siteActive =
      activeSiteId != null && site.id === activeSiteId ? " nt-site-active" : "";
    let html = `<div class="nt-site${siteActive}" data-id="${site.id}">
        <div class="nt-head" data-sel="site" data-id="${site.id}" data-building-id="${
          site.building_id != null ? site.building_id : ""
        }">
          <span><span class="nt-site-n">S${siteOrderById.get(site.id) ?? "?"}</span> ${escapeHtml(site.name || "Site")}</span>
          <span class="nt-actions">
            <button type="button" class="tree-del" data-tree-del="site" data-id="${site.id}" title="Borrar site">✕</button>
            <button type="button" class="btn-sm" data-add-olt="${site.id}">＋ OLT</button>
          </span>
        </div>`;
    (site.olts || []).forEach((olt) => {
      html += `<div class="nt-olt" data-id="${olt.id}">
          <div class="nt-head" data-sel="olt" data-id="${olt.id}" data-site-id="${site.id}">
            <span>OLT: ${escapeHtml(olt.name || "#" + olt.id)}</span>
            <span class="nt-actions">
              <button type="button" class="tree-del" data-tree-del="olt" data-id="${olt.id}" title="Borrar OLT">✕</button>
              <button type="button" class="btn-sm" data-add-card="${olt.id}">＋ Tarjeta</button>
            </span>
          </div>`;
      (olt.olt_cards || []).forEach((card) => {
        html += `<div class="nt-card" data-id="${card.id}">
            <div class="nt-head" data-sel="card" data-id="${card.id}" data-olt-id="${olt.id}">
              <span>${escapeHtml(card.label || "Tarjeta")}</span>
              <span class="nt-actions">
                <button type="button" class="tree-del" data-tree-del="card" data-id="${card.id}" title="Borrar tarjeta">✕</button>
                <button type="button" class="btn-sm" data-add-pon="${card.id}">＋ PON</button>
              </span>
            </div>`;
        (card.pons || []).forEach((pon) => {
          html += `<div class="nt-pon" data-sel="pon" data-id="${pon.id}" data-card-id="${card.id}">
              <span>PON ${pon.pon_number} ${escapeHtml(pon.label || "")}</span>
              <span class="nt-pon-meta">
                <span class="nt-mini">#${pon.id}</span>
                <button type="button" class="tree-del" data-tree-del="pon" data-id="${pon.id}" title="Borrar PON">✕</button>
              </span>
            </div>`;
        });
        html += `</div>`;
      });
      html += `</div>`;
    });
    html += `</div>`;
    return html;
  }

  const HINT_EMPTY_NETWORK =
    '<p class="sub"><strong>Edif.</strong>→<strong>Site</strong>→OLT→tarj.→PON. S1,S2… orden red.</p>';

  const HINT_EMPTY_MAP =
    '<p class="sub"><strong>POP</strong> + <strong>cabecera (site)</strong> + OLT. Clic en fila; arriba se resume el contexto del mapa.</p>';

  function renderHierarchyPanel(el, emptyInnerHtml) {
    if (!el) return;
    const activeSiteId = state.mapFieldContext.siteId;
    const ctxBid = state.mapFieldContext.buildingId;
    const blds = hierarchyCache.buildings || [];
    const orphans = hierarchyCache.orphan_sites || [];
    if (!blds.length && !orphans.length) {
      el.innerHTML = emptyInnerHtml;
      return;
    }
    let html = "";
    blds.forEach((b) => {
      const ctxBuildingHi =
        activeSiteId == null &&
        ctxBid != null &&
        Number(ctxBid) === Number(b.id);
      html += `<div class="nt-building${ctxBuildingHi ? " nt-building-context" : ""}" data-id="${b.id}">
        <div class="nt-head nt-building-head" data-sel="building" data-id="${b.id}">
          <span>Edificio: ${escapeHtml(b.name || "#" + b.id)}</span>
          <span class="nt-actions">
            <button type="button" class="tree-del" data-tree-del="building" data-id="${b.id}" title="Borrar edificio">✕</button>
            <button type="button" class="btn-sm" data-add-site="${b.id}">＋ Site</button>
          </span>
        </div>`;
      (b.sites || []).forEach((site) => {
        html += renderSiteSubtree(site, activeSiteId);
      });
      html += `</div>`;
    });
    if (orphans.length) {
      html += `<div class="nt-orphan"><p class="sub" style="margin:0.6rem 0 0.35rem">Sites sin edificio</p>`;
      orphans.forEach((site) => {
        html += renderSiteSubtree(site, activeSiteId);
      });
      html += `</div>`;
    }
    el.innerHTML = html;
  }

  function renderAllHierarchyTrees() {
    renderHierarchyPanel(document.getElementById("network-tree"), HINT_EMPTY_NETWORK);
    renderHierarchyPanel(document.getElementById("map-hierarchy-body"), HINT_EMPTY_MAP);
  }

  function renderNetworkTree() {
    renderAllHierarchyTrees();
  }

  function applyMapFieldContextFromSelection(type, id) {
    let siteId = null;
    let buildingId = null;
    if (type === "building") {
      buildingId = id;
      siteId = null;
    } else if (type === "site") {
      siteId = id;
      const s = findSite(id);
      buildingId = s && s.building_id != null ? s.building_id : null;
    } else if (type === "olt") {
      const x = findOlt(id);
      siteId = x ? x.site.id : null;
      buildingId = x && x.site.building_id != null ? x.site.building_id : null;
    } else if (type === "card") {
      const x = findCard(id);
      siteId = x ? x.site.id : null;
      buildingId = x && x.site.building_id != null ? x.site.building_id : null;
    } else if (type === "pon") {
      const x = findPon(id);
      siteId = x ? x.site.id : null;
      buildingId = x && x.site.building_id != null ? x.site.building_id : null;
    }
    state.mapFieldContext.siteId = siteId;
    state.mapFieldContext.buildingId = buildingId;
    updateMapActiveSiteBanner();
    renderAllHierarchyTrees();
    if (state.mode === "mufa") {
      const sid = state.mapFieldContext.siteId;
      setStatus(
        sid ? `Mufa: clic mapa. Site: ${findSite(sid)?.name || "?"}` : "Mufa: clic mapa. Elige site en árbol.",
      );
    } else if (state.mode === "org_site") {
      const bid = state.mapFieldContext.buildingId;
      setStatus(
        bid
          ? `Site: clic en el mapa (GPS) o use «＋ Site (en POP)». POP: ${findBuilding(bid)?.name || "?"}`
          : "Site: primero clic en «Edificio: …» (cabecera), luego «＋ Site (en POP)» o herramienta «＋ Site» + mapa.",
      );
    }
  }

  function updateMapActiveSiteBanner() {
    const el = document.getElementById("map-active-site-banner");
    if (!el) return;
    const sid = state.mapFieldContext.siteId;
    const bid = state.mapFieldContext.buildingId;
    if (!sid && !bid) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.hidden = false;
    const s = sid ? findSite(sid) : null;
    const bPop = bid ? findBuilding(bid) : null;
    const sn = sid != null ? siteOrderById.get(sid) : null;
    const sTag = sn != null ? `S${sn} ` : "";
    let body = "";
    if (sid) {
      const sname = escapeHtml(s ? s.name || "Site #" + sid : "Site #" + sid);
      body += `<p class="map-ctx-line"><strong>Cabecera (site):</strong> ${sTag}${sname}</p>`;
      body += `<p class="map-ctx-sub">Las <strong>mufas</strong> nuevas en el mapa se enlazan a esta cabecera.</p>`;
      const sBid = s && s.building_id != null ? Number(s.building_id) : null;
      if (sBid != null && Number.isFinite(sBid)) {
        const br = findBuilding(sBid);
        body += `<p class="map-ctx-sub">POP físico: <strong>${escapeHtml(
          br ? br.name || "#" + sBid : "#" + sBid,
        )}</strong> — para <em>otro</em> site en el mismo POP use «＋ Site (en POP)» o la herramienta «＋ Site» del mapa.</p>`;
      } else {
        body += `<p class="map-ctx-sub">Site sin POP físico. Asigne edificio en <strong>Inventario</strong> si lo necesita.</p>`;
      }
    } else if (bid) {
      body += `<p class="map-ctx-line"><strong>POP físico seleccionado:</strong> ${escapeHtml(
        bPop ? bPop.name || "#" + bid : "#" + bid,
      )}</p>`;
      body += `<p class="map-ctx-sub">Use <strong>＋ Site (en POP)</strong> (nombre) o la herramienta <strong>＋ Site</strong> del mapa y un clic (GPS).</p>`;
    }
    body += `<div class="map-ctx-actions"><button type="button" class="btn-sm" id="map-clear-map-context">Limpiar contexto</button></div>`;
    el.innerHTML = body;
  }

  async function onHierarchyTreeClick(ev) {
    const delBtn = ev.target.closest("[data-tree-del]");
    if (delBtn) {
      ev.stopPropagation();
      ev.preventDefault();
      const kind = delBtn.dataset.treeDel;
      const delId = Number(delBtn.dataset.id);
      const resName = TREE_DEL_RESOURCE[kind];
      const msg = TREE_DEL_CONFIRM[kind];
      if (!resName || !msg || !Number.isFinite(delId)) return;
      if (!confirm(msg)) return;
      try {
        await api("DELETE", resName, null, delId);
        if (netSelection && netSelection.type === kind && netSelection.id === delId) {
          netSelection = null;
        }
        if (kind === "site" && state.mapFieldContext.siteId === delId) {
          state.mapFieldContext.siteId = null;
          updateMapActiveSiteBanner();
        }
        if (kind === "building" && state.mapFieldContext.buildingId === delId) {
          state.mapFieldContext.buildingId = null;
          updateMapActiveSiteBanner();
        }
        document.querySelectorAll(".nt-pon").forEach((n) => n.classList.remove("selected"));
        await loadHierarchy();
        renderNetDetail();
      } catch (e) {
        alert(e.message);
      }
      return;
    }
    const addSiteUnder = ev.target.closest("[data-add-site]");
    if (addSiteUnder) {
      const name = prompt("Nombre del site (cabecera / POP lógico) en este edificio?");
      if (!name || !String(name).trim()) return;
      try {
        await postSiteUnderBuilding(Number(addSiteUnder.dataset.addSite), name);
        setStatus("Site creado bajo el edificio.");
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
    if (ponEl && !ev.target.closest(".tree-del")) {
      const pid = Number(ponEl.dataset.id);
      netSelection = { type: "pon", id: pid };
      applyMapFieldContextFromSelection("pon", pid);
      document.querySelectorAll(".nt-pon").forEach((n) => n.classList.remove("selected"));
      document.querySelectorAll(`.nt-pon[data-sel="pon"][data-id="${pid}"]`).forEach((n) =>
        n.classList.add("selected"),
      );
      await loadPonDetail(pid);
      return;
    }
    const head = ev.target.closest(".nt-head[data-sel]");
    if (head && !ev.target.closest("button")) {
      const t = head.dataset.sel;
      const id = Number(head.dataset.id);
      netSelection = { type: t, id };
      applyMapFieldContextFromSelection(t, id);
      document.querySelectorAll(".nt-pon").forEach((n) => n.classList.remove("selected"));
      if (t === "card") {
        await refreshInventoryForDetail();
      } else {
        renderNetDetail();
      }
    }
  }

  document.getElementById("network-tree").addEventListener("click", onHierarchyTreeClick);
  const mapHierBody = document.getElementById("map-hierarchy-body");
  if (mapHierBody) mapHierBody.addEventListener("click", onHierarchyTreeClick);

  document.getElementById("btn-add-building").addEventListener("click", async () => {
    await openBuildingModal({ name: "Edificio", address: "", lat: "", lng: "", notes: "" });
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

  const mapBtnBuilding = document.getElementById("map-btn-add-building");
  if (mapBtnBuilding) {
    mapBtnBuilding.addEventListener("click", () => document.getElementById("btn-add-building").click());
  }
  const mapBtnOrphan = document.getElementById("map-btn-add-orphan-site");
  if (mapBtnOrphan) {
    mapBtnOrphan.addEventListener("click", () => document.getElementById("btn-add-orphan-site").click());
  }
  const mapBtnSiteInBuilding = document.getElementById("map-btn-site-in-building");
  if (mapBtnSiteInBuilding) {
    mapBtnSiteInBuilding.addEventListener("click", async () => {
      const bid = state.mapFieldContext.buildingId;
      if (!bid) {
        alert(
          "1) Clic en «Edificio: …» (texto de la fila), no en ✕ ni ＋.\n2) Pulse otra vez «＋ Site (en POP)».\n\nO use Inventario → «＋ Site» en la fila del edificio.",
        );
        return;
      }
      const name = prompt("Nombre del site / cabecera (POP lógico) en este edificio?");
      if (!name || !String(name).trim()) return;
      try {
        await postSiteUnderBuilding(bid, name);
        setStatus(`Site creado bajo «${findBuilding(bid)?.name || "edificio"}».`);
      } catch (e) {
        alert(e.message);
      }
    });
  }
  const mapBtnOlt = document.getElementById("map-btn-add-olt");
  if (mapBtnOlt) {
    mapBtnOlt.addEventListener("click", async () => {
      const sid = state.mapFieldContext.siteId;
      if (!sid) {
        alert("Clic en un site en el árbol (o crea edificio→site).");
        return;
      }
      const name = prompt("Nombre del OLT en el site activo?");
      if (!name) return;
      try {
        await api("POST", "olts", { site_id: sid, name, notes: "" });
        await loadHierarchy();
      } catch (e) {
        alert(e.message);
      }
    });
  }
  const mapBtnRef = document.getElementById("map-btn-hierarchy-refresh");
  if (mapBtnRef) mapBtnRef.addEventListener("click", () => loadHierarchy());
  const mapOpenInv = document.getElementById("map-open-inventory");
  if (mapOpenInv) mapOpenInv.addEventListener("click", () => switchTab("network"));
  document.querySelector(".map-hierarchy")?.addEventListener("click", (ev) => {
    if (ev.target.closest("#map-clear-map-context")) {
      state.mapFieldContext.siteId = null;
      state.mapFieldContext.buildingId = null;
      updateMapActiveSiteBanner();
      renderAllHierarchyTrees();
      if (state.mode === "mufa") setMode("mufa");
      else if (state.mode === "org_site") setMode("org_site");
      setStatus("Contexto de mapa limpiado.");
    }
  });

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

  function fillBuildingSitesHint(buildingId) {
    const el = document.getElementById("f-building-sites-hint");
    if (!el) return;
    if (buildingId == null || buildingId === "") {
      el.innerHTML =
        '<p class="sub" style="margin:0">Tras <strong>Guardar</strong>, añada <strong>sites</strong> y <strong>OLT</strong> en el árbol «Red acceso» / <strong>Inventario</strong>.</p>';
      return;
    }
    const b = findBuilding(buildingId);
    const sites = b && b.sites ? b.sites : [];
    if (!sites.length) {
      el.innerHTML =
        '<p class="sub" style="margin:0">Sin sites. En el árbol: <strong>＋ Site</strong> en este edificio; luego <strong>＋ OLT</strong>.</p>';
      return;
    }
    let inner =
      '<p class="sub" style="margin:0 0 0.35rem 0"><strong>Sites</strong> (OLT / tarjetas bajo cada uno en el árbol):</p><ul style="margin:0;padding-left:1.15rem;font-size:0.88rem;line-height:1.45">';
    sites.forEach((s) => {
      inner += `<li>${escapeHtml(s.name || "Site")}</li>`;
    });
    inner += "</ul>";
    el.innerHTML = inner;
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

  /**
   * Crea un site bajo un edificio. lat/lng opcionales (p. ej. modo «＋ Site» en el mapa).
   * Tras guardar, selecciona el site y actualiza el contexto del mapa.
   */
  async function postSiteUnderBuilding(buildingId, name, lat, lng) {
    const bid = Number(buildingId);
    if (!Number.isFinite(bid) || bid <= 0) throw new Error("Edificio no válido.");
    const nm = String(name || "").trim();
    if (!nm) throw new Error("Falta nombre del site.");
    const body = { building_id: bid, name: nm, notes: "" };
    if (lat != null && lng != null && Number.isFinite(+lat) && Number.isFinite(+lng)) {
      body.lat = +lat;
      body.lng = +lng;
    }
    const res = await api("POST", "sites", body);
    await loadHierarchy();
    const newId = res && res.id != null ? Number(res.id) : 0;
    if (newId > 0) {
      netSelection = { type: "site", id: newId };
      applyMapFieldContextFromSelection("site", newId);
      renderNetDetail();
    }
    return res;
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
    let exists =
      type === "building"
        ? !!findBuilding(id)
        : type === "site"
          ? !!findSite(id)
          : type === "olt"
            ? !!findOlt(id)
            : type === "card"
              ? !!findCard(id)
              : type === "pon"
                ? !!findPon(id)
                : false;
    if (!exists) {
      netSelection = null;
      title.textContent = "Detalle";
      box.innerHTML = '<p class="sub">Selecciona un elemento en el árbol.</p>';
      return;
    }
    if (type === "building") {
      const b = findBuilding(id);
      if (!b) return;
      title.textContent = "Edificio";
      const sitesUnder = (b.sites || []).length;
      box.innerHTML = `
        <div class="net-detail-skip">
          <p class="sub" style="margin:0 0 0.45rem 0">
            <strong>Siguiente paso:</strong> cree la <strong>cabecera (site)</strong> aquí mismo. Luego use
            <strong>＋ OLT</strong> en el árbol o en el detalle del site.
          </p>
          <button type="button" class="btn-sm btn-primary" id="nd-add-site">
            ＋ Site (cabecera en este edificio)
          </button>
          <p class="sub" style="margin:0.45rem 0 0 0;font-size:0.74rem">
            Sites actuales bajo este edificio: <strong>${sitesUnder}</strong> — también puede usar
            <strong>＋ Site</strong> en la fila del árbol izquierdo (misma acción).
          </p>
        </div>
        <div class="form-grid" style="margin-top:1rem">
          <label>Nombre<input type="text" id="nd-bname" value="${escapeHtml(b.name)}" /></label>
          <label>Dirección / ref.<input type="text" id="nd-baddr" value="${escapeHtml(b.address || "")}" /></label>
          <label>Lat (opc.)<input type="text" id="nd-blat" value="${b.lat != null ? b.lat : ""}" /></label>
          <label>Lng (opc.)<input type="text" id="nd-blng" value="${b.lng != null ? b.lng : ""}" /></label>
          <label>Notas<textarea id="nd-bnotes">${escapeHtml(b.notes || "")}</textarea></label>
          <div class="toolbar-row">
            <button type="button" class="btn-sm btn-primary" id="nd-save-b">Guardar</button>
            <button type="button" class="btn-sm" id="nd-modal-b">Misma ventana que en mapa…</button>
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
            ...mapScopeForPutBuilding(id),
          });
          await loadHierarchy();
        } catch (e) {
          alert(e.message);
        }
      };
      document.getElementById("nd-modal-b").onclick = async () => {
        await openBuildingModal({
          id: b.id,
          name: document.getElementById("nd-bname").value,
          address: document.getElementById("nd-baddr").value,
          lat: document.getElementById("nd-blat").value,
          lng: document.getElementById("nd-blng").value,
          notes: document.getElementById("nd-bnotes").value,
        });
      };
      document.getElementById("nd-add-site").onclick = async () => {
        const name = prompt("Nombre del site (cabecera / POP lógico) en este edificio?");
        if (!name || !name.trim()) return;
        try {
          await postSiteUnderBuilding(id, name);
          setStatus("Site creado en este edificio.");
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
      const sIx = siteOrderById.get(id);
      const sIxLine =
        sIx != null
          ? `<p class="sub" style="margin:0 0 0.5rem">En red: <strong>S${sIx}</strong> (orden instalación).</p>`
          : "";
      const oltsUnder = (s.olts || []).length;
      box.innerHTML = `
        ${sIxLine}
        <div class="net-detail-skip">
          <p class="sub" style="margin:0 0 0.45rem 0">
            <strong>Siguiente paso:</strong> añada el <strong>OLT</strong> aquí o con <strong>＋ OLT</strong> en el árbol.
            Luego tarjeta y PON en el árbol o en cada detalle.
          </p>
          <button type="button" class="btn-sm btn-primary" id="nd-add-olt">
            ＋ OLT (en este site)
          </button>
          <p class="sub" style="margin:0.45rem 0 0 0;font-size:0.74rem">
            OLTs en este site: <strong>${oltsUnder}</strong>.
          </p>
        </div>
        <div class="form-grid" style="margin-top:1rem">
          <p class="sub" style="margin:0 0 0.35rem">
            <strong>Edificio:</strong> elija abajo y <strong>Guardar</strong> para colgar este site bajo ese POP físico (o «Sin edificio» si va suelto).
          </p>
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
      document.getElementById("nd-add-olt").onclick = async () => {
        const name = prompt("Nombre del OLT?");
        if (!name || !name.trim()) return;
        try {
          const res = await api("POST", "olts", {
            site_id: id,
            name: name.trim(),
            notes: "",
          });
          await loadHierarchy();
          if (res.id) {
            netSelection = { type: "olt", id: res.id };
            applyMapFieldContextFromSelection("olt", res.id);
            renderNetDetail();
          } else {
            renderNetDetail();
          }
          renderAllHierarchyTrees();
        } catch (e) {
          alert(e.message);
        }
      };
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
      const cardsUnder = (x.olt.olt_cards || []).length;
      box.innerHTML = `
        <div class="net-detail-skip">
          <p class="sub" style="margin:0 0 0.45rem 0">
            <strong>Siguiente paso:</strong> cree la <strong>tarjeta OLT</strong> (slot típica) antes de los PON.
          </p>
          <button type="button" class="btn-sm btn-primary" id="nd-add-card">
            ＋ Tarjeta OLT
          </button>
          <p class="sub" style="margin:0.45rem 0 0 0;font-size:0.74rem">
            Tarjetas en este OLT: <strong>${cardsUnder}</strong>.
          </p>
        </div>
        <div class="form-grid" style="margin-top:1rem">
          <label>Nombre<input type="text" id="nd-name" value="${escapeHtml(x.olt.name)}" /></label>
          <label>Notas<textarea id="nd-notes">${escapeHtml(x.olt.notes || "")}</textarea></label>
          <div class="toolbar-row">
            <button type="button" class="btn-sm btn-primary" id="nd-save">Guardar</button>
            <button type="button" class="btn-sm" id="nd-del" style="border-color:#b91c1c">Borrar OLT</button>
          </div>
        </div>`;
      document.getElementById("nd-add-card").onclick = async () => {
        const label = prompt("Nombre de la tarjeta (ej. Tarjeta 1)?", "Tarjeta 1");
        if (!label || !label.trim()) return;
        try {
          const res = await api("POST", "olt_cards", {
            olt_id: id,
            label: label.trim(),
            sort_order: 0,
            notes: "",
          });
          await loadHierarchy();
          if (res.id) {
            netSelection = { type: "card", id: res.id };
            applyMapFieldContextFromSelection("card", res.id);
            renderNetDetail();
          } else {
            renderNetDetail();
          }
          renderAllHierarchyTrees();
        } catch (e) {
          alert(e.message);
        }
      };
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
      const cardId = x.card.id;
      const ponsUnder = (x.card.pons || []).length;
      let gridHtml =
        '<p class="sub" style="margin:0.75rem 0 0.35rem">P1–P16: ocupación en inventario. En formularios, el mismo puerto no se ofrece dos veces en la <strong>misma cabecera (site)</strong>; terminales legado bloquean siempre.</p><div class="pon-slot-grid">';
      for (let n = 1; n <= 16; n++) {
        const claims = buildPonSlotClaimMap().get(`${cardId}:${n}`) || [];
        if (!claims.length) {
          gridHtml += `<div class="pon-slot-cell pon-slot-libre"><span class="pon-slot-n">P${n}</span><span class="pon-slot-st">Libre</span></div>`;
        } else {
          const who = claims
            .map((c) => {
              const tag = c.kind === "mufa" ? "Mufa" : c.kind === "cable" ? "Manga" : "Term.";
              return `<span class="pon-slot-who">${tag}: ${escapeHtml(c.label)}</span>`;
            })
            .join("");
          gridHtml += `<div class="pon-slot-cell pon-slot-ocupado"><span class="pon-slot-n">P${n}</span>${who}</div>`;
        }
      }
      gridHtml += "</div>";
      box.innerHTML = `
        <div class="net-detail-skip">
          <p class="sub" style="margin:0 0 0.45rem 0">
            <strong>Siguiente paso:</strong> añada un <strong>PON</strong> (número de puerto en la tarjeta).
          </p>
          <button type="button" class="btn-sm btn-primary" id="nd-add-pon">
            ＋ PON (en esta tarjeta)
          </button>
          <p class="sub" style="margin:0.45rem 0 0 0;font-size:0.74rem">
            PON en esta tarjeta: <strong>${ponsUnder}</strong>.
          </p>
        </div>
        <div class="form-grid" style="margin-top:1rem">
          <label>Etiqueta (ej. Tarjeta 1)<input type="text" id="nd-label" value="${escapeHtml(x.card.label)}" /></label>
          <label>Orden<input type="number" id="nd-ord" value="${x.card.sort_order || 0}" /></label>
          <label>Notas<textarea id="nd-notes">${escapeHtml(x.card.notes || "")}</textarea></label>
          <div class="toolbar-row">
            <button type="button" class="btn-sm btn-primary" id="nd-save">Guardar</button>
            <button type="button" class="btn-sm" id="nd-del" style="border-color:#b91c1c">Borrar tarjeta</button>
          </div>
        </div>${gridHtml}`;
      document.getElementById("nd-add-pon").onclick = async () => {
        const defNum = String((ponsUnder || 0) + 1);
        const raw = prompt("Número de PON (puerto)?", defNum);
        if (raw == null || raw === "") return;
        const num = parseInt(raw, 10);
        if (Number.isNaN(num) || num < 1) {
          alert("Número de PON no válido.");
          return;
        }
        try {
          const res = await api("POST", "pons", {
            olt_card_id: cardId,
            pon_number: num,
            label: "",
            notes: "",
          });
          await loadHierarchy();
          if (res.id) {
            netSelection = { type: "pon", id: res.id };
            applyMapFieldContextFromSelection("pon", res.id);
            renderNetDetail();
          } else {
            renderNetDetail();
          }
          renderAllHierarchyTrees();
        } catch (e) {
          alert(e.message);
        }
      };
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
      syncLineQtyForBudgetLine();
    } catch (e) {
      console.error(e);
    }
  }

  const BUDGET_CATEGORY_LABELS = {
    fibra: "Fibra",
    fibra_6: "Fibra 6 h.",
    fibra_8: "Fibra 8 h.",
    fibra_12: "Fibra 12 h.",
    fibra_24: "Fibra 24 h.",
    fibra_48: "Fibra 48 h.",
    fibra_72: "Fibra 72 h.",
    fibra_96: "Fibra 96 h.",
    fibra_144: "Fibra 144 h.",
    fibra_192: "Fibra 192 h.",
    fibra_288: "Fibra 288 h.",
    caja_nap: "Caja NAP",
    caja_nap_8: "Caja NAP 8",
    caja_nap_16: "Caja NAP 16",
    mufa: "Mufa",
    manga: "Manga",
    prep_palo: "Prep. palo",
    prep_gancho: "Prep. palo · Gancho",
    prep_j: "Prep. palo · J",
    prep_gris_8: "Prep. palo · Gris para fibras 8",
    prep_gris_12: "Prep. palo · Gris para fibras 12",
    prep_gris_24: "Prep. palo · Gris para fibras 24",
    prep_gris_48: "Prep. palo · Gris para fibras 48",
    mo_tirado_km: "M.O. tirado fibra (km)",
    mo_tirado_prep_km: "M.O. tirado + prep. palo (km)",
    mo_prep_gancho: "M.O. prep. palo · Gancho",
    mo_prep_j: "M.O. prep. palo · J",
    mo_prep_gris_8: "M.O. prep. palo · Gris para fibras 8",
    mo_prep_gris_12: "M.O. prep. palo · Gris para fibras 12",
    mo_prep_gris_24: "M.O. prep. palo · Gris para fibras 24",
    mo_prep_gris_48: "M.O. prep. palo · Gris para fibras 48",
    otro: "Otro",
  };

  function budgetCategoryLabel(code) {
    if (code == null || code === "") return "—";
    const c = String(code);
    return BUDGET_CATEGORY_LABELS[c] || c;
  }

  /** Número + signo $ (referencia monetaria genérica, sin tipo de moneda). */
  function formatBudgetMoney(value) {
    const x = Number(value);
    const v = Number.isFinite(x) ? x : 0;
    return (
      v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "\u00a0$"
    );
  }

  function updateLineDraftSubtotal() {
    const el = document.getElementById("line-draft-subtotal");
    if (!el) return;
    const q = parseFloat(document.getElementById("line-qty")?.value);
    const p = parseFloat(document.getElementById("line-price")?.value);
    const qty = Number.isFinite(q) ? q : 0;
    const price = Number.isFinite(p) ? p : 0;
    el.textContent = "Importe línea: " + formatBudgetMoney(qty * price);
  }

  function syncLineQtyForBudgetLine() {
    const sel = document.getElementById("line-cat");
    const qty = document.getElementById("line-qty");
    if (!sel || !qty) return;
    const v = sel.value;
    const isKm =
      v === "fibra" ||
      v.startsWith("fibra_") ||
      v === "mo_tirado_km" ||
      v === "mo_tirado_prep_km";
    qty.placeholder = isKm ? "Cant. D. Km" : "Cant.";
    qty.title = isKm
      ? "Kilómetros (fibra tirada, M.O. por km o M.O. tirado con preparación de palos)"
      : "Cantidad en unidades";
  }

  function renderCatalog(rows) {
    const el = document.getElementById("catalog-list");
    let h =
      '<table class="data-table"><thead><tr><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Unidad</th><th></th></tr></thead><tbody>';
    rows.forEach((r) => {
      h += `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(budgetCategoryLabel(r.category))}</td>
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
      tot.textContent = "Total: " + formatBudgetMoney(0);
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
        const lt = Number(ln.line_total);
        sum += Number.isFinite(lt) ? lt : 0;
        const up = Number(ln.unit_price);
        const unitShown = Number.isFinite(up)
          ? up.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : "0,00";
        h += `<tr><td>${escapeHtml(ln.description)}</td><td>${escapeHtml(budgetCategoryLabel(ln.category))}</td>
          <td>${ln.qty}</td><td>${unitShown}</td>
          <td>${formatBudgetMoney(ln.line_total)}</td>
          <td><button type="button" class="btn-sm" data-del-line="${ln.id}">✕</button></td></tr>`;
      });
      h += "</tbody>";
      h += `<tfoot><tr><td colspan="4">Total</td><td>${formatBudgetMoney(sum)}</td><td></td></tr></tfoot>`;
      h += "</table>";
      el.innerHTML = h;
      tot.textContent = "Total: " + formatBudgetMoney(sum);
      el.querySelectorAll("[data-del-line]").forEach((b) => {
        b.onclick = async () => {
          try {
            await api("DELETE", "budget_lines", null, Number(b.dataset.delLine));
            await loadLines();
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

  document.getElementById("line-cat")?.addEventListener("change", () => {
    syncLineQtyForBudgetLine();
    updateLineDraftSubtotal();
  });

  ["line-qty", "line-price"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updateLineDraftSubtotal);
  });

  document.getElementById("form-line").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!budgetProjectId) {
      alert("Elige un proyecto.");
      return;
    }
    const up = parseFloat(document.getElementById("line-price").value);
    try {
      await api("POST", "budget_lines", {
        project_id: budgetProjectId,
        description: document.getElementById("line-desc").value,
        category: document.getElementById("line-cat").value,
        qty: parseFloat(document.getElementById("line-qty").value) || 1,
        unit_price: Number.isFinite(up) ? up : 0,
      });
      ev.target.reset();
      document.getElementById("line-qty").value = "1";
      syncLineQtyForBudgetLine();
      await loadLines();
      updateLineDraftSubtotal();
    } catch (e) {
      alert(e.message);
    }
  });

  syncLineQtyForBudgetLine();
  updateLineDraftSubtotal();

  document.getElementById("budget-btn-print")?.addEventListener("click", () => {
    document.body.classList.remove("print-mapa-zona");
    document.body.classList.add("print-presupuesto");
    window.print();
  });

  function syncMapPrintChrome() {
    const mapEl = document.getElementById("map");
    if (!mapEl) return;
    const on = state.printZone.pickingStep > 0;
    mapEl.classList.toggle("map-print-picking", on);
  }

  function resetPrintZonePicking() {
    state.printZone.pickingStep = 0;
    state.printZone.cornerA = null;
    syncMapPrintChrome();
  }

  document.getElementById("map-print-zone-mode")?.addEventListener("change", (ev) => {
    resetPrintZonePicking();
    if (ev.target.value !== "rect") {
      state.printZone.bounds = null;
    }
    setStatus("Listo.");
  });

  document.getElementById("map-print-rect-start")?.addEventListener("click", () => {
    const mode = document.getElementById("map-print-zone-mode")?.value;
    if (mode !== "rect") {
      alert('Elija «Rectángulo (2 clics)» en «Zona de impresión».');
      return;
    }
    setMode("");
    clearCableDraft(true);
    state.printZone.bounds = null;
    state.printZone.cornerA = null;
    state.printZone.pickingStep = 1;
    syncMapPrintChrome();
    setStatus("Primera esquina del área de impresión…");
  });

  document.getElementById("map-print-rect-clear")?.addEventListener("click", () => {
    state.printZone.bounds = null;
    resetPrintZonePicking();
    setStatus("Zona eliminada.");
  });

  document.getElementById("map-btn-print-map")?.addEventListener("click", () => {
    if (!state.map) return;
    switchTab("map");
    const mode = document.getElementById("map-print-zone-mode")?.value || "view";
    if (state.printZone.pickingStep > 0) {
      alert("Termine de marcar la segunda esquina o cancele el rectángulo.");
      return;
    }
    if (mode === "full") {
      fitBounds();
    } else if (mode === "rect") {
      const b = state.printZone.bounds;
      if (!b || !b.isValid()) {
        alert("Defina la zona: modo «Rectángulo», pulse «Definir zona» y haga dos clics en el mapa.");
        return;
      }
      state.map.fitBounds(b.pad(0.08));
    }
    document.body.classList.remove("print-presupuesto");
    requestAnimationFrame(() => {
      state.map.invalidateSize();
      setTimeout(() => {
        state.map.invalidateSize();
        document.body.classList.add("print-mapa-zona");
        window.print();
      }, mode === "view" ? 120 : 450);
    });
  });

  window.addEventListener("afterprint", () => {
    document.body.classList.remove("print-presupuesto");
    document.body.classList.remove("print-mapa-zona");
  });

  /* ---------- Mapa (existente ampliado) ---------- */
  function renderMarker(type, row) {
    const id = row.id;
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const icon =
      type === "mufas" ? iconMufaFor(row) : iconTerminalFor(row.marker_color || "green");
    const key = `${type}-${id}`;
    const rawName = row.name != null ? String(row.name).trim() : "";
    const tipLabel =
      type === "mufas"
        ? rawName || `Mufa #${id}`
        : rawName || `Terminal #${id}`;
    if (state.markers.has(key)) {
      const mk = state.markers.get(key);
      mk.setLatLng([lat, lng]);
      if (type === "mufas") {
        mk.setIcon(iconMufaFor(row));
      } else if (type === "terminals") {
        mk.setIcon(iconTerminalFor(row.marker_color || "green"));
      }
      const tt = mk.getTooltip();
      if (tt) tt.setContent(escapeHtml(tipLabel));
      else mk.bindTooltip(escapeHtml(tipLabel), { sticky: true });
      return;
    }
    const m = L.marker([lat, lng], { icon }).addTo(type === "mufas" ? state.mufaLayer : state.terminalLayer);
    m.bindTooltip(escapeHtml(tipLabel), { sticky: true });
    m.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      if (state.mode === "cable") {
        appendCableDraftVertex(lat, lng);
        return;
      }
      selectItem(type, id);
      openModalFromRow(type, row);
    });
    state.markers.set(key, m);
  }

  function renderCable(row) {
    const id = row.id;
    const path = row.path || [];
    const key = `cables-${id}`;
    const latlngs = path
      .map((p) => {
        if (!Array.isArray(p) || p.length < 2) return null;
        const la = Number(p[0]);
        const ln = Number(p[1]);
        if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
        return L.latLng(la, ln);
      })
      .filter(Boolean);
    if (latlngs.length < 2) {
      if (state.cables.has(key)) removeCable(id);
      return;
    }
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
      if (state.mode === "cable") {
        appendCableDraftVertex(e.latlng.lat, e.latlng.lng);
        return;
      }
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

  const CABLE_ANCHOR_RADIUS_M = 40;

  function geoDistanceM(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const t = (d) => (d * Math.PI) / 180;
    const dLat = t(lat2 - lat1);
    const dLng = t(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(t(lat1)) * Math.cos(t(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function neighborsWithin(lat, lng, radiusM, limit) {
    const out = [];
    (cache.mufas || []).forEach((m) => {
      const d = geoDistanceM(lat, lng, Number(m.lat), Number(m.lng));
      if (d <= radiusM) out.push({ kind: "mufa", id: m.id, name: m.name || "#" + m.id, dist: d });
    });
    (cache.terminals || []).forEach((t) => {
      const d = geoDistanceM(lat, lng, Number(t.lat), Number(t.lng));
      if (d <= radiusM) out.push({ kind: "terminal", id: t.id, name: t.name || "#" + t.id, dist: d });
    });
    out.sort((a, b) => a.dist - b.dist);
    return out.slice(0, limit);
  }

  function appendAnchorList(container, hits, labelPrefix) {
    if (!container) return;
    container.innerHTML = "";
    const p = document.createElement("p");
    p.className = "sub cable-anchor-label";
    p.textContent = labelPrefix;
    container.appendChild(p);
    if (!hits.length) {
      const e = document.createElement("p");
      e.className = "sub cable-anchor-empty";
      e.textContent = `Nada dentro de ~${CABLE_ANCHOR_RADIUS_M} m (ajuste el trazado o cree la mufa/terminal).`;
      container.appendChild(e);
      return;
    }
    const ul = document.createElement("ul");
    ul.className = "cable-anchor-list";
    hits.forEach((x) => {
      const li = document.createElement("li");
      const distStr = x.dist < 1000 ? `${Math.round(x.dist)} m` : `${(x.dist / 1000).toFixed(2)} km`;
      const kindLabel = x.kind === "mufa" ? "Mufa" : "Terminal";
      const snippet = `${labelPrefix}: cerca de ${kindLabel} "${x.name}" (~${distStr})`;
      li.innerHTML = `<span>${kindLabel} <strong>${escapeHtml(String(x.name))}</strong> · ${distStr}</span> `;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-sm";
      btn.textContent = "Añadir a notas";
      btn.addEventListener("click", () => {
        const ta = document.getElementById("f-notes");
        if (ta) ta.value = (ta.value ? ta.value.trim() + "\n" : "") + snippet;
      });
      li.appendChild(btn);
      ul.appendChild(li);
    });
    container.appendChild(ul);
  }

  /**
   * Si el trazado pasa cerca de una mufa (~40 m), rellena site cabecera, ref. manga y PON
   * como en esa mufa (prioriza la mufa del fin del trazo: típico desde cabecera hasta la manga creada).
   */
  function applyCableTraceSmartDefaults(path) {
    const hintEl = document.getElementById("f-cable-trace-hint");
    if (hintEl) {
      hintEl.hidden = true;
      hintEl.textContent = "";
    }
    if (!path || path.length < 2) return;
    const p0 = path[0];
    const p1 = path[path.length - 1];
    const n0 = neighborsWithin(p0[0], p0[1], CABLE_ANCHOR_RADIUS_M, 8);
    const n1 = neighborsWithin(p1[0], p1[1], CABLE_ANCHOR_RADIUS_M, 8);
    const m0 = n0.find((x) => x.kind === "mufa");
    const m1 = n1.find((x) => x.kind === "mufa");

    let mangaMufaId = null;
    if (m1 && m0 && m0.id === m1.id) {
      mangaMufaId = m1.id;
    } else if (m1 && m0 && m0.id !== m1.id) {
      mangaMufaId = m1.id;
    } else if (m1) {
      mangaMufaId = m1.id;
    } else if (m0) {
      mangaMufaId = m0.id;
    }

    if (!mangaMufaId) return;
    const mangaRow = cache.mufas.find((x) => x.id === mangaMufaId);
    if (!mangaRow) return;

    const csc = document.getElementById("f-cable-scope-site");
    const mangaInp = document.getElementById("f-manga");
    const nameInp = document.getElementById("f-name");

    const siteFromMufa =
      mangaRow.site_id != null && mangaRow.site_id !== "" ? Number(mangaRow.site_id) : null;
    const siteFromCtx =
      state.mapFieldContext.siteId != null ? Number(state.mapFieldContext.siteId) : null;
    let chosenSite = siteFromMufa || siteFromCtx;
    if (!chosenSite && mangaRow.linked_pon_id) {
      const xp = findPon(Number(mangaRow.linked_pon_id));
      if (xp) chosenSite = xp.site.id;
    } else if (!chosenSite && mangaRow.source_olt_card_id) {
      const pk = findCard(Number(mangaRow.source_olt_card_id));
      if (pk) chosenSite = pk.site.id;
    }

    if (csc && chosenSite) {
      csc.value = String(chosenSite);
      state.modalPonScopeKey = faPonScopeKey(csc.value);
    }

    fillPonCascadeSiteOptions("f-cable-src");
    if (mangaRow.linked_pon_id) {
      applyPonCascadeFromPonId("f-cable-src", mangaRow.linked_pon_id);
    } else if (mangaRow.source_olt_card_id && mangaRow.source_pon_number != null) {
      applyPonCascadeFromSlot("f-cable-src", mangaRow.source_olt_card_id, mangaRow.source_pon_number);
    } else {
      resetPonCascade("f-cable-src", true);
    }

    if (mangaInp && !String(mangaInp.value || "").trim()) {
      mangaInp.value = mangaRow.name || "";
    }
    if (nameInp && String(nameInp.value || "").trim() === "Manga" && (mangaRow.name || "").trim()) {
      nameInp.value = mangaRow.name.trim();
    }

    const st = chosenSite ? findSite(chosenSite) : null;
    const siteLab = st ? st.name || `Site #${chosenSite}` : chosenSite ? `Site #${chosenSite}` : "—";
    let hint = `Rellenado según la mufa «${mangaRow.name || "#" + mangaMufaId}»: cabecera «${siteLab}», referencia manga y PON (si la mufa ya los tenía).`;
    if (m0 && m1 && m0.id !== m1.id) {
      const r0 = cache.mufas.find((x) => x.id === m0.id);
      hint += ` Origen cercano a «${r0?.name || m0.name}» → destino manga «${mangaRow.name || m1.name}».`;
    }
    if (hintEl) {
      hintEl.textContent = hint;
      hintEl.hidden = false;
    }
  }

  function renderCableAnchorHints(path) {
    const wrap = document.getElementById("f-cable-anchor-detect");
    const startEl = document.getElementById("f-cable-anchor-start");
    const endEl = document.getElementById("f-cable-anchor-end");
    if (!wrap || !startEl || !endEl) return;
    if (!path || path.length < 2) {
      wrap.hidden = true;
      return;
    }
    const p0 = path[0];
    const p1 = path[path.length - 1];
    const n0 = neighborsWithin(p0[0], p0[1], CABLE_ANCHOR_RADIUS_M, 8);
    const n1 = neighborsWithin(p1[0], p1[1], CABLE_ANCHOR_RADIUS_M, 8);
    appendAnchorList(startEl, n0, "Origen del trazado");
    appendAnchorList(endEl, n1, "Fin del trazado");
    wrap.hidden = false;
  }

  async function loadAll() {
    setStatus("Cargando…");
    try {
      await fetchInventoryIntoCache();

      state.markers.forEach((m) => state.map.removeLayer(m));
      state.markers.clear();
      state.cables.forEach((pl) => state.map.removeLayer(pl));
      state.cables.clear();

      cache.mufas.forEach((r) => renderMarker("mufas", r));
      cache.terminals.forEach((r) => renderMarker("terminals", r));
      cache.cables.forEach((r) => renderCable(r));

      renderLists();
      await loadHierarchy();
      try {
        if (!readStoredMapView()) {
          fitBounds();
        } else {
          applyStoredMapView();
        }
      } catch (err) {
        console.warn("Vista inicial mapa:", err);
        fitBounds();
      }
      state.mapViewPersistenceEnabled = true;
      saveStoredMapView();
      setStatus("Listo.");
    } catch (e) {
      console.error(e);
      setStatus("Error: " + e.message);
    }
  }

  /** Extiende bounds solo con capas que tienen geometría válida (evita fallos tipo getLatLng). */
  function safeExtendBoundsFromLayer(layer, b, ctr) {
    if (!layer) return;
    if (typeof layer.eachLayer === "function") {
      layer.eachLayer((ch) => safeExtendBoundsFromLayer(ch, b, ctr));
      return;
    }
    if (typeof layer.getLatLng === "function") {
      try {
        const ll = layer.getLatLng();
        if (ll && Number.isFinite(ll.lat) && Number.isFinite(ll.lng)) {
          b.extend(ll);
          ctr.n++;
        }
      } catch (_) {}
      return;
    }
    if (typeof layer.getBounds === "function") {
      try {
        const bb = layer.getBounds();
        if (bb && bb.isValid()) {
          b.extend(bb);
          ctr.n++;
        }
      } catch (_) {}
    }
  }

  function fitBounds() {
    if (!state.map) return;
    try {
      const b = L.latLngBounds();
      const ctr = { n: 0 };
      [state.buildingLayer, state.mufaLayer, state.terminalLayer, state.cableLayer].forEach((lg) => {
        safeExtendBoundsFromLayer(lg, b, ctr);
      });
      if (ctr.n === 0) {
        if (!applyStoredMapView()) state.map.setView([40.4168, -3.7038], 6);
        return;
      }
      if (b.isValid()) state.map.fitBounds(b.pad(0.15), { animate: false });
    } catch (e) {
      console.warn("fitBounds:", e);
      if (!applyStoredMapView()) state.map.setView([40.4168, -3.7038], 6);
    }
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
            : type === "terminals"
              ? (() => {
                  const mount = terminalMountLabel(r);
                  const leg = !mount && (r.source_pon_id || r.source_olt_card_id) ? ponCascadeLabel(r) : "";
                  const mc = r.marker_color || "green";
                  const ml = { green: "M V", yellow: "M A", red: "M R" };
                  let m = "";
                  if (mount) m += escapeHtml(mount) + " · ";
                  else if (leg) m += escapeHtml(leg) + " (leg.) · ";
                  m += ml[mc] || mc;
                  if (r.drop_fiber) m += ` · TIA${r.drop_fiber}`;
                  return `${m} · ${Number(r.lat).toFixed(5)}, ${Number(r.lng).toFixed(5)}`;
                })()
              : `${Number(r.lat).toFixed(5)}, ${Number(r.lng).toFixed(5)}`;
        if (type === "mufas") {
          const pl = ponCascadeLabel(r);
          if (pl) meta += ` · ${escapeHtml(pl)}`;
        }
        if (type === "cables" && r.fiber_spec) {
          meta += ` · ${escapeHtml(r.fiber_spec)}`;
        }
        if (type === "cables" && (r.manga_label || r.splice_count)) {
          meta += ` · ${escapeHtml(r.manga_label || "")}${r.splice_count ? " · " + r.splice_count + " empalmes" : ""}`;
        }
        if (type === "cables") {
          const pl = ponCascadeLabel(r);
          if (pl) meta += ` · ${escapeHtml(pl)}`;
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
    if (!show) {
      state.modalPonExclude = null;
      state.modalPonScopeKey = -1;
      const th = document.getElementById("f-cable-trace-hint");
      if (th) {
        th.hidden = true;
        th.textContent = "";
      }
    }
  }

  /**
   * Misma ventana que mufas/terminales: nombre, lat/lng, dirección, notas; edición sites/OLT en el árbol.
   * row: { id?, name, address?, lat?, lng?, notes? } — sin id = alta.
   */
  async function openBuildingModal(row) {
    await loadHierarchy();
    const rid = row.id != null && row.id !== "" ? Number(row.id) : 0;
    const isNew = !rid;
    document.getElementById("modal-title").textContent = isNew ? "Nuevo edificio" : "Edificio";
    document.getElementById("f-type").value = "buildings";
    document.getElementById("f-id").value = isNew ? "" : String(rid);
    document.getElementById("f-name").value = row.name != null && row.name !== "" ? row.name : "Edificio";
    document.getElementById("f-building-address").value = row.address != null ? row.address : "";
    document.getElementById("f-lat").value = row.lat != null && row.lat !== "" ? row.lat : "";
    document.getElementById("f-lng").value = row.lng != null && row.lng !== "" ? row.lng : "";
    document.getElementById("f-notes").value = row.notes != null ? row.notes : "";
    document.getElementById("f-mufa-extra").style.display = "none";
    document.getElementById("f-terminal-extra").style.display = "none";
    document.getElementById("f-cable-extra").style.display = "none";
    document.getElementById("f-building-extra").style.display = "block";
    document.getElementById("f-latlng-row").style.display = "grid";
    document.getElementById("btn-fiber-map").style.display = "none";
    state.modalPonExclude = null;
    state.modalPonScopeKey = -1;
    state.pendingPoint = null;
    fillBuildingSitesHint(isNew ? null : rid);
    const delRow = document.getElementById("f-building-delete-row");
    const delBtn = document.getElementById("modal-del-building");
    if (delRow && delBtn) {
      delRow.hidden = isNew;
      delBtn.onclick = isNew
        ? null
        : async () => {
            if (!confirm("¿Borrar edificio? Los sites quedarán sin edificio.")) return;
            try {
              await api("DELETE", "buildings", null, rid);
              if (netSelection && netSelection.type === "building" && netSelection.id === rid) {
                netSelection = null;
              }
              if (state.mapFieldContext.buildingId === rid) state.mapFieldContext.buildingId = null;
              showModal(false);
              await loadHierarchy();
              renderNetDetail();
            } catch (e) {
              alert(e.message);
            }
          };
    }
    showModal(true);
  }

  function collectUsedInputFibers(excludeIdx) {
    const used = new Set();
    state.mufaSplittersDraft.forEach((s, i) => {
      if (i === excludeIdx) return;
      const n = Number(s.input_fiber);
      if (n >= 1 && n <= 12) used.add(n);
    });
    return used;
  }

  /** Pelos TIA 1–12 tomados por splitters de otras mufas (misma cabecera) o por fibras en mangas cuyo destino es esta mufa. */
  function collectUsedInputFibersForSpldlg(excludeIdx) {
    const used = new Set(collectUsedInputFibers(excludeIdx));
    const cardEl = document.getElementById("f-mufa-spldlg-card")?.value;
    const cid = cardEl ? Number(cardEl) : 0;
    const buckets = bucketSetForSplitterBlocking(cid);
    const curMid =
      state.modalPonExclude && state.modalPonExclude.kind === "mufa" ? state.modalPonExclude.id : null;

    (cache.mufas || []).forEach((m) => {
      if (curMid != null && m.id === curMid) return;
      if (!entityMatchesSplitterBuckets(m.site_id, buckets)) return;
      getMufaSplitters(m).forEach((ent) => {
        const n = Number(ent.input_fiber);
        if (n >= 1 && n <= 12) used.add(n);
      });
    });

    (cache.cables || []).forEach((c) => {
      if (!entityMatchesSplitterBuckets(c.site_id, buckets)) return;
      if (curMid == null || curMid <= 0) return;
      const fc = Math.min(12, Math.max(1, parseInt(String(c.fiber_count), 10) || 12));
      const fm = normalizeFiberMap(c.fiber_map);
      for (let i = 1; i <= fc; i++) {
        if (fiberMapSlotTargetsMufa(fm, i, curMid)) used.add(i);
      }
    });

    return used;
  }

  function fillSpldlgInputFiberSelect(excludeIdx, selected) {
    const sel = document.getElementById("f-mufa-spldlg-input-fiber");
    if (!sel) return;
    const used = collectUsedInputFibersForSpldlg(excludeIdx);
    const prev = selected != null ? String(selected) : sel.value;
    sel.innerHTML = '<option value="">—</option>';
    for (let n = 1; n <= 12; n++) {
      if (used.has(n) && String(n) !== prev) continue;
      const name = TIA_PELO_NAMES[n] || String(n);
      sel.innerHTML += `<option value="${n}">${n} — ${escapeHtml(name)}</option>`;
    }
    if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
  }

  function splitterDlgSummaryLine(s) {
    const ratio = s.ratio ? String(s.ratio) : "?";
    const inf = s.input_fiber >= 1 && s.input_fiber <= 12 ? `TIA${s.input_fiber}` : "?";
    const pn = s.source_pon_number != null ? `P${s.source_pon_number}` : "P?";
    return `${ratio} · pelo ${inf} · ${pn}`;
  }

  function renderMufaSplittersList() {
    const ul = document.getElementById("f-mufa-splitters-list");
    if (!ul) return;
    ul.innerHTML = "";
    if (!state.mufaSplittersDraft.length) {
      const li = document.createElement("li");
      li.className = "sub";
      li.style.border = "none";
      li.textContent = "Ningún splitter. Pulse «Agregar splitter».";
      ul.appendChild(li);
      return;
    }
    state.mufaSplittersDraft.forEach((s, idx) => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = `${idx + 1}. ${splitterDlgSummaryLine(s)}`;
      const div = document.createElement("div");
      div.className = "mufa-spl-actions";
      const bEd = document.createElement("button");
      bEd.type = "button";
      bEd.className = "btn-sm";
      bEd.textContent = "Editar";
      bEd.addEventListener("click", () => void openMufaSplitterDialog(idx));
      const bRm = document.createElement("button");
      bRm.type = "button";
      bRm.className = "btn-sm";
      bRm.textContent = "Quitar";
      bRm.addEventListener("click", () => {
        state.mufaSplittersDraft.splice(idx, 1);
        renderMufaSplittersList();
      });
      div.appendChild(bEd);
      div.appendChild(bRm);
      li.appendChild(span);
      li.appendChild(div);
      ul.appendChild(li);
    });
  }

  function mufaIoRowHasContent(obj) {
    return Object.values(obj).some((v) => String(v != null ? v : "").trim() !== "");
  }

  function parseMufaFiberIo(row) {
    const empty = { entradas: [], salidas: [] };
    if (!row) return empty;
    let raw = row.fiber_io_json;
    if (raw == null || raw === "") return empty;
    if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
      return {
        entradas: Array.isArray(raw.entradas) ? raw.entradas : [],
        salidas: Array.isArray(raw.salidas) ? raw.salidas : [],
      };
    }
    try {
      const j = JSON.parse(String(raw));
      if (!j || typeof j !== "object") return empty;
      return {
        entradas: Array.isArray(j.entradas) ? j.entradas : [],
        salidas: Array.isArray(j.salidas) ? j.salidas : [],
      };
    } catch {
      return empty;
    }
  }

  function appendMufaIoEntradaRow(ul, data) {
    const li = document.createElement("li");
    li.className = "mufa-io-row";
    li.innerHTML = `<div class="mufa-io-fields">
      <label><span>Nombre / ref.</span><input type="text" class="mufa-io-in mufa-io-e-label" autocomplete="off" placeholder="ej. Troncal principal" /></label>
      <label><span>Origen</span><input type="text" class="mufa-io-in mufa-io-e-origen" autocomplete="off" placeholder="Cabecera, manga anterior…" /></label>
      <label><span>Pelos TIA</span><input type="text" class="mufa-io-in mufa-io-e-pelos" autocomplete="off" placeholder="ej. 1–12" /></label>
      <label><span>Notas</span><input type="text" class="mufa-io-in mufa-io-e-notas" autocomplete="off" /></label>
    </div>
    <button type="button" class="btn-sm mufa-io-rm">Quitar</button>`;
    ul.appendChild(li);
    const d = data || {};
    const l = li.querySelector(".mufa-io-e-label");
    const o = li.querySelector(".mufa-io-e-origen");
    const p = li.querySelector(".mufa-io-e-pelos");
    const n = li.querySelector(".mufa-io-e-notas");
    if (l && d.label != null) l.value = String(d.label);
    if (o && d.origen != null) o.value = String(d.origen);
    if (p && d.pelos != null) p.value = String(d.pelos);
    if (n && d.notas != null) n.value = String(d.notas);
  }

  function appendMufaIoSalidaRow(ul, data) {
    const li = document.createElement("li");
    li.className = "mufa-io-row";
    li.innerHTML = `<div class="mufa-io-fields">
      <label><span>Nombre / ref.</span><input type="text" class="mufa-io-in mufa-io-s-label" autocomplete="off" placeholder="ej. Rama calle Norte" /></label>
      <label><span>Pelos (TIA)</span><input type="text" class="mufa-io-in mufa-io-s-pelos" autocomplete="off" placeholder="ej. 3–8" /></label>
      <label><span>Splitter / ratio</span><input type="text" class="mufa-io-in mufa-io-s-ratio" autocomplete="off" placeholder="1×16, PON completo…" /></label>
      <label class="mufa-io-span2"><span>Destino</span><input type="text" class="mufa-io-in mufa-io-s-destino" autocomplete="off" placeholder="Terminales, otra mufa del barrio…" /></label>
      <label class="mufa-io-span2"><span>Notas</span><input type="text" class="mufa-io-in mufa-io-s-notas" autocomplete="off" /></label>
    </div>
    <button type="button" class="btn-sm mufa-io-rm">Quitar</button>`;
    ul.appendChild(li);
    const d = data || {};
    const lab = li.querySelector(".mufa-io-s-label");
    const pel = li.querySelector(".mufa-io-s-pelos");
    const rat = li.querySelector(".mufa-io-s-ratio");
    const des = li.querySelector(".mufa-io-s-destino");
    const not = li.querySelector(".mufa-io-s-notas");
    if (lab && d.label != null) lab.value = String(d.label);
    if (pel && d.pelos != null) pel.value = String(d.pelos);
    if (rat && d.ratio != null) rat.value = String(d.ratio);
    if (des && d.destino != null) des.value = String(d.destino);
    if (not && d.notas != null) not.value = String(d.notas);
  }

  function renderMufaFiberIoLists(io) {
    const ue = document.getElementById("f-mufa-io-entradas");
    const us = document.getElementById("f-mufa-io-salidas");
    if (!ue || !us) return;
    ue.innerHTML = "";
    us.innerHTML = "";
    const src = io && typeof io === "object" ? io : { entradas: [], salidas: [] };
    (src.entradas || []).forEach((d) => appendMufaIoEntradaRow(ue, d));
    (src.salidas || []).forEach((d) => appendMufaIoSalidaRow(us, d));
  }

  function collectMufaFiberIoPayload() {
    const entradas = [];
    document.querySelectorAll("#f-mufa-io-entradas > li").forEach((li) => {
      const o = {
        label: li.querySelector(".mufa-io-e-label")?.value?.trim() || "",
        origen: li.querySelector(".mufa-io-e-origen")?.value?.trim() || "",
        pelos: li.querySelector(".mufa-io-e-pelos")?.value?.trim() || "",
        notas: li.querySelector(".mufa-io-e-notas")?.value?.trim() || "",
      };
      if (mufaIoRowHasContent(o)) entradas.push(o);
    });
    const salidas = [];
    document.querySelectorAll("#f-mufa-io-salidas > li").forEach((li) => {
      const o = {
        label: li.querySelector(".mufa-io-s-label")?.value?.trim() || "",
        pelos: li.querySelector(".mufa-io-s-pelos")?.value?.trim() || "",
        ratio: li.querySelector(".mufa-io-s-ratio")?.value?.trim() || "",
        destino: li.querySelector(".mufa-io-s-destino")?.value?.trim() || "",
        notas: li.querySelector(".mufa-io-s-notas")?.value?.trim() || "",
      };
      if (mufaIoRowHasContent(o)) salidas.push(o);
    });
    return { entradas, salidas };
  }

  function showMufaSplitterBackdrop(show) {
    const bd = document.getElementById("mufa-splitter-dlg-backdrop");
    if (!bd) return;
    bd.classList.toggle("open", show);
    bd.setAttribute("aria-hidden", show ? "false" : "true");
  }

  async function openMufaSplitterDialog(editIdx) {
    await fetchInventoryIntoCache();
    state.mufaSplitterDlgIdx = editIdx === undefined || editIdx === null ? null : editIdx;
    fillPonCascadeSiteOptions("f-mufa-spldlg");
    document.getElementById("mufa-splitter-dlg-title").textContent =
      state.mufaSplitterDlgIdx === null ? "Nuevo splitter" : "Editar splitter";
    const existing =
      state.mufaSplitterDlgIdx !== null ? state.mufaSplittersDraft[state.mufaSplitterDlgIdx] : null;
    document.getElementById("f-mufa-spldlg-ratio").value =
      existing && existing.ratio != null ? String(existing.ratio) : "";
    if (existing && existing.linked_pon_id) {
      applyPonCascadeFromPonId("f-mufa-spldlg", existing.linked_pon_id);
    } else if (existing && existing.source_olt_card_id && existing.source_pon_number) {
      applyPonCascadeFromSlot("f-mufa-spldlg", existing.source_olt_card_id, existing.source_pon_number);
    } else {
      resetPonCascade("f-mufa-spldlg", true);
    }
    fillSpldlgInputFiberSelect(state.mufaSplitterDlgIdx, existing ? existing.input_fiber : null);
    showMufaSplitterBackdrop(true);
  }

  function saveMufaSplitterDialog() {
    const ratio = document.getElementById("f-mufa-spldlg-ratio").value || "";
    const ifib = parseInt(document.getElementById("f-mufa-spldlg-input-fiber").value, 10);
    const ponEl = document.getElementById("f-mufa-spldlg-pon");
    const rawPon = ponEl && ponEl.value ? String(ponEl.value).trim() : "";
    const pon = ponFieldsFromRawPon(rawPon);
    if (!(ifib >= 1 && ifib <= 12)) {
      alert("Elija el pelo entrante (TIA 1–12).");
      return;
    }
    if (!(pon.source_olt_card_id && pon.source_pon_number)) {
      alert("Elija site, OLT, tarjeta y PON del splitter.");
      return;
    }
    const blockedPon = getBlockedPonNumsForSplitterDialog(pon.source_olt_card_id, state.mufaSplitterDlgIdx);
    if (blockedPon.has(pon.source_pon_number)) {
      alert(
        "Ese PON ya está usado (origen de la mufa, otro splitter, otra mufa/manga o terminal). Elija otro puerto.",
      );
      return;
    }
    const usedPelos = collectUsedInputFibersForSpldlg(state.mufaSplitterDlgIdx);
    if (usedPelos.has(ifib)) {
      alert(
        "Ese pelo (TIA) ya está usado en otro splitter (misma cabecera) o en el mapa de fibras de una manga con destino a esta mufa.",
      );
      return;
    }
    const entry = {
      qty: 1,
      ratio,
      input_fiber: ifib,
      source_pon_id: pon.source_pon_id,
      source_olt_card_id: pon.source_olt_card_id,
      source_pon_number: pon.source_pon_number,
      linked_pon_id: pon.source_pon_id,
    };
    if (state.mufaSplitterDlgIdx === null) {
      state.mufaSplittersDraft.push(entry);
    } else {
      state.mufaSplittersDraft[state.mufaSplitterDlgIdx] = entry;
    }
    showMufaSplitterBackdrop(false);
    renderMufaSplittersList();
  }

  async function openModalFromRow(type, row) {
    await loadHierarchy();
    const rid = row.id != null && row.id !== "" ? Number(row.id) : 0;
    state.modalPonExclude =
      type === "mufas" && rid > 0
        ? { kind: "mufa", id: rid }
        : type === "cables" && rid > 0
          ? { kind: "cable", id: rid }
          : null;
    state.modalPonScopeKey = -1;
    if (type === "terminals") {
      const mc = row.marker_color || "green";
      const ml = { green: "V", yellow: "A", red: "R" };
      let tt = "Term · mapa " + (ml[mc] || mc);
      const mount = terminalMountLabel(row);
      if (mount) tt += " · " + mount;
      else if (row.source_pon_id || row.source_olt_card_id) tt += " · " + ponCascadeLabel(row) + " (legado)";
      if (row.drop_fiber) tt += " · TIA" + row.drop_fiber;
      document.getElementById("modal-title").textContent = tt;
    } else if (type === "mufas") {
      let tt = "Mufa";
      const pl = ponCascadeLabel(row);
      if (pl) tt += " · " + pl;
      document.getElementById("modal-title").textContent = tt;
    } else {
      document.getElementById("modal-title").textContent = "Cable";
    }
    document.getElementById("f-type").value = type;
    document.getElementById("f-id").value = row.id != null ? row.id : "";
    document.getElementById("f-name").value = row.name || "";
    document.getElementById("f-notes").value = row.notes || "";

    document.getElementById("f-mufa-extra").style.display = type === "mufas" ? "block" : "none";
    document.getElementById("f-terminal-extra").style.display = type === "terminals" ? "block" : "none";
    document.getElementById("f-cable-extra").style.display = type === "cables" ? "block" : "none";
    document.getElementById("f-building-extra").style.display = "none";
    document.getElementById("f-latlng-row").style.display = type === "cables" ? "none" : "grid";
    document.getElementById("btn-fiber-map").style.display = type === "cables" && row.id ? "inline-block" : "none";

    if (type === "mufas") {
      document.getElementById("f-lat").value = row.lat != null ? row.lat : "";
      document.getElementById("f-lng").value = row.lng != null ? row.lng : "";
      document.getElementById("f-model").value = row.model || "";
      document.getElementById("f-splice").value = row.splice_count ?? 0;
      {
        const sidEl = document.getElementById("f-site-id");
        sidEl.value =
          row.site_id != null && row.site_id !== ""
            ? String(row.site_id)
            : state.mapFieldContext.siteId != null
              ? String(state.mapFieldContext.siteId)
              : "";
        state.modalPonScopeKey = faPonScopeKey(sidEl.value);
      }
      fillPonCascadeSiteOptions("f-mufa-src");
      if (row.linked_pon_id) applyPonCascadeFromPonId("f-mufa-src", row.linked_pon_id);
      else if (row.source_olt_card_id && row.source_pon_number)
        applyPonCascadeFromSlot("f-mufa-src", row.source_olt_card_id, row.source_pon_number);
      else resetPonCascade("f-mufa-src", true);
      state.mufaSplittersDraft = getMufaSplitters(row).map((s) => ({ ...s }));
      const uc = document.getElementById("f-mufa-splitter-use-color");
      if (uc) uc.checked = Number(row.splitter_use_fiber_color) === 1;
      renderMufaSplittersList();
      renderMufaFiberIoLists(parseMufaFiberIo(row));
    }
    if (type === "terminals") {
      document.getElementById("f-lat").value = row.lat != null ? row.lat : "";
      document.getElementById("f-lng").value = row.lng != null ? row.lng : "";
      document.getElementById("f-ports").value = row.port_count ?? 8;
      const mc = row.marker_color || "green";
      document.querySelectorAll('input[name="f-terminal-marker"]').forEach((inp) => {
        inp.checked = inp.value === mc;
      });
      const df = document.getElementById("f-terminal-drop-fiber");
      if (df) {
        df.value =
          row.drop_fiber != null && row.drop_fiber >= 1 && row.drop_fiber <= 12
            ? String(row.drop_fiber)
            : "";
      }
      fillTermDropSelects();
      const attach = row.drop_cable_id && !row.drop_mufa_id ? "cable" : "mufa";
      document.querySelectorAll('input[name="f-term-drop-src"]').forEach((inp) => {
        inp.checked = inp.value === attach;
      });
      syncTermDropAttachUi();
      const dm = document.getElementById("f-term-drop-mufa");
      const dc = document.getElementById("f-term-drop-cable");
      if (dm) dm.value = row.drop_mufa_id != null ? String(row.drop_mufa_id) : "";
      if (dc) dc.value = row.drop_cable_id != null ? String(row.drop_cable_id) : "";
      const sp = document.getElementById("f-term-splitter");
      if (sp) sp.value = row.splitter_ref != null ? row.splitter_ref : "";
    }
    if (type === "cables") {
      const traceHint = document.getElementById("f-cable-trace-hint");
      if (traceHint) {
        traceHint.hidden = true;
        traceHint.textContent = "";
      }
      let tt = "Cable";
      const pl = ponCascadeLabel(row);
      if (pl) tt += " · " + pl;
      document.getElementById("modal-title").textContent = tt;
      document.getElementById("f-fibers").value = row.fiber_count ?? 12;
      document.getElementById("f-color").value = row.color || "#2563eb";
      document.getElementById("f-manga").value = row.manga_label || "";
      document.getElementById("f-splice-cable").value = row.splice_count ?? 0;
      setFiberSpecOnForm(row.fiber_spec || "");
      {
        const csc = document.getElementById("f-cable-scope-site");
        if (csc) {
          csc.value =
            row.site_id != null && row.site_id !== ""
              ? String(row.site_id)
              : state.mapFieldContext.siteId != null
                ? String(state.mapFieldContext.siteId)
                : "";
          state.modalPonScopeKey = faPonScopeKey(csc.value);
        }
      }
      fillPonCascadeSiteOptions("f-cable-src");
      if (row.source_pon_id) applyPonCascadeFromPonId("f-cable-src", row.source_pon_id);
      else if (row.source_olt_card_id && row.source_pon_number)
        applyPonCascadeFromSlot("f-cable-src", row.source_olt_card_id, row.source_pon_number);
      else resetPonCascade("f-cable-src", true);
      renderCableAnchorHints(row.path && row.path.length >= 2 ? row.path : null);
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
      marker_color: "green",
      drop_fiber: null,
      drop_mufa_id: null,
      drop_cable_id: null,
      splitter_ref: "",
      notes: "",
      site_id: type === "mufas" && state.mapFieldContext.siteId != null ? state.mapFieldContext.siteId : null,
      linked_pon_id: null,
      splitter_enabled: 0,
      splitters_json: "[]",
      splitter_use_fiber_color: 0,
    });
    document.getElementById("f-id").value = "";
  }

  async function openNewCable(path) {
    await loadHierarchy();
    document.getElementById("modal-title").textContent = "Nuevo cable / manga";
    document.getElementById("f-type").value = "cables";
    document.getElementById("f-id").value = "";
    document.getElementById("f-name").value = "Manga";
    document.getElementById("f-notes").value = "";
    document.getElementById("f-fibers").value = 12;
    document.getElementById("f-color").value = "#2563eb";
    document.getElementById("f-manga").value = "";
    document.getElementById("f-splice-cable").value = 0;
    setFiberSpecOnForm("");
    state.modalPonExclude = null;
    const csc = document.getElementById("f-cable-scope-site");
    if (csc) {
      csc.value =
        state.mapFieldContext.siteId != null ? String(state.mapFieldContext.siteId) : "";
      state.modalPonScopeKey = faPonScopeKey(csc.value);
    }
    fillPonCascadeSiteOptions("f-cable-src");
    resetPonCascade("f-cable-src", true);
    applyCableTraceSmartDefaults(path);
    document.getElementById("f-mufa-extra").style.display = "none";
    document.getElementById("f-terminal-extra").style.display = "none";
    document.getElementById("f-building-extra").style.display = "none";
    document.getElementById("f-cable-extra").style.display = "block";
    document.getElementById("f-latlng-row").style.display = "none";
    document.getElementById("btn-fiber-map").style.display = "none";
    state.pendingPoint = { path };
    showModal(true);
    renderCableAnchorHints(path);
  }

  document.querySelectorAll("#fiber-presets button").forEach((b) => {
    b.addEventListener("click", () => {
      document.getElementById("f-fibers").value = b.dataset.fibers;
    });
  });

  const fiberSpecSel = document.getElementById("f-fiber-spec");
  if (fiberSpecSel) {
    fiberSpecSel.addEventListener("change", syncFiberSpecCustomVisibility);
  }

  wirePonCascadeListeners("f-mufa-src");
  wirePonCascadeListeners("f-mufa-spldlg");
  wirePonCascadeListeners("f-cable-src");
  ["f-mufa-src-site", "f-mufa-src-olt", "f-mufa-src-card", "f-mufa-src-pon"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => void refreshSpldlgIfOpen());
  });
  document.getElementById("f-mufa-splitter-add")?.addEventListener("click", () => void openMufaSplitterDialog(null));
  document.getElementById("f-mufa-extra")?.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.classList && t.classList.contains("mufa-io-rm")) {
      e.preventDefault();
      t.closest("li")?.remove();
    }
  });
  document.getElementById("f-mufa-io-add-entrada")?.addEventListener("click", () => {
    const ul = document.getElementById("f-mufa-io-entradas");
    if (ul) appendMufaIoEntradaRow(ul, {});
  });
  document.getElementById("f-mufa-io-add-salida")?.addEventListener("click", () => {
    const ul = document.getElementById("f-mufa-io-salidas");
    if (ul) appendMufaIoSalidaRow(ul, {});
  });
  document.getElementById("mufa-splitter-dlg-cancel")?.addEventListener("click", () => showMufaSplitterBackdrop(false));
  document.getElementById("mufa-splitter-dlg-save")?.addEventListener("click", () => saveMufaSplitterDialog());
  document.getElementById("f-site-id")?.addEventListener("change", () => {
    state.modalPonScopeKey = faPonScopeKey(document.getElementById("f-site-id").value);
    const c = document.getElementById("f-mufa-src-card")?.value;
    if (c) fillPonCascadePonOptionsAuto("f-mufa-src", c);
    void refreshSpldlgIfOpen();
  });
  document.getElementById("f-cable-scope-site")?.addEventListener("change", () => {
    state.modalPonScopeKey = faPonScopeKey(document.getElementById("f-cable-scope-site").value);
    const c = document.getElementById("f-cable-src-card")?.value;
    if (c) fillPonCascadePonOptionsAuto("f-cable-src", c);
  });
  document.querySelectorAll('input[name="f-term-drop-src"]').forEach((inp) => {
    inp.addEventListener("change", syncTermDropAttachUi);
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
    fiberModal.fiberCount = Math.max(1, Math.min(288, parseInt(String(row.fiber_count), 10) || 12));
    const specHint = row.fiber_spec ? ` · ${row.fiber_spec}` : "";
    document.getElementById("fiber-modal-title").textContent =
      "Pelos · " + (row.name || "Cable #" + row.id) + specHint;
    const seqCb = document.getElementById("fiber-seq-mode");
    const seqBar = document.getElementById("fiber-seq-bar");
    if (seqCb) seqCb.checked = false;
    if (seqBar) seqBar.hidden = true;
    const mid = findCableEndMufaIdFromPath(row.path);
    const mu = mid ? findRow("mufas", mid) : null;
    const spls = mu ? getMufaSplitters(mu) : [];
    const hintEl = document.getElementById("fiber-mufa-split-hint");
    const btnSpl = document.getElementById("fiber-apply-mufa-splits");
    if (hintEl && btnSpl) {
      if (mu && spls.length > 0) {
        hintEl.hidden = false;
        hintEl.textContent = `Mufa al fin del trazo: «${mu.name || "Mufa #" + mu.id}» (${spls.length} splitter(s)). Puede rellenar pelos libres automáticamente.`;
        btnSpl.hidden = false;
        btnSpl.dataset.mufaId = String(mid);
      } else {
        hintEl.hidden = true;
        hintEl.textContent = "";
        btnSpl.hidden = true;
        btnSpl.dataset.mufaId = "";
      }
    }
    renderFiberGrid(row.fiber_count || 12);
    document.getElementById("fiber-editor").hidden = true;
    document.getElementById("fiber-modal-backdrop").classList.add("open");
    document.getElementById("fiber-modal-backdrop").setAttribute("aria-hidden", "false");
  }

  function applyFiberEditorToMap() {
    const i = fiberModal.editingIndex;
    const ed = document.getElementById("fiber-editor");
    if (!i || !ed || ed.hidden) return;
    fiberModal.map[String(i)] = {
      target: document.getElementById("fiber-ed-target").value,
      note: document.getElementById("fiber-ed-note").value,
    };
  }

  function updateFiberSeqBar() {
    const bar = document.getElementById("fiber-seq-bar");
    const pos = document.getElementById("fiber-seq-pos");
    const cb = document.getElementById("fiber-seq-mode");
    if (!bar || !pos) return;
    const on = cb && cb.checked;
    bar.hidden = !on;
    if (on) {
      const cur = fiberModal.editingIndex || 1;
      pos.textContent = `Pelo ${cur} / ${fiberModal.fiberCount}`;
    }
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
    updateFiberSeqBar();
  }

  document.getElementById("fiber-ed-cancel").addEventListener("click", () => {
    document.getElementById("fiber-editor").hidden = true;
    updateFiberSeqBar();
  });
  document.getElementById("fiber-ed-save").addEventListener("click", () => {
    const i = fiberModal.editingIndex;
    if (!i) return;
    applyFiberEditorToMap();
    const row = findRow("cables", fiberModal.cableId);
    renderFiberGrid(row ? row.fiber_count : fiberModal.fiberCount);
    document.getElementById("fiber-editor").hidden = true;
    updateFiberSeqBar();
  });

  document.getElementById("fiber-seq-mode")?.addEventListener("change", (ev) => {
    const bar = document.getElementById("fiber-seq-bar");
    if (ev.target.checked) {
      if (bar) bar.hidden = false;
      openFiberEditor(1);
    } else {
      if (bar) bar.hidden = true;
      document.getElementById("fiber-editor").hidden = true;
    }
    updateFiberSeqBar();
  });

  document.getElementById("fiber-seq-next")?.addEventListener("click", () => {
    applyFiberEditorToMap();
    const row = findRow("cables", fiberModal.cableId);
    const n = row ? row.fiber_count : fiberModal.fiberCount;
    const cur = fiberModal.editingIndex || 1;
    renderFiberGrid(n);
    if (cur < n) openFiberEditor(cur + 1);
    else {
      document.getElementById("fiber-editor").hidden = true;
      updateFiberSeqBar();
    }
  });

  document.getElementById("fiber-seq-prev")?.addEventListener("click", () => {
    applyFiberEditorToMap();
    const cur = fiberModal.editingIndex || 1;
    const row = findRow("cables", fiberModal.cableId);
    const n = row ? row.fiber_count : fiberModal.fiberCount;
    renderFiberGrid(n);
    if (cur > 1) openFiberEditor(cur - 1);
    updateFiberSeqBar();
  });

  document.getElementById("fiber-modal-close").addEventListener("click", () => {
    document.getElementById("fiber-modal-backdrop").classList.remove("open");
    document.getElementById("fiber-modal-backdrop").setAttribute("aria-hidden", "true");
  });

  document.getElementById("fiber-apply-mufa-splits")?.addEventListener("click", () => {
    const mid = parseInt(document.getElementById("fiber-apply-mufa-splits").dataset.mufaId || "", 10);
    const mufa = mid > 0 ? findRow("mufas", mid) : null;
    const row = findRow("cables", fiberModal.cableId);
    if (!mufa || !row) return;
    const nm = mufa.name || "Mufa #" + mufa.id;
    if (
      !confirm(
        `¿Rellenar pelos aún libres según los splitters de «${nm}»? No borra notas ni enlaces ya puestos en cada pelo.`,
      )
    ) {
      return;
    }
    fiberModal.map = applyMufaSplittersToFiberMap(fiberModal.map, row.fiber_count || 12, mufa);
    renderFiberGrid(row.fiber_count || 12);
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
        fiber_spec: row.fiber_spec || "",
        color: row.color,
        notes: row.notes,
        splice_count: row.splice_count || 0,
        manga_label: row.manga_label || "",
        path: row.path,
        fiber_map: fiberModal.map,
        site_id: row.site_id ?? null,
        source_pon_id: row.source_pon_id ?? null,
        source_olt_card_id: row.source_olt_card_id ?? null,
        source_pon_number: row.source_pon_number ?? null,
        ...mapScopeForPutRow("cables", row),
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
      if (type === "buildings") {
        const latRaw = document.getElementById("f-lat").value.trim();
        const lngRaw = document.getElementById("f-lng").value.trim();
        const lat = latRaw === "" ? null : parseFloat(latRaw);
        const lng = lngRaw === "" ? null : parseFloat(lngRaw);
        if (lat !== null && !Number.isFinite(lat)) {
          alert("Latitud no válida.");
          return;
        }
        if (lng !== null && !Number.isFinite(lng)) {
          alert("Longitud no válida.");
          return;
        }
        const payload = {
          name: document.getElementById("f-name").value,
          address: document.getElementById("f-building-address").value,
          lat,
          lng,
          notes: document.getElementById("f-notes").value,
          ...(id ? mapScopeForPutBuilding(id) : mapScopeForCreate()),
        };
        if (id) await api("PUT", "buildings", { id, ...payload });
        else await api("POST", "buildings", payload);
      } else if (type === "mufas") {
        const sid = document.getElementById("f-site-id").value;
        const ponEl = document.getElementById("f-mufa-src-pon");
        const rawPon = ponEl && ponEl.value ? ponEl.value.trim() : "";
        const pon = ponFieldsFromRawPon(rawPon);
        const splitters = state.mufaSplittersDraft.map((s) => ({
          qty: s.qty != null ? Number(s.qty) : 1,
          ratio: s.ratio != null ? String(s.ratio) : "",
          input_fiber: s.input_fiber,
          source_pon_id: s.source_pon_id != null ? s.source_pon_id : null,
          source_olt_card_id: s.source_olt_card_id,
          source_pon_number: s.source_pon_number,
        }));
        const body = {
          id,
          name: document.getElementById("f-name").value,
          lat: parseFloat(document.getElementById("f-lat").value),
          lng: parseFloat(document.getElementById("f-lng").value),
          model: document.getElementById("f-model").value,
          splice_count: parseInt(document.getElementById("f-splice").value, 10) || 0,
          notes: document.getElementById("f-notes").value,
          site_id: sid ? parseInt(sid, 10) : null,
          ...pon,
          splitters,
          fiber_io: collectMufaFiberIoPayload(),
          splitter_use_fiber_color: !!(
            document.getElementById("f-mufa-splitter-use-color") &&
            document.getElementById("f-mufa-splitter-use-color").checked
          ),
          ...(id ? mapScopeForPutRow("mufas", findRow("mufas", id)) : mapScopeForCreate()),
        };
        if (id) await api("PUT", "mufas", body);
        else await api("POST", "mufas", body);
      } else if (type === "terminals") {
        const tm = document.querySelector('input[name="f-terminal-marker"]:checked');
        const dfEl = document.getElementById("f-terminal-drop-fiber");
        const dfRaw = dfEl && dfEl.value ? parseInt(dfEl.value, 10) : null;
        const rad = document.querySelector('input[name="f-term-drop-src"]:checked');
        const drop_attach = rad && rad.value === "cable" ? "cable" : "mufa";
        const dmRaw = document.getElementById("f-term-drop-mufa").value;
        const dcRaw = document.getElementById("f-term-drop-cable").value;
        const body = {
          id,
          name: document.getElementById("f-name").value,
          lat: parseFloat(document.getElementById("f-lat").value),
          lng: parseFloat(document.getElementById("f-lng").value),
          port_count: parseInt(document.getElementById("f-ports").value, 10) || 8,
          marker_color: tm && tm.value ? tm.value : "green",
          drop_fiber: dfRaw && dfRaw >= 1 && dfRaw <= 12 ? dfRaw : null,
          drop_attach,
          drop_mufa_id: drop_attach === "mufa" && dmRaw ? parseInt(dmRaw, 10) : null,
          drop_cable_id: drop_attach === "cable" && dcRaw ? parseInt(dcRaw, 10) : null,
          splitter_ref: document.getElementById("f-term-splitter").value,
          notes: document.getElementById("f-notes").value,
          ...(id ? mapScopeForPutRow("terminals", findRow("terminals", id)) : mapScopeForCreate()),
        };
        if (id) await api("PUT", "terminals", body);
        else await api("POST", "terminals", body);
      } else if (type === "cables") {
        const path = state.pendingPoint && state.pendingPoint.path ? state.pendingPoint.path : null;
        const fiberMap = normalizeFiberMap(
          id ? (findRow("cables", id) && findRow("cables", id).fiber_map) || {} : {}
        );
        const cponEl = document.getElementById("f-cable-src-pon");
        const cRaw = cponEl && cponEl.value ? cponEl.value.trim() : "";
        const cpon = ponFieldsFromRawPon(cRaw);
        const cSid = document.getElementById("f-cable-scope-site").value;
        const body = {
          id,
          name: document.getElementById("f-name").value,
          fiber_count: parseInt(document.getElementById("f-fibers").value, 10) || 12,
          fiber_spec: getFiberSpecFromForm(),
          color: document.getElementById("f-color").value,
          notes: document.getElementById("f-notes").value,
          splice_count: parseInt(document.getElementById("f-splice-cable").value, 10) || 0,
          manga_label: document.getElementById("f-manga").value,
          fiber_map: fiberMap,
          site_id: cSid ? parseInt(cSid, 10) : null,
          ...cpon,
          ...(id ? mapScopeForPutRow("cables", findRow("cables", id)) : mapScopeForCreate()),
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

  const MAP_BASE_STORAGE = "fiber-atlas-basemap";
  const MAPTILER_KEY_STORAGE = "fiber-atlas-maptiler-key";

  let googleMapsLeafletPreparePromise = null;

  function getOptionalMaptilerKey() {
    const g =
      typeof window !== "undefined" && window.FIBER_ATLAS_MAPTILER_KEY != null
        ? String(window.FIBER_ATLAS_MAPTILER_KEY).trim()
        : "";
    if (g) return g;
    try {
      const ls = localStorage.getItem(MAPTILER_KEY_STORAGE);
      return ls && ls.trim() ? ls.trim() : "";
    } catch (_) {
      return "";
    }
  }

  function getOptionalGoogleMapsKey() {
    const g =
      typeof window !== "undefined" && window.FIBER_ATLAS_GOOGLE_MAPS_KEY != null
        ? String(window.FIBER_ATLAS_GOOGLE_MAPS_KEY).trim()
        : "";
    if (g) return g;
    try {
      const ls = localStorage.getItem(GOOGLE_MAPS_KEY_STORAGE);
      return ls && ls.trim() ? ls.trim() : "";
    } catch (_) {
      return "";
    }
  }

  function ensureGoogleMapsLeafletReady(apiKey) {
    if (!apiKey) {
      return Promise.reject(new Error("Falta la clave de Google Maps."));
    }
    if (googleMapsLeafletPreparePromise) {
      return googleMapsLeafletPreparePromise;
    }
    googleMapsLeafletPreparePromise = (async () => {
      if (!(window.google && window.google.maps)) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () =>
            reject(
              new Error(
                "No se cargó maps.googleapis.com. Revise la clave y que «Maps JavaScript API» esté activa."
              )
            );
          document.head.appendChild(s);
        });
      }
      if (L.gridLayer && typeof L.gridLayer.googleMutant === "function") {
        return;
      }
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src =
          "https://cdn.jsdelivr.net/npm/leaflet.gridlayer.googlemutant@0.13.5/dist/Leaflet.GoogleMutant.js";
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("No se cargó el script GoogleMutant para Leaflet."));
        document.head.appendChild(s);
      });
      if (!L.gridLayer || typeof L.gridLayer.googleMutant !== "function") {
        throw new Error("GoogleMutant no está disponible. Recargue la página.");
      }
    })().catch((err) => {
      googleMapsLeafletPreparePromise = null;
      throw err;
    });
    return googleMapsLeafletPreparePromise;
  }

  function initMapBasemapControl(map) {
    const baseOSM = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });

    const baseHOT = L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
      maxZoom: 20,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · Humanitarian',
      subdomains: "abc",
    });

    const baseVoyager = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 20,
        attribution: '&copy; OSM · <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
      }
    );

    const baseEsriStreet = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution:
          "&copy; Esri &mdash; Garmin, HERE, increment P, OpenStreetMap",
      }
    );

    const baseEsriGray = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: "&copy; Esri, HERE, Garmin, OpenStreetMap",
      }
    );

    const baseSatellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution:
          "Tiles &copy; Esri &mdash; Earthstar, Maxar, GIS users",
      }
    );

    const baseTopo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      maxZoom: 17,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://opentopomap.org">OpenTopoMap</a>',
    });

    const baseCartoLight = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 20,
        attribution: '&copy; OSM · <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
      }
    );

    const baseCartoDark = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 20,
        attribution: '&copy; OSM · <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
      }
    );

    const byId = {
      voyager: baseVoyager,
      hot: baseHOT,
      "esri-street": baseEsriStreet,
      "esri-gray": baseEsriGray,
      osm: baseOSM,
      "carto-light": baseCartoLight,
      "carto-dark": baseCartoDark,
      satellite: baseSatellite,
      topo: baseTopo,
    };

    function isSatelliteBasemapId(id) {
      return id === "satellite" || id === "google-satellite" || id === "google-hybrid";
    }

    const sel = document.getElementById("map-basemap");
    let lastWorkingBasemapId = "voyager";
    /** Último fondo no satélite, para el botón Satélite ↔ Calles */
    let roadSnapshotForToggle = "voyager";
    let satToggleBtn = null;

    function refreshSatToggleLabel() {
      if (!satToggleBtn || !sel) return;
      const on = isSatelliteBasemapId(sel.value);
      satToggleBtn.textContent = on ? "Calles" : "Satélite";
      satToggleBtn.title = on
        ? "Volver al mapa de calles"
        : getOptionalGoogleMapsKey()
          ? "Imagen satélite (Google)"
          : "Imagen satélite (Esri)";
      satToggleBtn.setAttribute("aria-pressed", on ? "true" : "false");
    }

    function setSyncBasemap(id) {
      const next = byId[id];
      if (!next || !map) return false;
      if (state.baseTileLayer) map.removeLayer(state.baseTileLayer);
      state.baseTileLayer = next;
      next.addTo(map);
      try {
        localStorage.setItem(MAP_BASE_STORAGE, id);
      } catch (_) {}
      lastWorkingBasemapId = id;
      if (!isSatelliteBasemapId(id)) roadSnapshotForToggle = id;
      refreshSatToggleLabel();
      return true;
    }

    async function setGoogleBasemap(id) {
      const key = getOptionalGoogleMapsKey();
      if (!key) {
        setStatus('Guarde la clave en «Google Maps — clave API oficial».');
        if (sel) sel.value = lastWorkingBasemapId;
        refreshSatToggleLabel();
        return;
      }
      setStatus("Cargando Google Maps…");
      try {
        await ensureGoogleMapsLeafletReady(key);
        const gmType =
          id === "google-satellite"
            ? "satellite"
            : id === "google-hybrid"
              ? "hybrid"
              : "roadmap";
        if (!byId[id]) {
          byId[id] = L.gridLayer.googleMutant({ type: gmType });
        }
        if (state.baseTileLayer) map.removeLayer(state.baseTileLayer);
        state.baseTileLayer = byId[id];
        byId[id].addTo(map);
        try {
          localStorage.setItem(MAP_BASE_STORAGE, id);
        } catch (_) {}
        lastWorkingBasemapId = id;
        if (!isSatelliteBasemapId(id)) roadSnapshotForToggle = id;
        refreshSatToggleLabel();
        setStatus("Google Maps activo (API oficial).");
      } catch (err) {
        console.error(err);
        const msg = err && err.message ? err.message : "Error al cargar Google Maps.";
        setStatus(msg);
        setSyncBasemap(lastWorkingBasemapId);
        if (sel) sel.value = lastWorkingBasemapId;
        refreshSatToggleLabel();
      }
    }

    function ensureMaptilerOptionInSelect() {
      if (!sel || sel.querySelector('option[value="maptiler"]')) return;
      const opt = document.createElement("option");
      opt.value = "maptiler";
      opt.textContent = "Calles — MapTiler HD (512 px, más definido)";
      sel.insertBefore(opt, sel.firstChild);
    }

    function addOrReplaceMaptilerLayer(key) {
      if (!key || !map) return;
      /* Teselas 512px + zoomOffset: calles y etiquetas más definidas que el raster 256 estándar. */
      const url = `https://api.maptiler.com/maps/streets-v2/512/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}`;
      const layer = L.tileLayer(url, {
        tileSize: 512,
        zoomOffset: -1,
        maxZoom: 22,
        attribution:
          '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">&copy; MapTiler</a> &copy; OpenStreetMap',
      });
      if (byId.maptiler && state.baseTileLayer === byId.maptiler) {
        map.removeLayer(state.baseTileLayer);
        state.baseTileLayer = null;
      }
      byId.maptiler = layer;
      ensureMaptilerOptionInSelect();
    }

    function applyMaptilerFromStorage() {
      const k = getOptionalMaptilerKey();
      if (!k) return;
      addOrReplaceMaptilerLayer(k);
    }

    applyMaptilerFromStorage();

    let initial = "voyager";
    try {
      const s = localStorage.getItem(MAP_BASE_STORAGE);
      if (s) {
        const hasTile = !!byId[s];
        const googleOk = s.startsWith("google-") && getOptionalGoogleMapsKey();
        if (hasTile || googleOk) initial = s;
      }
    } catch (_) {}

    if (initial === "maptiler" && !byId.maptiler) initial = "voyager";
    if (initial.startsWith("google-") && !getOptionalGoogleMapsKey()) {
      try {
        const savedBase = localStorage.getItem(MAP_BASE_STORAGE);
        if (savedBase && savedBase.startsWith("google-")) {
          console.warn(
            "[Fiber Atlas] El fondo guardado era Google Maps pero no hay clave API (localStorage vacío o borrado). " +
              "Use «Google Maps — clave API oficial» → Guardar y usar Google.",
          );
        }
      } catch (_) {}
      initial = "voyager";
    }

    if (initial === "voyager" && byId.maptiler && getOptionalMaptilerKey()) {
      try {
        if (!localStorage.getItem(MAP_BASE_STORAGE)) initial = "maptiler";
      } catch (_) {
        initial = "maptiler";
      }
    }

    const startWithGoogle = initial.startsWith("google-") && getOptionalGoogleMapsKey();

    if (!isSatelliteBasemapId(initial)) roadSnapshotForToggle = initial;

    if (startWithGoogle) {
      setSyncBasemap("voyager");
      if (sel) sel.value = initial;
      void setGoogleBasemap(initial).then(() => refreshSatToggleLabel());
    } else {
      setSyncBasemap(initial);
      if (sel) sel.value = initial;
    }

    const SatToggleControl = L.Control.extend({
      options: { position: "topright" },
      onAdd() {
        const wrap = L.DomUtil.create("div", "leaflet-bar fa-sat-toggle");
        const btn = L.DomUtil.create("button", "fa-sat-toggle-btn", wrap);
        btn.type = "button";
        satToggleBtn = btn;
        refreshSatToggleLabel();
        L.DomEvent.disableClickPropagation(wrap);
        L.DomEvent.disableScrollPropagation(wrap);
        L.DomEvent.on(btn, "click", L.DomEvent.stopPropagation);
        L.DomEvent.on(btn, "click", L.DomEvent.preventDefault);
        btn.addEventListener("click", () => {
          void (async () => {
            const cur = sel ? sel.value : lastWorkingBasemapId;
            try {
              if (isSatelliteBasemapId(cur)) {
                let back = roadSnapshotForToggle;
                if (isSatelliteBasemapId(back)) back = "voyager";
                if (back.startsWith("google-")) await setGoogleBasemap(back);
                else setSyncBasemap(back);
                if (sel) sel.value = back;
              } else {
                roadSnapshotForToggle = cur;
                const satId = getOptionalGoogleMapsKey() ? "google-satellite" : "satellite";
                if (satId.startsWith("google-")) await setGoogleBasemap(satId);
                else setSyncBasemap(satId);
                if (sel) sel.value = satId;
              }
            } catch (_) {}
            refreshSatToggleLabel();
          })();
        });
        return wrap;
      },
    });
    new SatToggleControl().addTo(map);
    refreshSatToggleLabel();

    if (sel) {
      if (byId.maptiler) ensureMaptilerOptionInSelect();
      sel.addEventListener("change", () => {
        const v = sel.value;
        if (v.startsWith("google-")) {
          if (!getOptionalGoogleMapsKey()) {
            setStatus('Guarde antes la clave en «Google Maps — clave API oficial».');
            sel.value = lastWorkingBasemapId;
            refreshSatToggleLabel();
            return;
          }
          void setGoogleBasemap(v).then(() => refreshSatToggleLabel());
          return;
        }
        setSyncBasemap(v);
      });
    }

    const gSave = document.getElementById("map-google-save");
    const gClear = document.getElementById("map-google-clear");
    const gInput = document.getElementById("map-google-key");
    if (gInput && getOptionalGoogleMapsKey()) {
      gInput.placeholder = "Clave guardada (oculta)";
    }
    if (gSave && gInput) {
      gSave.addEventListener("click", () => {
        const k = gInput.value.trim();
        if (!k) {
          setStatus("Pegue la clave de Maps JavaScript API.");
          return;
        }
        try {
          localStorage.setItem(GOOGLE_MAPS_KEY_STORAGE, k);
        } catch (_) {
          setStatus("No se pudo guardar la clave.");
          return;
        }
        if (typeof window !== "undefined") window.FIBER_ATLAS_GOOGLE_MAPS_KEY = k;
        googleMapsLeafletPreparePromise = null;
        ["google-roadmap", "google-hybrid", "google-satellite"].forEach((gid) => {
          delete byId[gid];
        });
        gInput.value = "";
        gInput.placeholder = "Clave guardada (oculta)";
        if (sel) sel.value = "google-roadmap";
        void setGoogleBasemap("google-roadmap");
      });
    }
    if (gClear) {
      gClear.addEventListener("click", () => {
        try {
          localStorage.removeItem(GOOGLE_MAPS_KEY_STORAGE);
        } catch (_) {}
        if (typeof window !== "undefined") window.FIBER_ATLAS_GOOGLE_MAPS_KEY = "";
        googleMapsLeafletPreparePromise = null;
        ["google-roadmap", "google-hybrid", "google-satellite"].forEach((gid) => {
          if (byId[gid] && state.baseTileLayer === byId[gid]) {
            map.removeLayer(byId[gid]);
            state.baseTileLayer = null;
          }
          delete byId[gid];
        });
        setSyncBasemap("voyager");
        if (sel) sel.value = "voyager";
        if (gInput) {
          gInput.value = "";
          gInput.placeholder = "Pegar clave Maps JavaScript API…";
        }
        setStatus("Clave Google quitada. Fondo: Voyager. Recargue si la API quedó en mal estado.");
      });
    }

    const mtSave = document.getElementById("map-maptiler-save");
    const mtClear = document.getElementById("map-maptiler-clear");
    const mtInput = document.getElementById("map-maptiler-key");
    if (mtInput && getOptionalMaptilerKey()) {
      mtInput.placeholder = "Clave guardada (oculta)";
    }
    if (mtSave && mtInput) {
      mtSave.addEventListener("click", () => {
        const k = mtInput.value.trim();
        if (!k) {
          setStatus("Pegue la clave MapTiler o use «Quitar clave».");
          return;
        }
        try {
          localStorage.setItem(MAPTILER_KEY_STORAGE, k);
        } catch (err) {
          setStatus("No se pudo guardar la clave en el navegador.");
          return;
        }
        if (typeof window !== "undefined") window.FIBER_ATLAS_MAPTILER_KEY = k;
        addOrReplaceMaptilerLayer(k);
        setSyncBasemap("maptiler");
        if (sel) sel.value = "maptiler";
        mtInput.value = "";
        mtInput.placeholder = "Clave guardada (oculta)";
        setStatus("MapTiler activo. Zoom alto disponible hasta nv. 22.");
      });
    }
    if (mtClear) {
      mtClear.addEventListener("click", () => {
        try {
          localStorage.removeItem(MAPTILER_KEY_STORAGE);
        } catch (_) {}
        if (typeof window !== "undefined") window.FIBER_ATLAS_MAPTILER_KEY = "";
        delete byId.maptiler;
        if (sel) {
          const o = sel.querySelector('option[value="maptiler"]');
          if (o) o.remove();
        }
        setSyncBasemap("voyager");
        if (sel) sel.value = "voyager";
        if (mtInput) {
          mtInput.value = "";
          mtInput.placeholder = "Pegar clave API…";
        }
        setStatus("Clave MapTiler quitada. Fondo: Voyager.");
      });
    }
  }

  function initMap() {
    state.mapViewPersistenceEnabled = false;
    state.map = L.map("map", { preferCanvas: true, maxZoom: 22 }).setView([40.4168, -3.7038], 6);

    initMapBasemapControl(state.map);

    L.control.scale({ metric: true, imperial: false, maxWidth: 160 }).addTo(state.map);

    state.buildingLayer = L.layerGroup().addTo(state.map);
    state.mufaLayer = L.layerGroup().addTo(state.map);
    state.terminalLayer = L.layerGroup().addTo(state.map);
    state.cableLayer = L.layerGroup().addTo(state.map);

    initMapSearchControl(state.map);

    state.map.on("moveend", saveStoredMapView);

    state.map.on("click", async (e) => {
      const pz = state.printZone;
      if (pz.pickingStep === 1) {
        pz.cornerA = e.latlng;
        pz.pickingStep = 2;
        setStatus("Segunda esquina del área de impresión…");
        return;
      }
      if (pz.pickingStep === 2 && pz.cornerA) {
        const b = L.latLngBounds([pz.cornerA, e.latlng]);
        if (!b.isValid()) {
          setStatus("Zona inválida. Pulse «Definir zona» e inténtelo de nuevo.");
          pz.pickingStep = 0;
          pz.cornerA = null;
          return;
        }
        pz.bounds = b;
        pz.pickingStep = 0;
        pz.cornerA = null;
        state.map.fitBounds(b.pad(0.08));
        setStatus("Zona lista. Pulse «Imprimir mapa (A4)».");
        syncMapPrintChrome();
        return;
      }
      if (state.mode === "org_building") {
        setMode("");
        await openBuildingModal({
          name: "Edificio",
          address: "",
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          notes: "",
        });
        setStatus("Complete el edificio y pulse Guardar. Luego sites y OLT desde el árbol.");
        return;
      }
      if (state.mode === "org_site") {
        const bid = state.mapFieldContext.buildingId;
        if (!bid) {
          alert(
            "1) Clic en «Edificio: …» en Red acceso (cabecera de fila).\n2) «＋ Site (en POP)» (solo nombre) o herramienta «＋ Site» y clic en el mapa (GPS).",
          );
          return;
        }
        const name = prompt("Nombre del site / cabecera (POP lógico) en este edificio?");
        if (!name || !name.trim()) return;
        try {
          await postSiteUnderBuilding(bid, name, e.latlng.lat, e.latlng.lng);
          setStatus("Site creado con GPS. Siga con OLT desde el árbol.");
          setMode("");
        } catch (err) {
          alert(err.message);
        }
        return;
      }
      if (state.mode === "mufa") {
        await openNewAtPoint("mufas", e.latlng.lat, e.latlng.lng);
      } else if (state.mode === "terminal") {
        await openNewAtPoint("terminals", e.latlng.lat, e.latlng.lng);
      } else if (state.mode === "cable") {
        appendCableDraftVertex(e.latlng.lat, e.latlng.lng);
      }
    });
  }

  document.querySelector(".tools")?.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".tools button[data-mode]");
    if (!btn || btn.disabled) return;
    if (btn.id === "mode-cable") clearCableDraft(false);
    const raw = btn.getAttribute("data-mode");
    setMode(raw === null ? "" : raw);
  });

  document.getElementById("cable-finish").addEventListener("click", async () => {
    if (state.cableDraft.length < 2) return;
    const path = state.cableDraft.map((p) => [p[0], p[1]]);
    await openNewCable(path);
  });

  document.getElementById("cable-cancel").addEventListener("click", () => {
    clearCableDraft(true);
    document.getElementById("cable-finish").disabled = true;
    document.getElementById("cable-cancel").disabled = true;
    setStatus("Trazado cancelado.");
  });

  initMapProjectsUi();
  initMap();
  loadAll();
})();
