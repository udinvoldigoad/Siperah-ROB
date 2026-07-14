import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { motion, type Variants } from "framer-motion";
import { api } from "../../shared/api/client";
import { AppShell } from "../../shared/components/AppShell";
import { Icon } from "../../shared/components/Icon";

type GeoJsonFeature = { type: "Feature"; id: string; geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> };
type FeatureCollection = { type: "FeatureCollection"; features: GeoJsonFeature[] };
type Prediction = { prediction_date: string; region?: { regency?: string | null } | null };
type MapLayers = {
  tidal_stations: FeatureCollection;
  coastlines: FeatureCollection;
  critical_infrastructure: FeatureCollection;
  evacuation_routes: FeatureCollection;
};
type MapResponse = { data: { regions: FeatureCollection; reports: FeatureCollection; layers?: MapLayers; active_warning?: { title: string; message: string } | null } };
type PredictionResponse = { data: Prediction[] };

const riskColor: Record<string, string> = { sangat_tinggi: "#e52421", tinggi: "#f4510b", sedang: "#d97706", rendah: "#16a34a" };

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

function riskText(value: unknown) {
  return riskLabel[String(value)] ?? String(value ?? "Belum ada data");
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

function RiskMap({ regions, reports, layers, showReports, showTidal, showCoastline, selectedRegency }: { regions: FeatureCollection; reports: FeatureCollection; layers: MapLayers; showReports: boolean; showTidal: boolean; showCoastline: boolean; selectedRegency: string }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const reportMarkers = useRef<maplibregl.Marker[]>([]);
  const predictionMarkers = useRef<maplibregl.Marker[]>([]);
  const tidalMarkers = useRef<maplibregl.Marker[]>([]);

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
        
        const regency = String(feature.properties.regency ?? "");
        const risk = String(feature.properties.risk_class);
        const color = riskColor[risk] ?? riskColor.rendah;
        const radius = zoneRadiusKm(risk);

        // A. Area Lingkaran
        circleFeatures.push({
          type: "Feature",
          geometry: geographicCircle(center, radius),
          properties: { color, risk_class: risk }
        });
        
        // B. Marker & Popup
        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`<strong>${feature.properties.village ?? "Wilayah pesisir"}</strong><br>${feature.properties.district ?? ""}, ${regency}<br>Status: <span style="color:${color}; font-weight:bold;">${riskText(feature.properties.risk_class)}</span><br>Radius Terdampak: ${Math.round(radius * 1000)} meter<br>Peluang rob: ${Math.round(Number(feature.properties.risk_probability ?? 0))}%`);
        
        predictionMarkers.current.push(
          new maplibregl.Marker({ color })
            .setLngLat(center)
            .setPopup(popup)
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
  const [catalog, setCatalog] = useState<Prediction[]>([]);
  const [selectedRegency, setSelectedRegency] = useState("all");
  const [selectedDate, setSelectedDate] = useState("all");
  const [showReports, setShowReports] = useState(true);
  const [showTidal, setShowTidal] = useState(false);
  const [showCoastline, setShowCoastline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Data peta belum bisa dimuat."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedDate, selectedRegency]);

  const regencies = useMemo(() => {
    const fromData = catalog.map((item) => item.region?.regency).filter(Boolean);
    return [...new Set(fromData)].sort((a, b) => String(a).localeCompare(String(b), "id")) as string[];
  }, [catalog]);
  const dates = useMemo(() => [...new Set(catalog.map((item) => item.prediction_date))], [catalog]);
  const highestRisk = useMemo(() => regions.features.reduce<GeoJsonFeature | null>((highest, feature) => {
    const rank: Record<string, number> = { rendah: 1, sedang: 2, tinggi: 3, sangat_tinggi: 4 };
    return !highest || (rank[String(feature.properties.risk_class)] ?? 0) > (rank[String(highest.properties.risk_class)] ?? 0) ? feature : highest;
  }, null), [regions]);

  return <AppShell active="map" title="Peta Bahaya Rob" subtitle="Peta interaktif risiko dan laporan tervalidasi wilayah pesisir Lampung.">
    <style>{`
      .public-map-layout {
        display: grid;
        grid-template-columns: 1fr 340px;
        gap: 24px;
        align-items: start;
      }
      
      @media(max-width: 768px) {
        .public-map-layout {
          grid-template-columns: 1fr;
          gap: 16px;
        }
        
        .map-header-controls {
          flex-direction: column;
          align-items: stretch !important;
        }
        
        .map-header-controls select {
          width: 100%;
          margin-bottom: 8px;
        }
        
        .map-stats-grid {
          grid-template-columns: 1fr 1fr 1fr !important;
          gap: 8px;
        }
        
        .map-container {
          min-height: 65vh !important;
        }
      }
    `}</style>
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="stack" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
      <motion.div variants={itemVariants} className="alert" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, borderLeftColor: riskColor[String(highestRisk?.properties.risk_class)] ?? "var(--accent)" }}><div style={{ display: "flex", alignItems: "center", gap: 14 }}><Icon name="warning" style={{ fontSize: 24, color: riskColor[String(highestRisk?.properties.risk_class)] ?? "var(--accent)" }} /><div><strong style={{ display: "block", marginBottom: 3, color: "var(--ink)" }}>{highestRisk ? `Risiko ${riskText(highestRisk.properties.risk_class)} terdeteksi` : "Memuat peringatan risiko"}</strong><span style={{ color: "var(--ink-soft)", fontSize: 13 }}>{highestRisk ? `${highestRisk.properties.village ?? "Wilayah pesisir"}, ${highestRisk.properties.regency ?? "Lampung"} · peluang rob ${Math.round(Number(highestRisk.properties.risk_probability ?? 0))}%` : "Mengambil data peta dari server."}</span></div></div>{(!userRole || userRole === "warga") && <a className="btn secondary" href="#/awam">Lihat mode awam</a>}</motion.div>
      {error && <div className="alert" style={{ borderLeftColor: "var(--critical)" }}>{error}</div>}      <motion.div variants={itemVariants} className="public-map-layout">
        <div className="panel flush" style={{ overflow: "hidden", position: "relative" }}><div className="map-header-controls" style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", background: "var(--surface-soft)" }}><div style={{ display: "flex", gap: 10, flexWrap: "wrap", width: "100%" }}><select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} style={{ flex: 1 }}><option value="all">Prediksi terbaru</option>{dates.map((date) => <option key={date} value={date}>{date}</option>)}</select><select value={selectedRegency} onChange={(event) => setSelectedRegency(event.target.value)} style={{ flex: 1 }}><option value="all">Semua kabupaten</option>{regencies.map((regency) => <option key={regency} value={regency}>{regency}</option>)}</select></div><div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-soft)" }}><input type="checkbox" checked={showReports} onChange={(event) => setShowReports(event.target.checked)} /> Laporan</label><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-soft)" }}><input type="checkbox" checked={showTidal} onChange={(event) => setShowTidal(event.target.checked)} /> Pasang surut</label><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-soft)" }}><input type="checkbox" checked={showCoastline} onChange={(event) => setShowCoastline(event.target.checked)} /> Garis pantai</label></div></div><div className="map-container" style={{ minHeight: 560 }}><RiskMap regions={regions} reports={reports} layers={layers} showReports={showReports} showTidal={showTidal} showCoastline={showCoastline} selectedRegency={selectedRegency} /></div>{loading && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(255,255,255,.6)", fontWeight: 700 }}>Memuat peta.</div>}</div>
        <aside className="stack" style={{ gap: 24 }}><motion.div variants={itemVariants} className="panel flush"><div className="map-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid var(--line)", background: "var(--surface-soft)" }}>{[[regions.features.length, "Zona dipantau", "var(--ink)"], [reports.features.length, "Laporan valid", "var(--low)"], [regions.features.filter((item) => ["tinggi", "sangat_tinggi"].includes(String(item.properties.risk_class))).length, "Risiko tinggi+", "var(--critical)"]].map(([value, label, color]) => <div key={String(label)} style={{ padding: "16px 8px", textAlign: "center" }}><strong style={{ display: "block", fontSize: 21, color: String(color) }}>{value}</strong><span style={{ fontSize: 11, color: "var(--ink-soft)" }}>{label}</span></div>)}</div><div style={{ padding: "16px 20px" }}><strong style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: .5 }}>Legenda Risiko</strong><div style={{ display: "grid", gap: 10, marginTop: 14 }}>{Object.entries(riskLabel).map(([risk, label]) => <div key={risk} style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 13 }}><span style={{ width: 14, height: 14, borderRadius: 3, background: riskColor[risk] }} />{label}</div>)}</div></div></motion.div>{userRole === "warga" && <a className="btn primary" href="#/reports" style={{ justifyContent: "center" }}><Icon name="add" /> Tambah Laporan Baru</a>}</aside>
      </motion.div>
    </motion.div>
  </AppShell>;
}
