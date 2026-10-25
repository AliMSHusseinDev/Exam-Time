import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "development-entry",
      configureServer(server) {
        // The root index.html is the portable production artifact. Develop from
        // the source entry instead, with normal Vite transforms and hot reload.
        server.middlewares.use((req, _res, next) => {
          if (req.url && ["/", "/index.html"].includes(req.url.split("?")[0])) {
            req.url = req.url.replace(/^\/(?:index\.html)?/, "/app.html");
          }
          next();
        });
      },
    },
  ],
  build: {
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: "app.html",
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "assets/app.js",
      },
    },
  },
});
