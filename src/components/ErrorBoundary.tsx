import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Without this, a render crash on malformed saved data leaves a blank page that
 * reloading cannot fix — the bad data is still in localStorage. The reset button
 * is the escape hatch.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Ironlog crashed:", error, info.componentStack);
  }

  handleReset = () => {
    try {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith("ironlog."))
        .forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // Nothing more we can do — reloading is still worth a try.
    }
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="wrap">
        <div className="card">
          <div className="card-head">
            <div className="card-title">Something broke</div>
          </div>
          <p className="modal-note">
            Ironlog hit an error it could not recover from. Reloading may fix it. If the same error
            comes back every time, your saved data is likely the cause and clearing it will get the
            app running again — this permanently deletes your logged sessions.
          </p>
          <pre className="crash-detail">{error.message}</pre>
          <div className="add-bar">
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button className="btn btn-danger" onClick={this.handleReset}>
              Clear saved data
            </button>
          </div>
        </div>
      </div>
    );
  }
}
