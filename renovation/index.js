const { buildJournal, normalize, runOnce } = require("./worker");
const { mondayAdapter, economicAdapter, pdfAdapter } = require("./integrations");

function readConfig(env) {
  const config = JSON.parse(env.RENOVATION_MONDAY_CONFIG || "{}");
  const required = ["status", "draft", "contractor", "address", "lease", "type", "date"];
  if (!Array.isArray(config.board) || config.board.length !== 1 || !/^\d+$/.test(config.board[0]) ||
      !required.every(field => typeof config.fields?.[field] === "string" && config.fields[field]) ||
      new Set(required.map(field => config.fields?.[field])).size !== required.length) {
    throw Error("Ugyldig Monday-konfiguration");
  }
  if (!["RENOVATION_ECONOMIC_APP_TOKEN", "RENOVATION_ECONOMIC_GRANT_TOKEN", "RENOVATION_PDFCO_API_KEY"]
    .every(key => env[key])) throw Error("Adgang til e-conomic eller PDF.co mangler");

  const entries = Object.entries(JSON.parse(env.RENOVATION_CONTRACTORS || "{}"));
  if (!entries.length || !entries.every(([label, card]) =>
    normalize(label) && Number.isSafeInteger(card?.number) && card.number > 0 && normalize(card.name))) {
    throw Error("Verificerede kundekort mangler");
  }
  const namesByNumber = new Map();
  const contractors = new Map();
  for (const [label, card] of entries) {
    const previousName = namesByNumber.get(card.number);
    if (contractors.has(normalize(label)) || (previousName && previousName !== normalize(card.name))) {
      throw Error("Modstridende kundekort");
    }
    namesByNumber.set(card.number, normalize(card.name));
    contractors.set(normalize(label), card);
  }
  return { config, contractors };
}

function startRenovationWorker({ pool, mondayRequest, env = process.env, log = console }) {
  if (env.RENOVATION_ENABLED !== "true") return;
  const { config, contractors } = readConfig(env);
  const monday = mondayAdapter(mondayRequest, config);
  const economic = economicAdapter(env);
  const pdf = pdfAdapter(env.RENOVATION_PDFCO_API_KEY);

  async function tick() {
    const client = await pool.connect();
    let lock = false;
    let releaseError;
    try {
      const { rows } = await client.query("SELECT pg_try_advisory_lock($1, $2) AS locked", [109, 7261]);
      lock = rows[0].locked;
      if (!lock) return;
      const journal = buildJournal(client);
      await journal.init();
      await runOnce({ journal, monday, economic, pdf, contractors, log });
    } finally {
      if (lock) {
        try {
          await client.query("SELECT pg_advisory_unlock($1, $2)", [109, 7261]);
        } catch (error) {
          releaseError = error;
        }
      }
      client.release(releaseError);
    }
  }

  async function schedule() {
    try {
      await tick();
    } catch (error) {
      log.error("[Istandsættelse] Kørsel", error.message);
    } finally {
      setTimeout(schedule, 5 * 60 * 1000).unref();
    }
  }
  setTimeout(schedule, 5 * 60 * 1000).unref();
}

module.exports = { startRenovationWorker, readConfig };
