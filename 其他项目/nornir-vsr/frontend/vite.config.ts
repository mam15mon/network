import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  // Load env from repo root to use a single .env
  envDir: resolve(__dirname, ".."),
  resolve: {
    alias: {
      "rc-resize-observer/es/SingleObserver": resolve(
        __dirname,
        "src/vendor/rc-resize-observer/SingleObserver.tsx"
      ),
      "rc-resize-observer/es/SingleObserver/index": resolve(
        __dirname,
        "src/vendor/rc-resize-observer/SingleObserver.tsx"
      ),
      "rc-resize-observer/es/SingleObserver/DomWrapper": resolve(
        __dirname,
        "src/vendor/rc-resize-observer/DomWrapper.tsx"
      ),
      "rc-resize-observer/lib/SingleObserver": resolve(
        __dirname,
        "src/vendor/rc-resize-observer/SingleObserver.tsx"
      ),
      "rc-resize-observer/lib/SingleObserver/index": resolve(
        __dirname,
        "src/vendor/rc-resize-observer/SingleObserver.tsx"
      ),
      "rc-resize-observer/lib/SingleObserver/DomWrapper": resolve(
        __dirname,
        "src/vendor/rc-resize-observer/DomWrapper.tsx"
      )
    }
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        ws: true,
        // Increase proxy timeouts to avoid 504s on long-running requests
        timeout: 300000,
        proxyTimeout: 300000,
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  },
  build: {
    outDir: "dist"
  }
});
