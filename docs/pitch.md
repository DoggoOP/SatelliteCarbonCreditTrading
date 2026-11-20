# CarbonSight pitch notes

Sections below are written so they can move into a README or a two-minute script. Market figures are cited. The path to $10M ARR is an illustration, and it is labeled as one. It is not a forecast.

## Problem

A landowner, a class, or a small project developer can draw a forest on a map and still have no defensible number for the carbon in it. The public ingredients exist: Sentinel-2 every few days, GEDI lidar footprints, and IPCC default factors. Using them badly is easy. NDVI saturates in closed canopies. A carbon fraction of 0.47 turns biomass into carbon only after someone has actually estimated biomass. Multiplying that stock by 44/12 produces tonnes of CO2 sitting in the trees, which is not the same thing as a tonne removed this year, and not the same thing as a credit a buyer can retire.

The voluntary market’s 2023 contraction made the cost of a bad number obvious. Buyers pulled back from forestry credits after public challenges to REDD+ baselines (Ecosystem Marketplace, *State of the Voluntary Carbon Markets 2024*). The teams that already sell ratings or MRV data sell to institutions. They do not hand a student or a small landowner a polygon, a source tag, and a refusal when the science is too weak to list.

## Solution

CarbonSight lets someone draw a polygon and returns:

- aboveground biomass from quality-filtered GEDI L4A footprints when those shots exist
- carbon as biomass × **0.47** (IPCC 2006 Table 4.3 default; the 2019 Refinement leaves that table unchanged)
- stock in tCO2e as carbon × **44/12**
- a sequestration *rate* only from the matching IPCC growth row, or null on savanna and desert
- a confidence score that caps itself when the only evidence is a saturated vegetation index
- a marketplace listing explicitly marked as a screening estimate, not a registry credit

The optical fallback is a published Sentinel-2 regression from one community forest in Ilam, Nepal (AGB = −113.602 + 983.414 × NDVI, RMSE 78 t ha⁻¹; KC et al., 2022). It is shown so users can see it fail the desert and overshoot the Amazon. It is not the listed number when lidar shots exist.

## Demo flow, two minutes

1. **Thirty seconds, the zero.** Draw the saltbush mosaic at Edwards Air Force Base (about 34.83° N, 117.92° W). Published shrub biomass is 0.5–1.2 Mg ha⁻¹ including dead wood (Sharifi et al., 2017). The app should land near zero and refuse a forest growth rate. If it reports a forest, stop the demo and say so.
2. **Thirty seconds, the gradient.** Drop a polygon on southern Kruger granite. Woody biomass in the park averages 28 Mg ha⁻¹ and is often under 40 on uplands (Colgan et al., 2012). Then Hubbard Brook, New Hampshire: about 245 Mg ha⁻¹ of live trees, and no significant change over 1995–2006 (van Doorn et al., 2011). The sequestration field should not proudly display the IPCC 4 t ha⁻¹ yr⁻¹ default as if it were that remeasurement.
3. **Forty seconds, the Amazon and the redwoods.** Terra firme near Manaus is about 300 Mg ha⁻¹ (Suwa et al., 2013, 317 Mg ha⁻¹; IPCC 2019 primary-forest default 307). Old-growth coast redwood in Humboldt County is the stress test: research plots hold 1,600–4,300 Mg ha⁻¹, while GEDI across tens of thousands of hectares of primary forest reads nearer 900 and is known to undershoot (Sillett et al., 2020, 2024). A serious build shows a high number, a wide error, and the 0.47 versus ~0.51 carbon-fraction gap. It does not show the same number as Hubbard Brook.
4. **Twenty seconds, the listing.** Open the marketplace row. Read the sentence that this is not a credit. Show the confidence components: shot count, clear Sentinel-2 dates, and the IPCC row name or a null rate.

If the network cannot reach Earthdata on stage, use the five precomputed validation polygons. Say they are cached. Do not swap in hand-typed biomass.

The build on `main` as of `5a40de2` still reads Harmonized Global Biomass for 2010 and a Chloris change layer, not GEDI footprints. For that build, say “2010 HGB stock, Chloris annual change” out loud. If the Manaus biomass number comes back near 150 instead of near 300, stop and check the HGB unit note in `validation.md` before calling it a low-biomass forest.

