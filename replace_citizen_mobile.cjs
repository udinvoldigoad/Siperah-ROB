const fs = require('fs');
const path = './frontend/src/features/public-map/CitizenModePage.tsx';
let content = fs.readFileSync(path, 'utf8');

const startIdx = content.indexOf('function CitizenModeMobile({');
const endIdx = content.indexOf('// ==========================================');

if (startIdx !== -1 && endIdx !== -1) {
  const newFunction = `function CitizenModeMobile({
    data, error, dataLoaded, setCoordinates, setLocationNote,
    requestGpsLocation, wilayahOptions, risk, cardStyle, forecastDays, currentLocation, actionCards,
    handleShareWhatsApp, handleCopyWarning
  }: any) {
  
    return (
      <AppShell active="awam" title="Status Bahaya Saya">
        <style>{\`
          \${WILAYAH_PICKER_STYLES}
          .app-main, .app-shell { background: transparent !important; }
          .full-bleed-map-bg {
            position: fixed;
            inset: 0;
            z-index: -1;
            background: var(--bg);
            background-image: radial-gradient(var(--line) 1px, transparent 1px);
            background-size: 24px 24px;
          }
          .bottom-sheet-container {
            background: var(--surface);
            border-radius: 32px 32px 0 0;
            box-shadow: 0 -10px 40px rgba(0,0,0,0.1);
            padding: 24px;
            padding-bottom: 100px;
            margin: 40px -24px -24px -24px;
            min-height: 80vh;
          }
          .drag-handle {
            width: 48px;
            height: 6px;
            background: var(--line);
            border-radius: 99px;
            margin: 0 auto 24px auto;
          }
          .mobile-forecast-scroller {
            display: flex;
            overflow-x: auto;
            gap: 12px;
            padding: 8px 0px 24px 0px;
            scroll-snap-type: x mandatory;
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .mobile-forecast-scroller::-webkit-scrollbar { display: none; }
          .mobile-forecast-card {
            scroll-snap-align: center;
            flex: 0 0 110px;
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 16px;
            padding: 16px 12px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.03);
          }
          .mobile-bento-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          .mobile-action-card {
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 16px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.02);
          }
          .mobile-report-card {
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 12px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 12px;
          }
        \`}</style>
        
        <div className="full-bleed-map-bg"></div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="alert" style={{ marginBottom: 16, borderLeftColor: "var(--critical)" }}>
            <Icon name="error" style={{ color: "var(--critical)" }} /> {error}
          </motion.div>
        )}
  
        <motion.div 
          className="bottom-sheet-container"
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
        >
          <div className="drag-handle" />

          {/* 1. GPS & Risk Status */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ marginBottom: 20 }}>
              <WilayahPicker
                variant="mobile"
                options={wilayahOptions}
                currentLocation={currentLocation}
                onRequestGps={requestGpsLocation}
                onSelectWilayah={(option: any) => { setCoordinates({ lat: option.lat, lon: option.lon }); setLocationNote(option.label); }}
              />
            </div>
            {data?.status_label && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 650, marginBottom: 12 }}>
                <Icon name={data.is_monitored ? "radar" : "info"} style={{ fontSize: 14 }} /> {data.status_label}
              </span>
            )}
            <h1 style={{ fontSize: "2.5rem", fontWeight: 900, lineHeight: 1.1, margin: "0 0 12px 0", letterSpacing: "-0.03em", color: "var(--ink)" }}>
              Status<br />{risk}
            </h1>
            <p style={{ fontSize: "1rem", lineHeight: 1.5, color: "var(--ink-soft)", margin: "0 0 24px 0" }}>
              {data ? (data.guidance_message ?? "Pantau kondisi rob di sekitar Anda.") : (dataLoaded ? "Lokasi di luar wilayah pantauan." : "Menganalisis...")}
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1, background: "var(--surface-soft)", borderRadius: 16, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, color: "var(--ink-soft)", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>Peluang</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)" }}>{data ? \`\${data.risk_probability}%\` : "-"}</div>
              </div>
              <div style={{ flex: 1, background: "var(--surface-soft)", borderRadius: 16, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, color: "var(--ink-soft)", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>Tinggi Air</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)" }}>{data ? \`\${(data.max_tidal_height || 0).toFixed(1)}m\` : "-"}</div>
              </div>
            </div>
          </div>

          {/* 2. Forecast Scroller */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: "1.1rem", margin: "0 0 4px 0", fontWeight: 700, color: "var(--ink)" }}>Prakiraan 7 Hari</h2>
            <p style={{ margin: "0 0 16px 0", color: "var(--ink-soft)", fontSize: "13px" }}>Geser untuk melihat hari berikutnya</p>
            <div className="mobile-forecast-scroller">
              {forecastDays.map(({ day, label, percent, color }: any, i: number) => (
                <div key={day} className="mobile-forecast-card">
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 700, marginBottom: 12 }}>{day}</div>
                  <div style={{ height: 100, width: 14, borderRadius: 999, background: "var(--line)", position: "relative", margin: "0 auto 12px auto" }}>
                    <motion.div initial={{ height: 0 }} animate={{ height: \`\${Math.min(percent, 100)}%\` }} transition={{ delay: 0.3 + (i * 0.1) }} style={{ position: "absolute", bottom: 0, left: 0, width: "100%", background: color, borderRadius: 999 }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: color as string }}>{label}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{percent}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Actions */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: "1.1rem", margin: "0 0 16px 0", fontWeight: 700, color: "var(--ink)" }}>Langkah Mitigasi</h2>
            <div className="mobile-bento-grid">
              {actionCards.map(([title, copy, icon]: any) => (
                <div key={title} className="mobile-action-card" onClick={() => title === "Laporkan kejadian" && (window.location.hash = "#/reports")} style={{ cursor: title === "Laporkan kejadian" ? "pointer" : "default", border: title === "Laporkan kejadian" ? "1px solid var(--accent-blue)" : undefined }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: title === "Laporkan kejadian" ? "rgba(37,99,235,0.1)" : "var(--surface-soft)", color: title === "Laporkan kejadian" ? "var(--accent-blue)" : "var(--ink-soft)" }}>
                    <Icon name={icon} style={{ fontSize: 20 }} />
                  </div>
                  <div>
                    <strong style={{ display: "block", fontSize: "13px", lineHeight: 1.3, marginBottom: 4, color: title === "Laporkan kejadian" ? "var(--accent-blue)" : "var(--ink-primary)" }}>{title}</strong>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--ink-soft)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Reports */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: "1.1rem", margin: "0 0 4px 0", fontWeight: 700, color: "var(--ink)" }}>Laporan Warga</h2>
            <p style={{ margin: "0 0 16px 0", color: "var(--ink-soft)", fontSize: "13px" }}>Kondisi lapangan saat ini</p>
            {data?.nearby_reports.length === 0 && <div style={{ padding: 24, textAlign: "center", background: "var(--surface-soft)", borderRadius: 12, color: "var(--ink-soft)", fontSize: 13 }}>Belum ada laporan.</div>}
            {data?.nearby_reports.map((report: any) => (
              <div key={report.id} className="mobile-report-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <strong style={{ fontSize: 14, color: "var(--ink-primary)" }}>{[report.region?.village, report.region?.district].filter(Boolean).join(", ") || "Wilayah pesisir"}</strong>
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{new Date(report.incident_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB</span>
                </div>
              </div>
            ))}
          </div>
          
        </motion.div>
      </AppShell>
    );
  }
\n\n`;

  const newContent = content.substring(0, startIdx) + newFunction + content.substring(endIdx);
  fs.writeFileSync(path, newContent, 'utf8');
  console.log("Replaced CitizenModeMobile successfully!");
} else {
  console.error("Could not find bounds");
}
