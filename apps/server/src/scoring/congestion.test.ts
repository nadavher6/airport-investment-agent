import { describe, expect, it } from "vitest";
import { scoreAirportsTool } from "../agent/tools/scoreAirports.ts";
import { capacityDataset } from "../data/capacity/dataset.ts";
import { findAirport } from "../data/enplanements/dataset.ts";
import type { AirportRecord } from "../data/enplanements/types.ts";
import { getT100 } from "../data/t100/dataset.ts";
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
  it("is labelled and on the percent scale with fullAt 1.0 (a ratio)", () => {
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

  it("operations = T-100 departures × 2, against the airport's Figure 2-1 ASV", () => {
    const san = runwayUtilization("SAN")!;
    expect(san.operations).toBe(getT100("SAN")!.departures * 2);
    expect(san.asv).toBe(217_500);
    expect(san.ratio).toBe(utilizationRatio(san.operations, 217_500));
    expect(congestion.extract(findAirport("SAN")!)).toBe(san.ratio);
  });

  it("caps the sub-score at 100 and says so (SAN, LGA, ATL are above 100%)", () => {
    for (const code of ["SAN", "LGA", "ATL"]) {
      const k = sub(scoreAirport(findAirport(code)!), "congestion");
      expect(k.raw!).toBeGreaterThan(1);
      expect(k.normalized).toBe(100);
      expect(k.evidence!.explanation).toContain("capped at 100");
      expect(k.evidence!.explanation).toContain("80% trigger");
    }
    expect(sub(scoreAirport(findAirport("SNA")!), "congestion").evidence!.explanation).not.toContain("capped");
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

  it("flags a layout with more runways than its Figure 2-1 configuration (ASV understated)", () => {
    expect(congestion.evidence!(findAirport("ATL")!).explanation).toContain("has 5 runways but the closest Figure 2-1 configuration has 4");
    expect(congestion.evidence!(findAirport("SAN")!).explanation).not.toContain("understated");
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
    expect(rankAirports(records(...codes)).map(line).sort()).toEqual([
      "ATL unmet_demand:82.2:82.2 long_haul:13.6:100 growth:-0.3745:53.6",
      "JFK unmet_demand:81.9:81.9 long_haul:52.9:100 growth:0.2752:56.4",
      "LAX unmet_demand:81.9:81.9 long_haul:30.8:100 growth:-2.5375:44.1",
      "SNA unmet_demand:79.3:79.3 long_haul:2.1:20 growth:0.8283:58.8",
    ]);
    expect(rankAirportsRelative(records(...codes)).map(line).sort()).toEqual([
      "ATL unmet_demand:82.2:82.2 long_haul:13.6:22.6 growth:-0.3745:64.3",
      "JFK unmet_demand:81.9:81.9 long_haul:52.9:100 growth:0.2752:83.6",
      "LAX unmet_demand:81.9:81.9 long_haul:30.8:56.5 growth:-2.5375:0",
      "SNA unmet_demand:79.3:79.3 long_haul:2.1:0 growth:0.8283:100",
    ]);
  });
});
