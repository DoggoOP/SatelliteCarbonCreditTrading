# Validation sites

Use these five places to decide whether a CarbonSight run is in the right order of magnitude. The numbers are published measurements or published lidar averages. The pass bands are **hackathon screening thresholds** built from that dispersion. They are not confidence intervals, and they are not a license to clamp the model to the band.

Machine-readable copy: [`reference_values.json`](reference_values.json).

Global rules for every site:

- Compare **aboveground dry biomass** in Mg ha⁻¹. Carbon and tCO2e in the JSON are `AGB × 0.47 × (44/12)` unless a paper reports its own carbon, which is then stored separately.
- Draw the polygon on the land cover the paper describes. A polygon that includes a river, a road, or a clearcut will not hit the forest mean, and should not be scored as a model failure.
- GEDI L4A is a sample of ~25 m footprints. Do not expect the footprint mean to equal a 1 ha research plot.
- A run fails the desert test if it looks like a forest. A run fails the redwood test if it looks like a generic temperate forest from IPCC Table 4.7 (about 130 Mg ha⁻¹). The same global “reasonable forest” range cannot grade both.

## 1. Central Amazon, near Manaus

**Published stock.** Suwa, Sakai, dos Santos, da Silva, Kajimoto, Ishizuka, and Higuchi (2013), *JARQ* 47(1): 109–114, https://doi.org/10.6090/jarq.47.109.

They inventoried every tree with diameter &gt; 10 cm on a 2,500 m × 20 m belt (5 ha, in 125 subplots of 20 m × 20 m) in primary terra-firme forest in the INPA ZF-2 experimental forest near Manaus, part of the Jacaranda project plots established in 1996. Using a diameter–height model that changes with topographic position, mean aboveground biomass was **316.6 Mg ha⁻¹**, which they report as ±28.3 SE. The abstract rounds this to 317 ± 28 (SE) Mg ha⁻¹. Biomass declined from plateau toward the valley bottoms (*baixios*). The ±28.3 figure is the paper’s reported standard error across adjacent subplots. Those subplots are not independent samples of the Amazon, so do not treat ±28 as the uncertainty of a new polygon.

