# -*- coding: utf-8 -*-
"""Replace leaked tenant-specific strings in mapwisp/ with safe placeholders.

Copy ``sanitize_replacements.example.json`` to ``sanitize_replacements.local.json``
(same folder; that file is gitignored) and list [old, new] pairs under ``replacements``.
If ``sanitize_replacements.local.json`` is missing, no string replacements run;
the optional ``app.js`` production-domain line tweak still runs when applicable.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "mapwisp"
_TOOLS = Path(__file__).resolve().parent
_LOCAL_JSON = _TOOLS / "sanitize_replacements.local.json"


def load_replacements() -> list[tuple[str, str]]:
    if not _LOCAL_JSON.exists():
        print(
            "Note: no tools/sanitize_replacements.local.json — skipping string replacements.",
            file=sys.stderr,
        )
        print(
            "  Copy sanitize_replacements.example.json to sanitize_replacements.local.json",
            file=sys.stderr,
        )
        return []
    data = json.loads(_LOCAL_JSON.read_text(encoding="utf-8"))
    raw = data.get("replacements", [])
    out: list[tuple[str, str]] = []
    for item in raw:
        if not isinstance(item, (list, tuple)) or len(item) != 2:
            raise ValueError("Each replacement must be [old_string, new_string]")
        a, b = item
        out.append((str(a), str(b)))
    return out


def patch_file(p: Path, replacements: list[tuple[str, str]]) -> bool:
    text = p.read_text(encoding="utf-8", errors="strict")
    orig = text
    for a, b in replacements:
        text = text.replace(a, b)
    if text != orig:
        p.write_text(text, encoding="utf-8", newline="\n")
        return True
    return False


def main() -> None:
    replacements = load_replacements()
    touched: list[Path] = []

    for sub in (ROOT / "js" / "controllers").glob("*.js"):
        if patch_file(sub, replacements):
            touched.append(sub)
    cs = ROOT / "js" / "services" / "chatService.js"
    if cs.exists() and patch_file(cs, replacements):
        touched.append(cs)
    for u in (ROOT / "users").glob("*"):
        if u.is_file():
            try:
                t = u.read_text(encoding="utf-8", errors="strict")
            except UnicodeDecodeError:
                continue
            if "<!DOCTYPE html>" in t or "<html" in t:
                if patch_file(u, replacements):
                    touched.append(u)

    app = ROOT / "js" / "app" / "app.js"
    if app.exists():
        t = app.read_text(encoding="utf-8")
        line = '                "mia4.tomodat.com",\n'
        if line in t:
            t = t.replace(
                line,
                '                /* "mia4.tomodat.com", */ // Añade aquí tu dominio de producción\n',
            )
            app.write_text(t, encoding="utf-8", newline="\n")
            touched.append(app)

    for p in touched:
        print("patched:", p.relative_to(ROOT))


if __name__ == "__main__":
    main()
