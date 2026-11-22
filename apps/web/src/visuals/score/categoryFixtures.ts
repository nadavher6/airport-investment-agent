/**
 * Fixtures in the per-category tool output shape (#61), copied from the real tools
 * (`apps/server/src/agent/tools/categoryTools.ts`) run on the merged #62 + #69 code (runway utilization with the refined ASV), except get_unmet_demand which is unchanged: get_unmet_demand([LAX]),
 * get_congestion([LAX, SNA]) and get_congestion([SNA, 2A3, LAX, ATL, ZZZ]) (2A3 has no T-100 record, so its
 * congestion is missing; ZZZ is not found). Plain JSON, as the tool_result carries it.
 */
import type { JsonValue } from "@airport/shared";

export const CATEGORY_ONE = {
  "category": "unmet_demand",
  "label": "Unmet demand (load factor)",
  "weight": 0.3,
  "scale": "percent",
  "unit": "%",
  "note": "Load factor = passengers ÷ seats (BTS T-100 (latest 12 months)). A capacity-pressure proxy for spill: turned-away demand becomes material above ~80-85% load factor; true spill needs booking data. Sub-score = the load factor as a percentage (81.7% scores 81.7), capped at 100.",
  "airports": [
    {
      "airportCode": "LAX",
      "name": "Los Angeles International",
      "available": true,
      "raw": 81.9,
      "subScore": 81.9,
      "evidence": {
        "formula": "load factor = passengers ÷ seats (BTS T-100 (latest 12 months)). Sub-score = load factor as a percentage, capped at 100",
        "inputs": {
          "passengers": 35936676,
          "seats": 43852841,
          "loadFactor": 81.9
        },
        "value": 81.9,
        "explanation": "Planes averaged 81.9% full over the latest 12 months; the fuller they run, the more peak-day demand is spilled (turned away) — material above ~80-85%."
      }
    }
  ],
  "notFound": []
} satisfies JsonValue;

export const CATEGORY_TWO = {
  "category": "congestion",
  "label": "Congestion: runway utilization",
  "weight": 0.3,
  "scale": "percent",
  "unit": "%",
  "note": "Runway utilization = annual operations ÷ Annual Service Volume (ASV), in percent (100% = at capacity). Operations = BTS T-100 (latest 12 months) departures × 2 (arrivals ≈ departures); ASV = for the FAA's 30 Core airports, the FAA Airport Capacity Profiles 2014 hourly rates annualized by FAA AC 150/5060-5 (ASV = weighted hourly capacity × D × H); for other airports, the AC 150/5060-5 Figure 2-1 midpoint for the runway configuration (FAA NASR runways), extended by the figure's own increments for parallel layouts the figure does not draw (data/capacity.json). Sub-score = the utilization percentage (86.8% scores 86.8), capped at 100. T-100 has no general-aviation or military flights, so this is a lower bound; the ASV is a long-range planning estimate. FAA rule of thumb: plan more capacity at 60%, build at 80%.",
  "airports": [
    {
      "airportCode": "LAX",
      "name": "Los Angeles International",
      "available": true,
      "raw": 72.6,
      "subScore": 72.6,
      "evidence": {
        "formula": "runway utilization = annual operations ÷ ASV, in percent (100% = at capacity); operations = BTS T-100 (latest 12 months) departures × 2; ASV = for the FAA's 30 Core airports, the FAA Airport Capacity Profiles 2014 hourly rates annualized by FAA AC 150/5060-5 (ASV = weighted hourly capacity × D × H); for other airports, the AC 150/5060-5 Figure 2-1 midpoint for the runway configuration (FAA NASR runways), extended by the figure's own increments for parallel layouts the figure does not draw. Sub-score = utilization as a percentage, capped at 100",
        "inputs": {
          "departures": 266820,
          "operations": 533640,
          "asv": 734800,
          "asvSource": "faa-capacity-profile",
          "utilization": 0.7262,
          "utilizationPct": 72.6,
          "runwayConfiguration": "Figure 2-1 no. 8: four parallel runways: two close pairs (700-2,499 ft) 4,300 ft or more apart",
          "runways": "06L/24R, 06R/24L, 07L/25R, 07R/25L"
        },
        "value": 72.6,
        "explanation": "533,640 operations a year (266,820 T-100 departures × 2) against an estimated annual capacity of 734,800 (FAA Airport Capacity Profiles (May 2014), Table 1 \"Capacity Rate Ranges for Current Operations at the Core Airports\", p. 9: 171.5 visual and 138 instrument operations an hour (range midpoints), weighted 90/10 = 168.2/h, × 4,370 (AC 150/5060-5 Table 2-1 D × H)): at 72.6% of its estimated capacity, past the FAA's 60% planning trigger. Operations are a lower bound: T-100 has no general-aviation or military flights, so the real utilization is higher."
      }
    },
    {
      "airportCode": "SNA",
      "name": "John Wayne/Orange County",
      "available": true,
      "raw": 47.3,
      "subScore": 47.3,
      "evidence": {
        "formula": "runway utilization = annual operations ÷ ASV, in percent (100% = at capacity); operations = BTS T-100 (latest 12 months) departures × 2; ASV = for the FAA's 30 Core airports, the FAA Airport Capacity Profiles 2014 hourly rates annualized by FAA AC 150/5060-5 (ASV = weighted hourly capacity × D × H); for other airports, the AC 150/5060-5 Figure 2-1 midpoint for the runway configuration (FAA NASR runways), extended by the figure's own increments for parallel layouts the figure does not draw. Sub-score = utilization as a percentage, capped at 100",
        "inputs": {
          "departures": 51447,
          "operations": 102894,
          "asv": 217500,
          "asvSource": "figure-2-1",
          "utilization": 0.4731,
          "utilizationPct": 47.3,
          "runwayConfiguration": "Figure 2-1 no. 1: single runway",
          "runways": "02L/20R, 02R/20L"
        },
        "value": 47.3,
        "explanation": "102,894 operations a year (51,447 T-100 departures × 2) against an estimated annual capacity of 217,500 (AC 150/5060-5 Figure 2-1 configuration 1 (single runway), row midpoint): at 47.3% of its estimated capacity, below the FAA's 60% planning trigger. Operations are a lower bound: T-100 has no general-aviation or military flights, so the real utilization is higher."
      }
    }
  ],
  "notFound": []
} satisfies JsonValue;

