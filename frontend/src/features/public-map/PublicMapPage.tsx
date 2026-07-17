import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { motion, type Variants } from "framer-motion";
import { api } from "../../shared/api/client";
import { AppShell } from "../../shared/components/AppShell";
import { Icon } from "../../shared/components/Icon";
import { riskColors as riskColor } from "../../shared/constants/risk";

type GeoJsonFeature = { type: "Feature"; id: string; geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> };
type FeatureCollection = { type: "FeatureCollection"; features: GeoJsonFeature[] };
type Prediction = { prediction_date: string; region?: { regency?: string | null } | null };
type MapLayers = {
  tidal_stations: FeatureCollection;
  coastlines: FeatureCollection;
  critical_infrastructure: FeatureCollection;
  evacuation_routes: FeatureCollection;
};
type ActiveWarning = { title: string; message: string; affected_regencies?: string[]; source?: string };
type DataFreshness = { last_generated_at: string | null; is_stale: boolean; notice: string | null };
type MapResponse = { data: { regions: FeatureCollection; reports: FeatureCollection; layers?: MapLayers; active_warning?: ActiveWarning | null; data_freshness?: DataFreshness } };
type PredictionResponse = { data: Prediction[] };
type LayerOption = "bahaya_rob" | "laporan" | "pasang_surut" | "garis_pantai";

const riskDotClass: Record<string, string> = { sangat_tinggi: "critical", tinggi: "high", sedang: "medium", rendah: "low" };

const regencyCoordinates: Record<string, { center: [number, number]; zoom: number }> = {
  "Kota Bandar Lampung": { center: [105.2660, -5.4496], zoom: 12 },
  "Kabupaten Lampung Selatan": { center: [105.5898, -5.7335], zoom: 11 },
  "Kabupaten Pesawaran": { center: [105.1500, -5.5000], zoom: 11 },
  "Kabupaten Tanggamus": { center: [104.7000, -5.4500], zoom: 11 },
  "Kabupaten Pesisir Barat": { center: [103.9500, -5.1800], zoom: 10 },
  "Kabupaten Lampung Timur": { center: [105.6800, -5.0500], zoom: 10 },
  "Kabupaten Tulang Bawang": { center: [105.8000, -4.4000], zoom: 10 },
  "Kabupaten Tulang Bawang Barat": { center: [105.0500, -4.4500], zoom: 10 },
  "Kabupaten Mesuji": { center: [105.4000, -4.0500], zoom: 10 },
  "Kabupaten Lampung Tengah": { center: [105.2500, -4.8500], zoom: 10 },
  "Kabupaten Lampung Utara": { center: [104.8500, -4.8000], zoom: 10 },
  "Kabupaten Way Kanan": { center: [104.5500, -4.5000], zoom: 10 },
  "Kabupaten Lampung Barat": { center: [104.2000, -5.0500], zoom: 10 },
  "Kabupaten Pringsewu": { center: [104.9800, -5.3500], zoom: 11 },
  "Kota Metro": { center: [105.3000, -5.1100], zoom: 12 },
};
const riskLabel: Record<string, string> = { sangat_tinggi: "Sangat Tinggi", tinggi: "Tinggi", sedang: "Sedang", rendah: "Rendah" };
const containerVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1, ease: "easeOut" } } };
const itemVariants: Variants = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };
const numberFormatter = new Intl.NumberFormat("id-ID");

function riskText(value: unknown) {
  return riskLabel[String(value)] ?? String(value ?? "Belum ada data");
}

