# CarbonSight documentation

Scientific method, validation ranges, system design, and pitch notes for the Berkeley × Stanford hackathon build. These files are the documentation set only. Application code is developed separately.

| File | What it is |
| --- | --- |
| [methodology.md](methodology.md) | How a drawn polygon becomes aboveground biomass, carbon, tCO2e, a sequestration *rate*, and a confidence score. Every factor is cited. |
| [validation.md](validation.md) | How to sanity-check the app against published sites. |
| [reference_values.json](reference_values.json) | The same sites in a form the app can load. Derived carbon numbers are labeled as arithmetic, not as new measurements. |
| [architecture.md](architecture.md) | Data flow, technical choices, pricing, competitors, and what is actually defensible. |
| [pitch.md](pitch.md) | README-ready problem, demo, market, and an illustrative path to $10M ARR. |

## Read this before quoting a number

CarbonSight estimates **aboveground biomass stock**. It does not issue a carbon credit. A hectare of old forest can hold hundreds of tonnes of CO2-equivalent carbon and still be sequestering almost nothing this year. The marketplace copy has to say that.

Figures were checked against the cited IPCC PDFs, ORNL DAAC product guides, and the papers named in each file, in November 2026. Where a PDF text extraction was ambiguous, or a paper prints a coordinate that cannot be right, the text says so. Do not tighten those ranges to look more precise.
