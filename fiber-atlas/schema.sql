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

CREATE TABLE IF NOT EXISTS terminals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  port_count INTEGER NOT NULL DEFAULT 8,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  fiber_count INTEGER NOT NULL DEFAULT 12,
  path_json TEXT NOT NULL DEFAULT '[]',
  color TEXT NOT NULL DEFAULT '#2563eb',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mufas_lat_lng ON mufas (lat, lng);
CREATE INDEX IF NOT EXISTS idx_terminals_lat_lng ON terminals (lat, lng);
