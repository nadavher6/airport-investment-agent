/**
 * A small incremental JSON scanner for the final answer (#63). It is fed the model's reply chunk by chunk and
 * tracks just enough structure to stream `answer.summary` and `answer.markdown` while the JSON arrives:
 * the top-level keys, each finished member of the top object and of `answer` (as raw JSON source), and the
 * decoded characters of the two text fields. It never throws: anything it cannot follow marks it `broken`
 * (live streaming stops; the whole reply is still parsed strictly at the end, finalAnswer.ts).
 *
 * Lenient on purpose in one place: a raw line break or tab inside a string (a common model slip) is read as
 * that character, and `repairRawControls` lets the strict parse accept it too, so the live text and the final
 * text stay the same.
 */

/** The two answer fields streamed to the user. */
export type TextField = "summary" | "markdown";

interface ObjFrame {
  readonly type: "obj";
  expect: "key" | "colon" | "value" | "comma";
  key: string | null;
  /** This is the `answer` object (directly under the top object). */
  readonly isAnswer: boolean;
}
interface ArrFrame {
  readonly type: "arr";
  expect: "value" | "comma";
}
type Frame = ObjFrame | ArrFrame;

export interface ScanListener {
  /** A key of the `answer` object was read (before its value). */
  onAnswerKey?(key: string): void;
  /** A member of the top object or of `answer` finished; `raw` is its value's JSON source. */
  onMember?(where: "top" | "answer", key: string, raw: string): void;
  /** Decoded characters of `answer.summary` / `answer.markdown` (direct string values only). */
  onText?(field: TextField, chars: string): void;
  /** That text field's string closed. */
  onTextEnd?(field: TextField): void;
}

const HEX = /^[0-9a-fA-F]{4}$/;
const ESCAPES: Readonly<Record<string, string>> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };

export class FinalAnswerScanner {
  /** Everything fed so far. */
  text = "";
  /** The reply started with the object (after whitespace and an optional ``` fence line): nothing before it. */
  clean = true;
  /** The scanner lost the structure (bad JSON so far); live streaming must stop. */
  broken = false;
  /** The top-level object closed. */
  closed = false;
  /** Top-level keys of the first object, in order. */
  readonly topKeys: string[] = [];
  /** The decoded text fields so far (for the fallback). */
  readonly decoded: Record<TextField, string> = { summary: "", markdown: "" };

  private mode: "pre" | "fence" | "seek" | "json" | "post" = "pre";
  private readonly stack: Frame[] = [];
  private inString = false;
  private stringIsKey = false;
  private stringBuf = "";
  private stringField: TextField | null = null;
  private escape = false;
  private unicode: string | null = null;
  private primitiveStart = -1;
  /** Where the current member value of the top object (index 0) and of `answer` (index 1) started. */
  private readonly memberStart: [number, number] = [-1, -1];

  constructor(private readonly listener: ScanListener = {}) {}

  feed(chunk: string): void {
    for (const ch of chunk) {
      const index = this.text.length;
      this.text += ch;
      if (this.broken || this.mode === "post") continue;
      this.step(ch, index);
    }
  }

