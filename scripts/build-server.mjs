import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { isBuiltin } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const result = await build({
  absWorkingDir: root,
  entryPoints: ["server/_core/index.ts"],
  outfile: "dist/index.js",
  platform: "node",
  target: "node22",
  packages: "external",
  bundle: true,
  format: "esm",
  metafile: true,
  define: { "process.env.NODE_ENV": '"production"' },
});
for (const output of Object.values(result.metafile.outputs)) {
  for (const entry of output.imports) {
    if (!entry.external || isBuiltin(entry.path)) continue;
    const name = entry.path.startsWith("@")
      ? entry.path.split("/").slice(0, 2).join("/")
      : entry.path.split("/")[0];
    if (pkg.devDependencies?.[name] && !pkg.dependencies?.[name]) {
      throw new Error(
        `Production server requires development-only dependency: ${name}`
      );
    }
  }
}
console.log(
  "Production server built without development-only runtime imports."
);
