import { Component, type ErrorInfo, type ReactNode } from "react";

interface FenceBoundaryProps {
  children: ReactNode;
  /** Shown instead of the children when they throw while rendering. */
  fallback: ReactNode;
}

/** Keeps a throwing fence renderer from taking down the rest of the message. */
export class FenceBoundary extends Component<FenceBoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Fence renderer failed", error, info.componentStack);
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
