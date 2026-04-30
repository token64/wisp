<?php
declare(strict_types=1);
/* Respaldo si DirectoryIndex no toma index.html (evita 403 con -Indexes). */
header('Content-Type: text/html; charset=utf-8');
$path = __DIR__ . DIRECTORY_SEPARATOR . 'index.html';
if (is_readable($path)) {
    readfile($path);
    return;
}
http_response_code(500);
echo 'Falta index.html en public/.';
