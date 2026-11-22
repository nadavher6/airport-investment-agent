/**
 * Fixtures in the score_airports output shape (#41; shape from PR #38's scoreAirports.ts).
 * Built from the real BTS T-100 and FAA inputs PR #38 uses (departures, load factor,
 * international share, 5-year CAGR) with #38's formulas (the sub-scores predate the fixed scales of
 * #57 / #62 / #75; the view only draws them), weights renormalized over the computed categories,
 * contributions and scores to 1 decimal. LAX's growth is left out on purpose in SCORE_ONE and SNA's in SCORE_FIVE, to show
 * a missing category. Plain JSON, as the tool_result carries it.
 */
import type { JsonValue } from "@airport/shared";

export const SCORE_ONE = {
  "ranking": [
    {
      "airportCode": "LAX",
      "name": "Los Angeles International",
      "score": 88,
      "coverage": 0.8,
      "missing": [
        "growth"
      ],
      "breakdown": {
        "congestion": {
          "label": "Congestion / capacity pressure",
          "weight": 0.3,
          "available": true,
          "subScore": 88.4,
          "contribution": 33.2,
          "evidence": {
            "formula": "annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)",
            "inputs": {
              "departures": 266820
            },
            "value": 266820,
            "explanation": "266,820 departures over the latest 12 months — a busy airfield is more congestion-prone (capacity denominator ASV is not freely published, so volume is used as the proxy)."
          }
        },
        "unmet_demand": {
          "label": "Unmet demand (load factor)",
          "weight": 0.3,
          "available": true,
          "subScore": 79.6,
          "contribution": 29.8,
          "evidence": {
            "formula": "load factor = passengers ÷ seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "passengers": 35936676,
              "seats": 43852841,
              "loadFactor": 81.9
            },
            "value": 81.9,
            "explanation": "Planes averaged 81.9% full over the latest 12 months; the fuller they run, the more peak-day demand is spilled (turned away) — material above ~80-85%."
          }
        },
        "long_haul": {
          "label": "Long-haul share",
          "weight": 0.2,
          "available": true,
          "subScore": 100,
          "contribution": 25,
          "evidence": {
            "formula": "international seats ÷ total seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "internationalSeats": 13518823,
              "seats": 43852841,
              "internationalShare": 30.8
            },
            "value": 30.8,
            "explanation": "30.8% of seats were international over the latest 12 months — high-margin traffic (weight-based fees, FIS/customs moat)."
          }
        },
        "growth": {
          "label": "Growth / durability",
          "weight": 0.2,
          "available": false,
          "subScore": null,
          "contribution": null,
          "evidence": {
            "formula": "5-year enplanement CAGR, FY2019→FY2024 (fallback: recoveryVs2019 − 1)",
            "inputs": {
              "cagr5yr": null,
              "recoveryVs2019": null,
              "enplanements": 37760834,
              "year": 2024
            },
            "value": null,
            "explanation": "No growth data available for this airport."
          }
        }
      }
    }
  ],
  "notFound": []
} satisfies JsonValue;