function daysFromToday(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function horizonLabel(dateStr: string): string {
  const diff = daysFromToday(dateStr);
  if (Number.isNaN(diff)) return dateStr;
  if (diff === 0) return "Hari ini";
  if (diff > 0) return `+${diff} hari`;
  return `${Math.abs(diff)} hari lalu`;
}

// Horizon prediksi sesuai SKPL: hari ini, +1, +2, +3, +7.
const HORIZON_OPTIONS: { label: string; offset: number }[] = [
  { label: "Hari ini", offset: 0 },
  { label: "+1 hari", offset: 1 },
  { label: "+2 hari", offset: 2 },
  { label: "+3 hari", offset: 3 },
  { label: "+7 hari", offset: 7 },
];

function dateFromOffset(offset: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function featureCenter(feature: GeoJsonFeature): [number, number] | null {
  const points: [number, number][] = [];
  const collect = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      points.push([value[0], value[1]]);
      return;
    }
    value.forEach(collect);
  };
  collect(feature.geometry.coordinates);
  if (!points.length) return null;
  const [minLon, maxLon] = [Math.min(...points.map(([lon]) => lon)), Math.max(...points.map(([lon]) => lon))];
  const [minLat, maxLat] = [Math.min(...points.map(([, lat]) => lat)), Math.max(...points.map(([, lat]) => lat))];
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

function zoneRadiusKm(risk: unknown) {
  // Disesuaikan dengan contoh: sangat tinggi 800m, tinggi 600m, sedang 400m
  return ({ sangat_tinggi: 0.8, tinggi: 0.6, sedang: 0.4, rendah: 0.2 } as Record<string, number>)[String(risk)] ?? 0.2;
}

function geographicCircle(center: [number, number], radiusKm: number): { type: "Polygon"; coordinates: number[][][] } {
  const [longitude, latitude] = center;
  const earthRadiusKm = 6371;
  const latitudeRadians = latitude * Math.PI / 180;
  const longitudeRadians = longitude * Math.PI / 180;
  const distance = radiusKm / earthRadiusKm;
  const ring = Array.from({ length: 49 }, (_, index) => {
    const bearing = (index * 7.5) * Math.PI / 180;
    const pointLat = Math.asin(Math.sin(latitudeRadians) * Math.cos(distance) + Math.cos(latitudeRadians) * Math.sin(distance) * Math.cos(bearing));
    const pointLon = longitudeRadians + Math.atan2(Math.sin(bearing) * Math.sin(distance) * Math.cos(latitudeRadians), Math.cos(distance) - Math.sin(latitudeRadians) * Math.sin(pointLat));
    return [pointLon * 180 / Math.PI, pointLat * 180 / Math.PI];
  });
  return { type: "Polygon", coordinates: [ring] };
}

function RiskMap({ regions, reports, layers, showReports, showTidal, showCoastline, selectedRegency, onSelectFeature }: { regions: FeatureCollection; reports: FeatureCollection; layers: MapLayers; showReports: boolean; showTidal: boolean; showCoastline: boolean; selectedRegency: string; onSelectFeature: (feature: GeoJsonFeature) => void }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const reportMarkers = useRef<maplibregl.Marker[]>([]);
  const predictionMarkers = useRef<maplibregl.Marker[]>([]);
  const tidalMarkers = useRef<maplibregl.Marker[]>([]);
  const onSelectFeatureRef = useRef(onSelectFeature);
  onSelectFeatureRef.current = onSelectFeature;

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      center: [105.26, -5.48],
      zoom: 9,
      style: {
        version: 8,
        sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
    });
    map.current.addControl(new maplibregl.NavigationControl(), "top-right");
    map.current.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const update = () => {
      predictionMarkers.current.forEach(m => m.remove());
      predictionMarkers.current = [];
      reportMarkers.current.forEach(m => m.remove());
      reportMarkers.current = [];
      tidalMarkers.current.forEach(m => m.remove());
      tidalMarkers.current = [];

      const circleFeatures: any[] = [];

      // 1. TAMBAH TITIK BANJIR (PREDIKSI)
      regions.features.forEach((feature) => {
        const center = featureCenter(feature);
        if (!center) return;

        const risk = String(feature.properties.risk_class);
        const color = riskColor[risk] ?? riskColor.rendah;
        const radius = zoneRadiusKm(risk);

        // A. Area Lingkaran
        circleFeatures.push({
          type: "Feature",
          geometry: geographicCircle(center, radius),
          properties: { color, risk_class: risk }
        });

        // B. Badge titik, klik untuk memilih wilayah di panel samping
        const el = document.createElement("div");
        el.className = "map-risk-badge";
        el.style.color = color;
        el.textContent = String(Math.round(Number(feature.properties.risk_probability ?? 0)));
        el.setAttribute("role", "button");
        el.setAttribute("tabindex", "0");
        el.setAttribute("aria-label", `${feature.properties.village ?? "Wilayah pesisir"}: risiko ${riskText(risk)}`);
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          onSelectFeatureRef.current(feature);
        });

        predictionMarkers.current.push(
          new maplibregl.Marker({ element: el })
            .setLngLat(center)
            .addTo(instance)
        );
      });

      // 2. TAMBAH TITIK LAPORAN (GROUND TRUTH)
      if (showReports) {
        reports.features.forEach((report) => {
          const coordinates = report.geometry.coordinates;
          if (!Array.isArray(coordinates) || typeof coordinates[0] !== "number") return;
          const severity = String(report.properties.severity);
          const color = severity === "sangat_parah" ? riskColor.sangat_tinggi : severity === "parah" ? riskColor.tinggi : severity === "sedang" ? riskColor.sedang : riskColor.rendah;

          // Radius area untuk laporan sedikit lebih kecil
          const radiusKm = severity === "sangat_parah" ? 0.6 : severity === "parah" ? 0.4 : severity === "sedang" ? 0.2 : 0.1;
          circleFeatures.push({
            type: "Feature",
            geometry: geographicCircle([coordinates[0], coordinates[1]], radiusKm),
            properties: { color, risk_class: severity }
          });

          const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`<strong>Laporan: ${report.properties.report_code ?? "Warga"}</strong><br>${report.properties.location ?? "Wilayah pesisir"}<br>Tingkat Genangan: <span style="color:${color}; font-weight:bold;">${riskText(severity)}</span><br>Radius Area: ${Math.round(radiusKm * 1000)} meter<br>Ketinggian air: ${report.properties.water_height_cm ?? "-"} cm`);

          reportMarkers.current.push(
            new maplibregl.Marker({ color })
              .setLngLat([coordinates[0], coordinates[1]])
              .setPopup(popup)
              .addTo(instance)
          );
        });
      }

      if (showTidal) {
        layers.tidal_stations.features.forEach((station) => {
          const coordinates = station.geometry.coordinates;
          if (!Array.isArray(coordinates) || typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number") return;
          const popup = new maplibregl.Popup({ offset: 20 }).setHTML(`<strong>Stasiun pasang surut</strong><br>${station.properties.name ?? station.properties.code ?? "-"}<br>Sumber: ${station.properties.source ?? "-"}`);
          tidalMarkers.current.push(
            new maplibregl.Marker({ color: "#0284c7" })
              .setLngLat([coordinates[0], coordinates[1]])
              .setPopup(popup)
              .addTo(instance)
          );
        });
      }

      const coastlineSourceId = "coastline-layer";
      const coastlineData = showCoastline ? layers.coastlines : { type: "FeatureCollection", features: [] };
      const coastlineSource = instance.getSource(coastlineSourceId);
      if (coastlineSource) {
        (coastlineSource as maplibregl.GeoJSONSource).setData(coastlineData as any);
      } else {
        instance.addSource(coastlineSourceId, { type: "geojson", data: coastlineData as any });
        instance.addLayer({
          id: "coastline-layer-line",
          type: "line",
          source: coastlineSourceId,
          paint: { "line-color": "#0369a1", "line-width": 2, "line-opacity": 0.75 },
        });
      }

      // Update Sumber GeoJSON untuk Area Lingkaran
      const circleSourceId = "risk-circles";
      const existingSource = instance.getSource(circleSourceId);
      if (existingSource) {
        (existingSource as maplibregl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: circleFeatures,
        });
      } else {
        instance.addSource(circleSourceId, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: circleFeatures,
          },
        });
        instance.addLayer({
          id: "risk-circles-fill",
          type: "fill",
          source: circleSourceId,
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.4,
          },
        });
        instance.addLayer({
          id: "risk-circles-line",
          type: "line",
          source: circleSourceId,
          paint: {
            "line-color": ["get", "color"],
            "line-width": 2,
          },
        });
      }

      // 3. LOGIC FILTER DROPDOWN
      if (selectedRegency && selectedRegency !== "all") {
        const config = regencyCoordinates[selectedRegency] || regencyCoordinates[`Kabupaten ${selectedRegency}`] || regencyCoordinates[`Kota ${selectedRegency}`];
        if (config) {
          instance.flyTo({
            center: config.center,
            zoom: config.zoom,
            duration: 1200,
          });
        }
      } else {
        let bounds: maplibregl.LngLatBounds | null = null;
        let pointsCount = 0;
        regions.features.forEach((f) => {
          const center = featureCenter(f);
          if (center) {
            pointsCount++;
            if (!bounds) bounds = new maplibregl.LngLatBounds(center, center);
            else bounds.extend(center);
          }
        });
        const activeBounds = bounds as maplibregl.LngLatBounds | null;
        if (activeBounds) {
          if (pointsCount === 1) {
            const sw = activeBounds.getSouthWest();
            activeBounds.extend([sw.lng - 0.05, sw.lat - 0.05]);
            activeBounds.extend([sw.lng + 0.05, sw.lat + 0.05]);
          }
          instance.fitBounds(activeBounds, { padding: 50, maxZoom: 12, duration: 1000 });
        } else {
          instance.flyTo({
            center: [105.26, -5.48],
            zoom: 9,
            duration: 1000,
          });
        }
      }
    };
    if (instance.isStyleLoaded()) update(); else instance.once("load", update);
  }, [regions, reports, layers, showReports, showTidal, showCoastline, selectedRegency]);

  return <div ref={mapContainer} style={{ minHeight: 560, width: "100%" }} aria-label="Peta interaktif risiko banjir rob" />;
}

