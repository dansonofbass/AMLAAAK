import { AlertCircle, Database, LoaderCircle } from "lucide-react";
import { Button } from "./ui/button";
export function LoadingState() {
  return (
    <div className="state-card" role="status">
      <LoaderCircle className="loading-icon" size={24} />
      <h2>Reading your workspace</h2>
      <p>Fetching analytics from the API.</p>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="state-card error-state" role="alert">
      <AlertCircle size={26} />
      <h2>Analytics are unavailable</h2>
      <p>{message}</p>
      {retry && (
        <Button onClick={retry} variant="outline">
          Try again
        </Button>
      )}
    </div>
  );
}
export function EmptyState({ reset }: { reset: () => void }) {
  return (
    <div className="state-card">
      <Database size={26} />
      <h2>No matching sales</h2>
      <p>Try a wider area, price range, or another city.</p>
      <Button onClick={reset} variant="outline">
        Reset filters
      </Button>
    </div>
  );
}
