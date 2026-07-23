// Preview peta publik yang statis: gambar hasil tangkapan peta MapLibre asli
// (basemap OpenStreetMap + gelembung cluster risiko) pada zoom se-provinsi
// Lampung. Sengaja gambar statis, bukan MapLibre, agar landing tetap ringan.
// Sumber aset: frontend/public/map-preview-lampung.jpg.
export function MapPreview({ large = false }: { large?: boolean }) {
  return (
    <div className={`map-preview ${large ? "large" : ""}`}>
      <img
        className="map-preview-img"
        src="/map-preview-lampung.jpg"
        alt="Peta risiko banjir rob Provinsi Lampung dengan zona risiko empat warna"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
