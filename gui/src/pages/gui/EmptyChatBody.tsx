import { ConversationStarterCards } from "../../components/ConversationStarters";
import { KiroQuickStart } from "../../components/ConversationStarters/KiroQuickStart";
import { ExploreHubCard } from "../../components/ExploreHubCard";
import { OnboardingCard } from "../../components/OnboardingCard";

export interface EmptyChatBodyProps {
  showOnboardingCard?: boolean;
}

export function EmptyChatBody({ showOnboardingCard }: EmptyChatBodyProps) {
  if (showOnboardingCard) {
    return (
      <div className="mx-2 mt-6">
        <OnboardingCard />
      </div>
    );
  }

  return (
    <div className="mx-2 mt-2">
      <KiroQuickStart />
      <ExploreHubCard />
      <ConversationStarterCards />
    </div>
  );
}
