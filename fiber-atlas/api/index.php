<?php
declare(strict_types=1);

/**
 * API JSON para Fiber Atlas (SQLite).
 * GET    ?resource=mufas|terminals|cables[&id=]
 * POST   ?resource=...  body JSON (crear)
 * PUT    ?resource=...  body JSON con id (actualizar)
 * DELETE ?resource=...&id=
 */

header('Content-Type: application/json; charset=utf-8');

const ALLOWED = ['mufas', 'terminals', 'cables'];

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

function rowWithPath(array $row, string $resource): array
{
    if ($resource === 'cables' && isset($row['path_json'])) {
        $row['path'] = json_decode((string) $row['path_json'], true);
        if (!is_array($row['path'])) {
            $row['path'] = [];
        }
        unset($row['path_json']);
    }
    return $row;
}

if ($method === 'GET') {
    if ($id > 0) {
        $st = $pdo->prepare("SELECT * FROM {$resource} WHERE id = ?");
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) {
            jsonOut(['ok' => false, 'error' => 'No encontrado'], 404);
        }
        jsonOut(['ok' => true, 'data' => rowWithPath($row, $resource)]);
    }
    $rows = $pdo->query("SELECT * FROM {$resource} ORDER BY id DESC")->fetchAll();
    foreach ($rows as &$row) {
        $row = rowWithPath($row, $resource);
    }
    jsonOut(['ok' => true, 'data' => $rows]);
}

if ($method === 'POST') {
    if ($resource === 'mufas') {
        $st = $pdo->prepare(
            'INSERT INTO mufas (name, lat, lng, model, splice_count, notes) VALUES (?,?,?,?,?,?)'
        );
        $st->execute([
            (string) ($input['name'] ?? ''),
            (float) ($input['lat'] ?? 0),
            (float) ($input['lng'] ?? 0),
            (string) ($input['model'] ?? ''),
            (int) ($input['splice_count'] ?? 0),
            (string) ($input['notes'] ?? ''),
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
        $pathJson = json_encode($path, JSON_UNESCAPED_UNICODE);
        $st = $pdo->prepare(
            'INSERT INTO cables (name, fiber_count, path_json, color, notes) VALUES (?,?,?,?,?)'
        );
        $st->execute([
            (string) ($input['name'] ?? ''),
            (int) ($input['fiber_count'] ?? 12),
            $pathJson,
            (string) ($input['color'] ?? '#2563eb'),
            (string) ($input['notes'] ?? ''),
        ]);
        jsonOut(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
    }
}

if ($method === 'PUT') {
    $pid = (int) ($input['id'] ?? 0);
    if ($pid <= 0) {
        jsonOut(['ok' => false, 'error' => 'Falta id en el cuerpo JSON'], 400);
    }
    if ($resource === 'mufas') {
        $st = $pdo->prepare(
            'UPDATE mufas SET name=?, lat=?, lng=?, model=?, splice_count=?, notes=? WHERE id=?'
        );
        $st->execute([
            (string) ($input['name'] ?? ''),
            (float) ($input['lat'] ?? 0),
            (float) ($input['lng'] ?? 0),
            (string) ($input['model'] ?? ''),
            (int) ($input['splice_count'] ?? 0),
            (string) ($input['notes'] ?? ''),
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
        if (is_array($path)) {
            $st = $pdo->prepare(
                'UPDATE cables SET name=?, fiber_count=?, path_json=?, color=?, notes=? WHERE id=?'
            );
            $st->execute([
                (string) ($input['name'] ?? ''),
                (int) ($input['fiber_count'] ?? 12),
                json_encode($path, JSON_UNESCAPED_UNICODE),
                (string) ($input['color'] ?? '#2563eb'),
                (string) ($input['notes'] ?? ''),
                $pid,
            ]);
        } else {
            $st = $pdo->prepare(
                'UPDATE cables SET name=?, fiber_count=?, color=?, notes=? WHERE id=?'
            );
            $st->execute([
                (string) ($input['name'] ?? ''),
                (int) ($input['fiber_count'] ?? 12),
                (string) ($input['color'] ?? '#2563eb'),
                (string) ($input['notes'] ?? ''),
                $pid,
            ]);
        }
        jsonOut(['ok' => true, 'updated' => $st->rowCount()]);
    }
}

if ($method === 'DELETE') {
    if ($id <= 0) {
        jsonOut(['ok' => false, 'error' => 'Falta id'], 400);
    }
    $st = $pdo->prepare("DELETE FROM {$resource} WHERE id = ?");
    $st->execute([$id]);
    jsonOut(['ok' => true, 'deleted' => $st->rowCount()]);
}

jsonOut(['ok' => false, 'error' => 'Método no permitido'], 405);
