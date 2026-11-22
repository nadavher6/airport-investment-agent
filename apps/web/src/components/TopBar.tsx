import type { ModelInfo } from "@airport/shared";
import type { ConnectionStatus } from "../hooks/useHealth";
import type { ModelCheck } from "../hooks/useModels";
import type { Theme } from "../hooks/useTheme";
import { LogoMark, MoonIcon, PlusIcon, SunIcon } from "./icons";
import "./TopBar.css";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  checking: "Connecting",
  online: "API online",
  offline: "API offline",
};

/** "Claude (headless session)" -> "Claude", for the short check messages. */
const shortName = (model: ModelInfo) => model.label.replace(/\s*\(.*\)\s*$/, "");

/** The selected model, or the progress of the health check that switching to it runs. */
function ModelPill({ selected, check }: { selected: ModelInfo | null; check: ModelCheck }) {
  if (check.status === "checking") {
    return (
      <span className="status-pill status-pill--model" data-status="checking" role="status">
        <span className="status-pill__dot" aria-hidden="true" />
        Checking {shortName(check.model)}…
      </span>
    );
  }
  if (!selected) return null;
  const connected = check.status === "connected" && check.model.id === selected.id;
  return (
    <span
      className="status-pill status-pill--model"
      data-status={connected ? "online" : "idle"}
      role="status"
      title={connected ? check.detail : selected.description}
    >
      <span className="provider-dot" data-provider={selected.provider} aria-hidden="true" />
      {connected ? `${shortName(selected)} connected` : selected.label}
    </span>
  );
}

interface TopBarProps {
  connection: ConnectionStatus;
  selectedModel: ModelInfo | null;
  modelCheck: ModelCheck;
  theme: Theme;
  onToggleTheme: () => void;
  canReset: boolean;
  onReset: () => void;
}

export function TopBar({ connection, selectedModel, modelCheck, theme, onToggleTheme, canReset, onReset }: TopBarProps) {
  const isDark = theme === "dark";
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <LogoMark />
        <span className="topbar__wordmark">Runway</span>
        <span className="topbar__divider" aria-hidden="true" />
        <span className="eyebrow topbar__tagline">Airport investment intelligence</span>
      </div>

      <div className="topbar__actions">
        <ModelPill selected={selectedModel} check={modelCheck} />

        <span className="status-pill" data-status={connection} role="status">
          <span className="status-pill__dot" aria-hidden="true" />
          {STATUS_LABEL[connection]}
        </span>

        {canReset && (
          <button type="button" className="topbar__new" onClick={onReset}>
            <PlusIcon size={16} />
            New chat
          </button>
        )}

        <button
          type="button"
          className="icon-button theme-toggle"
          onClick={onToggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={isDark}
          title={isDark ? "Light mode" : "Dark mode"}
        >
          <span className="theme-toggle__icon" data-visible={!isDark}>
            <MoonIcon />
          </span>
          <span className="theme-toggle__icon" data-visible={isDark}>
            <SunIcon />
          </span>
        </button>
      </div>
    </header>
  );
}
