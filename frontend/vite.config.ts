import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    build: {
      // Bundle awal sudah dipecah (lazy route). Chunk besar yang tersisa adalah
      // vendor maplibre-gl (~800 KB) yang memang satu library & hanya dimuat saat
      // halaman peta/laporan dibuka. Ambang dinaikkan sedikit di atasnya agar
      // warning tidak muncul untuk kasus yang sudah disengaja & di-lazy-load;
      // regresi ukuran di atas ini tetap akan memunculkan warning.
      chunkSizeWarningLimit: 850,
    },
    server: {
      host: true,
      port: 5173,
      hmr: {
        host: "localhost",
        port: 5173
      },
      proxy: {
        "/api": env.VITE_PROXY_TARGET || "http://127.0.0.1:8000",
        "/storage": env.VITE_PROXY_TARGET || "http://127.0.0.1:8000"
      }
    }
  };
});
