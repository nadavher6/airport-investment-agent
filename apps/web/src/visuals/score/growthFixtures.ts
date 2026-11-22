// Real get_growth outputs (#67; regenerated for #75's fixed growth scale), generated from data/enplanements.json with the server tool (tsx). 0AK has no CY2020 / CY2021 figure.
import type { JsonValue } from "@airport/shared";

export const GROWTH_ONE: JsonValue = {
  "category": "growth",
  "label": "Growth / durability",
  "weight": 0.2,
  "scale": "linear",
  "unit": "% per year",
  "note": "Enplanement 5-year CAGR, CY2019->CY2024 (FAA), in percent per year. Missing when the airport has no CY2019 or CY2024 figure; never filled from another unit. Sub-score = a fixed scale on the CAGR: 50 + 5 × CAGR, clamped to 0-100 (−10%/yr = 0, 0%/yr = 50, +10%/yr = 100).",
  "airports": [
    {
      "airportCode": "LAX",
      "name": "Los Angeles International",
      "available": true,
      "raw": -2.5375,
      "subScore": 37.3,
      "evidence": {
        "formula": "5-year enplanement CAGR, CY2019→CY2024, % per year: ((CY2024 ÷ CY2019)^(1/5) − 1) × 100. Sub-score = 50 + 5 × CAGR, clamped to 0-100",
        "inputs": {
          "cagr5yr": -2.5375,
          "unit": "% per year",
          "enplanements": 37760834,
          "year": 2024
        },
        "value": -2.5375,
        "explanation": "Passengers shrank 2.5% per year on average from CY2019 to CY2024; on the fixed growth scale (−10%/yr = 0, 0%/yr = 50, +10%/yr = 100) → 37.3."
      },
      "growth": {
        "series": [
          {
            "year": 2015,
            "enplanements": 36351272
          },
          {
            "year": 2016,
            "enplanements": 39636042
          },
          {
            "year": 2017,
            "enplanements": 41232432
          },
          {
            "year": 2018,
            "enplanements": 42624050
          },
          {
            "year": 2019,
            "enplanements": 42939104
          },
          {
            "year": 2020,
            "enplanements": 14055777
          },
          {
            "year": 2021,
            "enplanements": 23663410
          },
          {
            "year": 2022,
            "enplanements": 32326616
          },
          {
            "year": 2023,
            "enplanements": 40956673
          },
          {
            "year": 2024,
            "enplanements": 37760834
          }
        ],
        "cagr5yr": -2.5375,
        "cagr10yr": 0.4236,
        "cagr10yrPeriods": 9,
        "recoveryVs2019": 0.8794,
        "latest": {
          "year": 2024,
          "enplanements": 37760834,
          "yoyChangePct": -7.803
        },
        "covid2020": {
          "enplanements": 14055777,
          "pctVs2019": -67.2658
        },
        "peak": {
          "year": 2019,
          "enplanements": 42939104
        }
      }
    }
  ],
  "notFound": [],
  "years": [
    2015,
    2016,
    2017,
    2018,
    2019,
    2020,
    2021,
    2022,
    2023,
    2024
  ]
};

