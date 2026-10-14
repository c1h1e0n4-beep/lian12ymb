import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.SERVE_DIST === "1" ? path.join(projectRoot, "dist") : projectRoot;
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://localhost");
    const decodedPath = decodeURIComponent(url.pathname);
    const routeManifestPath = process.env.SERVE_DIST === "1" ? "manus-routes.json" : path.join("public", "manus-routes.json");
    const relativePath = decodedPath === "/" ? "index.html" : decodedPath === "/manus-routes.json" ? routeManifestPath : decodedPath.replace(/^\/+/, "");
    const resolvedRoot = path.resolve(root);
    const filePath = path.resolve(resolvedRoot, relativePath);
    if (!filePath.startsWith(`${resolvedRoot}${path.sep}`) && filePath !== path.join(resolvedRoot, "index.html")) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const contents = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    response.end(contents);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () => console.log(`連‧十二步成文 is listening on 0.0.0.0:${port}`));
