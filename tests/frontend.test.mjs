import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("frontend exposes a process canvas with local editing controls", async () => {
  const [home, canvas, log, comparison, shell] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/canvas/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/log/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/comparison/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/app-shell.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(home, /redirect\("\/canvas"\)/);
  assert.doesNotMatch(shell, /workspaceContexts|workspace-context/);
  assert.doesNotMatch(shell, /workspace-bar|topbar-actions|action\?: ReactNode/);
  assert.doesNotMatch(shell, /status\?:|Local draft|save-status/);
  assert.doesNotMatch(canvas, /action=|toolbar-save/);
  assert.doesNotMatch(canvas, /Local draft|local-pill/);
  assert.match(shell, /sidebar-footer[\s\S]*<ThemeToggle \/>/);
  assert.doesNotMatch(shell, /Business process workspace/);
  assert.match(canvas, /Add stage/);
  assert.match(canvas, /Add property/);
  assert.match(canvas, /<span>BUDGET<\/span>/);
  assert.match(canvas, /SLA TARGET/);
  assert.doesNotMatch(canvas, /PROJECT BUDGET|PROJECT SLA TARGET|BUDGET \/ RUN|Run:/);
  assert.doesNotMatch(canvas, /Live traffic|Pre-production|Sandbox environment/);
  assert.match(canvas, /GO-LIVE TARGET/);
  assert.match(canvas, /beginPan/);
  assert.match(canvas, /localStorage/);
  assert.match(log, /Decision log/);
  assert.match(log, /readCanvasVersions/);
  assert.match(comparison, /PROPERTY AGGREGATES/);
  assert.match(comparison, /STAGE DIFF/);
  assert.match(comparison, /BASELINE ENVIRONMENT \/ VERSION/);
  assert.match(shell, /\/canvas/);
  assert.match(shell, /\/log/);
  assert.match(shell, /\/comparison/);
});

test("frontend includes theme toggle and zero-FOUC script", async () => {
  const [shell, layout, themeToggle] = await Promise.all([
    readFile(new URL("../app/components/app-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/theme-toggle.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(shell, /ThemeToggle/);
  assert.match(layout, /decla_theme/);
  assert.match(layout, /data-theme/);
  assert.match(themeToggle, /localStorage\.setItem\("decla_theme"/);
  assert.match(themeToggle, /setAttribute\("data-theme"/);
});

test("frontend uses the DeCLA blue and orange theme across both color modes", async () => {
  const [globals, layout, canvas] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/canvas/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(globals, /--primary: #2A2ACF;/);
  assert.match(globals, /--accent: #F36A10;/);
  assert.match(globals, /--primary-ink:/);
  assert.match(globals, /--accent-ink: #F36A10;/);
  assert.match(globals, /\.brand strong \{ color: var\(--primary\)/);
  assert.match(layout, /themeColor: "#2A2ACF"/);
  assert.match(canvas, /color: "#2A2ACF"/);
  assert.match(canvas, /color: "#F36A10"/);
});

test("frontend canvas is independent of the backend runtime", async () => {
  const [canvas, packageJson] = await Promise.all([
    readFile(new URL("../app/canvas/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(canvas, /@\/lib\/api|cloudflare:workers|vinext/);
  assert.match(canvas, /localStorage/);
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

test("project property dropdowns overlay the fixed properties strip", async () => {
  const globals = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(globals, /\.project-properties-strip \{[^}]*overflow: visible;/s);
  assert.match(globals, /\.project-properties-strip \.searchable-select-menu/);
});
