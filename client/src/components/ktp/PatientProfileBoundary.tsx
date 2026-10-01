import { Component, type ReactNode } from "react";
import { Link } from "wouter";
import { ClayButton, ClayCard } from "@/components/clay";

export class PatientProfileBoundary extends Component<
  { children: ReactNode; onRetry: () => Promise<void> },
  { failed: boolean; retrying: boolean }
> {
  state = { failed: false, retrying: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <ClayCard className="m-4 flex flex-col items-start gap-4" role="alert">
        <h1 className="type-title">Could not display this patient profile.</h1>
        <p>Your navigation remains available. Retry or return to Patients.</p>
        <ClayButton
          disabled={this.state.retrying}
          onClick={async () => {
            this.setState({ retrying: true });
            try {
              await this.props.onRetry();
              this.setState({ failed: false });
            } catch {
              // Keep the recoverable fallback when a fresh request fails.
            } finally {
              this.setState({ retrying: false });
            }
          }}
        >
          {this.state.retrying ? "Retrying..." : "Retry profile"}
        </ClayButton>
        <Link
          href="/patients"
          className="clay-focus inline-flex min-h-11 items-center text-brick"
        >
          Back to patients
        </Link>
      </ClayCard>
    );
  }
}
