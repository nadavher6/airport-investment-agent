import { describe, expect, it } from "vitest";
import { WorkingSetStore } from "./store.ts";

describe("WorkingSetStore", () => {
  it("returns an empty map for an unknown conversation", () => {
    const store = new WorkingSetStore();
    expect(store.get("c1").size).toBe(0);
  });

  it("stores and retrieves records by conversation and code", () => {
    const store = new WorkingSetStore();
    store.upsert("c1", { airportCode: "LAX", metrics: { score: 61.3 } });
    expect(store.get("c1").get("LAX")?.metrics).toEqual({ score: 61.3 });
    expect(store.get("c2").size).toBe(0); // isolated per conversation
  });

  it("merges fields on upsert instead of overwriting the whole record", () => {
    const store = new WorkingSetStore();
    store.upsert("c1", { airportCode: "LAX", metrics: { score: 61.3 } });
    store.upsert("c1", { airportCode: "LAX", enplanements: { cy2024: 40_000_000 } });
    const rec = store.get("c1").get("LAX");
    expect(rec?.metrics).toEqual({ score: 61.3 });
    expect(rec?.enplanements).toEqual({ cy2024: 40_000_000 });
  });

  it("clears a conversation", () => {
    const store = new WorkingSetStore();
    store.upsert("c1", { airportCode: "LAX" });
    store.clear("c1");
    expect(store.get("c1").size).toBe(0);
  });
});
