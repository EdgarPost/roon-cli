import * as esbuild from "esbuild";

const common = {
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  sourcemap: true,
  external: [
    "node-roon-api",
    "node-roon-api-transport",
    "node-roon-api-browse",
    "node-roon-api-status",
    "node-roon-api-image",
  ],
};

await Promise.all([
  esbuild.build({
    ...common,
    entryPoints: ["src/daemon/index.ts"],
    outfile: "dist/daemon.js",
    banner: {
      js: "#!/usr/bin/env node",
    },
  }),
  esbuild.build({
    ...common,
    entryPoints: ["src/cli/index.ts"],
    outfile: "dist/cli.js",
    banner: {
      js: "#!/usr/bin/env node",
    },
  }),
]);

console.log("Build complete!");
