"""python -m pipeline.geo  →  data/processed/geo/{grid,colonias}.parquet + web/public/data/search/index.json"""
from pipeline.geo.build import run


def main():
    grid = run()
    print(f"grid: {len(grid)} cells, pop {grid['pop'].sum():,.0f}, "
          f"{grid['colonia'].notna().sum()} with colonia, {grid['cp'].notna().sum()} with cp, {(grid['pop'] > 0).sum()} inhabited")


if __name__ == "__main__":
    main()
