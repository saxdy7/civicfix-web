import { ScreenContainer } from "../components/ScreenContainer";
import { EmptyState } from "../components/EmptyState";

// Offline drafts/queueing is not implemented yet — this used to show two
// hardcoded fake rows that never reflected anything you actually did.
// Building real offline persistence (drafts saved locally, retried once
// back online) is future work, not something to fake here.
export default function SyncQueue() {
  return (
    <ScreenContainer>
      <EmptyState
        title="Offline queue not available yet"
        description="Reports and evidence submit immediately while you're online. Offline drafting hasn't been built yet."
      />
    </ScreenContainer>
  );
}
