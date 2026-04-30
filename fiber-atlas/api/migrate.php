<?php
declare(strict_types=1);

/**
 * Migraciones incrementales SQLite (Fiber Atlas v2).
 */
function fa_column_exists(PDO $pdo, string $table, string $column): bool
{
    if (!preg_match('/^[a-z_][a-z0-9_]*$/i', $table)) {
        return false;
    }
    $st = $pdo->query('PRAGMA table_info(' . $table . ')');
    if (!$st) {
        return false;
    }
    while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
        if (isset($row['name']) && strcasecmp((string) $row['name'], $column) === 0) {
            return true;
        }
    }
    return false;
}

function fa_table_exists(PDO $pdo, string $table): bool
{
    if (!preg_match('/^[a-z_][a-z0-9_]*$/i', $table)) {
        return false;
    }
    $st = $pdo->prepare('SELECT 1 FROM sqlite_master WHERE type = ? AND name = ? LIMIT 1');
    $st->execute(['table', $table]);

    return (bool) $st->fetchColumn();
}

function fa_run_migrations(PDO $pdo): void
{
    $pdo->exec('PRAGMA foreign_keys = ON');

    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS buildings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  lat REAL,
  lng REAL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER,
  name TEXT NOT NULL DEFAULT '',
  lat REAL,
  lng REAL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE SET NULL
);
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS olts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS olt_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  olt_id INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (olt_id) REFERENCES olts(id) ON DELETE CASCADE
);
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS pons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  olt_card_id INTEGER NOT NULL,
  pon_number INTEGER NOT NULL DEFAULT 1,
  label TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (olt_card_id) REFERENCES olt_cards(id) ON DELETE CASCADE
);
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS pon_power_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pon_id INTEGER NOT NULL,
  mufa_id INTEGER,
  stage_name TEXT NOT NULL DEFAULT '',
  dbm REAL,
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (pon_id) REFERENCES pons(id) ON DELETE CASCADE,
  FOREIGN KEY (mufa_id) REFERENCES mufas(id) ON DELETE SET NULL
);
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS price_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'otro',
  unit_price REAL NOT NULL DEFAULT 0,
  unit_label TEXT NOT NULL DEFAULT 'ud',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS budget_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
