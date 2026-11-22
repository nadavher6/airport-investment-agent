# Scoring Formula — Research & Design

> **Purpose:** design the **deterministic Investment Attractiveness Score** the assignment
> requires ("Include some deterministic scoring or ranking logic (not only LLM output)",
> and a design doc explaining the "scoring methodology"). This grounds the formula in real
> aviation + composite-index methodology, is honest about what's computable from **free**
> data, and states every assumption — which is itself a graded requirement
> ("clearly communicate assumptions, uncertainty and scoping").

---

## 1. What we're scoring

The investor renovates US airports to add **flight and passenger capacity**, and wants the
airports where that capex is **most profitable**. So the score rewards airports that are:

- **capacity-constrained** (renovation relieves a real bottleneck), and
- **demand-rich and growing** (the new capacity gets filled), with
- **high-value traffic** (each added unit of capacity earns more).

That decomposes into four KPIs, in two groups:

| Group | KPI | Reads as |
|---|---|---|
| **Need** (where capacity helps) | Congestion / capacity pressure | "it's full → renovation unblocks it" |
| | Unmet demand | "demand exceeds seats → added capacity is captured" |
| **Quality** (how profitable the capacity is) | Long-haul share | "high-margin, high-fee, moated traffic" |
| | Growth / durability | "demand is real and lasting, not a blip" |

---

## 2. The KPIs — definition, why, formula, data

### 2.1 Congestion / capacity pressure  *(need)*

**Concept (FAA).** The standard US capacity measure is **Annual Service Volume (ASV)** —
the annual operations sustainable at an acceptable average delay — from FAA AC 150/5060-5:
`ASV = Cw × D × H` (weighted hourly capacity × annual/peak-day ratio × peak-day/peak-hour
ratio). The standard congestion scalar is **utilization**:

```
U = annual operations / ASV          (0 … >1; can exceed 1 when demand > practical capacity)
```

**Non-arbitrary thresholds (FAA Order 5090.x).** Plan capacity at **U = 0.60**, build / demand-
manage at **0.80**, severely constrained at **0.95**. These give defensible breakpoints instead
of invented constants.

**Secondary signal — realized delay.** Average delay per operation, normalized with FAA's own
15-minute reportable-delay threshold: `min(avg_delay_min / 15, 1)` (FAA ASPM / OPSNET).

**Honest data caveat.** **ASV is not published as a national table** — it lives in individual
airport master plans. For a national score we must approximate capacity (runway count via
AC 150/5060-5 curves, or hourly "called rate" AAR+ADR × annual factor), or restrict precise U
to airports where ASV is published. *This is an assumption to document.*

**Computable from free data?** Operations: FAA TAF / OPSNET. Delay: ASPM / BTS ASQP.
Capacity (ASV): **approximate only** (not in current repo data).

### 2.2 Unmet demand  *(need)*

**Concept (Boeing/Belobaba spill model).** *Unconstrained demand* = passengers who would fly if
seats were unlimited; *spill* = unconstrained − carried = the quantitative "unmet demand."
Normalizing by capacity: **Demand Factor = Load Factor + Spill Factor**, with spill estimated
from load factor + a demand coefficient-of-variation (K-factor ≈ 0.35–0.48). Worked example:
at **85% average load factor, ~12% of capacity is already spilled** — i.e. **meaningful spill
begins well below 100% LF** (a route averaging 80–85% turns away peak-day passengers).

**Honest caveat.** True spill needs booking-class data (proprietary). From **free** data we use a
**capacity-pressure proxy**, not a passenger count:

```
unmet_demand_proxy ≈ norm(load_factor) × norm(enplanement_CAGR)      # "full AND growing"
   optional gate: only count load_factor above ~0.80 as "pressured"
```

**Why "full AND growing":** high LF alone can be strategic hub-feed; positive CAGR confirms the
pressure is demand outrunning capacity. Load factor is a *utilization* proxy with no fare data —
a directional signal, not a spill count. *Document this.*

**Computable from free data?** Load factor + seats + passengers: **BTS T-100 Segment** (free).
CAGR: FAA ACAIS / TAF. (Load factor is **not** in current repo data — needs a T-100 tool.)

### 2.3 Long-haul share  *(quality)*

**Why it's worth more.** Landing fees scale with aircraft **weight** (MTOW): a 777-300ER landing
≈ $5,400 vs a narrowbody's few hundred; a 747 can exceed $10,000. International passengers add
dedicated terminal/FIS (customs) charges and higher non-aero spend. **FIS/customs facilities are
a capital moat** — expensive, capacity-limited, not quickly replicable — so an airport that can
add long-haul capacity captures scarce, high-margin traffic. That's where renovation capital
earns most.

**Formula.**
```
long_haul_share = international_seats / total_seats        # simplest, directly from T-100
   variant: seats on segments with great-circle distance > 3,000 nm (derive distance from O-D pair)
   optional: weight by aircraft MTOW to reflect fee value
```

**Computable from free data?** **BTS T-100 International Segment** (free). (Not in current repo
data — needs a T-100 tool. Our enplanement dataset has no international split.)