export const SCORE_TWO = {
  "ranking": [
    {
      "airportCode": "JFK",
      "name": "John F Kennedy International",
      "score": 55,
      "coverage": 1,
      "missing": [],
      "breakdown": {
        "congestion": {
          "label": "Congestion / capacity pressure",
          "weight": 0.3,
          "available": true,
          "subScore": 0,
          "contribution": 0,
          "evidence": {
            "formula": "annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)",
            "inputs": {
              "departures": 212209
            },
            "value": 212209,
            "explanation": "212,209 departures over the latest 12 months — a busy airfield is more congestion-prone (capacity denominator ASV is not freely published, so volume is used as the proxy)."
          }
        },
        "unmet_demand": {
          "label": "Unmet demand (load factor)",
          "weight": 0.3,
          "available": true,
          "subScore": 50,
          "contribution": 15,
          "evidence": {
            "formula": "load factor = passengers ÷ seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "passengers": 29576848,
              "seats": 36117046,
              "loadFactor": 81.9
            },
            "value": 81.9,
            "explanation": "Planes averaged 81.9% full over the latest 12 months; the fuller they run, the more peak-day demand is spilled (turned away) — material above ~80-85%."
          }
        },
        "long_haul": {
          "label": "Long-haul share",
          "weight": 0.2,
          "available": true,
          "subScore": 100,
          "contribution": 20,
          "evidence": {
            "formula": "international seats ÷ total seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "internationalSeats": 19105128,
              "seats": 36117046,
              "internationalShare": 52.9
            },
            "value": 52.9,
            "explanation": "52.9% of seats were international over the latest 12 months — high-margin traffic (weight-based fees, FIS/customs moat)."
          }
        },
        "growth": {
          "label": "Growth / durability",
          "weight": 0.2,
          "available": true,
          "subScore": 100,
          "contribution": 20,
          "evidence": {
            "formula": "5-year enplanement CAGR, FY2019→FY2024 (fallback: recoveryVs2019 − 1)",
            "inputs": {
              "cagr5yr": 0.2752,
              "recoveryVs2019": 1.0138,
              "enplanements": 31466102,
              "year": 2024
            },
            "value": 0.2752,
            "explanation": "Passengers grew 0.3% per year on average from 2019 to 2024."
          }
        }
      }
    },
    {
      "airportCode": "LAX",
      "name": "Los Angeles International",
      "score": 45,
      "coverage": 1,
      "missing": [],
      "breakdown": {
        "congestion": {
          "label": "Congestion / capacity pressure",
          "weight": 0.3,
          "available": true,
          "subScore": 100,
          "contribution": 30,
          "evidence": {
            "formula": "annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)",
            "inputs": {
              "departures": 266820
            },
            "value": 266820,
            "explanation": "266,820 departures over the latest 12 months — a busy airfield is more congestion-prone (capacity denominator ASV is not freely published, so volume is used as the proxy)."
          }
        },
        "unmet_demand": {
          "label": "Unmet demand (load factor)",
          "weight": 0.3,
          "available": true,
          "subScore": 50,
          "contribution": 15,
          "evidence": {
            "formula": "load factor = passengers ÷ seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "passengers": 35936676,
              "seats": 43852841,
              "loadFactor": 81.9
            },
            "value": 81.9,
            "explanation": "Planes averaged 81.9% full over the latest 12 months; the fuller they run, the more peak-day demand is spilled (turned away) — material above ~80-85%."
          }
        },
        "long_haul": {
          "label": "Long-haul share",
          "weight": 0.2,
          "available": true,
          "subScore": 0,
          "contribution": 0,
          "evidence": {
            "formula": "international seats ÷ total seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "internationalSeats": 13518823,
              "seats": 43852841,
              "internationalShare": 30.8
            },
            "value": 30.8,
            "explanation": "30.8% of seats were international over the latest 12 months — high-margin traffic (weight-based fees, FIS/customs moat)."
          }
        },
        "growth": {
          "label": "Growth / durability",
          "weight": 0.2,
          "available": true,
          "subScore": 0,
          "contribution": 0,
          "evidence": {
            "formula": "5-year enplanement CAGR, FY2019→FY2024 (fallback: recoveryVs2019 − 1)",
            "inputs": {
              "cagr5yr": -2.5375,
              "recoveryVs2019": 0.8794,
              "enplanements": 37760834,
              "year": 2024
            },
            "value": -2.5375,
            "explanation": "Passengers grew -2.5% per year on average from 2019 to 2024."
          }
        }
      }
    }
  ],
  "notFound": [
    "ZZZ"
  ]
} satisfies JsonValue;

