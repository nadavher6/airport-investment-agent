import { describe, expect, it } from "vitest";
import { WorkingSetStore } from "./store.ts";
import type { AirportRecord } from "./types.ts";
import type { AirportSummary } from "../../data/places/airports.ts";

const LAX_SUMMARY: AirportSummary = {
  code: "LAX",
  name: "Los Angeles International",
  city: "Los Angeles",
  state: "CA",
  hubType: "L",
  latestEnplanements: 38_000_000,
};

describe("WorkingSetStore", () => {
  it("returns an empty map for an unknown conversation", () => {
    const store = new WorkingSetStore();
    expect(store.get("c1").size).toBe(0);
  });

  it("stores and retrieves records by conversation and code", () => {
    const store = new WorkingSetStore();
    store.upsert("c1", { airportCode: "LAX", enplanements: { cy2024: 38_000_000 } });
    expect(store.get("c1").get("LAX")?.enplanements).toEqual({ cy2024: 38_000_000 });
    expect(store.get("c2").size).toBe(0); // isolated per conversation
  });

  it("merges fields on upsert instead of overwriting the whole record", () => {
    const store = new WorkingSetStore();
    store.upsert("c1", { airportCode: "LAX", airport: LAX_SUMMARY });
    store.upsert("c1", { airportCode: "LAX", enplanements: { cy2024: 40_000_000 } });
    const rec = store.get("c1").get("LAX");
    expect(rec?.airport).toEqual(LAX_SUMMARY);
    expect(rec?.enplanements).toEqual({ cy2024: 40_000_000 });
  });

  it("clears a conversation", () => {
    const store = new WorkingSetStore();
    store.upsert("c1", { airportCode: "LAX" });
    store.clear("c1");
    expect(store.get("c1").size).toBe(0);
  });

  it("records hold only fields from real tools (no metrics / get_airport_metrics)", () => {
    // @ts-expect-error `metrics` was removed: no get_airport_metrics tool exists.
    const bad: AirportRecord = { airportCode: "LAX", metrics: { score: 1 } };
    const store = new WorkingSetStore();
    store.upsert("c1", { airportCode: "LAX", airport: LAX_SUMMARY, enplanements: { cy2024: 1 } });
    expect(Object.keys(store.get("c1").get("LAX") ?? {}).sort()).toEqual(["airport", "airportCode", "enplanements"]);
    expect(bad.airportCode).toBe("LAX");
  });
});
