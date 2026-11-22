import { AnswerSchema, MAX_MARKDOWN_CHARS, MAX_SUMMARY_CHARS, SUMMARY_SEPARATOR, isKnownAirport, summaryLine } from "./finalAnswer.ts";
import { FinalAnswerScanner } from "./finalAnswerScan.ts";

const ANSWER_KEYS: ReadonlySet<string> = new Set(["summary", "markdown", "airports", "caveats"]);

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;

/**
 * Incremental streaming of a final answer (#63). Fed the model's reply chunk by chunk, it releases only text
 * that is a prefix of `renderAnswer(answer)` (finalAnswer.ts): the bold summary line once the summary string
 * has closed and passed its checks and the markdown body has begun (so a missing body shows nothing), then the
 * markdown body character by character. Never any JSON.
 *
 * Text is released only while everything read so far is valid: the reply starts with the object, `kind` came
 * first and is "final_answer", every `answer` key so far is allowed and unique, and `airports` / `caveats`
 * (when they come before the summary, as the prompt asks) passed their checks. Anything else closes the gate:
 * nothing more is released and the loop decides at the end (a strict parse of the whole reply).
 */
export class FinalAnswerStream {
  /** The text released to the user for this reply so far. */
  emitted = "";
  private out = "";
  private open = true;
  private kindOk = false;
  private summaryShown = false;
  private summaryDone = false;
  private markdownChars = 0;
  private readonly answerKeys = new Set<string>();
  private readonly scanner: FinalAnswerScanner;

  constructor(private readonly knownAirport: (code: string) => boolean = isKnownAirport) {
    this.scanner = new FinalAnswerScanner({
      onMember: (where, key, raw) => {
        if (where === "top") {
          if (key === "kind") this.kindOk = parseJson(raw) === "final_answer";
          else if (key !== "answer") this.close();
          return;
        }
        if (key === "airports" || key === "caveats") this.checkList(key, raw);
      },
      onAnswerKey: (key) => {
        if (!this.kindOk || !ANSWER_KEYS.has(key) || this.answerKeys.has(key)) this.close();
        this.answerKeys.add(key);
      },
      onText: (field, chars) => {
        if (field === "summary") {
          if (this.scanner.decoded.summary.length > MAX_SUMMARY_CHARS) this.close();
          return;
        }
        if (!this.summaryShown) this.showSummary();
        if (!this.summaryShown) return;
        this.markdownChars += chars.length;
        if (this.markdownChars > MAX_MARKDOWN_CHARS) return this.close();
        this.release(chars);
      },
      onTextEnd: (field) => {
        if (field === "summary") this.summaryDone = true;
      },
    });
  }

  /** The text of the whole reply so far. */
  get text(): string {
    return this.scanner.text;
  }

  /** Feed one chunk; returns the text to show now (often ""). */
  push(chunk: string): string {
    this.scanner.feed(chunk);
    if (!this.scanner.clean || this.scanner.broken) this.close();
    // Hold a trailing high surrogate until its pair arrives.
    let ready = this.out;
    if (ready.length > 0 && isHighSurrogate(ready.charCodeAt(ready.length - 1))) ready = ready.slice(0, -1);
    this.out = this.out.slice(ready.length);
    this.emitted += ready;
    return ready;
  }

  /** The bold summary line, once the summary has closed (valid) and the markdown body has begun. */
  private showSummary(): void {
    const summary = this.scanner.decoded.summary;
    if (!this.summaryDone || !this.open) return;
    if (summary.trim() === "" || summary.length > MAX_SUMMARY_CHARS) return this.close();
    this.summaryShown = true;
    this.release(`${summaryLine(summary)}${SUMMARY_SEPARATOR}`);
  }

  private release(text: string): void {
    if (this.open && this.scanner.clean && !this.scanner.broken) this.out += text;
  }

  private close(): void {
    this.open = false;
  }

  private checkList(key: "airports" | "caveats", raw: string): void {
    const parsed = AnswerSchema.shape[key].safeParse(parseJson(raw));
    if (!parsed.success) return this.close();
    if (key === "airports" && (parsed.data ?? []).some((code) => typeof code === "string" && !this.knownAirport(code.toUpperCase()))) this.close();
  }
}
