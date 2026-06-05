import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const clientDataDir = path.join(rootDir, "client-data");

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  for (const [key, value] of Object.entries(jsonHeaders)) {
    res.setHeader(key, value);
  }
  res.end(JSON.stringify(payload, null, 2));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 25 * 1024 * 1024) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function ensureClientDataFolders() {
  const folders = ["prices", "pdfs", "projects", "exports", "company", "templates", "backups"];

  await Promise.all(
    folders.map((folder) => fsp.mkdir(path.join(clientDataDir, folder), { recursive: true })),
  );
}

function resolveClientDataPath(...segments) {
  const target = path.normalize(path.join(clientDataDir, ...segments));
  const root = path.normalize(clientDataDir);

  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("Path escapes client-data.");
  }

  return target;
}

async function writeJsonFile(filePath, data) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function readJsonFile(filePath) {
  const raw = await fsp.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function timestampForFileName(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
}

async function handleLocalApi(req, res, next) {
  if (!req.url) return next();

  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/api/")) return next();

  try {
    await ensureClientDataFolders();

    if (url.pathname === "/api/health" && req.method === "GET") {
      sendJson(res, 200, {
        ok: true,
        storage: "client-data",
        clientDataDir,
      });
      return;
    }

    if (url.pathname === "/api/projects" && req.method === "GET") {
      const projectsDir = resolveClientDataPath("projects");
      const entries = await fsp.readdir(projectsDir, { withFileTypes: true });
      const projects = [];

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const filePath = path.join(projectsDir, entry.name);
        try {
          const record = await readJsonFile(filePath);
          projects.push({
            id: record.id || path.basename(entry.name, ".json"),
            name: record.name || record.project?.name || entry.name,
            updatedAt: record.updatedAt || null,
            fileName: entry.name,
          });
        } catch {
          projects.push({
            id: path.basename(entry.name, ".json"),
            name: entry.name,
            updatedAt: null,
            fileName: entry.name,
            invalid: true,
          });
        }
      }

      sendJson(res, 200, { projects });
      return;
    }

    if (url.pathname === "/api/projects/current" && req.method === "GET") {
      const filePath = resolveClientDataPath("projects", "current-project.json");
      if (!fs.existsSync(filePath)) {
        sendJson(res, 200, { project: null, updatedAt: null });
        return;
      }

      sendJson(res, 200, await readJsonFile(filePath));
      return;
    }

    if (
      url.pathname === "/api/projects/current" &&
      (req.method === "POST" || req.method === "PUT")
    ) {
      const body = await readJsonBody(req);
      if (!body.project || typeof body.project !== "object") {
        sendJson(res, 400, { ok: false, error: "Expected { project } object." });
        return;
      }

      const now = new Date().toISOString();
      const record = {
        id: "current-project",
        name: body.name || body.project.name || "Current project",
        updatedAt: now,
        project: body.project,
      };
      const filePath = resolveClientDataPath("projects", "current-project.json");

      await writeJsonFile(filePath, record);
      sendJson(res, 200, {
        ok: true,
        updatedAt: now,
        file: "client-data/projects/current-project.json",
      });
      return;
    }

    if (url.pathname === "/api/company/profile" && req.method === "GET") {
      const filePath = resolveClientDataPath("company", "profile.json");
      if (!fs.existsSync(filePath)) {
        sendJson(res, 200, { profile: null, updatedAt: null });
        return;
      }

      sendJson(res, 200, await readJsonFile(filePath));
      return;
    }

    if (
      url.pathname === "/api/company/profile" &&
      (req.method === "POST" || req.method === "PUT")
    ) {
      const body = await readJsonBody(req);
      if (!body.profile || typeof body.profile !== "object") {
        sendJson(res, 400, { ok: false, error: "Expected { profile } object." });
        return;
      }

      const now = new Date().toISOString();
      const record = {
        updatedAt: now,
        profile: body.profile,
      };
      const filePath = resolveClientDataPath("company", "profile.json");

      await writeJsonFile(filePath, record);
      sendJson(res, 200, { ok: true, updatedAt: now, file: "client-data/company/profile.json" });
      return;
    }

    if (url.pathname === "/api/prices/current" && req.method === "GET") {
      const filePath = resolveClientDataPath("prices", "current-catalog.json");
      if (!fs.existsSync(filePath)) {
        sendJson(res, 200, { catalog: null, updatedAt: null });
        return;
      }

      sendJson(res, 200, await readJsonFile(filePath));
      return;
    }

    if (url.pathname === "/api/prices/current" && (req.method === "POST" || req.method === "PUT")) {
      const body = await readJsonBody(req);
      if (!body.catalog || typeof body.catalog !== "object" || !Array.isArray(body.catalog.items)) {
        sendJson(res, 400, { ok: false, error: "Expected { catalog: { source, items[] } }." });
        return;
      }

      const now = new Date().toISOString();
      const record = {
        updatedAt: now,
        catalog: body.catalog,
      };
      const filePath = resolveClientDataPath("prices", "current-catalog.json");

      await writeJsonFile(filePath, record);
      sendJson(res, 200, {
        ok: true,
        updatedAt: now,
        file: "client-data/prices/current-catalog.json",
      });
      return;
    }

    if (url.pathname === "/api/backups" && req.method === "POST") {
      const backupName = `client-data-${timestampForFileName()}.zip`;
      const backupPath = resolveClientDataPath("backups", backupName);
      const zip = new AdmZip();
      const folders = ["company", "exports", "pdfs", "prices", "projects", "templates"];

      for (const folder of folders) {
        const folderPath = resolveClientDataPath(folder);
        if (fs.existsSync(folderPath)) {
          zip.addLocalFolder(folderPath, folder);
        }
      }

      await fsp.mkdir(path.dirname(backupPath), { recursive: true });
      zip.writeZip(backupPath);

      const stat = await fsp.stat(backupPath);
      sendJson(res, 200, {
        ok: true,
        file: `client-data/backups/${backupName}`,
        bytes: stat.size,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    sendJson(res, 404, { ok: false, error: "Unknown API route." });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected local API error.",
    });
  }
}

function localClientDataApi() {
  return {
    name: "local-client-data-api",
    configureServer(server) {
      server.middlewares.use(handleLocalApi);
    },
  };
}

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
  plugins: [localClientDataApi(), serveLegacyJsxRaw()],
});
