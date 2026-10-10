import { useState } from 'react';

import { useAddComponent, useAiStatus, useSuggestComponents } from '../api/queries';
import type { ComponentSuggestion } from '../api/types';
import { ErrorMessage } from '../components/ErrorMessage';
import { AiAllowance, Thinking } from './AiAllowance';

/** Asks AI what an idea needs, and adds the suggestions the user keeps. */
export function SuggestComponents({ ideaId, workspaceId }: { ideaId: string; workspaceId: string }) {
  const status = useAiStatus(workspaceId);
  const suggest = useSuggestComponents(ideaId, workspaceId);
  const add = useAddComponent(ideaId);
  const [chosen, setChosen] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  if (!status.data?.enabled) {
    return null;
  }

  const ask = () =>
    suggest.mutate(undefined, { onSuccess: (suggestions) => setChosen(suggestions.map((s) => s.title)) });

  const addChosen = async (suggestions: ComponentSuggestion[]) => {
    setAdding(true);
    try {
      for (const suggestion of suggestions.filter((s) => chosen.includes(s.title))) {
        await add.mutateAsync({ title: suggestion.title, notes: suggestion.notes || null });
      }
      suggest.reset();
    } finally {
      setAdding(false);
    }
  };

  if (!suggest.data) {
    return (
      <div className="stack">
        <div className="row">
          <button type="button" className="button ghost" onClick={ask} disabled={suggest.isPending}>
            Suggest with AI
          </button>
        </div>
        {suggest.isPending && <Thinking />}
        <ErrorMessage error={suggest.error} />
      </div>
    );
  }

  return (
    <div className="stack ai-panel" role="group" aria-label="AI suggestions">
      <p className="small">Tick what this idea needs, then add them to the list.</p>
      {suggest.data.length === 0 && <p className="muted">No new suggestions; the list already covers it.</p>}
      {suggest.data.map((suggestion) => (
        <label key={suggestion.title} className="check">
          <input
            type="checkbox"
            checked={chosen.includes(suggestion.title)}
            onChange={(e) =>
              setChosen((current) => (e.target.checked ? [...current, suggestion.title] : current.filter((t) => t !== suggestion.title)))
            }
          />
          <span>
            {suggestion.title}
            <span className="muted small block">{suggestion.notes}</span>
          </span>
        </label>
      ))}
      <ErrorMessage error={add.error} />
      <div className="row">
        <button type="button" className="button primary" onClick={() => void addChosen(suggest.data)} disabled={adding || chosen.length === 0}>
          {adding ? 'Adding…' : `Add ${chosen.length} selected`}
        </button>
        <button type="button" className="button ghost" onClick={() => suggest.reset()}>
          Dismiss
        </button>
      </div>
      {status.data && <AiAllowance status={status.data} />}
    </div>
  );
}
