from dataclasses import dataclass, field
from pathlib import Path

import geopandas as gpd
import pandas as pd
import yaml

from .h3grid import cell_centroids
from .paths import FIXTURES_DIR, MANIFEST_DIR, PROCESSED_DIR, RAW_DIR


def load_grid(use_fixtures: bool = False) -> gpd.GeoDataFrame:
    """Base grid: real grid from D1 (data/processed/geo/grid.parquet) or the fixture grid."""
    real = PROCESSED_DIR / "geo" / "grid.parquet"
    df = pd.read_parquet(real) if real.exists() and not use_fixtures else pd.read_csv(FIXTURES_DIR / "grid.csv", dtype={"cp": str})
    gdf = cell_centroids(df["h3"])
    return gdf.merge(df, on="h3")


def load_manifest(name: str) -> dict:
    with open(MANIFEST_DIR / f"{name}.yaml") as f:
        return yaml.safe_load(f)


@dataclass
class Context:
    grid: gpd.GeoDataFrame
    raw_dir: Path = RAW_DIR
    extra: dict = field(default_factory=dict)

    def dataset_dir(self, dataset_id: str) -> Path:
        """Folder with the raw files of a CKAN dataset, as written by pipeline.fetch."""
        return self.raw_dir / dataset_id

    def dataset_files(self, dataset_id: str, *suffixes: str) -> list[Path]:
        d = self.dataset_dir(dataset_id)
        if not d.exists():
            return []
        files = sorted(p for p in d.rglob("*") if p.is_file())
        return [p for p in files if not suffixes or p.suffix.lower() in suffixes]
