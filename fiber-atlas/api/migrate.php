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

function fa_run_migrations(PDO $pdo): void
{
    $pdo->exec('PRAGMA foreign_keys = ON');

    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  lat REAL,
  lng REAL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
}
