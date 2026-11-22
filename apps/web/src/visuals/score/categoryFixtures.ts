/**
 * Fixtures in the per-category tool output shape (#61), copied from the real tools
 * (`apps/server/src/agent/tools/categoryTools.ts`) run on main dde1b37 (with the `unit` field added by the tool since): get_unmet_demand([LAX]),
 * get_congestion([LAX, SNA]) and get_congestion([SNA, 2A3, LAX, ATL, ZZZ]) (2A3 has no T-100 record, so its
 * congestion is missing; ZZZ is not found). Plain JSON, as the tool_result carries it.
 */
import type { JsonValue } from "@airport/shared";

export const CATEGORY_ONE = {
  "category": "unmet_demand",
  "label": "Unmet demand (load factor)",
  "weight": 0.3,
  "mode": "absolute",
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
  "label": "Congestion / capacity pressure",
  "weight": 0.3,
  "mode": "absolute",
  "scale": "minmax",
  "unit": "departures/yr",
  "note": "Annual departures (operations) from BTS T-100 (latest 12 months) — a traffic-volume proxy; a true utilization ratio (operations ÷ FAA ASV) needs runway-capacity data not freely tabulated.",
  "airports": [
    {
      "airportCode": "LAX",
      "name": "Los Angeles International",
      "available": true,
      "raw": 266820,
      "subScore": 100,
      "evidence": {
        "formula": "annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)",
        "inputs": {
          "departures": 266820
        },
        "value": 266820,
        "explanation": "266,820 departures over the latest 12 months — a busy airfield is more congestion-prone (capacity denominator ASV is not freely published, so volume is used as the proxy)."
      }
    },
    {
      "airportCode": "SNA",
      "name": "John Wayne/Orange County",
      "available": true,
      "raw": 51447,
      "subScore": 50.3,
      "evidence": {
        "formula": "annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)",
        "inputs": {
          "departures": 51447
        },
        "value": 51447,
        "explanation": "51,447 departures over the latest 12 months — a busy airfield is more congestion-prone (capacity denominator ASV is not freely published, so volume is used as the proxy)."
      }
    }
  ],
  "notFound": []
} satisfies JsonValue;

export const CATEGORY_FOUR = {
  "category": "congestion",
  "label": "Congestion / capacity pressure",
  "weight": 0.3,
  "mode": "absolute",
  "scale": "minmax",
  "unit": "departures/yr",
  "note": "Annual departures (operations) from BTS T-100 (latest 12 months) — a traffic-volume proxy; a true utilization ratio (operations ÷ FAA ASV) needs runway-capacity data not freely tabulated.",
  "airports": [
    {
      "airportCode": "SNA",
      "name": "John Wayne/Orange County",
      "available": true,
      "raw": 51447,
      "subScore": 50.3,
      "evidence": {
        "formula": "annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)",
        "inputs": {
          "departures": 51447
        },
        "value": 51447,
        "explanation": "51,447 departures over the latest 12 months — a busy airfield is more congestion-prone (capacity denominator ASV is not freely published, so volume is used as the proxy)."
      }
    },
    {
      "airportCode": "2A3",
      "name": "Larsen Bay",
      "available": false,
      "raw": null,
      "subScore": null,
      "evidence": {
        "formula": "annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)",
        "inputs": {
          "departures": null
        },
        "value": null,
        "explanation": "No BTS T-100 record for this airport."
      }
    },
    {
      "airportCode": "LAX",
      "name": "Los Angeles International",
      "available": true,
      "raw": 266820,
      "subScore": 100,
      "evidence": {
        "formula": "annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)",
        "inputs": {
          "departures": 266820
        },
        "value": 266820,
        "explanation": "266,820 departures over the latest 12 months — a busy airfield is more congestion-prone (capacity denominator ASV is not freely published, so volume is used as the proxy)."
      }
    },
    {
      "airportCode": "ATL",
      "name": "Hartsfield/Jackson Atlanta International",
      "available": true,
      "raw": 393351,
      "subScore": 100,
      "evidence": {
        "formula": "annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)",
        "inputs": {
          "departures": 393351
        },
        "value": 393351,
        "explanation": "393,351 departures over the latest 12 months — a busy airfield is more congestion-prone (capacity denominator ASV is not freely published, so volume is used as the proxy)."
      }
    }
  ],
  "notFound": [
    "ZZZ"
  ]
} satisfies JsonValue;