export const CATEGORY_FOUR = {
  "category": "congestion",
  "label": "Congestion: runway utilization",
  "weight": 0.3,
  "scale": "percent",
  "unit": "%",
  "note": "Runway utilization = annual operations ÷ Annual Service Volume (ASV), in percent (100% = at capacity). Operations = BTS T-100 (latest 12 months) departures × 2 (arrivals ≈ departures); ASV = for the FAA's 30 Core airports, the FAA Airport Capacity Profiles 2014 hourly rates annualized by FAA AC 150/5060-5 (ASV = weighted hourly capacity × D × H); for other airports, the AC 150/5060-5 Figure 2-1 midpoint for the runway configuration (FAA NASR runways), extended by the figure's own increments for parallel layouts the figure does not draw (data/capacity.json). Sub-score = the utilization percentage (86.8% scores 86.8), capped at 100. T-100 has no general-aviation or military flights, so this is a lower bound; the ASV is a long-range planning estimate. FAA rule of thumb: plan more capacity at 60%, build at 80%.",
  "airports": [
    {
      "airportCode": "SNA",
      "name": "John Wayne/Orange County",
      "available": true,
      "raw": 47.3,
      "subScore": 47.3,
      "evidence": {
        "formula": "runway utilization = annual operations ÷ ASV, in percent (100% = at capacity); operations = BTS T-100 (latest 12 months) departures × 2; ASV = for the FAA's 30 Core airports, the FAA Airport Capacity Profiles 2014 hourly rates annualized by FAA AC 150/5060-5 (ASV = weighted hourly capacity × D × H); for other airports, the AC 150/5060-5 Figure 2-1 midpoint for the runway configuration (FAA NASR runways), extended by the figure's own increments for parallel layouts the figure does not draw. Sub-score = utilization as a percentage, capped at 100",
        "inputs": {
          "departures": 51447,
          "operations": 102894,
          "asv": 217500,
          "asvSource": "figure-2-1",
          "utilization": 0.4731,
          "utilizationPct": 47.3,
          "runwayConfiguration": "Figure 2-1 no. 1: single runway",
          "runways": "02L/20R, 02R/20L"
        },
        "value": 47.3,
        "explanation": "102,894 operations a year (51,447 T-100 departures × 2) against an estimated annual capacity of 217,500 (AC 150/5060-5 Figure 2-1 configuration 1 (single runway), row midpoint): at 47.3% of its estimated capacity, below the FAA's 60% planning trigger. Operations are a lower bound: T-100 has no general-aviation or military flights, so the real utilization is higher."
      }
    },
    {
      "airportCode": "2A3",
      "name": "Larsen Bay",
      "available": false,
      "raw": null,
      "subScore": null,
      "evidence": {
        "formula": "runway utilization = annual operations ÷ ASV, in percent (100% = at capacity); operations = BTS T-100 (latest 12 months) departures × 2; ASV = for the FAA's 30 Core airports, the FAA Airport Capacity Profiles 2014 hourly rates annualized by FAA AC 150/5060-5 (ASV = weighted hourly capacity × D × H); for other airports, the AC 150/5060-5 Figure 2-1 midpoint for the runway configuration (FAA NASR runways), extended by the figure's own increments for parallel layouts the figure does not draw. Sub-score = utilization as a percentage, capped at 100",
        "inputs": {
          "departures": null,
          "operations": null,
          "asv": 217500,
          "asvSource": "figure-2-1",
          "utilization": null,
          "utilizationPct": null,
          "runwayConfiguration": "Figure 2-1 no. 1: single runway",
          "runways": "04/22"
        },
        "value": null,
        "explanation": "No BTS T-100 record for this airport, so its annual operations are unknown and congestion is missing."
      }
    },
    {
      "airportCode": "LAX",
      "name": "Los Angeles International",
      "available": true,
      "raw": 72.6,
      "subScore": 72.6,
      "evidence": {
        "formula": "runway utilization = annual operations ÷ ASV, in percent (100% = at capacity); operations = BTS T-100 (latest 12 months) departures × 2; ASV = for the FAA's 30 Core airports, the FAA Airport Capacity Profiles 2014 hourly rates annualized by FAA AC 150/5060-5 (ASV = weighted hourly capacity × D × H); for other airports, the AC 150/5060-5 Figure 2-1 midpoint for the runway configuration (FAA NASR runways), extended by the figure's own increments for parallel layouts the figure does not draw. Sub-score = utilization as a percentage, capped at 100",
        "inputs": {
          "departures": 266820,
          "operations": 533640,
          "asv": 734800,
          "asvSource": "faa-capacity-profile",
          "utilization": 0.7262,
          "utilizationPct": 72.6,
          "runwayConfiguration": "Figure 2-1 no. 8: four parallel runways: two close pairs (700-2,499 ft) 4,300 ft or more apart",
          "runways": "06L/24R, 06R/24L, 07L/25R, 07R/25L"
        },
        "value": 72.6,
        "explanation": "533,640 operations a year (266,820 T-100 departures × 2) against an estimated annual capacity of 734,800 (FAA Airport Capacity Profiles (May 2014), Table 1 \"Capacity Rate Ranges for Current Operations at the Core Airports\", p. 9: 171.5 visual and 138 instrument operations an hour (range midpoints), weighted 90/10 = 168.2/h, × 4,370 (AC 150/5060-5 Table 2-1 D × H)): at 72.6% of its estimated capacity, past the FAA's 60% planning trigger. Operations are a lower bound: T-100 has no general-aviation or military flights, so the real utilization is higher."
      }
    },
    {
      "airportCode": "ATL",
      "name": "Hartsfield/Jackson Atlanta International",
      "available": true,
      "raw": 82.8,
      "subScore": 82.8,
      "evidence": {
        "formula": "runway utilization = annual operations ÷ ASV, in percent (100% = at capacity); operations = BTS T-100 (latest 12 months) departures × 2; ASV = for the FAA's 30 Core airports, the FAA Airport Capacity Profiles 2014 hourly rates annualized by FAA AC 150/5060-5 (ASV = weighted hourly capacity × D × H); for other airports, the AC 150/5060-5 Figure 2-1 midpoint for the runway configuration (FAA NASR runways), extended by the figure's own increments for parallel layouts the figure does not draw. Sub-score = utilization as a percentage, capped at 100",
        "inputs": {
          "departures": 393351,
          "operations": 786702,
          "asv": 949800,
          "asvSource": "faa-capacity-profile",
          "utilization": 0.8283,
          "utilizationPct": 82.8,
          "runwayConfiguration": "Figure 2-1 no. 8: four parallel runways: two close pairs (700-2,499 ft) 4,300 ft or more apart",
          "runways": "08L/26R, 08R/26L, 09L/27R, 09R/27L, 10/28"
        },
        "value": 82.8,
        "explanation": "786,702 operations a year (393,351 T-100 departures × 2) against an estimated annual capacity of 949,800 (FAA Airport Capacity Profiles (May 2014), Table 1 \"Capacity Rate Ranges for Current Operations at the Core Airports\", p. 9: 221 visual and 184.5 instrument operations an hour (range midpoints), weighted 90/10 = 217.4/h, × 4,370 (AC 150/5060-5 Table 2-1 D × H)): at 82.8% of its estimated capacity, past the FAA's 80% trigger to start building more capacity. Operations are a lower bound: T-100 has no general-aviation or military flights, so the real utilization is higher."
      }
    }
  ],
  "notFound": [
    "ZZZ"
  ]
} satisfies JsonValue;