export function PublicMapPage() {
  let userRole = "";
  try {
    const userStr = localStorage.getItem("siperah-user");
    if (userStr) {
      userRole = JSON.parse(userStr).role;
    }
  } catch(e) {}

  const [regions, setRegions] = useState<FeatureCollection>({ type: "FeatureCollection", features: [] });
  const [reports, setReports] = useState<FeatureCollection>({ type: "FeatureCollection", features: [] });
  const [layers, setLayers] = useState<MapLayers>({
    tidal_stations: { type: "FeatureCollection", features: [] },
    coastlines: { type: "FeatureCollection", features: [] },
    critical_infrastructure: { type: "FeatureCollection", features: [] },
    evacuation_routes: { type: "FeatureCollection", features: [] },
  });
  const [activeWarning, setActiveWarning] = useState<ActiveWarning | null>(null);
  const [staleNotice, setStaleNotice] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Prediction[]>([]);
  const [selectedRegency, setSelectedRegency] = useState("all");
  const [selectedDate, setSelectedDate] = useState("all");
  const [layer, setLayer] = useState<LayerOption>("bahaya_rob");
  const [selectedFeature, setSelectedFeature] = useState<GeoJsonFeature | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const showReports = layer === "laporan";
  const showTidal = layer === "pasang_surut";
  const showCoastline = layer === "garis_pantai";

  useEffect(() => { void api<PredictionResponse>("/public/predictions").then((response) => setCatalog(response.data)).catch(() => undefined); }, []);
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams();
    if (selectedRegency !== "all") query.set("regency", selectedRegency);
    if (selectedDate !== "all") query.set("date", selectedDate);
    setLoading(true); setError("");
    void api<MapResponse>(`/public/map${query.size ? `?${query.toString()}` : ""}`).then((response) => {
      if (!active) return;
      setRegions(response.data.regions); setReports(response.data.reports);
      if (response.data.layers) setLayers(response.data.layers);
      setActiveWarning(response.data.active_warning ?? null);
      setStaleNotice(response.data.data_freshness?.notice ?? null);
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Data peta belum bisa dimuat."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedDate, selectedRegency]);

  const regencies = useMemo(() => {
    const fromData = catalog.map((item) => item.region?.regency).filter(Boolean);
    return [...new Set(fromData)].sort((a, b) => String(a).localeCompare(String(b), "id")) as string[];
  }, [catalog]);
  const highestRisk = useMemo(() => regions.features.reduce<GeoJsonFeature | null>((highest, feature) => {
    const rank: Record<string, number> = { rendah: 1, sedang: 2, tinggi: 3, sangat_tinggi: 4 };
    return !highest || (rank[String(feature.properties.risk_class)] ?? 0) > (rank[String(highest.properties.risk_class)] ?? 0) ? feature : highest;
  }, null), [regions]);

  const isStaleData = useMemo(() => {
    if (!regions.features.length) return false;
    const generatedAt = regions.features[0]?.properties?.generated_at;
    if (!generatedAt) return false;
    return daysFromToday(String(generatedAt).substring(0, 10)) < 0;
  }, [regions]);

  useEffect(() => {
    if (!regions.features.length) { setSelectedFeature(null); return; }
    setSelectedFeature((current) => {
      const stillPresent = current && regions.features.find((f) => f.id === current.id);
      return stillPresent ?? highestRisk;
    });
  }, [regions, highestRisk]);

  const handleSelectFeature = useCallback((feature: GeoJsonFeature) => setSelectedFeature(feature), []);

  const selectedRiskClass = String(selectedFeature?.properties.risk_class ?? "");
  const selectedColor = riskColor[selectedRiskClass] ?? "var(--accent)";
  const selectedPopulation = selectedFeature?.properties.population;
  const toolbarHorizon = selectedDate === "all" ? "Prediksi terbaru" : `Prediksi ${horizonLabel(selectedDate)}`;

  return <AppShell active="map" title="Peta Bahaya Rob" subtitle="Pantau prediksi risiko banjir rob per wilayah pesisir Provinsi Lampung.">
    <style>{`
      .public-map-layout {
        display: grid;
        grid-template-columns: 1fr 340px;
        gap: 24px;
        align-items: start;
      }
      .map-filter-bar {
        display: flex;
        gap: 28px;
        row-gap: 16px;
        flex-wrap: wrap;
      }
      .map-filter-bar label {
        display: grid;
        gap: 9px;
        flex: 1;
        min-width: 190px;
        font-size: 11px;
        font-weight: 700;
        color: var(--ink-soft);
        text-transform: uppercase;
        letter-spacing: .5px;
      }
      .map-filter-bar select { min-height: 44px; }
      .map-viewport { position: relative; }
      .map-viewport .map-toolbar {
        right: auto;
        width: auto;
        max-width: calc(100% - 120px);
        gap: 0;
        box-shadow: 0 2px 10px rgba(15, 23, 42, .10);
      }
      .map-viewport .map-toolbar span {
        color: var(--ink-soft);
        font-weight: 600;
        padding-right: 12px;
      }
      .map-viewport .map-toolbar strong {
        color: var(--ink);
        padding-left: 12px;
        border-left: 1px solid var(--line);
      }
      .map-viewport .maplibregl-ctrl-top-right { z-index: 3; }
      .map-risk-badge {
        align-items: center;
        background: #fff;
        border: 2px solid currentColor;
        border-radius: 999px;
        box-shadow: 0 2px 6px rgba(15, 23, 42, .3);
        cursor: pointer;
        display: flex;
        font-size: 0.8rem;
        font-weight: 850;
        height: 30px;
        justify-content: center;
        width: 30px;
        color: inherit;
      }

      @media(max-width: 768px) {
        .public-map-layout {
          grid-template-columns: 1fr;
          gap: 16px;
        }

        .map-filter-bar {
          flex-direction: column;
        }

        .map-filter-bar select {
          width: 100%;
        }

        .map-container {
          min-height: 65vh !important;
        }

        .map-viewport .map-toolbar span { display: none; }
        .map-viewport .map-toolbar strong { border-left: 0; padding-left: 0; }
      }
    `}</style>
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="stack" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
      <motion.p variants={itemVariants} style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14 }}>Pantau prediksi risiko banjir rob per wilayah pesisir Provinsi Lampung.</motion.p>
      {isStaleData && (
        <motion.div variants={itemVariants} className="alert" style={{ borderLeftColor: "var(--warning)", backgroundColor: "#fef3c7" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Icon name="history" style={{ fontSize: 24, color: "var(--warning)" }} />
            <div>
              <strong style={{ display: "block", marginBottom: 3, color: "var(--ink)" }}>Menampilkan Prediksi Historis</strong>
              <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>Data peringatan cuaca hari ini gagal dimuat atau tertunda. Anda sedang melihat prediksi historis dari {regions.features[0]?.properties?.generated_at ? String(regions.features[0].properties.generated_at).substring(0, 10) : "sebelumnya"}.</span>
            </div>
          </div>
        </motion.div>
      )}
      <motion.div variants={itemVariants} className="alert" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, borderLeftColor: riskColor[String(highestRisk?.properties.risk_class)] ?? "var(--accent)" }}><div style={{ display: "flex", alignItems: "center", gap: 14 }}><Icon name="warning" style={{ fontSize: 24, color: riskColor[String(highestRisk?.properties.risk_class)] ?? "var(--accent)" }} /><div><strong style={{ display: "block", marginBottom: 3, color: "var(--ink)" }}>{highestRisk ? `Risiko ${riskText(highestRisk.properties.risk_class)} terdeteksi` : "Memuat peringatan risiko"}</strong><span style={{ color: "var(--ink-soft)", fontSize: 13 }}>{highestRisk ? `${highestRisk.properties.village ?? "Wilayah pesisir"}, ${highestRisk.properties.regency ?? "Lampung"} · peluang rob ${Math.round(Number(highestRisk.properties.risk_probability ?? 0))}%` : "Mengambil data peta dari server."}</span></div></div>{(!userRole || userRole === "warga") && <a className="btn secondary" href="#/awam">Lihat mode awam</a>}</motion.div>
      {error && <div className="alert" style={{ borderLeftColor: "var(--critical)" }}>{error}</div>}
      <motion.div variants={itemVariants} className="public-map-layout">
        <div className="panel flush" style={{ overflow: "hidden" }}>
          <div className="map-filter-bar" style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", background: "var(--surface-soft)" }}>
            <label>Horizon prediksi
              <select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}>
                <option value="all">Prediksi terbaru</option>
                {HORIZON_OPTIONS.map((horizon) => <option key={horizon.offset} value={dateFromOffset(horizon.offset)}>{horizon.label}</option>)}
              </select>
            </label>
            <label>Kabupaten/Kota
              <select value={selectedRegency} onChange={(event) => setSelectedRegency(event.target.value)}>
                <option value="all">Semua wilayah</option>
                {regencies.map((regency) => <option key={regency} value={regency}>{regency}</option>)}
              </select>
            </label>
            <label>Layer
              <select value={layer} onChange={(event) => setLayer(event.target.value as LayerOption)}>
                <option value="bahaya_rob">Bahaya rob</option>
                <option value="laporan">Laporan warga</option>
                <option value="pasang_surut">Pasang surut</option>
                <option value="garis_pantai">Garis pantai</option>
              </select>
            </label>
          </div>
          <div className="map-viewport">
            <div className="map-toolbar">
              <span>Pesisir Lampung</span>
              <strong>{toolbarHorizon}</strong>
            </div>
            <div className="map-container" style={{ minHeight: 560 }}>
              <RiskMap regions={regions} reports={reports} layers={layers} showReports={showReports} showTidal={showTidal} showCoastline={showCoastline} selectedRegency={selectedRegency} onSelectFeature={handleSelectFeature} />
            </div>
            <div className="legend">
              <strong>Legenda risiko</strong>
              {Object.entries(riskLabel).map(([risk, label]) => <span key={risk}><i className={`dot ${riskDotClass[risk]}`} />{label}</span>)}
            </div>
            {loading && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(255,255,255,.6)", fontWeight: 700 }}>Memuat peta.</div>}
          </div>
        </div>
        <aside className="stack" style={{ gap: 24 }}>
          <motion.div variants={itemVariants} className="panel flush">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
              <strong style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: .5, color: "var(--ink-soft)" }}>Wilayah terpilih</strong>
              {selectedFeature ? <>
                <div style={{ marginTop: 10, fontWeight: 700, color: "var(--ink)" }}>{String(selectedFeature.properties.village ?? "Wilayah pesisir")}</div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 2 }}>{[selectedFeature.properties.district, selectedFeature.properties.regency].filter(Boolean).join(", ")}</div>
                <span className="badge" style={{ marginTop: 10, background: `${selectedColor}1a`, color: selectedColor, borderColor: `${selectedColor}33` }}>{riskText(selectedRiskClass)}</span>
              </> : <p style={{ margin: "10px 0 0", fontSize: 13 }}>Klik salah satu titik di peta untuk melihat detail wilayah.</p>}
            </div>
            {selectedFeature && <div style={{ padding: "16px 20px", display: "grid", gap: 12 }}>
              <div className="info-item"><Icon name="insights" /><div><strong>Probabilitas</strong><p>{Math.round(Number(selectedFeature.properties.risk_probability ?? 0))}%</p></div></div>
              <div className="info-item"><Icon name="groups" /><div><strong>Populasi risiko</strong><p>{typeof selectedPopulation === "number" && selectedPopulation > 0 ? `${numberFormatter.format(selectedPopulation)} jiwa` : "Data belum tersedia"}</p></div></div>
              <a className="btn primary" href="#/reports" style={{ justifyContent: "center" }}><Icon name="add_location_alt" /> Lapor Kejadian di Sini</a>
            </div>}
          </motion.div>
          {staleNotice && <motion.div variants={itemVariants} className="panel" style={{ padding: 16, borderLeft: "3px solid var(--medium)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <Icon name="update" style={{ color: "var(--medium)", fontSize: 18 }} />
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{staleNotice}</p>
            </div>
          </motion.div>}
          {activeWarning && <motion.div variants={itemVariants} className="panel" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Icon name="campaign" style={{ color: "var(--critical)" }} />
              <strong style={{ fontSize: 13 }}>Peringatan Risiko</strong>
            </div>
            <p style={{ margin: 0, fontSize: 13 }}>{activeWarning.message}</p>
          </motion.div>}
          <motion.div variants={itemVariants} className="panel flush">
            <div className="map-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", background: "var(--surface-soft)" }}>{[[regions.features.length, "Zona dipantau", "var(--ink)"], [reports.features.length, "Laporan valid", "var(--low)"], [regions.features.filter((item) => ["tinggi", "sangat_tinggi"].includes(String(item.properties.risk_class))).length, "Risiko tinggi+", "var(--critical)"]].map(([value, label, color]) => <div key={String(label)} style={{ padding: "16px 8px", textAlign: "center" }}><strong style={{ display: "block", fontSize: 21, color: String(color) }}>{value}</strong><span style={{ fontSize: 11, color: "var(--ink-soft)" }}>{label}</span></div>)}</div>
          </motion.div>
        </aside>
      </motion.div>
    </motion.div>
  </AppShell>;
}
