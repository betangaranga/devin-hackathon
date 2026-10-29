"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import type { TopicMeta } from "@/lib/topics";

const BASEMAP =
  process.env.NEXT_PUBLIC_BASEMAP_URL ?? "https://tiles.openfreemap.org/styles/positron";

let protocolRegistered = false;

function circlePolygon(lng: number, lat: number, radiusM: number, steps = 64) {
  const coords: [number, number][] = [];
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [coords] } };
}

export function MapView({
  center,
  zoom = 15,
  topic,
  pinLabel,
}: {
  center: [number, number];
  zoom?: number;
  topic?: TopicMeta;
  pinLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!protocolRegistered) {
      const protocol = new Protocol();
      maplibregl.addProtocol("pmtiles", protocol.tile);
      protocolRegistered = true;
    }
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP,
      center,
      zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("load", () => {
      map.addSource("pin-radius", { type: "geojson", data: circlePolygon(center[0], center[1], 500) });
      map.addLayer({
        id: "pin-radius",
        type: "fill",
        source: "pin-radius",
        paint: { "fill-color": "#2563eb", "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: "pin-radius-line",
        type: "line",
        source: "pin-radius",
        paint: { "line-color": "#2563eb", "line-opacity": 0.4, "line-dasharray": [2, 2] },
      });
    });
    mapRef.current = map;
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center, zoom });
    markerRef.current?.remove();
    markerRef.current = new maplibregl.Marker().setLngLat(center).addTo(map);
    if (pinLabel) {
      markerRef.current.setPopup(new maplibregl.Popup({ offset: 24 }).setText(pinLabel));
    }
    map.once("load", () => {
      const src = map.getSource("pin-radius") as maplibregl.GeoJSONSource | undefined;
      src?.setData(circlePolygon(center[0], center[1], 500));
    });
    if (map.isStyleLoaded()) {
      (map.getSource("pin-radius") as maplibregl.GeoJSONSource | undefined)?.setData(
        circlePolygon(center[0], center[1], 500),
      );
    }
  }, [center, zoom, pinLabel]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !topic) return;
    const apply = () => {
      if (map.getLayer("topic-cells")) map.removeLayer("topic-cells");
      if (map.getSource("topic")) map.removeSource("topic");
      const url = `pmtiles://${window.location.origin}/data/layers/${topic.key}.pmtiles`;
      try {
        map.addSource("topic", { type: "vector", url });
        map.addLayer({
          id: "topic-cells",
          type: "fill",
          source: "topic",
          "source-layer": "cells",
          paint: {
            "fill-color": [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "score_0_100"], 0],
              0, "#dc2626",
              50, "#ea8a00",
              100, "#16a34a",
            ],
            "fill-opacity": 0.55,
          },
        });
      } catch (e) {
        console.warn(`Capa ${topic.key} no disponible aún:`, e);
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [topic]);

  return <div ref={containerRef} className="h-full min-h-[420px] w-full rounded-2xl" />;
}
