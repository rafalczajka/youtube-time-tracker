import chokidar from "chokidar";
import esbuild from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const outDir = path.join(rootDir, "dist");
const staticDir = path.join(rootDir, "static");
const watchMode = process.argv.includes("--watch");

const buildOptions = {
  bundle: true,
  entryPoints: {
    background: path.join(rootDir, "src", "background.ts"),
    popup: path.join(rootDir, "src", "popup.ts")
  },
  format: "esm",
  logLevel: "info",
  outdir: outDir,
  platform: "browser",
  sourcemap: true,
  target: ["chrome120"]
};

async function copyStaticAssets() {
  await mkdir(outDir, { recursive: true });
  await cp(staticDir, outDir, { force: true, recursive: true });
}

async function buildOnce() {
  await rm(outDir, { force: true, recursive: true });
  await copyStaticAssets();
  await esbuild.build(buildOptions);
}

async function runWatch() {
  await rm(outDir, { force: true, recursive: true });
  await copyStaticAssets();

  const context = await esbuild.context(buildOptions);
  await context.watch();
  console.log("Watching TypeScript sources...");

  const watcher = chokidar.watch(staticDir, { ignoreInitial: true });
  watcher.on("all", async () => {
    try {
      await copyStaticAssets();
      console.log("Copied static assets.");
    } catch (error) {
      console.error("Failed to copy static assets:", error);
    }
  });
}

if (watchMode) {
  runWatch().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  buildOnce().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
