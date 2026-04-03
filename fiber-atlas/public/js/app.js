(function () {
  "use strict";

  const API = "../api/index.php";

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

  function setStatus(t) {
    document.getElementById("status").textContent = t;
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll(".tools button[data-mode]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
    document.getElementById("mode-none").classList.toggle("active", mode === "");
    const cable = mode === "cable";
    document.getElementById("cable-finish").disabled = !cable || state.cableDraft.length < 2;
    document.getElementById("cable-cancel").disabled = !cable || state.cableDraft.length === 0;
    if (mode !== "cable") {
      clearCableDraft(false);
    }
    setStatus(
      mode === "mufa"
        ? "Clic en el mapa para colocar una mufa."
        : mode === "terminal"
          ? "Clic en el mapa para colocar un terminal."
          : mode === "cable"
            ? "Clics en el mapa: vértices del cable. Luego «Finalizar cable»."
            : "Listo."
    );
  }

  function clearCableDraft(redraw) {
    state.cableDraft = [];
    if (state.cableDraftLine) {
      state.map.removeLayer(state.cableDraftLine);
      state.cableDraftLine = null;
    }
    if (redraw && state.mode === "cable") {
      document.getElementById("cable-finish").disabled = true;
      document.getElementById("cable-cancel").disabled = true;
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

  function flyTo(lat, lng) {
    state.map.flyTo([lat, lng], Math.max(state.map.getZoom(), 16), { duration: 0.6 });
  }

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
      fitBounds();
      setStatus("Listo.");
    } catch (e) {
      console.error(e);
      setStatus("Error: " + e.message);
    }
  }

  function fitBounds() {
    const layers = L.featureGroup([
      state.mufaLayer,
      state.terminalLayer,
      state.cableLayer,
    ]);
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
        const meta =
          type === "cables"
            ? `${(r.path || []).length} pts · ${r.fiber_count} fibras`
            : `${Number(r.lat).toFixed(5)}, ${Number(r.lng).toFixed(5)}`;
        h += `<div class="item" data-type="${type}" data-id="${r.id}">
          <div>
            <div class="title">${escapeHtml(r.name || "(sin nombre)")}</div>
            <div class="meta">${escapeHtml(meta)}</div>
          </div>
          <div class="actions">
            <button type="button" data-act="fly">Ver</button>
            <button type="button" data-act="edit">Editar</button>
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

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
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

  function openModalFromRow(type, row) {
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

    if (type === "mufas") {
      document.getElementById("f-lat").value = row.lat != null ? row.lat : "";
      document.getElementById("f-lng").value = row.lng != null ? row.lng : "";
      document.getElementById("f-model").value = row.model || "";
      document.getElementById("f-splice").value = row.splice_count ?? 0;
    }
    if (type === "terminals") {
      document.getElementById("f-lat").value = row.lat != null ? row.lat : "";
      document.getElementById("f-lng").value = row.lng != null ? row.lng : "";
      document.getElementById("f-ports").value = row.port_count ?? 8;
    }
    if (type === "cables") {
      document.getElementById("f-fibers").value = row.fiber_count ?? 12;
      document.getElementById("f-color").value = row.color || "#2563eb";
    }

    state.pendingPoint = null;
    showModal(true);
  }

  function openNewAtPoint(type, lat, lng) {
    openModalFromRow(type, {
      name: type === "mufas" ? "Mufa" : "Terminal",
      lat,
      lng,
      model: "",
      splice_count: 0,
      port_count: 8,
      notes: "",
    });
    document.getElementById("f-id").value = "";
  }

  function openNewCable(path) {
    document.getElementById("modal-title").textContent = "Nuevo cable";
    document.getElementById("f-type").value = "cables";
    document.getElementById("f-id").value = "";
    document.getElementById("f-name").value = "Cable";
    document.getElementById("f-notes").value = "";
    document.getElementById("f-fibers").value = 12;
    document.getElementById("f-color").value = "#2563eb";
    document.getElementById("f-mufa-extra").style.display = "none";
    document.getElementById("f-terminal-extra").style.display = "none";
    document.getElementById("f-cable-extra").style.display = "block";
    document.getElementById("f-latlng-row").style.display = "none";
    state.pendingPoint = { path };
    showModal(true);
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const type = document.getElementById("f-type").value;
    const idStr = document.getElementById("f-id").value;
    const id = idStr ? Number(idStr) : 0;

    try {
      if (type === "mufas") {
        const body = {
          id,
          name: document.getElementById("f-name").value,
          lat: parseFloat(document.getElementById("f-lat").value),
          lng: parseFloat(document.getElementById("f-lng").value),
          model: document.getElementById("f-model").value,
          splice_count: parseInt(document.getElementById("f-splice").value, 10) || 0,
          notes: document.getElementById("f-notes").value,
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
        const body = {
          id,
          name: document.getElementById("f-name").value,
          fiber_count: parseInt(document.getElementById("f-fibers").value, 10) || 12,
          color: document.getElementById("f-color").value,
          notes: document.getElementById("f-notes").value,
        };
        if (path) body.path = path;
        else {
          const existing = findRow("cables", id);
          if (existing && existing.path) body.path = existing.path;
        }
        if (id) {
          if (!body.path || body.path.length < 2) {
            const ex = findRow("cables", id);
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

    state.map.on("click", (e) => {
      if (state.mode === "mufa") {
        openNewAtPoint("mufas", e.latlng.lat, e.latlng.lng);
      } else if (state.mode === "terminal") {
        openNewAtPoint("terminals", e.latlng.lat, e.latlng.lng);
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