## Technical depth

The hard part is not the map. It is refusing to treat a stock as a flux, and refusing to treat a vegetation index as biomass.

GEDI L4A predicts aboveground biomass density for ~25 m footprints from relative-height metrics, with a prediction standard error, inside the ISS latitude band (about 51.6° N to 51.6° S). The Version 3 quality flag already requires beam sensitivity of 0.98 in tropical evergreen forest and 0.95 on other land. L4B’s 1 km hybrid estimate needs two tracks in a cell and, in the Version 2 public guide, only represents shots from April 2019 through August 2021. The API stores the product version because those facts change the number.

IPCC 2019 puts primary tropical rainforest in the Americas at a net aboveground biomass change of **1.0 t ha⁻¹ yr⁻¹ with a standard deviation of 2.0**. The uncertainty crosses zero. The same organization’s 2006 temperate-forest default of 4 t ha⁻¹ yr⁻¹ is contradicted at Hubbard Brook, where the measured stock barely moved. Coast redwood plots sit above the IPCC Tier-1 maximum for temperate oceanic North America, and GEDI still comes in low there because trunk mass is not a height percentile. A model that clamps every forest to “a few hundred tonnes” fails the only site where the science is most interesting.

Full write-up: `methodology.md`. Site numbers: `validation.md`.

## Market size

Only figures read from the named reports are used. No third-party “the carbon market will be worth $X by 2030” projection is repeated here, including widely circulated consulting projections, because those primary texts were not re-checked for this file.

**Compliance pricing revenue is not our market.** The World Bank’s *State and Trends of Carbon Pricing 2024* reports that carbon taxes and emissions-trading systems raised **$104 billion** in 2023, that **75** instruments were in operation, and that they covered about **24 percent** of global greenhouse-gas emissions. That $104 billion is government revenue from allowance auctions and taxes. It is not spending on forest MRV software, and it is not CarbonSight’s TAM.

**The closest cited transaction pool is the voluntary carbon market.** Ecosystem Marketplace, *State of the Voluntary Carbon Markets 2024* (covering 2023 trades), reports:

| | 2022 | 2023 |
| --- | --- | --- |
| Voluntary market, volume | 253.8 Mt CO2e | 110.8 Mt CO2e |
| Voluntary market, value | $1.87 billion | $723 million in the summary comparison; $723.5 million in the report’s detailed total |
| Average price | $7.37 / t | $6.53 / t |
| Forestry and land use, volume | 113.0 Mt | 36.2 Mt |
| Forestry and land use, value | $1.1 billion | $351.3 million |
| Forestry and land use, average price | $10.14 / t | $9.72 / t |
| Nature-based segment (their definition: agriculture plus forestry and land use), value | $1.2 billion | $381.5 million |

Source pages are the 2024 SOVCM report distributed by Ecosystem Marketplace (the PDF titled *On the Path to Maturity*, reporting-year 2023). Small differences between $723 million and $723.5 million are the report’s own rounding between the executive comparison and a later total. Use $723.5 million when a single 2023 total is required.

**TAM, stated narrowly.** For a product whose paid action is a subscription plus a fee on forestry credits, the cited upper pool of *credit transaction value* in the relevant category is the 2023 forestry-and-land-use total of **$351.3 million**, inside a voluntary market of **$723.5 million**. Calling the $104 billion compliance-revenue figure a TAM would mix up a tax base with a software market.

**SAM, not invented.** A search for a published “forest MRV SaaS” market size did not produce a figure we are willing to repeat. The arithmetic upper bound on the success-fee design, if one company collected 7–10 percent of *every* 2023 forestry-and-land-use dollar, is **$24.6–$35.1 million** in fee revenue for that year, before subscriptions. That is not an obtainable share. It is 7 and 10 percent of $351.3 million, shown so the ceiling is visible. Forestry transaction value in 2022 was $1.1 billion; the same 7–10 percent arithmetic is $77–$110 million on that larger year. Both years are history, and 2023 is the more conservative base.

**SOM.** No cited source gives CarbonSight a market share. The only share-like numbers in this document are the illustrative ARR scenario in the next section, and they are assumptions.

## Business model

Two streams, both defined by the product rather than by a market study:

