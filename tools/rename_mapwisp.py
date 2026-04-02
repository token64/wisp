# -*- coding: utf-8 -*-
"""Apply mapwisp rebrand: paths, Angular module, UI strings. Preserves API keys (db_tomodat, tomodat_version)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "mapwisp"
TEXT_EXT = {".js", ".css", ".html", ".md", ".txt", ".xml", ".json", ".ps1", ".conf", ".yml", ".yaml", ".sh", ".htaccess"}


def patch_text(s: str) -> str:
    s = s.replace("/tomodat/", "/mapwisp/")
    s = s.replace("/tomodat\"", "/mapwisp\"")
    s = s.replace("/tomodat'", "/mapwisp'")
    s = s.replace("/tomodat&", "/mapwisp&")
    s = s.replace("/tomodat#", "/mapwisp#")
    s = s.replace("angular.module(\"tomodat\"", "angular.module(\"mapwisp\"")
    s = s.replace("angular.module('tomodat'", "angular.module('mapwisp'")
    s = s.replace("ng-app='tomodat'", "ng-app='mapwisp'")
    s = s.replace('ng-app="tomodat"', 'ng-app="mapwisp"')
    s = s.replace("module(\"tomodat\")", "module(\"mapwisp\")")
    s = s.replace("module('tomodat')", "module('mapwisp')")
    s = s.replace("tomodat-modern.js", "mapwisp-modern.js")
    s = s.replace("tomodat.local", "mapwisp.local")
    s = s.replace("alert_tomodat.mp3", "alert_mapwisp.mp3")
    return s


def iter_files(base: Path):
    for p in base.rglob("*"):
        if p.is_file() and p.suffix.lower() in TEXT_EXT:
            # skip no extension if not allowed - users/login has no ext
            yield p


def main():
    for p in iter_files(APP):
        if p.name in ("login", "logout", "forgot_password") or p.suffix:
            try:
                t = p.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
            n = patch_text(t)
            if n != t:
                p.write_text(n, encoding="utf-8", newline="\n")

    # Extensionless HTML in users/
    ud = APP / "users"
    if ud.is_dir():
        for p in ud.iterdir():
            if p.is_file() and not p.suffix:
                try:
                    t = p.read_text(encoding="utf-8")
                except (UnicodeDecodeError, OSError):
                    continue
                if "<!DOCTYPE" in t or "<html" in t:
                    n = patch_text(t)
                    n = n.replace("TOMODAT 2.0", "MAPWISP 2.0")
                    n = n.replace("TOMODAT (v", "MAPWISP (v")
                    if n != t:
                        p.write_text(n, encoding="utf-8", newline="\n")

    print("OK mapwisp app tree")

    # mapService cosmetic renames (keep API field tomodat_version)
    ms = APP / "js" / "services" / "mapService.js"
    if ms.exists():
        t = ms.read_text(encoding="utf-8")
        t = t.replace("\t\ttomodatVersion:", "\t\tmapwispVersion:")
        t = t.replace("var currentTomodatVersion", "var currentMapwispVersion")
        t = t.replace("!== currentTomodatVersion", "!== currentMapwispVersion")
        t = t.replace("setUserVersion(currentTomodatVersion)", "setUserVersion(currentMapwispVersion)")
        t = t.replace('"tomodat - elemento sem nome"', '"mapwisp - elemento sem nome"')
        ms.write_text(t, encoding="utf-8", newline="\n")

    ap = APP / "js" / "services" / "accessPointService.js"
    if ap.exists():
        t = ap.read_text(encoding="utf-8")
        t = t.replace("generated, tomodat 2.0, web", "generated, mapwisp 2.0, web")
        ap.write_text(t, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
