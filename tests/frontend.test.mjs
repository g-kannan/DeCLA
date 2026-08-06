import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("frontend exposes separate decision canvas, log, and comparison pages", async () => {
  const [home, canvas, log, comparison, shell] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/canvas/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/log/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/comparison/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/app-shell.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(home, /redirect\("\/canvas"\)/);
  assert.match(canvas, /Decision canvas/);
  assert.match(canvas, /Current/);
  assert.match(canvas, /Proposed/);
  assert.match(log, /Decision log/);
  assert.match(log, /listVersions/);
  assert.match(comparison, /Performance comparison/);
  assert.match(shell, /\/canvas/);
  assert.match(shell, /\/log/);
  assert.match(shell, /\/comparison/);
});

test("frontend uses the FastAPI client and has no Cloudflare runtime imports", async () => {
  const [canvas, packageJson] = await Promise.all([
    readFile(new URL("../app/canvas/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(canvas, /@\/lib\/api/);
  assert.doesNotMatch(canvas, /localStorage|cloudflare:workers|vinext/);
  assert.doesNotMatch(packageJson, /wrangler|vinext|drizzle|cloudflare/i);
});

test("frontend resolves stage icons from the local public icon library", async () => {
  const [canvas, iconLibrary] = await Promise.all([
    readFile(new URL("../app/canvas/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/stage-icons.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(canvas, /<StageIcon stage=/);
  assert.match(iconLibrary, /\/icons\/stages/);
  assert.doesNotMatch(iconLibrary, /https?:\/\//);
});
