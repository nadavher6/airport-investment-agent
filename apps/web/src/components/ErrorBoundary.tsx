import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Called from the fallback's button, after the boundary clears its error. */
  onReset: () => void;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/** Keeps a render error in the thread from unmounting the whole app (top bar and composer stay usable). */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Conversation failed to render", error, info.componentStack);
  }

  private readonly reset = () => {
    this.setState({ failed: false });
    this.props.onReset();
  };

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="notice notice--error" role="alert">
        <span className="notice__code">ui</span>
        Something went wrong showing this conversation.
        <button type="button" className="notice__action" onClick={this.reset}>
          Start a new chat
        </button>
      </div>
    );
  }
}
