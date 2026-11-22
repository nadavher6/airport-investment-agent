# Grading skill: how this assistant scores airports

The four categories below are the owner's own description of what is graded and why. The "How" and "Status" lines say
what the scoring code computes today (they follow `INVESTMENT_KPIS` in `apps/server/src/scoring/investmentScore.ts`).

## The four categories
1. **Congestion: "Is this airport too full?"**
   - **Meaning:** how crowded the airport already is. Adding capacity helps most at a packed airport.
   - **What it checks:** flights handled vs. flights it was built to handle.
   - **How:** annual departures (operations) as a traffic-volume proxy for how full the airfield is. The ideal is actual flights ÷ capacity (near or over 100% means congested; the FAA starts planning expansion at 60% full and builds at 80%), but runway capacity (ASV) is not freely published, so volume is used.
   - **Status:** computed (BTS T-100, latest 12 months): annual departures (operations), a traffic-volume proxy.
2. **Unmet demand: "Are people being turned away?"**
   - **Meaning:** travelers who want to fly but can't because the seats are full. That's money new capacity would capture.
   - **What it checks:** whether the airport is "full and still growing".
   - **How:** load factor = passengers ÷ seats. At an ~80–85% average, peak flights sell out and passengers spill to other airports or don't fly. True spill needs booking data, so load factor is the proxy.
   - **Status:** computed (BTS T-100, latest 12 months): load factor = passengers ÷ seats.
3. **Long-haul share: "Does it fly the valuable routes?"**
   - **Meaning:** the share of long international trips (widebodies to Europe or Asia).
   - **How:** international seats ÷ total seats. These flights are worth more:
     - landing fees scale with weight (a 777 pays ~$5,400 per landing vs. a few hundred for a small jet);
     - international passengers spend more;
     - customs facilities are expensive and hard to copy, so this traffic is sticky and high-margin.
   - **Status:** computed (BTS T-100, latest 12 months): international seats ÷ total seats.
4. **Growth: "Is demand real and lasting?"**
   - **Meaning:** is traffic truly rising over the years, or was a busy year a fluke?
   - **How:** the 5-year passenger (enplanement) growth rate, CY2019→CY2024, in percent per year. Rising means durable demand; falling means risky.
   - **Status:** computed (FAA enplanement data): 5-year enplanement growth rate, CY2019→CY2024; missing when the airport has no CY2019 or CY2024 figure.

## The formula
- **Score = 0.30·Congestion + 0.30·Unmet demand + 0.20·Long-haul + 0.20·Growth**, each category scored 0–100, so the final score is 0–100.
- **Need 0.60** (Congestion + Unmet demand) / **Quality 0.40** (Long-haul + Growth).
- **Method:** each raw KPI is winsorized at the 5th and 95th percentile (so one extreme airport does not squash the rest), then min-max scaled to 0–100, then the weighted sum above is taken.
- **Coverage renormalization:** if a category has no data for an airport, it is left out and the remaining weights are scaled up to sum to 1. `coverage` is the share of the full model that had data (1.0 = all four categories); `missing` lists the categories left out.
- **Relative mode vs. absolute mode:** with 2 or more airports, they are scaled against each other (100 = the best of the compared set). With 1 airport, it is scaled against all US airports (absolute mode).
