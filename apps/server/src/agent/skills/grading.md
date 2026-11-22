# Grading skill: how this assistant scores airports

The four categories below are the owner's own description of what is graded and why. The "How" and "Status" lines say
what the scoring code computes today (they follow `INVESTMENT_KPIS` in `apps/server/src/scoring/investmentScore.ts`).

## The four categories
1. **Congestion: "Is this airport too full?"**
   - **Meaning:** how crowded the airport already is. Adding capacity helps most at a packed airport.
   - **What it checks:** flights handled vs. flights it was built to handle.
   - **How:** runway utilization = annual operations ÷ Annual Service Volume (ASV), the flights a year the runways were built to handle. Operations are T-100 departures × 2 (arrivals and departures). For the FAA's 30 Core airports (ATL, ORD, DFW, DEN, LAX, JFK, LGA, SAN and the other large hubs) the ASV is the FAA's published runway capacity (Airport Capacity Profiles 2014, hourly rates turned into a year by the FAA's own AC 150/5060-5 method), e.g. ATL ≈ 949,800 a year. For other airports it comes from the FAA's planning table (AC 150/5060-5, Figure 2-1) for the airport's runway layout in the FAA's runway records: e.g. one runway ≈ 217,500 a year, four parallels in two close pairs ≈ 615,000, extended (our rule, not an FAA figure) for parallel layouts the table does not draw. Near or over 100% means congested; the FAA starts planning expansion at 60% full and builds at 80%. The score is the utilization itself: 72% full scores 72 (capped at 100), the same whichever airports are compared. It is an estimate: T-100 leaves out private and military flights (so the real figure is higher), and the capacity is a planning estimate, not a measurement.
   - **Status:** computed (BTS T-100, latest 12 months, and FAA runway data): runway utilization = operations ÷ ASV; sub-score = the utilization as a percentage, capped at 100; missing when the airport has no T-100 record or no mappable runway layout.
2. **Unmet demand: "Are people being turned away?"**
   - **Meaning:** travelers who want to fly but can't because the seats are full. That's money new capacity would capture.
   - **What it checks:** whether the airport is "full and still growing".
   - **How:** load factor = passengers ÷ seats. At an ~80–85% average, peak flights sell out and passengers spill to other airports or don't fly. True spill needs booking data, so load factor is the proxy. The score is the load factor itself: 81.7% full scores 81.7 (capped at 100, since a few airports report above 100%), the same whichever airports are compared.
   - **Status:** computed (BTS T-100, latest 12 months): load factor = passengers ÷ seats; sub-score = the load factor as a percentage, capped at 100.
3. **Long-haul share: "Does it fly the valuable routes?"**
   - **Meaning:** the share of long international trips (widebodies to Europe or Asia).
   - **How:** international seats ÷ total seats, scored out of 50%: 50% international seats = full marks (40% scores 80; LAX at 30.8% scores 61.6; above 50% is capped at 100), the same whichever airports are compared. These flights are worth more:
     - landing fees scale with weight (a 777 pays ~$5,400 per landing vs. a few hundred for a small jet);
     - international passengers spend more;
     - customs facilities are expensive and hard to copy, so this traffic is sticky and high-margin.
   - **Status:** computed (BTS T-100, latest 12 months): international seats ÷ total seats; sub-score = that share ÷ 50% × 100, capped at 100.
4. **Growth: "Is demand real and lasting?"**
   - **Meaning:** is traffic truly rising over the years, or was a busy year a fluke?
   - **How:** the 5-year passenger (enplanement) growth rate, CY2019→CY2024, in percent per year. Rising means durable demand; falling means risky.
   - **Status:** computed (FAA enplanement data): 5-year enplanement growth rate, CY2019→CY2024; missing when the airport has no CY2019 or CY2024 figure.

## The formula
- **Score = 0.30·Congestion + 0.30·Unmet demand + 0.20·Long-haul + 0.20·Growth**, each category scored 0–100, so the final score is 0–100.
- **Need 0.60** (Congestion + Unmet demand) / **Quality 0.40** (Long-haul + Growth).
- **Method:** congestion's operations are T-100 departures × 2, a **lower bound** (general-aviation and military flights are not in T-100), so its utilization is too; its capacity is the FAA's published capacity profile for the 30 Core airports and the FAA AC 150/5060-5 Figure 2-1 estimate (extended for parallel layouts it does not draw) for the rest. Each raw KPI is winsorized at the 5th and 95th percentile (so one extreme airport does not squash the rest), then min-max scaled to 0–100 (except the three percentage categories, which are not winsorized: congestion is the runway-utilization percentage itself and unmet demand the load factor percentage itself, both capped at 100, and long-haul is the international share out of 50%, capped at 100), then the weighted sum above is taken.
- **Coverage renormalization:** if a category has no data for an airport, it is left out and the remaining weights are scaled up to sum to 1. `coverage` is the share of the full model that had data (1.0 = all four categories); `missing` lists the categories left out.
- **Relative mode vs. absolute mode:** with 2 or more airports, they are scaled against each other (for the min-max categories, 100 = the best of the compared set; for congestion, unmet demand and long-haul the score does not depend on the compared set: the runway utilization %, the load factor %, and the international share out of 50%, each capped at 100). With 1 airport, it is scaled against all US airports (absolute mode).
