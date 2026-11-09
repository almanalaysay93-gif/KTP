import { build } from "esbuild";
import { access, mkdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
if (
  (process.platform !== "win32" || process.arch !== "x64") &&
  !process.env.KTP_INSTALLER_RUST_BINARY
) {
  throw new Error(
    "Build the Windows installer on Windows x64. KTP_INSTALLER_RUST_BINARY is reserved for local runtime smoke tests."
  );
}
const executable =
  process.platform === "win32" ? "ktp-backend.exe" : "ktp-backend";
const source =
  process.env.KTP_INSTALLER_RUST_BINARY ||
  path.join(
    root,
    process.platform === "win32"
      ? "src/rust-backend/target/x86_64-pc-windows-msvc/release"
      : "src/rust-backend/target/release",
    executable
  );
await access(source).catch(() => {
  throw new Error(
    "Build the release Rust binary before preparing the installer runtime."
  );
});
await access(path.join(root, "dist/public/index.html")).catch(() => {
  throw new Error("Run pnpm build before preparing the installer runtime.");
});
await mkdir(path.join(root, "build/installer/bin"), { recursive: true });
await copyFile(source, path.join(root, "build/installer/bin", executable));
await build({
  absWorkingDir: root,
  entryPoints: ["scripts/run-local.ts"],
  outfile: "dist/run-local.mjs",
  platform: "node",
  target: "node22",
  format: "esm",
  bundle: true,
  packages: "external",
  sourcemap: false,
});
await writeFile(
  path.join(root, "build/installer/runtime.json"),
  JSON.stringify(
    {
      platform: process.platform,
      arch: process.arch,
      rustBinary: executable,
      generatedAt: new Date().toISOString(),
    },
    null,
    2
  ) + "\n"
);
console.log(
  "Installer runtime prepared; no user data or credentials were copied."
);
