1. **Congestion: "Is this airport too full?"**
   - **Meaning:** how crowded the airport already is. Adding capacity helps most at a packed airport.
   - **What it checks:** flights handled vs. flights it was built to handle.
   - **How:** actual flights ÷ capacity. Near or over 100% means congested. The FAA starts planning expansion at 60% full and builds at 80%.
   - **Status:** v0 not computed (needs BTS T-100 operations); v1.
2. **Unmet demand: "Are people being turned away?"**
   - **Meaning:** travelers who want to fly but can't because the seats are full. That's money new capacity would capture.
   - **What it checks:** whether the airport is "full and still growing".
   - **Proper way:** load factor. At an ~80–85% average, peak flights sell out and passengers spill to other airports or don't fly.
   - **v0 shortcut:** airport size (total passengers) as a rough proxy.
   - **Status:** v0 proxy; v1 load factor.
3. **Long-haul share: "Does it fly the valuable routes?"**
   - **Meaning:** the share of long international trips (widebodies to Europe or Asia).
   - **How:** international seats ÷ total seats. These flights are worth more:
     - landing fees scale with weight (a 777 pays ~$5,400 per landing vs. a few hundred for a small jet);
     - international passengers spend more;
     - customs facilities are expensive and hard to copy, so this traffic is sticky and high-margin.
   - **Status:** v0 not computed (needs BTS T-100 International); v1.
4. **Growth: "Is demand real and lasting?"**
   - **Meaning:** is traffic truly rising over the years, or was a busy year a fluke?
   - **How:** the 5-year passenger growth rate (2019→2024), plus recovery vs. the pre-COVID peak. Rising means durable demand; falling means risky.
   - **Status:** fully working (real FAA data). It currently separates the airports most, e.g. Denver is highest; LA and SF are lower (still below pre-COVID).
