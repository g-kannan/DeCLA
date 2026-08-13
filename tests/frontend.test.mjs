import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
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
  assert.match(canvas, /Clear canvas/);
  assert.match(canvas, /clearCanvasOnly/);
  assert.doesNotMatch(canvas, /<div className="project-properties-title">/);
  assert.match(canvas, /className="project-properties-strip"/);
  assert.match(canvas, /handleAddCustomTag/);
  assert.match(canvas, /add-custom-tag-btn/);
  assert.match(canvas, /custom-tag-input/);
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

test("project is frontend-only and has no legacy API runtime", async () => {
  const [canvas, packageJson, readme, dockerfile] = await Promise.all([
    readFile(new URL("../app/canvas/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../Dockerfile", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(canvas, /@\/lib\/api|cloudflare:workers|vinext/);
  assert.match(canvas, /localStorage/);
  assert.doesNotMatch(packageJson, /wrangler|vinext|drizzle|cloudflare/i);
  assert.doesNotMatch(`${readme}\n${dockerfile}`, /FastAPI|uvicorn|alembic|NEXT_PUBLIC_API_URL|localhost:8000/i);
  await assert.rejects(access(new URL("../backend", import.meta.url)));
  await assert.rejects(access(new URL("../lib/api.ts", import.meta.url)));
  await assert.rejects(access(new URL("../docker-compose.yml", import.meta.url)));
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

test("frontend exposes feedback loop and alert stages with a single word wrap view option", async () => {
  const [canvas, flowCanvas, iconLibrary, globals] = await Promise.all([
    readFile(new URL("../app/canvas/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/canvas/flow-canvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/stage-icons.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(canvas, /label: "Feedback Loop", key: "feedback-loop"/);
  assert.match(canvas, /label: "Alert", key: "alert"/);
  assert.match(canvas, /label: "Agent", key: "agent"/);
  assert.match(canvas, /label: "Integration\/Tool", key: "integration-tool"/);
  assert.match(iconLibrary, /feedback-loop\.svg/);
  assert.match(iconLibrary, /alert\.svg/);
  assert.match(iconLibrary, /agent\.svg/);
  assert.match(iconLibrary, /integration-tool\.svg/);
  assert.match(canvas, />\s*Word Wrap\s*<\/button>/);
  assert.doesNotMatch(canvas, /Show stage icons|Show property pills|Compact node view/);
  assert.match(canvas, /wordWrap=\{wordWrap\}/);
  assert.match(globals, /\.flow-node-rf\.word-wrap > strong \{/);
  assert.match(globals, /\.flow-node-rf\.word-wrap \.flow-node-meta-rf \{/);
  assert.match(flowCanvas, /!wordWrap && stage\.properties\.length > 0/);
});

test("frontend example models a governed weekly forecast analysis AI system", async () => {
  const canvas = await readFile(new URL("../app/canvas/page.tsx", import.meta.url), "utf8");
  assert.match(canvas, /Weekly forecast analysis AI system/);
  assert.match(canvas, /Ingest weekly forecast files/);
  assert.match(canvas, /Mask sensitive identifiers/);
  assert.match(canvas, /Add freeform hypothesis statements/);
  assert.match(canvas, /LangGraph & Gemini AI SQL generation/);
  assert.match(canvas, /D1: Are new hypotheses registered\?/);
  assert.match(canvas, /D2: Were threshold breaches flagged\?/);
  assert.match(canvas, /Generate multi-tab Excel report/);
  assert.match(canvas, /Mask factory codes, country codes, & material numbers/);
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

test("frontend automatically formats decision count badges d1, d2 on addition and render", async () => {
  const [page, flowCanvas] = await Promise.all([
    readFile(new URL("../app/canvas/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/canvas/flow-canvas.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Decision d/);
  assert.match(page, /d\$\{decisionIndex\}/);
  assert.match(flowCanvas, /decisionLabels\.set\(s\.id, `d\$\{decisionCounter\}`\)/);
  assert.match(flowCanvas, /decisionLabel/);
});

test("frontend replaces hint banner with interactive searchbox to highlight specific nodes upon typing", async () => {
  const [page, flowCanvas, globals] = await Promise.all([
    readFile(new URL("../app/canvas/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/canvas/flow-canvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /className="canvas-search-wrap"/);
  assert.match(page, /className="canvas-search-input"/);
  assert.match(page, /searchMatchSet/);
  assert.match(page, /Search nodes \(e\.g\. intake, LLM\)\.\.\./);
  assert.match(page, /searchQuery=\{searchQuery\}/);
  assert.match(page, /searchMatchIds=\{searchMatchSet\}/);

  assert.match(flowCanvas, /isSearchActive/);
  assert.match(flowCanvas, /isSearchMatch/);
  assert.match(flowCanvas, /search-match/);
  assert.match(flowCanvas, /search-dimmed/);
  assert.match(flowCanvas, /search-match-tag/);
  assert.match(flowCanvas, /edgeSearchState/);

  assert.match(globals, /\.canvas-search-wrap/);
  assert.match(globals, /\.canvas-search-input/);
  assert.match(globals, /\.flow-node-rf\.search-match/);
  assert.match(globals, /\.flow-node-rf\.search-dimmed/);
  assert.match(globals, /\.flow-node-decision-wrap\.search-match/);
});
