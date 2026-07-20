import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { motion, type Variants } from "framer-motion";
import { api } from "../../shared/api/client";
import { AppShell } from "../../shared/components/AppShell";
import { Icon } from "../../shared/components/Icon";
import { riskColors, riskLabels } from "../../shared/constants/risk";

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
export type LayerKey = "bahaya_rob" | "laporan" | "pasang_surut" | "garis_pantai" | "infrastruktur_kritis" | "evakuasi";

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
const containerVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1, ease: "easeOut" } } };
const itemVariants: Variants = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };
const numberFormatter = new Intl.NumberFormat("id-ID");

function riskText(value: unknown) {
  return riskLabels[String(value)] ?? String(value ?? "Belum ada data");
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

function RiskMap({ regions, reports, layers, activeLayers, selectedRegency, onSelectFeature }: { regions: FeatureCollection; reports: FeatureCollection; layers: MapLayers; activeLayers: Record<LayerKey, boolean>; selectedRegency: string; onSelectFeature: (feature: GeoJsonFeature) => void }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const reportMarkers = useRef<maplibregl.Marker[]>([]);
  const predictionMarkers = useRef<maplibregl.Marker[]>([]);
  const tidalMarkers = useRef<maplibregl.Marker[]>([]);
  const infraMarkers = useRef<maplibregl.Marker[]>([]);
  const evacMarkers = useRef<maplibregl.Marker[]>([]);
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
      infraMarkers.current.forEach(m => m.remove());
      infraMarkers.current = [];
      evacMarkers.current.forEach(m => m.remove());
      evacMarkers.current = [];

      const circleFeatures: any[] = [];

      // 1. TAMBAH TITIK BANJIR (PREDIKSI)
      if (activeLayers.bahaya_rob) {
        regions.features.forEach((feature) => {
        const center = featureCenter(feature);
        if (!center) return;

        const risk = String(feature.properties.risk_class);
        const color = riskColors[risk] ?? riskColors.rendah;
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
      }

      // 2. TAMBAH TITIK LAPORAN (GROUND TRUTH)
      if (activeLayers.laporan) {
        reports.features.forEach((report) => {
          const coordinates = report.geometry.coordinates;
          if (!Array.isArray(coordinates) || typeof coordinates[0] !== "number") return;
          const severity = String(report.properties.severity);
          const color = severity === "sangat_parah" ? riskColors.sangat_tinggi : severity === "parah" ? riskColors.tinggi : severity === "sedang" ? riskColors.sedang : riskColors.rendah;

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

      if (activeLayers.pasang_surut) {
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

      if (activeLayers.infrastruktur_kritis) {
        layers.critical_infrastructure.features.forEach((infra) => {
          const coordinates = infra.geometry.coordinates;
          if (!Array.isArray(coordinates) || typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number") return;
          const popup = new maplibregl.Popup({ offset: 20 }).setHTML(`<strong>Infrastruktur Kritis</strong><br>${infra.properties.name ?? "-"}<br>Tipe: ${infra.properties.type ?? "-"}`);
          infraMarkers.current.push(
            new maplibregl.Marker({ color: "#9333ea" })
              .setLngLat([coordinates[0], coordinates[1]])
              .setPopup(popup)
              .addTo(instance)
          );
        });
      }

      if (activeLayers.evakuasi) {
        layers.evacuation_routes.features.forEach((route) => {
          const coordinates = route.geometry.coordinates;
          if (!Array.isArray(coordinates) || typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number") return;
          const popup = new maplibregl.Popup({ offset: 20 }).setHTML(`<strong>Rute Evakuasi</strong><br>${route.properties.name ?? "-"}`);
          evacMarkers.current.push(
            new maplibregl.Marker({ color: "#16a34a" })
              .setLngLat([coordinates[0], coordinates[1]])
              .setPopup(popup)
              .addTo(instance)
          );
        });
      }

      const coastlineSourceId = "coastline-layer";
      const coastlineData = activeLayers.garis_pantai ? layers.coastlines : { type: "FeatureCollection", features: [] };
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

      // 3. FRAMING PETA
      // Selalu paskan viewport ke sebaran zona yang benar-benar ada. Backend
      // sudah memfilter fitur ke kabupaten terpilih, jadi fitBounds menjamin
      // seluruh kelurahan masuk layar — termasuk kabupaten yang lebar seperti
      // Bandar Lampung yang sebelumnya terpotong karena flyTo ke titik tetap.
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
        instance.fitBounds(activeBounds, { padding: 60, maxZoom: 13, duration: 1000 });
      } else if (selectedRegency && selectedRegency !== "all") {
        // Kabupaten terpilih tapi belum ada prediksi pada tanggal ini: arahkan
        // ke perkiraan pusat wilayah agar pengguna tetap paham konteks lokasi.
        const config = regencyCoordinates[selectedRegency] || regencyCoordinates[`Kabupaten ${selectedRegency}`] || regencyCoordinates[`Kota ${selectedRegency}`];
        if (config) instance.flyTo({ center: config.center, zoom: config.zoom, duration: 1000 });
        else instance.flyTo({ center: [105.26, -5.48], zoom: 9, duration: 1000 });
      } else {
        instance.flyTo({ center: [105.26, -5.48], zoom: 9, duration: 1000 });
      }
    };
    // "idle" (bukan "load") sebagai fallback: event load hanya fire sekali
    // seumur peta, sehingga toggle layer setelahnya bisa jadi no-op bila
    // isStyleLoaded() kebetulan false sesaat (mis. saat tile masih dimuat).
    if (instance.isStyleLoaded()) update(); else instance.once("idle", update);
  }, [regions, reports, layers, activeLayers, selectedRegency]);

  return <div ref={mapContainer} className="map-canvas" style={{ minHeight: 560, width: "100%" }} aria-label="Peta interaktif risiko banjir rob" />;
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
  const [catalog, setCatalog] = useState<Prediction[]>([]);
  const [selectedRegency, setSelectedRegency] = useState("all");
  const [selectedDate, setSelectedDate] = useState("all");
  const [activeLayers, setActiveLayers] = useState<Record<LayerKey, boolean>>({
    bahaya_rob: true,
    laporan: false,
    pasang_surut: false,
    garis_pantai: false,
    infrastruktur_kritis: false,
    evakuasi: false,
  });
  const [selectedFeature, setSelectedFeature] = useState<GeoJsonFeature | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const layerMenuRef = useRef<HTMLDivElement>(null);
  // Di mobile filter diringkas jadi satu tombol agar peta langsung terlihat.
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Tutup dropdown layer saat klik di luar atau tekan Escape.
  useEffect(() => {
    if (!layerMenuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (layerMenuRef.current && !layerMenuRef.current.contains(event.target as Node)) setLayerMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setLayerMenuOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [layerMenuOpen]);

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
  const selectedColor = riskColors[selectedRiskClass] ?? "var(--accent)";
  const selectedPopulation = selectedFeature?.properties.population;
  const toolbarHorizon = selectedDate === "all" ? "Prediksi terbaru" : `Prediksi ${horizonLabel(selectedDate)}`;

  // Dua panel peringatan dipakai di dua posisi berbeda: di ATAS peta saat mobile,
  // dan di kolom kanan saat desktop. Didefinisikan sekali di sini lalu dirender
  // pada dua wadah yang saling eksklusif lewat media query (lihat .map-warnings-*).
  const warningPanels = (
    <>
      <motion.div variants={itemVariants} className="panel" style={{ padding: 16, borderLeft: `3px solid ${riskColors[String(highestRisk?.properties.risk_class)] ?? "var(--accent)"}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Icon name="warning" style={{ fontSize: 20, color: riskColors[String(highestRisk?.properties.risk_class)] ?? "var(--accent)", flexShrink: 0 }} />
          <div>
            <strong style={{ display: "block", marginBottom: 3, color: "var(--ink)", fontSize: 13 }}>{highestRisk ? `Risiko ${riskText(highestRisk.properties.risk_class)} terdeteksi` : "Memuat peringatan risiko"}</strong>
            <span style={{ color: "var(--ink-soft)", fontSize: 12, lineHeight: 1.5 }}>{highestRisk ? `${highestRisk.properties.village ?? "Wilayah pesisir"}, ${highestRisk.properties.regency ?? "Lampung"} · peluang rob ${Math.round(Number(highestRisk.properties.risk_probability ?? 0))}%` : "Mengambil data peta dari server."}</span>
          </div>
        </div>
        {(!userRole || userRole === "warga") && <a className="btn secondary" href="#/awam" style={{ marginTop: 12, width: "100%", justifyContent: "center" }}>Lihat mode awam</a>}
      </motion.div>
      {isStaleData && <motion.div variants={itemVariants} className="panel" style={{ padding: 16, borderLeft: "3px solid #d97706", background: "#fef3c7" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Icon name="history" style={{ fontSize: 20, color: "#b45309", flexShrink: 0 }} />
          <div>
            <strong style={{ display: "block", marginBottom: 3, color: "#78350f", fontSize: 13 }}>Menampilkan Prediksi Historis</strong>
            <span style={{ color: "#92400e", fontSize: 12, lineHeight: 1.5 }}>Data peringatan cuaca hari ini gagal dimuat atau tertunda. Anda sedang melihat prediksi historis dari {regions.features[0]?.properties?.generated_at ? String(regions.features[0].properties.generated_at).substring(0, 10) : "sebelumnya"}.</span>
          </div>
        </div>
      </motion.div>}
    </>
  );

  return <AppShell active="map" title="Peta Bahaya Rob" subtitle="Pantau prediksi risiko banjir rob per wilayah pesisir Provinsi Lampung.">
    <style>{`
      .public-map-layout {
        display: grid;
        grid-template-columns: 1fr 340px;
        gap: 24px;
        align-items: start;
      }
      /* Desktop: peringatan tampil di kolom kanan. Wadah mobile di-display:none
         sehingga tidak ikut menempati sel grid (grid tetap 2 kolom). */
      .map-warnings-desktop { display: grid; gap: 14px; }
      .map-warnings-mobile { display: none; }
      .map-filter-bar {
        display: flex;
        align-items: flex-start;
        gap: 28px;
        row-gap: 16px;
        flex-wrap: wrap;
      }
      .map-filter-bar > label {
        display: grid;
        gap: 9px;
        flex: 1;
        min-width: 190px;
        max-width: 320px;
        font-size: 11px;
        font-weight: 700;
        color: var(--ink-soft);
        text-transform: uppercase;
        letter-spacing: .5px;
      }
      .map-filter-bar select { min-height: 44px; }
      .layer-menu-btn { transition: border-color .15s, box-shadow .15s; }
      .layer-menu-btn:hover, .layer-menu-btn[aria-expanded="true"] { border-color: var(--accent); box-shadow: 0 1px 6px rgba(2, 132, 199, .12); }
      .layer-option { transition: background .12s; }
      .layer-option:hover { background: var(--surface-soft); }
      /* Tombol ringkas filter — hanya tampil di mobile (lihat media query). */
      .map-filter-toggle {
        display: none;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 14px 18px;
        background: var(--surface);
        border: none;
        border-bottom: 1px solid var(--line);
        color: var(--ink);
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        text-align: left;
        cursor: pointer;
      }
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

        /* Mobile: peringatan naik ke atas peta (elemen pertama di grid 1 kolom),
           salinan di kolom kanan disembunyikan agar tidak dobel. */
        .map-warnings-mobile { display: grid; gap: 12px; }
        .map-warnings-desktop { display: none; }

        .map-filter-toggle { display: flex; }

        .map-filter-bar {
          display: none;
          flex-direction: column;
        }

        .map-filter-bar.is-open { display: flex; }

        .map-filter-bar select {
          width: 100%;
        }

        /* Dua lapis harus dibatasi: .map-container DAN div maplibre di dalamnya
           (.map-canvas) yang punya minHeight 560 inline — kalau hanya luarnya,
           konten dalam yang lebih tinggi tetap memaksa peta jadi 560px. */
        .map-container,
        .map-canvas {
          min-height: 46vh !important;
          height: 46vh !important;
        }

        .map-viewport .map-toolbar span { display: none; }
        .map-viewport .map-toolbar strong { border-left: 0; padding-left: 0; }

        /* Legenda dikeluarkan dari overlay peta: jadi strip mendatar di bawah
           peta agar tidak menimpa atribusi OSM & skala, dan area peta tetap utuh.
           (.legend sudah berada setelah .map-container di DOM.) */
        .legend {
          position: static;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px 14px;
          max-width: none;
          padding: 12px 16px;
          border: 0;
          border-top: 1px solid var(--line);
          border-radius: 0;
          background: var(--surface);
        }
        .legend strong { width: 100%; font-size: 0.78rem; }
        .legend span { font-size: 0.8rem; }
      }
    `}</style>
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="stack" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
      <motion.p variants={itemVariants} style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14 }}>Pantau prediksi risiko banjir rob per wilayah pesisir Provinsi Lampung.</motion.p>
      {error && <div className="alert" style={{ borderLeftColor: "var(--critical)" }}>{error}</div>}
      <motion.div variants={itemVariants} className="public-map-layout">
        <div className="map-warnings-mobile">{warningPanels}</div>
        <div className="panel flush" style={{ overflow: "hidden" }}>
          <button
            type="button"
            className="map-filter-toggle"
            onClick={() => setMobileFilterOpen((open) => !open)}
            aria-expanded={mobileFilterOpen}
          >
            <Icon name="tune" style={{ fontSize: 18, color: "var(--accent)" }} />
            <span style={{ flex: 1 }}>
              Filter{(selectedDate !== "all" ? 1 : 0) + (selectedRegency !== "all" ? 1 : 0) > 0 ? ` · ${(selectedDate !== "all" ? 1 : 0) + (selectedRegency !== "all" ? 1 : 0)} aktif` : ""}
            </span>
            <Icon name="expand_more" style={{ fontSize: 18, color: "var(--ink-soft)", transform: mobileFilterOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
          </button>
          <div className={`map-filter-bar${mobileFilterOpen ? " is-open" : ""}`} style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
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
            <div ref={layerMenuRef} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 9, flex: 1, minWidth: 190, maxWidth: 320 }}>
              <strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: .5, color: "var(--ink-soft)" }}>Pilihan Layer</strong>
              <button
                type="button"
                onClick={() => setLayerMenuOpen((open) => !open)}
                aria-expanded={layerMenuOpen}
                aria-haspopup="true"
                className="layer-menu-btn"
                style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 14px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", fontSize: 14, fontWeight: 500, width: "100%", textAlign: "left" }}
              >
                <Icon name="layers" style={{ fontSize: 18, color: "var(--accent)" }} />
                <span style={{ flex: 1 }}>{Object.values(activeLayers).filter(Boolean).length} dari 6 layer aktif</span>
                <Icon name="expand_more" style={{ fontSize: 18, color: "var(--ink-soft)", transform: layerMenuOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
              </button>
              {layerMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: .15 }}
                  className="layer-dropdown"
                  style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 6, zIndex: 20, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "0 12px 32px rgba(15, 23, 42, .16)", padding: 6, display: "grid", gridTemplateColumns: "1fr", gap: 1 }}
                >
                  {Object.entries({
                    bahaya_rob: "Bahaya Rob",
                    laporan: "Laporan Warga",
                    pasang_surut: "Pasang Surut",
                    garis_pantai: "Garis Pantai",
                    infrastruktur_kritis: "Infrastruktur",
                    evakuasi: "Jalur Evakuasi"
                  }).map(([key, label]) => (
                    <label key={key} className="layer-option" style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 13, textTransform: "none", letterSpacing: "normal", minWidth: "auto", fontWeight: 500, color: "var(--ink)", margin: 0, padding: "8px 10px", borderRadius: 8 }}>
                      <input
                        type="checkbox"
                        style={{ width: 15, height: 15, cursor: "pointer", flexShrink: 0, accentColor: "var(--accent)" }}
                        checked={activeLayers[key as LayerKey]}
                        onChange={(e) => setActiveLayers(prev => ({ ...prev, [key]: e.target.checked }))}
                      />
                      <span style={{ lineHeight: 1.2, whiteSpace: "nowrap" }}>{label}</span>
                    </label>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
          <div className="map-viewport">
            <div className="map-toolbar">
              <span>Pesisir Lampung</span>
              <strong>{toolbarHorizon}</strong>
            </div>
            <div className="map-container" style={{ minHeight: 560 }}>
              <RiskMap regions={regions} reports={reports} layers={layers} activeLayers={activeLayers} selectedRegency={selectedRegency} onSelectFeature={handleSelectFeature} />
            </div>
            <div className="legend">
              <strong>Legenda risiko</strong>
              {Object.entries(riskLabels).map(([risk, label]) => <span key={risk}><i className={`dot ${riskDotClass[risk]}`} />{label}</span>)}
            </div>
            {loading && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(255,255,255,.6)", fontWeight: 700 }}>Memuat peta.</div>}
          </div>
        </div>
        <aside className="stack" style={{ gap: 14 }}>
          <motion.div variants={itemVariants} className="panel flush">
            <div className="map-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", background: "var(--surface)" }}>{[[regions.features.length, "Zona dipantau", "var(--ink)"], [reports.features.length, "Laporan valid", "var(--low)"], [regions.features.filter((item) => ["tinggi", "sangat_tinggi"].includes(String(item.properties.risk_class))).length, "Risiko tinggi+", "var(--critical)"]].map(([value, label, color]) => <div key={String(label)} style={{ padding: "16px 8px", textAlign: "center" }}><strong style={{ display: "block", fontSize: 21, color: String(color) }}>{value}</strong><span style={{ fontSize: 11, color: "var(--ink-soft)" }}>{label}</span></div>)}</div>
          </motion.div>
          {activeWarning && <motion.div variants={itemVariants} className="panel" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Icon name="campaign" style={{ color: "var(--critical)" }} />
              <strong style={{ fontSize: 13 }}>Peringatan Risiko</strong>
            </div>
            <p style={{ margin: 0, fontSize: 13 }}>{activeWarning.message}</p>
          </motion.div>}
          <div className="map-warnings-desktop">{warningPanels}</div>
          <motion.div variants={itemVariants} className="panel flush">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
              <strong style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: .5, color: "var(--ink-soft)" }}>Wilayah terpilih</strong>
              {selectedFeature ? <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "var(--ink)" }}>{String(selectedFeature.properties.village ?? "Wilayah pesisir")}</div>
                  <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 2 }}>{[selectedFeature.properties.district, selectedFeature.properties.regency].filter(Boolean).join(", ")}</div>
                </div>
                <span className="badge" style={{ flexShrink: 0, background: `${selectedColor}1a`, color: selectedColor, borderColor: `${selectedColor}33` }}>{riskText(selectedRiskClass)}</span>
              </div> : <p style={{ margin: "10px 0 0", fontSize: 13 }}>Klik salah satu titik di peta untuk melihat detail wilayah.</p>}
            </div>
            {selectedFeature && <div style={{ padding: "16px 20px", display: "grid", gap: 12 }}>
              <div className="info-item"><Icon name="insights" /><div><strong>Probabilitas</strong><p>{Math.round(Number(selectedFeature.properties.risk_probability ?? 0))}%</p></div></div>
              <div className="info-item"><Icon name="groups" /><div><strong>Populasi risiko</strong><p>{typeof selectedPopulation === "number" && selectedPopulation > 0 ? `${numberFormatter.format(selectedPopulation)} jiwa` : "Data belum tersedia"}</p></div></div>
              <a className="btn primary" href="#/reports" style={{ justifyContent: "center" }}><Icon name="add_location_alt" /> Lapor Kejadian di Sini</a>
            </div>}
          </motion.div>
        </aside>
      </motion.div>
    </motion.div>
  </AppShell>;
}
