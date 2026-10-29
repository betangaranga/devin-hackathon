from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"
MANIFEST_DIR = ROOT / "data" / "manifest"
FIXTURES_DIR = ROOT / "fixtures"
CONTRACTS_DIR = ROOT / "contracts"
WEB_DATA_DIR = ROOT / "web" / "public" / "data"
