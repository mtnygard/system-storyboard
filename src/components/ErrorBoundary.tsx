import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="home">
          <h1>The workbench could not open.</h1>
          <p className="local-note">
            Your saved workspace is still in this browser. Reload to try again.
            If the problem continues, keep this browser’s data while you report
            the issue.
          </p>
          <button className="primary" onClick={() => window.location.reload()}>
            Reload workbench
          </button>
        </main>
      );
    return this.props.children;
  }
}
