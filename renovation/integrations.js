const { PRODUCT, READY, normalize } = require("./worker");

const ECONOMIC = "https://restapi.e-conomic.com";
const PRODUCT_PDF = "https://api.pdf.co/v1/pdf/convert/from/html";
const MAX_PDF_BYTES = 9 * 1000 * 1000;
const DRAFT_REF = id => "Istandsættelse " + id;
const safeHtml = value => String(value ?? "").replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

function mondayAdapter(request, config) {
  const fields = config.fields;
  const ids = Object.values(fields);
  const select = "cursor items { id name column_values(ids: $columns) { id text } }";
  return {
    async listReady() {
      const variables = { board: config.board, columns: ids };
      const first = await request(
        `query ($board: [ID!]!, $columns: [String!]!) {
          boards(ids: $board) { items_page(limit: 200) { ${select} } }
        }`, variables);
      let page = first.boards[0]?.items_page;
      if (!page) throw Error("Monday-boardet er utilgængeligt");
      const result = [];
      while (page) {
        for (const item of page.items) {
          const columns = new Map(item.column_values.map(column => [column.id, column.text]));
          if (columns.get(fields.status) !== READY) continue;
          result.push({
            id: item.id, customer: item.name, status: READY, draftNumber: columns.get(fields.draft),
            contractor: columns.get(fields.contractor), address: columns.get(fields.address),
            lease: columns.get(fields.lease), type: columns.get(fields.type), date: columns.get(fields.date),
          });
        }
        if (!page.cursor) break;
        const next = await request(
          `query ($cursor: String!, $columns: [String!]!) {
            next_items_page(limit: 200, cursor: $cursor) { ${select} }
          }`, { cursor: page.cursor, columns: ids });
        page = next.next_items_page;
      }
      return result;
    },
    async mark(id, status, draftNumber) {
      const values = { [fields.status]: { label: status } };
      if (draftNumber) values[fields.draft] = String(draftNumber);
      const result = await request(
        `mutation ($board: ID!, $item: ID!, $values: JSON!) {
          change_multiple_column_values(board_id: $board, item_id: $item, column_values: $values) { id }
        }`, { board: config.board, item: id, values: JSON.stringify(values) });
      if (String(result.change_multiple_column_values?.id) !== String(id)) throw Error("Monday bekræftede ikke opdateringen");
    },
  };
}

async function request(url, init) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(25_000) });
}

