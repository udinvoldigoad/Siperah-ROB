/**
 * Weather & Marine Data Client
 * 
 * Fetches real-time marine data from Open-Meteo Marine API (free, no API key).
 * Coordinates target: Pesisir Teluk Lampung (~-5.45, 105.26)
 */

// ── Koordinat Pesisir Lampung ──────────────────────────────────────
const LAMPUNG_LAT = -5.45;
const LAMPUNG_LON = 105.26;
const MARINE_API_BASE = "https://marine-api.open-meteo.com/v1/marine";

// ── Types ──────────────────────────────────────────────────────────

export interface TideDataPoint {
  time: string;           // ISO 8601 timestamp, e.g. "2026-07-11T00:00"
  waveHeight: number;     // Tinggi gelombang (meter)
  waveDirection: number;  // Arah gelombang (derajat)
  wavePeriod: number;     // Periode gelombang (detik)
}

interface OpenMeteoMarineResponse {
  latitude: number;
  longitude: number;
  hourly: {
    time: string[];
    wave_height: (number | null)[];
    wave_direction: (number | null)[];
    wave_period: (number | null)[];
  };
}

// ── getLampungMarineData ───────────────────────────────────────────
/**
 * Mengambil data gelombang laut real-time dari Open-Meteo Marine API
 * untuk wilayah pesisir Lampung (7 hari ke depan, per jam).
 */
export async function getLampungMarineData(): Promise<TideDataPoint[]> {
  const params = new URLSearchParams({
    latitude: String(LAMPUNG_LAT),
    longitude: String(LAMPUNG_LON),
    hourly: "wave_height,wave_direction,wave_period",
    forecast_days: "7",
    timezone: "Asia/Jakarta",
  });

  const res = await fetch(`${MARINE_API_BASE}?${params}`);

  if (!res.ok) {
    throw new Error(`Open-Meteo Marine API error: ${res.status}`);
  }

  const json: OpenMeteoMarineResponse = await res.json();
  const { time, wave_height, wave_direction, wave_period } = json.hourly;

  return time.map((t, i) => ({
    time: t,
    waveHeight: wave_height[i] ?? 0,
    waveDirection: wave_direction[i] ?? 0,
    wavePeriod: wave_period[i] ?? 0,
  }));
}

// ── getMLPrediction ───────────────────────────────────────────────
/**
 * Mengambil data prediksi ML (jumlah kelurahan berisiko tinggi per hari).
 * 
 * Saat ini menggunakan data simulasi karena belum ada endpoint ML di backend.
 * Ketika backend sudah siap, ganti dengan fetch ke endpoint yang sesuai.
 */
export async function getMLPrediction(): Promise<number[]> {
  // TODO: Ganti dengan fetch ke backend ML endpoint ketika sudah tersedia
  // contoh: const res = await fetch(`${API_BASE}/ml/prediction`);

  // Simulasi delay jaringan agar UX konsisten
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Data simulasi: jumlah kelurahan berisiko per hari (30 hari)
  // Pola mengikuti siklus pasang surut — puncak di minggu ke-3
  return [
    8, 12, 15, 20, 26, 34, 49,
    45, 41, 34, 26, 20, 14, 8,
    4, 3, 2, 3, 4, 7, 10,
    12, 15, 11, 9, 6, 5, 4, 3, 2,
  ];
}
