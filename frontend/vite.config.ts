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
        configure(proxy) {
          /*
           * Without this the terminal fills with raw ECONNREFUSED stack
           * traces that name node:net rather than the actual problem, and
           * the browser sees a failed request with no status. Both look like
           * frontend faults; neither is. Say it once, plainly.
           */
          let warned = false;
          proxy.on("error", (error: NodeJS.ErrnoException) => {
            if (error.code === "ECONNREFUSED" && !warned) {
              warned = true;
              console.log(
                "\n\x1b[33m  The backend is not running.\x1b[0m Requests to /api cannot be forwarded,\n" +
                  "  so signing in and every other API call will fail.\n\n" +
                  "  Start it in another terminal:\n" +
                  "    cd backend\n" +
                  "    npm run dev\n\n" +
                  "  If it exits immediately, run \x1b[36mnpm run doctor\x1b[0m in backend/ — a .env\n" +
                  "  missing ENCRYPTION_KEY or BLIND_INDEX_KEY stops the server booting.\n",
              );
              setTimeout(() => { warned = false; }, 30_000);
            }
          });
        },
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