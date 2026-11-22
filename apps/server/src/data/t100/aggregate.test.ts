import { describe, expect, it } from "vitest";
import { aggregateT100, type T100Row } from "./aggregate.ts";
import { t100Dataset } from "./dataset.ts";

// Fixture rows in the shape BTS returns (numbers as strings), deliberately not in code order.
const rows: T100Row[] = [
  { origin_airport_code: "ORD", departures: "10", passengers: "800", seats: "1000", domestic_seats: "900" },
  { origin_airport_code: "2A3", departures: "1", passengers: "5", seats: "10", domestic_seats: "10" },
  { origin_airport_code: "ATL", departures: "20", passengers: "1700", seats: "2000", domestic_seats: "1800" },
  { origin_airport_code: "ZZV", departures: "0", passengers: "0", seats: "0", domestic_seats: "0" },
  { origin_airport_code: "BOS", departures: "5", passengers: "450", seats: "500", domestic_seats: "400" },
];

describe("aggregateT100 (the T-100 build's pure step)", () => {
  it("writes airports sorted by code, so shuffled input gives byte-identical JSON", () => {
    const a = aggregateT100(rows);
    const b = aggregateT100([...rows].reverse());
    const c = aggregateT100([rows[2]!, rows[4]!, rows[0]!, rows[3]!, rows[1]!]);
    expect(Object.keys(a)).toEqual(["2A3", "ATL", "BOS", "ORD"]); // ZZV dropped: no seats
    expect(JSON.stringify(b, null, 2)).toBe(JSON.stringify(a, null, 2));
    expect(JSON.stringify(c, null, 2)).toBe(JSON.stringify(a, null, 2));
  });

  it("computes load factor and international share in percent, 1 dp", () => {
    expect(aggregateT100(rows).ATL).toEqual({
      code: "ATL",
      departures: 20,
      passengers: 1700,
      seats: 2000,
      domesticSeats: 1800,
      internationalSeats: 200,
      loadFactor: 85,
      internationalShare: 10,
    });
  });

  it("the committed data/t100.json is already in code order", () => {
    const keys = Object.keys(t100Dataset.airports);
    expect(keys).toEqual([...keys].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)));
  });
});