  private step(ch: string, i: number): void {
    switch (this.mode) {
      case "pre":
        if (/\s/.test(ch)) return;
        if (ch === "`") {
          this.mode = "fence";
          return;
        }
        if (ch === "{") return this.openObject();
        this.clean = false;
        this.mode = "seek";
        return;
      case "fence":
        // The fence line: ``` plus an optional language tag, up to the line break.
        if (ch === "\n") this.mode = "pre";
        else if (!/[`\w\- \t\r]/.test(ch)) {
          this.clean = false;
          this.mode = "seek";
        }
        return;
      case "seek":
        if (ch === "{") this.openObject();
        return;
      case "json":
        return this.json(ch, i);
      case "post":
        return;
    }
  }

  private openObject(): void {
    this.mode = "json";
    this.stack.push({ type: "obj", expect: "key", key: null, isAnswer: false });
  }

  private get top(): Frame | undefined {
    return this.stack[this.stack.length - 1];
  }

  private fail(): void {
    this.broken = true;
  }

  private json(ch: string, i: number): void {
    if (this.inString) return this.stringChar(ch);
    if (this.primitiveStart !== -1) {
      if (/[\s,}\]]/.test(ch)) {
        this.endValue(i);
        this.primitiveStart = -1;
        this.structural(ch, i);
      } else if (!/[\w.+\-]/.test(ch)) this.fail();
      return;
    }
    this.structural(ch, i);
  }

  private structural(ch: string, i: number): void {
    if (/\s/.test(ch)) return;
    const frame = this.top;
    if (frame === undefined) return this.fail();
    if (frame.type === "obj") {
      if (frame.expect === "key") {
        if (ch === '"') return this.openString(true, null);
        if (ch === "}" && frame.key === null) return this.closeContainer(i);
        return this.fail();
      }
      if (frame.expect === "colon") {
        if (ch !== ":") return this.fail();
        frame.expect = "value";
        return;
      }
      if (frame.expect === "comma") {
        if (ch === ",") {
          frame.expect = "key";
          frame.key = null;
          return;
        }
        if (ch === "}") return this.closeContainer(i);
        return this.fail();
      }
      return this.startValue(ch, i);
    }
    if (frame.expect === "comma") {
      if (ch === ",") {
        frame.expect = "value";
        return;
      }
      if (ch === "]") return this.closeContainer(i);
      return this.fail();
    }
    if (ch === "]") return this.closeContainer(i);
    return this.startValue(ch, i);
  }

  private startValue(ch: string, i: number): void {
    const parent = this.top;
    const depth = this.stack.length;
    if (parent?.type === "obj" && depth <= 2) this.memberStart[depth - 1] = i;
    if (ch === '"') {
      const field = parent?.type === "obj" && parent.isAnswer && (parent.key === "summary" || parent.key === "markdown") ? parent.key : null;
      return this.openString(false, field);
    }
    if (ch === "{") {
      const isAnswer = depth === 1 && parent?.type === "obj" && parent.key === "answer";
      this.stack.push({ type: "obj", expect: "key", key: null, isAnswer });
      return;
    }
    if (ch === "[") {
      this.stack.push({ type: "arr", expect: "value" });
      return;
    }
    if (/[\w.\-]/.test(ch)) {
      this.primitiveStart = i;
      return;
    }
    this.fail();
  }

  private openString(isKey: boolean, field: TextField | null): void {
    this.inString = true;
    this.stringIsKey = isKey;
    this.stringBuf = "";
    this.stringField = field;
  }

  private emit(chars: string): void {
    if (this.stringIsKey) this.stringBuf += chars;
    else if (this.stringField !== null) {
      this.decoded[this.stringField] += chars;
      this.listener.onText?.(this.stringField, chars);
    }
  }

  private stringChar(ch: string): void {
    if (this.unicode !== null) {
      this.unicode += ch;
      if (this.unicode.length < 4) return;
      if (!HEX.test(this.unicode)) return this.fail();
      const code = Number.parseInt(this.unicode, 16);
      this.unicode = null;
      return this.emit(String.fromCharCode(code));
    }
    if (this.escape) {
      this.escape = false;
      if (ch === "u") {
        this.unicode = "";
        return;
      }
      const decoded = ESCAPES[ch];
      if (decoded === undefined) return this.fail();
      return this.emit(decoded);
    }
    if (ch === "\\") {
      this.escape = true;
      return;
    }
    if (ch === '"') {
      this.inString = false;
      const frame = this.top;
      if (this.stringIsKey) {
        if (frame?.type !== "obj") return this.fail();
        frame.key = this.stringBuf;
        frame.expect = "colon";
        if (this.stack.length === 1) this.topKeys.push(this.stringBuf);
        if (frame.isAnswer) this.listener.onAnswerKey?.(this.stringBuf);
        return;
      }
      const field = this.stringField;
      this.stringField = null;
      if (field !== null) this.listener.onTextEnd?.(field);
      return this.endValue(this.text.length);
    }
    this.emit(ch);
  }

  /** A value ended at `end` (exclusive): report a finished top/answer member, and expect a comma. */
  private endValue(end: number): void {
    const frame = this.top;
    if (frame === undefined) return;
    const depth = this.stack.length;
    if (frame.type === "obj" && depth <= 2 && frame.key !== null) {
      const where = depth === 1 ? "top" : frame.isAnswer ? "answer" : null;
      const start = this.memberStart[depth - 1];
      if (where !== null && start !== undefined && start >= 0) this.listener.onMember?.(where, frame.key, this.text.slice(start, end));
    }
    frame.expect = "comma";
  }

  private closeContainer(i: number): void {
    this.stack.pop();
    if (this.stack.length === 0) {
      this.closed = true;
      this.mode = "post";
      return;
    }
    this.endValue(i + 1);
  }
}

/**
 * The same JSON with every raw line break, carriage return and tab inside a string escaped (string-aware).
 * Lets the strict parse accept the one slip the scanner tolerates.
 */
export function repairRawControls(src: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of src) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      else if (ch === "\n") {
        out += "\\n";
        continue;
      } else if (ch === "\r") {
        out += "\\r";
        continue;
      } else if (ch === "\t") {
        out += "\\t";
        continue;
      }
    } else if (ch === '"') inString = true;
    out += ch;
  }
  return out;
}

/** Scan a whole reply at once. */
export function scanReply(text: string, listener: ScanListener = {}): FinalAnswerScanner {
  const scanner = new FinalAnswerScanner(listener);
  scanner.feed(text);
  return scanner;
}
