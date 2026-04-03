<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/migrate.php';

const ALLOWED = [
    'mufas', 'terminals', 'cables', 'buildings', 'sites', 'olts', 'olt_cards', 'pons',
    'pon_power_readings', 'price_catalog', 'budget_projects', 'budget_lines', 'hierarchy',
];

function jsonOut(array $data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

$root = dirname(__DIR__);
$dataDir = $root . DIRECTORY_SEPARATOR . 'data';
$dbPath = $dataDir . DIRECTORY_SEPARATOR . 'network.sqlite';

if (!is_dir($dataDir) && !mkdir($dataDir, 0755, true)) {
    jsonOut(['ok' => false, 'error' => 'No se pudo crear data/'], 500);
}

try {
    $pdo = new PDO('sqlite:' . $dbPath, options: [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON');
} catch (PDOException $e) {
    jsonOut(['ok' => false, 'error' => 'Base de datos: ' . $e->getMessage()], 500);
}

$check = $pdo->query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='mufas' LIMIT 1")->fetch();
if (!$check) {
    $schema = file_get_contents($root . DIRECTORY_SEPARATOR . 'schema.sql');
    if ($schema === false) {
        jsonOut(['ok' => false, 'error' => 'Falta schema.sql'], 500);
    }
    $pdo->exec($schema);
}

fa_run_migrations($pdo);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$resource = $_GET['resource'] ?? '';
$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
$raw = file_get_contents('php://input') ?: '';
$input = json_decode($raw, true);
if (!is_array($input)) {
    $input = [];
}

if ($resource === '' || !in_array($resource, ALLOWED, true)) {
    jsonOut(['ok' => false, 'error' => 'Parámetro resource inválido o ausente'], 400);
}

function rowWithExtras(array $row, string $resource): array
{
    if ($resource === 'cables' && isset($row['path_json'])) {
        $row['path'] = json_decode((string) $row['path_json'], true);
        if (!is_array($row['path'])) {
            $row['path'] = [];
        }
        unset($row['path_json']);
        if (isset($row['fiber_map_json'])) {
            $row['fiber_map'] = json_decode((string) $row['fiber_map_json'], true);
            if (!is_array($row['fiber_map'])) {
                $row['fiber_map'] = [];
            }
            unset($row['fiber_map_json']);
        }
    }
    if ($resource === 'budget_lines') {
        $q = (float) ($row['qty'] ?? 0);
        $p = (float) ($row['unit_price'] ?? 0);
        $row['line_total'] = round($q * $p, 2);
    }
    return $row;
}

function getFilter(string $key): ?int
{
    if (!isset($_GET[$key])) {
        return null;
    }
    $v = (int) $_GET[$key];
    return $v > 0 ? $v : null;
}

/** Rellena olts → tarjetas → PON bajo un site (referencia por array). */
function fa_attach_olts_under_site(PDO $pdo, array &$site): void
{
    $st = $pdo->prepare('SELECT * FROM olts WHERE site_id = ? ORDER BY id');
    $st->execute([(int) $site['id']]);
    $olts = $st->fetchAll();
    foreach ($olts as &$o) {
        $stc = $pdo->prepare('SELECT * FROM olt_cards WHERE olt_id = ? ORDER BY sort_order, id');
        $stc->execute([(int) $o['id']]);
        $cards = $stc->fetchAll();
        foreach ($cards as &$c) {
            $stp = $pdo->prepare('SELECT * FROM pons WHERE olt_card_id = ? ORDER BY pon_number, id');
            $stp->execute([(int) $c['id']]);
            $c['pons'] = $stp->fetchAll();
        }
        $o['olt_cards'] = $cards;
    }
    $site['olts'] = $olts;
}

/**
 * GET hierarchy: Edificio → Site → OLT → tarjeta → PON.
 * También devuelve sites sin edificio (migración / datos sueltos).
 */
if ($resource === 'hierarchy' && $method === 'GET') {
    $buildings = $pdo->query('SELECT * FROM buildings ORDER BY name COLLATE NOCASE')->fetchAll();
    foreach ($buildings as &$b) {
        $sts = $pdo->prepare('SELECT * FROM sites WHERE building_id = ? ORDER BY name COLLATE NOCASE');
        $sts->execute([(int) $b['id']]);
        $sites = $sts->fetchAll();
        foreach ($sites as &$s) {
            fa_attach_olts_under_site($pdo, $s);
        }
        $b['sites'] = $sites;
    }
    unset($b, $s);
    $orphans = $pdo->query(
        'SELECT * FROM sites WHERE building_id IS NULL ORDER BY name COLLATE NOCASE'
    )->fetchAll();
    foreach ($orphans as &$s) {
        fa_attach_olts_under_site($pdo, $s);
    }
    unset($s);
    jsonOut(['ok' => true, 'data' => ['buildings' => $buildings, 'orphan_sites' => $orphans]]);
}

if ($method === 'GET') {
    if ($id > 0) {
        $st = $pdo->prepare("SELECT * FROM {$resource} WHERE id = ?");
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) {
            jsonOut(['ok' => false, 'error' => 'No encontrado'], 404);
        }
        jsonOut(['ok' => true, 'data' => rowWithExtras($row, $resource)]);
    }

    $w = [];
    $params = [];
    if ($resource === 'olts') {
        $fid = getFilter('site_id');
        if ($fid !== null) {
            $w[] = 'site_id = ?';
            $params[] = $fid;
        }
    }
    if ($resource === 'olt_cards') {
        $fid = getFilter('olt_id');
        if ($fid !== null) {
            $w[] = 'olt_id = ?';
            $params[] = $fid;
        }
    }
    if ($resource === 'pons') {
        $fid = getFilter('olt_card_id');
        if ($fid !== null) {
            $w[] = 'olt_card_id = ?';
            $params[] = $fid;
        }
    }
    if ($resource === 'pon_power_readings') {
        $fid = getFilter('pon_id');
        if ($fid !== null) {
            $w[] = 'pon_id = ?';
            $params[] = $fid;
        }
    }
    if ($resource === 'budget_lines') {
        $fid = getFilter('project_id');
        if ($fid !== null) {
            $w[] = 'project_id = ?';
            $params[] = $fid;
        }
    }
    if ($resource === 'sites') {
        $fid = getFilter('building_id');
        if ($fid !== null) {
            $w[] = 'building_id = ?';
            $params[] = $fid;
        }
    }

    $sql = "SELECT * FROM {$resource}";
    if ($w) {
        $sql .= ' WHERE ' . implode(' AND ', $w);
    }
    $sql .= ' ORDER BY id DESC';
    $st = $pdo->prepare($sql);
    $st->execute($params);
    $rows = $st->fetchAll();
    foreach ($rows as &$row) {
        $row = rowWithExtras($row, $resource);
    }
    jsonOut(['ok' => true, 'data' => $rows]);
}

if ($method === 'POST') {
    if ($resource === 'buildings') {
        $st = $pdo->prepare(
            'INSERT INTO buildings (name, address, lat, lng, notes) VALUES (?,?,?,?,?)'
        );
        $st->execute([
            (string) ($input['name'] ?? ''),
            (string) ($input['address'] ?? ''),
            isset($input['lat']) && $input['lat'] !== '' ? (float) $input['lat'] : null,
            isset($input['lng']) && $input['lng'] !== '' ? (float) $input['lng'] : null,
            (string) ($input['notes'] ?? ''),
        ]);
        jsonOut(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
    }
    if ($resource === 'sites') {
        $bid = isset($input['building_id']) && $input['building_id'] !== '' ? (int) $input['building_id'] : null;
        $st = $pdo->prepare('INSERT INTO sites (building_id, name, lat, lng, notes) VALUES (?,?,?,?,?)');
        $st->execute([
            $bid,
            (string) ($input['name'] ?? ''),
            isset($input['lat']) && $input['lat'] !== '' ? (float) $input['lat'] : null,
            isset($input['lng']) && $input['lng'] !== '' ? (float) $input['lng'] : null,
            (string) ($input['notes'] ?? ''),
        ]);
        jsonOut(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
    }
    if ($resource === 'olts') {
        $sid = (int) ($input['site_id'] ?? 0);
        if ($sid <= 0) {
            jsonOut(['ok' => false, 'error' => 'Falta site_id'], 400);
        }
        $st = $pdo->prepare('INSERT INTO olts (site_id, name, notes) VALUES (?,?,?)');
        $st->execute([$sid, (string) ($input['name'] ?? ''), (string) ($input['notes'] ?? '')]);
        jsonOut(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
    }
    if ($resource === 'olt_cards') {
        $oid = (int) ($input['olt_id'] ?? 0);
        if ($oid <= 0) {
            jsonOut(['ok' => false, 'error' => 'Falta olt_id'], 400);
        }
        $st = $pdo->prepare('INSERT INTO olt_cards (olt_id, label, sort_order, notes) VALUES (?,?,?,?)');
        $st->execute([
            $oid,
            (string) ($input['label'] ?? 'Tarjeta'),
            (int) ($input['sort_order'] ?? 0),
            (string) ($input['notes'] ?? ''),
        ]);
        jsonOut(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
    }
    if ($resource === 'pons') {
        $cid = (int) ($input['olt_card_id'] ?? 0);
        if ($cid <= 0) {
            jsonOut(['ok' => false, 'error' => 'Falta olt_card_id'], 400);
        }
        $st = $pdo->prepare(
            'INSERT INTO pons (olt_card_id, pon_number, label, notes) VALUES (?,?,?,?)'
        );
        $st->execute([
            $cid,
            (int) ($input['pon_number'] ?? 1),
            (string) ($input['label'] ?? ''),
            (string) ($input['notes'] ?? ''),
        ]);
        jsonOut(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
    }
    if ($resource === 'pon_power_readings') {
        $pid = (int) ($input['pon_id'] ?? 0);
        if ($pid <= 0) {
            jsonOut(['ok' => false, 'error' => 'Falta pon_id'], 400);
        }
        $mid = isset($input['mufa_id']) ? (int) $input['mufa_id'] : null;
        $st = $pdo->prepare(
            'INSERT INTO pon_power_readings (pon_id, mufa_id, stage_name, dbm, notes, sort_order) VALUES (?,?,?,?,?,?)'
        );
        $st->execute([
            $pid,
            $mid ?: null,
            (string) ($input['stage_name'] ?? ''),
            isset($input['dbm']) && $input['dbm'] !== '' ? (float) $input['dbm'] : null,
            (string) ($input['notes'] ?? ''),
            (int) ($input['sort_order'] ?? 0),
        ]);
        jsonOut(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
    }
    if ($resource === 'price_catalog') {
        $st = $pdo->prepare(
            'INSERT INTO price_catalog (name, category, unit_price, unit_label, notes) VALUES (?,?,?,?,?)'
        );
        $st->execute([
            (string) ($input['name'] ?? ''),
            (string) ($input['category'] ?? 'otro'),
            (float) ($input['unit_price'] ?? 0),
            (string) ($input['unit_label'] ?? 'ud'),
            (string) ($input['notes'] ?? ''),
        ]);
        jsonOut(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
    }
    if ($resource === 'budget_projects') {
        $st = $pdo->prepare('INSERT INTO budget_projects (name, notes) VALUES (?,?)');
        $st->execute([(string) ($input['name'] ?? ''), (string) ($input['notes'] ?? '')]);
        jsonOut(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
    }
    if ($resource === 'budget_lines') {
        $pr = (int) ($input['project_id'] ?? 0);
        if ($pr <= 0) {
            jsonOut(['ok' => false, 'error' => 'Falta project_id'], 400);
        }
        $st = $pdo->prepare(
            'INSERT INTO budget_lines (project_id, catalog_id, description, category, qty, unit_price) VALUES (?,?,?,?,?,?)'
        );
        $st->execute([
            $pr,
            isset($input['catalog_id']) ? (int) $input['catalog_id'] : null,
            (string) ($input['description'] ?? ''),
            (string) ($input['category'] ?? 'otro'),
            (float) ($input['qty'] ?? 1),
            (float) ($input['unit_price'] ?? 0),
        ]);
        jsonOut(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
    }

    if ($resource === 'mufas') {
        $st = $pdo->prepare(
            'INSERT INTO mufas (name, lat, lng, model, splice_count, notes, site_id, linked_pon_id) VALUES (?,?,?,?,?,?,?,?)'
        );
        $st->execute([
            (string) ($input['name'] ?? ''),
            (float) ($input['lat'] ?? 0),
            (float) ($input['lng'] ?? 0),
            (string) ($input['model'] ?? ''),
            (int) ($input['splice_count'] ?? 0),
            (string) ($input['notes'] ?? ''),
            isset($input['site_id']) && $input['site_id'] !== '' ? (int) $input['site_id'] : null,
            isset($input['linked_pon_id']) && $input['linked_pon_id'] !== '' ? (int) $input['linked_pon_id'] : null,
        ]);
        jsonOut(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
    }
    if ($resource === 'terminals') {
        $st = $pdo->prepare(
            'INSERT INTO terminals (name, lat, lng, port_count, notes) VALUES (?,?,?,?,?)'
        );
        $st->execute([
            (string) ($input['name'] ?? ''),
            (float) ($input['lat'] ?? 0),
            (float) ($input['lng'] ?? 0),
            (int) ($input['port_count'] ?? 8),
            (string) ($input['notes'] ?? ''),
        ]);
        jsonOut(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
    }
    if ($resource === 'cables') {
        $path = $input['path'] ?? [];
        if (!is_array($path) || count($path) < 2) {
            jsonOut(['ok' => false, 'error' => 'Un cable necesita al menos 2 puntos'], 400);
        }
        $fiberMap = $input['fiber_map'] ?? [];
        if (!is_array($fiberMap)) {
            $fiberMap = [];
        }
        $pathJson = json_encode($path, JSON_UNESCAPED_UNICODE);
        $fiberJson = json_encode($fiberMap, JSON_UNESCAPED_UNICODE);
        $st = $pdo->prepare(
            'INSERT INTO cables (name, fiber_count, path_json, color, notes, splice_count, manga_label, fiber_map_json) VALUES (?,?,?,?,?,?,?,?)'
        );
        $st->execute([
            (string) ($input['name'] ?? ''),
            (int) ($input['fiber_count'] ?? 12),
            $pathJson,
            (string) ($input['color'] ?? '#2563eb'),
            (string) ($input['notes'] ?? ''),
            (int) ($input['splice_count'] ?? 0),
            (string) ($input['manga_label'] ?? ''),
            $fiberJson,
        ]);
        jsonOut(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
    }
}

if ($method === 'PUT') {
    $pid = (int) ($input['id'] ?? 0);
    if ($pid <= 0) {
        jsonOut(['ok' => false, 'error' => 'Falta id en el cuerpo JSON'], 400);
    }

    if ($resource === 'buildings') {
        $st = $pdo->prepare('UPDATE buildings SET name=?, address=?, lat=?, lng=?, notes=? WHERE id=?');
        $st->execute([
            (string) ($input['name'] ?? ''),
            (string) ($input['address'] ?? ''),
            isset($input['lat']) && $input['lat'] !== '' ? (float) $input['lat'] : null,
            isset($input['lng']) && $input['lng'] !== '' ? (float) $input['lng'] : null,
            (string) ($input['notes'] ?? ''),
            $pid,
        ]);
        jsonOut(['ok' => true, 'updated' => $st->rowCount()]);
    }
    if ($resource === 'sites') {
        $stCur = $pdo->prepare('SELECT building_id FROM sites WHERE id = ?');
        $stCur->execute([$pid]);
        $exSite = $stCur->fetch(PDO::FETCH_ASSOC) ?: [];
        $bid = array_key_exists('building_id', $input)
            ? ($input['building_id'] === null || $input['building_id'] === '' ? null : (int) $input['building_id'])
            : (isset($exSite['building_id']) && $exSite['building_id'] !== null && $exSite['building_id'] !== ''
                ? (int) $exSite['building_id'] : null);
        $st = $pdo->prepare('UPDATE sites SET building_id=?, name=?, lat=?, lng=?, notes=? WHERE id=?');
        $st->execute([
            $bid,
            (string) ($input['name'] ?? ''),
            isset($input['lat']) && $input['lat'] !== '' ? (float) $input['lat'] : null,
            isset($input['lng']) && $input['lng'] !== '' ? (float) $input['lng'] : null,
            (string) ($input['notes'] ?? ''),
            $pid,
        ]);
        jsonOut(['ok' => true, 'updated' => $st->rowCount()]);
    }
    if ($resource === 'olts') {
        $st = $pdo->prepare('UPDATE olts SET site_id=?, name=?, notes=? WHERE id=?');
        $st->execute([
            (int) ($input['site_id'] ?? 0),
            (string) ($input['name'] ?? ''),
            (string) ($input['notes'] ?? ''),
            $pid,
        ]);
        jsonOut(['ok' => true, 'updated' => $st->rowCount()]);
    }
    if ($resource === 'olt_cards') {
        $st = $pdo->prepare('UPDATE olt_cards SET olt_id=?, label=?, sort_order=?, notes=? WHERE id=?');
        $st->execute([
            (int) ($input['olt_id'] ?? 0),
            (string) ($input['label'] ?? ''),
            (int) ($input['sort_order'] ?? 0),
            (string) ($input['notes'] ?? ''),
            $pid,
        ]);
        jsonOut(['ok' => true, 'updated' => $st->rowCount()]);
    }
    if ($resource === 'pons') {
        $st = $pdo->prepare(
            'UPDATE pons SET olt_card_id=?, pon_number=?, label=?, notes=? WHERE id=?'
        );
        $st->execute([
            (int) ($input['olt_card_id'] ?? 0),
            (int) ($input['pon_number'] ?? 1),
            (string) ($input['label'] ?? ''),
            (string) ($input['notes'] ?? ''),
            $pid,
        ]);
        jsonOut(['ok' => true, 'updated' => $st->rowCount()]);
    }
    if ($resource === 'pon_power_readings') {
        $mid = isset($input['mufa_id']) ? (int) $input['mufa_id'] : null;
        if ($input['mufa_id'] === null || $input['mufa_id'] === '') {
            $mid = null;
        }
        $st = $pdo->prepare(
            'UPDATE pon_power_readings SET pon_id=?, mufa_id=?, stage_name=?, dbm=?, notes=?, sort_order=? WHERE id=?'
        );
        $st->execute([
            (int) ($input['pon_id'] ?? 0),
            $mid,
            (string) ($input['stage_name'] ?? ''),
            isset($input['dbm']) && $input['dbm'] !== '' ? (float) $input['dbm'] : null,
            (string) ($input['notes'] ?? ''),
            (int) ($input['sort_order'] ?? 0),
            $pid,
        ]);
        jsonOut(['ok' => true, 'updated' => $st->rowCount()]);
    }
    if ($resource === 'price_catalog') {
        $st = $pdo->prepare(
            'UPDATE price_catalog SET name=?, category=?, unit_price=?, unit_label=?, notes=? WHERE id=?'
        );
        $st->execute([
            (string) ($input['name'] ?? ''),
            (string) ($input['category'] ?? 'otro'),
            (float) ($input['unit_price'] ?? 0),
            (string) ($input['unit_label'] ?? 'ud'),
            (string) ($input['notes'] ?? ''),
            $pid,
        ]);
        jsonOut(['ok' => true, 'updated' => $st->rowCount()]);
    }
    if ($resource === 'budget_projects') {
        $st = $pdo->prepare('UPDATE budget_projects SET name=?, notes=? WHERE id=?');
        $st->execute([(string) ($input['name'] ?? ''), (string) ($input['notes'] ?? ''), $pid]);
        jsonOut(['ok' => true, 'updated' => $st->rowCount()]);
    }
    if ($resource === 'budget_lines') {
        $st = $pdo->prepare(
            'UPDATE budget_lines SET project_id=?, catalog_id=?, description=?, category=?, qty=?, unit_price=? WHERE id=?'
        );
        $st->execute([
            (int) ($input['project_id'] ?? 0),
            isset($input['catalog_id']) ? (int) $input['catalog_id'] : null,
            (string) ($input['description'] ?? ''),
            (string) ($input['category'] ?? 'otro'),
            (float) ($input['qty'] ?? 1),
            (float) ($input['unit_price'] ?? 0),
            $pid,
        ]);
        jsonOut(['ok' => true, 'updated' => $st->rowCount()]);
    }

    if ($resource === 'mufas') {
        $st = $pdo->prepare(
            'UPDATE mufas SET name=?, lat=?, lng=?, model=?, splice_count=?, notes=?, site_id=?, linked_pon_id=? WHERE id=?'
        );
        $st->execute([
            (string) ($input['name'] ?? ''),
            (float) ($input['lat'] ?? 0),
            (float) ($input['lng'] ?? 0),
            (string) ($input['model'] ?? ''),
            (int) ($input['splice_count'] ?? 0),
            (string) ($input['notes'] ?? ''),
            isset($input['site_id']) && $input['site_id'] !== '' ? (int) $input['site_id'] : null,
            isset($input['linked_pon_id']) && $input['linked_pon_id'] !== '' ? (int) $input['linked_pon_id'] : null,
            $pid,
        ]);
        jsonOut(['ok' => true, 'updated' => $st->rowCount()]);
    }
    if ($resource === 'terminals') {
        $st = $pdo->prepare(
            'UPDATE terminals SET name=?, lat=?, lng=?, port_count=?, notes=? WHERE id=?'
        );
        $st->execute([
            (string) ($input['name'] ?? ''),
            (float) ($input['lat'] ?? 0),
            (float) ($input['lng'] ?? 0),
            (int) ($input['port_count'] ?? 8),
            (string) ($input['notes'] ?? ''),
            $pid,
        ]);
        jsonOut(['ok' => true, 'updated' => $st->rowCount()]);
    }
    if ($resource === 'cables') {
        $path = $input['path'] ?? null;
        if (is_array($path) && count($path) < 2) {
            jsonOut(['ok' => false, 'error' => 'Un cable necesita al menos 2 puntos'], 400);
        }
        $fiberMap = $input['fiber_map'] ?? null;
        $fiberJson = null;
        if (is_array($fiberMap)) {
            $fiberJson = json_encode($fiberMap, JSON_UNESCAPED_UNICODE);
        }
        if (is_array($path) && $fiberJson !== null) {
            $st = $pdo->prepare(
                'UPDATE cables SET name=?, fiber_count=?, path_json=?, color=?, notes=?, splice_count=?, manga_label=?, fiber_map_json=? WHERE id=?'
            );
            $st->execute([
                (string) ($input['name'] ?? ''),
                (int) ($input['fiber_count'] ?? 12),
                json_encode($path, JSON_UNESCAPED_UNICODE),
                (string) ($input['color'] ?? '#2563eb'),
                (string) ($input['notes'] ?? ''),
                (int) ($input['splice_count'] ?? 0),
                (string) ($input['manga_label'] ?? ''),
                $fiberJson,
                $pid,
            ]);
        } elseif (is_array($path)) {
            $st = $pdo->prepare(
                'UPDATE cables SET name=?, fiber_count=?, path_json=?, color=?, notes=?, splice_count=?, manga_label=? WHERE id=?'
            );
            $st->execute([
                (string) ($input['name'] ?? ''),
                (int) ($input['fiber_count'] ?? 12),
                json_encode($path, JSON_UNESCAPED_UNICODE),
                (string) ($input['color'] ?? '#2563eb'),
                (string) ($input['notes'] ?? ''),
                (int) ($input['splice_count'] ?? 0),
                (string) ($input['manga_label'] ?? ''),
                $pid,
            ]);
        } elseif ($fiberJson !== null) {
            $st = $pdo->prepare(
                'UPDATE cables SET name=?, fiber_count=?, color=?, notes=?, splice_count=?, manga_label=?, fiber_map_json=? WHERE id=?'
            );
            $st->execute([
                (string) ($input['name'] ?? ''),
                (int) ($input['fiber_count'] ?? 12),
                (string) ($input['color'] ?? '#2563eb'),
                (string) ($input['notes'] ?? ''),
                (int) ($input['splice_count'] ?? 0),
                (string) ($input['manga_label'] ?? ''),
                $fiberJson,
                $pid,
            ]);
        } else {
            $st = $pdo->prepare(
                'UPDATE cables SET name=?, fiber_count=?, color=?, notes=?, splice_count=?, manga_label=? WHERE id=?'
            );
            $st->execute([
                (string) ($input['name'] ?? ''),
                (int) ($input['fiber_count'] ?? 12),
                (string) ($input['color'] ?? '#2563eb'),
                (string) ($input['notes'] ?? ''),
                (int) ($input['splice_count'] ?? 0),
                (string) ($input['manga_label'] ?? ''),
                $pid,
            ]);
        }
        jsonOut(['ok' => true, 'updated' => $st->rowCount()]);
    }
}

if ($method === 'DELETE') {
    $deletable = [
        'mufas', 'terminals', 'cables', 'buildings', 'sites', 'olts', 'olt_cards', 'pons',
        'pon_power_readings', 'price_catalog', 'budget_projects', 'budget_lines',
    ];
    if (!in_array($resource, $deletable, true)) {
        jsonOut(['ok' => false, 'error' => 'Este recurso no se borra así'], 400);
    }
    if ($id <= 0) {
        jsonOut(['ok' => false, 'error' => 'Falta id'], 400);
    }
    try {
        $st = $pdo->prepare("DELETE FROM {$resource} WHERE id = ?");
        $st->execute([$id]);
        jsonOut(['ok' => true, 'deleted' => $st->rowCount()]);
    } catch (PDOException $e) {
        jsonOut(['ok' => false, 'error' => 'No se puede borrar (hay datos enlazados).'], 409);
    }
}

jsonOut(['ok' => false, 'error' => 'Método no permitido'], 405);
