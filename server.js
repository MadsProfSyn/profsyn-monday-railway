// ==================================================
// ProfSyn Monday → Railway → Zapier
// ==================================================

const express = require("express");
const { Pool } = require("pg");

const app = express();

app.use(express.json());


// ==================================================
// ENV
// ==================================================

const PORT = process.env.PORT || 3000;

const MONDAY_API_TOKEN =
  process.env.MONDAY_API_TOKEN;

const ZAPIER_WEBHOOK_URL =
  process.env.ZAPIER_WEBHOOK_URL;

const DATABASE_URL =
  process.env.DATABASE_URL;


if (!MONDAY_API_TOKEN) {
  console.error("MANGLER MONDAY_API_TOKEN");
}

if (!ZAPIER_WEBHOOK_URL) {
  console.error("MANGLER ZAPIER_WEBHOOK_URL");
}

if (!DATABASE_URL) {
  console.error("MANGLER DATABASE_URL");
}


// ==================================================
// POSTGRES
// ==================================================

const pool = new Pool({
  connectionString: DATABASE_URL,

  ssl: {
    rejectUnauthorized: false
  }
});


// ==================================================
// DATABASE INIT
// ==================================================

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
    )
  `);

  console.log("Database ready.");

}


// ==================================================
// DATE HELPERS
// ==================================================

function normalizeDate(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }


  // Allerede YYYY-MM-DD
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
  ) {
    return value.trim();
  }


  // Hvis Monday sender JSON-lignende date object
  if (
    typeof value === "object" &&
    value !== null
  ) {

    if (value.date) {
      return normalizeDate(value.date);
    }

    if (value.text) {
      return normalizeDate(value.text);
    }

  }


  const text =
    String(value).trim();


  // YYYY-MM-DD i starten af teksten
  const isoMatch =
    text.match(
      /(\d{4}-\d{2}-\d{2})/
    );

  if (isoMatch) {
    return isoMatch[1];
  }


  // Håndter fx:
  // Mon Jun 09
  // Tue Sep 09
  // 2026-06-09T00:00:00.000Z

  const parsed =
    new Date(text);


  if (!Number.isNaN(parsed.getTime())) {

    const year =
      parsed.getUTCFullYear();

    const month =
      String(
        parsed.getUTCMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        parsed.getUTCDate()
      ).padStart(2, "0");

    return `${year}-${month}-${day}`;

  }


  return null;

}


function formatDatabaseDate(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }


  // PostgreSQL DATE kommer normalt som string.
  if (typeof value === "string") {

    const match =
      value.match(
        /^\d{4}-\d{2}-\d{2}/
      );

    if (match) {
      return match[0];
    }

  }


  // Fallback hvis driveren giver Date.
  if (value instanceof Date) {

    if (!Number.isNaN(value.getTime())) {

      const year =
        value.getUTCFullYear();

      const month =
        String(
          value.getUTCMonth() + 1
        ).padStart(2, "0");

      const day =
        String(
          value.getUTCDate()
        ).padStart(2, "0");

      return `${year}-${month}-${day}`;

    }

  }


  return normalizeDate(value) || "";

}


// ==================================================
// MONDAY API
// ==================================================

async function mondayRequest(query, variables = {}) {

  const response =
    await fetch(
      "https://api.monday.com/v2",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            MONDAY_API_TOKEN
        },

        body:
          JSON.stringify({
            query,
            variables
          })
      }
    );


  const text =
    await response.text();


  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }


  if (!response.ok) {

    throw new Error(
      `Monday API HTTP ${response.status}: ` +
      JSON.stringify(data)
    );

  }


  if (data.errors) {

    throw new Error(
      `Monday API fejl: ` +
      JSON.stringify(data.errors)
    );

  }


  return data.data;

}


// ==================================================
// MONDAY ITEM
// ==================================================

async function getMondayItem(itemId) {

  const query = `
    query ($itemId: ID!) {
      items(ids: [$itemId]) {
        id
        name
        column_values(ids: [
          "text71",
          "text4",
          "text",
          "text7",
          "date5",
          "color_mm6g91vf"
        ]) {
          id
          text
          value
          type
        }
      }
    }
  `;


  const data =
    await mondayRequest(
      query,
      {
        itemId
      }
    );


  return data.items?.[0] || null;

}


// ==================================================
// GET COLUMN VALUE
// ==================================================

function getColumnText(
  columns,
  columnId
) {

  const column =
    columns.find(
      c => c.id === columnId
    );


  return column?.text || "";

}


// ==================================================
// MONDAY WEBHOOK
// ==================================================

app.post(
  "/monday/webhook",
  async (req, res) => {

    try {

      // Monday webhook verification
      if (
        req.body &&
        req.body.challenge
      ) {

        return res.json({
          challenge:
            req.body.challenge
        });

      }


      const event =
        req.body?.event || {};


      const itemId =
        String(
          event.itemId ||
          ""
        );


      const columnTitle =
        event.columnTitle ||
        "";


      const labelText =
        event.labelText ||
        event.columnValue?.label?.text ||
        "";


      console.log(
        "Monday webhook:",
        JSON.stringify({
          itemId,
          columnTitle,
          labelText
        })
      );


      // Kun "Send til E-conomics" = "Sendt"
      if (
        columnTitle !==
        "Send til E-conomics"
      ) {

        return res.json({
          success: true,
          ignored: true,
          reason:
            "Forkert kolonne"
        });

      }


      if (
        String(labelText)
          .trim()
          .toLowerCase() !==
        "sendt"
          .toLowerCase()
      ) {

        return res.json({
          success: true,
          ignored: true,
          reason:
            "Label er ikke Sendt"
        });

      }


      if (!itemId) {

        throw new Error(
          "Webhook mangler itemId."
        );

      }


      // ------------------------------------------------
      // HENT ITEM FRA MONDAY
      // ------------------------------------------------

      const item =
        await getMondayItem(
          itemId
        );


      if (!item) {

        throw new Error(
          `Monday item ${itemId} blev ikke fundet.`
        );

      }


      const columns =
        item.column_values || [];


      const kunde =
        item.name || "";


      const lejemalsnr =
        getColumnText(
          columns,
          "text71"
        );


      const adresse =
        getColumnText(
          columns,
          "text4"
        );


      const vaerelser =
        getColumnText(
          columns,
          "text"
        );


      const typeSyn =
        getColumnText(
          columns,
          "text7"
        );


      const rawDato =
        getColumnText(
          columns,
          "date5"
        );


      // ------------------------------------------------
      // VIGTIGT:
      // NORMALISER DATO TIL YYYY-MM-DD
      // ------------------------------------------------

      const dato =
        normalizeDate(
          rawDato
        );


      console.log(
        "Dato:",
        rawDato,
        "→",
        dato
      );


      // ------------------------------------------------
      // UPSERT
      // ------------------------------------------------

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
          kunde = EXCLUDED.kunde,
          lejemalsnr = EXCLUDED.lejemalsnr,
          adresse = EXCLUDED.adresse,
          vaerelser = EXCLUDED.vaerelser,
          type_syn = EXCLUDED.type_syn,
          dato = EXCLUDED.dato,

          // VIGTIGT:
          // Når et syn ændres/genaktiveres,
          // skal det sendes til Zapier igen.
          sent_to_zapier = FALSE,
          sent_at = NULL
        `,
        [
          item.id,
          kunde,
          lejemalsnr,
          adresse,
          vaerelser,
          typeSyn,
          dato
        ]
      );


      return res.json({

        success: true,

        itemId:
          item.id,

        kunde,

        lejemalsnr,

        adresse,

        vaerelser,

        typeSyn,

        dato

      });


    } catch (error) {

      console.error(
        "Webhook error:",
        error
      );


      return res.status(500).json({

        success: false,

        error:
          error.message

      });

    }

  }
);


