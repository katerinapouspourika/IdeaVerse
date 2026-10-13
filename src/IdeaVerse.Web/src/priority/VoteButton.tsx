import { ThumbsUp } from 'lucide-react';

import { useVote } from '../api/queries';
import type { Idea } from '../api/types';
import { useToast } from '../components/Feedback';

/** Toggles the user's vote for an idea and shows how many people voted for it. An archived idea only shows its count. */
export function VoteButton({ idea }: { idea: Idea }) {
  const vote = useVote();
  const toast = useToast();
  if (idea.archivedAt) {
    return (
      <span className="button small vote-button" role="img" aria-label={`${idea.voteCount} ${idea.voteCount === 1 ? 'vote' : 'votes'}`} title="Archived ideas can’t be voted on">
        <ThumbsUp aria-hidden="true" size={16} />
        {idea.voteCount}
      </span>
    );
  }

  const voted = vote.isPending ? vote.variables.vote : idea.hasVoted;
  // Shows the vote straight away, before the server confirms it.
  const count = idea.voteCount + (voted === idea.hasVoted ? 0 : voted ? 1 : -1);

  return (
    <button
      type="button"
      className={voted ? 'button small vote-button voted' : 'button small vote-button'}
      aria-pressed={voted}
      aria-label={`Vote for ${idea.title}, ${count} ${count === 1 ? 'vote' : 'votes'}`}
      title={voted ? 'Withdraw your vote' : 'Vote for this idea'}
      // Stays focusable while saving, so keyboard users keep their place.
      aria-disabled={vote.isPending}
      onClick={() => {
        if (!vote.isPending) {
          vote.mutate({ idea, vote: !voted }, { onError: () => toast({ message: 'Couldn’t save your vote. Try again.', tone: 'error' }) });
        }
      }}
    >
      <ThumbsUp aria-hidden="true" size={16} />
      {count}
    </button>
  );
}