export const GROWTH_THREE: JsonValue = {
  "category": "growth",
  "label": "Growth / durability",
  "weight": 0.2,
  "scale": "linear",
  "unit": "% per year",
  "note": "Enplanement 5-year CAGR, CY2019->CY2024 (FAA), in percent per year. Missing when the airport has no CY2019 or CY2024 figure; never filled from another unit. Sub-score = a fixed scale on the CAGR: 50 + 5 × CAGR, clamped to 0-100 (−10%/yr = 0, 0%/yr = 50, +10%/yr = 100).",
  "airports": [
    {
      "airportCode": "LAX",
      "name": "Los Angeles International",
      "available": true,
      "raw": -2.5375,
      "subScore": 37.3,
      "evidence": {
        "formula": "5-year enplanement CAGR, CY2019→CY2024, % per year: ((CY2024 ÷ CY2019)^(1/5) − 1) × 100. Sub-score = 50 + 5 × CAGR, clamped to 0-100",
        "inputs": {
          "cagr5yr": -2.5375,
          "unit": "% per year",
          "enplanements": 37760834,
          "year": 2024
        },
        "value": -2.5375,
        "explanation": "Passengers shrank 2.5% per year on average from CY2019 to CY2024; on the fixed growth scale (−10%/yr = 0, 0%/yr = 50, +10%/yr = 100) → 37.3."
      },
      "growth": {
        "series": [
          {
            "year": 2015,
            "enplanements": 36351272
          },
          {
            "year": 2016,
            "enplanements": 39636042
          },
          {
            "year": 2017,
            "enplanements": 41232432
          },
          {
            "year": 2018,
            "enplanements": 42624050
          },
          {
            "year": 2019,
            "enplanements": 42939104
          },
          {
            "year": 2020,
            "enplanements": 14055777
          },
          {
            "year": 2021,
            "enplanements": 23663410
          },
          {
            "year": 2022,
            "enplanements": 32326616
          },
          {
            "year": 2023,
            "enplanements": 40956673
          },
          {
            "year": 2024,
            "enplanements": 37760834
          }
        ],
        "cagr5yr": -2.5375,
        "cagr10yr": 0.4236,
        "cagr10yrPeriods": 9,
        "recoveryVs2019": 0.8794,
        "latest": {
          "year": 2024,
          "enplanements": 37760834,
          "yoyChangePct": -7.803
        },
        "covid2020": {
          "enplanements": 14055777,
          "pctVs2019": -67.2658
        },
        "peak": {
          "year": 2019,
          "enplanements": 42939104
        }
      }
    },
    {
      "airportCode": "DEN",
      "name": "Denver International",
      "available": true,
      "raw": 3.5596,
      "subScore": 67.8,
      "evidence": {
        "formula": "5-year enplanement CAGR, CY2019→CY2024, % per year: ((CY2024 ÷ CY2019)^(1/5) − 1) × 100. Sub-score = 50 + 5 × CAGR, clamped to 0-100",
        "inputs": {
          "cagr5yr": 3.5596,
          "unit": "% per year",
          "enplanements": 40012895,
          "year": 2024
        },
        "value": 3.5596,
        "explanation": "Passengers grew 3.6% per year on average from CY2019 to CY2024; on the fixed growth scale (−10%/yr = 0, 0%/yr = 50, +10%/yr = 100) → 67.8."
      },
      "growth": {
        "series": [
          {
            "year": 2015,
            "enplanements": 26280043
          },
          {
            "year": 2016,
            "enplanements": 28267394
          },
          {
            "year": 2017,
            "enplanements": 29809097
          },
          {
            "year": 2018,
            "enplanements": 31362941
          },
          {
            "year": 2019,
            "enplanements": 33592945
          },
          {
            "year": 2020,
            "enplanements": 16243216
          },
          {
            "year": 2021,
            "enplanements": 28645527
          },
          {
            "year": 2022,
            "enplanements": 33773832
          },
          {
            "year": 2023,
            "enplanements": 37863967
          },
          {
            "year": 2024,
            "enplanements": 40012895
          }
        ],
        "cagr5yr": 3.5596,
        "cagr10yr": 4.7818,
        "cagr10yrPeriods": 9,
        "recoveryVs2019": 1.1911,
        "latest": {
          "year": 2024,
          "enplanements": 40012895,
          "yoyChangePct": 5.6754
        },
        "covid2020": {
          "enplanements": 16243216,
          "pctVs2019": -51.6469
        },
        "peak": {
          "year": 2024,
          "enplanements": 40012895
        }
      }
    },
    {
      "airportCode": "0AK",
      "name": "Pilot Station",
      "available": true,
      "raw": -3.3013,
      "subScore": 33.5,
      "evidence": {
        "formula": "5-year enplanement CAGR, CY2019→CY2024, % per year: ((CY2024 ÷ CY2019)^(1/5) − 1) × 100. Sub-score = 50 + 5 × CAGR, clamped to 0-100",
        "inputs": {
          "cagr5yr": -3.3013,
          "unit": "% per year",
          "enplanements": 3469,
          "year": 2024
        },
        "value": -3.3013,
        "explanation": "Passengers shrank 3.3% per year on average from CY2019 to CY2024; on the fixed growth scale (−10%/yr = 0, 0%/yr = 50, +10%/yr = 100) → 33.5."
      },
      "growth": {
        "series": [
          {
            "year": 2015,
            "enplanements": 3727
          },
          {
            "year": 2016,
            "enplanements": 4127
          },
          {
            "year": 2017,
            "enplanements": 3353
          },
          {
            "year": 2018,
            "enplanements": 3016
          },
          {
            "year": 2019,
            "enplanements": 4103
          },
          {
            "year": 2020,
            "enplanements": null
          },
          {
            "year": 2021,
            "enplanements": null
          },
          {
            "year": 2022,
            "enplanements": 2724
          },
          {
            "year": 2023,
            "enplanements": 3195
          },
          {
            "year": 2024,
            "enplanements": 3469
          }
        ],
        "cagr5yr": -3.3013,
        "cagr10yr": -0.7939,
        "cagr10yrPeriods": 9,
        "recoveryVs2019": 0.8455,
        "latest": {
          "year": 2024,
          "enplanements": 3469,
          "yoyChangePct": 8.5759
        },
        "covid2020": {
          "enplanements": null,
          "pctVs2019": null
        },
        "peak": {
          "year": 2016,
          "enplanements": 4127
        }
      }
    }
  ],
  "notFound": [],
  "years": [
    2015,
    2016,
    2017,
    2018,
    2019,
    2020,
    2021,
    2022,
    2023,
    2024
  ]
};
