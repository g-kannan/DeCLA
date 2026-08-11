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
  assert.match(globals, /--primary:/);
  assert.match(globals, /--accent:/);
  assert.match(globals, /--primary-ink:/);
  assert.match(globals, /\.brand strong \{ color: var\(--primary\)/);
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

test("frontend exposes AI workflow stage types with dedicated icons", async () => {
  const [canvas, iconLibrary, localCanvas] = await Promise.all([
    readFile(new URL("../app/canvas/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/stage-icons.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/local-canvas.ts", import.meta.url), "utf8"),
  ]);
  assert.match(canvas, /label: "Human Action", key: "human-action"/);
  assert.match(canvas, /label: "Business Rule", key: "business-rule"/);
  assert.match(canvas, /label: "LLM", key: "llm"/);
  assert.match(canvas, /label: "User Interface", key: "user-interface"/);
  assert.match(canvas, /label: "Decision", key: "decision"/);
  assert.match(canvas, /"Streamlit"/);
  assert.match(iconLibrary, /human-action\.svg/);
  assert.match(iconLibrary, /business-rule\.svg/);
  assert.match(iconLibrary, /llm\.svg/);
  assert.match(iconLibrary, /user-interface\.svg/);
  assert.match(iconLibrary, /decision\.svg/);
  assert.match(localCanvas, /stage\.iconKey === "analytics"/);
});

test("frontend example models a governed AI loan underwriting process", async () => {
  const canvas = await readFile(new URL("../app/canvas/page.tsx", import.meta.url), "utf8");
  assert.match(canvas, /AI loan underwriting process/);
  assert.match(canvas, /Is the application complete\?/);
  assert.match(canvas, /Is applicant data verified\?/);
  assert.match(canvas, /Is the loan policy-eligible\?/);
  assert.match(canvas, /What is the AUS recommendation\?/);
  assert.match(canvas, /What is the final credit action\?/);
  assert.match(canvas, /Block if specific principal reasons cannot be reproduced/);
  assert.match(canvas, /Cannot invent, generalize, or replace principal reasons/);
  assert.doesNotMatch(canvas, /Capture lead|Qualify lead|Activate campaign/);
});

test("frontend supports customer return request example workflow", async () => {
  const canvas = await readFile(new URL("../app/canvas/page.tsx", import.meta.url), "utf8");
  assert.match(canvas, /Customer return request workflow/);
  assert.match(canvas, /D1: Is the order valid\?/);
  assert.match(canvas, /D2: Is the item return-eligible\?/);
  assert.match(canvas, /D3: What is the reason for return\?/);
  assert.match(canvas, /D4: Is an automatic refund permitted\?/);
  assert.match(canvas, /returnRequestSeedStages/);
  assert.match(canvas, /returnRequestSeedEdges/);
});

test("project property dropdowns overlay the fixed properties strip", async () => {
  const globals = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(globals, /\.project-properties-strip \{[^}]*overflow: visible;/s);
  assert.match(globals, /\.project-properties-strip \.searchable-select-menu/);
});

test("export dropdown overlays the project properties strip", async () => {
  const globals = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(globals, /\.export-menu-wrap \{[^}]*z-index: 30;/s);
  assert.match(globals, /\.project-properties-strip \{[^}]*z-index: 15;/s);
});
