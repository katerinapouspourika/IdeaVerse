import { useEffect, useId, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router';

import { useMoveIdea } from '../api/queries';
import { statusLabels, type Idea, type IdeaStatus } from '../api/types';
import { useToast } from '../components/Feedback';
import { useWorkspace } from '../workspaces/WorkspaceContext';
import { CommandPalette, type IdeaCommands } from './CommandPalette';
import { Dialog } from './Dialog';
import { isTyping, letterOf, paletteShortcut, shortcuts, usesCommandKey } from './keys';

/** Where G followed by a letter goes. */
const goTo: Record<string, string> = { h: '/', i: '/ideas', p: '/people', n: '/notifications', s: '/settings' };

/** How long after G the second key still counts, in milliseconds. */
const sequenceMs = 1200;

/**
 * The signed-in header's search button, the command palette it opens, and the app's keyboard shortcuts: Ctrl+K or ⌘K (also
 * while typing), and, outside text fields, /, N, G then a letter, and ?.
 */
export function Commands() {
  const [open, setOpen] = useState<'palette' | 'help' | null>(null);
  const navigate = useNavigate();
  const { current } = useWorkspace();
  const pendingG = useRef(0);
  const ideaCommands = useIdeaCommands();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) {
        return;
      }
      // Another dialog, such as a confirmation or the idea panel, has the keyboard.
      const otherDialog = open === null && document.querySelector('[aria-modal="true"]') !== null;
      const key = letterOf(event);
      if (key === 'k' && (usesCommandKey ? event.metaKey : event.ctrlKey) && !event.altKey && !event.shiftKey) {
        if (!otherDialog) {
          event.preventDefault();
          setOpen((o) => (o === 'palette' ? null : 'palette'));
        }
        return;
      }
      if (open !== null || otherDialog || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) {
        return;
      }

      const sequence = pendingG.current > Date.now();
      pendingG.current = 0;
      if (sequence && goTo[key]) {
        event.preventDefault();
        if ((key === 'i' || key === 'p') && !current) {
          return;
        }
        void navigate(goTo[key]);
      } else if (key === 'g') {
        pendingG.current = Date.now() + sequenceMs;
      } else if (event.key === '/') {
        event.preventDefault();
        setOpen('palette');
      } else if (event.key === '?') {
        event.preventDefault();
        setOpen('help');
      } else if (key === 'n' && current) {
        event.preventDefault();
        void navigate('/ideas', { state: { adding: true } });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, current, navigate]);

  return (
    <>
      <button
        type="button"
        className="icon-button header-icon search-button"
        aria-label="Search and commands"
        aria-keyshortcuts={usesCommandKey ? 'Meta+K' : 'Control+K'}
        title={`Search and commands (${paletteShortcut})`}
        onClick={() => setOpen('palette')}
      >
        <Search aria-hidden="true" size={20} />
        <kbd className="search-kbd" aria-hidden="true">
          {paletteShortcut}
        </kbd>
      </button>
      {open === 'palette' && <CommandPalette ideaCommands={ideaCommands} onClose={() => setOpen(null)} />}
      {open === 'help' && <ShortcutsHelp onClose={() => setOpen(null)} />}
    </>
  );
}

/**
 * What the palette's idea actions do once it has closed: they live here, with the header, so their toasts and Undo
 * outlast the palette.
 */
function useIdeaCommands(): IdeaCommands {
  const move = useMoveIdea();
  const toast = useToast();

  /** `from` is passed by Undo, whose closure would otherwise see the idea as it was; the Undo itself offers no Undo. */
  const changeStatus = (idea: Idea, next: IdeaStatus, { from = idea.status, undoable = true } = {}) =>
    move.mutateAsync({ idea, status: next }).then(
      (saved) =>
        toast({
          message: `“${idea.title}” set to ${statusLabels[next]}`,
          undo: undoable ? () => void changeStatus(saved, from, { from: next, undoable: false }) : undefined,
        }),
      () => toast({ message: 'Couldn’t change the status. Try again.', tone: 'error' }),
    );

  const copyLink = (idea: { id: string; title: string }) =>
    // Started inside the promise, so a browser without clipboard access lands in the error toast too.
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(`${window.location.origin}/ideas/${idea.id}`))
      .then(
        () => toast({ message: `Copied the link to “${idea.title}”` }),
        () => toast({ message: 'Couldn’t copy the link.', tone: 'error' }),
      );

  return { changeStatus: (idea, status) => void changeStatus(idea, status), copyLink: (idea) => void copyLink(idea) };
}

/** Lists the keyboard shortcuts. */
function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  return (
    <Dialog labelledBy={titleId} className="stack shortcuts" onClose={onClose}>
      <div className="row spread">
        <h2 id={titleId}>Keyboard shortcuts</h2>
        <button type="button" className="button ghost small" onClick={onClose}>
          Close
        </button>
      </div>
      <dl className="shortcut-list">
        {shortcuts.map((s) => (
          <div key={s.description} className="row spread">
            <dt>{s.description}</dt>
            <dd>
              {s.keys.map((sequence, i) => (
                <span key={sequence.join(' ')}>
                  {i > 0 && <span className="muted small"> or </span>}
                  {sequence.map((k, j) => (
                    <span key={k + j}>
                      {j > 0 && <span className="muted small"> then </span>}
                      <kbd>{k}</kbd>
                    </span>
                  ))}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
      <p className="muted small">Single-key shortcuts work anywhere except while typing in a field.</p>
    </Dialog>
  );
}
