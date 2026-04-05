<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/migrate.php';

const ALLOWED = [
    'mufas', 'terminals', 'cables', 'buildings', 'sites', 'olts', 'olt_cards', 'pons',
    'pon_power_readings', 'price_catalog', 'budget_projects', 'budget_lines', 'hierarchy',
    'map_project_bundle', 'map_project_purge',
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

/** Id de proyecto mapa (cliente), sin | */
function fa_normalize_project_id($raw): string
{
    $s = trim((string) $raw);
    if (strlen($s) > 120) {
        $s = substr($s, 0, 120);
    }
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $s)) {
        return '';
    }

    return $s;
}

/** SQL: map_scope empieza por projectId| */
function fa_where_map_scope_for_project(): string
{
    return '(instr(COALESCE(map_scope, \'\'), \'|\') > 0 AND substr(map_scope, 1, instr(map_scope, \'|\') - 1) = ?)';
}

/** Ámbito mapa: projectId|sectionId (cliente). Vacío = inválido para filtrar. */
function fa_normalize_map_scope($raw): string
{
    if ($raw === null || $raw === '') {
        return '';
    }
    $s = trim((string) $raw);
    if (strlen($s) > 200) {
        $s = substr($s, 0, 200);
    }
    if (!preg_match('/^[a-zA-Z0-9_.|-]+$/', $s)) {
        return '';
    }
    return $s;
}

/** PUT: conservar map_scope en BD si el cliente no lo envía. */
function fa_put_map_scope(PDO $pdo, string $table, int $id, array $input): string
{
    $allowed = ['mufas', 'terminals', 'cables', 'buildings'];
    if (!in_array($table, $allowed, true)) {
        return '';
    }
    if (array_key_exists('map_scope', $input)) {
        return fa_normalize_map_scope($input['map_scope']);
    }
    $st = $pdo->prepare("SELECT COALESCE(map_scope, '') AS m FROM {$table} WHERE id = ?");
    $st->execute([$id]);
    $r = $st->fetch(PDO::FETCH_ASSOC);

    return $r ? (string) $r['m'] : '';
}

/** PON de origen en terminal; null si vacío o id inválido. */
function fa_normalize_source_pon_id(PDO $pdo, $raw): ?int
{
    if ($raw === null || $raw === '') {
        return null;
    }
    $id = (int) $raw;
    if ($id <= 0) {
        return null;
    }
    $chk = $pdo->prepare('SELECT 1 FROM pons WHERE id = ?');
    $chk->execute([$id]);
    return $chk->fetch() ? $id : null;
}

/** PON del splitter en mufa (mismas claves que fa_normalize_pon_cascade pero prefijo splitter_). */
function fa_normalize_splitter_pon_cascade(PDO $pdo, array $input): array
{
    $sub = [
        'source_pon_id' => $input['splitter_source_pon_id'] ?? null,
        'source_olt_card_id' => $input['splitter_source_olt_card_id'] ?? null,
        'source_pon_number' => $input['splitter_source_pon_number'] ?? null,
    ];

    return fa_normalize_pon_cascade($pdo, $sub);
}

/**
 * Par (olt_card_id, pon_number) del origen PON de la mufa (linked o slot).
 */
function fa_mufa_main_pon_slot_pair(PDO $pdo, ?int $linkedPonId, ?int $sourceCardId, ?int $sourcePonNum): ?array
{
    if ($linkedPonId !== null && $linkedPonId > 0) {
        $st = $pdo->prepare('SELECT olt_card_id, pon_number FROM pons WHERE id = ?');
        $st->execute([$linkedPonId]);
        $x = $st->fetch(PDO::FETCH_ASSOC);
        if ($x) {
            return [(int) $x['olt_card_id'], (int) $x['pon_number']];
        }
    }
    if ($sourceCardId !== null && $sourceCardId > 0 && $sourcePonNum !== null && $sourcePonNum >= 1 && $sourcePonNum <= 16) {
        return [$sourceCardId, $sourcePonNum];
    }

    return null;
}

