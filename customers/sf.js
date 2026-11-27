// sf.js
// SF / SF FORE / AEP / Ares address-to-customer mapping for Railway.
// Customer numbers and CVRs are matched from the supplied e-conomic customer export.
// W1F / PFA fields are deliberately not used here.
//
// Usage:
//   const { resolveSfFields } = require("./sf");
//   const result = resolveSfFields("SF Management", "", "Otto Sterns Have 12");
//   // result.sfResolveStatus === "matched"; result.sfKundenr === "156"
//
// If an address could match more than one company, this function returns "ambiguous".
// It never guesses a customer number.

const SF_PROPERTIES = [
  {
    "kunde": "Bjelkes Allé 16 ApS",
    "kundenr": "66",
    "cvr": "37533467",
    "selskab": "Bjelkes Allé 16 ApS",
    "adresse": "Bjelkes Allé 16,",
    "postnr": "2200",
    "by": "København N",
    "kilde": "SF FORE"
  },
  {
    "kunde": "Bjelkes Allé 20 ApS",
    "kundenr": "67",
    "cvr": "36407654",
    "selskab": "Bjelkes Allé 20 ApS",
    "adresse": "Bjelkes Allé 20",
    "postnr": "2200",
    "by": "København N",
    "kilde": "SF FORE"
  },
  {
    "kunde": "CPH Bolig I ApS",
    "kundenr": "19",
    "cvr": "38775723",
    "selskab": "CPH Bolig 1 ApS - Wildersgade 63-65",
    "adresse": "Wildersgade 61-63",
    "postnr": "1408",
    "by": "KBH K",
    "kilde": "SF FORE"
  },
  {
    "kunde": "CPH Bolig I ApS",
    "kundenr": "19",
    "cvr": "38775723",
    "selskab": "CPH Bolig 1 ApS - Ejgårdsvej 10-12",
    "adresse": "Ejgårdsvej 12",
    "postnr": "2920",
    "by": "Charlottenlund",
    "kilde": "SF FORE"
  },
  {
    "kunde": "FORE Brabrand ApS",
    "kundenr": "14",
    "cvr": "41054360",
    "selskab": "FORE Brabrand ApS",
    "adresse": "Brabrand Skovvej",
    "postnr": "8220",
    "by": "Brabrand",
    "kilde": "SF FORE"
  },
  {
    "kunde": "Brendstrupgårdsvej 9D ApS",
    "kundenr": "76",
    "cvr": "37357510",
    "selskab": "Brendstrupgårdsvej 9D ApS",
    "adresse": "Brendstrupgårdsvej 9D",
    "postnr": "8200",
    "by": "Århus N",
    "kilde": "SF FORE"
  },
  {
    "kunde": "FORE Elmehaven ApS",
    "kundenr": "22",
    "cvr": "28894082",
    "selskab": "FORE Elmehaven ApS",
    "adresse": "Elmehaven 30-100",
    "postnr": "5550",
    "by": "Langeskov",
    "kilde": "SF FORE"
  },
  {
    "kunde": "FORE Granskoven ApS",
    "kundenr": "68",
    "cvr": "40337245",
    "selskab": "FORE Granskoven ApS",
    "adresse": "Granskoven 14-22",
    "postnr": "2600",
    "by": "Glostrup",
    "kilde": "SF FORE"
  },
  {
    "kunde": "FORE Granskoven II ApS",
    "kundenr": "59",
    "cvr": "40888683",
    "selskab": "FORE Granskoven II ApS",
    "adresse": "Granskoven 14-22, st.",
    "postnr": "2600",
    "by": "Glostrup",
    "kilde": "SF FORE"
  },
  {
    "kunde": "FORE Kvistgårdhusene ApS",
    "kundenr": "65",
    "cvr": "40300163",
    "selskab": "FORE Kvistgårdhusene ApS",
    "adresse": "Lergravsvej 7-14",
    "postnr": "3490",
    "by": "Kvistgård",
    "kilde": "SF FORE"
  },
  {
    "kunde": "FORE Lindehaven ApS",
    "kundenr": "73",
    "cvr": "42210730",
    "selskab": "FORE Lindehaven ApS",
    "adresse": "Lindehaven 1-28",
    "postnr": "3000",
    "by": "Helsingør",
    "kilde": "SF FORE"
  },
  {
    "kunde": "Ejendomsselskabet Risskov A/S",
    "kundenr": "77",
    "cvr": "37223689",
    "selskab": "Ejendomsselskabet Risskov A/S",
    "adresse": "Borresøvej 45-49",
    "postnr": "8240",
    "by": "Risskov",
    "kilde": "SF FORE"
  },
  {
    "kunde": "FORE Roskilde ApS",
    "kundenr": "69",
    "cvr": "41358289",
    "selskab": "FORE Roskilde ApS",
    "adresse": "Eriksvej 44",
    "postnr": "4000",
    "by": "Roskilde",
    "kilde": "SF FORE"
  },
  {
    "kunde": "FORE Skan ApS",
    "kundenr": "9",
    "cvr": "28669518",
    "selskab": "FORE Skan ApS",
    "adresse": "Dronningens Vænge 2 m.fl. / Amerika Plads 24 m.fl.",
    "postnr": "2800/2100",
    "by": "",
    "kilde": "SF FORE"
  },
  {
    "kunde": "FORE Århus I ApS",
    "kundenr": "57",
    "cvr": "39981653",
    "selskab": "FORE Århus I ApS",
    "adresse": "Lystrupvej 29-33, Brassøvej 1-9",
    "postnr": "8240",
    "by": "Risskov",
    "kilde": "SF FORE"
  },
  {
    "kunde": "Jagtvej 64 ApS",
    "kundenr": "79",
    "cvr": "37520306",
    "selskab": "Jagtvej 64 ApS",
    "adresse": "Jagtvej 64",
    "postnr": "2200",
    "by": "København N",
    "kilde": "SF FORE"
  },
  {
    "kunde": "Kærskifte Holding ApS",
    "kundenr": "104",
    "cvr": "28486332",
    "selskab": "Kærskifte Holding ApS",
    "adresse": "Kærskiftevej 23 m.fl",
    "postnr": "2500",
    "by": "Valby",
    "kilde": "SF FORE"
  },
  {
    "kunde": "Teglgårdshave ApS",
    "kundenr": "80",
    "cvr": "38358928",
    "selskab": "Teglgårdshave ApS",
    "adresse": "Teglgårdshave 1-18",
    "postnr": "3460",
    "by": "Birkerød",
    "kilde": "SF FORE"
  },
  {
    "kunde": "Ejendomsselskabet Havkær, Tilst ApS",
    "kundenr": "8",
    "cvr": "38990462",
    "selskab": "Ejendomsselskabet Havkær Tilst ApS",
    "adresse": "Pollenvænget 27-37",
    "postnr": "8381",
    "by": "Tilst",
    "kilde": "SF FORE"
  },
  {
    "kunde": "Bolig+ København I ApS",
    "kundenr": "75",
    "cvr": "37679976",
    "selskab": "Bolig+ København I ApS",
    "adresse": "Skibsager 4A",
    "postnr": "2680",
    "by": "Solrød Strand",
    "kilde": "AEP"
  },
  {
    "kunde": "Bolig+ ÅRHUS I ApS",
    "kundenr": "72",
    "cvr": "38134116",
    "selskab": "Bolig+ Århus I ApS",
    "adresse": "Brassøvej 2-6 og Borresøvej 3-5",
    "postnr": "8240",
    "by": "Risskov",
    "kilde": "AEP"
  },
  {
    "kunde": "Bolig+ København II ApS",
    "kundenr": "64",
    "cvr": "39564793",
    "selskab": "Bolig+ København II ApS",
    "adresse": "Ramblaen 1-3",
    "postnr": "3400",
    "by": "Hillerød",
    "kilde": "AEP"
  },
  {
    "kunde": "SØNDRE FASANVEJ 90 ApS",
    "kundenr": "58",
    "cvr": "36450703",
    "selskab": "Bolig+ København III",
    "adresse": "Søndre Fasanvej 90",
    "postnr": "2500",
    "by": "Valby",
    "kilde": "AEP"
  },
  {
    "kunde": "Bolig+ København IV ApS",
    "kundenr": "74",
    "cvr": "41516054",
    "selskab": "Bolig+ København IV ApS",
    "adresse": "Lindehaven 19-39 & 30-56",
    "postnr": "3000",
    "by": "Helsingør",
    "kilde": "AEP"
  },
  {
    "kunde": "Bolig+ Kolding I ApS",
    "kundenr": "185",
    "cvr": "41928875",
    "selskab": "Bolig+ Kolding I ApS",
    "adresse": "Farøvej 10-12",
    "postnr": "6000",
    "by": "Kolding",
    "kilde": "AEP"
  },
  {
    "kunde": "Bolig+ Kolding II ApS",
    "kundenr": "176",
    "cvr": "41928913",
    "selskab": "Bolig+ Kolding II ApS",
    "adresse": "Langøvej 10 og 12 og Samsøvej 2,4, 8, 10 og 12",
    "postnr": "6000",
    "by": "Kolding",
    "kilde": "AEP"
  },
  {
    "kunde": "Bolig+ Odense I ApS",
    "kundenr": "5",
    "cvr": "42449725",
    "selskab": "Bolig+ Odense I ApS",
    "adresse": "Gartnerbyen (overtages i Q3 2022)",
    "postnr": "5200",
    "by": "Odense",
    "kilde": "AEP"
  },
  {
    "kunde": "Bolig+ Aalborg I ApS",
    "kundenr": "11",
    "cvr": "38814095",
    "selskab": "Bolig+ Aalborg I ApS",
    "adresse": "Tornhøjvej 4",
    "postnr": "9220",
    "by": "Aalborg Øst",
    "kilde": "AEP"
  },
  {
    "kunde": "Tinderbox PropCo I ApS",
    "kundenr": "81",
    "cvr": "42622109",
    "selskab": "Tinderbox Propco I ApS",
    "adresse": "Telegrafvej 4",
    "postnr": "2750",
    "by": "Ballerup",
    "kilde": "Ares"
  },
  {
    "kunde": "Tinderbox PropCo II ApS",
    "kundenr": "28",
    "cvr": "42622001",
    "selskab": "Tinderbox Propco II ApS",
    "adresse": "Telegrafvej 6",
    "postnr": "2750",
    "by": "Ballerup",
    "kilde": "Ares"
  },
  {
    "kunde": "Orange 7 ApS",
    "kundenr": "70",
    "cvr": "39212005",
    "selskab": "Orange 7 ApS",
    "adresse": "Garnisonsvej 51-61",
    "postnr": "",
    "by": "Farum",
    "kilde": "Ares"
  },
  {
    "kunde": "Orange 8 ApS",
    "kundenr": "71",
    "cvr": "39212021",
    "selskab": "Orange 8 ApS",
    "adresse": "Garnisonsvej 47-49",
    "postnr": "",
    "by": "Farum",
    "kilde": "Ares"
  },
  {
    "kunde": "FORE Senior I ApS",
    "kundenr": "177",
    "cvr": "41445556",
    "selskab": "FORE Senior I ApS",
    "adresse": "Hammerum Hovedgade 1 / Ny Gjellerupvej 4",
    "postnr": "7400",
    "by": "Herning",
    "kilde": "Brugeroplysninger"
  },
  {
    "kunde": "FORE Lind ApS",
    "kundenr": "181",
    "cvr": "42532614",
    "selskab": "FORE Lind ApS",
    "adresse": "Vesterdamsvænget 1 A-D, 3 A-H, 5 A-D, 7 A-D og 9 A-D",
    "postnr": "7400",
    "by": "Herning",
    "kilde": "Brugeroplysninger"
  },
  {
    "kunde": "GGNTM PropCo 1 ApS",
    "kundenr": "156",
    "cvr": "44376598",
    "selskab": "GGNTM PropCo 1 ApS",
    "adresse": "Otto Sterns Have 1-4",
    "postnr": "",
    "by": "Aalborg",
    "kilde": "SF Management",
    "matchStreetOnly": true
  },
  {
    "kunde": "GGNTM PropCo 2 ApS",
    "kundenr": "170",
    "cvr": "44376679",
    "selskab": "GGNTM PropCo 2 ApS",
    "adresse": "Max Plancks Have 1-2",
    "postnr": "",
    "by": "Aalborg",
    "kilde": "SF Management",
    "matchStreetOnly": true
  },
  {
    "kunde": "GGNTM PropCo 3 ApS",
    "kundenr": "171",
    "cvr": "44376717",
    "selskab": "GGNTM PropCo 3 ApS",
    "adresse": "John Steinbecks Allé 104-188",
    "postnr": "",
    "by": "Aalborg",
    "kilde": "SF Management"
  },
  {
    "kunde": "GGNTM PropCo 4 ApS",
    "kundenr": "172",
    "cvr": "43399969",
    "selskab": "GGNTM PropCo 4 ApS",
    "adresse": "John Steinbecks Allé 10-102",
    "postnr": "",
    "by": "Aalborg",
    "kilde": "SF Management"
  }
];

