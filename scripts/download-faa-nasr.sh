#!/usr/bin/env bash
# Downloads the FAA NASR airport CSV archive (28-day subscription, cycle 2026-10-29) and extracts the two
# runway files the capacity build reads into data/raw/nasr/: APT_RWY.csv and APT_RWY_END.csv.
# Provenance: data/raw/SOURCES.md ("FAA NASR runways: data/capacity.json").
#
# Usage: bash scripts/download-faa-nasr.sh    (run by `npm run data:build-capacity`)
#
# The URL was taken on 2026-11-22 from
#   https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/2026-10-29
# Free and public: no key, no login. The SHA-256 below matches SOURCES.md; a mismatch fails the script.
# To move to a newer cycle, update the URL, the checksum and SOURCES.md together.
# Needs bash, curl, shasum and unzip (macOS, Linux, or WSL / Git Bash on Windows).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/data/raw/nasr"
URL="https://nfdc.faa.gov/webContent/28DaySub/extra/29_Oct_2026_APT_CSV.zip"
WANT="6e1e422f483d44cc8a38a1c97cf98e97588a6fc3fa857b39b5bdcbcfe8331154"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

mkdir -p "$ROOT/data/raw"
# Each download goes into its own new, empty directory, removed at the end.
work="$(mktemp -d "$ROOT/data/raw/.nasr-download.XXXXXX")"
trap 'rm -rf "$work"' EXIT

zip="$work/APT_CSV.zip"
status="$(curl -sSL --connect-timeout 15 --max-time 300 --retry 3 --retry-delay 2 -A "$UA" -o "$zip" -w '%{http_code}' "$URL")"
if [[ "$status" != "200" ]]; then
  echo "NASR download failed: HTTP $status ($URL)" >&2
  exit 1
fi
got="$(shasum -a 256 "$zip" | cut -d' ' -f1)"
if [[ "$got" != "$WANT" ]]; then
  echo "NASR archive checksum mismatch: got $got, want $WANT. Update the script and SOURCES.md on purpose." >&2
  exit 1
fi

unzip -q -o "$zip" APT_RWY.csv APT_RWY_END.csv -d "$work/x"
mkdir -p "$OUT_DIR"
mv -f "$work/x/APT_RWY.csv" "$work/x/APT_RWY_END.csv" "$OUT_DIR/"
echo "NASR 2026-10-29 runway files ok (sha256 $got) in $OUT_DIR"
