const { randomUUID } = require("node:crypto");

const PRODUCT = "109";
const READY = "Klar til istandsættelseskladde";
const COMPLETE = "Kladde med bilag oprettet";
const REVIEW = "Kræver kontrol";
const normalize = value => String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("da");

function groupInspections(items, contractors, claimed) {
  const groups = new Map();
  const review = [];
  for (const item of items) {
    if (item.status !== READY || item.draftNumber || claimed.has(item.id)) continue;
    const contractor = contractors.get(normalize(item.contractor));
    if (!contractor) {
      review.push(item.id);
      continue;
    }
    if (!groups.has(contractor.number)) groups.set(contractor.number, { contractor, items: [] });
    groups.get(contractor.number).items.push(item);
    claimed.add(item.id);
  }
  return { groups: [...groups.values()], review };
}

async function processBatch(batch, { journal, monday, economic, pdf }) {
  let draftNumber = batch.draft_number;
  if (!draftNumber) {
    if (batch.phase === "creating") {
      draftNumber = await economic.findDraft(batch.id, batch.contractor.number);
      if (!draftNumber) return "review";
    } else {
      const body = await economic.prepareDraft(batch);
      await journal.setPhase(batch.id, "creating");
      draftNumber = await economic.createDraft(body);
    }
    await journal.saveDraft(batch.id, draftNumber);
  }

  if (batch.phase !== "attached") {
    await economic.verifyDraft(draftNumber, batch);
    if (!await economic.hasAttachment(draftNumber)) {
      await economic.attach(draftNumber, await pdf.render(batch, draftNumber));
      if (!await economic.hasAttachment(draftNumber)) throw Error("Bilaget kunne ikke bekræftes");
    }
    await journal.setPhase(batch.id, "attached");
  }

  for (const item of batch.items) await monday.mark(item.id, COMPLETE, draftNumber);
  await journal.setPhase(batch.id, "complete");
  return "complete";
}

async function runOnce(deps) {
  const { journal, monday, contractors, log } = deps;
  const { groups, review } = groupInspections(await monday.listReady(), contractors, await journal.claimed());
  for (const id of review) {
    try {
      await monday.mark(id, REVIEW);
      log.warn("[Istandsættelse] Håndværker mangler verificeret kundekort", id);
    } catch (error) {
      log.error("[Istandsættelse] Monday-status", id, error.message);
    }
  }
  for (const group of groups) await journal.add({ ...group, id: randomUUID() });
  for (const batch of await journal.pending()) {
    try {
      if (await processBatch(batch, deps) === "review") {
        for (const item of batch.items) await monday.mark(item.id, REVIEW);
        await journal.setPhase(batch.id, "review");
        log.warn("[Istandsættelse] Kontrollér kladdereference", batch.id);
      }
    } catch (error) {
      log.error("[Istandsættelse] Batch", batch.id, error.message);
    }
  }
}

function buildJournal(db) {
  return {
    async init() {
      await db.query(`CREATE TABLE IF NOT EXISTS renovation_invoice_batches (
        id text PRIMARY KEY, contractor jsonb NOT NULL, items jsonb NOT NULL,
        phase text NOT NULL DEFAULT 'ready', draft_number text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    },
    async claimed() {
      const { rows } = await db.query(`SELECT item->>'id' AS id
        FROM renovation_invoice_batches, jsonb_array_elements(items) AS rows(item)`);
      return new Set(rows.map(row => row.id));
    },
    async add(batch) {
      await db.query("INSERT INTO renovation_invoice_batches(id, contractor, items) VALUES ($1,$2,$3)",
        [batch.id, JSON.stringify(batch.contractor), JSON.stringify(batch.items)]);
    },
    async pending() {
      const { rows } = await db.query(`SELECT * FROM renovation_invoice_batches
        WHERE phase NOT IN ('complete', 'review') ORDER BY created_at`);
      return rows;
    },
    async saveDraft(id, draftNumber) {
      await db.query("UPDATE renovation_invoice_batches SET draft_number=$2, phase='draft' WHERE id=$1", [id, draftNumber]);
    },
    async setPhase(id, phase) {
      await db.query("UPDATE renovation_invoice_batches SET phase=$2 WHERE id=$1", [id, phase]);
    },
  };
}

module.exports = { PRODUCT, READY, COMPLETE, REVIEW, normalize, groupInspections, processBatch, runOnce, buildJournal };
