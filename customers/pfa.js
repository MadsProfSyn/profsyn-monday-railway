// ==================================================
// PFA PROPERTY / CUSTOMER MAPPING
// ==================================================
// Railway håndterer PFA-mapping centralt.
// Lejemålsnummeret har førsteprioritet.
// Adressen bruges som fallback, hvis nummeret ikke kan matches.
// Ved tvetydige adresser vælges der ikke automatisk en ejendom.

const PFA_CUSTOMERS = {
  "226": { name: "PFA DK Boliger Lav A/S", cvr: "36200022" },
  "228": { name: "PFA Absalon Ejendomme P/S", cvr: "35466169" },
  "230": { name: "PFA Boligudlejning ApS", cvr: "39080915" },
  "231": { name: "PFA Seniorboliger Sønderborg P/S", cvr: "41927372" },
  "232": { name: "PFA Boliger Slagelse A/S", cvr: "32566197" },
  "233": { name: "PFA Seniorboliger og Friplejehjem P/S", cvr: "42018775" }
};

const PFA_PROPERTIES = [
  { enhedsnr: "152-101", kundenr: "226", ejendom: "Frederikskaj 2A-N", address: "Frederikskaj 2A-B,F-G, M-N, 2450 København SV", street: "Frederikskaj", from: 2, to: 2 },

  { enhedsnr: "152-104", kundenr: "226", ejendom: "Duftrankevej 160-206 og 210-268", address: "Duftrankevej 210-268, 5200 Odense V", street: "Duftrankevej", ranges: [{ from: 160, to: 206 }, { from: 210, to: 268 }], aliases: ["Duftrankevej 160-206"] },

  { enhedsnr: "152-105", kundenr: "226", ejendom: "Gartnerbyen 9-19 og 160-206", address: "Gartnerbyen 9-19, 5200 Odense V", street: "Gartnerbyen", ranges: [{ from: 9, to: 19 }, { from: 160, to: 206 }], aliases: ["Gartnerbyen 160-206"] },

  { enhedsnr: "152-106", kundenr: "226", ejendom: "Flegmade 18-50", address: "Flegmade 18-50, 7100 Vejle", street: "Flegmade", from: 18, to: 50 },
  { enhedsnr: "152-107", kundenr: "226", ejendom: "Grøndahlsvej 15", address: "Grøndahlsvej 15, 7400 Herning", street: "Grøndahlsvej", from: 15, to: 15 },
  { enhedsnr: "152-108", kundenr: "226", ejendom: "Blumersgade 4, Horsens", address: "Blumersgade 4, Horsens", street: "Blumersgade", from: 4, to: 4 },
  { enhedsnr: "152-109", kundenr: "230", ejendom: "Randers Kaserne", address: "Kavalerivej 20-24, 8930 Randers NØ", street: "Kavalerivej", from: 20, to: 24, aliases: ["Randers Kaserne"] },

  { enhedsnr: "152-110", kundenr: "226", ejendom: "Sabroesvej 1A-1D", address: "Sabroesvej 1A-1D, 7400 Herning", street: "Sabroesvej", from: 1, to: 1 },
  { enhedsnr: "152-111", kundenr: "226", ejendom: "Sabroesvej 3C-3D", address: "Sabroesvej 3C-3D, 7400 Herning", street: "Sabroesvej", from: 3, to: 3 },
  { enhedsnr: "152-112", kundenr: "226", ejendom: "Sabroesvej 5B", address: "Sabroesvej 5B, 7400 Herning", street: "Sabroesvej", from: 5, to: 5 },
  { enhedsnr: "152-113", kundenr: "226", ejendom: "Emilies Plads 2A-B", address: "Emilies Plads 2A-B, 8700 Horsens", street: "Emilies Plads", from: 2, to: 2 },
  { enhedsnr: "152-114", kundenr: "226", ejendom: "Hillerød Markedsplads", address: "Slangerupgade 5, 3400 Hillerød", street: "Slangerupgade", from: 5, to: 5, aliases: ["Hillerød Markedsplads"] },
  { enhedsnr: "152-115", kundenr: "226", ejendom: "Sanatorievej 46-52", address: "Sanatorievej 46-52, 8600 Silkeborg", street: "Sanatorievej", from: 46, to: 52 },
  { enhedsnr: "152-116", kundenr: "226", ejendom: "Søndre Molevej 6A-G, Engparken", address: "Søndre Molevej 6A-G, 4600 Køge", street: "Søndre Molevej", from: 6, to: 6 },
  { enhedsnr: "152-117", kundenr: "226", ejendom: "Strandpassagen 3A-H, Enggården", address: "Strandpassagen 3A-H, 4600 Køge", street: "Strandpassagen", from: 3, to: 3 },
  { enhedsnr: "152-118", kundenr: "226", ejendom: "Erik Ejegods Vej 1-23, Klippingshusene", address: "Erik Ejegods Vej 1-23, 8800 Viborg", street: "Erik Ejegods Vej", from: 1, to: 23 },
  { enhedsnr: "152-119", kundenr: "230", ejendom: "Fjordbrynet 2", address: "Fjordbrynet 2, 6000 Kolding", street: "Fjordbrynet", from: 2, to: 2 },
  { enhedsnr: "152-120", kundenr: "226", ejendom: "Gartnerbyen 104-116, Seniorboliger", address: "Gartnerbyen 104-116, 5200 Odense V", street: "Gartnerbyen", from: 104, to: 116 },

  { enhedsnr: "152-122", kundenr: "226", ejendom: "C V E Knuths Vej 2 A-F", address: "C V E Knuths Vej 2 A-F, 2900 Hellerup", street: "C V E Knuths Vej", from: 2, to: 2 },
  { enhedsnr: "152-125", kundenr: "226", ejendom: "Vodroffsvej 16", address: "Vodroffsvej 16, 1900 Frederiksberg C", street: "Vodroffsvej", from: 16, to: 16 },
  { enhedsnr: "152-127", kundenr: "226", ejendom: "Oase Husene I", address: "Jens Kofoeds Gade 2-26, 2630 Taastrup", street: "Jens Kofoeds Gade", from: 2, to: 26, aliases: ["Oase Husene I"] },
  { enhedsnr: "152-128", kundenr: "226", ejendom: "Grøndahlsvej 11", address: "Grøndahlsvej 11, 7400 Herning", street: "Grøndahlsvej", from: 11, to: 11 },
  { enhedsnr: "152-131", kundenr: "226", ejendom: "Sluseholmen 1", address: "Sluseholmen 1, 2450 København SV", street: "Sluseholmen", from: 1, to: 1 },
  { enhedsnr: "152-137", kundenr: "226", ejendom: "Oase Husene II", address: "Bornholms Alle 20-22 m.fl., 2630 Taastrup", street: "Bornholms Alle", from: 20, to: 22, aliases: ["Oase Husene II"] },
  { enhedsnr: "152-139", kundenr: "230", ejendom: "Fjordbrynet 4", address: "Fjordbrynet 4, 6000 Kolding", street: "Fjordbrynet", from: 4, to: 4 },

  { enhedsnr: "152-210", kundenr: "230", ejendom: "Nordre Jernbanevej 5-9", address: "Nordre Jernbanevej 5-9, 3400 Hillerød", street: "Nordre Jernbanevej", from: 5, to: 9 },
  { enhedsnr: "152-301", kundenr: "230", ejendom: "Østre Havnegade 22-26", address: "Østre Havnegade 22-26, 9000 Aalborg", street: "Østre Havnegade", from: 22, to: 26 },
  { enhedsnr: "152-302", kundenr: "230", ejendom: "Østre Havnegade 11-13", address: "Østre Havnegade 11-13, 9000 Aalborg", street: "Østre Havnegade", from: 11, to: 13 },
  { enhedsnr: "152-303", kundenr: "230", ejendom: "Stjernepladsen 41-43", address: "Stjernepladsen 41-43, 9000 Aalborg", street: "Stjernepladsen", from: 41, to: 43 },
  { enhedsnr: "152-304", kundenr: "230", ejendom: "Østre Havnegade 16-20, Pakhuset", address: "Østre Havnegade 16-20, 9000 Aalborg", street: "Østre Havnegade", from: 16, to: 20 },

  { enhedsnr: "152-403", kundenr: "228", ejendom: "Skindergade 28", address: "Skindergade 28, 1159 København K", street: "Skindergade", from: 28, to: 28 },
  { enhedsnr: "152-500", kundenr: "231", ejendom: "Nørre Havnegade 47-51", address: "Nørre Havnegade 47-51, 6400 Sønderborg", street: "Nørre Havnegade", from: 47, to: 51 },

  { enhedsnr: "152-601", kundenr: "232", ejendom: "Frejas Vænge 2-22", address: "Frejas Vænge 2-22, 4200 Slagelse", street: "Frejas Vænge", from: 2, to: 22 },
  { enhedsnr: "152-602", kundenr: "232", ejendom: "Frejas Vænge 1-51", address: "Frejas Vænge 1-51, 4200 Slagelse", street: "Frejas Vænge", from: 1, to: 51 },
  { enhedsnr: "152-603", kundenr: "232", ejendom: "Danas Have 6-14", address: "Danas Have 6-14, 4200 Slagelse", street: "Danas Have", from: 6, to: 14 },
  { enhedsnr: "152-604", kundenr: "232", ejendom: "Danas Have 15-73", address: "Danas Have 15-73, 4200 Slagelse", street: "Danas Have", from: 15, to: 73 },

  { enhedsnr: "152-701", kundenr: "233", ejendom: "Bavne Ager 1A-1B, Gilleleje", address: "Bavne Ager 1A-1B, Gilleleje, 3250 Gilleleje", street: "Bavne Ager", from: 1, to: 1 },
  { enhedsnr: "152-702", kundenr: "233", ejendom: "Thea, Mariendalsvej 30", address: "Mariendalsvej 30, 2000 Frederiksberg", street: "Mariendalsvej", from: 30, to: 30, aliases: ["Thea", "Mariendalsvej 30"] },
  { enhedsnr: "152-703", kundenr: "233", ejendom: "Karré 1, Slagelse", address: "Danas Have 1, 4 fl. lm., 4200 Slagelse", street: "Danas Have", from: 1, to: 1, aliases: ["Karré 1 Slagelse"] },
  { enhedsnr: "152-704", kundenr: "233", ejendom: "Karré 3, Slagelse", address: "Danas Have 2-4, 4200 Slagelse", street: "Danas Have", from: 2, to: 4, aliases: ["Karré 3 Slagelse"] },
  { enhedsnr: "152-705", kundenr: "233", ejendom: "Karré 7, Slagelse", address: "Frejas Vænge 24-54, 4200 Slagelse", street: "Frejas Vænge", from: 24, to: 54, aliases: ["Karré 7 Slagelse"] },
  { enhedsnr: "152-706", kundenr: "233", ejendom: "Viby Friplejehjem", address: "Viby Friplejehjem", aliases: ["Viby Friplejehjem"] },
  { enhedsnr: "152-707", kundenr: "233", ejendom: "Lyngbygårdsvej Friplejehjem", address: "Lyngbygårdsvej Friplejehjem", aliases: ["Lyngbygårdsvej Friplejehjem"] }
];