function normalizeSfText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " og ")
    .replace(/[.,]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseHouseNumberRange(address) {
  const match = String(address ?? "").match(/(\d+)\s*[-–]\s*(\d+)/);
  return match ? { from: Number(match[1]), to: Number(match[2]) } : null;
}

function extractStreetAndNumber(address) {
  const normalized = normalizeSfText(address);
  // Street + first number; supports addresses with apartment/floor details after the number.
  const match = normalized.match(/^(.+?)\s+(\d+)([a-z]*)\b/);
  if (!match) return null;
  return { street: match[1].trim(), number: Number(match[2]) };
}

function addressMatchesProperty(inputAddress, property) {
  const input = normalizeSfText(inputAddress);
  const label = normalizeSfText(property.adresse);
  if (!input || !label) return false;

  // Exact normalized address/label match first.
  if (input === label || input.startsWith(label + " ") || label.startsWith(input + " ")) {
    return true;
  }

  const inputParts = extractStreetAndNumber(inputAddress);
  const propertyParts = extractStreetAndNumber(property.adresse);
  if (!inputParts || !propertyParts || inputParts.street !== propertyParts.street) {
    return false;
  }

  // These two known SF Management mappings cover the whole named street,
  // not only the literal house-number range in the source label.
  if (property.matchStreetOnly === true) return true;

  const range = parseHouseNumberRange(property.adresse);
  if (range) return inputParts.number >= range.from && inputParts.number <= range.to;

  // Single-number property labels are exact on the street number.
  return inputParts.number === propertyParts.number;
}


 // Explicit address rules reviewed against Monday.
 const REVIEW_RULES = [
 ["gartnerbyen",91,"GADM K/S",24,24],
 ["gartnerbyen",157,"GADM II K/S",53,53],
 ["gartnerbyen",5,"Bolig+ Odense I ApS",57,57],
 ["gartnerbyen",5,"Bolig+ Odense I ApS",59,59,null,false,"7-241"],
 ["gartnerbyen",5,"Bolig+ Odense I ApS",61,61],
 ["gartnerbyen",142,"Bolig+ Odense II ApS",60,60],
 ["gartnerbyen",141,"FORE Odense I ApS",70,72],
 ["gartnerbyen",142,"Bolig+ Odense II ApS",80,86],
 ["borresoevej",72,"Bolig+ Århus I ApS",3,5],
 ["borresoevej",77,"Ejendomsselskabet Risskov A/S",45,49],
 ["brassoevej",57,"FORE Århus I ApS",1,9,"odd"],
 ["brassoevej",72,"Bolig+ Århus I ApS",2,6,"even"],
 ["asgaardsvej",188,"Thors Have A ApS",32,44],
 ["asgaardsvej",189,"Thors Have B ApS",21,31],
 ["asgaardsvej",189,"Thors Have B ApS",45,53],
 ["asgaardsvej",193,"Thors Have G ApS",1,13],
 ["midgaardsvej",190,"Thors Have C ApS",42,50],
 ["midgaardsvej",191,"Thors Have D ApS",30,40],
 ["midgaardsvej",192,"Thors Have F ApS",2,12],
 ["midgaardsvej",193,"Thors Have G ApS",16,24],
 ["theklavej",199,"Ejendomsselskabet Theklavej 33-37 ApS"],
 ["amtmandshave",183,"FORE Amtmandshave ApS"],
 ["soelleroedgade",128,"FORE Søllerødgade K/S"],
 ["eriksvej",69,"FORE Roskilde ApS"],
 ["langoevej",176,"Bolig+ Kolding II ApS"],
 ["samsoevej",176,"Bolig+ Kolding II ApS"],
 ["skibsager",75,"Bolig+ København I ApS"],
 ["vesterdamsvaenget",181,"FORE Lind ApS"],
 ["ny gjellerupvej",177,"FORE Senior I ApS"],
 ["hammerum hovedgade",177,"FORE Senior I ApS"],
 ["frederikssundsvej",184,"SFM Bolig+ København ApS",98,100,null,false],
 ["rugaardsparken",152,"SFM Bolig+ Ry ApS",null,null,null,false],
 ["kastanjebakken",229,"SFM Bolig+ Næstved ApS",14,14,null,false],
 ["gartnertorvet",157,"GADM II K/S"],
 ["lindehaven",73,"FORE Lindehaven ApS",1,18],
 ["lindehaven",74,"Bolig+ København IV ApS",29,56],
 ["granskoven",59,"FORE Granskoven II ApS",14,22,"ground"],
 ["granskoven",68,"FORE Granskoven ApS",14,22,"upper"],
 ["john steinbecks alle",171,"GGNTM PropCo 3 ApS",104,188],
 ["john steinbecks alle",172,"GGNTM PropCo 4 ApS",10,102],
 ["raevegade",null,"Rævegade-Strandgade Invest ApS",6,9],
 ["telegrafvej",81,"Tinderbox PropCo I ApS",4,4],
 ["telegrafvej",28,"Tinderbox PropCo II ApS",6,6],
 ["telegrafvej",null,"Tinderbox PropCo III ApS",8,10]
 ];
 function sfCanonical(s) {
   return String(s ?? "").toLowerCase().replace(/æ/g,"ae").replace(/ø/g,"oe").replace(/å/g,"aa").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
 }
 function reviewedMatch(address, lejemalsnr) {
   const a=sfCanonical(address);
   const p=a.match(/^(.+?)\s+(\d+)([a-z]*)\b/);
   if (!p) {
     if (/^(gartnerbyen|gartnertorvet)\b/.test(a)) return {status:"needs_review", candidates:[]};
     return null;
   }
   const street=p[1], n=Number(p[2]);
   const rows=REVIEW_RULES.filter(r=>r[0]===street);
   if (!rows.length) return null;
   const ground=/(?:^|[\s,])st\.(?:\s|,|$)/i.test(address);
   const upper=/(?:,\s*|\s)[1-9]\d*\.(?:\s|,|$)/.test(address);
   const matches=rows.filter(r=>(r[3]==null||n>=r[3])&&(r[4]==null||n<=r[4])&&(!r[5]||r[5]==="odd"&&n%2===1||r[5]==="even"&&n%2===0||r[5]==="ground"&&ground||r[5]==="upper"&&upper));
   if(matches.length!==1) return {status:"ambiguous", candidates:rows.map(r=>({kundenr:String(r[1]??""),kunde:r[2]}))};
   const r=matches[0], old=SF_PROPERTIES.find(x=>x.kundenr===String(r[1]));
   const requiredPrefix = r[7];
   const rentalNumber = String(lejemalsnr ?? "").trim().replace(/[–—]/g, "-");
   const prefixMatches = requiredPrefix == null || rentalNumber === requiredPrefix || rentalNumber.startsWith(requiredPrefix + "-");
   if(r[6]||!r[1]||!prefixMatches) return {status:"needs_review",candidates:[{kundenr:String(r[1]??""),kunde:r[2]}]};
   return {status:"matched",property:{...old,kundenr:String(r[1]),kunde:r[2],selskab:r[2],cvr:old?.cvr||""}};
 }

function resolveSfFields(kunde, lejemalsnr, adresse) {
  const normalizedCustomer = normalizeSfText(kunde);
  const isSf =
    normalizedCustomer === "sf" ||
    normalizedCustomer.includes("sf management") ||
    normalizedCustomer.includes("sf managment") ||
    normalizedCustomer.includes("sf fore") ||
    normalizedCustomer === "aep" ||
    normalizedCustomer === "ares";

  if (!isSf) {
    return {
      sfResolveStatus: "not_sf",
      sfMatchMethod: "",
      sfKundenr: "",
      sfKunde: "",
      sfCvr: "",
      sfSelskab: "",
      sfMatchCandidates: []
    };
  }

  const review = reviewedMatch(adresse, lejemalsnr);
  if (review && review.status !== "matched") return {
    sfResolveStatus: review.status, sfMatchMethod:"", sfKundenr:"", sfKunde:"", sfCvr:"", sfSelskab:"", sfMatchCandidates:review.candidates
  };
  const candidates = review ? [review.property] : SF_PROPERTIES.filter(property =>
    addressMatchesProperty(adresse, property)
  );

  // Deduplicate rows that happen to point at the same e-conomic customer.
  const unique = [...new Map(candidates.map(p => [p.kundenr, p])).values()];

  if (unique.length === 1) {
    const property = unique[0];
    return {
      sfResolveStatus: "matched",
      sfMatchMethod: "adresse",
      sfKundenr: property.kundenr,
      sfKunde: property.kunde,
      sfCvr: property.cvr,
      sfSelskab: property.selskab,
      sfMatchCandidates: [property.kundenr]
    };
  }

  return {
    sfResolveStatus: unique.length > 1 ? "ambiguous" : "not_found",
    sfMatchMethod: "",
    sfKundenr: "",
    sfKunde: "",
    sfCvr: "",
    sfSelskab: "",
    sfMatchCandidates: unique.map(p => ({
      kundenr: p.kundenr,
      kunde: p.kunde,
      selskab: p.selskab,
      adresse: p.adresse
    }))
  };
}

module.exports = {
  resolveSfFields,
  normalizeSfText,
  SF_PROPERTIES
};