/** ¿Esta fila mufa usa el slot tarjeta+PON? (origen, splitter legado, splitters_json). */
function fa_mufa_row_claims_pon_slot(PDO $pdo, array $r, int $cardId, int $ponNum): bool
{
    $hit = static function (?array $pair) use ($cardId, $ponNum): bool {
        if ($pair === null) {
            return false;
        }

        return $pair[0] === $cardId && $pair[1] === $ponNum;
    };
    $lp = isset($r['linked_pon_id']) && $r['linked_pon_id'] !== null && $r['linked_pon_id'] !== ''
        ? (int) $r['linked_pon_id'] : null;
    $sc = isset($r['source_olt_card_id']) ? (int) $r['source_olt_card_id'] : 0;
    $pn = isset($r['source_pon_number']) ? (int) $r['source_pon_number'] : 0;
    if ($hit(fa_mufa_main_pon_slot_pair($pdo, $lp > 0 ? $lp : null, $sc > 0 ? $sc : null, $pn > 0 ? $pn : null))) {
        return true;
    }
    $splp = isset($r['splitter_linked_pon_id']) && (int) $r['splitter_linked_pon_id'] > 0 ? (int) $r['splitter_linked_pon_id'] : null;
    $ssc = (int) ($r['splitter_source_olt_card_id'] ?? 0);
    $spn = (int) ($r['splitter_source_pon_number'] ?? 0);
    $leg = fa_mufa_main_pon_slot_pair($pdo, $splp, $ssc > 0 ? $ssc : null, $spn > 0 ? $spn : null);
    if ($hit($leg)) {
        return true;
    }
    $j = json_decode((string) ($r['splitters_json'] ?? ''), true);
    if (!is_array($j)) {
        return false;
    }
    foreach ($j as $it) {
        if (!is_array($it)) {
            continue;
        }
        $ilp = isset($it['linked_pon_id']) && (int) $it['linked_pon_id'] > 0 ? (int) $it['linked_pon_id'] : null;
        $ic = (int) ($it['source_olt_card_id'] ?? 0);
        $in = (int) ($it['source_pon_number'] ?? 0);
        if ($hit(fa_mufa_main_pon_slot_pair($pdo, $ilp, $ic > 0 ? $ic : null, $in > 0 ? $in : null))) {
            return true;
        }
    }

    return false;
}

/**
 * Lista normalizada de splitters desde JSON del cliente (o vacío).
 * Cada elemento: qty, ratio, input_fiber, linked_pon_id, source_olt_card_id, source_pon_number.
 */
function fa_mufa_normalize_splitters_list(PDO $pdo, array $input): array
{
    $raw = $input['splitters'] ?? null;
    if ((!is_array($raw) || count($raw) === 0) && !empty($input['splitter_enabled'])) {
        [$lp, $sc, $pn] = fa_normalize_splitter_pon_cascade($pdo, $input);
        if ($sc !== null && $sc > 0 && $pn !== null && $pn >= 1 && $pn <= 16) {
            $ifiber = (int) ($input['splitter_input_fiber'] ?? 0);
            if ($ifiber < 1 || $ifiber > 12) {
                $ifiber = 1;
            }

            return [[
                'qty' => max(0, (int) ($input['splitter_qty'] ?? 0)),
                'ratio' => trim((string) ($input['splitter_type'] ?? '')),
                'input_fiber' => $ifiber,
                'linked_pon_id' => $lp,
                'source_olt_card_id' => $sc,
                'source_pon_number' => $pn,
            ]];
        }
    }
    if (!is_array($raw) || count($raw) === 0) {
        return [];
    }
    $out = [];
    $usedFiber = [];
    $usedSlots = [];
    foreach ($raw as $item) {
        if (!is_array($item)) {
            continue;
        }
        [$lp, $sc, $pn] = fa_normalize_pon_cascade($pdo, $item);
        if ($sc === null || $sc <= 0 || $pn === null || $pn < 1 || $pn > 16) {
            jsonOut(['ok' => false, 'error' => 'Cada splitter necesita site, OLT, tarjeta y PON.'], 400);
        }
        $sk = $sc . ':' . $pn;
        if (isset($usedSlots[$sk])) {
            jsonOut(['ok' => false, 'error' => 'No use el mismo PON en dos splitters de la misma mufa.'], 400);
        }
        $usedSlots[$sk] = 1;
        $qty = max(0, (int) ($item['qty'] ?? 1));
        $ratio = trim((string) ($item['ratio'] ?? ''));
        if (strlen($ratio) > 64) {
            $ratio = substr($ratio, 0, 64);
        }
        $ifiber = $item['input_fiber'] ?? null;
        if ($ifiber === '' || $ifiber === null) {
            jsonOut(['ok' => false, 'error' => 'Cada splitter necesita el pelo entrante (TIA 1–12).'], 400);
        }
        $ifiber = (int) $ifiber;
        if ($ifiber < 1 || $ifiber > 12) {
            jsonOut(['ok' => false, 'error' => 'Pelo entrante: elija 1–12 (colores TIA).'], 400);
        }
        if (isset($usedFiber[$ifiber])) {
            jsonOut(['ok' => false, 'error' => 'No repita el mismo pelo entrante entre splitters.'], 400);
        }
        $usedFiber[$ifiber] = 1;
        $out[] = [
            'qty' => $qty,
            'ratio' => $ratio,
            'input_fiber' => $ifiber,
            'linked_pon_id' => $lp,
            'source_olt_card_id' => $sc,
            'source_pon_number' => $pn,
        ];
    }

    return $out;
}

/**
 * Documentación de fibras: qué entra y qué sale de la mufa (referencia; no valida inventario).
 * @return array{entradas: list<array>, salidas: list<array>}
 */
