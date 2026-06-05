import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function serveLegacyJsxRaw() {
  return {
    name: "serve-legacy-jsx-raw",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();

        const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        if (!pathname.endsWith(".jsx")) return next();

        const filePath = path.normalize(path.join(rootDir, pathname));
        if (!filePath.startsWith(rootDir + path.sep)) return next();
        if (!fs.existsSync(filePath)) return next();

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(fs.readFileSync(filePath, "utf8"));
      });
    },
  };
}

export default defineConfig({
  plugins: [serveLegacyJsxRaw()],
});
