import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the simplified vertical decision path", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>DeCLA — Decision Latency Architecture<\/title>/i);
  assert.match(html, /Decision path/);
  assert.match(html, /Stages run from top to bottom\./);
  assert.match(html, /Order events/);
  assert.match(html, /Executive P&amp;L/);
  assert.doesNotMatch(html, /react-flow|mini-map|canvas controls/i);
});

test("does not ship the React Flow dependencies", async () => {
  const [page, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /@xyflow\/react|ReactFlow|useNodesState|useEdgesState/);
  assert.doesNotMatch(packageJson, /@xyflow\/react|html-to-image/);
  assert.match(page, /className="stage-list"/);
});
