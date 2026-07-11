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

const riskColor: Record<string, string> = { sangat_tinggi: "#dc2626", tinggi: "#ea580c", sedang: "#d97706", rendah: "#16a34a" };
const riskLabel: Record<string, string> = { sangat_tinggi: "Sangat Tinggi", tinggi: "Tinggi", sedang: "Sedang", rendah: "Rendah" };
const containerVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1, ease: "easeOut" } } };
const itemVariants: Variants = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

function riskText(value: unknown) {
  return riskLabel[String(value)] ?? String(value ?? "Belum ada data");
}

function RiskMap({ regions, reports, showReports }: { regions: FeatureCollection; reports: FeatureCollection; showReports: boolean }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);

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
      const regionSource = instance.getSource("risk-regions") as maplibregl.GeoJSONSource | undefined;
      const reportSource = instance.getSource("validated-reports") as maplibregl.GeoJSONSource | undefined;
      if (regionSource && reportSource) {
        regionSource.setData(regions as GeoJSON.FeatureCollection);
        reportSource.setData(showReports ? reports as GeoJSON.FeatureCollection : { type: "FeatureCollection", features: [] });
        return;
      }
      instance.addSource("risk-regions", { type: "geojson", data: regions as GeoJSON.FeatureCollection });
      instance.addLayer({ id: "risk-fill", type: "fill", source: "risk-regions", paint: { "fill-color": ["match", ["get", "risk_class"], "sangat_tinggi", riskColor.sangat_tinggi, "tinggi", riskColor.tinggi, "sedang", riskColor.sedang, "rendah", riskColor.rendah, "#64748b"], "fill-opacity": 0.58 } });
      instance.addLayer({ id: "risk-outline", type: "line", source: "risk-regions", paint: { "line-color": "#ffffff", "line-width": 1.5 } });
      instance.addSource("validated-reports", { type: "geojson", data: showReports ? reports as GeoJSON.FeatureCollection : { type: "FeatureCollection", features: [] } });
      instance.addLayer({ id: "report-points", type: "circle", source: "validated-reports", paint: { "circle-radius": 7, "circle-color": ["match", ["get", "severity"], "sangat_parah", riskColor.sangat_tinggi, "parah", riskColor.tinggi, "sedang", riskColor.sedang, riskColor.rendah], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
      instance.on("click", "risk-fill", (event) => {
        const properties = event.features?.[0]?.properties ?? {};
        new maplibregl.Popup().setLngLat(event.lngLat).setHTML(`<strong>${properties.village ?? "Wilayah pesisir"}</strong><br>${properties.district ?? ""}, ${properties.regency ?? ""}<br>Risiko: <strong>${riskText(properties.risk_class)}</strong><br>Peluang rob: ${Math.round(Number(properties.risk_probability ?? 0) * 100)}%<br>Pasang maks: ${properties.max_tidal_height ?? "-"} m`).addTo(instance);
      });
      instance.on("click", "report-points", (event) => {
        const properties = event.features?.[0]?.properties ?? {};
        new maplibregl.Popup().setLngLat(event.lngLat).setHTML(`<strong>${properties.report_code ?? "Laporan warga"}</strong><br>${properties.location ?? "Wilayah pesisir"}<br>Ketinggian air: ${properties.water_height_cm ?? "-"} cm`).addTo(instance);
      });
      instance.on("mouseenter", "risk-fill", () => { instance.getCanvas().style.cursor = "pointer"; });
      instance.on("mouseleave", "risk-fill", () => { instance.getCanvas().style.cursor = ""; });
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
      <motion.div variants={itemVariants} className="alert" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, borderLeftColor: riskColor[String(highestRisk?.properties.risk_class)] ?? "var(--accent)" }}><div style={{ display: "flex", alignItems: "center", gap: 14 }}><Icon name="warning" style={{ fontSize: 24, color: riskColor[String(highestRisk?.properties.risk_class)] ?? "var(--accent)" }} /><div><strong style={{ display: "block", marginBottom: 3, color: "var(--ink)" }}>{highestRisk ? `Risiko ${riskText(highestRisk.properties.risk_class)} terdeteksi` : "Memuat peringatan risiko"}</strong><span style={{ color: "var(--ink-soft)", fontSize: 13 }}>{highestRisk ? `${highestRisk.properties.village ?? "Wilayah pesisir"}, ${highestRisk.properties.regency ?? "Lampung"} · peluang rob ${Math.round(Number(highestRisk.properties.risk_probability ?? 0) * 100)}%` : "Mengambil data peta dari server."}</span></div></div><a className="btn secondary" href="#/awam">Lihat mode awam</a></motion.div>
      {error && <div className="alert" style={{ borderLeftColor: "var(--critical)" }}>{error}</div>}
      <motion.div variants={itemVariants} style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
        <div className="panel flush" style={{ overflow: "hidden", position: "relative" }}><div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", background: "var(--surface-soft)" }}><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}><option value="all">Prediksi terbaru</option>{dates.map((date) => <option key={date} value={date}>{date}</option>)}</select><select value={selectedRegency} onChange={(event) => setSelectedRegency(event.target.value)}><option value="all">Semua kabupaten</option>{regencies.map((regency) => <option key={regency} value={regency}>{regency}</option>)}</select></div><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-soft)" }}><input type="checkbox" checked={showReports} onChange={(event) => setShowReports(event.target.checked)} /> Tampilkan laporan</label></div><RiskMap regions={regions} reports={reports} showReports={showReports} />{loading && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(255,255,255,.6)", fontWeight: 700 }}>Memuat peta…</div>}</div>
        <aside className="stack" style={{ gap: 24 }}><motion.div variants={itemVariants} className="panel flush"><div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid var(--line)", background: "var(--surface-soft)" }}>{[[regions.features.length, "Zona dipantau", "var(--ink)"], [reports.features.length, "Laporan valid", "var(--low)"], [regions.features.filter((item) => ["tinggi", "sangat_tinggi"].includes(String(item.properties.risk_class))).length, "Risiko tinggi+", "var(--critical)"]].map(([value, label, color]) => <div key={String(label)} style={{ padding: "16px 8px", textAlign: "center" }}><strong style={{ display: "block", fontSize: 21, color: String(color) }}>{value}</strong><span style={{ fontSize: 11, color: "var(--ink-soft)" }}>{label}</span></div>)}</div><div style={{ padding: "16px 20px" }}><strong style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: .5 }}>Legenda Risiko</strong><div style={{ display: "grid", gap: 10, marginTop: 14 }}>{Object.entries(riskLabel).map(([risk, label]) => <div key={risk} style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 13 }}><span style={{ width: 14, height: 14, borderRadius: 3, background: riskColor[risk] }} />{label}</div>)}</div></div></motion.div>{userRole === "warga" && <a className="btn primary" href="#/reports" style={{ justifyContent: "center" }}><Icon name="add" /> Tambah Laporan Baru</a>}</aside>
      </motion.div>
    </motion.div>
  </AppShell>;
}