A 2016 follow-up in the same forest (*JARQ* 50(4), https://www.jstage.jst.go.jp/article/jarq/50/4/50_379/_article) reports plateau plots at **315.4 ± 33.2 Mg ha⁻¹** and baixio plots at **224.2 ± 20.3 Mg ha⁻¹** (mean ± SE). The plateau–baixio difference was only marginal (p = 0.09). Net biomass increment did not differ significantly between the two topographic positions. A polygon dropped in a valley should be allowed to land near 220 Mg ha⁻¹.

**IPCC cross-check, not a second measurement.** 2019 Table 4.7, tropical rainforest, North and South America, primary forest: **307.1 Mg ha⁻¹, SD 104.9**. The Suwa mean sits on that default. The SD shows that “about 300” is a central value across studies, not a tight target.

**Default-factor carbon, for the app’s own formula only.** 316.6 × 0.47 = **148.8 t C ha⁻¹**. × 44/12 = **546 t CO2e ha⁻¹** of aboveground stock. This is not a credit.

**Coordinate warning.** The JIRCAS PDF of Suwa et al. prints the site as “2°36′ S, 11°35′ W”. That longitude is not near Manaus (Manaus is near 60° W). Do not fly the demo to 11° W. The paper’s text places the work in ZF-2. Conventional descriptions of INPA ZF-2 put it near **2.6° S, 60.2° W**, northwest of the city. That conventional point was **not** re-surveyed for this file. Draw on continuous terra-firme canopy in that area, and treat the test as a biome check.

| Check | Threshold (screening, not a CI) |
| --- | --- |
| AGB pass | 150–500 Mg ha⁻¹ for a terra-firme polygon that mixes plateau and valley |
| AGB fail | &lt; 80 or &gt; 700 Mg ha⁻¹ |
| Flux | If the app shows a sequestration rate, it should be the 2019 primary-forest row **1.0 t d.m. ha⁻¹ yr⁻¹ with SD 2.0** (~1.7 t CO2e ha⁻¹ yr⁻¹), labeled as a Tier-1 default whose uncertainty crosses zero. Printing the 2006 “&gt; 20 years” value 3.1 without that label is a methodology bug, not a better measurement. |

## 2. Coast redwood, Humboldt County, California

Two different “true” numbers exist, and the app should be graded against the one that matches its sensor.

**Research plots.** Sillett et al. (2020), https://doi.org/10.1016/j.foreco.2019.117740. Eleven 1 ha plots of old-growth *Sequoia sempervirens*, remeasured at five-year intervals, held **1,594–4,341 Mg ha⁻¹** aboveground biomass at the start, and **805–2,201 Mg C ha⁻¹**. The carbon pair implies a fraction of about 0.505–0.507, close to the IPCC conifer value 0.51 and above the 0.47 default. Live biomass increment on those plots was **1.2–19.2 Mg ha⁻¹ yr⁻¹**, with much of it in heartwood. These plots are the tallest, heaviest stands, not the average hectare of the park.

**What GEDI and airborne lidar see across primary forest.** Sillett et al. (2024), https://doi.org/10.1016/j.foreco.2024.121879, in primary redwood forests at 40–42° N. GEDI-based equations gave about **916 ± 74** and **928 ± 11 Mg ha⁻¹** (mean ± SE) depending on the equation. Across **37,465 ha**, airborne lidar predicted **1,384 ± 77 Mg ha⁻¹** live tree biomass and GEDI **885 ± 73 Mg ha⁻¹**. GEDI is low because height saturates as a predictor in these stands. The same paper says average biomass exceeds 2,000 Mg ha⁻¹ in three of seven reserves, and that hectares above 3,000 Mg ha⁻¹ are rare (about 1 percent), concentrated on **460 ha** of low-elevation alluvial terraces in Humboldt Redwoods State Park.

**Where to draw.** Humboldt Redwoods State Park is centered near **40.312° N, 123.972° W** (California State Parks unit as listed on its Wikipedia entry; that is the park centroid, not a plot corner). Rockefeller Forest, the old-growth block inside the park, is mapped near **40.356° N, 123.967° W** on the USGS Weott quadrangle. Sillett’s plot corners are not in the abstracts used here. Draw on alluvial old growth in that park, inside 40–42° N, and do not expect 4,000 Mg ha⁻¹ from a GEDI mean.

IPCC 2006 Table 4.7 lists temperate oceanic forest in North America at 660 Mg ha⁻¹ with a printed range of 80–1,200. The upper end still does not cover the research plots. Failing the app for exceeding 1,200 would punish the right answer.

| Check | If the app used GEDI | If the app claims field-plot allometry |
| --- | --- | --- |
| Pass | about 500–1,800 Mg ha⁻¹ | a stand in the published plot range may exceed 1,500 and can exceed 3,000 on the alluvial terraces |
| Fail | &lt; 400 Mg ha⁻¹ (looks like ordinary temperate forest or a saturated NDVI guess) | &lt; 400, or a single number pasted from IPCC Table 4.7 (130 or 660) with no lidar |
| Carbon | Show both 0.47 and the paper’s own ~0.51. Hiding the gap fails the test even if biomass is right. |

## 3. Temperate deciduous forest, Hubbard Brook, New Hampshire

**Valley-wide live-tree biomass.** Van Doorn, Battles, Fahey, Siccama, and Schwarz (2011), *Canadian Journal of Forest Research*, https://doi.org/10.1139/x11-063. A network of 371 plots in Hubbard Brook Experimental Forest: **246 Mg ha⁻¹** in 1995–96 (95 percent CI 235–258) and **245 Mg ha⁻¹** in 2005–06 (95 percent CI 234–256). No significant change over the decade. The abstract uses “live-tree biomass” and “total biomass” for this figure. It reads as aboveground live trees. This file does not claim the number includes roots.

**Earlier watershed trajectory.** The 2007 paper at https://doi.org/10.1139/x06-261 (population and biomass dynamics at Hubbard Brook) reports total aboveground biomass of **209 Mg ha⁻¹ in 1981** and **216 Mg ha⁻¹ in 2001**, and aboveground net primary production of **6.53 Mg ha⁻¹ yr⁻¹** (3.28 woody, 3.25 leaf). Net change in stock was about **0.35 Mg ha⁻¹ yr⁻¹** over those twenty years. The paper says net ecosystem productivity was near zero. Leaf production is not woody biomass increment; do not add 6.53 to the CarbonSight sequestration field.

**A different accounting, lower number.** The Hubbard Brook synthesis reproduces Fahey et al. (2005) as Table 5.1: total aboveground biomass **18,990 g m⁻² (SE 248)** in 1997, which is **189.9 Mg ha⁻¹ (SE 2.5)**, plus foliage, branch, bark, and wood broken out separately (https://hbr-lter.github.io/synthesisbook/BiomassProductivity.html). That is a biomass-budget study of the reference northern hardwood forest, not the 371-plot valley mean. Both numbers are real. The screening band below is wide enough to accept either.

**Location.** USDA Forest Service: Hubbard Brook Experimental Forest, White Mountain National Forest, **43°56′ N, 71°45′ W**, 3,138 ha, second-growth northern hardwoods with 10–20 percent spruce–fir (https://research.fs.usda.gov/nrs/forestsandranges/locations/hubbardbrook).

**Default-factor carbon** on the 2005–06 mean: 245 × 0.47 = **115 t C ha⁻¹**, or **422 t CO2e ha⁻¹** of aboveground stock. IPCC Table 4.3 broadleaf temperate fraction 0.48 would give 118 t C ha⁻¹. Report 0.47 as the product default.

**Flux test.** IPCC 2006 Table 4.9, temperate continental forest older than 20 years, is **4.0 t d.m. ha⁻¹ yr⁻¹** (range 0.5–7.5), about **6.9 t CO2e ha⁻¹ yr⁻¹** at CF 0.47. The local census says net woody stock change is about zero to a few tenths of a tonne. The app may *display* the Tier-1 row if and only if it is labeled “IPCC default, not the Hubbard Brook remeasurement.” If that 4.0 is presented as the measured sequestration of this forest, the run fails even when the stock is correct.

| Check | Threshold |
| --- | --- |
| AGB pass | 170–320 Mg ha⁻¹ |
| AGB fail | &lt; 100 or &gt; 500 Mg ha⁻¹ |
| Net flux pass | about −1 to +1 Mg ha⁻¹ yr⁻¹, or a clearly labeled Tier-1 default sitting next to the local “near zero” note |
| Net flux fail | an unlabeled 4 Mg ha⁻¹ yr⁻¹ (or the equivalent ~7 t CO2e) presented as observed sequestration |

## 4. Savanna, Kruger National Park, South Africa

**Park-wide woody mean.** Colgan, Asner, Levick, Martin, and Chadwick (2012), *Biogeosciences* 9: 1809–1821, https://doi.org/10.5194/bg-9-1809-2012.

Airborne lidar over 70,978 ha, scaled by land system, gave a park-wide mean woody aboveground biomass of **28.3 Mg ha⁻¹**. The paper says this excludes riparian woodlands (about 2–4 percent of the park) and that the park is about 1.9 million ha. The prose also says total woody AGB was “53.8 Gg.” That unit is inconsistent with 28.3 Mg ha⁻¹ × 1.9 million ha, which is about 54 million Mg (54 Tg), not 54 Gg. **Use 28.3 Mg ha⁻¹.** Do not use 53.8 Gg. The table in the paper repeats the park mean as 28.3 ± 0.06 Mg ha⁻¹.

Spatial spread is the real validation target. Examples stated in the paper:

- Granite near Skukuza: high along streams (34.1 ± 1.4 Mg ha⁻¹) and still high on crests (26.8 ± 0.8), lower on footslopes (17.7 ± 0.5).
- Basalt near Lower Sabie: mean **6.5 ± 0.06 Mg ha⁻¹**, from about 8.1 near streams to 4.1 on crests.
- A granite field plot cited from Nickless et al. (2011): **22.9 Mg ha⁻¹** on 4 ha near Skukuza.
- Inside a long-running basalt exclosure (Makhohlola), woody AGB was **36.9 ± 7.1 Mg ha⁻¹** versus **2.7 ± 0.5** outside. Fire and herbivory move the number by an order of magnitude on the same soil.

So a single polygon mean of 28.3 is not the expectation. A southern-Kruger polygon should fall in the **few to several tens** of Mg ha⁻¹ for woody plants, higher on granite than on basalt, unless the user drew a riparian strip or an exclosure.

**NDVI failure mode.** Wet-season grass is green. NDVI will track the grass layer, and the Ilam forest equation will turn that greenness into forest biomass. A savanna run that reports &gt; 150 Mg ha⁻¹ is treating Kruger as Ilam or as the Amazon. GEDI’s own ATBD says dry-tropical savannas are underrepresented in the L4A training set, so lidar help is real but not automatically unbiased.

**Carbon.** 28.3 × 0.47 = **13.3 t C ha⁻¹**, or **49 t CO2e ha⁻¹**, woody only, grass excluded, park-wide mean only.

**Where to draw.** Southern Kruger, granite around Skukuza, is the landscape the paper describes in detail. This file does not set a plot corner. Skukuza rest camp is a convenient map anchor near 25.0° S, 31.6° E; confirm the pin in the basemap rather than treating it as a surveyed coordinate. Keep the polygon off the river if you want the upland granite number.

| Check | Threshold |
| --- | --- |
| AGB pass | 3–80 Mg ha⁻¹ woody for an upland savanna polygon |
| AGB fail | &gt; 150 Mg ha⁻¹ (forest confusion) or a reported value of exactly the Amazon default (~300) |
| Flux | Do not apply a tropical-rainforest growth row. If a rate is shown, it needs its own savanna citation, which this documentation set does not supply. Null is the correct hackathon output. |

## 5. Desert control, western Mojave, California

**Published biomass.** Sharifi, Brostoff, and Rundel (2017), *Aliso* 35(2), https://doi.org/10.5642/aliso.20173502.04.

Saltbush scrub on a pan-and-dune mosaic at Edwards Air Force Base, between Rosamond and Rogers dry lakes, on the bed of Pleistocene Lake Thompson. The paper gives the site as **34°50′ N, 117°55′ W** (34.833° N, 117.917° W), elevation about 700 m. Dominants are *Atriplex confertifolia*, *Ericameria nauseosa*, *Atriplex canescens*, and *Krascheninnikovia lanata*, canopy cover 30–36 percent on the low dunes.

Aboveground shrub and bunchgrass biomass **including dead material** was **503–1,204 kg ha⁻¹**, that is **0.503–1.204 Mg ha⁻¹**. The paper’s community breakdown (live shrub biomass, then live plus dead) is:

| Community | Live shrub (kg ha⁻¹) | Live + dead (kg ha⁻¹) |
| --- | --- | --- |
| Dune 1 | 335 | 503 |
| Dune 2 | 828 | 956 |
| Dune 3 | 1,005 | (text gives live; combined totals in the abstract span up to 1,204) |
| Flat 3 | 555 | 1,123 |

The abstract’s 503–1,204 kg ha⁻¹ range is the figure to test against. It already includes dead shrubs. It is still about **200 to 600 times smaller** than the Manaus mean.

**Default-factor carbon** on that range: 0.24–0.57 t C ha⁻¹, or **0.87–2.07 t CO2e ha⁻¹**. Relative to a forest listing, this is the zero control.

**Failure modes.** The Ilam NDVI equation at NDVI 0.15 already returns ~34 Mg ha⁻¹, which fails this test. A forest Tier-1 growth rate of 1–4 Mg ha⁻¹ yr⁻¹ also fails it. Bare playa inside the mosaic should be at or near zero live biomass; the published numbers are the vegetated dunes and flats, not the clay pans themselves. Draw on the saltbush, not on Rogers Dry Lake bed, if you want the 0.5–1.2 Mg ha⁻¹ band. Draw on the playa if you want a true zero and say that you did.

GEDI has a grass–shrub–woodland stratum, but a 25 m footprint on 30 percent shrub cover mixed with bare pan is a hard retrieval. Low confidence is acceptable. Forest-sized biomass is not.

| Check | Threshold |
| --- | --- |
| AGB pass | 0–5 Mg ha⁻¹ |
| AGB review | 5–15 Mg ha⁻¹ (possible inclusion of creosote upland or a geolocation mix; not an automatic pass) |
| AGB fail | &gt; 20 Mg ha⁻¹ |
| Flux pass | null, or a rate whose absolute value is &lt; 0.2 Mg ha⁻¹ yr⁻¹ and is not an IPCC forest row |
| Flux fail | any IPCC forest growth row |

## Unit check against the current analyzer

As of `main` commit `5a40de2`, the API reads Planetary Computer HGB `aboveground` and multiplies by 0.47 and 44/12, labeling the HGB mean as dry biomass. The collection is documented as **2010 biomass carbon density** at 300 m (Spawn et al. 2020, *Scientific Data* 7: 112; Planetary Computer catalog entry for `hgb`). This file did not open the COG.

Score the run in two columns until that unit is confirmed:

| If HGB is dry biomass, as the code assumes | If HGB is carbon density, as the catalog wording says |
| --- | --- |
| Compare the displayed AGB to the `agb_mg_ha` fields in this file. | The displayed “AGB” should be compared to `derived_using_default_cf.carbon_t_ha`, and the displayed tCO2e/ha is then too small by a factor of 0.47. |
| Manaus screen about 150–500 Mg ha⁻¹ passes. | A Manaus screen near 150 Mg ha⁻¹ labeled as biomass **fails** this file even though 150 is a plausible carbon density. Fix the label and drop the extra 0.47. Do not edit the reference downward to match the bug. |

Chloris annual change is a separate product. Passing the stock test does not mean the flux passed Hubbard Brook or the Mojave null test.

The three polygons in `shared/presets.ts` (Humboldt box near 40.33° N, 124.04° W; a box east of Manaus near 2.69° S, 59.89° W; a Sierra Nevada box) are convenient demo draws. They are not the literature plot corners. Kruger, Hubbard Brook, and the Mojave are not presets yet. Add them from `reference_values.json` rather than inventing new biomass targets.

## How to score a build

Run the five polygons in one session and record, for each, the source tag (`gedi_l4a`, `gedi_l4b`, `ndvi_fallback_ilam_2022`, or `ipcc_prior`), the shot count, AGB, carbon, tCO2e, sequestration, and confidence.

A build is in good shape for the demo if:

1. Manaus, Humboldt, Hubbard Brook, Kruger, and the Mojave come out in that **descending** order of AGB.
2. The Mojave result is under 5 Mg ha⁻¹, or the run refuses to invent a forest flux there.
3. Humboldt is several times Hubbard Brook, not equal to it. If both return ~200 Mg ha⁻¹, NDVI saturation or an IPCC temperate prior is driving the model.
4. Every sequestration number names its IPCC row or is null.
5. Confidence is lower for the NDVI fallback than for a shot-rich GEDI polygon, and a zero-shot closed-canopy polygon cannot reach the “list” band (methodology section 8).

Do not tune the model until all five pass by overwriting outputs with these constants. That is a hard-coded demo, and the confidence score should then be zero because the method tag would be dishonest. The honest demo is: GEDI where shots exist, a wide uncertainty, and a refusal to list the desert.

## Sources

- Colgan, M. S., Asner, G. P., Levick, S. R., Martin, R. E., and Chadwick, O. A. (2012). Topo-edaphic controls over woody plant biomass in South African savannas. *Biogeosciences* 9: 1809–1821. https://doi.org/10.5194/bg-9-1809-2012
- Fahey et al. (2005), as reproduced in the Hubbard Brook synthesis, Table 5.1. https://hbr-lter.github.io/synthesisbook/BiomassProductivity.html — the original 2005 article was not re-read for this file; the synthesis table was.
- Hubbard Brook Experimental Forest location and forest description. USDA Forest Service. https://research.fs.usda.gov/nrs/forestsandranges/locations/hubbardbrook
- Humboldt Redwoods State Park centroid (40.31194° N, 123.97167° W) from the park’s Wikipedia entry, used only as a map anchor. Rockefeller Forest map anchor 40.355695° N, 123.966986° W from the USGS Weott topographic listing. Neither anchor is a Sillett plot corner.
- IPCC (2006), Vol. 4, Ch. 4, Tables 4.7 and 4.9; IPCC (2019), Vol. 4, Ch. 4, Tables 4.7 and 4.9. URLs in `methodology.md`.
- Population and biomass dynamics of trees in a northern hardwood forest at Hubbard Brook (2007). *Canadian Journal of Forest Research*. https://doi.org/10.1139/x06-261
- Sharifi, M. R., Brostoff, W. N., and Rundel, P. W. (2017). Community structure and demography in a saline pan-dune mosaic in the western Mojave Desert. *Aliso* 35(2). https://doi.org/10.5642/aliso.20173502.04 — author initials on the journal page are M. Rasoul Sharifi; the paper is indexed under Rasoul Sharifi.
- Sillett, S. C., Carroll, A. L., Campbell-Spickler, J., Antoine, M. E., and coauthors (2020). https://doi.org/10.1016/j.foreco.2019.117740 — the DOI page lists those four names; the full author list should be taken from the article.
- Sillett et al. (2024). https://doi.org/10.1016/j.foreco.2024.121879
- Suwa, R., Sakai, T., dos Santos, J., da Silva, R. P., Kajimoto, T., Ishizuka, M., and Higuchi, N. (2013). *JARQ* 47(1): 109–114. https://doi.org/10.6090/jarq.47.109
- Terra-firme topographic biomass, ten-year remeasurement (2016). *JARQ* 50(4). https://www.jstage.jst.go.jp/article/jarq/50/4/50_379/_article/-char/en — author list was not re-copied in this pass; the abstract numbers were.
- Spawn, S. A., Sullivan, C. C., Lark, T. J., and Gibbs, H. K. (2020). Harmonized global maps of above and belowground biomass carbon density in the year 2010. *Scientific Data* 7: 112. https://doi.org/10.1038/s41597-020-0444-4 — cited for the HGB unit question. The GeoTIFF was not opened in this pass.
- Van Doorn, N. S., Battles, J. J., Fahey, T. J., Siccama, T. G., and Schwarz, P. A. (2011). https://doi.org/10.1139/x11-063
