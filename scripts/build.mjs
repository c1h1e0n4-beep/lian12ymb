import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ["index.html", "styles.css", "game.js"]) {
  await cp(path.join(root, file), path.join(output, file));
}
await cp(path.join(root, "public", "manus-routes.json"), path.join(output, "manus-routes.json"));
await cp(path.join(root, "logo.svg"), path.join(output, "logo.svg"));
await cp(path.join(root, "assets"), path.join(output, "assets"), { recursive: true });
console.log(`Static site built at ${output}`);
