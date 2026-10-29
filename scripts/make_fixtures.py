"""Regenerate fixtures/ (fictional data from the design prototype). python scripts/make_fixtures.py"""
import json
import random
from pathlib import Path

import h3

OUT = Path(__file__).resolve().parents[1] / "fixtures"
RES = 9
PLACES = [
    dict(id="a", label="Calle Ejemplo 120, Col. Las Arboledas", colonia="Las Arboledas (ejemplo)", cp="06700", alcaldia="Alcaldía Norte (ejemplo)", lat=19.4180, lon=-99.1650),
    dict(id="b", label="Calle Ficticia 45, Col. Los Pinos", colonia="Los Pinos (ejemplo)", cp="06000", alcaldia="Alcaldía Centro (ejemplo)", lat=19.4330, lon=-99.1410),
    dict(id="c", label="Calle Modelo 8, Col. Valle Verde", colonia="Valle Verde (ejemplo)", cp="09000", alcaldia="Alcaldía Oriente (ejemplo)", lat=19.3570, lon=-99.0650),
]
SCORES = {
    "a": dict(agua=78, inundacion=35, sismo=30, vial=41, ruido=38, calor=62, granizo=55, servicios=91),
    "b": dict(agua=64, inundacion=80, sismo=68, vial=22, ruido=18, calor=40, granizo=70, servicios=84),
    "c": dict(agua=12, inundacion=20, sismo=45, vial=66, ruido=74, calor=28, granizo=40, servicios=46),
}
CITY_WATER = [0.3, 0.3, 0.5, 0.8, 0.9, 0.7, 0.4, 0.3, 0.3, 0.4, 0.3, 0.3]
LEVELS = {1: "Peligro bajo", 2: "Peligro medio", 3: "Peligro medio-alto", 4: "Peligro alto"}


def offset(lat, lon, dlat, dlon):
    return round(lat + dlat, 6), round(lon + dlon, 6)


