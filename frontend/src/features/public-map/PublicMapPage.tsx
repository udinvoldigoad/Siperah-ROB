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
type MapResponse = { data: { regions: FeatureCollection; reports: FeatureCollection } };
type PredictionResponse = { data: Prediction[] };

const riskColor: Record<string, string> = { sangat_tinggi: "#e52421", tinggi: "#f4510b", sedang: "#d97706", rendah: "#16a34a" };
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
  return ({ sangat_tinggi: 3.5, tinggi: 3, sedang: 2.5, rendah: 2 } as Record<string, number>)[String(risk)] ?? 2;
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

function RiskMap({ regions, reports, showReports }: { regions: FeatureCollection; reports: FeatureCollection; showReports: boolean }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const reportMarkers = useRef<maplibregl.Marker[]>([]);
  const predictionMarkers = useRef<maplibregl.Marker[]>([]);

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

      regions.features.forEach((feature) => {
        const center = featureCenter(feature);
        if (!center) return;
        
        const regency = String(feature.properties.regency ?? "");
        const risk = String(feature.properties.risk_class);
        const color = riskColor[risk] ?? riskColor.rendah;
        const pinColor = risk === "sangat_tinggi" || risk === "tinggi" ? "#e52421" : "#1E88E5";

        const el = document.createElement("div");
        el.style.cssText = "width: 0px; height: 0px; cursor: pointer;";
        
        const pulse = document.createElement("div");
        pulse.style.cssText = `position: absolute; top: 0; left: 0; transform: translate(-50%, -50%); width: 60px; height: 60px; border-radius: 50%; background: ${color};`;
        pulse.animate([
          { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0.6 },
          { transform: 'translate(-50%, -50%) scale(2.2)', opacity: 0 }
        ], { duration: 2000, iterations: Infinity, easing: 'ease-out' });
        
        const ring = document.createElement("div");
        ring.style.cssText = `position: absolute; top: 0; left: 0; transform: translate(-50%, -50%); width: 50px; height: 50px; border-radius: 50%; border: 1.5px solid ${color};`;
        
        const dot = document.createElement("div");
        dot.style.cssText = `position: absolute; top: 0; left: 0; transform: translate(-50%, -50%); width: 14px; height: 14px; background: ${color}; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3); z-index: 1;`;
        
        const pin = document.createElement("div");
        pin.style.cssText = `position: absolute; bottom: 0; right: 0; width: 32px; height: 32px; background-color: ${pinColor}; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); transform-origin: bottom right; border: 2px solid white; box-shadow: 2px 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 2; margin-bottom: 2px; margin-right: 2px;`;
        const pinDot = document.createElement("div");
        pinDot.style.cssText = "width: 12px; height: 12px; background-color: white; border-radius: 50%;";
        pin.appendChild(pinDot);
        
        el.appendChild(pulse);
        el.appendChild(ring);
        el.appendChild(dot);
        el.appendChild(pin);
        
        const popup = new maplibregl.Popup({ offset: [0, -32] }).setHTML(`<strong>${feature.properties.village ?? "Wilayah pesisir"}</strong><br>${feature.properties.district ?? ""}, ${regency}<br>Risiko: <strong>${riskText(feature.properties.risk_class)}</strong><br>Peluang rob: ${Math.round(Number(feature.properties.risk_probability ?? 0))}%`);
        
        predictionMarkers.current.push(new maplibregl.Marker({ element: el }).setLngLat(center).setPopup(popup).addTo(instance));
      });

      reportMarkers.current.forEach((marker) => marker.remove());
      reportMarkers.current = [];
      if (showReports) {
        reports.features.forEach((report) => {
          const coordinates = report.geometry.coordinates;
          if (!Array.isArray(coordinates) || typeof coordinates[0] !== "number") return;
          const severity = String(report.properties.severity);
          const color = severity === "sangat_parah" ? riskColor.sangat_tinggi : severity === "parah" ? riskColor.tinggi : severity === "sedang" ? riskColor.sedang : riskColor.rendah;
          const popup = new maplibregl.Popup({ offset: [0, -28] }).setHTML(`<strong>${report.properties.report_code ?? "Laporan warga"}</strong><br>${report.properties.location ?? "Wilayah pesisir"}<br>Ketinggian air: ${report.properties.water_height_cm ?? "-"} cm`);
          
          const el = document.createElement("div");
          el.style.cssText = "width: 0px; height: 0px; cursor: pointer;";
          
          const pin = document.createElement("div");
          pin.style.cssText = `position: absolute; bottom: 0; right: 0; width: 28px; height: 28px; background-color: ${color}; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); transform-origin: bottom right; border: 2px solid white; box-shadow: 2px 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 2;`;
          
          const dot = document.createElement("div");
          dot.style.cssText = "width: 10px; height: 10px; background-color: white; border-radius: 50%;";
          pin.appendChild(dot);
          el.appendChild(pin);
          
          reportMarkers.current.push(new maplibregl.Marker({ element: el }).setLngLat([coordinates[0], coordinates[1]]).setPopup(popup).addTo(instance));
        });
      }
      
      let bounds: maplibregl.LngLatBounds | null = null;
      let pointsCount = 0;
      regions.features.forEach(f => {
        const center = featureCenter(f);
        if (center) {
          pointsCount++;
          if (!bounds) bounds = new maplibregl.LngLatBounds(center, center);
          else bounds.extend(center);
        }
      });
      if (bounds) {
        if (pointsCount === 1) {
          // If only 1 point, MapLibre's fitBounds can be quirky, so expand the box slightly
          const sw = bounds.getSouthWest();
          bounds.extend([sw.lng - 0.05, sw.lat - 0.05]);
          bounds.extend([sw.lng + 0.05, sw.lat + 0.05]);
        }
        instance.fitBounds(bounds, { padding: 50, maxZoom: 12, duration: 1000 });
      }
    };
    if (instance.isStyleLoaded()) update(); else instance.once("load", update);
  }, [regions, reports, showReports]);

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
  const [catalog, setCatalog] = useState<Prediction[]>([]);
  const [selectedRegency, setSelectedRegency] = useState("all");
  const [selectedDate, setSelectedDate] = useState("all");
  const [showReports, setShowReports] = useState(true);
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
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Data peta belum bisa dimuat."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedDate, selectedRegency]);

  const regencies = useMemo(() => [...new Set(catalog.map((item) => item.region?.regency).filter(Boolean))] as string[], [catalog]);
  const dates = useMemo(() => [...new Set(catalog.map((item) => item.prediction_date))], [catalog]);
  const highestRisk = useMemo(() => regions.features.reduce<GeoJsonFeature | null>((highest, feature) => {
    const rank: Record<string, number> = { rendah: 1, sedang: 2, tinggi: 3, sangat_tinggi: 4 };
    return !highest || (rank[String(feature.properties.risk_class)] ?? 0) > (rank[String(highest.properties.risk_class)] ?? 0) ? feature : highest;
  }, null), [regions]);

  return <AppShell active="map" title="Peta Bahaya Rob" subtitle="Peta interaktif risiko dan laporan tervalidasi wilayah pesisir Lampung.">
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="stack" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
      <motion.div variants={itemVariants} className="alert" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, borderLeftColor: riskColor[String(highestRisk?.properties.risk_class)] ?? "var(--accent)" }}><div style={{ display: "flex", alignItems: "center", gap: 14 }}><Icon name="warning" style={{ fontSize: 24, color: riskColor[String(highestRisk?.properties.risk_class)] ?? "var(--accent)" }} /><div><strong style={{ display: "block", marginBottom: 3, color: "var(--ink)" }}>{highestRisk ? `Risiko ${riskText(highestRisk.properties.risk_class)} terdeteksi` : "Memuat peringatan risiko"}</strong><span style={{ color: "var(--ink-soft)", fontSize: 13 }}>{highestRisk ? `${highestRisk.properties.village ?? "Wilayah pesisir"}, ${highestRisk.properties.regency ?? "Lampung"} · peluang rob ${Math.round(Number(highestRisk.properties.risk_probability ?? 0))}%` : "Mengambil data peta dari server."}</span></div></div><a className="btn secondary" href="#/awam">Lihat mode awam</a></motion.div>
      {error && <div className="alert" style={{ borderLeftColor: "var(--critical)" }}>{error}</div>}
      <motion.div variants={itemVariants} style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
        <div className="panel flush" style={{ overflow: "hidden", position: "relative" }}><div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", background: "var(--surface-soft)" }}><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}><option value="all">Prediksi terbaru</option>{dates.map((date) => <option key={date} value={date}>{date}</option>)}</select><select value={selectedRegency} onChange={(event) => setSelectedRegency(event.target.value)}><option value="all">Semua kabupaten</option>{regencies.map((regency) => <option key={regency} value={regency}>{regency}</option>)}</select></div><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-soft)" }}><input type="checkbox" checked={showReports} onChange={(event) => setShowReports(event.target.checked)} /> Tampilkan laporan</label></div><RiskMap regions={regions} reports={reports} showReports={showReports} />{loading && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(255,255,255,.6)", fontWeight: 700 }}>Memuat peta…</div>}</div>
        <aside className="stack" style={{ gap: 24 }}><motion.div variants={itemVariants} className="panel flush"><div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid var(--line)", background: "var(--surface-soft)" }}>{[[regions.features.length, "Zona dipantau", "var(--ink)"], [reports.features.length, "Laporan valid", "var(--low)"], [regions.features.filter((item) => ["tinggi", "sangat_tinggi"].includes(String(item.properties.risk_class))).length, "Risiko tinggi+", "var(--critical)"]].map(([value, label, color]) => <div key={String(label)} style={{ padding: "16px 8px", textAlign: "center" }}><strong style={{ display: "block", fontSize: 21, color: String(color) }}>{value}</strong><span style={{ fontSize: 11, color: "var(--ink-soft)" }}>{label}</span></div>)}</div><div style={{ padding: "16px 20px" }}><strong style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: .5 }}>Legenda Risiko</strong><div style={{ display: "grid", gap: 10, marginTop: 14 }}>{Object.entries(riskLabel).map(([risk, label]) => <div key={risk} style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 13 }}><span style={{ width: 14, height: 14, borderRadius: 3, background: riskColor[risk] }} />{label}</div>)}</div></div></motion.div>{userRole === "warga" && <a className="btn primary" href="#/reports" style={{ justifyContent: "center" }}><Icon name="add" /> Tambah Laporan Baru</a>}</aside>
      </motion.div>
    </motion.div>
  </AppShell>;
}
