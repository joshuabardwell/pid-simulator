// Builds dist/pid-simulator.js (one self-contained file, React included) and copies index.html.
//   node scripts/build.mjs          one build
//   node scripts/build.mjs --serve  rebuild on change and serve dist/ on http://localhost:8137
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import * as esbuild from "esbuild";

function commit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "local";
  }
}

const serve = process.argv.includes("--serve");
const stamp = `${commit()} ${new Date().toISOString().slice(0, 16)}Z${serve ? " dev" : ""}`;

const options = {
  entryPoints: ["src/main.js"],
  outfile: "dist/pid-simulator.js",
  bundle: true,
  format: "iife",
  minify: true,
  target: "es2020",
  legalComments: "eof",
  banner: { js: `/* pid-simulator build ${stamp} */` },
  define: { __BUILD__: JSON.stringify(stamp), "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
};

mkdirSync("dist", { recursive: true });
copyFileSync("index.html", "dist/index.html");

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: "dist", port: 8137 });
  console.log(`Serving dist/ on http://localhost:${port}`);
} else {
  await esbuild.build(options);
  console.log(`Built dist/pid-simulator.js (${stamp})`);
}
