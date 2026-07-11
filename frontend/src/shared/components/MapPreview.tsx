export function MapPreview({ large = false }: { large?: boolean }) {
  return (
    <div className={`map-preview ${large ? "large" : ""}`} role="img" aria-label="Preview peta risiko rob di Teluk Lampung">
      <iframe 
        width="100%" 
        height="100%" 
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 0, border: 'none', pointerEvents: 'none' }} 
        src="https://www.openstreetmap.org/export/embed.html?bbox=105.15%2C-5.55%2C105.35%2C-5.35&layer=mapnik"
        title="Peta Bandar Lampung"
      />
      <div className="map-toolbar" style={{ position: 'relative', zIndex: 1 }}>
        <span>Pesisir Lampung</span>
        <strong>Prediksi +1 hari</strong>
      </div>
      
      {/* We keep the hazard/pins as absolute overlays over the real map iframe */}
      <span className="hazard medium" style={{ zIndex: 1 }} />
      <span className="hazard high" style={{ zIndex: 1 }} />
      <span className="hazard critical" style={{ zIndex: 1 }} />
      <span className="pin red" style={{ zIndex: 2 }}>4</span>
      <span className="pin orange" style={{ zIndex: 2 }}>8</span>
      <span className="pin green" style={{ zIndex: 2 }}>2</span>
      
      <div className="legend" style={{ position: 'relative', zIndex: 1 }}>
        <strong>Legenda risiko</strong>
        <span><i className="dot critical" />Sangat Tinggi</span>
        <span><i className="dot high" />Tinggi</span>
        <span><i className="dot medium" />Sedang</span>
        <span><i className="dot low" />Rendah</span>
      </div>
      <div className="map-scale" style={{ position: 'relative', zIndex: 1 }}>0 2 5 km</div>
    </div>
  );
}