### 2.4 Growth / durability  *(quality)*

**Concept.** Air travel is **income-elastic** (GDP-per-capita elasticity ~1.3–2.7; IATA
population coefficient ≈ 1.03), so demand tracks catchment size/wealth and grows durably in
rising metros. The standard growth proxy is **enplanement CAGR**, ideally blending **actual**
(FY2019→FY2024) and **forecast** (FAA TAF 10-yr).

```
growth = blend( actual_CAGR , TAF_forecast_CAGR )   ; recovery_vs_2019 as a supporting signal
```

**Computable from free data?** **Yes — already in the repo.** The enplanement dataset exposes
`trend.cagr5yr`, `trend.cagr10yr`, `trend.recoveryVs2019`, and the series. ✅ Compute today.
Catchment population/GDP (Census/BEA) would strengthen it (free, not yet wired).

---

## 3. Methodology — how to combine them (OECD/JRC Handbook)

Pipeline: **normalize → weight → aggregate → sensitivity-test** (OECD/JRC *Handbook on
Constructing Composite Indicators*, 2008).

**Directionality.** Orient every KPI so **higher = more attractive**, per KPI, documented. (All
four here are naturally positive-direction for the investor: more congestion = more need, more
unmet demand = more upside, more long-haul = more value, more growth = more durability.)

**Outliers / missing.** Winsorize extreme values at the **5th/95th percentile** (note it); impute
gaps by **median** or exclude with disclosure.

**Normalize — min-max to 0–100** (readable, bounded, the exact scale the brief wants):
```
norm = 100 × (x − min) / (max − min)          # inverse KPI: 100 × (max − x)/(max − min)
```
Prefer **fixed, documented min/max** (e.g. FAA thresholds for congestion) over sample min/max so
scores stay stable when the airport set changes.

**Weight — transparent budget allocation** (100 points across KPIs), each with a one-line
rationale, summing to 1. Equal weights (0.25) are the neutral baseline; a documented allocation
is defensible *if* stress-tested.

**Aggregate — weighted linear sum** (simple, transparent, handbook default):
```
Score = Σ wᵢ · normᵢ                           (0–100)
```
**Compensability caveat (must state):** linear aggregation is *fully compensatory* — a very high
growth score can offset weak unmet demand. If we want to **penalize imbalance** (don't let one
strong KPI paper over a zero), use the **geometric mean** `Π normᵢ^wᵢ` (partial compensability) —
but it needs strictly-positive values, so floor norms to [1,101] to avoid a single 0 collapsing
the product.