function fa_normalize_fiber_io(array $input): array
{
    $raw = $input['fiber_io'] ?? null;
    if ($raw === null && isset($input['fiber_io_json'])) {
        $rj = json_decode((string) $input['fiber_io_json'], true);
        $raw = is_array($rj) ? $rj : [];
    }
    if (is_string($raw)) {
        $rj = json_decode($raw, true);
        $raw = is_array($rj) ? $rj : [];
    }
    if (!is_array($raw)) {
        $raw = [];
    }
    $outEnt = [];
    foreach (($raw['entradas'] ?? []) as $row) {
        if (count($outEnt) >= 32) {
            break;
        }
        if (!is_array($row)) {
            continue;
        }
        $outEnt[] = [
            'label' => substr(trim((string) ($row['label'] ?? '')), 0, 120),
            'origen' => substr(trim((string) ($row['origen'] ?? '')), 0, 300),
            'pelos' => substr(trim((string) ($row['pelos'] ?? '')), 0, 120),
            'notas' => substr(trim((string) ($row['notas'] ?? '')), 0, 500),
        ];
    }
    $outSal = [];
    foreach (($raw['salidas'] ?? []) as $row) {
        if (count($outSal) >= 32) {
            break;
        }
        if (!is_array($row)) {
            continue;
        }
        $outSal[] = [
            'label' => substr(trim((string) ($row['label'] ?? '')), 0, 120),
            'pelos' => substr(trim((string) ($row['pelos'] ?? '')), 0, 120),
            'ratio' => substr(trim((string) ($row['ratio'] ?? '')), 0, 64),
            'destino' => substr(trim((string) ($row['destino'] ?? '')), 0, 300),
            'notas' => substr(trim((string) ($row['notas'] ?? '')), 0, 500),
        ];
    }

    return ['entradas' => $outEnt, 'salidas' => $outSal];
}

/** Origen PON (mufa/cable): [source_pon_id|null, source_olt_card_id|null, source_pon_number|null]. */
function fa_normalize_pon_cascade(PDO $pdo, array $input): array
{
    $spIn = fa_normalize_source_pon_id($pdo, $input['source_pon_id'] ?? null);
    if ($spIn !== null) {
        $st = $pdo->prepare('SELECT olt_card_id, pon_number FROM pons WHERE id = ?');
        $st->execute([$spIn]);
        $r = $st->fetch(PDO::FETCH_ASSOC);
        if ($r) {
            return [$spIn, (int) $r['olt_card_id'], (int) $r['pon_number']];
        }
    }
    $sc = isset($input['source_olt_card_id']) ? (int) $input['source_olt_card_id'] : 0;
    $pn = isset($input['source_pon_number']) ? (int) $input['source_pon_number'] : 0;
    if ($sc <= 0 || $pn < 1 || $pn > 16) {
        return [null, null, null];
    }
    $chk = $pdo->prepare('SELECT 1 FROM olt_cards WHERE id = ?');
    $chk->execute([$sc]);
    if (!$chk->fetch()) {
        return [null, null, null];
    }
    $st = $pdo->prepare('SELECT id FROM pons WHERE olt_card_id = ? AND pon_number = ? LIMIT 1');
    $st->execute([$sc, $pn]);
    $found = $st->fetch(PDO::FETCH_ASSOC);
    $real = $found ? (int) $found['id'] : null;

    return [$real, $sc, $pn];
}

/** Cabecera (site): mismo bucket = misma «obra» lógica para no duplicar PON ahí. Sin vacío = -1 (compite con todo lo sin cabecera). */
function fa_pon_scope_bucket(?int $siteId): int
{
    return $siteId !== null && $siteId > 0 ? $siteId : -1;
}

function fa_mufa_scope_site_id(PDO $pdo, array $input, ?int $putId): ?int
{
    if (array_key_exists('site_id', $input)) {
        if ($input['site_id'] === null || $input['site_id'] === '') {
            return null;
        }

        return (int) $input['site_id'];
    }
    if ($putId !== null && $putId > 0) {
        $st = $pdo->prepare('SELECT site_id FROM mufas WHERE id = ?');
        $st->execute([$putId]);
        $r = $st->fetch(PDO::FETCH_ASSOC);
        if ($r && $r['site_id'] !== null && $r['site_id'] !== '') {
            return (int) $r['site_id'];
        }
    }

    return null;
}

function fa_cable_scope_site_id(PDO $pdo, array $input, ?int $putId): ?int
{
    if (array_key_exists('site_id', $input)) {
        if ($input['site_id'] === null || $input['site_id'] === '') {
            return null;
        }

        return (int) $input['site_id'];
    }
    if ($putId !== null && $putId > 0) {
        $st = $pdo->prepare('SELECT site_id FROM cables WHERE id = ?');
        $st->execute([$putId]);
        $r = $st->fetch(PDO::FETCH_ASSOC);
        if ($r && isset($r['site_id']) && $r['site_id'] !== null && $r['site_id'] !== '') {
            return (int) $r['site_id'];
        }
    }

    return null;
}

