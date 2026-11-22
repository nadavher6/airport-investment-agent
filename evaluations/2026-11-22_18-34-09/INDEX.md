# Eval run

Ran 44 case(s) on 2026-11-22 16:19 with claude-headless (default).

| Case | Group | Turns | Tools used |
|---|---|---|---|
| [greet-hi](cases/greet-hi.md) | G1-greeting | 1 | (none) |
| [greet-howareyou](cases/greet-howareyou.md) | G1-greeting | 1 | (none) |
| [greet-thanks](cases/greet-thanks.md) | G1-greeting | 1 | (none) |
| [cap-what](cases/cap-what.md) | G2-capabilities | 1 | (none) |
| [cap-how](cases/cap-how.md) | G2-capabilities | 1 | (none) |
| [cap-data](cases/cap-data.md) | G2-capabilities | 1 | (none) |
| [off-weather](cases/off-weather.md) | G3-offtopic | 1 | (none) |
| [off-code](cases/off-code.md) | G3-offtopic | 1 | (none) |
| [off-stock](cases/off-stock.md) | G3-offtopic | 1 | (none) |
| [inj-sysprompt](cases/inj-sysprompt.md) | G3-offtopic | 1 | (none) |
| [inj-role](cases/inj-role.md) | G3-offtopic | 1 | (none) |
| [single-bos-growth](cases/single-bos-growth.md) | G4-single | 1 | get_enplanements |
| [single-sfo-unmet](cases/single-sfo-unmet.md) | G4-single | 1 | score_airports |
| [single-anc-longhaul](cases/single-anc-longhaul.md) | G4-single | 1 | find_airports_by_city, score_airports |
| [single-den-score](cases/single-den-score.md) | G4-single | 1 | find_airports_by_city, score_airports |
| [single-bos-followup](cases/single-bos-followup.md) | G4-single | 2 | get_enplanements |
| [place-newengland](cases/place-newengland.md) | G5-place | 1 | find_airports_by_region, score_airports |
| [place-la-sna](cases/place-la-sna.md) | G5-place | 1 | find_airports_by_city, score_airports |
| [place-bayarea](cases/place-bayarea.md) | G5-place | 1 | find_airports_by_city, score_airports |
| [place-state](cases/place-state.md) | G5-place | 1 | find_airports_by_city, score_airports |
| [cmp-lax-sfo](cases/cmp-lax-sfo.md) | G6-compare | 1 | score_airports |
| [cmp-ord-dfw](cases/cmp-ord-dfw.md) | G6-compare | 1 | score_airports |
| [cmp-jfk-ewr](cases/cmp-jfk-ewr.md) | G6-compare | 1 | score_airports |
| [cmp-followup](cases/cmp-followup.md) | G6-compare | 2 | score_airports |
| [rank-fastest](cases/rank-fastest.md) | G7-rank | 1 | score_airports |
| [rank-southwest](cases/rank-southwest.md) | G7-rank | 1 | find_airports_by_region, score_airports |
| [rank-explicit5](cases/rank-explicit5.md) | G7-rank | 1 | score_airports |
| [rank-followup](cases/rank-followup.md) | G7-rank | 2 | find_airports_by_region, score_airports |
| [kpi-limits](cases/kpi-limits.md) | G8-method | 1 | (none) |
| [kpi-weights](cases/kpi-weights.md) | G8-method | 1 | (none) |
| [kpi-congestion](cases/kpi-congestion.md) | G8-method | 1 | (none) |
| [mem-why](cases/mem-why.md) | G9-memory | 2 | score_airports |
| [mem-add](cases/mem-add.md) | G9-memory | 2 | score_airports, find_airports_by_city |
| [mem-it](cases/mem-it.md) | G9-memory | 2 | get_enplanements, score_airports |
| [mem-switch](cases/mem-switch.md) | G9-memory | 2 | score_airports, find_airports_by_city |
| [amb-icao](cases/amb-icao.md) | G10-unknown | 1 | get_enplanements |
| [amb-badcode](cases/amb-badcode.md) | G10-unknown | 1 | get_airport_by_code |
| [amb-nopre](cases/amb-nopre.md) | G10-unknown | 1 | (none) |
| [rob-leading](cases/rob-leading.md) | G11-adversarial | 1 | get_enplanements |
| [rob-fakeairport](cases/rob-fakeairport.md) | G11-adversarial | 1 | find_airports_by_city |
| [rob-multi](cases/rob-multi.md) | G11-adversarial | 1 | score_airports |
| [long-consistency](cases/long-consistency.md) | G12-long | 5 | get_enplanements, score_airports |
| [long-interrupt](cases/long-interrupt.md) | G12-long | 5 | find_airports_by_city, score_airports |
| [long-accumulate](cases/long-accumulate.md) | G12-long | 5 | score_airports |