1. **Subscriptions, $49–$299 per month.** Self-serve access to polygon estimates, saved provenance, and, on the higher tiers, marketplace listings and a portfolio view. See `architecture.md` for a suggested split across $49, $149, and $299.
2. **Success fee, 7–10 percent,** charged only when a recognized registry issues credits for a project the subscriber originated or monitored in the product. The fee does not apply to the in-app stock figure. The in-app figure is not a credit.

Integrity constraint, because it is also a business constraint: the team that computes the screening number should not be paid as a function of that number. The fee base is the registry issuance. If a registry never issues, subscription revenue is the whole business, and the illustrative path below gets much harder. That is the point of writing it down.

## Path to $10M ARR

**Everything in this section is an illustration. The customer counts, the $149 price, and the fee percentage inside the 7–10 percent range are assumptions chosen to show the arithmetic. They are not traction, not a pipeline, and not a forecast.**

Subscriptions alone, at a constant price, need:

| Assumed price | ARR per customer | Customers for $10M ARR |
| --- | --- | --- |
| $49 / month | $588 | about 17,000 |
| $149 / month | $1,788 | about 5,600 |
| $299 / month | $3,588 | about 2,800 |

A mixed illustration, still hypothetical: **2,000 customers at $149 per month** produce `2000 × 149 × 12 = $3.58 million` of subscription ARR. The other **$6.42 million** would have to come from success fees.

| Assumed fee | Registry-issued credit value the fee requires | Share of 2023 forestry-and-land-use transaction value ($351.3M) |
| --- | --- | --- |
| 7% | $91.8 million | 26% |
| 8% | $80.3 million | 23% |
| 10% | $64.2 million | 18% |

At the 2023 forestry average price of $9.72 per tonne, $64–$92 million of credit value is about **6.6–9.4 million tonnes** of CO2e issued and transacted through the product. The entire forestry-and-land-use category in 2023 was 36.2 million tonnes. So the illustration does not require a new market. It requires a single early product to sit on roughly a fifth to a quarter of a category that just shrank 69 percent in value in one year, while restricting itself to credits a registry will actually issue. That is a large assumption. It is printed in that form so a judge can see the scale instead of a smoothed hockey stick.

The illustration also ignores churn, the lag between a screening listing and a registry issuance, and the chance that buyers will not pay 2023 prices. Adding those would make the required volume larger, not smaller.

A version of the path that does not depend on intermediating a fifth of the market: stay at subscription revenue, keep the refusal behavior, and treat the success fee as upside that is zero until a registry id exists. At $149 per month that version reaches $10M ARR at about 5,600 paying teams. Nothing in the cited market reports says those teams are already looking for this product.

## Team

Berkeley and Stanford hackathon team, entered in the technically complex track and the overall track. The build is split on purpose. Product code is developed on the `kevin` branch. This documentation and the validation set are on `kevin-docs`, limited to `docs/`, so the scientific numbers can be reviewed without colliding with the app.

The software was built with **Grok** as a coding agent: one agent on the application, this pass on the method, the citations, and the five-site check. The split is the point a technical judge can test. The biomass figures in `reference_values.json` are either copied from the named papers or computed from those papers with 0.47 and 44/12, and the file says which is which. Where a paper prints a coordinate that cannot be right (the Manaus PDF) or a total whose unit disagrees with its own density (Kruger, 53.8 Gg versus about 54 Tg), the docs flag it instead of smoothing it over.

## Sources for the market paragraph

- Ecosystem Marketplace (2024). *State of the Voluntary Carbon Markets 2024* (*On the Path to Maturity*), transactions in 2023. Figures used: 2022 value $1.87 billion on 253.8 Mt; 2023 value $723.5 million on 110.8 Mt at $6.53/t; forestry and land use 2023 value $351.3 million on 36.2 Mt at $9.72/t; 2022 forestry value $1.1 billion on 113.0 Mt at $10.14/t; nature-based 2023 value $381.5 million.
- World Bank (2024). *State and Trends of Carbon Pricing 2024*. Carbon pricing revenues of $104 billion in 2023; 75 instruments; coverage of about 24 percent of global emissions. Press summary: https://www.worldbank.org/en/news/press-release/2024/05/21/global-carbon-pricing-revenues-top-a-record-100-billion

Scientific citations for the demo sentences are in `validation.md` and `methodology.md`.