/**
 * Slot (tarjeta + P1–P16): terminales legado = global. Mufa/cable = mismo site (cabecera) o bucket -1 si sin site.
 */
function fa_pon_slot_busy_elsewhere(
    PDO $pdo,
    ?int $cardId,
    ?int $ponNum,
    ?int $skipMufaId,
    ?int $skipCableId,
    ?int $scopeSiteId
): ?string {
    if ($cardId === null || $cardId <= 0 || $ponNum === null || $ponNum < 1 || $ponNum > 16) {
        return null;
    }
    $st = $pdo->prepare(
        'SELECT id, name FROM terminals WHERE (source_pon_id IS NOT NULL AND source_pon_id IN (SELECT id FROM pons WHERE olt_card_id = ? AND pon_number = ?))
      OR (IFNULL(source_olt_card_id, 0) = ? AND IFNULL(source_pon_number, 0) = ?) LIMIT 1'
    );
    $st->execute([$cardId, $ponNum, $cardId, $ponNum]);
    $r = $st->fetch(PDO::FETCH_ASSOC);
    if ($r) {
        $n = (string) ($r['name'] ?? '');
        return 'Este POP está en uso por un terminal (legado) «' . ($n !== '' ? $n : '#' . $r['id']) . '»; quítalo ahí primero.';
    }

    $bucket = fa_pon_scope_bucket($scopeSiteId);
    $sqlM = 'SELECT id, name, linked_pon_id, source_olt_card_id, source_pon_number, splitter_linked_pon_id, splitter_source_olt_card_id, splitter_source_pon_number, splitters_json FROM mufas WHERE IFNULL(site_id, -1) = ?';
    $paramsM = [$bucket];
    if ($skipMufaId !== null) {
        $sqlM .= ' AND id != ?';
        $paramsM[] = $skipMufaId;
    }
    $st = $pdo->prepare($sqlM);
    $st->execute($paramsM);
    while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
        if (fa_mufa_row_claims_pon_slot($pdo, $r, $cardId, $ponNum)) {
            $n = (string) ($r['name'] ?? '');
            return 'Este PON ya está en otra mufa de la misma cabecera «' . ($n !== '' ? $n : '#' . $r['id']) . '».';
        }
    }
    $paramsC = [$cardId, $ponNum, $cardId, $ponNum, $bucket];
    $sqlC = 'SELECT id, name FROM cables WHERE ((source_pon_id IS NOT NULL AND source_pon_id IN (SELECT id FROM pons WHERE olt_card_id = ? AND pon_number = ?))
      OR (IFNULL(source_olt_card_id, 0) = ? AND IFNULL(source_pon_number, 0) = ?)) AND IFNULL(site_id, -1) = ?';
    if ($skipCableId !== null) {
        $sqlC .= ' AND id != ?';
        $paramsC[] = $skipCableId;
    }
    $sqlC .= ' LIMIT 1';
    $st = $pdo->prepare($sqlC);
    $st->execute($paramsC);
    $r = $st->fetch(PDO::FETCH_ASSOC);
    if ($r) {
        $n = (string) ($r['name'] ?? '');
        return 'Este PON ya está en otra manga de la misma cabecera «' . ($n !== '' ? $n : '#' . $r['id']) . '».';
    }

    return null;
}

