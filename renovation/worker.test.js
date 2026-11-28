const assert = require("node:assert/strict");
const { test } = require("node:test");
const { groupInspections, processBatch, READY, COMPLETE } = require("./worker");
const { economicAdapter, mondayAdapter } = require("./integrations");
const { startRenovationWorker } = require("./index");

const contractor = { number: 7, name: "Fiktiv ApS" };
const batch = { id: "test-batch", contractor, items: [{ id: "1" }, { id: "2" }], phase: "ready" };

test("groups only explicitly marked, unclaimed rows by verified contractor", () => {
  const contractors = new Map([["fiktiv", contractor], ["alias", contractor]]);
  const rows = [
    { id: "1", status: READY, contractor: "FIKTIV" },
    { id: "2", status: READY, contractor: "alias" },
    { id: "3", status: "Sendt", contractor: "Fiktiv" },
    { id: "4", status: READY, contractor: "Ukendt" },
    { id: "5", status: READY, contractor: "Fiktiv", draftNumber: "99" },
    { id: "6", status: READY, contractor: "Fiktiv" },
  ];
  const { groups, review } = groupInspections(rows, contractors, new Set(["6"]));
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].items.map(item => item.id), ["1", "2"]);
  assert.deepEqual(review, ["4"]);
});

test("writes Monday only after the PDF is confirmed, reuses draft after upload failure", async () => {
  let copies = 0;
  let attachment = false;
  const state = { ...batch };
  const marks = [];
  const journal = {
    async setPhase(id, phase) { state.phase = phase; },
    async saveDraft(id, number) { state.draft_number = number; state.phase = "draft"; },
  };
  const deps = {
    journal,
    monday: { async mark(...args) { marks.push(args); } },
    pdf: { async render() { return Buffer.from("%PDF"); } },
    economic: {
      async prepareDraft() { return {}; },
      async createDraft() { copies++; return "91"; },
      async verifyDraft(number) { assert.equal(number, "91"); },
      async hasAttachment() { return attachment; },
      async attach() { attachment = true; throw Error("Forbindelsen afbrudt efter upload"); },
    },
  };
  await assert.rejects(processBatch({ ...state }, deps), /afbrudt/);
  assert.deepEqual(marks, []);
  assert.equal(await processBatch({ ...state }, deps), "complete");
  assert.equal(copies, 1);
  assert.deepEqual(marks, [["1", COMPLETE, "91"], ["2", COMPLETE, "91"]]);
});

test("never submits a second draft after an unresolved creation attempt", async () => {
  const economic = {
    async findDraft(id, number) { assert.equal(id, batch.id); assert.equal(number, contractor.number); return null; },
    async createDraft() { assert.fail("A second draft must not be created"); },
  };
  assert.equal(await processBatch({ ...batch, phase: "creating" }, { economic }), "review");
});

test("uses e-conomic's customer-specific price for product 109", async t => {
  const urls = [];
  t.mock.method(global, "fetch", async (url, { method } = {}) => {
    urls.push([url, method ?? "GET"]);
    if (url.endsWith("/customers/7")) return Response.json({ customerNumber: 7, name: "Fiktiv ApS" });
    return Response.json({ product: { productNumber: "109" }, unitNetPrice: 1365.48, discountPercentage: 2 });
  });
  const body = await economicAdapter({}).prepareDraft(batch);
  assert.deepEqual(urls, [
    ["https://restapi.e-conomic.com/customers/7", "GET"],
    ["https://restapi.e-conomic.com/customers/7/templates/invoiceline/109?quantity=2", "GET"],
  ]);
  assert.equal(body.lines[0].unitNetPrice, 1365.48);
  assert.equal(body.lines[0].quantity, 2);
  assert.equal(body.lines[0].discountPercentage, 2);
});

test("returns only marked Monday items and updates the two dedicated fields", async () => {
  const fields = { status: "s", draft: "d", contractor: "c", address: "a", lease: "l", type: "t", date: "dt" };
  const writes = [];
  const monday = mondayAdapter(async (query, args) => {
    if (query.includes("change_multiple_column_values")) {
      writes.push(JSON.parse(args.values));
      return { change_multiple_column_values: { id: args.item } };
    }
    const item = (id, status) => ({ id, name: "Fiktiv", column_values: [{ id: "s", text: status }] });
    if (query.includes("next_items_page")) return { next_items_page: { cursor: null, items: [item("3", READY)] } };
    return { boards: [{ items_page: { cursor: "next", items: [item("1", null), item("2", READY)] } }] };
  }, { board: ["42"], fields });
  assert.deepEqual((await monday.listReady()).map(item => item.id), ["2", "3"]);
  await monday.mark("2", COMPLETE, "99");
  assert.deepEqual(writes, [{ s: { label: COMPLETE }, d: "99" }]);
});

test("normal service startup does not require renovation configuration", () => {
  assert.doesNotThrow(() => startRenovationWorker({ env: {} }));
});
