#!/usr/bin/env bash
# Downloads the FAA "Commercial Service Enplanements" workbooks for CY2015–CY2024
# into data/raw/faa-enplanements-cyYYYY.xlsx (Task 1, tasks/01-acquire-faa-data.md).
#
# Usage: npm run data:download          # skip years already downloaded
#        npm run data:download -- --force
#
# URLs were taken from the FAA pages on 2026-11-22:
#   https://www.faa.gov/airports/planning_capacity/passenger_allcargo_stats/passenger
#   https://www.faa.gov/airports/planning_capacity/passenger_allcargo_stats/passenger/previous_years
# The FAA returns 403 to non-browser clients, hence the browser User-Agent.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/data/raw"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
FAA="https://www.faa.gov/sites/faa.gov/files"
ARCHIVE="$FAA/airports/planning_capacity/passenger_allcargo_stats/passenger"

FORCE=false
[[ "${1:-}" == "--force" ]] && FORCE=true

# year|url  (paths change from year to year, so each is listed explicitly)
SOURCES=(
  "2015|$ARCHIVE/cy15-commercial-service-enplanements.xlsx"
  "2016|$ARCHIVE/cy16-commercial-service-enplanements.xlsx"
  "2017|$ARCHIVE/cy17-commercial-service-enplanements.xlsx"
  "2018|$ARCHIVE/cy18-commercial-service-enplanements.xlsx"
  "2019|$ARCHIVE/cy19-commercial-service-enplanements.xlsx"
  "2020|$ARCHIVE/cy20-commercial-service-enplanements.xlsx"
  "2021|$FAA/2022-09/cy21-commercial-service-enplanements.xlsx"
  "2022|$FAA/2023-09/cy22-commercial-service-enplanements.xlsx"
  "2023|$FAA/2024-10/cy23-commercial-service-enplanements.xlsx"
  "2024|$FAA/2026-09/arp-cy2024-commercial-service-enplanements.xlsx"
)

mkdir -p "$OUT_DIR"
failures=0

for entry in "${SOURCES[@]}"; do
  year="${entry%%|*}"
  url="${entry#*|}"
  dest="$OUT_DIR/faa-enplanements-cy$year.xlsx"

  if [[ -s "$dest" && "$FORCE" == false ]]; then
    echo "cy$year  exists, skipping"
    continue
  fi

  tmp="$(mktemp)"
  status="$(curl -sSL -A "$UA" -o "$tmp" -w '%{http_code}' "$url" || echo "000")"

  # An .xlsx is a zip archive: it must start with "PK". Anything else is an HTML error page.
  if [[ "$status" != "200" || "$(head -c 2 "$tmp")" != "PK" ]]; then
    echo "cy$year  FAILED (HTTP $status, not an xlsx)  $url" >&2
    rm -f "$tmp"
    failures=$((failures + 1))
    continue
  fi

  mv "$tmp" "$dest"
  echo "cy$year  ok  $(wc -c < "$dest" | tr -d ' ') bytes"
done

if (( failures > 0 )); then
  echo "$failures file(s) failed. Check the FAA pages above for moved links." >&2
  exit 1
fi