def cell_report(p):
    s = SCORES[p["id"]]
    lat, lon = p["lat"], p["lon"]
    water = {"a": [0.1, 0.1, 0.3, 0.4, 0.3, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2],
             "b": [0.2, 0.2, 0.4, 0.5, 0.5, 0.3, 0.2, 0.2, 0.2, 0.3, 0.2, 0.2],
             "c": [0.6, 0.8, 1.6, 2.4, 2.6, 1.9, 0.9, 0.7, 0.8, 0.9, 0.8, 0.8]}[p["id"]]
    incidents = {"a": [6, 7, 5, 8, 9, 7, 6, 8, 7, 6, 8, 7], "b": [10, 12, 9, 11, 13, 12, 10, 11, 12, 10, 11, 10], "c": [3, 4, 3, 2, 4, 3, 4, 3, 4, 3, 3, 3]}[p["id"]]
    flood = {"a": 3, "b": 1, "c": 4}[p["id"]]
    hail = {"a": 2, "b": 1, "c": 3}[p["id"]]
    temp = {"a": 17.9, "b": 18.6, "c": 19.4}[p["id"]]
    db = {"a": (71, 63), "b": (76, 69), "c": (62, 52)}[p["id"]]
    n_sismo = {"a": 6, "b": 1, "c": 3}[p["id"]]
    rnd = random.Random(p["id"])
    services = [("salud", "Centro de salud"), ("escuela", "Escuela primaria pública"), ("mercado", "Mercado público"),
                ("transporte", "Metro / Metrobús"), ("ecobici", "Cicloestación Ecobici"), ("wifi", "WiFi gratuito")]
    minutes = {"a": [6, 4, 9, 7, 3, 2], "b": [11, 8, 5, 4, 5, 1], "c": [14, 6, 8, 22, None, 4]}[p["id"]]
    nearest = []
    for (kind, name), m in zip(services, minutes):
        if m is None:
            continue
        la, lo = offset(lat, lon, rnd.uniform(-1, 1) * m * 0.0006, rnd.uniform(-1, 1) * m * 0.0006)
        nearest.append(dict(kind=kind, name=f"{name} (ejemplo)", minutes=m, lat=la, lon=lo))
    hotspots = [dict(name=n, n=k, lat=offset(lat, lon, rnd.uniform(-.003, .003), 0)[0], lon=offset(lat, lon, 0, rnd.uniform(-.003, .003))[1])
                for n, k in {"a": [("Av. Principal y Eje 5", 23), ("Av. Principal y Calle 9", 11), ("Eje 5 y Calle Roble", 7)],
                             "b": [("Eje Central y Av. Juárez (ej.)", 38), ("Eje Central y Calle 3", 19), ("Calle 3 y Calle 7", 9)],
                             "c": [("Av. Oriente y Calle 12", 9), ("Av. Oriente y Calle 20", 6), ("Calle 12 y Calle Sur", 3)]}[p["id"]]]
    nearby = [dict(name=f"Inmueble {i + 1} (ejemplo)", status="En reconstrucción",
                   lat=offset(lat, lon, rnd.uniform(-.004, .004), 0)[0], lon=offset(lat, lon, 0, rnd.uniform(-.004, .004))[1]) for i in range(n_sismo)]
    t = lambda key, raw, label, extra=None: dict(score=s.get(key), raw=raw, label=label, extra=extra or {})
    return {
        "h3": h3.latlng_to_cell(lat, lon, RES), "colonia": p["colonia"], "cp": p["cp"], "alcaldia": p["alcaldia"], "updated_at": "fixture",
        "topics": {
            "agua": t("agua", round(sum(water), 1), f"{sum(water):.1f} reportes / 1,000 hab.", dict(monthly=water, city_monthly=CITY_WATER)),
            "inundacion": t("inundacion", flood, LEVELS[flood], dict(level_label=LEVELS[flood])),
            "granizo": t("granizo", hail, LEVELS[hail], dict(level_label=LEVELS[hail])),
            "calor": t("calor", temp, f"{temp} °C", dict(city_min=13.0, city_max=20.5)),
            "sismo": t("sismo", n_sismo, f"{n_sismo} inmuebles", dict(nearby=nearby)),
            "vial": t("vial", sum(incidents), f"{sum(incidents)} incidentes", dict(monthly=incidents, city_ratio=round(sum(incidents) / 72, 2), hotspots=hotspots)),
            "ruido": t("ruido", db[0], f"{db[0]} dB / {db[1]} dB", dict(db_night=db[1])),
            "servicios": t("servicios", sorted(m for m in minutes if m)[len([m for m in minutes if m]) // 2], "ver detalle", dict(nearest=nearest)),
            "patrimonio": dict(score=None, raw=1 if p["id"] == "a" else 0, label="Dentro de área de conservación" if p["id"] == "a" else "Fuera de áreas de conservación",
                               extra=dict(zone_name="Área de conservación (ejemplo)" if p["id"] == "a" else None, catalogados_300m={"a": 12, "b": 2, "c": 0}[p["id"]])),
        },
    }


def main():
    OUT.mkdir(exist_ok=True)
    rows, seen, rnd = [], set(), random.Random(42)
    for p in PLACES:
        for c in sorted(h3.grid_disk(h3.latlng_to_cell(p["lat"], p["lon"], RES), 8)):
            if c in seen:
                continue
            seen.add(c)
            la, lo = h3.cell_to_latlng(c)
            rows.append(f'{c},{la:.6f},{lo:.6f},{p["colonia"]},{p["cp"]},{p["alcaldia"]},{rnd.randint(150, 900)}')
    (OUT / "grid.csv").write_text("h3,lat,lon,colonia,cp,alcaldia,poblacion\n" + "\n".join(rows) + "\n")
    (OUT / "cells.json").write_text(json.dumps([cell_report(p) for p in PLACES], ensure_ascii=False, indent=1))
    addrs = [dict(id=p["id"], label=p["label"], colonia=p["colonia"], cp=p["cp"], lat=p["lat"], lon=p["lon"], h3=h3.latlng_to_cell(p["lat"], p["lon"], RES)) for p in PLACES]
    (OUT / "addresses.json").write_text(json.dumps(addrs, ensure_ascii=False, indent=1))
    print(f"{len(rows)} grid cells, {len(PLACES)} cell reports")


if __name__ == "__main__":
    main()