/** Terminal: mufa o cable + ref. splitter; drop_attach = mufa|cable. */
function fa_normalize_terminal_drop(PDO $pdo, array $input): array
{
    $attach = (string) ($input['drop_attach'] ?? '');
    $mid = null;
    $cid = null;
    if ($attach === 'mufa') {
        if (isset($input['drop_mufa_id']) && $input['drop_mufa_id'] !== '' && $input['drop_mufa_id'] !== null) {
            $mid = (int) $input['drop_mufa_id'];
            if ($mid > 0) {
                $chk = $pdo->prepare('SELECT 1 FROM mufas WHERE id = ?');
                $chk->execute([$mid]);
                if (!$chk->fetch()) {
                    $mid = null;
                }
            } else {
                $mid = null;
            }
        }
    } elseif ($attach === 'cable') {
        if (isset($input['drop_cable_id']) && $input['drop_cable_id'] !== '' && $input['drop_cable_id'] !== null) {
            $cid = (int) $input['drop_cable_id'];
            if ($cid > 0) {
                $chk = $pdo->prepare('SELECT 1 FROM cables WHERE id = ?');
                $chk->execute([$cid]);
                if (!$chk->fetch()) {
                    $cid = null;
                }
            } else {
                $cid = null;
            }
        }
    }
    $sref = trim((string) ($input['splitter_ref'] ?? ''));
    if (strlen($sref) > 240) {
        $sref = substr($sref, 0, 240);
    }

    return [$mid, $cid, $sref];
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

/** Backup JSON: todo lo del mapa bajo un project_id (parte izquierda de map_scope). */
if ($resource === 'map_project_bundle' && $method === 'GET') {
    $pid = fa_normalize_project_id($_GET['project_id'] ?? '');
    if ($pid === '') {
        jsonOut(['ok' => false, 'error' => 'Falta project_id válido'], 400);
    }
    $w = fa_where_map_scope_for_project();
    $st = $pdo->prepare("SELECT * FROM buildings WHERE {$w} ORDER BY id");
    $st->execute([$pid]);
    $bundleBuildings = $st->fetchAll();
    $st = $pdo->prepare("SELECT * FROM mufas WHERE {$w} ORDER BY id");
    $st->execute([$pid]);
    $bundleMufas = $st->fetchAll();
    $st = $pdo->prepare("SELECT * FROM cables WHERE {$w} ORDER BY id");
    $st->execute([$pid]);
    $bundleCables = $st->fetchAll();
    foreach ($bundleCables as &$row) {
        $row = rowWithExtras($row, 'cables');
    }
    unset($row);
    $st = $pdo->prepare("SELECT * FROM terminals WHERE {$w} ORDER BY id");
    $st->execute([$pid]);
    $bundleTerminals = $st->fetchAll();
    jsonOut([
        'ok' => true,
        'data' => [
            'buildings' => $bundleBuildings,
            'mufas' => $bundleMufas,
            'cables' => $bundleCables,
            'terminals' => $bundleTerminals,
        ],
    ]);
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
    if (in_array($resource, ['mufas', 'terminals', 'cables', 'buildings'], true)) {
        $ms = isset($_GET['map_scope']) ? fa_normalize_map_scope($_GET['map_scope']) : '';
        if ($ms !== '') {
            $inc = isset($_GET['include_unscoped']) && (string) $_GET['include_unscoped'] === '1';
            if ($inc) {
                $w[] = '(map_scope = ? OR IFNULL(TRIM(map_scope), \'\') = \'\')';
                $params[] = $ms;
            } else {
                $w[] = 'map_scope = ?';
                $params[] = $ms;
            }
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
    if ($resource === 'map_project_purge') {
        $pid = fa_normalize_project_id($input['project_id'] ?? '');
        if ($pid === '') {
            jsonOut(['ok' => false, 'error' => 'Falta project_id válido'], 400);
        }
        $w = fa_where_map_scope_for_project();
        try {
            $pdo->beginTransaction();
            $pdo->prepare("DELETE FROM terminals WHERE {$w}")->execute([$pid]);
            $pdo->prepare("DELETE FROM cables WHERE {$w}")->execute([$pid]);
            $pdo->prepare("DELETE FROM mufas WHERE {$w}")->execute([$pid]);
            $pdo->prepare("DELETE FROM buildings WHERE {$w}")->execute([$pid]);
            $pdo->commit();
        } catch (PDOException $e) {
            $pdo->rollBack();
            jsonOut(['ok' => false, 'error' => 'No se pudo purgar: ' . $e->getMessage()], 500);
        }
        jsonOut(['ok' => true, 'purged' => true]);
    }
    if ($resource === 'buildings') {
        $msB = fa_normalize_map_scope($input['map_scope'] ?? '');
        $st = $pdo->prepare(
            'INSERT INTO buildings (name, address, lat, lng, notes, map_scope) VALUES (?,?,?,?,?,?)'
        );
        $st->execute([
            (string) ($input['name'] ?? ''),
            (string) ($input['address'] ?? ''),
            isset($input['lat']) && $input['lat'] !== '' ? (float) $input['lat'] : null,
            isset($input['lng']) && $input['lng'] !== '' ? (float) $input['lng'] : null,
            (string) ($input['notes'] ?? ''),
            $msB,
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
        [$lp, $scard, $pnum] = fa_normalize_pon_cascade($pdo, $input);
        $muScope = fa_mufa_scope_site_id($pdo, $input, null);
        $busy = fa_pon_slot_busy_elsewhere($pdo, $scard, $pnum, null, null, $muScope);
        if ($busy !== null) {
            jsonOut(['ok' => false, 'error' => $busy], 409);
        }
        $splitList = fa_mufa_normalize_splitters_list($pdo, $input);
        $splEn = count($splitList) > 0;
        $mainPair = fa_mufa_main_pon_slot_pair($pdo, $lp, $scard, $pnum);
        foreach ($splitList as $spl) {
            $busyS = fa_pon_slot_busy_elsewhere($pdo, $spl['source_olt_card_id'], $spl['source_pon_number'], null, null, $muScope);
            if ($busyS !== null) {
                jsonOut(['ok' => false, 'error' => $busyS], 409);
            }
            if ($mainPair !== null
                && $spl['source_olt_card_id'] === $mainPair[0]
                && $spl['source_pon_number'] === $mainPair[1]) {
                jsonOut(['ok' => false, 'error' => 'El PON del splitter no puede ser el mismo que el origen PON de la mufa.'], 400);
            }
        }
        $slp = null;
        $sscard = null;
        $spnum = null;
        $sqty = 0;
        $stype = '';
        if ($splEn) {
            $slp = $splitList[0]['linked_pon_id'];
            $sscard = $splitList[0]['source_olt_card_id'];
            $spnum = $splitList[0]['source_pon_number'];
            $sqty = $splitList[0]['qty'];
            $stype = $splitList[0]['ratio'];
        }
        $useSplCol = !empty($input['splitter_use_fiber_color']) ? 1 : 0;
        $splitJson = json_encode($splitList, JSON_UNESCAPED_UNICODE);
        $fiberIoJson = json_encode(fa_normalize_fiber_io($input), JSON_UNESCAPED_UNICODE);
        $msMu = fa_normalize_map_scope($input['map_scope'] ?? '');
        $st = $pdo->prepare(
            'INSERT INTO mufas (name, lat, lng, model, splice_count, notes, site_id, linked_pon_id, source_olt_card_id, source_pon_number, map_scope, splitter_enabled, splitter_qty, splitter_type, splitter_linked_pon_id, splitter_source_olt_card_id, splitter_source_pon_number, splitter_use_fiber_color, splitters_json, fiber_io_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        );
        $st->execute([
            (string) ($input['name'] ?? ''),
            (float) ($input['lat'] ?? 0),
            (float) ($input['lng'] ?? 0),
            (string) ($input['model'] ?? ''),
            (int) ($input['splice_count'] ?? 0),
            (string) ($input['notes'] ?? ''),
            isset($input['site_id']) && $input['site_id'] !== '' ? (int) $input['site_id'] : null,
            $lp,
            $scard,
            $pnum,
            $msMu,
            $splEn ? 1 : 0,
            $sqty,
            $stype,
            $slp,
            $sscard,
            $spnum,
            $useSplCol,
            $splitJson,
            $fiberIoJson,
        ]);
        jsonOut(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
    }
    if ($resource === 'terminals') {
        $mc = strtolower((string) ($input['marker_color'] ?? 'green'));
        if (!in_array($mc, ['green', 'yellow', 'red'], true)) {
            $mc = 'green';
        }
        $df = $input['drop_fiber'] ?? null;
        if ($df === '' || $df === null) {
            $df = null;
        } else {
            $df = (int) $df;
            if ($df < 1 || $df > 12) {
                $df = null;
            }
        }
        [$dmid, $dcid, $sref] = fa_normalize_terminal_drop($pdo, $input);
        $msTe = fa_normalize_map_scope($input['map_scope'] ?? '');
        $st = $pdo->prepare(
            'INSERT INTO terminals (name, lat, lng, port_count, marker_color, drop_fiber, drop_mufa_id, drop_cable_id, splitter_ref, notes, map_scope) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
        );
        $st->execute([
            (string) ($input['name'] ?? ''),
            (float) ($input['lat'] ?? 0),
            (float) ($input['lng'] ?? 0),
            (int) ($input['port_count'] ?? 8),
            $mc,
            $df,
            $dmid,
            $dcid,
            $sref,
            (string) ($input['notes'] ?? ''),
            $msTe,
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
        [$csp, $cscard, $cpnum] = fa_normalize_pon_cascade($pdo, $input);
        $cScopeIns = fa_cable_scope_site_id($pdo, $input, null);
        $busyC = fa_pon_slot_busy_elsewhere($pdo, $cscard, $cpnum, null, null, $cScopeIns);
        if ($busyC !== null) {
            jsonOut(['ok' => false, 'error' => $busyC], 409);
        }
        $msCa = fa_normalize_map_scope($input['map_scope'] ?? '');
        $st = $pdo->prepare(
            'INSERT INTO cables (name, fiber_count, fiber_spec, path_json, color, notes, splice_count, manga_label, fiber_map_json, site_id, source_pon_id, source_olt_card_id, source_pon_number, map_scope) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        );
        $st->execute([
            (string) ($input['name'] ?? ''),
            (int) ($input['fiber_count'] ?? 12),
            (string) ($input['fiber_spec'] ?? ''),
            $pathJson,
            (string) ($input['color'] ?? '#2563eb'),
            (string) ($input['notes'] ?? ''),
            (int) ($input['splice_count'] ?? 0),
            (string) ($input['manga_label'] ?? ''),
            $fiberJson,
            isset($input['site_id']) && $input['site_id'] !== '' ? (int) $input['site_id'] : null,
            $csp,
            $cscard,
            $cpnum,
            $msCa,
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
        $msBu = fa_put_map_scope($pdo, 'buildings', $pid, $input);
        $st = $pdo->prepare('UPDATE buildings SET name=?, address=?, lat=?, lng=?, notes=?, map_scope=? WHERE id=?');
        $st->execute([
            (string) ($input['name'] ?? ''),
            (string) ($input['address'] ?? ''),
            isset($input['lat']) && $input['lat'] !== '' ? (float) $input['lat'] : null,
            isset($input['lng']) && $input['lng'] !== '' ? (float) $input['lng'] : null,
            (string) ($input['notes'] ?? ''),
            $msBu,
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
        [$lp, $scard, $pnum] = fa_normalize_pon_cascade($pdo, $input);
        $muScopePut = fa_mufa_scope_site_id($pdo, $input, $pid);
        $busyMu = fa_pon_slot_busy_elsewhere($pdo, $scard, $pnum, $pid, null, $muScopePut);
        if ($busyMu !== null) {
            jsonOut(['ok' => false, 'error' => $busyMu], 409);
        }
        $splitList = fa_mufa_normalize_splitters_list($pdo, $input);
        $splEn = count($splitList) > 0;
        $mainPair = fa_mufa_main_pon_slot_pair($pdo, $lp, $scard, $pnum);
        foreach ($splitList as $spl) {
            $busySpl = fa_pon_slot_busy_elsewhere($pdo, $spl['source_olt_card_id'], $spl['source_pon_number'], $pid, null, $muScopePut);
            if ($busySpl !== null) {
                jsonOut(['ok' => false, 'error' => $busySpl], 409);
            }
            if ($mainPair !== null
                && $spl['source_olt_card_id'] === $mainPair[0]
                && $spl['source_pon_number'] === $mainPair[1]) {
                jsonOut(['ok' => false, 'error' => 'El PON del splitter no puede ser el mismo que el origen PON de la mufa.'], 400);
            }
        }
        $slp = null;
        $sscard = null;
        $spnum = null;
        $sqty = 0;
        $stype = '';
        if ($splEn) {
            $slp = $splitList[0]['linked_pon_id'];
            $sscard = $splitList[0]['source_olt_card_id'];
            $spnum = $splitList[0]['source_pon_number'];
            $sqty = $splitList[0]['qty'];
            $stype = $splitList[0]['ratio'];
        }
        $useSplCol = !empty($input['splitter_use_fiber_color']) ? 1 : 0;
        $splitJson = json_encode($splitList, JSON_UNESCAPED_UNICODE);
        $fiberIoJson = json_encode(fa_normalize_fiber_io($input), JSON_UNESCAPED_UNICODE);
        $msMup = fa_put_map_scope($pdo, 'mufas', $pid, $input);
        $st = $pdo->prepare(
            'UPDATE mufas SET name=?, lat=?, lng=?, model=?, splice_count=?, notes=?, site_id=?, linked_pon_id=?, source_olt_card_id=?, source_pon_number=?, map_scope=?, splitter_enabled=?, splitter_qty=?, splitter_type=?, splitter_linked_pon_id=?, splitter_source_olt_card_id=?, splitter_source_pon_number=?, splitter_use_fiber_color=?, splitters_json=?, fiber_io_json=? WHERE id=?'
        );
        $st->execute([
            (string) ($input['name'] ?? ''),
            (float) ($input['lat'] ?? 0),
            (float) ($input['lng'] ?? 0),
            (string) ($input['model'] ?? ''),
            (int) ($input['splice_count'] ?? 0),
            (string) ($input['notes'] ?? ''),
            isset($input['site_id']) && $input['site_id'] !== '' ? (int) $input['site_id'] : null,
            $lp,
            $scard,
            $pnum,
            $msMup,
            $splEn ? 1 : 0,
            $sqty,
            $stype,
            $slp,
            $sscard,
            $spnum,
            $useSplCol,
            $splitJson,
            $fiberIoJson,
            $pid,
        ]);
        jsonOut(['ok' => true, 'updated' => $st->rowCount()]);
    }
    if ($resource === 'terminals') {
        $mc = strtolower((string) ($input['marker_color'] ?? 'green'));
        if (!in_array($mc, ['green', 'yellow', 'red'], true)) {
            $mc = 'green';
        }
        $df = $input['drop_fiber'] ?? null;
        if ($df === '' || $df === null) {
            $df = null;
        } else {
            $df = (int) $df;
            if ($df < 1 || $df > 12) {
                $df = null;
            }
        }
        [$dmid, $dcid, $sref] = fa_normalize_terminal_drop($pdo, $input);
        $msTep = fa_put_map_scope($pdo, 'terminals', $pid, $input);
        $st = $pdo->prepare(
            'UPDATE terminals SET name=?, lat=?, lng=?, port_count=?, marker_color=?, drop_fiber=?, drop_mufa_id=?, drop_cable_id=?, splitter_ref=?, source_pon_id=NULL, source_olt_card_id=NULL, source_pon_number=NULL, notes=?, map_scope=? WHERE id=?'
        );
        $st->execute([
            (string) ($input['name'] ?? ''),
            (float) ($input['lat'] ?? 0),
            (float) ($input['lng'] ?? 0),
            (int) ($input['port_count'] ?? 8),
            $mc,
            $df,
            $dmid,
            $dcid,
            $sref,
            (string) ($input['notes'] ?? ''),
            $msTep,
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
        $fiberSpec = (string) ($input['fiber_spec'] ?? '');
        [$csp, $cscard, $cpnum] = fa_normalize_pon_cascade($pdo, $input);
        $cScopePut = fa_cable_scope_site_id($pdo, $input, $pid);
        $busyUp = fa_pon_slot_busy_elsewhere($pdo, $cscard, $cpnum, null, $pid, $cScopePut);
        if ($busyUp !== null) {
            jsonOut(['ok' => false, 'error' => $busyUp], 409);
        }
        $msCab = fa_put_map_scope($pdo, 'cables', $pid, $input);
        if (array_key_exists('site_id', $input)) {
            $cSiteVal = $input['site_id'] === null || $input['site_id'] === '' ? null : (int) $input['site_id'];
        } else {
            $stS = $pdo->prepare('SELECT site_id FROM cables WHERE id = ?');
            $stS->execute([$pid]);
            $rS = $stS->fetch(PDO::FETCH_ASSOC);
            $cSiteVal = $rS && $rS['site_id'] !== null && $rS['site_id'] !== '' ? (int) $rS['site_id'] : null;
        }
        if (is_array($path) && $fiberJson !== null) {
            $st = $pdo->prepare(
                'UPDATE cables SET name=?, fiber_count=?, fiber_spec=?, path_json=?, color=?, notes=?, splice_count=?, manga_label=?, fiber_map_json=?, site_id=?, source_pon_id=?, source_olt_card_id=?, source_pon_number=?, map_scope=? WHERE id=?'
            );
            $st->execute([
                (string) ($input['name'] ?? ''),
                (int) ($input['fiber_count'] ?? 12),
                $fiberSpec,
                json_encode($path, JSON_UNESCAPED_UNICODE),
                (string) ($input['color'] ?? '#2563eb'),
                (string) ($input['notes'] ?? ''),
                (int) ($input['splice_count'] ?? 0),
                (string) ($input['manga_label'] ?? ''),
                $fiberJson,
                $cSiteVal,
                $csp,
                $cscard,
                $cpnum,
                $msCab,
                $pid,
            ]);
        } elseif (is_array($path)) {
            $st = $pdo->prepare(
                'UPDATE cables SET name=?, fiber_count=?, fiber_spec=?, path_json=?, color=?, notes=?, splice_count=?, manga_label=?, site_id=?, source_pon_id=?, source_olt_card_id=?, source_pon_number=?, map_scope=? WHERE id=?'
            );
            $st->execute([
                (string) ($input['name'] ?? ''),
                (int) ($input['fiber_count'] ?? 12),
                $fiberSpec,
                json_encode($path, JSON_UNESCAPED_UNICODE),
                (string) ($input['color'] ?? '#2563eb'),
                (string) ($input['notes'] ?? ''),
                (int) ($input['splice_count'] ?? 0),
                (string) ($input['manga_label'] ?? ''),
                $cSiteVal,
                $csp,
                $cscard,
                $cpnum,
                $msCab,
                $pid,
            ]);
        } elseif ($fiberJson !== null) {
            $st = $pdo->prepare(
                'UPDATE cables SET name=?, fiber_count=?, fiber_spec=?, color=?, notes=?, splice_count=?, manga_label=?, fiber_map_json=?, site_id=?, source_pon_id=?, source_olt_card_id=?, source_pon_number=?, map_scope=? WHERE id=?'
            );
            $st->execute([
                (string) ($input['name'] ?? ''),
                (int) ($input['fiber_count'] ?? 12),
                $fiberSpec,
                (string) ($input['color'] ?? '#2563eb'),
                (string) ($input['notes'] ?? ''),
                (int) ($input['splice_count'] ?? 0),
                (string) ($input['manga_label'] ?? ''),
                $fiberJson,
                $cSiteVal,
                $csp,
                $cscard,
                $cpnum,
                $msCab,
                $pid,
            ]);
        } else {
            $st = $pdo->prepare(
                'UPDATE cables SET name=?, fiber_count=?, fiber_spec=?, color=?, notes=?, splice_count=?, manga_label=?, site_id=?, source_pon_id=?, source_olt_card_id=?, source_pon_number=?, map_scope=? WHERE id=?'
            );
            $st->execute([
                (string) ($input['name'] ?? ''),
                (int) ($input['fiber_count'] ?? 12),
                $fiberSpec,
                (string) ($input['color'] ?? '#2563eb'),
                (string) ($input['notes'] ?? ''),
                (int) ($input['splice_count'] ?? 0),
                (string) ($input['manga_label'] ?? ''),
                $cSiteVal,
                $csp,
                $cscard,
                $cpnum,
                $msCab,
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
