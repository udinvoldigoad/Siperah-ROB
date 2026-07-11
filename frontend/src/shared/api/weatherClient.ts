export interface TideDataPoint {
  time: string;
  wave_height: number;
}

export interface MarineForecastResponse {
  hourly: {
    time: string[];
    wave_height: (number | null)[];
  };
}

// Bandar Lampung coordinates
const LATITUDE = -5.45;
const LONGITUDE = 105.26;

/**
 * Fetches actual marine data for Bandar Lampung from Open-Meteo Marine API.
 * Uses wave_height as a proxy for sea level/tide anomalies in this prototype.
 */
export async function getLampungMarineData(): Promise<TideDataPoint[]> {
  try {
    const response = await fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${LATITUDE}&longitude=${LONGITUDE}&hourly=wave_height&timezone=Asia%2FJakarta&forecast_days=1`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch marine data");
    }

    const data: MarineForecastResponse = await response.json();
    
    // Parse the hourly data into a combined array
    const points: TideDataPoint[] = [];
    const times = data.hourly.time;
    const heights = data.hourly.wave_height;

    for (let i = 0; i < times.length; i++) {
      // Format time from "2026-07-10T00:00" to "00:00"
      const date = new Date(times[i]);
      const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      
      points.push({
        time: timeStr.replace(".", ":"), // Safely handle formatting variations
        // Fallback to 0 if null
        wave_height: heights[i] ?? 0
      });
    }

    return points;
  } catch (error) {
    console.error("Error fetching Open-Meteo data:", error);
    // Return fallback dummy data if API fails
    return [
      { time: "00:00", wave_height: 0.8 },
      { time: "04:00", wave_height: 1.5 },
      { time: "08:00", wave_height: 2.2 },
      { time: "12:00", wave_height: 1.7 },
      { time: "16:00", wave_height: 1.1 },
      { time: "20:00", wave_height: 0.9 }
    ];
  }
}

/**
 * Fetches the 30-day risk prediction from the local Python ML API.
 * Defaults to a mock array if the python server is not running.
 */
export async function getMLPrediction(regionId: string = "lampung"): Promise<number[]> {
  const fallbackData = [8, 12, 15, 20, 26, 34, 49, 45, 41, 34, 26, 20, 14, 8, 4, 3, 2, 3, 4, 7, 10, 12, 15, 11, 9, 6];
  
  try {
    const response = await fetch("http://127.0.0.1:8000/api/v1/predict/30-days", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        region_id: regionId,
        target_days: 30
      })
    });

    if (!response.ok) {
      throw new Error("ML API not responding");
    }

    const json = await response.json();
    return json.prediction_trend;
  } catch (err) {
    console.warn("Python ML API not running, using fallback data. Run `uvicorn main:app` in ml-api folder.");
    return fallbackData;
  }
}
