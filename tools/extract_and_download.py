# -*- coding: utf-8 -*-
"""Extract asset URLs from saved view-source HTML and download into local mapwisp/."""
from __future__ import annotations

import argparse
import html as html_lib
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
OUT_BASE = ROOT / "mapwisp"


def normalize_url(u: str) -> str:
    u = u.strip().rstrip('")')
    u = html_lib.unescape(u)
    return u


def collect_urls(text: str, base: str) -> set[str]:
    text = html_lib.unescape(text)
    base_norm = base.rstrip("/")
    esc = re.escape(base_norm)
    found = set(re.findall(rf"{esc}[^\s\"<>]+", text))
    out = set()
    for u in found:
        u = normalize_url(u)
        for bad in ('"', "'", ")", "&gt;", "&lt;"):
            if bad in u:
                u = u.split(bad)[0]
        if u.startswith(base_norm):
            out.add(u)
    return out


def url_to_local_path(url: str, base: str) -> Path:
    path = urlparse(url).path.lstrip("/")
    base_path = urlparse(base).path.rstrip("/")
    if base_path and path.startswith(base_path.lstrip("/")):
        path = path[len(base_path.lstrip("/")) :].lstrip("/")
    for prefix in ("tomodat/", "mapwisp/"):
        if path.startswith(prefix):
            path = path[len(prefix) :]
            break
    return OUT_BASE.joinpath(*path.split("/")) if path else OUT_BASE


def download(url: str, dest: Path) -> tuple[str, str]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (asset-mirror)"})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read()
        dest.write_bytes(data)
        return ("ok", str(dest.relative_to(ROOT)))
    except urllib.error.HTTPError as e:
        return ("http", f"{e.code} {url}")
    except Exception as e:
        return ("err", f"{url}: {e}")


def main() -> None:
    p = argparse.ArgumentParser(
        description="Download assets linked from a browser 'view source' HTML dump."
    )
    p.add_argument(
        "source_html",
        type=Path,
        help="Path to the saved view-source HTML file",
    )
    p.add_argument(
        "--base",
        required=True,
        help="Origin site base URL (e.g. https://mia4.tomodat.com)",
    )
    args = p.parse_args()
    source = args.source_html
    base = args.base.rstrip("/")

    if not source.is_file():
        print("Missing or not a file:", source, file=sys.stderr)
        sys.exit(1)

    text = source.read_text(encoding="utf-8", errors="replace")
    urls = sorted(collect_urls(text, base))
    print(f"Found {len(urls)} unique URLs under {base}")
    ok, fail = 0, []
    for url in urls:
        dest = url_to_local_path(url, base)
        if dest.exists() and dest.stat().st_size > 0:
            ok += 1
            continue
        status, msg = download(url, dest)
        if status == "ok":
            ok += 1
            print("OK", msg)
        else:
            fail.append(msg)
            print("FAIL", msg)
    print(f"\nDone. OK/skip: {ok}, failures: {len(fail)}")
    for f in fail:
        print(" ", f)


if __name__ == "__main__":
    main()
