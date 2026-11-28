# Istandsættelseskladder

Railway læser syn med status **Klar til istandsættelseskladde** hvert femte minut og samler dem pr. verificeret håndværkerkundenummer. Prisen og et eventuelt mængdeafslag kommer fra kundens fakturalinjeskabelon for vare 109. Når e-conomic bekræfter kladden og PDF-bilaget, opdaterer Railway istandsættelsesstatus og kladdenummeret i Monday.

## Konfiguration i Railway

Workerens opstart kræver `RENOVATION_ENABLED=true` og gyldig konfiguration. Opbevar kundekort, board-ID'er og nøgler i miljøvariabler.

| Variabel | Værdi |
| --- | --- |
| `RENOVATION_MONDAY_CONFIG` | JSON med `board` som en liste med ét board-ID og `fields` med kolonnerne `status`, `draft`, `contractor`, `address`, `lease`, `type` og `date` |
| `RENOVATION_CONTRACTORS` | JSON med præcise Monday-håndværkerlabels som nøgler og objekter med `number` og `name` fra de verificerede e-conomic-kundekort |
| `RENOVATION_ECONOMIC_APP_TOKEN` | e-conomic-applikationsnøgle |
| `RENOVATION_ECONOMIC_GRANT_TOKEN` | e-conomic-aftalenøgle |
| `RENOVATION_PDFCO_API_KEY` | PDF.co-nøgle |

En ukendt håndværker markeres **Kræver kontrol** og kan vælges igen efter rettelse. Ved et usikkert svar på kladdeoprettelse forsøger worker at genfinde kladden ud fra den unikke batchreference. Hvis den ikke kan bekræftes, beholdes journalen til manuel afstemning. Opslag, bilagsgenerering og Monday-tilbageskrivning bruger batchens eksisterende kladdenummer på genforsøg.

Validér først én markeret række, den relevante varelinje, det vedhæftede PDF og tilbageskrivningen i Monday. Kør de lokale kontroller med `node --test renovation/worker.test.js`.
