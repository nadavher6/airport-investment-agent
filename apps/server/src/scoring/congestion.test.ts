import { describe, expect, it } from "vitest";
import { scoreAirportsTool } from "../agent/tools/scoreAirports.ts";
import { capacityDataset } from "../data/capacity/dataset.ts";
import { findAirport } from "../data/enplanements/dataset.ts";
import type { AirportRecord } from "../data/enplanements/types.ts";
import { getT100 } from "../data/t100/dataset.ts";
import { buildScorer, type KpiDef } from "./engine.ts";
import {
  INVESTMENT_KPIS,
  rankAirports,
  rankAirportsRelative,
  runwayUtilization,
  scoreAirport,
  ratioToPct,
  triggerPhrase,
  utilizationRatio,
} from "./investmentScore.ts";

const congestion = INVESTMENT_KPIS.find((k) => k.key === "congestion")!;
const records = (...codes: string[]) => codes.map((c) => findAirport(c)).filter((r): r is AirportRecord => r !== null);
const sub = (s: ReturnType<typeof scoreAirport>, key: string) => s.kpis.find((k) => k.key === key)!;

describe("congestion = runway utilization (#54)", () => {
  it("is labelled and on #57's percent scale with fullAt 1.0 (raw value in percent points)", () => {
    expect(congestion).toMatchObject({
      label: "Congestion: runway utilization",
      weight: 0.3,
      direction: "higher",
      scale: { kind: "percent", fullAt: 1.0 },
    });
  });

  it("utilization math: operations ÷ ASV as a ratio (4 decimals), not capped in the raw value", () => {
    expect(utilizationRatio(150_000, 300_000)).toBe(0.5);
    expect(utilizationRatio(227_408, 217_500)).toBe(1.0456);
    expect(ratioToPct(1.0456)).toBe(104.6);
    expect(utilizationRatio(0, 217_500)).toBe(0);
    expect(utilizationRatio(null, 217_500)).toBeNull(); // missing operations
    expect(utilizationRatio(100_000, null)).toBeNull(); // missing ASV
    expect(utilizationRatio(100_000, 0)).toBeNull();
    expect(utilizationRatio(Number.NaN, 217_500)).toBeNull();
  });

  it("operations = T-100 departures × 2, against the airport's Figure 2-1 ASV (not a Core 30 airport)", () => {
    const sna = runwayUtilization("SNA")!;
    expect(sna.operations).toBe(getT100("SNA")!.departures * 2);
    expect(sna.asv).toBe(217_500);
    expect(sna.ratio).toBe(utilizationRatio(sna.operations, 217_500));
    expect(sna.utilizationPct).toBe(ratioToPct(sna.ratio));
    // The raw value is in percent points (47.3), the unit the percent scale expects, not the ratio (0.473).
    expect(congestion.extract(findAirport("SNA")!)).toBe(sna.utilizationPct);
    expect(congestion.evidence!(findAirport("SNA")!).value).toBe(sna.utilizationPct);
    expect(congestion.evidence!(findAirport("SNA")!).inputs).toMatchObject({ asv: 217_500, asvSource: "figure-2-1" });
  });

  it("a Core 30 airport uses the FAA capacity profile, cited in the evidence", () => {
    const san = runwayUtilization("SAN")!;
    expect(san.asv).toBe(227_500); // (0.9 × 52.5 + 0.1 × 48) × 4,370, was Figure 2-1's 217,500
    expect(san.utilizationPct).toBe(100);
    const ev = congestion.evidence!(findAirport("SAN")!);
    expect(ev.inputs).toMatchObject({ asv: 227_500, asvSource: "faa-capacity-profile" });
    expect(ev.explanation).toContain("FAA Airport Capacity Profiles (May 2014)");
    expect(ev.explanation).not.toContain("capped"); // exactly at 100%, not above
  });

  it("hubs that were capped by Figure 2-1 are now below 100 against their published capacity", () => {
    // Before (Figure 2-1): DEN 205%, ORD 145.3%, ATL 127.9%, DFW 117%, LGA 145.6%, all capped at 100.
    const after = Object.fromEntries(["DEN", "ORD", "ATL", "DFW", "LGA"].map((c) => [c, runwayUtilization(c)!.utilizationPct]));
    expect(after).toEqual({ DEN: 57.1, ORD: 95.2, ATL: 82.8, DFW: 69.3, LGA: 94.3 });
    for (const code of Object.keys(after)) {
      expect(sub(scoreAirport(findAirport(code)!), "congestion").evidence!.explanation).not.toContain("capped");
    }
  });

  it("the cap at 100 still applies: JFK is above its published capacity (107.6%) and scores 100", () => {
    const k = sub(scoreAirport(findAirport("JFK")!), "congestion");
    expect(k.raw).toBe(107.6);
    expect(k.normalized).toBe(100);
    expect(k.evidence!.explanation).toContain("capped at 100");
    expect(k.evidence!.explanation).toContain("80% trigger");
    expect(sub(scoreAirport(findAirport("SNA")!), "congestion").evidence!.explanation).not.toContain("capped");
  });

  it("only JFK still caps: 1 airport above 100% (was 15 with Figure 2-1 alone, #62)", () => {
    const over = Object.keys(capacityDataset.airports)
      .filter((code) => (runwayUtilization(code)?.utilizationPct ?? 0) > 100)
      .sort();
    expect(over).toEqual(["JFK"]);
  });

  it("the FAA 60% / 80% triggers in words", () => {
    expect(triggerPhrase(59.9)).toBe("below the FAA's 60% planning trigger");
    expect(triggerPhrase(72)).toBe("past the FAA's 60% planning trigger");
    expect(triggerPhrase(80)).toBe("past the FAA's 80% trigger to start building more capacity");
  });

  it("missing operations (no T-100 record) -> congestion missing", () => {
    const code = Object.keys(capacityDataset.airports).find(
      (c) => capacityDataset.airports[c]!.configuration !== null && getT100(c) === null && findAirport(c) !== null,
    )!;
    const s = scoreAirport(findAirport(code)!);
    expect(sub(s, "congestion").raw).toBeNull();
    expect(s.missing).toContain("congestion");
    expect(congestion.evidence!(findAirport(code)!).explanation).toContain("No BTS T-100 record");
  });

  it("no runway configuration -> congestion missing, never invented", () => {
    const kae = findAirport("KAE")!; // Kake, AK: a seaplane base with scheduled T-100 service, no land runway
    expect(getT100("KAE")).not.toBeNull();
    expect(congestion.extract(kae)).toBeNull();
    expect(scoreAirport(kae).missing).toContain("congestion");
    expect(congestion.evidence!(kae).explanation).toContain("No runway capacity estimate");
    expect(congestion.extract({ airportCode: "ZZZ" } as AirportRecord)).toBeNull();
  });

  it("flags a Figure 2-1 layout with more runways than its configuration (ASV may be understated)", () => {
    expect(congestion.evidence!(findAirport("PDX")!).explanation).toContain("has 3 runways but the closest Figure 2-1 configuration has 2");
    // ATL has 5 runways, but its ASV is the FAA's published capacity, so it is not flagged.
    expect(congestion.evidence!(findAirport("ATL")!).explanation).not.toContain("understated");
    expect(congestion.evidence!(findAirport("SNA")!).explanation).not.toContain("understated");
  });

  it("an extended layout cites the extension, not an FAA figure (CVG)", () => {
    const ev = congestion.evidence!(findAirport("CVG")!);
    expect(ev.inputs).toMatchObject({ asv: 550_000, asvSource: "figure-2-1-extended" });
    expect(ev.explanation).toContain("not an FAA figure");
  });

  it("score_airports([LAX, SNA]) shows congestion as utilization %, not 0/100, in both modes", async () => {
    const r = await scoreAirportsTool.run({ airport_codes: ["LAX", "SNA"] }, { signal: new AbortController().signal });
    if (!r.ok) throw new Error("expected ok");
    const out = r.output as unknown as { ranking: { airportCode: string; breakdown: Record<string, { subScore: number | null }> }[] };
    const subScores = Object.fromEntries(out.ranking.map((a) => [a.airportCode, a.breakdown.congestion!.subScore]));
    expect(subScores).toEqual({ LAX: runwayUtilization("LAX")!.utilizationPct, SNA: runwayUtilization("SNA")!.utilizationPct });
    for (const v of Object.values(subScores)) expect([0, 100]).not.toContain(v);
    for (const ranked of [rankAirports(records("LAX", "SNA")), rankAirportsRelative(records("LAX", "SNA"))]) {
      for (const s of ranked) expect(sub(s, "congestion").normalized).toBe(runwayUtilization(s.item.airportCode)!.utilizationPct);
    }
  });

  it("golden: unmet demand, long-haul and growth are unchanged by #54", () => {
    const line = (s: ReturnType<typeof scoreAirport>) =>
      `${s.item.airportCode} ` +
      s.kpis.filter((k) => k.key !== "congestion").map((k) => `${k.key}:${k.raw}:${k.normalized}`).join(" ");
    const codes = ["LAX", "SNA", "ATL", "JFK"];
    // long_haul values are #57's (share ÷ 50%), identical to its own golden in investmentScore.test.ts.
    expect(rankAirports(records(...codes)).map(line).sort()).toEqual([
      "ATL unmet_demand:82.2:82.2 long_haul:13.6:27.2 growth:-0.3745:53.6",
      "JFK unmet_demand:81.9:81.9 long_haul:52.9:100 growth:0.2752:56.4",
      "LAX unmet_demand:81.9:81.9 long_haul:30.8:61.6 growth:-2.5375:44.1",
      "SNA unmet_demand:79.3:79.3 long_haul:2.1:4.2 growth:0.8283:58.8",
    ]);
    expect(rankAirportsRelative(records(...codes)).map(line).sort()).toEqual([
      "ATL unmet_demand:82.2:82.2 long_haul:13.6:27.2 growth:-0.3745:64.3",
      "JFK unmet_demand:81.9:81.9 long_haul:52.9:100 growth:0.2752:83.6",
      "LAX unmet_demand:81.9:81.9 long_haul:30.8:61.6 growth:-2.5375:0",
      "SNA unmet_demand:79.3:79.3 long_haul:2.1:4.2 growth:0.8283:100",
    ]);
  });
});

