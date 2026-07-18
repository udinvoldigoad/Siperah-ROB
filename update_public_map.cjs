const fs = require('fs');
const path = './frontend/src/features/public-map/PublicMapPage.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'type LayerOption = "bahaya_rob" | "laporan" | "pasang_surut" | "garis_pantai";',
  'export type LayerKey = "bahaya_rob" | "laporan" | "pasang_surut" | "garis_pantai" | "infrastruktur_kritis" | "evakuasi";'
);

content = content.replace(
  /const \[layer, setLayer\] = useState<LayerOption>\("bahaya_rob"\);\s+const \[selectedFeature, setSelectedFeature\] = useState<GeoJsonFeature \| null>\(null\);\s+const \[loading, setLoading\] = useState\(true\);\s+const \[error, setError\] = useState\(""\);\s+const showReports = layer === "laporan";\s+const showTidal = layer === "pasang_surut";\s+const showCoastline = layer === "garis_pantai";/,
  `const [activeLayers, setActiveLayers] = useState<Record<LayerKey, boolean>>({
      bahaya_rob: true,
      laporan: false,
      pasang_surut: false,
      garis_pantai: false,
      infrastruktur_kritis: false,
      evakuasi: false,
    });
    const [selectedFeature, setSelectedFeature] = useState<GeoJsonFeature | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");`
);

content = content.replace(
  'function RiskMap({ regions, reports, layers, showReports, showTidal, showCoastline, selectedRegency, onSelectFeature }: { regions: FeatureCollection; reports: FeatureCollection; layers: MapLayers; showReports: boolean; showTidal: boolean; showCoastline: boolean; selectedRegency: string; onSelectFeature: (feature: GeoJsonFeature) => void }) {',
  'function RiskMap({ regions, reports, layers, activeLayers, selectedRegency, onSelectFeature }: { regions: FeatureCollection; reports: FeatureCollection; layers: MapLayers; activeLayers: Record<LayerKey, boolean>; selectedRegency: string; onSelectFeature: (feature: GeoJsonFeature) => void }) {'
);

content = content.replace(
  'if (showReports) {',
  'if (activeLayers.laporan) {'
);

content = content.replace(
  'if (showTidal) {',
  'if (activeLayers.pasang_surut) {'
);

content = content.replace(
  'const coastlineData = showCoastline ? layers.coastlines : { type: "FeatureCollection", features: [] };',
  'const coastlineData = activeLayers.garis_pantai ? layers.coastlines : { type: "FeatureCollection", features: [] };'
);

content = content.replace(
  '}, [regions, reports, layers, showReports, showTidal, showCoastline, selectedRegency]);',
  '}, [regions, reports, layers, activeLayers, selectedRegency]);'
);

content = content.replace(
  '<RiskMap regions={regions} reports={reports} layers={layers} showReports={showReports} showTidal={showTidal} showCoastline={showCoastline} selectedRegency={selectedRegency} onSelectFeature={handleSelectFeature} />',
  '<RiskMap regions={regions} reports={reports} layers={layers} activeLayers={activeLayers} selectedRegency={selectedRegency} onSelectFeature={handleSelectFeature} />'
);

// Fix constants
content = content.replace(
  'const riskDotClass: Record<string, string> = { sangat_tinggi: "critical", tinggi: "high", sedang: "medium", rendah: "low" };',
  `import { riskColors, riskLabels } from "../../shared/constants/risk";\n\nconst riskDotClass: Record<string, string> = { sangat_tinggi: "critical", tinggi: "high", sedang: "medium", rendah: "low" };`
);

// We need to change the map-filter-bar UI for layers
const oldFilterUI = `<label>Layer
              <select value={layer} onChange={(event) => setLayer(event.target.value as LayerOption)}>
                <option value="bahaya_rob">Bahaya rob</option>
                <option value="laporan">Laporan warga</option>
                <option value="pasang_surut">Pasang surut</option>
                <option value="garis_pantai">Garis pantai</option>
              </select>
            </label>`;

const newFilterUI = `<div style={{ display: "flex", gap: "20px", flex: 2, alignItems: "flex-end" }}>
              <div style={{ flex: 1, minWidth: "100%" }}>
                <strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: .5, color: "var(--ink-soft)", display: "block", marginBottom: 8 }}>Pilihan Layer</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {Object.entries({
                    bahaya_rob: "Bahaya Rob",
                    laporan: "Laporan Warga",
                    pasang_surut: "Pasang Surut",
                    garis_pantai: "Garis Pantai",
                    infrastruktur_kritis: "Infrastruktur",
                    evakuasi: "Jalur Evakuasi"
                  }).map(([key, label]) => (
                    <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, textTransform: "none", letterSpacing: "normal", minWidth: "auto" }}>
                      <input 
                        type="checkbox" 
                        checked={activeLayers[key as LayerKey]} 
                        onChange={(e) => setActiveLayers(prev => ({ ...prev, [key]: e.target.checked }))} 
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              
              <button 
                className="btn secondary" 
                onClick={() => window.location.href = \`/api/map/export\${selectedRegency !== 'all' || selectedDate !== 'all' ? '?' : ''}\${selectedRegency !== 'all' ? 'regency=' + selectedRegency : ''}\${selectedRegency !== 'all' && selectedDate !== 'all' ? '&' : ''}\${selectedDate !== 'all' ? 'date=' + selectedDate : ''}\`}
                style={{ alignSelf: "center", padding: "12px 16px" }}
              >
                <Icon name="download" style={{ fontSize: 18 }} /> Ekspor CSV
              </button>
            </div>`;

content = content.replace(oldFilterUI, newFilterUI);

// Replace riskColor with riskColors
content = content.replace(/riskColor/g, 'riskColors');
// Remove const riskLabel = ...
content = content.replace(/const riskLabel: Record<string, string> = {[^}]+};\s+/, '');
// Use riskLabels instead of riskLabel
content = content.replace(/riskLabel/g, 'riskLabels');

fs.writeFileSync(path, content, 'utf8');
