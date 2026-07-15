export function MapPreview({ large = false }: { large?: boolean }) {
  return (
    <div className={`map-preview ${large ? "large" : ""}`} role="img" aria-label="Preview peta risiko rob di Teluk Lampung">
      <div className="map-toolbar">
        <span>Pesisir Lampung</span>
        <strong>Prediksi +1 hari</strong>
      </div>
      <span className="coast" />
      <span className="water" />
      <span className="hazard low" />
      <span className="hazard medium" />
      <span className="hazard high" />
      <span className="hazard critical" />
      <span className="pin red">4</span>
      <span className="pin orange">8</span>
      <span className="pin amber">5</span>
      <span className="pin green">2</span>
      <span className="map-label">Teluk Lampung</span>
      <div className="legend">
        <strong>Legenda risiko</strong>
        <span><i className="dot critical" />Sangat Tinggi</span>
        <span><i className="dot high" />Tinggi</span>
        <span><i className="dot medium" />Sedang</span>
        <span><i className="dot low" />Rendah</span>
      </div>
      <div className="map-scale">0 2 5 km</div>
    </div>
  );
}