export const SCORE_THREE = {
  "ranking": [
    {
      "airportCode": "LAX",
      "name": "Los Angeles International",
      "score": 71.9,
      "coverage": 1,
      "missing": [],
      "breakdown": {
        "congestion": {
          "label": "Congestion / capacity pressure",
          "weight": 0.3,
          "available": true,
          "subScore": 73.1,
          "contribution": 21.9,
          "evidence": {
            "formula": "annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)",
            "inputs": {
              "departures": 266820
            },
            "value": 266820,
            "explanation": "266,820 departures over the latest 12 months — a busy airfield is more congestion-prone (capacity denominator ASV is not freely published, so volume is used as the proxy)."
          }
        },
        "unmet_demand": {
          "label": "Unmet demand (load factor)",
          "weight": 0.3,
          "available": true,
          "subScore": 100,
          "contribution": 30,
          "evidence": {
            "formula": "load factor = passengers ÷ seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "passengers": 35936676,
              "seats": 43852841,
              "loadFactor": 81.9
            },
            "value": 81.9,
            "explanation": "Planes averaged 81.9% full over the latest 12 months; the fuller they run, the more peak-day demand is spilled (turned away) — material above ~80-85%."
          }
        },
        "long_haul": {
          "label": "Long-haul share",
          "weight": 0.2,
          "available": true,
          "subScore": 100,
          "contribution": 20,
          "evidence": {
            "formula": "international seats ÷ total seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "internationalSeats": 13518823,
              "seats": 43852841,
              "internationalShare": 30.8
            },
            "value": 30.8,
            "explanation": "30.8% of seats were international over the latest 12 months — high-margin traffic (weight-based fees, FIS/customs moat)."
          }
        },
        "growth": {
          "label": "Growth / durability",
          "weight": 0.2,
          "available": true,
          "subScore": 0,
          "contribution": 0,
          "evidence": {
            "formula": "5-year enplanement CAGR, FY2019→FY2024 (fallback: recoveryVs2019 − 1)",
            "inputs": {
              "cagr5yr": -2.5375,
              "recoveryVs2019": 0.8794,
              "enplanements": 37760834,
              "year": 2024
            },
            "value": -2.5375,
            "explanation": "Passengers grew -2.5% per year on average from 2019 to 2024."
          }
        }
      }
    },
    {
      "airportCode": "DEN",
      "name": "Denver International",
      "score": 69.9,
      "coverage": 1,
      "missing": [],
      "breakdown": {
        "congestion": {
          "label": "Congestion / capacity pressure",
          "weight": 0.3,
          "available": true,
          "subScore": 100,
          "contribution": 30,
          "evidence": {
            "formula": "annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)",
            "inputs": {
              "departures": 345892
            },
            "value": 345892,
            "explanation": "345,892 departures over the latest 12 months — a busy airfield is more congestion-prone (capacity denominator ASV is not freely published, so volume is used as the proxy)."
          }
        },
        "unmet_demand": {
          "label": "Unmet demand (load factor)",
          "weight": 0.3,
          "available": true,
          "subScore": 57.7,
          "contribution": 17.3,
          "evidence": {
            "formula": "load factor = passengers ÷ seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "passengers": 40219855,
              "seats": 49751704,
              "loadFactor": 80.8
            },
            "value": 80.8,
            "explanation": "Planes averaged 80.8% full over the latest 12 months; the fuller they run, the more peak-day demand is spilled (turned away) — material above ~80-85%."
          }
        },
        "long_haul": {
          "label": "Long-haul share",
          "weight": 0.2,
          "available": true,
          "subScore": 12.9,
          "contribution": 2.6,
          "evidence": {
            "formula": "international seats ÷ total seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "internationalSeats": 2893423,
              "seats": 49751704,
              "internationalShare": 5.8
            },
            "value": 5.8,
            "explanation": "5.8% of seats were international over the latest 12 months — high-margin traffic (weight-based fees, FIS/customs moat)."
          }
        },
        "growth": {
          "label": "Growth / durability",
          "weight": 0.2,
          "available": true,
          "subScore": 100,
          "contribution": 20,
          "evidence": {
            "formula": "5-year enplanement CAGR, FY2019→FY2024 (fallback: recoveryVs2019 − 1)",
            "inputs": {
              "cagr5yr": 3.5596,
              "recoveryVs2019": 1.1911,
              "enplanements": 40012895,
              "year": 2024
            },
            "value": 3.5596,
            "explanation": "Passengers grew 3.6% per year on average from 2019 to 2024."
          }
        }
      }
    },
    {
      "airportCode": "SNA",
      "name": "John Wayne/Orange County",
      "score": 11,
      "coverage": 1,
      "missing": [],
      "breakdown": {
        "congestion": {
          "label": "Congestion / capacity pressure",
          "weight": 0.3,
          "available": true,
          "subScore": 0,
          "contribution": 0,
          "evidence": {
            "formula": "annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)",
            "inputs": {
              "departures": 51447
            },
            "value": 51447,
            "explanation": "51,447 departures over the latest 12 months — a busy airfield is more congestion-prone (capacity denominator ASV is not freely published, so volume is used as the proxy)."
          }
        },
        "unmet_demand": {
          "label": "Unmet demand (load factor)",
          "weight": 0.3,
          "available": true,
          "subScore": 0,
          "contribution": 0,
          "evidence": {
            "formula": "load factor = passengers ÷ seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "passengers": 5504528,
              "seats": 6940936,
              "loadFactor": 79.3
            },
            "value": 79.3,
            "explanation": "Planes averaged 79.3% full over the latest 12 months; the fuller they run, the more peak-day demand is spilled (turned away) — material above ~80-85%."
          }
        },
        "long_haul": {
          "label": "Long-haul share",
          "weight": 0.2,
          "available": true,
          "subScore": 0,
          "contribution": 0,
          "evidence": {
            "formula": "international seats ÷ total seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "internationalSeats": 145573,
              "seats": 6940936,
              "internationalShare": 2.1
            },
            "value": 2.1,
            "explanation": "2.1% of seats were international over the latest 12 months — high-margin traffic (weight-based fees, FIS/customs moat)."
          }
        },
        "growth": {
          "label": "Growth / durability",
          "weight": 0.2,
          "available": true,
          "subScore": 55.2,
          "contribution": 11,
          "evidence": {
            "formula": "5-year enplanement CAGR, FY2019→FY2024 (fallback: recoveryVs2019 − 1)",
            "inputs": {
              "cagr5yr": 0.8283,
              "recoveryVs2019": 1.0421,
              "enplanements": 5370273,
              "year": 2024
            },
            "value": 0.8283,
            "explanation": "Passengers grew 0.8% per year on average from 2019 to 2024."
          }
        }
      }
    }
  ],
  "notFound": []
} satisfies JsonValue;

