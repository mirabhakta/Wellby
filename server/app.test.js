import test from "node:test";
import assert from "node:assert/strict";
import { createApiApp } from "./app.js";

async function withServer(run) {
  const server = createApiApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("unknown API routes return a JSON 404", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/nope`);

    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await response.json(), { error: "Not found" });
  });
});

test("malformed JSON returns a JSON 400 without a stack trace", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/burnout/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad"
    });
    const body = await response.text();

    assert.equal(response.status, 400);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.match(body, /Invalid JSON body/);
    assert.doesNotMatch(body, /SyntaxError|node_modules|at JSON\.parse/);
  });
});

test("health and prediction routes still work", async () => {
  await withServer(async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, "ok");

    const prediction = await fetch(`${baseUrl}/api/burnout/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mental_fatigue_score: 8,
        hours_worked: 9,
        resource_allocation: 7,
        designation: 1,
        wfh_setup_available: 0
      })
    });
    const body = await prediction.json();

    assert.equal(prediction.status, 200);
    assert.equal(body.burn_rate, 0.82);
    assert.equal(body.source, "wellby-local-burnout-v1");
  });
});

test("security headers are present", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
    assert.equal(response.headers.get("x-powered-by"), null);
  });
});
