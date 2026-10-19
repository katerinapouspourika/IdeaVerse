import type { ClipboardEvent, KeyboardEvent } from 'react';

import { splitEmails } from './sendInvitations';

/** One address in the list, and what stops it being invited, if anything. */
export interface EmailChip {
  email: string;
  problem?: string;
}

interface EmailListInputProps {
  /** The control's id and description, from `Field`. */
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  chips: EmailChip[];
  /** Adds addresses typed or pasted; the form decides what to do with one already in the list. */
  onAdd: (emails: string[]) => void;
  onRemove: (email: string) => void;
  /** Text not yet turned into chips, kept by the form so sending picks it up too. */
  text: string;
  onTextChange: (text: string) => void;
}

/**
 * Edits a list of email addresses as chips: a pasted list, or a comma, semicolon, space, or Enter after an address, turns
 * the text into chips without submitting the form; Backspace in the empty field removes the last one. Text still in the
 * field becomes chips when it loses focus. Chips with a problem are marked; the form lists why. A chip wider than the
 * box is cut short with an ellipsis, its whole address still read out and shown on hover.
 */
export function EmailListInput({ chips, onAdd, onRemove, text, onTextChange, ...field }: EmailListInputProps) {
  const commit = (raw: string) => {
    const emails = splitEmails(raw);
    onTextChange('');
    if (emails.length > 0) {
      onAdd(emails);
    }
  };

  const change = (value: string) => {
    // A separator ends an address: everything before the last one becomes chips, and the rest stays to be typed on.
    const last = Math.max(value.lastIndexOf(','), value.lastIndexOf(';'), value.lastIndexOf(' '));
    if (last === -1) {
      onTextChange(value);
      return;
    }
    const done = splitEmails(value.slice(0, last));
    onTextChange(value.slice(last + 1));
    if (done.length > 0) {
      onAdd(done);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && text.trim() !== '') {
      event.preventDefault();
      commit(text);
    } else if (event.key === 'Backspace' && text === '' && chips.length > 0) {
      onRemove(chips[chips.length - 1]!.email);
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    commit(text + ' ' + event.clipboardData.getData('text'));
  };

  return (
    <div className="tag-input">
      {chips.length > 0 && (
        <ul className="tags" aria-label="Addresses to invite">
          {chips.map((chip) => (
            <li
              key={chip.email}
              className={chip.problem ? 'tag removable flagged' : 'tag removable'}
              title={chip.problem ? `${chip.email} — ${chip.problem}` : chip.email}
            >
              <span className="tag-text">{chip.email}</span>
              <button type="button" className="tag-remove" aria-label={`Remove ${chip.email}`} onClick={() => onRemove(chip.email)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        {...field}
        type="text"
        inputMode="email"
        autoComplete="off"
        value={text}
        placeholder={chips.length === 0 ? 'name@company.com, another@company.com' : 'Add another'}
        onChange={(e) => change(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => text.trim() && commit(text)}
      />
    </div>
  );
}