const PFA_PROPERTY_BY_UNIT = Object.fromEntries(
  PFA_PROPERTIES.map(property => [property.enhedsnr, property])
);

// ==================================================
// NORMALISERING
// ==================================================

function normalizePfaText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "oe")
    .replace(/[å]/g, "aa")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—−]/g, "-")
    .replace(/[^a-z0-9-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ==================================================
// FIND ENHEDSNUMMER FRA LEJEMÅLSNUMMER
// ==================================================

function getPfaUnitFromLeaseNumber(value) {
  const text = String(value ?? "")
    .trim()
    .replace(/\s+/g, "");

  if (!text) return "";

  // ÆLDRE FORMAT SKAL TESTES FØRST.
  // 101-152-601 -> 152-101
  // 104-152-210 -> 152-104
  // 702-152-030 -> 152-702
  // Dette forhindrer, at 101-152-601 fejlagtigt bliver 152-601.
  const older = text.match(/^(\d{3})-152-(\d{3})(?:-|$)/i);

  if (older) {
    const unit = `152-${older[1]}`;
    if (PFA_PROPERTY_BY_UNIT[unit]) return unit;
  }

  // NYERE FORMAT.
  // 152-602-70-6 -> 152-602
  // 152-403-11-6 -> 152-403
  // 152-602 -> 152-602
  const newer = text.match(/^152-(\d{3})(?:-|$)/i);

  if (newer) {
    const unit = `152-${newer[1]}`;
    if (PFA_PROPERTY_BY_UNIT[unit]) return unit;
  }

  return "";
}

// ==================================================
// ADRESSEMATCHING
// ==================================================

function containsPfaPhrase(address, phrase) {
  let startAt = 0;

  while (true) {
    const index = address.indexOf(phrase, startAt);
    if (index < 0) return false;

    const beforeIsBoundary =
      index === 0 || address[index - 1] === " ";

    const endIndex = index + phrase.length;

    const afterIsBoundary =
      endIndex === address.length || address[endIndex] === " ";

    if (beforeIsBoundary && afterIsBoundary) return true;

    startAt = index + 1;
  }
}

function pfaAddressLabelMatchesProperty(addressValue, property) {
  const address = normalizePfaText(addressValue);
  if (!address) return false;

  const addressLabel = String(property.address || "").split(",")[0];

  const terms = [
    addressLabel,
    ...(property.aliases || [])
  ]
    .map(normalizePfaText)
    .filter(Boolean);

  return terms.some(term =>
    containsPfaPhrase(address, term)
  );
}

function pfaAddressRangeMatchesProperty(addressValue, property) {
  const address = normalizePfaText(addressValue);

  if (!address || !property.street) return false;

  const street = normalizePfaText(property.street);
  const streetIndex = address.indexOf(street);

  if (streetIndex < 0) return false;

  const tail = address.slice(streetIndex + street.length);

  const match = tail.match(
    /^\s*(\d{1,4})([a-z]{0,2})?(?:\s*-\s*(\d{1,4})([a-z]{0,2})?)?/i
  );

  if (!match) return false;

  const addressFrom = Number(match[1]);
  const addressTo = match[3]
    ? Number(match[3])
    : addressFrom;

  if (
    !Number.isFinite(addressFrom) ||
    !Number.isFinite(addressTo)
  ) {
    return false;
  }

  const ranges = Array.isArray(property.ranges)
    ? property.ranges
    : (
        Number.isFinite(property.from) &&
        Number.isFinite(property.to)
          ? [{
              from: property.from,
              to: property.to
            }]
          : []
      );

  return ranges.some(range =>
    addressFrom <= range.to &&
    addressTo >= range.from
  );
}

// ==================================================
// RESOLVÉR PFA-FELTER
// ==================================================

function resolvePfaFields(kunde, lejemalsnr, adresse) {
  if (normalizePfaText(kunde) !== "pfa") {
    return {
      pfaResolveStatus: "not_pfa",
      pfaMatchMethod: "",
      pfaEnhedsnr: "",
      pfaKundenr: "",
      pfaKunde: "",
      pfaW1F: "",
      pfaEjendom: "",
      pfaCvr: "",
      pfaMatchCandidates: []
    };
  }

  // 1. LEJEMÅLSNUMMER HAR FØRSTEPRIORITET.
  const unitFromLease =
    getPfaUnitFromLeaseNumber(lejemalsnr);

  if (unitFromLease) {
    const property = PFA_PROPERTY_BY_UNIT[unitFromLease];
    const customer = PFA_CUSTOMERS[property.kundenr];

    return {
      pfaResolveStatus: "matched",
      pfaMatchMethod: "lejemalsnr",
      pfaEnhedsnr: property.enhedsnr,
      pfaKundenr: property.kundenr,
      pfaKunde: customer.name,
      pfaW1F: `W1F${property.enhedsnr}`,
      pfaEjendom: property.ejendom,
      pfaCvr: customer.cvr,
      pfaMatchCandidates: [property.enhedsnr]
    };
  }

  // 2. FALDBACK TIL ADRESSEN.
  // Brug først en eksakt adresse-/aliasmatch og dernæst nummerinterval.
  const exactCandidates = PFA_PROPERTIES.filter(property =>
    pfaAddressLabelMatchesProperty(adresse, property)
  );

  const candidates = exactCandidates.length > 0
    ? exactCandidates
    : PFA_PROPERTIES.filter(property =>
        pfaAddressRangeMatchesProperty(adresse, property)
      );

  if (candidates.length === 1) {
    const property = candidates[0];
    const customer = PFA_CUSTOMERS[property.kundenr];

    return {
      pfaResolveStatus: "matched",
      pfaMatchMethod: "adresse",
      pfaEnhedsnr: property.enhedsnr,
      pfaKundenr: property.kundenr,
      pfaKunde: customer.name,
      pfaW1F: `W1F${property.enhedsnr}`,
      pfaEjendom: property.ejendom,
      pfaCvr: customer.cvr,
      pfaMatchCandidates: [property.enhedsnr]
    };
  }

  // 3. GÆT IKKE, HVIS ADRESSEN ER UKENDT ELLER TVETYDIG.
  return {
    pfaResolveStatus: candidates.length > 1
      ? "ambiguous"
      : "not_found",
    pfaMatchMethod: "",
    pfaEnhedsnr: "",
    pfaKundenr: "",
    pfaKunde: "",
    pfaW1F: "",
    pfaEjendom: "",
    pfaCvr: "",
    pfaMatchCandidates: candidates.map(
      property => property.enhedsnr
    )
  };
}

// ==================================================
// EXPORT
// ==================================================

module.exports = {
  resolvePfaFields
};