**Sensitivity (don't skip).** Re-run with (a) equal weights, (b) ±10–20% perturbed weights,
(c) geometric instead of linear; report whether the **top airports stay on top**. Stable ranking
= defensible result.

---

## 4. Proposed formula (v1)

```
InvestmentScore (0–100) =
    0.30 · Congestion_norm      # capacity pressure (need)
  + 0.30 · UnmetDemand_norm     # demand that added capacity captures (need)
  + 0.20 · LongHaul_norm        # revenue quality / margin per unit of capacity
  + 0.20 · Growth_norm          # durability of the demand
```

**Weight rationale (budget allocation, sums to 1):**

| KPI | Weight | Why |
|---|---|---|
| Congestion | 0.30 | The investor renovates to add capacity; congestion is the most direct signal that capacity *helps here*. FAA-thresholded, so non-arbitrary. |
| Unmet demand | 0.30 | The profit driver — demand the new capacity actually captures. Equal to congestion: a bottleneck only pays if demand is behind it. |
| Long-haul share | 0.20 | Revenue quality — each added unit of capacity earns more (fees, FIS moat), but it's a multiplier on the need, not the need itself. |
| Growth | 0.20 | Durability — ensures demand is lasting, not a post-COVID blip. Guards against over-weighting a transient spike. |

→ **Need 0.60 / Quality 0.40.** Stated as the central assumption; §3 sensitivity tests it.

---

## 5. What we can compute **today** vs. what needs new data/tools

> **Status update:** all four KPIs are now implemented. The BTS T-100 tool below was built
> (`data/t100.json`, 2024, via the data.bts.gov Socrata API), so congestion (operations),
> unmet demand (load factor), and long-haul (international share) are computed for real, not
> pending. The table below is the original v0 gap analysis, kept for context.

| KPI | Needs | In the repo now? |
|---|---|---|
| **Growth** | enplanement CAGR, recovery | ✅ **Yes** — `enplanements` dataset (`trend.*`) |
| **Congestion** | operations + capacity (ASV) | ❌ needs FAA TAF/OPSNET ops + ASV approximation |
| **Unmet demand** | load factor + CAGR | ⚠️ CAGR yes; **load factor needs a BTS T-100 tool** |
| **Long-haul share** | international/long-stage seats | ❌ needs a **BTS T-100 International** tool |

**Implication / scoping (honest).** A *full* v1 needs two new data tools (BTS T-100 Domestic for
load factor + ops, T-100 International for long-haul) and an ASV approximation. **Buildable
immediately** from current data: **Growth**, plus a crude congestion/demand proxy from
enplanements-vs-hub-class norms. Recommended path:

1. **v0 (today):** score = Growth + a rough demand proxy (enplanements relative to hub-class
   median) — honest, limited, works with current tools. Lets the agent rank *something* now.
2. **v1 (add 1 tool):** wire a BTS T-100 tool → real load factor (unmet demand) + operations
   (congestion) + international share (long-haul). This is the credible version.

Each KPI returns its sub-score and inputs so the agent can **explain** the ranking (required:
"explain its reasoning clearly"), and flag when a KPI is a proxy or imputed (required:
"communicate assumptions, uncertainty and scoping").

---

## 6. Assumptions, uncertainty & scoping (for DESIGN.md)

- **ASV is approximated**, not measured (no national table) — congestion U has modelling error.
- **Unmet demand is a proxy** (load factor × growth), not true spill (which needs booking data).
- **Long-haul share** uses nonstop T-100 only (no connecting itineraries); international-share
  variant ignores domestic transcon long-haul unless the stage-length variant is used.
- **Weights are a judgment** (Need 0.60 / Quality 0.40), documented and sensitivity-tested, not
  derived from an optimization.
- **Min-max** is outlier-sensitive → winsorized at 5/95; **linear aggregation** is fully
  compensatory → geometric alternative reported in sensitivity.
- **Scope:** US commercial-service airports present in the FAA/BTS data; small/non-primary
  airports may have missing KPIs (imputed or excluded, disclosed per airport).

---

## 7. Sources

**Capacity & congestion (FAA)**
- AC 150/5060-5, Airport Capacity & Delay (ASV formula): https://www.faa.gov/documentLibrary/media/advisory_circular/150-5060-5/150_5060_5_part1.pdf
- FACT3, Airport Capacity Needs in the NAS (profiles, demand/ASV thresholds): https://www.faa.gov/sites/faa.gov/files/airports/resources/publications/reports/FACT3-Airport-Capacity-Needs-in-the-NAS.pdf
- Air Traffic by the Numbers FY2024 (called rate = AAR+ADR): https://www.faa.gov/air_traffic/by_the_numbers/air-traffic-by-the-numbers-FY2024.pdf
- Terminal Area Forecast: https://taf.faa.gov
- ASPM definitions: https://aspmhelp.faa.gov/index/ASPM_Operational_Performance_Review__Definitions_of_Variables.html
- OPSNET delays (15-min reportable, avg delay/op): https://www.aspm.faa.gov/aspmhelp/index/OPSNET__Delays.html
- ACRP Report 104, Delay & Capacity Thresholds: https://www.trb.org/Publications/Blurbs/170348.aspx

**Unmet demand / spill & demand drivers**
- Belobaba/Boeing Spill Model (MIT OCW): https://ocw.mit.edu/courses/16-75j-airline-management-spring-2006/f990b2cd2141f75cd9b348051af762e7_lect4b.pdf
- Drabas & Wu (2020), spill–recapture unconstraining: https://ideas.repec.org/a/pal/jorapm/v19y2020i1d10.1057_s41272-018-00178-y.html
- BTS T-100 Segment (load factor, seats, pax): https://www.transtats.bts.gov/DatabaseInfo.asp?QO_VQ=EEE
- BTS Data Bank 28IS, T-100 International Segment: https://www.bts.gov/browse-statistical-products-and-data/bts-publications/%E2%80%A2-data-bank-28is-t-100-and-t-100f
- IATA Long-Term Passenger Demand Projections (elasticities): https://www.iata.org/en/iata-repository/publications/economic-reports/iata-long-term-air-transport-passenger-demand-projections/

**Long-haul value / landing fees**
- Airport revenue & fee structure (~55–60% aeronautical): https://www.openandfairskies.com/how-airports-make-money/
- Weight-based landing-fee examples: https://simpleflying.com/the-cost-of-flying/

**Connectivity & airport KPIs**
- IATA Air Connectivity Index: https://www.iata.org/economicsair-connectivity-measuring-the-connections-that-drive-economic-growth/
- ACRP Report 190, Common Performance Metrics: https://crp.trb.org/acrp0715/wp-content/themes/acrp-child/documents/216/original/acrp_r190.pdf
- ACRP 19A, Resource Guide to Airport Performance Indicators: https://crp.trb.org/acrpwebresource2/wp-content/themes/acrp-child/documents/027/original/ACRP_19A_Resource_Guide_to_Airport_Performance_Indicators.pdf

**Composite-index methodology**
- OECD/JRC, Handbook on Constructing Composite Indicators (2008): https://www.oecd.org/content/dam/oecd/en/publications/reports/2008/08/handbook-on-constructing-composite-indicators-methodology-and-user-guide_g1gh9301/9789264043466-en.pdf
- JRC 10-Step Pocket Guide: https://knowledge-for-policy.ec.europa.eu/sites/default/files/10-step-pocket-guide-to-composite-indicators-and-scoreboards.pdf
- Mazziotta & Pareto, Methods for Constructing Composite Indices (Istat, 2013): https://www.istat.it/it/files/2013/12/Rivista2013_Mazziotta_Pareto.pdf