/**
 * One golden per percent-scale KPI, through the real KPI definitions and the real engine. #57's engine divides the
 * raw value by 100 and `fullAt` is a fraction, so a KPI whose raw value is in the wrong unit is off by 100x:
 * these numbers would then read 0.9 or 100 instead of 86.8, and 0.8 instead of 81.9.
 */
describe("percent-scale goldens per KPI (#54 on #57's scale shape)", () => {
  const kpi = (key: string) => INVESTMENT_KPIS.find((k) => k.key === key)!;

  it("LAX unmet demand: load factor 81.9% -> 81.9", () => {
    const u = sub(scoreAirport(findAirport("LAX")!), "unmet_demand");
    expect([u.raw, u.normalized]).toEqual([81.9, 81.9]);
  });

  it("long-haul is #57's: LAX 30.8% -> 61.6, SNA 2.1% -> 4.2, JFK 52.9% -> 100", () => {
    const lh = (code: string) => sub(scoreAirport(findAirport(code)!), "long_haul");
    expect([lh("LAX").raw, lh("LAX").normalized]).toEqual([30.8, 61.6]);
    expect([lh("SNA").raw, lh("SNA").normalized]).toEqual([2.1, 4.2]);
    expect([lh("JFK").raw, lh("JFK").normalized]).toEqual([52.9, 100]);
  });

  it("runway utilization 0.868 (86.8%) -> 86.8 and 205% -> 100, on the congestion KPI's own scale", () => {
    const c = kpi("congestion");
    const util: KpiDef<{ readonly pct: number }> = {
      key: c.key,
      label: c.label,
      weight: c.weight,
      direction: c.direction,
      scale: c.scale!,
      extract: (r) => r.pct,
    };
    const scorer = buildScorer([{ pct: ratioToPct(0.868) }, { pct: 205 }], [util]);
    expect(ratioToPct(0.868)).toBe(86.8);
    expect(scorer.score({ pct: ratioToPct(0.868) }).kpis[0]!.normalized).toBe(86.8);
    expect(scorer.score({ pct: 205 }).kpis[0]!.normalized).toBe(100);
  });

  it("real airports: LAX congestion 72.6% -> 72.6, SNA 47.3% -> 47.3, DEN 57.1% -> 57.1, JFK 107.6% -> 100 (committed data)", () => {
    const c = (code: string) => sub(scoreAirport(findAirport(code)!), "congestion");
    expect([c("LAX").raw, c("LAX").normalized]).toEqual([72.6, 72.6]);
    expect([c("SNA").raw, c("SNA").normalized]).toEqual([47.3, 47.3]);
    expect([c("DEN").raw, c("DEN").normalized]).toEqual([57.1, 57.1]); // was 205 -> 100 with Figure 2-1
    expect([c("JFK").raw, c("JFK").normalized]).toEqual([107.6, 100]);
    expect(c("LAX").evidence!.explanation).toContain("at 72.6% of its estimated capacity");
  });
});
