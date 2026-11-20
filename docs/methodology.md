# CarbonSight methodology

This is the scientific method the analysis API should implement. It is a **screening estimate** of aboveground woody biomass and the carbon in that biomass. It is not a registry issuance, not a soil-carbon inventory, and not a measurement of additionality.

The product formulas requested for the hackathon are:

```text
carbon (t C / ha)     = AGB (t dry matter / ha) × 0.47
stock (t CO2e / ha)   = carbon × (44 / 12)
```

Sequestration is a **rate**, not that stock. See [Sequestration](#sequestration-is-a-rate).

## 1. What is being estimated

Aboveground biomass (AGB) here means oven-dry mass of live vegetation above the soil surface, expressed as megagrams per hectare (Mg ha⁻¹). One megagram equals one metric tonne, so Mg ha⁻¹ and t ha⁻¹ are the same unit. CarbonSight reports:

| Quantity | Meaning | Unit |
| --- | --- | --- |
| AGB | Dry aboveground biomass density | Mg ha⁻¹ |
| Carbon | Carbon in that aboveground biomass | t C ha⁻¹ |
| Stock tCO2e | That carbon expressed as CO2 mass | t CO2e ha⁻¹ |
| Sequestration | Expected *net* change in aboveground biomass carbon | t CO2e ha⁻¹ yr⁻¹ |
| Confidence | A transparent penalty score for using the estimate in a listing | 0–100 |

Belowground biomass is **not** inside the headline carbon number. Roots can be attached later with a root-to-shoot ratio, in a separate field, so the two pools are never silently added.

Dead wood, litter, and soil organic carbon are out of scope. IPCC guidance treats them as separate pools (2006 Guidelines, Volume 4, Chapter 4). Leaving them out makes the stock a lower bound on ecosystem carbon, not a full AFOLU inventory.

## 2. Carbon fraction, 0.47

IPCC 2006, Volume 4, Chapter 4, Table 4.3, gives a default carbon fraction of dry matter of **0.47 t C (t dry matter)⁻¹** for all tree parts. The table cites McGroddy et al. (2004) for that default. The 2019 Refinement says Table 4.3 has **no refinement**, so 0.47 remains the Tier-1 default.

Table 4.3 also publishes narrower values. Use them only when the biome and the part of the tree are both known. Do not average them into a new global constant.

| Domain | Part | CF, t C (t d.m.)⁻¹ | As printed in Table 4.3 |
| --- | --- | --- | --- |
| Default | All | 0.47 | McGroddy et al., 2004 |
| Tropical and subtropical | All | 0.47 (0.44–0.49) | several sources, including McGroddy et al., 2004 |
| Tropical and subtropical | Wood | 0.49 | Feldpausch et al., 2004 |
| Tropical and subtropical | Wood, diameter &lt; 10 cm | 0.46 | Hughes et al., 2000 |
| Tropical and subtropical | Wood, diameter ≥ 10 cm | 0.49 | Hughes et al., 2000 |
| Tropical and subtropical | Foliage | 0.47 | Feldpausch et al., 2004 |
| Tropical and subtropical | Foliage, diameter &lt; 10 cm | 0.43 | Hughes et al., 2000 |
| Tropical and subtropical | Foliage, diameter ≥ 10 cm | 0.46 | Hughes et al., 2000 |
| Temperate and boreal | All | 0.47 (0.47–0.49) | several sources |
| Temperate and boreal | Broadleaved | 0.48 (0.46–0.50) | Lamlom and Savidge, 2003 |
| Temperate and boreal | Conifers | 0.51 (0.47–0.55) | Lamlom and Savidge, 2003 |

Source: IPCC 2006, Vol. 4, Ch. 4, Table 4.3, pp. 4.48 in the chapter PDF (https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/4_Volume4/V4_04_Ch4_Forest_Land.pdf). The 2019 statement that Table 4.3 is not refined is in the 2019 forest-land chapter, section 4.5 (https://www.ipcc-nggip.iges.or.jp/public/2019rf/pdf/4_Volume4/19R_V4_Ch04_Forest%20Land.pdf).

**Headline product number.** CarbonSight multiplies AGB by **0.47**, because that is the default the product spec asked for and the value Table 4.3 tells Tier-1 users to apply when the part of the tree is unknown.

**Where 0.47 is the wrong local fraction.** Sillett et al. (2020) report coast-redwood plot biomass of 1,594–4,341 Mg ha⁻¹ and carbon of 805–2,201 Mg C ha⁻¹. Those pairs imply a fraction of about 0.505–0.507, inside the IPCC conifer range 0.47–0.55 and above the 0.47 default. Applying 0.47 to those plots understates carbon by roughly 7 percent. The API should keep 0.47 as the displayed default and, for temperate conifer polygons, also show the Table 4.3 conifer value 0.51 so a reviewer can see the sensitivity. Do not silently switch factors without labeling the run.

Grassland Chapter 6 of the 2006 Guidelines uses 0.47 for herbaceous biomass as well (cited from the UNFCCC compilation of default fractions). Woody stems in a savanna are not herbaceous biomass. CarbonSight applies 0.47 to the woody AGB it estimated and does not claim the grass layer.

## 3. From carbon to tCO2e

Inventories convert carbon mass to carbon-dioxide mass with the ratio of molecular weights, **44/12**. Carbon is 12, CO2 is 44, so 1 tonne of carbon corresponds to 44/12 = 3.666… tonnes of CO2. This is stoichiometry, not a forest measurement. A more precise atomic-weight ratio (about 44.01/12.011) is not what IPCC inventories use; they use 44/12. CarbonSight uses 44/12.

```text
t CO2e / ha = AGB (Mg / ha) × CF × (44 / 12)
```

With the default CF this is AGB × 1.72333…. Example, using only the default factor: 100 Mg ha⁻¹ of AGB is 47 t C ha⁻¹ and 172.3 t CO2e ha⁻¹ of **stock**.

That stock is the carbon sitting in the trees. It is not the number of credits the hectare produced this year. Selling the stock as an annual credit would count decades of past growth as if it happened this year.

## 4. Biomass: GEDI first, NDVI only as a labeled fallback

Optical greenness and lidar structure answer different questions. GEDI was built to estimate aboveground biomass. NDVI saturates in closed canopies and is a poor biomass sensor there. The L4A algorithm basis document states that lidar biomass estimates consistently outperform other remote-sensing approaches, citing Saatchi et al. (2011) and Zolkos et al. (2013). CarbonSight therefore ranks sources:

1. Quality-filtered GEDI L4A footprints inside the polygon, if there are enough of them.
2. GEDI L4B 1 km cell means, only as context when the polygon is large relative to 1 km.
3. A published NDVI regression, **only** with a hard confidence cap and an on-screen warning that the coefficients are not transferable.
4. An IPCC Tier-1 stock prior (Table 4.7), never as the reported measurement. It is a plausibility check.

### 4.1 Sentinel-2 NDVI

NDVI is

```text
NDVI = (NIR − Red) / (NIR + Red)
```

On Sentinel-2 L2A surface reflectance, Red is band B4 and NIR is band B8, both 10 m. Use a cloud-masked, growing-season composite (median of clear observations), not a single scene. The scene classification layer (SCL) should drop cloud, shadow, and snow. A polygon whose clear-observation count is under three in the chosen window is a low-quality optical input even before biomass is computed.

NDVI is unitless and typically falls between about −0.1 (bare soil, water) and about 0.9 (dense green canopy). In closed tropical forest it piles up near the top of that range, so a large change in biomass produces almost no change in NDVI.

### 4.2 The NDVI regression we will actually code, and why it must not travel

The regression with coefficients we can point at, for Sentinel-2 specifically, is KC, Bhattarai, and Pandey, *Forestry: Journal of the Institute of Forestry, Nepal*, issue 19 (2022), DOI 10.3126/forestry.v18i01.41749.

They inventoried 30 circular plots of 500 m² (trees with diameter at breast height ≥ 10 cm) in the Salbote Karele community forest, Mai Municipality, Ilam, Nepal (the district spans roughly 26°40′–27°08′ N, 87°40′–88°10′ E; the forest itself is 283.56 ha in the southern Churia). Field AGB used the Chave et al. (2014) pantropical model

```text
AGB = 0.0673 × (ρ D² H)^0.976
```

with wood density ρ, diameter D, and height H, then carbon = AGB × 0.47. Field means were **156.48 t ha⁻¹** AGB and **73.55 t C ha⁻¹**. (156.48 × 0.47 = 73.55, so the carbon figure is the IPCC default applied to their field biomass, not an independent chemical assay.)

Their Sentinel-2 NDVI model, fit on 70 percent of the plots:

```text
AGB (t ha⁻¹) = −113.602 + 983.414 × NDVI
```

R² = 0.733, p &lt; 0.0001. On the held-out comparison they report R² = 0.76 and RMSE = **78.44 t ha⁻¹**. That RMSE is half of the mean biomass. The Landsat-8 NDVI model in the same paper is AGB = −355.66 + 1,201.711 × NDVI (R² = 0.690). Mapped Sentinel-2 predictions in their forest ran from 0 to 402 t ha⁻¹, with a mean of 129.82 t ha⁻¹.

**Transfer is not valid.** The intercept and slope were fit in one moderately dense South Asian community forest. At NDVI = 0.85, which is ordinary for closed Amazon canopy, the Sentinel-2 equation returns −113.602 + 983.414 × 0.85 = **722 t ha⁻¹**, far above both their mapped range and a typical central-Amazon plot mean near 300 Mg ha⁻¹ (section 6 and the validation set). At NDVI = 0.15, a sparse desert shrub signal, it returns **34 t ha⁻¹**, an order of magnitude above the Mojave saltbush figures in the validation set. RMSE of 78 t ha⁻¹ also means the equation cannot support a credit calculation even inside Ilam.

CarbonSight may compute this number so the demo can show an optical fallback. The UI must label it `ndvi_fallback_ilam_2022`, show the RMSE, and cap confidence as specified in [section 8](#8-confidence-score). It must not be the value written into a marketplace listing if any quality-filtered GEDI footprints exist.

Chave et al. (2014), *Global Change Biology* 20: 3177–3190, DOI 10.1111/gcb.12629, is the field allometry above. CarbonSight does not run Chave unless a user supplies plot diameters, heights, and wood density. Satellite NDVI does not provide those inputs.

### 4.3 GEDI L4A (footprints)

The Global Ecosystem Dynamics Investigation is a lidar on the International Space Station. The instrument uses three lasers to form eight ground tracks. Each footprint is about 25 m across, spaced about 60 m along track. Tracks are about 600 m apart, so a swath is about 4.2 km wide. Coverage is the ISS latitude band, nominally **51.6° N to 51.6° S**. All five validation sites in `reference_values.json` sit inside that band. Forests north of about 52° N, including much of the boreal zone, have no GEDI shots.

L4A (product GEDI04_A) predicts aboveground biomass density (AGBD, Mg ha⁻¹) and a prediction standard error for each geolocated footprint. The ORNL DAAC Version 3 user guide (documentation revision dated 2026-09-02) states that predictions come from parametric models relating simulated L2A relative-height metrics to field AGBD, stratified by plant functional type and world region. The L4A ATBD (v1.0, dated November 2022 on the GEDI documents page) describes 13 linear models across 32 plant-functional-type × region strata, trained on 8,587 quality-filtered simulated waveforms from 21 countries. The same ATBD is explicit that continental Asia, dry-tropical deciduous forests and savannas, and evergreen broadleaf forests north of Australia are underrepresented. Model form is a linear function of relative-height metrics, often on a transformed scale, with a back-transformation correction. **Consume the product’s AGBD and standard error. Do not refit the models in the hackathon API.**

Version 3 guide points that matter for the API:

- Acquisitions start 2019-04-04. The instrument was stored on the ISS from March 2023 to April 2024, so that interval is empty.
- `l4_quality_flag` (named `l4_quality_flag_rel3` in the Version 3 guide) marks shots that can be treated as samples of the population the model represents. Leaf-off shots are not valid for strata calibrated on leaf-on waveforms.
- That flag already embeds a beam-sensitivity threshold of **0.98** over tropical evergreen forest, **0.95** over other land surfaces, and **0.5** over water. Sensitivity is the maximum canopy cover the waveform can penetrate given its signal-to-noise ratio. For a local study a user may relax it; CarbonSight should not, except to report how many shots the default flag discarded.
- Also apply `elev_highestreturn_outlier_flag` (fog and low cloud) and use `degrade_include_flag` together with that outlier flag before gridding or fusing, as the Version 3 guide recommends.

Polygon AGB from L4A is the mean of quality-filtered footprint AGBD values whose ground locations fall inside the polygon. Shots are a sample, not a wall-to-wall map. A 10 ha polygon can easily contain zero shots or a single track. Report the shot count, the mean, and the standard error of that mean. A crude sampling term is `sd / sqrt(n)` only when shots are treated as independent, which they are not (they are clustered along tracks). Prefer the L4B hybrid variance when the polygon covers whole 1 km cells. For a small polygon, publish `n` and the mean of the footprint-level prediction standard errors, and say the polygon standard error is **understated** if track clustering is ignored.

### 4.4 GEDI L4B (1 km grid)

L4B aggregates L4A samples to a 1 km grid. The L4B ATBD v1.0 (Healey, Patterson, and Armston; release date 23 February 2022) uses hybrid inference: the variance includes both L4A model error and the error from GEDI’s incomplete sample of the cell. Hybrid variance needs at least two ground tracks in the cell. Cells that never get two tracks are outside that estimator; the ATBD says those cells are filled later with generalized hierarchical model-based inference using a wall-to-wall covariate, which is a different statistical object. Do not mix the two and call both “lidar measurements.”

The Version 2 L4B user guide on ORNL covers mission weeks 19 through 138 only (**2019-04-18 to 2021-08-04**). That is not “GEDI through today.” The API must store the product version and the date window with every estimate. A 2025 polygon mean taken from Version 2 is a 2019–2021 sample.

L4B is the wrong resolution for a woodlot smaller than about 100 ha. Use it as a landscape prior next to the footprint mean, not as a substitute for footprints, when the polygon is a small fraction of the 1 km cell.

### 4.5 Known GEDI bias in the tallest forests

Sillett et al. (2024), *Forest Ecology and Management*, DOI 10.1016/j.foreco.2024.121879, built biomass allometry for primary *Sequoia sempervirens* forests at 40–42° N and compared it with GEDI. A GEDI equation predicted about **916 ± 74 Mg ha⁻¹** versus **928 ± 11 Mg ha⁻¹** from an earlier GEDI equation (mean ± 1 SE). Across 37,465 ha of primary forest, airborne lidar predicted **1,384 ± 77 Mg ha⁻¹** of live tree biomass and GEDI **885 ± 73 Mg ha⁻¹**. They attribute the low GEDI number to height being a weak predictor once trunks are gigantic. CarbonSight should expect GEDI to **undershoot** old-growth redwood alluvial stands, not to hit the 1,600–4,300 Mg ha⁻¹ research-plot range. Clamping outputs to the IPCC Tier-1 temperate range would make this bias worse: the 2006 Table 4.7 upper value for temperate oceanic forest in North America is 1,200 Mg ha⁻¹, and the best redwood plots lie above it.

## 5. Root-to-shoot ratios (optional, separate field)

IPCC writes R as tonnes of root dry matter per tonne of shoot dry matter. Belowground biomass = AGB × R. Total live biomass carbon = AGB × (1 + R) × CF. CarbonSight’s headline carbon **does not** include this. If the API exposes roots, the field name must be `belowground_carbon_t_ha`, and the stock used for a listing stays aboveground unless the user opts in and the UI shows both.

### 5.1 2006 Table 4.4 (still the clean temperate lookup)

Selected rows, IPCC 2006, Vol. 4, Ch. 4, Table 4.4. Ranges in parentheses are the table’s published ranges.

| Ecological zone | Condition | R |
| --- | --- | --- |
| Tropical rainforest | (single default row) | 0.37 (Fittkau and Klinge, 1973) |
| Tropical moist deciduous | AGB &lt; 125 t ha⁻¹ | 0.20 (0.09–0.25) |
| Tropical moist deciduous | AGB &gt; 125 t ha⁻¹ | 0.24 (0.22–0.33) |
| Tropical dry | AGB &lt; 20 t ha⁻¹ | 0.56 (0.28–0.68) |
| Tropical dry | AGB &gt; 20 t ha⁻¹ | 0.28 (0.27–0.28) |
| Tropical shrubland | | 0.40 |
| Temperate, other broadleaf | AGB &lt; 75 t ha⁻¹ | 0.46 (0.12–0.93) |
| Temperate, other broadleaf | AGB 75–150 t ha⁻¹ | 0.23 (0.13–0.37) |
| Temperate, other broadleaf | AGB &gt; 150 t ha⁻¹ | 0.24 (0.17–0.44) |
| Temperate conifers | AGB &lt; 50 t ha⁻¹ | 0.40 (0.21–1.06) |
| Temperate conifers | AGB 50–150 t ha⁻¹ | 0.29 (0.24–0.50) |
| Temperate conifers | AGB &gt; 150 t ha⁻¹ | 0.20 (0.12–0.49) |
| Boreal | AGB &lt; 75 t ha⁻¹ | 0.39 (0.23–0.96) |
| Boreal | AGB &gt; 75 t ha⁻¹ | 0.24 (0.15–0.37) |

Mokany et al. (2006) is the source IPCC cites for most of the tropical-moist and temperate rows.

### 5.2 2019 Table 4.4, where the text extraction is trustworthy

The 2019 Refinement **replaces** Table 4.4. Many new cells carry a default uncertainty of ±90 percent, which is wide enough that the root correction can dominate the error budget. For tropical rainforest in North and South America the updated table is readable and should replace the 2006 value of 0.37:

| Origin | AGB class | R | Uncertainty |
| --- | --- | --- | --- |
| Natural | ≤ 125 and &gt; 125 t ha⁻¹ | 0.221 | SD 0.036 |
| Planted | ≤ 125 and &gt; 125 t ha⁻¹ | 0.170 | SD 0.11 |

So a natural Amazon stand moves from the old (1 + 0.37) = 1.37 total-biomass multiplier to (1 + 0.221) = 1.221. Using the 2006 rainforest ratio overstates belowground biomass relative to the refinement. CarbonSight’s optional root field should use the 2019 cell when the ecozone and continent match a cell we can read without ambiguity.

Temperate rows in the 2019 PDF are densely typeset. One block places natural other-broadleaf temperate continental forest at R = 0.481 (≤ 125 t ha⁻¹) and R = 0.277 (&gt; 125 t ha⁻¹), each with ±90 percent default uncertainty, but the continent labels are easy to mis-assign from a text extract. **Until someone checks that cell on the official PDF page, the implementation fallback for temperate broadleaf is the 2006 Table 4.4 row, which parsed cleanly.** For Hubbard Brook, AGB is about 245 Mg ha⁻¹, so the 2006 “other broadleaf, &gt; 150 t ha⁻¹” value is R = 0.24 (0.17–0.44).

Do not apply a forest R to the Mojave saltbush site. Do not apply the tropical-rainforest R to Kruger; savanna root fractions are a different literature, and this methodology does not invent one.

## 6. IPCC stock priors (plausibility, not the answer)

These are Tier-1 defaults for a whole ecozone, not plot truths. They are useful when a satellite estimate is absurd, and harmful when used as a clamp.

From 2006 Table 4.7, aboveground biomass in natural forests, tonnes dry matter ha⁻¹:

| Zone | Region | AGB | Range as printed |
| --- | --- | --- | --- |
| Tropical rainforest | North and South America | 300 | 120–400 |
| Tropical rainforest | Africa | 310 | 130–510 |
| Temperate oceanic | North America | 660 | 80–1,200 |
| Temperate continental, &gt; 20 years | North and South America | 130 | 50–200 |
| Tropical shrubland | Africa | 70 | 20–200 |

From 2019 Table 4.7 (updated), natural forests, the cell that matches central Amazon primary forest:

| Zone | Continent | Status | AGB | Uncertainty |
| --- | --- | --- | --- | --- |
| Tropical rainforest | North and South America | Primary | 307.1 | SD 104.9 |
| Tropical rainforest | North and South America | Secondary &gt; 20 years | 206.4 | SD 80.4 |
| Tropical rainforest | North and South America | Secondary ≤ 20 years | 75.7 | SD 34.5 |

Suwa et al. (2013) measured about 317 Mg ha⁻¹ near Manaus (validation file). That sits on the 2019 primary mean. It does not mean every Amazon polygon should return 307.

The 2006 temperate-oceanic North America range tops out at 1,200 Mg ha⁻¹. Old-growth coast redwood plots exceed that (Sillett et al., 2020, up to 4,341 Mg ha⁻¹). A plausibility check may *flag* “above the Tier-1 table” and must not *replace* the lidar number with 1,200.

## 7. Sequestration is a rate

IPCC 2019 Table 4.9 defines aboveground net biomass growth as the net change in total aboveground biomass over time, so the number already tries to include mortality, not just gross tree growth. The footnote says Tier-1 default uncertainties apply where no standard deviation is printed, and several starred cells are carried forward from the 2006 “forests &gt; 20 years” estimates.

Use the row that matches ecozone, continent, and stand status. Two rows the demo sites actually need:

**Tropical rainforest, North and South America, primary** (2019 Table 4.9): **1.0 t d.m. ha⁻¹ yr⁻¹, SD 2.0**. The standard deviation is twice the mean. At Tier 1, old-growth Amazon net growth is not distinguishable from zero. Converting with 0.47 and 44/12:

```text
1.0 × 0.47 × (44/12) = 1.72 t CO2e ha⁻¹ yr⁻¹
uncertainty (1 SD): 2.0 × 0.47 × (44/12) = 3.45 t CO2e ha⁻¹ yr⁻¹
```

The 2006 table’s South America tropical-rainforest “&gt; 20 years” value is **3.1 (1.5–5.5)** t d.m. ha⁻¹ yr⁻¹ (Malhi et al., 2004). That row is not the same object as the 2019 primary-forest row. For a primary-forest polygon, prefer 1.0 ± 2.0 and show the 2006 number only as a sensitivity, clearly labeled as the older &gt;20-year default.

**Temperate continental forest, &gt; 20 years, Asia, Europe, and North America** (2006 Table 4.9): **4.0 t d.m. ha⁻¹ yr⁻¹, range 0.5–7.5**. In CO2e at CF 0.47 that is **6.9 t CO2e ha⁻¹ yr⁻¹**, range 0.86–12.9. The 2019 table has additional North American secondary-forest cells, but the ecozone labels in that part of the PDF did not extract cleanly enough to code. Use the 2006 row until those cells are checked on the page.

This default **fails** the Hubbard Brook census. Van Doorn et al. (2011) found no significant change in live-tree biomass between 1995–96 (246 Mg ha⁻¹) and 2005–06 (245 Mg ha⁻¹). The 2007 Hubbard Brook paper at DOI 10.1139/x06-261 reports aboveground biomass rising only from 209 Mg ha⁻¹ in 1981 to 216 Mg ha⁻¹ in 2001, which is 0.35 Mg ha⁻¹ yr⁻¹, and states that net ecosystem productivity of that second-growth forest was near zero. A CarbonSight run that prints 4.0 Mg ha⁻¹ yr⁻¹ there is printing a Tier-1 default, not a local flux. The UI should say so, and confidence on the flux (not necessarily on the stock) should fall.

**Do not assign a forest growth rate to grassland or desert.** Table 4.9 is a forest table. The Mojave control must return a null sequestration or an explicit “not a forest; Tier-1 forest growth was not applied.” Assigning 4 t ha⁻¹ yr⁻¹, or the Amazon 1 t ha⁻¹ yr⁻¹, to Edwards Air Force Base saltbush is a failed test.

Young secondary forest and plantations are different. 2019 Table 4.9 gives tropical rainforest in the Americas secondary ≤ 20 years a net growth of 5.9 t d.m. ha⁻¹ yr⁻¹ (SD 2.5), and Table 4.10 still has plantation rows that can exceed 10–20 t d.m. ha⁻¹ yr⁻¹. Those rows are only legal if land cover and stand age support them. CarbonSight does not infer stand age from a single NDVI snapshot.

### What a listing is allowed to say

A listing may show stock and a Tier-1 rate, with the table row named. It may not call the rate a verified removal, and it may not multiply the rate by an invented project lifetime to mint credits. Additionality, leakage, permanence, and a counterfactual baseline are separate analyses. West and coauthors (*Science*, 2023; the paper usually cited as DOI 10.1126/science.ade3535) argued that many REDD+ projects overstated avoided deforestation relative to synthetic controls. CarbonSight does not re-estimate that result and does not quote a percentage from it here. The methodological consequence is enough: a biomass map is not a baseline, and a baseline is not a credit.

## 8. Confidence score

The score is a checklist, not a probability that a credit is real. Publish the components beside the total so a judge can see what moved.

Start at 0 and add:

| Component | Points | Rule |
| --- | --- | --- |
| Optical support | 0–15 | 15 if the median NDVI uses ≥ 5 clear Sentinel-2 dates in the window; 8 if 3–4; 0 if fewer than 3. |
| Lidar support | 0–35 | 35 if ≥ 25 quality-filtered L4A shots, from at least two tracks, inside the polygon. 20 if 8–24 shots. 8 if 1–7 shots. 0 if none. |
| Footprint error | 0–15 | 15 if the mean of L4A prediction standard errors is &lt; 30 percent of the mean AGBD; 8 if 30–60 percent; 0 if worse or if there are no shots. |
| Land-cover agreement | 0–15 | 15 if a land-cover layer (ESA WorldCover or Esri annual land cover on Planetary Computer; confirm the collection id at build time) says forest and NDVI ≥ 0.6, or says shrub/sparse/bare and NDVI &lt; 0.3. 0 if land cover and NDVI disagree. |
| Prior check | 0–10 | 10 if AGB is inside the published band for that validation biome or, for an unlisted polygon, inside the IPCC Table 4.7 range for the ecozone. 4 if it falls outside but the UI flags the excursion (this is the redwood case: outside the table, flag on, points partly kept). 0 if it falls outside and the result is still shown as normal. |
| Method honesty | 0–10 | 10 if the reported AGB is from quality-filtered L4A. 0 if the reported AGB is the Ilam NDVI equation or an IPCC prior. |

Then apply caps. Caps exist so a high optical score cannot launder a weak biomass estimate.

- Reported value is the Ilam NDVI equation: **cap the total at 40**.
- Zero L4A shots and median NDVI &gt; 0.8 (saturation regime): **cap at 35**.
- Land cover is bare, shrub, or grassland and a forest growth row was applied: **cap at 20**, and blank the sequestration field rather than shipping the bad rate. The cap is a backstop; the rate should already be null.
- Polygon area &lt; 1 ha: **subtract 10** (one Sentinel pixel neighborhood and, at best, a couple of GEDI shots).
- Polygon area &gt; 50,000 ha: **subtract 10** unless the user asked for a landscape summary. The hackathon API is not a national inventory.

Suggested labels: 0–39 `do_not_list`, 40–69 `screen_only`, 70–100 `list_with_provenance`. Even `list_with_provenance` is a screening listing. Nothing in this scale means “registry-grade MRV.” A perfect score is intentionally hard: it requires lidar shots, a modest relative error, and land-cover agreement.

## 9. Limitations, in one place

1. **Stock is not a credit.** tCO2e as computed here is carbon in place, converted by 44/12.
2. **Net growth of old forest is small and poorly known.** The best Tier-1 number for primary Amazon forest has a standard deviation larger than the mean.
3. **0.47 is a default, not a chemical analysis of the polygon.** Conifer wood is often closer to 0.51. Redwood plot carbon in Sillett et al. (2020) implies about 0.51.
4. **GEDI misses the far north, misses some years, and undershoots the tallest conifer forests.** Dry tropical savannas are a weak part of the L4A training set (L4A ATBD).
5. **The NDVI equation is local and noisy** (RMSE 78 t ha⁻¹) and will mis-rank both the Amazon and the desert if it is used as a global model.
6. **Roots, dead wood, litter, and soil are omitted** from the headline number. Including roots with the wrong R changes the total by tens of percent and can add a ±90 percent IPCC uncertainty.
7. **Tier-1 growth applied to the wrong biome is worse than no flux.** Desert and savanna must not inherit a forest row.
8. **No additionality, leakage, permanence, or legal title check** is in this method. A high-biomass polygon can be ineligible for a credit for any of those reasons, or already credited.
9. **Validation sites are published landscapes, not certified plot corners** for every polygon a demo user might draw. Pass bands in the validation file are screening thresholds for the hackathon, built from the published dispersion, and they are labeled as thresholds rather than as confidence intervals.

## References

- Chave, J., et al. (2014). Improved allometric models to estimate the aboveground biomass of tropical trees. *Global Change Biology* 20: 3177–3190. https://doi.org/10.1111/gcb.12629
- Colgan and the Kruger study are cited from the validation file; they are not a method input.
- Dubayah, R., et al. GEDI mission and product family. Product behavior used here is taken from the ORNL DAAC user guides rather than from a re-derivation.
- GEDI L4A ATBD, v1.0 (November 2022), linked from https://gedi.umd.edu/dataproducts/documents/ and from the ORNL L4A guide. Training-set gaps, the 13-model / 32-stratum design, and the 8,587-waveform count are stated in that ATBD.
- GEDI L4A Footprint Level Aboveground Biomass Density, Version 3, user guide. https://daac.ornl.gov/GEDI/guides/GEDI_L4A_AGB_Density_V3.html
- GEDI L4B Gridded Aboveground Biomass Density, Version 2, user guide. https://daac.ornl.gov/GEDI/guides/GEDI_L4B_Gridded_Biomass.html
- Healey, S. P., Patterson, P. L., and Armston, J. (2022). ATBD for GEDI Level-4B gridded aboveground biomass density, v1.0, 23 February 2022. https://data.ornldaac.earthdata.nasa.gov/public/gedi/GEDI_L4B_Gridded_Biomass/comp/GEDI_L4B_ATBD_v1.0.pdf
- IPCC (2006). *2006 IPCC Guidelines for National Greenhouse Gas Inventories*, Volume 4, Chapter 4, Tables 4.3, 4.4, 4.7, and 4.9. https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/4_Volume4/V4_04_Ch4_Forest_Land.pdf
- IPCC (2019). *2019 Refinement to the 2006 IPCC Guidelines*, Volume 4, Chapter 4. Table 4.3 not refined; Tables 4.4, 4.7, and 4.9 updated. https://www.ipcc-nggip.iges.or.jp/public/2019rf/pdf/4_Volume4/19R_V4_Ch04_Forest%20Land.pdf
- KC, A., Bhattarai, S., and Pandey, P. (2022). A comparison of Landsat-8 and Sentinel-2 spectral indices for estimating aboveground forest carbon in a community forest. *Forestry: Journal of the Institute of Forestry, Nepal* 19. https://doi.org/10.3126/forestry.v18i01.41749
- Lamlom, S. H., and Savidge, R. A. (2003). Cited by IPCC 2006 Table 4.3 for temperate broadleaf and conifer carbon fractions.
- McGroddy, M. E., Daufresne, T., and Hedin, L. O. (2004). Cited by name in IPCC 2006 Table 4.3 as the source of the 0.47 default. This file did not re-open that paper; the number used in the product is the IPCC table value, not a re-fit from McGroddy.
- Mokany, K., Raison, R. J., and Prokushkin, A. S. (2006). Cited by IPCC 2006 Table 4.4 for most root-to-shoot defaults.
- Saatchi, S. S., et al. (2011), and Zolkos, S. G., Goetz, S. J., and Dubayah, R. (2013). Cited in the L4A ATBD as evidence that lidar outperforms other biomass remote sensing. This methodology does not restate numeric results from those two papers.
- Sillett, S. C., et al. (2020). Aboveground biomass dynamics and growth efficiency of *Sequoia sempervirens* forests. *Forest Ecology and Management*, article 117740. https://doi.org/10.1016/j.foreco.2019.117740
- Sillett, S. C., et al. (2024). Ground-based calibration for remote sensing of biomass in the tallest forests. *Forest Ecology and Management*. https://doi.org/10.1016/j.foreco.2024.121879
- Suwa, R., et al. (2013). Cited in `validation.md`; the Manaus mean used as a worked example.
- West, T. A. P., et al. (2023). *Science*. DOI commonly listed as 10.1126/science.ade3535. Confirm the DOI before a slide quotes a statistic from the paper. This methodology cites the existence of the over-crediting result, not a specific percentage.
