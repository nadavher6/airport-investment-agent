# Eval run

Ran 15 case(s) on 2026-11-22 14:54 with claude-headless (default).

| Case | Group | Turns | Tools used |
|---|---|---|---|
| [greet-hi](cases/greet-hi.md) | G1-greeting | 1 | (none) |
| [cap-what](cases/cap-what.md) | G2-capabilities | 1 | (none) |
| [off-weather](cases/off-weather.md) | G3-offtopic | 1 | (none) |
| [inj-sysprompt](cases/inj-sysprompt.md) | G3-offtopic | 1 | (none) |
| [single-bos-growth](cases/single-bos-growth.md) | G4-single | 1 | get_enplanements |
| [single-sfo-unmet](cases/single-sfo-unmet.md) | G4-single | 1 | score_airports |
| [place-newengland](cases/place-newengland.md) | G5-place | 1 | find_airports_by_region, score_airports |
| [cmp-lax-sfo](cases/cmp-lax-sfo.md) | G6-compare | 1 | score_airports |
| [rank-fastest](cases/rank-fastest.md) | G7-rank | 1 | find_airports_by_region |
| [kpi-limits](cases/kpi-limits.md) | G8-method | 1 | (none) |
| [mem-why](cases/mem-why.md) | G9-memory | 2 | score_airports |
| [mem-add](cases/mem-add.md) | G9-memory | 2 | score_airports, find_airports_by_city |
| [amb-icao](cases/amb-icao.md) | G10-unknown | 1 | get_enplanements |
| [rob-leading](cases/rob-leading.md) | G11-adversarial | 1 | get_enplanements |
| [long-consistency](cases/long-consistency.md) | G12-long | 5 | get_enplanements |
