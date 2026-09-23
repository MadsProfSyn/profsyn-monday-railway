// ==================================================
// ProfSyn Monday → Railway → Zapier
// ==================================================

const express = require("express");
const { Pool } = require("pg");
const crypto = require("crypto");

const app = express();

app.use(express.json());


// ==================================================
// ENV
// ==================================================

const PORT =
  process.env.PORT || 3000;

const MONDAY_API_TOKEN =
  process.env.MONDAY_API_TOKEN;

const ZAPIER_WEBHOOK_URL =
  process.env.ZAPIER_WEBHOOK_URL;

const DATABASE_URL =
  process.env.DATABASE_URL;


// ==================================================
// POSTGRES
// ==================================================

const pool = new Pool({
  connectionString:
    DATABASE_URL,

  ssl: {
    rejectUnauthorized: false
  }
});


// ==================================================
// DATABASE
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

  // Bruges til at identificere det konkrete
  // batch som Zapier skal hente.

  await pool.query(`
    ALTER TABLE syn
    ADD COLUMN IF NOT EXISTS send_batch_id TEXT
  `);

  console.log(
    "[DB] Database ready"
  );
}


// ==================================================
// DATE
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
    /^\d{4}-\d{2}-\d{2}$/.test(
      value.trim()
    )
  ) {
    return value.trim();
  }

  // Monday object
  if (
    typeof value === "object" &&
    value !== null
  ) {

    if (value.date) {
      return normalizeDate(
        value.date
      );
    }

    if (value.text) {
      return normalizeDate(
        value.text
      );
    }
  }

  const text =
    String(value).trim();

  // YYYY-MM-DD inde i tekst
  const iso =
    text.match(
      /(\d{4}-\d{2}-\d{2})/
    );

  if (iso) {
    return iso[1];
  }

  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const danish =
    text.match(
      /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/
    );

  if (danish) {

    const day =
      String(
        danish[1]
      ).padStart(2, "0");

    const month =
      String(
        danish[2]
      ).padStart(2, "0");

    const year =
      danish[3];

    return `${year}-${month}-${day}`;
  }

  const parsed =
    new Date(text);

  if (
    !Number.isNaN(
      parsed.getTime()
    )
  ) {

    return [
      parsed.getUTCFullYear(),

      String(
        parsed.getUTCMonth() + 1
      ).padStart(2, "0"),

      String(
        parsed.getUTCDate()
      ).padStart(2, "0")
    ].join("-");
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
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {

    return [
      value.getUTCFullYear(),

      String(
        value.getUTCMonth() + 1
      ).padStart(2, "0"),

      String(
        value.getUTCDate()
      ).padStart(2, "0")
    ].join("-");
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
      `Monday API error: ` +
      JSON.stringify(
        data.errors
      )
    );
  }

  return data.data;
}


// ==================================================
// GET MONDAY ITEM
// ==================================================

