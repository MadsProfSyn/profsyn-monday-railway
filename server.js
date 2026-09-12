const express = require("express");
const { Pool } = require("pg");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN;
const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_WEBHOOK_URL;
const DATABASE_URL = process.env.DATABASE_URL;

if (!MONDAY_API_TOKEN) {
  console.error("ERROR: MONDAY_API_TOKEN mangler.");
}

if (!ZAPIER_WEBHOOK_URL) {
  console.error("ERROR: ZAPIER_WEBHOOK_URL mangler.");
}

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL mangler.");
}


// ============================================================
// POSTGRES
// ============================================================

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});


// ============================================================
// DATABASE INITIALISERING
// ============================================================

async function initDatabase() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS syn (
      item_id TEXT PRIMARY KEY,
      kunde TEXT,
      lejemalsnr TEXT,
      adresse TEXT,
      vaerelser TEXT,
      type_syn TEXT,
      dato DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sent_to_zapier BOOLEAN DEFAULT FALSE,
      sent_at TIMESTAMP NULL
    );
  `);

  console.log("Database ready.");
}


// ============================================================
// MONDAY GRAPHQL
// ============================================================

async function mondayQuery(query, variables = {}) {

  const response = await fetch(
    "https://api.monday.com/v2",
    {
      method: "POST",

      headers: {
        "Authorization": MONDAY_API_TOKEN,
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        query,
        variables
      })
    }
  );

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Monday returnerede ugyldig JSON: ${text}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Monday API HTTP ${response.status}: ${text}`
    );
  }

  if (data.errors) {
    throw new Error(
      `Monday GraphQL fejl: ${JSON.stringify(data.errors)}`
    );
  }

  return data.data;
}


// ============================================================
// HENT MONDAY ITEM
// ============================================================

async function getMondayItem(itemId) {

  const query = `
    query ($itemId: [ID!]!) {
      items(ids: $itemId) {
        id
        name

        column_values(
          ids: [
            "text71",
            "text4",
            "text",
            "text7",
            "date5",
            "color_mm6g91vf"
          ]
        ) {
          id
          text
          value
        }
      }
    }
  `;

  const data = await mondayQuery(
    query,
    {
      itemId: [String(itemId)]
    }
  );

  if (
    !data.items ||
    data.items.length === 0
  ) {
    throw new Error(
      `Monday item ${itemId} blev ikke fundet.`
    );
  }

  const item = data.items[0];

  const columns = {};

  for (const column of item.column_values || []) {
    columns[column.id] = column;
  }

  return {
    itemId: String(item.id),

    kunde:
      item.name || "",

    lejemalsnr:
      columns.text71?.text || "",

    adresse:
      columns.text4?.text || "",

    vaerelser:
      columns.text?.text || "",

    typeSyn:
      columns.text7?.text || "",

    dato:
      extractDate(columns.date5),

    status:
      columns.color_mm6g91vf?.text || ""
  };
}


// ============================================================
// DATE HELPER
// ============================================================

function extractDate(column) {

  if (!column) {
    return null;
  }

  // Først prøver vi value
  if (column.value) {

    try {

      const value = JSON.parse(column.value);

      if (value.date) {
        return value.date;
      }

    } catch {
      // Ignorer parsing-fejl
    }
  }

  // Fallback til text
  const text = column.text || "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  return null;
}


// ============================================================
// NORMALISER WEBHOOK
// ============================================================

function isSendtWebhook(event) {

  if (!event) {
    return false;
  }

  const columnTitle =
    event.columnTitle || "";

  if (
    columnTitle !== "Send til E-conomics"
  ) {
    return false;
  }

  const labelText =
    event.value?.label?.text ||
    "";

  return labelText === "Sendt";
}


// ============================================================
// ROOT
// ============================================================

