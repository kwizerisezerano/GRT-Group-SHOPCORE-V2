import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    open: false,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },
    },
  },

  preview: {
    host: "127.0.0.1",
    port: 4173,
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,

    chunkSizeWarningLimit: 1500,

    rollupOptions: {
      output: {
        manualChunks: {
          vendor: [
            "react",
            "react-dom",
            "react-router-dom",
          ],

          supabase: [
            "@supabase/supabase-js",
          ],

          charts: [
            "recharts",
          ],

          pdf: [
            "jspdf",
            "jspdf-autotable",
          ],

          excel: [
            "xlsx",
          ],

          animation: [
            "framer-motion",
          ],
        },
      },
    },
  },
});