// ==================================================
// GET ALL SYN
// ==================================================

app.get(
  "/api/syn",
  async (req, res) => {

    try {

      const result =
        await pool.query(`
          SELECT
            item_id AS "itemId",
            kunde,
            lejemalsnr,
            adresse,
            vaerelser,
            type_syn AS "typeSyn",
            dato,
            created_at AS "createdAt",
            sent_to_zapier AS "sentToZapier",
            sent_at AS "sentAt"
          FROM syn
          ORDER BY created_at DESC
        `);


      const rows =
        result.rows.map(
          row => ({
            ...row,

            dato:
              formatDatabaseDate(
                row.dato
              )
          })
        );


      return res.json({
        success: true,
        count: rows.length,
        syn: rows
      });


    } catch (error) {

      console.error(error);


      return res.status(500).json({

        success: false,

        error:
          error.message

      });

    }

  }
);


// ==================================================
// SEND UNSENT SYN TO ZAPIER
// ==================================================

app.get(
  "/api/send-to-zapier",
  async (req, res) => {

    try {

      // ------------------------------------------------
      // HENT KUN IKKE-SENDTE
      // ------------------------------------------------

      const result =
        await pool.query(`
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
          ORDER BY dato ASC, item_id ASC
        `);


      const rows =
        result.rows;


      // ------------------------------------------------
      // INGENTING AT SENDE
      // ------------------------------------------------

      if (rows.length === 0) {

        return res.json({

          success: true,

          count: 0,

          syn: [],

          message:
            "Ingen usendte syn."

        });

      }


      // ------------------------------------------------
      // NORMALISER OUTPUT TIL ZAPIER
      // ------------------------------------------------

      const syn =
        rows.map(
          row => ({

            itemId:
              row.item_id,

            kunde:
              row.kunde || "",

            lejemalsnr:
              row.lejemalsnr || "",

            adresse:
              row.adresse || "",

            vaerelser:
              row.vaerelser || "",

            typeSyn:
              row.type_syn || "",

            // VIGTIGT:
            // Send ALTID YYYY-MM-DD
            dato:
              formatDatabaseDate(
                row.dato
              )

          })
        );


      // ------------------------------------------------
      // DEBUG
      // ------------------------------------------------

      console.log(
        "Sender til Zapier:",
        JSON.stringify(
          syn,
          null,
          2
        )
      );


      // ------------------------------------------------
      // SEND TIL ZAPIER
      // ------------------------------------------------

      const zapierResponse =
        await fetch(
          ZAPIER_WEBHOOK_URL,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                syn
              })
          }
        );


      const zapierText =
        await zapierResponse.text();


      if (!zapierResponse.ok) {

        throw new Error(
          `Zapier HTTP ${zapierResponse.status}: ` +
          zapierText
        );

      }


      // ------------------------------------------------
      // MARKÉR SOM SENDT
      // ------------------------------------------------

      const itemIds =
        rows.map(
          row =>
            row.item_id
        );


      await pool.query(
        `
        UPDATE syn

        SET
          sent_to_zapier = TRUE,
          sent_at = CURRENT_TIMESTAMP

        WHERE item_id = ANY($1::text[])
        `,
        [
          itemIds
        ]
      );


      // ------------------------------------------------
      // OUTPUT
      // ------------------------------------------------

      const sentAt =
        new Date().toISOString();


      return res.json({

        success: true,

        count:
          syn.length,

        syn,

        sentAt,

        zapierStatus:
          zapierResponse.status

      });


    } catch (error) {

      console.error(
        "send-to-zapier error:",
        error
      );


      return res.status(500).json({

        success: false,

        error:
          error.message

      });

    }

  }
);