async function getMondayItem(
  itemId
) {

  const query = `
    query ($itemId: ID!) {

      items(ids: [$itemId]) {

        id

        name

        column_values {

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

  const item =
    data.items?.[0] ||
    null;

  if (!item) {

    console.error(
      "[MONDAY] Item not found:",
      itemId
    );

    return null;
  }

  console.log(
    "[MONDAY] Found:",
    item.id,
    "|",
    item.name
  );

  return item;
}


// ==================================================
// COLUMN VALUE
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

  if (!column) {
    return "";
  }


  // ----------------------------------------------
  // Normal Monday text
  // ----------------------------------------------

  if (
    column.text !== undefined &&
    column.text !== null &&
    String(
      column.text
    ).trim() !== ""
  ) {

    return String(
      column.text
    ).trim();
  }


  // ----------------------------------------------
  // Value fallback
  // ----------------------------------------------

  if (
    column.value !== undefined &&
    column.value !== null &&
    column.value !== ""
  ) {

    try {

      const parsed =
        typeof column.value === "string"
          ? JSON.parse(
              column.value
            )
          : column.value;


      if (
        parsed &&
        parsed.text !== undefined &&
        parsed.text !== null
      ) {

        return String(
          parsed.text
        ).trim();
      }


      if (
        parsed &&
        parsed.value !== undefined &&
        parsed.value !== null
      ) {

        return String(
          parsed.value
        ).trim();
      }


      if (
        parsed &&
        parsed.date !== undefined &&
        parsed.date !== null
      ) {

        return String(
          parsed.date
        ).trim();
      }

    } catch {

      return String(
        column.value
      ).trim();
    }
  }

  return "";
}


// ==================================================
// MONDAY WEBHOOK
// ==================================================

app.post(
  "/monday/webhook",
  async (req, res) => {

    try {

      // ----------------------------------------------
      // MONDAY CHALLENGE
      // ----------------------------------------------

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
        req.body?.event ||
        {};


      // ----------------------------------------------
      // ITEM ID
      // ----------------------------------------------

      const itemId =
        String(
          event.itemId ||
          event.pulseId ||
          event.item_id ||
          ""
        ).trim();


      // ----------------------------------------------
      // COLUMN
      // ----------------------------------------------

      const columnTitle =
        event.columnTitle ||
        "";


      // ----------------------------------------------
      // LABEL
      // ----------------------------------------------

      let labelText = "";


      // Current Monday structure
      if (
        event.value &&
        event.value.label
      ) {

        labelText =
          event.value.label.text ||
          "";
      }


      // Older structure
      else if (
        event.labelText &&
        typeof event.labelText === "object"
      ) {

        labelText =
          event.labelText.text ||
          "";
      }


      // Other fallback
      else {

        labelText =
          event.labelText ||
          event.columnValue?.label?.text ||
          "";
      }


      console.log(
        "[WEBHOOK]",
        itemId,
        "|",
        event.pulseName || "",
        "|",
        columnTitle,
        "|",
        labelText
      );


      // ----------------------------------------------
      // COLUMN FILTER
      // ----------------------------------------------

      if (
        String(columnTitle)
          .trim()
          .toLowerCase() !==
        "send til e-conomics"
      ) {

        return res.json({
          success: true,
          ignored: true,
          reason:
            "Forkert kolonne"
        });
      }


      // ----------------------------------------------
      // LABEL FILTER
      // ----------------------------------------------

      if (
        String(labelText)
          .trim()
          .toLowerCase() !==
        "sendt"
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
          "Webhook mangler itemId/pulseId"
        );
      }


      // ----------------------------------------------
      // GET MONDAY ITEM
      // ----------------------------------------------

      const item =
        await getMondayItem(
          itemId
        );


      if (!item) {

        throw new Error(
          `Monday item ${itemId} blev ikke fundet`
        );
      }


      // ----------------------------------------------
      // COLUMNS
      // ----------------------------------------------

      const columns =
        item.column_values ||
        [];


      // ----------------------------------------------
      // DATA
      // ----------------------------------------------

      const kunde =
        String(
          item.name ||
          ""
        ).trim();


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


      const dato =
        normalizeDate(
          rawDato
        );


      // ----------------------------------------------
      // DATA LOG
      // ----------------------------------------------

      console.log(
        "[SAVE]",
        JSON.stringify({
          itemId:
            item.id,

          kunde,

          lejemalsnr,

          adresse,

          vaerelser,

          typeSyn,

          dato
        })
      );


      // ----------------------------------------------
      // DATABASE
      // ----------------------------------------------

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
          sent_at,
          send_batch_id
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
          NULL,
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
            NULL,

          send_batch_id =
            NULL
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
        "[DB] SAVED:",
        item.id,
        "|",
        kunde
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
        "[WEBHOOK ERROR]",
        error.message
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

            sent_at AS "sentAt",

            send_batch_id AS "sendBatchId"

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
        "[GET SYN ERROR]",
        error.message
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
// SEND TO ZAPIER
// ==================================================
//
// Railway sender nu kun en lille trigger.
// Zapier henter derefter hele batchen via:
// /api/syn-for-zapier/:batchId
// ==================================================

app.get(
  "/api/send-to-zapier",
  async (req, res) => {

    try {

      console.log(
        "[SEND] Starting..."
      );


      // ----------------------------------------------
      // HENT ALLE USENDTE SYN
      // ----------------------------------------------

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
        "[SEND] Unsent:",
        rows.length
      );


      // ----------------------------------------------
      // INGENTING AT SENDE
      // ----------------------------------------------

      if (
        rows.length === 0
      ) {

        return res.json({

          success: true,

          count: 0,

          message:
            "Ingen usendte syn."

        });
      }


      // ----------------------------------------------
      // LAV UNIKT BATCH-ID
      // ----------------------------------------------

      const batchId =
        crypto.randomUUID();


      console.log(
        "[SEND] Batch:",
        batchId
      );


      // ----------------------------------------------
      // ITEM IDS
      // ----------------------------------------------

      const itemIds =
        rows.map(
          row =>
            row.item_id
        );


      // ----------------------------------------------
      // GEM BATCH-ID
      // ----------------------------------------------

      await pool.query(
        `
        UPDATE syn

        SET
          send_batch_id = $1

        WHERE
          item_id =
            ANY($2::text[])
        `,
        [
          batchId,
          itemIds
        ]
      );


      // ----------------------------------------------
      // URL SOM ZAPIER SKAL HENTE
      // ----------------------------------------------

      const synUrl =
        `https://profsyn-monday-railway-production-d25e.up.railway.app/api/syn-for-zapier/${batchId}`;


      // ----------------------------------------------
      // CUSTOMER SUMMARY
      // ----------------------------------------------

      const summary = {};

      for (
        const row of rows
      ) {

        const kunde =
          row.kunde ||
          "EMPTY";

        summary[kunde] =
          (summary[kunde] || 0) + 1;
      }


      console.log(
        "[SEND] Customers:",
        summary
      );


      // ----------------------------------------------
      // LILLE ZAPIER PAYLOAD
      // ----------------------------------------------

      const zapierPayload = {

        source:
          "Railway",

        batchId,

        synUrl,

        count:
          rows.length

      };


      console.log(
        "[SEND] Trigger:",
        JSON.stringify(
          zapierPayload
        )
      );


      // ----------------------------------------------
      // SEND TRIGGER TIL ZAPIER
      // ----------------------------------------------

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
              JSON.stringify(
                zapierPayload
              )

          }
        );


      const zapierText =
        await zapierResponse.text();


      console.log(
        "[SEND] Zapier HTTP:",
        zapierResponse.status
      );


      // ----------------------------------------------
      // HVIS ZAPIER FEJLER
      // ----------------------------------------------

      if (
        !zapierResponse.ok
      ) {

        await pool.query(
          `
          UPDATE syn

          SET
            send_batch_id = NULL

          WHERE
            item_id =
              ANY($1::text[])
          `,
          [
            itemIds
          ]
        );


        throw new Error(
          `Zapier HTTP ${zapierResponse.status}: ` +
          zapierText
        );
      }


      // ----------------------------------------------
      // MARKER BATCH SOM SENDT
      // ----------------------------------------------

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
        "[SEND] Marked sent:",
        itemIds.length
      );


      // ----------------------------------------------
      // OUTPUT
      // ----------------------------------------------

      return res.json({

        success: true,

        count:
          rows.length,

        batchId,

        synUrl,

        zapierStatus:
          zapierResponse.status,

        message:
          "Batch sendt til Zapier."

      });


    } catch (error) {

      console.error(
        "[SEND ERROR]",
        error.message
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
// GET BATCH FOR ZAPIER
// ==================================================
//
// Zapier bruger dette endpoint til at hente
// hele batchen samlet.
// ==================================================

app.get(
  "/api/syn-for-zapier/:batchId",
  async (req, res) => {

    try {

      const batchId =
        String(
          req.params.batchId ||
          ""
        ).trim();


      if (!batchId) {

        return res.status(400).json({

          success: false,

          error:
            "Mangler batchId."

        });
      }


      const result =
        await pool.query(
          `
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
            send_batch_id = $1

          ORDER BY
            dato ASC,
            item_id ASC
          `,
          [
            batchId
          ]
        );


      const syn =
        result.rows.map(
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

            dato:
              formatDatabaseDate(
                row.dato
              )

          })
        );


      console.log(
        "[BATCH] Batch:",
        batchId,
        "| Syn:",
        syn.length
      );


      return res.json({

        success: true,

        batchId,

        count:
          syn.length,

        syn

      });


    } catch (error) {

      console.error(
        "[BATCH ERROR]",
        error.message
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
// ITEM DEBUG
// ==================================================

app.get(
  "/api/item-columns/:itemId",
  async (req, res) => {

    try {

      const item =
        await getMondayItem(
          req.params.itemId
        );


      if (!item) {

        return res.status(404).json({

          success: false,

          error:
            "Item ikke fundet"

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

      return res.status(500).json({

        success: false,

        error:
          error.message

      });
    }
  }
);


// ==================================================
// UNSENT SUMMARY
// ==================================================

app.get(
  "/api/unsent-summary",
  async (req, res) => {

    try {

      const result =
        await pool.query(`
          SELECT

            kunde,

            COUNT(*)::int AS count

          FROM syn

          WHERE
            sent_to_zapier = FALSE

          GROUP BY
            kunde

          ORDER BY
            kunde
        `);


      return res.json({

        success: true,

        customers:
          result.rows

      });


    } catch (error) {

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


    } catch {

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
//
// Bruges kun manuelt til en ny ren test.
// Den gør ALLE syn usendte igen.
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
              NULL,

            send_batch_id =
              NULL

          RETURNING item_id
        `);


      console.log(
        "[RESET] Reset:",
        result.rows.length
      );


      return res.json({

        success: true,

        count:
          result.rows.length,

        resetItemIds:
          result.rows.map(
            row =>
              row.item_id
          )

      });


    } catch (error) {

      return res.status(500).json({

        success: false,

        error:
          error.message

      });
    }
  }
);


// ==================================================
// DELETE SENT SYN
// ==================================================
//
// MANUEL OPRYDNING EFTER FAKTURERING
//
// Sletter KUN syn, hvor:
// sent_to_zapier = TRUE
//
// URL:
// /api/delete-sent-syn
// ==================================================

app.get(
  "/api/delete-sent-syn",
  async (req, res) => {

    try {

      const result =
        await pool.query(`
          DELETE FROM syn

          WHERE
            sent_to_zapier = TRUE

          RETURNING item_id
        `);


      console.log(
        "[DELETE] Deleted sent syn:",
        result.rows.length
      );


      return res.json({

        success: true,

        deleted:
          result.rows.length,

        deletedItemIds:
          result.rows.map(
            row =>
              row.item_id
          )

      });


    } catch (error) {

      console.error(
        "[DELETE ERROR]",
        error.message
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