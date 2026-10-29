"""Download CKAN datasets listed in data/manifest/*.yaml into data/raw/<id>/.

Stdlib only, so it runs on any machine with Python 3.9+ (the portal blocks non-Mexican IPs):

    python3 -m pipeline.fetch                 # every dataset in the manifests
    python3 -m pipeline.fetch reportes-de-agua consumo-agua
    python3 -m pipeline.fetch --out /tmp/raw --max-mb 800

Writes data/raw/<id>/package.json (CKAN metadata), each resource file, and data/raw/index.json
with url, sha256, size and retrieval time per file.
"""
import argparse
import hashlib
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
API = "https://datos.cdmx.gob.mx/api/3/action/"
UA = {"User-Agent": "antes-de-rentar-fetch/0.1 (+https://github.com/betangaranga/devin-hackathon)"}
WANTED = {"csv", "geojson", "shp", "zip", "json", "kml", "xlsx"}


def manifest_ids() -> list[str]:
    ids = []
    for p in sorted((ROOT / "data" / "manifest").glob("*.yaml")):
        ids += re.findall(r"^\s*-\s*id:\s*(\S+)", p.read_text(), flags=re.M)
    return ids


def get_json(url: str, retries: int = 3) -> dict:
    for i in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            if i == retries - 1:
                raise
            print(f"  retry {url}: {e}", file=sys.stderr)
            time.sleep(2 * (i + 1))
    raise RuntimeError("unreachable")


def download(url: str, dest: Path, max_bytes: int) -> tuple[str, int]:
    h = hashlib.sha256()
    size = 0
    tmp = dest.with_suffix(dest.suffix + ".part")
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 20):
            size += len(chunk)
            if size > max_bytes:
                raise ValueError(f"larger than limit ({max_bytes >> 20} MB)")
            h.update(chunk)
            f.write(chunk)
    tmp.rename(dest)
    return h.hexdigest(), size


def safe_name(res: dict) -> str:
    path = urllib.parse.urlparse(res.get("url", "")).path
    name = Path(path).name or f"{res['id']}.{(res.get('format') or 'bin').lower()}"
    return re.sub(r"[^\w.\-]", "_", name)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--out", default=str(ROOT / "data" / "raw"))
    ap.add_argument("--max-mb", type=int, default=1500)
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    index_path = out / "index.json"
    index = json.loads(index_path.read_text()) if index_path.exists() else {}
    for ds in args.ids or manifest_ids():
        print(f"== {ds}")
        try:
            pkg = get_json(API + "package_show?id=" + urllib.parse.quote(ds))["result"]
        except Exception as e:  # noqa: BLE001
            print(f"  package_show failed: {e}")
            index[ds] = {"error": str(e)}
            continue
        d = out / ds
        d.mkdir(exist_ok=True)
        (d / "package.json").write_text(json.dumps(pkg, ensure_ascii=False, indent=1))
        files = []
        for res in pkg.get("resources", []):
            fmt = (res.get("format") or "").lower()
            if fmt not in WANTED or not res.get("url"):
                continue
            dest = d / safe_name(res)
            entry = {"resource_id": res["id"], "name": res.get("name"), "format": fmt, "url": res["url"], "file": dest.name,
                     "last_modified": res.get("last_modified") or res.get("metadata_modified")}
            try:
                entry["sha256"], entry["bytes"] = download(res["url"], dest, args.max_mb << 20)
                print(f"  ok {dest.name} ({entry['bytes'] >> 10} KB)")
            except Exception as e:  # noqa: BLE001
                entry["error"] = str(e)
                print(f"  fail {dest.name}: {e}")
            entry["retrieved_at"] = datetime.now(timezone.utc).isoformat()
            files.append(entry)
        index[ds] = {"title": pkg.get("title"), "organization": (pkg.get("organization") or {}).get("title"),
                     "license": pkg.get("license_id"), "metadata_modified": pkg.get("metadata_modified"), "files": files}
        index_path.write_text(json.dumps(index, ensure_ascii=False, indent=1))
    ok = sum(1 for v in index.values() if v.get("files"))
    print(f"done: {ok}/{len(index)} datasets with files -> {out}")


if __name__ == "__main__":
    main()