// ==================================================
// GET ITEM COLUMNS
// ==================================================

app.get(
  "/api/item-columns/:itemId",
  async (req, res) => {

    try {

      const itemId =
        req.params.itemId;


      const item =
        await getMondayItem(
          itemId
        );


      if (!item) {

        return res.status(404).json({

          success: false,

          error:
            "Item ikke fundet."

        });

      }


      return res.json({

        success: true,

        itemId:
          item.id,

        name:
          item.name,

        columns:
          item.column_values

      });


    } catch (error) {

      console.error(error);


      return res.status(500).json({

        success: false,

        error:
          error.message

      });

    }

  }
);


// ==================================================
// ROOT
// ==================================================

app.get(
  "/",
  async (req, res) => {

    try {

      const result =
        await pool.query(`
          SELECT COUNT(*)::int AS count
          FROM syn
        `);


      return res.json({

        success: true,

        service:
          "ProfSyn Monday → Railway",

        status:
          "online",

        collectedSyn:
          result.rows[0].count

      });


    } catch (error) {

      return res.json({

        success: true,

        service:
          "ProfSyn Monday → Railway",

        status:
          "online",

        collectedSyn:
          0

      });

    }

  }
);


// ==================================================
// START
// ==================================================

initDatabase()
  .then(() => {

    app.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log(
          `Server running on port ${PORT}`
        );

      }

    );

  })
  .catch(error => {

    console.error(
      "Database initialization failed:",
      error
    );

    process.exit(1);

  });

app.get("/api/reset-unsent", async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE syn
      SET
        sent_to_zapier = FALSE,
        sent_at = NULL
      RETURNING item_id
    `);

    return res.json({
      success: true,
      count: result.rows.length,
      resetItemIds: result.rows.map(r => r.item_id)
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});