export const SCORE_FIVE = {
  "ranking": [
    {
      "airportCode": "JFK",
      "name": "John F Kennedy International",
      "score": 75.6,
      "coverage": 1,
      "missing": [],
      "breakdown": {
        "congestion": {
          "label": "Congestion / capacity pressure",
          "weight": 0.3,
          "available": true,
          "subScore": 54.6,
          "contribution": 16.4,
          "evidence": {
            "formula": "annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)",
            "inputs": {
              "departures": 212209
            },
            "value": 212209,
            "explanation": "212,209 departures over the latest 12 months — a busy airfield is more congestion-prone (capacity denominator ASV is not freely published, so volume is used as the proxy)."
          }
        },
        "unmet_demand": {
          "label": "Unmet demand (load factor)",
          "weight": 0.3,
          "available": true,
          "subScore": 100,
          "contribution": 30,
          "evidence": {
            "formula": "load factor = passengers ÷ seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "passengers": 29576848,
              "seats": 36117046,
              "loadFactor": 81.9
            },
            "value": 81.9,
            "explanation": "Planes averaged 81.9% full over the latest 12 months; the fuller they run, the more peak-day demand is spilled (turned away) — material above ~80-85%."
          }
        },
        "long_haul": {
          "label": "Long-haul share",
          "weight": 0.2,
          "available": true,
          "subScore": 100,
          "contribution": 20,
          "evidence": {
            "formula": "international seats ÷ total seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "internationalSeats": 19105128,
              "seats": 36117046,
              "internationalShare": 52.9
            },
            "value": 52.9,
            "explanation": "52.9% of seats were international over the latest 12 months — high-margin traffic (weight-based fees, FIS/customs moat)."
          }
        },
        "growth": {
          "label": "Growth / durability",
          "weight": 0.2,
          "available": true,
          "subScore": 46.1,
          "contribution": 9.2,
          "evidence": {
            "formula": "5-year enplanement CAGR, FY2019→FY2024 (fallback: recoveryVs2019 − 1)",
            "inputs": {
              "cagr5yr": 0.2752,
              "recoveryVs2019": 1.0138,
              "enplanements": 31466102,
              "year": 2024
            },
            "value": 0.2752,
            "explanation": "Passengers grew 0.3% per year on average from 2019 to 2024."
          }
        }
      }
    },
    {
      "airportCode": "DEN",
      "name": "Denver International",
      "score": 68.8,
      "coverage": 1,
      "missing": [],
      "breakdown": {
        "congestion": {
          "label": "Congestion / capacity pressure",
          "weight": 0.3,
          "available": true,
          "subScore": 100,
          "contribution": 30,
          "evidence": {
            "formula": "annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)",
            "inputs": {
              "departures": 345892
            },
            "value": 345892,
            "explanation": "345,892 departures over the latest 12 months — a busy airfield is more congestion-prone (capacity denominator ASV is not freely published, so volume is used as the proxy)."
          }
        },
        "unmet_demand": {
          "label": "Unmet demand (load factor)",
          "weight": 0.3,
          "available": true,
          "subScore": 57.7,
          "contribution": 17.3,
          "evidence": {
            "formula": "load factor = passengers ÷ seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "passengers": 40219855,
              "seats": 49751704,
              "loadFactor": 80.8
            },
            "value": 80.8,
            "explanation": "Planes averaged 80.8% full over the latest 12 months; the fuller they run, the more peak-day demand is spilled (turned away) — material above ~80-85%."
          }
        },
        "long_haul": {
          "label": "Long-haul share",
          "weight": 0.2,
          "available": true,
          "subScore": 7.3,
          "contribution": 1.5,
          "evidence": {
            "formula": "international seats ÷ total seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "internationalSeats": 2893423,
              "seats": 49751704,
              "internationalShare": 5.8
            },
            "value": 5.8,
            "explanation": "5.8% of seats were international over the latest 12 months — high-margin traffic (weight-based fees, FIS/customs moat)."
          }
        },
        "growth": {
          "label": "Growth / durability",
          "weight": 0.2,
          "available": true,
          "subScore": 100,
          "contribution": 20,
          "evidence": {
            "formula": "5-year enplanement CAGR, FY2019→FY2024 (fallback: recoveryVs2019 − 1)",
            "inputs": {
              "cagr5yr": 3.5596,
              "recoveryVs2019": 1.1911,
              "enplanements": 40012895,
              "year": 2024
            },
            "value": 3.5596,
            "explanation": "Passengers grew 3.6% per year on average from 2019 to 2024."
          }
        }
      }
    },
    {
      "airportCode": "LAX",
      "name": "Los Angeles International",
      "score": 63.2,
      "coverage": 1,
      "missing": [],
      "breakdown": {
        "congestion": {
          "label": "Congestion / capacity pressure",
          "weight": 0.3,
          "available": true,
          "subScore": 73.1,
          "contribution": 21.9,
          "evidence": {
            "formula": "annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)",
            "inputs": {
              "departures": 266820
            },
            "value": 266820,
            "explanation": "266,820 departures over the latest 12 months — a busy airfield is more congestion-prone (capacity denominator ASV is not freely published, so volume is used as the proxy)."
          }
        },
        "unmet_demand": {
          "label": "Unmet demand (load factor)",
          "weight": 0.3,
          "available": true,
          "subScore": 100,
          "contribution": 30,
          "evidence": {
            "formula": "load factor = passengers ÷ seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "passengers": 35936676,
              "seats": 43852841,
              "loadFactor": 81.9
            },
            "value": 81.9,
            "explanation": "Planes averaged 81.9% full over the latest 12 months; the fuller they run, the more peak-day demand is spilled (turned away) — material above ~80-85%."
          }
        },
        "long_haul": {
          "label": "Long-haul share",
          "weight": 0.2,
          "available": true,
          "subScore": 56.5,
          "contribution": 11.3,
          "evidence": {
            "formula": "international seats ÷ total seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "internationalSeats": 13518823,
              "seats": 43852841,
              "internationalShare": 30.8
            },
            "value": 30.8,
            "explanation": "30.8% of seats were international over the latest 12 months — high-margin traffic (weight-based fees, FIS/customs moat)."
          }
        },
        "growth": {
          "label": "Growth / durability",
          "weight": 0.2,
          "available": true,
          "subScore": 0,
          "contribution": 0,
          "evidence": {
            "formula": "5-year enplanement CAGR, FY2019→FY2024 (fallback: recoveryVs2019 − 1)",
            "inputs": {
              "cagr5yr": -2.5375,
              "recoveryVs2019": 0.8794,
              "enplanements": 37760834,
              "year": 2024
            },
            "value": -2.5375,
            "explanation": "Passengers grew -2.5% per year on average from 2019 to 2024."
          }
        }
      }
    },
    {
      "airportCode": "SFO",
      "name": "San Francisco International",
      "score": 53.9,
      "coverage": 1,
      "missing": [],
      "breakdown": {
        "congestion": {
          "label": "Congestion / capacity pressure",
          "weight": 0.3,
          "available": true,
          "subScore": 47.3,
          "contribution": 14.2,
          "evidence": {
            "formula": "annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)",
            "inputs": {
              "departures": 190763
            },
            "value": 190763,
            "explanation": "190,763 departures over the latest 12 months — a busy airfield is more congestion-prone (capacity denominator ASV is not freely published, so volume is used as the proxy)."
          }
        },
        "unmet_demand": {
          "label": "Unmet demand (load factor)",
          "weight": 0.3,
          "available": true,
          "subScore": 92.3,
          "contribution": 27.7,
          "evidence": {
            "formula": "load factor = passengers ÷ seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "passengers": 26498215,
              "seats": 32451463,
              "loadFactor": 81.7
            },
            "value": 81.7,
            "explanation": "Planes averaged 81.7% full over the latest 12 months; the fuller they run, the more peak-day demand is spilled (turned away) — material above ~80-85%."
          }
        },
        "long_haul": {
          "label": "Long-haul share",
          "weight": 0.2,
          "available": true,
          "subScore": 51.6,
          "contribution": 10.3,
          "evidence": {
            "formula": "international seats ÷ total seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "internationalSeats": 9195944,
              "seats": 32451463,
              "internationalShare": 28.3
            },
            "value": 28.3,
            "explanation": "28.3% of seats were international over the latest 12 months — high-margin traffic (weight-based fees, FIS/customs moat)."
          }
        },
        "growth": {
          "label": "Growth / durability",
          "weight": 0.2,
          "available": true,
          "subScore": 8.4,
          "contribution": 1.7,
          "evidence": {
            "formula": "5-year enplanement CAGR, FY2019→FY2024 (fallback: recoveryVs2019 − 1)",
            "inputs": {
              "cagr5yr": -2.0244,
              "recoveryVs2019": 0.9028,
              "enplanements": 25078968,
              "year": 2024
            },
            "value": -2.0244,
            "explanation": "Passengers grew -2.0% per year on average from 2019 to 2024."
          }
        }
      }
    },
    {
      "airportCode": "SNA",
      "name": "John Wayne/Orange County",
      "score": 0,
      "coverage": 0.8,
      "missing": [
        "growth"
      ],
      "breakdown": {
        "congestion": {
          "label": "Congestion / capacity pressure",
          "weight": 0.3,
          "available": true,
          "subScore": 0,
          "contribution": 0,
          "evidence": {
            "formula": "annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)",
            "inputs": {
              "departures": 51447
            },
            "value": 51447,
            "explanation": "51,447 departures over the latest 12 months — a busy airfield is more congestion-prone (capacity denominator ASV is not freely published, so volume is used as the proxy)."
          }
        },
        "unmet_demand": {
          "label": "Unmet demand (load factor)",
          "weight": 0.3,
          "available": true,
          "subScore": 0,
          "contribution": 0,
          "evidence": {
            "formula": "load factor = passengers ÷ seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "passengers": 5504528,
              "seats": 6940936,
              "loadFactor": 79.3
            },
            "value": 79.3,
            "explanation": "Planes averaged 79.3% full over the latest 12 months; the fuller they run, the more peak-day demand is spilled (turned away) — material above ~80-85%."
          }
        },
        "long_haul": {
          "label": "Long-haul share",
          "weight": 0.2,
          "available": true,
          "subScore": 0,
          "contribution": 0,
          "evidence": {
            "formula": "international seats ÷ total seats (BTS T-100 (latest 12 months))",
            "inputs": {
              "internationalSeats": 145573,
              "seats": 6940936,
              "internationalShare": 2.1
            },
            "value": 2.1,
            "explanation": "2.1% of seats were international over the latest 12 months — high-margin traffic (weight-based fees, FIS/customs moat)."
          }
        },
        "growth": {
          "label": "Growth / durability",
          "weight": 0.2,
          "available": false,
          "subScore": null,
          "contribution": null,
          "evidence": {
            "formula": "5-year enplanement CAGR, FY2019→FY2024 (fallback: recoveryVs2019 − 1)",
            "inputs": {
              "cagr5yr": null,
              "recoveryVs2019": null,
              "enplanements": 5370273,
              "year": 2024
            },
            "value": null,
            "explanation": "No growth data available for this airport."
          }
        }
      }
    }
  ],
  "notFound": [
    "XYZ"
  ]
} satisfies JsonValue;
