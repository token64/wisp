-- Fiber Atlas: inventario pasivo (SQLite)
-- path_json en cables: JSON [[lat, lng], [lat, lng], ...] en orden del trazado

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS mufas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  splice_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  fiber_count INTEGER NOT NULL DEFAULT 12,
  fiber_spec TEXT NOT NULL DEFAULT '',
  path_json TEXT NOT NULL DEFAULT '[]',
  color TEXT NOT NULL DEFAULT '#2563eb',
  notes TEXT NOT NULL DEFAULT '',
  site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
  source_pon_id INTEGER REFERENCES pons(id) ON DELETE SET NULL,
  source_olt_card_id INTEGER REFERENCES olt_cards(id) ON DELETE SET NULL,
  source_pon_number INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS terminals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  port_count INTEGER NOT NULL DEFAULT 8,
  marker_color TEXT NOT NULL DEFAULT 'green',
  drop_fiber INTEGER,
  drop_mufa_id INTEGER REFERENCES mufas(id) ON DELETE SET NULL,
  drop_cable_id INTEGER REFERENCES cables(id) ON DELETE SET NULL,
  splitter_ref TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mufas_lat_lng ON mufas (lat, lng);
CREATE INDEX IF NOT EXISTS idx_terminals_lat_lng ON terminals (lat, lng);