function economicAdapter(env) {
  const headers = {
    "X-AppSecretToken": env.RENOVATION_ECONOMIC_APP_TOKEN,
    "X-AgreementGrantToken": env.RENOVATION_ECONOMIC_GRANT_TOKEN,
  };
  async function getJson(path, body) {
    const response = await request(ECONOMIC + path, body ? {
      headers: { ...headers, "Content-Type": "application/json" },
      method: "POST", body: JSON.stringify(body),
    } : { headers });
    if (!response.ok) throw Error("e-conomic HTTP " + response.status);
    return response.json();
  }
  const draftPath = number => "/invoices/drafts/" + encodeURIComponent(number);
  const pdfPath = number => draftPath(number) + "/attachment/file";
  return {
    async prepareDraft(batch) {
      const number = batch.contractor.number;
      const [customer, line] = await Promise.all([
        getJson("/customers/" + number),
        getJson("/customers/" + number + "/templates/invoiceline/" + PRODUCT + "?quantity=" + batch.items.length),
      ]);
      if (customer.customerNumber !== number || normalize(customer.name) !== normalize(batch.contractor.name)) {
        throw Error("e-conomic-kundekortet matcher ikke opsætningen");
      }
      if (String(line.product?.productNumber) !== PRODUCT || typeof line.unitNetPrice !== "number" ||
          !Number.isFinite(line.unitNetPrice) || line.unitNetPrice <= 0) {
        throw Error("Prisen for istandsættelsesvaren mangler eller er ugyldig");
      }
      return {
        currency: customer.currency || "DKK",
        customer: { customerNumber: number },
        date: new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen" }).format(new Date()),
        layout: { layoutNumber: customer.layout?.layoutNumber ?? 21 },
        paymentTerms: { paymentTermsNumber: customer.paymentTerms?.paymentTermsNumber ?? 4 },
        recipient: {
          name: customer.name, address: customer.address, zip: customer.zip, city: customer.city,
          country: customer.country, vatZone: { vatZoneNumber: customer.vatZone?.vatZoneNumber ?? 1 },
          cvr: customer.vatNumber || undefined, ean: customer.ean || undefined,
        },
        references: { other: DRAFT_REF(batch.id) },
        lines: [{
          lineNumber: 1, sortKey: 1, product: { productNumber: PRODUCT }, description: line.description,
          quantity: batch.items.length, unitNetPrice: line.unitNetPrice,
          unit: line.unit?.unitNumber ? { unitNumber: line.unit.unitNumber } : undefined,
          discountPercentage: line.discountPercentage ?? 0,
        }],
      };
    },
    async createDraft(body) {
      const draft = await getJson("/invoices/drafts", body);
      if (!draft.draftInvoiceNumber) throw Error("e-conomic returnerede ikke kladdenummeret");
      return String(draft.draftInvoiceNumber);
    },
    async findDraft(id, number) {
      const params = new URLSearchParams({ filter: "references.other$eq:" + DRAFT_REF(id) });
      const drafts = await getJson("/invoices/drafts?" + params);
      const matches = drafts.collection.filter(draft => draft.references?.other === DRAFT_REF(id));
      if (matches.length !== 1 || matches[0].customer?.customerNumber !== number) return null;
      return String(matches[0].draftInvoiceNumber);
    },
    async verifyDraft(number, batch) {
      const draft = await getJson(draftPath(number));
      const line = draft.lines?.[0];
      if (draft.customer?.customerNumber !== batch.contractor.number ||
          draft.references?.other !== DRAFT_REF(batch.id) ||
          String(line?.product?.productNumber) !== PRODUCT || line.quantity !== batch.items.length) {
        throw Error("Kladde, kundenummer eller varelinje matcher ikke batchen");
      }
    },
    async hasAttachment(number) {
      const response = await request(ECONOMIC + pdfPath(number), { headers });
      if (response.status === 404) return false;
      if (!response.ok) throw Error("e-conomic bilagskontrol HTTP " + response.status);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.subarray(0, 4).toString() !== "%PDF") throw Error("e-conomic returnerede ikke et PDF-bilag");
      return true;
    },
    async attach(number, bytes) {
      const form = new FormData();
      form.append("", new Blob([bytes], { type: "application/pdf" }), `Istandsaettelse-${number}.pdf`);
      const response = await request(ECONOMIC + pdfPath(number), { headers, method: "POST", body: form });
      if (!response.ok) throw Error("e-conomic bilag HTTP " + response.status);
    },
  };
}

function pdfAdapter(apiKey) {
  return {
    async render(batch, number) {
      const rows = batch.items.map(item => [item.customer, item.address, item.lease, item.type, item.date]
        .map(value => "<td>" + safeHtml(value) + "</td>").join("")).map(row => "<tr>" + row + "</tr>").join("");
      const html = `<!doctype html><html lang="da"><meta charset="utf-8"><style>
        body{font:11pt Arial} table{border-collapse:collapse;width:100%} th,td{border:1px solid #888;
        text-align:left;padding:6px} tr{break-inside:avoid} thead{display:table-header-group}
        </style><h1>Bilag til administration af istandsættelse</h1>
        <p>${safeHtml(batch.contractor.name)} · Kladde ${safeHtml(number)} · ${batch.items.length} syn</p>
        <table><thead><tr><th>Kunde</th><th>Adresse</th><th>Lejemålsnr.</th><th>Syn</th><th>Dato</th></tr></thead>
        <tbody>${rows}</tbody></table></html>`;
      const response = await request(PRODUCT_PDF, {
        method: "POST", headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ html, name: `Istandsaettelse-${number}.pdf`, paperSize: "A4", orientation: "Landscape", async: false }),
      });
      if (!response.ok) throw Error("PDF.co HTTP " + response.status);
      const result = await response.json();
      if (result.error || typeof result.url !== "string" || !result.url.startsWith("https://")) throw Error("PDF.co returnerede intet bilag");
      const download = await request(result.url);
      if (!download.ok) throw Error("PDF-bilaget kunne ikke hentes");
      const bytes = Buffer.from(await download.arrayBuffer());
      if (bytes.length > MAX_PDF_BYTES || bytes.subarray(0, 4).toString() !== "%PDF") throw Error("Bilaget er ikke en gyldig PDF under 9 MB");
      return bytes;
    },
  };
}

module.exports = { mondayAdapter, economicAdapter, pdfAdapter };
