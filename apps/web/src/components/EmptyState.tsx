import "./EmptyState.css";

interface Suggestion {
  readonly kind: string;
  readonly codes: string;
  readonly prompt: string;
}

/** The assignment's sample questions, shown as departure-strip cards. */
const SUGGESTIONS: readonly Suggestion[] = [
  { kind: "Rank", codes: "BOS · BDL · PVD", prompt: "Which airports in New England are strong candidates for terminal expansion?" },
  { kind: "Compare", codes: "LAX ⇄ SNA", prompt: "Compare LA and Santa Ana airport congestion levels." },
  { kind: "Measure", codes: "ANC", prompt: "What is the percentage of long-haul flights out of Anchorage airport?" },
  { kind: "Explain", codes: "SFO", prompt: "What is the unmet flight demand at SFO, and why?" },
];

export function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="empty">
      <p className="eyebrow empty__eyebrow">US airport modernization · analyst desk</p>
      <h1 className="empty__title">
        Where should the <em>next</em> terminal go?
      </h1>
      <p className="empty__lede">
        Ask about capacity, congestion and unmet demand. The agent pulls public aviation data, scores airports with a
        transparent model, and explains its reasoning.
      </p>

      <ul className="empty__grid">
        {SUGGESTIONS.map((s) => (
          <li key={s.prompt}>
            <button type="button" className="strip" onClick={() => onPick(s.prompt)}>
              <span className="strip__stub">
                <span className="strip__kind">{s.kind}</span>
                <span className="strip__codes">{s.codes}</span>
              </span>
              <span className="strip__prompt">{s.prompt}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
