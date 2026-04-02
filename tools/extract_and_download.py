# -*- coding: utf-8 -*-
"""Extract asset URLs from saved view-source HTML and download to local mapwisp/."""
import html as html_lib
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / (
    "view-source_https___mia4.tomodat.com_tomodat_users_login_q="
    "_tomodat_webroot_users_login&q=_tomodat_webroot_users_login&.html"
)
OUT_BASE = ROOT / "mapwisp"
BASE = "https://mia4.tomodat.com"


def normalize_url(u: str) -> str:
    u = u.strip().rstrip('")')
    u = html_lib.unescape(u)
    return u


def collect_urls(text: str) -> set[str]:
    text = html_lib.unescape(text)
    found = set(re.findall(r"https://mia4\.tomodat\.com[^\s\"<>]+", text))
    out = set()
    for u in found:
        u = normalize_url(u)
        # Trim trailing junk
        for bad in ('"', "'", ")", "&gt;", "&lt;"):
            if bad in u:
                u = u.split(bad)[0]
        if u.startswith(BASE):
            out.add(u)
    return out


def url_to_local_path(url: str) -> Path:
    from urllib.parse import urlparse

    path = urlparse(url).path.lstrip("/")
    if path.startswith("tomodat/"):
        path = path[8:]
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


def main():
    if not SOURCE.exists():
        print("Missing source HTML:", SOURCE)
        sys.exit(1)
    text = SOURCE.read_text(encoding="utf-8", errors="replace")
    urls = sorted(collect_urls(text))
    print(f"Found {len(urls)} unique Tomodat URLs")
    ok, fail = 0, []
    for url in urls:
        dest = url_to_local_path(url)
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
