import { build, file, write } from "bun";

await build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "node",
});

const content = await file("./dist/index.js").text();
await write("./dist/index.js", "#!/usr/bin/env node\n" + content);