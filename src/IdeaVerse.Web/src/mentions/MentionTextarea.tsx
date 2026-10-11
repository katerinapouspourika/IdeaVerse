import { useEffect, useId, useRef, useState, type KeyboardEvent, type TextareaHTMLAttributes } from 'react';

import { mentionName, type Mention } from './mentions';

/** The most people the picker lists at once. */
const maxSuggestions = 6;

/** A person who can be mentioned, with their email to tell apart people with similar names. */
export interface Mentionable extends Mention {
  email: string;
}

interface MentionTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  /** The people chosen so far. */
  mentions: Mention[];
  onMentionsChange: (mentions: Mention[]) => void;
  /** Who can be mentioned. */
  people: Mentionable[];
}

/** Whether the typed text starts the name, or any word in it, ignoring case. */
function startsAWord(name: string, needle: string): boolean {
  const lower = name.toLowerCase();
  return lower.startsWith(needle) || lower.split(/\s+/).some((word) => word.startsWith(needle));
}

/** Where an `@` before the caret starts a mention being typed, and what follows it. */
function mentionAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at < 0 || (at > 0 && !/\s/.test(before[at - 1]!))) {
    return null;
  }
  const query = before.slice(at + 1);
  return /[\r\n@]/.test(query) || query.length > 40 ? null : { start: at, query };
}

/**
 * A comment box where typing `@` offers the people in the workspace: ↑ and ↓ choose, Enter or Tab inserts `@Name`, and
 * Escape closes the list. The chosen people become mentions when the comment is saved.
 */
export function MentionTextarea({ value, onChange, mentions, onMentionsChange, people, ...props }: MentionTextareaProps) {
  const listId = useId();
  const area = useRef<HTMLTextAreaElement>(null);
  const [typing, setTyping] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const caretAfter = useRef<number | null>(null);

  const needle = typing?.query.toLowerCase() ?? '';
  const suggestions = typing
    ? people.filter((p) => startsAWord(p.name, needle) || p.email.toLowerCase().startsWith(needle)).slice(0, maxSuggestions)
    : [];
  const open = suggestions.length > 0;
  const selected = Math.min(active, Math.max(suggestions.length - 1, 0));
  const optionId = (index: number) => `${listId}-${index}`;

  // Puts the caret after a name just inserted, once the new text is in the box.
  useEffect(() => {
    if (caretAfter.current !== null) {
      area.current?.setSelectionRange(caretAfter.current, caretAfter.current);
      caretAfter.current = null;
    }
  }, [value]);

  const track = (element: HTMLTextAreaElement) => {
    setTyping(mentionAt(element.value, element.selectionStart));
    setActive(0);
  };

  const choose = (person: Mentionable) => {
    if (!typing) {
      return;
    }
    const name = mentionName(person.name);
    const caret = typing.start + typing.query.length + 1;
    const inserted = `@${name} `;
    onChange(value.slice(0, typing.start) + inserted + value.slice(caret));
    if (!mentions.some((m) => m.userId === person.userId)) {
      onMentionsChange([...mentions, { userId: person.userId, name }]);
    }
    setTyping(null);
    caretAfter.current = typing.start + inserted.length;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter while composing text with an input method confirms that text, not a mention.
    if (!open || event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((selected + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      choose(suggestions[selected]!);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setTyping(null);
    }
  };

  return (
    <div className="mention-box">
      <textarea
        {...props}
        ref={area}
        value={value}
        aria-autocomplete="list"
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? optionId(selected) : undefined}
        onChange={(e) => {
          onChange(e.target.value);
          track(e.target);
        }}
        onSelect={(e) => track(e.currentTarget)}
        onKeyDown={onKeyDown}
        onBlur={() => setTyping(null)}
      />
      {open && (
        <ul id={listId} className="mention-list" role="listbox" aria-label="People to mention">
          {suggestions.map((person, index) => (
            <li
              key={person.userId}
              id={optionId(index)}
              role="option"
              aria-selected={index === selected}
              className={index === selected ? 'mention-option active' : 'mention-option'}
              // Keeps focus in the box, so choosing doesn't close the list first.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(person)}
            >
              <strong>{person.name}</strong> <span className="muted small">{person.email}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="visually-hidden" aria-live="polite">
        {open
          ? `${suggestions[selected]!.name}, ${selected + 1} of ${suggestions.length}. Use the arrow keys to choose and Enter to mention.`
          : ''}
      </p>
    </div>
  );
}
