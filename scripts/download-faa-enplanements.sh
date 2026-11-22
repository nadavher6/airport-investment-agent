#!/usr/bin/env bash
# Downloads the FAA "Commercial Service Enplanements" workbooks for CY2015–CY2024
# into data/raw/faa-enplanements-cyYYYY.xlsx. Provenance: data/raw/SOURCES.md.
#
# Usage: npm run data:download          # keep files whose checksum already matches
#        npm run data:download -- --force
#
# URLs were taken from the FAA pages on 2026-11-22:
#   https://www.faa.gov/airports/planning_capacity/passenger_allcargo_stats/passenger
#   https://www.faa.gov/airports/planning_capacity/passenger_allcargo_stats/passenger/previous_years
# The FAA returns 403 to non-browser clients, hence the browser User-Agent.
# Needs bash and curl (macOS, Linux, or WSL / Git Bash on Windows).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/data/raw"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
FAA="https://www.faa.gov/sites/faa.gov/files"
ARCHIVE="$FAA/airports/planning_capacity/passenger_allcargo_stats/passenger"

FORCE=false
case "${1:-}" in
  --force) FORCE=true ;;
  "") ;;
  *) echo "usage: $(basename "$0") [--force]" >&2; exit 2 ;;
esac

# year|sha256|url  (paths change from year to year, so each is listed explicitly).
# The SHA-256 values match data/raw/SOURCES.md. A mismatch fails the year: if the FAA
# republishes a file, update both places on purpose.
SOURCES=(
  "2015|429d20c8189d430439ac5f77518128041ba8c3fbbf80b309d1367b92736d2715|$ARCHIVE/cy15-commercial-service-enplanements.xlsx"
  "2016|3ab9366c521013d82ad9a155c6b5321e350a4166c3eb6387668ba5407e443222|$ARCHIVE/cy16-commercial-service-enplanements.xlsx"
  "2017|ab4d69b900371256985f58eb744ccb4a8976d624db5b12a9dfc26fa9a9f89df5|$ARCHIVE/cy17-commercial-service-enplanements.xlsx"
  "2018|88a53435e846b4fcb4a602c94c6b5b4a240c7e1cf74b991733604d175510b47b|$ARCHIVE/cy18-commercial-service-enplanements.xlsx"
  "2019|84924e4a4500e3e1e2fc74b5720c92ad50302618f7357f46fcfe07eefc099bce|$ARCHIVE/cy19-commercial-service-enplanements.xlsx"
  "2020|91b00a4643a35a27bd975c14ef111066838ace9b36c2d034c49c5920e964ab10|$ARCHIVE/cy20-commercial-service-enplanements.xlsx"
  "2021|41dcbb24d5209662803f4182cb27a6cc60086ad70b5bb24d619a48b08bca551b|$FAA/2022-09/cy21-commercial-service-enplanements.xlsx"
  "2022|629652c78756edc22b56a4cf7eaeed09988d8d10c81aa5dbd1c0faa0f424cef7|$FAA/2023-09/cy22-commercial-service-enplanements.xlsx"
  "2023|653fe78e925fe85d0155fd8f5230a57bc437786cd7ed44bcd7a34d942ed2cdd1|$FAA/2024-10/cy23-commercial-service-enplanements.xlsx"
  "2024|bbba0541110c790021967d52591d60c8af852b8350831c9c26cfb91be7b3e13c|$FAA/2026-09/arp-cy2024-commercial-service-enplanements.xlsx"
)

sha() { shasum -a 256 "$1" | cut -d' ' -f1; }

mkdir -p "$OUT_DIR"
failures=0

# The temp file sits next to its target (same filesystem, so mv is atomic) and is
# removed if the script is interrupted.
tmp=""
trap 'rm -f "${tmp:-}"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for entry in "${SOURCES[@]}"; do
  year="${entry%%|*}"
  rest="${entry#*|}"
  want="${rest%%|*}"
  url="${rest#*|}"
  dest="$OUT_DIR/faa-enplanements-cy$year.xlsx"

  if [[ -f "$dest" && "$FORCE" == false ]]; then
    if [[ "$(sha "$dest")" == "$want" ]]; then
      echo "cy$year  ok (cached)"
      continue
    fi
    echo "cy$year  cached file has the wrong checksum, downloading again"
  fi

  tmp="$(mktemp "$OUT_DIR/.cy$year.XXXXXX")"
  # --retry covers timeouts and transient 5xx/429 responses.
  # An .xlsx is a zip archive: it must start with "PK". Anything else is an HTML error page.
  error=""
  if ! status="$(curl -sSL --connect-timeout 15 --max-time 120 --retry 3 --retry-delay 2 \
        -A "$UA" -o "$tmp" -w '%{http_code}' "$url")"; then
    error="curl error, HTTP ${status:-000}"
  elif [[ "$status" != "200" ]]; then
    error="HTTP $status"
  elif [[ "$(head -c 2 "$tmp")" != "PK" ]]; then
    error="not an xlsx"
  else
    got="$(sha "$tmp")"
    [[ "$got" == "$want" ]] || error="checksum: got $got, want $want"
  fi

  if [[ -n "$error" ]]; then
    echo "cy$year  FAILED ($error)  $url" >&2
    rm -f "$tmp"
    tmp=""
    failures=$((failures + 1))
    continue
  fi

  chmod 644 "$tmp"
  mv "$tmp" "$dest"
  tmp=""
  echo "cy$year  ok  $(wc -c < "$dest" | tr -d ' ') bytes"
done

if (( failures > 0 )); then
  echo "$failures file(s) failed. Check the FAA pages above for moved links or republished files." >&2
  exit 1
fi
