# -*- coding: utf-8 -*-
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "mapwisp"

REPLACEMENTS = [
    ("AIzaSyA8Y3lJDbcrjKIjONGF2qHcoUU-LcHopUk", "YOUR_GOOGLE_MAPS_API_KEY"),
    ("UA-83746058-1", "UA-REPLACE-WITH-YOUR-ID"),
    ("https://wa.me/5542988068865", "https://wa.me/REPLACE_E164_SIN_SIGNOS"),
]


def patch_file(p: Path) -> bool:
    text = p.read_text(encoding="utf-8", errors="strict")
    orig = text
    for a, b in REPLACEMENTS:
        text = text.replace(a, b)
    if text != orig:
        p.write_text(text, encoding="utf-8", newline="\n")
        return True
    return False


def main():
    touched = []
    for sub in (ROOT / "js" / "controllers").glob("*.js"):
        if patch_file(sub):
            touched.append(sub)
    cs = ROOT / "js" / "services" / "chatService.js"
    if cs.exists() and patch_file(cs):
        touched.append(cs)
    for u in (ROOT / "users").glob("*"):
        if u.is_file():
            try:
                t = u.read_text(encoding="utf-8", errors="strict")
            except UnicodeDecodeError:
                continue
            if "<!DOCTYPE html>" in t or "<html" in t:
                if patch_file(u):
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