app.get("/", async (req, res) => {

  try {

    const result = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM syn
      `
    );

    res.json({
      success: true,
      service: "ProfSyn Monday → Railway",
      status: "online",
      collectedSyn: Number(
        result.rows[0].count
      )
    });

  } catch (error) {

    console.error(
      `GET / error: ${error.message}`
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// ============================================================
// MONDAY WEBHOOK
// ============================================================

app.post("/monday/webhook", async (req, res) => {

  try {

    const body = req.body;

    // --------------------------------------------------------
    // MONDAY CHALLENGE
    // --------------------------------------------------------

    if (body.challenge) {

      return res.json({
        challenge: body.challenge
      });
    }


    const event = body.event;

    if (!event) {

      return res.status(400).json({
        success: false,
        error: "Webhook event mangler."
      });
    }


    // --------------------------------------------------------
    // IGNORER ALT ANDET END SENDT
    // --------------------------------------------------------

    if (!isSendtWebhook(event)) {

      return res.json({
        success: true,
        ignored: true,
        reason: "Event er ikke Send til E-conomics = Sendt."
      });
    }


    const itemId =
      String(event.pulseId || event.itemId || "");

    if (!itemId) {

      return res.status(400).json({
        success: false,
        error: "Webhook mangler pulseId/itemId."
      });
    }


    // --------------------------------------------------------
    // HENT DATA FRA MONDAY
    // --------------------------------------------------------

    const syn =
      await getMondayItem(itemId);


    // --------------------------------------------------------
    // GEM I DATABASE
    //
    // VIGTIGT:
    // Ved ny "Sendt"-hændelse nulstiller vi
    // sent_to_zapier og sent_at.
    // --------------------------------------------------------

    await pool.query(
      `
      INSERT INTO syn (
        item_id,
        kunde,
        lejemalsnr,
        adresse,
        vaerelser,
        type_syn,
        dato,
        sent_to_zapier,
        sent_at
      )

      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        FALSE,
        NULL
      )

      ON CONFLICT (item_id)

      DO UPDATE SET

        kunde =
          EXCLUDED.kunde,

        lejemalsnr =
          EXCLUDED.lejemalsnr,

        adresse =
          EXCLUDED.adresse,

        vaerelser =
          EXCLUDED.vaerelser,

        type_syn =
          EXCLUDED.type_syn,

        dato =
          EXCLUDED.dato,

        sent_to_zapier =
          FALSE,

        sent_at =
          NULL
      `,
      [
        syn.itemId,
        syn.kunde,
        syn.lejemalsnr,
        syn.adresse,
        syn.vaerelser,
        syn.typeSyn,
        syn.dato
      ]
    );


    console.log(
      `Stored syn ${syn.itemId} | ${syn.kunde} | ${syn.lejemalsnr || "-"}`
    );


    return res.json({
      success: true,
      stored: true,
      itemId: syn.itemId,
      kunde: syn.kunde,
      lejemalsnr: syn.lejemalsnr,
      adresse: syn.adresse,
      vaerelser: syn.vaerelser,
      typeSyn: syn.typeSyn,
      dato: syn.dato,
      sentToZapier: false
    });


  } catch (error) {

    console.error(
      `POST /monday/webhook error: ${error.message}`
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// ============================================================
// SE ALLE SYN
// ============================================================

app.get("/api/syn", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        item_id,
        kunde,
        lejemalsnr,
        adresse,
        vaerelser,
        type_syn,
        dato,
        created_at,
        sent_to_zapier,
        sent_at

      FROM syn

      ORDER BY created_at ASC
    `);


    return res.json(
      result.rows.map(row => ({
        itemId: row.item_id,
        kunde: row.kunde,
        lejemalsnr: row.lejemalsnr,
        adresse: row.adresse,
        vaerelser: row.vaerelser,
        typeSyn: row.type_syn,
        dato: row.dato,
        createdAt: row.created_at,
        sentToZapier: row.sent_to_zapier,
        sentAt: row.sent_at
      }))
    );


  } catch (error) {

    console.error(
      `GET /api/syn error: ${error.message}`
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// ============================================================
// SEND TIL ZAPIER
// ============================================================

app.get("/api/send-to-zapier", async (req, res) => {

  try {

    if (!ZAPIER_WEBHOOK_URL) {

      return res.status(500).json({
        success: false,
        error: "ZAPIER_WEBHOOK_URL mangler."
      });
    }


    // --------------------------------------------------------
    // HENT IKKE-SENDTE SYN
    // --------------------------------------------------------

    const result = await pool.query(`
      SELECT
        item_id,
        kunde,
        lejemalsnr,
        adresse,
        vaerelser,
        type_syn,
        dato

      FROM syn

      WHERE sent_to_zapier = FALSE

      ORDER BY created_at ASC
    `);


    if (result.rows.length === 0) {

      return res.json({
        success: false,
        error: "Ingen ikke-sendte syn er opsamlet",
        count: 0
      });
    }


    // --------------------------------------------------------
    // BYG ZAPIER PAYLOAD
    // --------------------------------------------------------

    const syn = result.rows.map(row => ({
      itemId: row.item_id,
      kunde: row.kunde,
      lejemalsnr: row.lejemalsnr,
      adresse: row.adresse,
      vaerelser: row.vaerelser,
      typeSyn: row.type_syn,
      dato: row.dato
        ? String(row.dato).slice(0, 10)
        : ""
    }));


    const payload = {
      success: true,
      count: syn.length,
      syn
    };


    // --------------------------------------------------------
    // SEND TIL ZAPIER
    // --------------------------------------------------------

    const zapierResponse =
      await fetch(
        ZAPIER_WEBHOOK_URL,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify(payload)
        }
      );


    const zapierText =
      await zapierResponse.text();


    // --------------------------------------------------------
    // KUN MARKÉR SOM SENDT VED SUCCES
    // --------------------------------------------------------

    if (!zapierResponse.ok) {

      console.error(
        `Zapier failed: HTTP ${zapierResponse.status}`
      );

      return res.status(502).json({
        success: false,
        error: "Zapier accepterede ikke batchen.",
        zapierStatus: zapierResponse.status,
        zapierResponse: zapierText
      });
    }


    const itemIds =
      syn.map(x => x.itemId);


    await pool.query(
      `
      UPDATE syn

      SET
        sent_to_zapier = TRUE,
        sent_at = CURRENT_TIMESTAMP

      WHERE item_id = ANY($1::text[])
      `,
      [itemIds]
    );


    console.log(
      `Sent ${syn.length} syn to Zapier.`
    );


    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.json({

      success: true,

      count:
        syn.length,

      syn,

      sentAt:
        new Date().toISOString(),

      zapierStatus:
        zapierResponse.status

    });


  } catch (error) {

    console.error(
      `GET /api/send-to-zapier error: ${error.message}`
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// ============================================================
// TEMP: INSPEKTÉR MONDAY ITEM
// ============================================================

app.get("/api/item-columns/:itemId", async (req, res) => {

  try {

    const item =
      await getMondayItem(
        req.params.itemId
      );

    return res.json(item);

  } catch (error) {

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// ============================================================
// START
// ============================================================

async function start() {

  try {

    await initDatabase();

    app.listen(
      PORT,
      () => {
        console.log(
          `ProfSyn Railway service running on port ${PORT}`
        );
      }
    );

  } catch (error) {

    console.error(
      `Startup failed: ${error.message}`
    );

    process.exit(1);
  }
}


start();