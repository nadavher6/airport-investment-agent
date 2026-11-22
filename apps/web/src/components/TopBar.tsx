import type { ConnectionStatus } from "../hooks/useHealth";
import type { Theme } from "../hooks/useTheme";
import { LogoMark, MoonIcon, PlusIcon, SunIcon } from "./icons";
import "./TopBar.css";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  checking: "Connecting",
  online: "API online",
  offline: "API offline",
};

interface TopBarProps {
  connection: ConnectionStatus;
  theme: Theme;
  onToggleTheme: () => void;
  canReset: boolean;
  onReset: () => void;
}

export function TopBar({ connection, theme, onToggleTheme, canReset, onReset }: TopBarProps) {
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
