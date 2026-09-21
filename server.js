// ==================================================
// ProfSyn Monday → Railway → Zapier
// DEBUG VERSION
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


// ==================================================
// ENV CHECK
// ==================================================

console.log("========================================");
console.log("SERVER START");
console.log("MONDAY_API_TOKEN:", MONDAY_API_TOKEN ? "OK" : "MISSING");
console.log("ZAPIER_WEBHOOK_URL:", ZAPIER_WEBHOOK_URL ? "OK" : "MISSING");
console.log("DATABASE_URL:", DATABASE_URL ? "OK" : "MISSING");
console.log("========================================");


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

  console.log("[DB] Initializing database...");

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

  console.log("[DB] Database ready.");
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


  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      value.trim()
    )
  ) {
    return value.trim();
  }


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


  const isoMatch =
    text.match(
      /(\d{4}-\d{2}-\d{2})/
    );

  if (isoMatch) {
    return isoMatch[1];
  }


  const parsed =
    new Date(text);

  if (
    !Number.isNaN(
      parsed.getTime()
    )
  ) {

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


  if (
    typeof value === "string"
  ) {

    const match =
      value.match(
        /^\d{4}-\d{2}-\d{2}/
      );

    if (match) {
      return match[0];
    }
  }


  if (
    value instanceof Date
  ) {

    if (
      !Number.isNaN(
        value.getTime()
      )
    ) {

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

async function mondayRequest(
  query,
  variables = {}
) {

  console.log("[MONDAY API] Request starting...");

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

    data =
      JSON.parse(text);

  } catch {

    data =
      text;
  }


  console.log(
    "[MONDAY API] HTTP:",
    response.status
  );


  if (!response.ok) {

    console.error(
      "[MONDAY API] HTTP ERROR:",
      JSON.stringify(data)
    );

    throw new Error(
      `Monday API HTTP ${response.status}: ` +
      JSON.stringify(data)
    );
  }


  if (data.errors) {

    console.error(
      "[MONDAY API] GRAPHQL ERROR:",
      JSON.stringify(data.errors)
    );

    throw new Error(
      `Monday API fejl: ` +
      JSON.stringify(data.errors)
    );
  }


  console.log(
    "[MONDAY API] Success"
  );


  return data.data;
}


// ==================================================
// GET MONDAY ITEM
// ==================================================

async function getMondayItem(
  itemId
) {

  console.log(
    "[STEP 3] Getting Monday item:",
    itemId
  );


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


  console.log(
    "[STEP 3] Monday returned items:",
    data.items?.length || 0
  );


  if (
    data.items &&
    data.items.length > 0
  ) {

    console.log(
      "[STEP 3] FOUND ITEM:",
      JSON.stringify(
        {
          id: data.items[0].id,
          name: data.items[0].name,
          columns:
            data.items[0].column_values
        },
        null,
        2
      )
    );

  } else {

    console.error(
      "[STEP 3] ITEM NOT FOUND:",
      itemId
    );
  }


  return (
    data.items?.[0] ||
    null
  );
}


// ==================================================
// GET COLUMN TEXT
// ==================================================

function getColumnText(
  columns,
  columnId
) {

  const column =
    columns.find(
      c =>
        c.id === columnId
    );


  console.log(
    `[COLUMN] ${columnId}:`,
    column
      ? JSON.stringify({
          text: column.text,
          value: column.value,
          type: column.type
        })
      : "NOT FOUND"
  );


  return (
    column?.text ||
    ""
  );
}


// ==================================================
// MONDAY WEBHOOK
// ==================================================

app.post(
  "/monday/webhook",
  async (req, res) => {

    console.log("");
    console.log("========================================");
    console.log("[WEBHOOK] NEW MONDAY WEBHOOK");
    console.log("========================================");


    try {

      // ------------------------------------------------
      // CHALLENGE
      // ------------------------------------------------

      if (
        req.body &&
        req.body.challenge
      ) {

        console.log(
          "[WEBHOOK] Challenge received"
        );

        return res.json({
          challenge:
            req.body.challenge
        });
      }


      // ------------------------------------------------
      // RAW BODY
      // ------------------------------------------------

      console.log(
        "[WEBHOOK] RAW BODY:",
        JSON.stringify(
          req.body,
          null,
          2
        )
      );


      // ------------------------------------------------
      // EVENT
      // ------------------------------------------------

      const event =
        req.body?.event ||
        {};


      console.log(
        "[STEP 1] Event:",
        JSON.stringify(
          event,
          null,
          2
        )
      );


      // ------------------------------------------------
      // ITEM ID
      // ------------------------------------------------

      const itemId =
        String(
          event.itemId ||
          event.pulseId ||
          event.item_id ||
          ""
        ).trim();


      console.log(
        "[STEP 1] Item ID:",
        itemId || "MISSING"
      );


      // ------------------------------------------------
      // COLUMN
      // ------------------------------------------------

      const columnTitle =
        event.columnTitle ||
        "";


      console.log(
        "[STEP 1] Column:",
        columnTitle
      );


      // ------------------------------------------------
      // LABEL
      // ------------------------------------------------

      let labelText =
        "";


      if (
        event.labelText &&
        typeof event.labelText ===
          "object"
      ) {

        labelText =
          event.labelText.text ||
          "";

      } else {

        labelText =
          event.labelText ||
          event.columnValue?.label?.text ||
          "";
      }


      console.log(
        "[STEP 1] Label:",
        labelText
      );


      // ------------------------------------------------
      // VALIDATE COLUMN
      // ------------------------------------------------

      if (
        String(columnTitle)
          .trim()
          .toLowerCase() !==
        "send til e-conomics"
      ) {

        console.log(
          "[STOP] Wrong column"
        );

        return res.json({

          success: true,

          ignored: true,

          reason:
            "Forkert kolonne"

        });
      }


      // ------------------------------------------------
      // VALIDATE LABEL
      // ------------------------------------------------

      if (
        String(labelText)
          .trim()
          .toLowerCase() !==
        "sendt"
      ) {

        console.log(
          "[STOP] Label is not Sendt:",
          labelText
        );

        return res.json({

          success: true,

          ignored: true,

          reason:
            "Label er ikke Sendt"

        });
      }


      console.log(
        "[STEP 2] Webhook passed filters"
      );


      // ------------------------------------------------
      // ITEM ID CHECK
      // ------------------------------------------------

      if (!itemId) {

        console.error(
          "[STOP] Missing itemId"
        );

        throw new Error(
          "Webhook mangler itemId/pulseId."
        );
      }


      // ------------------------------------------------
      // GET MONDAY ITEM
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


      console.log(
        "[STEP 3] Item successfully retrieved"
      );


      // ------------------------------------------------
      // COLUMNS
      // ------------------------------------------------

      const columns =
        item.column_values ||
        [];


      console.log(
        "[STEP 4] Number of columns:",
        columns.length
      );


      // ------------------------------------------------
      // CUSTOMER
      // ------------------------------------------------

      const kunde =
        String(
          item.name ||
          ""
        ).trim();


      console.log(
        "[STEP 4] KUNDE:",
        kunde
      );


      // ------------------------------------------------
      // LEJEMÅLSNR
      // ------------------------------------------------

      const lejemalsnr =
        getColumnText(
          columns,
          "text71"
        );


      // ------------------------------------------------
      // ADRESSE
      // ------------------------------------------------

      const adresse =
        getColumnText(
          columns,
          "text4"
        );


      // ------------------------------------------------
      // VÆRELSER
      // ------------------------------------------------

      const vaerelser =
        getColumnText(
          columns,
          "text"
        );


      // ------------------------------------------------
      // SYN
      // ------------------------------------------------

      const typeSyn =
        getColumnText(
          columns,
          "text7"
        );


      // ------------------------------------------------
      // DATO
      // ------------------------------------------------

      const rawDato =
        getColumnText(
          columns,
          "date5"
        );


      const dato =
        normalizeDate(
          rawDato
        );


      // ------------------------------------------------
      // FINAL DATA BEFORE DB
      // ------------------------------------------------

      const synData = {

        itemId:
          item.id,

        kunde,

        lejemalsnr,

        adresse,

        vaerelser,

        typeSyn,

        dato

      };


      console.log(
        "========================================"
      );

      console.log(
        "[STEP 5] DATA READY FOR DATABASE:"
      );

      console.log(
        JSON.stringify(
          synData,
          null,
          2
        )
      );

      console.log(
        "========================================"
      );


      // ------------------------------------------------
      // SAVE TO DATABASE
      // ------------------------------------------------

      console.log(
        "[STEP 6] Saving to Postgres..."
      );


      const dbResult =
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

          RETURNING *
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


      console.log(
        "[STEP 6] DATABASE SUCCESS"
      );


      console.log(
        "[STEP 6] DATABASE ROW:",
        JSON.stringify(
          dbResult.rows[0],
          null,
          2
        )
      );


      // ------------------------------------------------
      // SUCCESS
      // ------------------------------------------------

      console.log(
        "[STEP 7] WEBHOOK COMPLETED SUCCESSFULLY"
      );

      console.log(
        "========================================"
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
        "========================================"
      );

      console.error(
        "[WEBHOOK ERROR]"
      );

      console.error(
        error
      );

      console.error(
        "========================================"
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

          ORDER BY
            created_at DESC
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

        count:
          rows.length,

        syn:
          rows

      });


    } catch (error) {

      console.error(
        "[GET /api/syn ERROR]",
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
// SEND UNSENT SYN TO ZAPIER
// ==================================================

app.get(
  "/api/send-to-zapier",
  async (req, res) => {

    try {

      console.log(
        "[SEND] Starting send-to-zapier"
      );


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

          WHERE
            sent_to_zapier = FALSE

          ORDER BY
            dato ASC,
            item_id ASC
        `);


      const rows =
        result.rows;


      console.log(
        "[SEND] Number of unsent rows:",
        rows.length
      );


      if (
        rows.length === 0
      ) {

        return res.json({

          success: true,

          count: 0,

          syn: [],

          message:
            "Ingen usendte syn."

        });
      }


      const syn =
        rows.map(
          row => ({

            itemId:
              row.item_id,

            kunde:
              row.kunde ||
              "",

            lejemalsnr:
              row.lejemalsnr ||
              "",

            adresse:
              row.adresse ||
              "",

            vaerelser:
              row.vaerelser ||
              "",

            typeSyn:
              row.type_syn ||
              "",

            dato:
              formatDatabaseDate(
                row.dato
              )

          })
        );


      // ------------------------------------------------
      // CUSTOMER SUMMARY
      // ------------------------------------------------

      const customerSummary = {};

      for (
        const row of syn
      ) {

        const customer =
          row.kunde ||
          "EMPTY";

        if (
          !customerSummary[
            customer
          ]
        ) {

          customerSummary[
            customer
          ] = 0;

        }

        customerSummary[
          customer
        ]++;
      }


      console.log(
        "[SEND] CUSTOMER SUMMARY:",
        JSON.stringify(
          customerSummary,
          null,
          2
        )
      );


      console.log(
        "[SEND] DATA TO ZAPIER:"
      );

      console.log(
        JSON.stringify(
          syn,
          null,
          2
        )
      );


      // ------------------------------------------------
      // SEND TO ZAPIER
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


      console.log(
        "[SEND] Zapier HTTP:",
        zapierResponse.status
      );


      if (
        !zapierResponse.ok
      ) {

        throw new Error(
          `Zapier HTTP ${zapierResponse.status}: ` +
          zapierText
        );
      }


      // ------------------------------------------------
      // MARK AS SENT
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

          sent_to_zapier =
            TRUE,

          sent_at =
            CURRENT_TIMESTAMP

        WHERE
          item_id =
            ANY($1::text[])
        `,
        [
          itemIds
        ]
      );


      console.log(
        "[SEND] Marked",
        itemIds.length,
        "rows as sent."
      );


      return res.json({

        success: true,

        count:
          syn.length,

        syn,

        sentAt:
          new Date()
            .toISOString(),

        zapierStatus:
          zapierResponse.status

      });


    } catch (error) {

      console.error(
        "[SEND ERROR]",
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

      console.error(
        "[ITEM COLUMNS ERROR]",
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
// ROOT
// ==================================================

app.get(
  "/",
  async (req, res) => {

    try {

      const result =
        await pool.query(`
          SELECT
            COUNT(*)::int AS count
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
// RESET UNSENT
// ==================================================

app.get(
  "/api/reset-unsent",
  async (req, res) => {

    try {

      const result =
        await pool.query(`
          UPDATE syn

          SET

            sent_to_zapier =
              FALSE,

            sent_at =
              NULL

          RETURNING item_id
        `);


      console.log(
        "[RESET] Reset rows:",
        result.rows.length
      );


      return res.json({

        success: true,

        count:
          result.rows.length,

        resetItemIds:
          result.rows.map(
            r =>
              r.item_id
          )

      });


    } catch (error) {

      console.error(
        "[RESET ERROR]",
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