SQL);

    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS budget_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  catalog_id INTEGER,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'otro',
  qty REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES budget_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (catalog_id) REFERENCES price_catalog(id) ON DELETE SET NULL
);
SQL);

    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_olts_site ON olts (site_id)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_cards_olt ON olt_cards (olt_id)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_pons_card ON pons (olt_card_id)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_power_pon ON pon_power_readings (pon_id)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_budget_lines_proj ON budget_lines (project_id)');

    // building_id debe existir antes de indexar (DB antiguas: sites sin esa columna).
    if (!fa_column_exists($pdo, 'sites', 'building_id')) {
        $pdo->exec(
            'ALTER TABLE sites ADD COLUMN building_id INTEGER REFERENCES buildings(id) ON DELETE SET NULL'
        );
    }
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_sites_building ON sites (building_id)');

    if (!fa_column_exists($pdo, 'mufas', 'site_id')) {
        $pdo->exec('ALTER TABLE mufas ADD COLUMN site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL');
    }
    if (!fa_column_exists($pdo, 'mufas', 'linked_pon_id')) {
        $pdo->exec('ALTER TABLE mufas ADD COLUMN linked_pon_id INTEGER REFERENCES pons(id) ON DELETE SET NULL');
    }

    if (!fa_column_exists($pdo, 'cables', 'splice_count')) {
        $pdo->exec('ALTER TABLE cables ADD COLUMN splice_count INTEGER NOT NULL DEFAULT 0');
    }
    if (!fa_column_exists($pdo, 'cables', 'manga_label')) {
        $pdo->exec('ALTER TABLE cables ADD COLUMN manga_label TEXT NOT NULL DEFAULT \'\'');
    }
    if (!fa_column_exists($pdo, 'cables', 'fiber_map_json')) {
        $pdo->exec('ALTER TABLE cables ADD COLUMN fiber_map_json TEXT NOT NULL DEFAULT \'[]\'');
    }
    if (!fa_column_exists($pdo, 'cables', 'fiber_spec')) {
        $pdo->exec('ALTER TABLE cables ADD COLUMN fiber_spec TEXT NOT NULL DEFAULT \'\'');
    }

    if (!fa_column_exists($pdo, 'terminals', 'marker_color')) {
        $pdo->exec("ALTER TABLE terminals ADD COLUMN marker_color TEXT NOT NULL DEFAULT 'green'");
    }
    if (!fa_column_exists($pdo, 'terminals', 'drop_fiber')) {
        $pdo->exec('ALTER TABLE terminals ADD COLUMN drop_fiber INTEGER');
    }
    if (!fa_column_exists($pdo, 'terminals', 'source_pon_id')) {
        $pdo->exec('ALTER TABLE terminals ADD COLUMN source_pon_id INTEGER REFERENCES pons(id) ON DELETE SET NULL');
    }
    if (!fa_column_exists($pdo, 'terminals', 'source_olt_card_id')) {
        $pdo->exec(
            'ALTER TABLE terminals ADD COLUMN source_olt_card_id INTEGER REFERENCES olt_cards(id) ON DELETE SET NULL'
        );
    }
    if (!fa_column_exists($pdo, 'terminals', 'source_pon_number')) {
        $pdo->exec('ALTER TABLE terminals ADD COLUMN source_pon_number INTEGER');
    }
    if (fa_column_exists($pdo, 'terminals', 'source_olt_card_id')) {
        $pdo->exec(
            'UPDATE terminals SET source_olt_card_id = (SELECT olt_card_id FROM pons WHERE pons.id = terminals.source_pon_id), source_pon_number = (SELECT pon_number FROM pons WHERE pons.id = terminals.source_pon_id) WHERE source_pon_id IS NOT NULL AND (source_olt_card_id IS NULL OR source_pon_number IS NULL)'
        );
    }

    if (!fa_column_exists($pdo, 'terminals', 'drop_mufa_id')) {
        $pdo->exec('ALTER TABLE terminals ADD COLUMN drop_mufa_id INTEGER REFERENCES mufas(id) ON DELETE SET NULL');
    }
    if (!fa_column_exists($pdo, 'terminals', 'drop_cable_id')) {
        $pdo->exec('ALTER TABLE terminals ADD COLUMN drop_cable_id INTEGER REFERENCES cables(id) ON DELETE SET NULL');
    }
    if (!fa_column_exists($pdo, 'terminals', 'splitter_ref')) {
        $pdo->exec('ALTER TABLE terminals ADD COLUMN splitter_ref TEXT NOT NULL DEFAULT \'\'');
    }

    if (!fa_column_exists($pdo, 'mufas', 'source_olt_card_id')) {
        $pdo->exec(
            'ALTER TABLE mufas ADD COLUMN source_olt_card_id INTEGER REFERENCES olt_cards(id) ON DELETE SET NULL'
        );
    }
    if (!fa_column_exists($pdo, 'mufas', 'source_pon_number')) {
        $pdo->exec('ALTER TABLE mufas ADD COLUMN source_pon_number INTEGER');
    }
    if (fa_column_exists($pdo, 'mufas', 'source_olt_card_id')) {
        $pdo->exec(
            'UPDATE mufas SET source_olt_card_id = (SELECT olt_card_id FROM pons WHERE pons.id = mufas.linked_pon_id), source_pon_number = (SELECT pon_number FROM pons WHERE pons.id = mufas.linked_pon_id) WHERE linked_pon_id IS NOT NULL AND (source_olt_card_id IS NULL OR source_pon_number IS NULL)'
        );
    }

    if (!fa_column_exists($pdo, 'cables', 'source_pon_id')) {
        $pdo->exec('ALTER TABLE cables ADD COLUMN source_pon_id INTEGER REFERENCES pons(id) ON DELETE SET NULL');
    }
    if (!fa_column_exists($pdo, 'cables', 'source_olt_card_id')) {
        $pdo->exec(
            'ALTER TABLE cables ADD COLUMN source_olt_card_id INTEGER REFERENCES olt_cards(id) ON DELETE SET NULL'
        );
    }
    if (!fa_column_exists($pdo, 'cables', 'source_pon_number')) {
        $pdo->exec('ALTER TABLE cables ADD COLUMN source_pon_number INTEGER');
    }
    if (!fa_column_exists($pdo, 'cables', 'site_id')) {
        $pdo->exec('ALTER TABLE cables ADD COLUMN site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL');
    }

    foreach (['mufas', 'terminals', 'cables', 'poles', 'buildings'] as $tbl) {
        if (fa_table_exists($pdo, $tbl) && !fa_column_exists($pdo, $tbl, 'map_scope')) {
            $pdo->exec("ALTER TABLE {$tbl} ADD COLUMN map_scope TEXT NOT NULL DEFAULT ''");
        }
    }

    if (!fa_column_exists($pdo, 'mufas', 'splitter_enabled')) {
        $pdo->exec('ALTER TABLE mufas ADD COLUMN splitter_enabled INTEGER NOT NULL DEFAULT 0');
    }
    if (!fa_column_exists($pdo, 'mufas', 'splitter_qty')) {
        $pdo->exec('ALTER TABLE mufas ADD COLUMN splitter_qty INTEGER NOT NULL DEFAULT 0');
    }
    if (!fa_column_exists($pdo, 'mufas', 'splitter_type')) {
        $pdo->exec("ALTER TABLE mufas ADD COLUMN splitter_type TEXT NOT NULL DEFAULT ''");
    }
    if (!fa_column_exists($pdo, 'mufas', 'splitter_linked_pon_id')) {
        $pdo->exec('ALTER TABLE mufas ADD COLUMN splitter_linked_pon_id INTEGER REFERENCES pons(id) ON DELETE SET NULL');
    }
    if (!fa_column_exists($pdo, 'mufas', 'splitter_source_olt_card_id')) {
        $pdo->exec(
            'ALTER TABLE mufas ADD COLUMN splitter_source_olt_card_id INTEGER REFERENCES olt_cards(id) ON DELETE SET NULL'
        );
    }
    if (!fa_column_exists($pdo, 'mufas', 'splitter_source_pon_number')) {
        $pdo->exec('ALTER TABLE mufas ADD COLUMN splitter_source_pon_number INTEGER');
    }
    if (!fa_column_exists($pdo, 'mufas', 'splitter_use_fiber_color')) {
        $pdo->exec('ALTER TABLE mufas ADD COLUMN splitter_use_fiber_color INTEGER NOT NULL DEFAULT 0');
    }
    if (!fa_column_exists($pdo, 'mufas', 'splitters_json')) {
        $pdo->exec("ALTER TABLE mufas ADD COLUMN splitters_json TEXT NOT NULL DEFAULT '[]'");
    }
    if (!fa_column_exists($pdo, 'mufas', 'fiber_io_json')) {
        $pdo->exec(
            "ALTER TABLE mufas ADD COLUMN fiber_io_json TEXT NOT NULL DEFAULT '{\"entradas\":[],\"salidas\":[]}'"
        );
    }

    if (!fa_table_exists($pdo, 'poles')) {
        $pdo->exec(<<<'SQL'
CREATE TABLE poles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  map_scope TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
SQL);
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_poles_lat_lng ON poles (lat, lng)');
    }
    if (!fa_column_exists($pdo, 'poles', 'map_scope')) {
        $pdo->exec("ALTER TABLE poles ADD COLUMN map_scope TEXT NOT NULL DEFAULT ''");
    }
}
