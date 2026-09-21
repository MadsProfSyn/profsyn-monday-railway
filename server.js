// ==================================================
// MONDAY WEBHOOK
// ==================================================

app.post(
  "/monday/webhook",
  async (req, res) => {

    try {

      // ------------------------------------------------
      // MONDAY WEBHOOK VERIFICATION
      // ------------------------------------------------

      if (
        req.body &&
        req.body.challenge
      ) {

        return res.json({
          challenge: req.body.challenge
        });

      }


      // ------------------------------------------------
      // HENT EVENT
      // ------------------------------------------------

      const event =
        req.body?.event || {};


      // ------------------------------------------------
      // ITEM ID
      //
      // Monday bruger normalt pulseId.
      // Vi understøtter også itemId for sikkerheds skyld.
      // ------------------------------------------------

      const itemId = String(
        event.pulseId ||
        event.itemId ||
        event.item_id ||
        ""
      ).trim();


      // ------------------------------------------------
      // COLUMN TITLE
      // ------------------------------------------------

      const columnTitle =
        event.columnTitle ||
        event.column_title ||
        "";


      // ------------------------------------------------
      // FIND LABEL / STATUS
      // ------------------------------------------------

      let labelText =
        event.labelText ||
        event.columnValue?.label?.text ||
        event.columnValue?.label ||
        "";


      // Monday kan sende value som JSON-string
      if (
        !labelText &&
        event.value
      ) {

        try {

          const value =
            typeof event.value === "string"
              ? JSON.parse(event.value)
              : event.value;

          labelText =
            value?.label ||
            value?.text ||
            value?.label?.text ||
            "";

        } catch (error) {

          // Hvis value ikke er JSON,
          // prøv at bruge den direkte
          labelText =
            String(event.value);

        }

      }


      // ------------------------------------------------
      // DEBUG
      // ------------------------------------------------

      console.log(
        "Monday webhook RAW EVENT:",
        JSON.stringify(
          event,
          null,
          2
        )
      );


      console.log(
        "Monday webhook PARSED:",
        JSON.stringify({
          itemId,
          columnTitle,
          labelText
        })
      );


      // ------------------------------------------------
      // KUN SEND TIL E-CONOMICS
      // ------------------------------------------------

      if (
        String(columnTitle)
          .trim()
          .toLowerCase() !==
        "send til e-conomics"
          .toLowerCase()
      ) {

        return res.json({
          success: true,
          ignored: true,
          reason: "Forkert kolonne",
          columnTitle
        });

      }


      // ------------------------------------------------
      // KUN NÅR STATUS ER SENDT
      // ------------------------------------------------

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
          reason: "Label er ikke Sendt",
          labelText
        });

      }


      // ------------------------------------------------
      // ITEM ID SKAL FINDES
      // ------------------------------------------------

      if (!itemId) {

        throw new Error(
          "Webhook mangler itemId/pulseId."
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


      // ------------------------------------------------
      // HENT COLUMNS
      // ------------------------------------------------

      const columns =
        item.column_values || [];


      // ------------------------------------------------
      // KUNDE
      // ------------------------------------------------

      const kunde =
        item.name || "";


      // ------------------------------------------------
      // LEJEMÅLSNR.
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
      // SYN TYPE
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
      // DEBUG — VIS HVAD DER GEMMES
      // ------------------------------------------------

      console.log(
        "Saving syn:",
        JSON.stringify({
          itemId: item.id,
          kunde,
          lejemalsnr,
          adresse,
          vaerelser,
          typeSyn,
          dato
        })
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


      // ------------------------------------------------
      // SUCCESS
      // ------------------------------------------------

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