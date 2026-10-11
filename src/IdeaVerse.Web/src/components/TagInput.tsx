import { useState, type KeyboardEvent } from 'react';

/** The API's limits, so a tag that would be rejected is never added. */
export const maxTags = 10;
const maxTagLength = 30;

/** Trims a typed tag, collapses its spaces, and lower-cases it, as the API stores it. */
function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

interface TagInputProps {
  /** The control's id and description, from `Field`. */
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  tags: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Edits a list of tags: typing a tag and pressing Enter (or a comma) adds it as a chip, without submitting the form;
 * Backspace in the empty field removes the last one. Text still in the field is added when it loses focus.
 */
export function TagInput({ tags, onChange, ...field }: TagInputProps) {
  const [text, setText] = useState('');
  const full = tags.length >= maxTags;

  const add = (raw: string) => {
    const additions = raw.split(',').map(normalize).filter((t) => t !== '' && t.length <= maxTagLength);
    const next = [...tags];
    for (const tag of additions) {
      if (!next.includes(tag) && next.length < maxTags) {
        next.push(tag);
      }
    }
    if (next.length !== tags.length) {
      onChange(next);
    }
    setText('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(text);
    } else if (event.key === 'Backspace' && text === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="tag-input">
      {tags.length > 0 && (
        <ul className="tags" aria-label="Chosen tags">
          {tags.map((tag) => (
            <li key={tag} className="tag removable">
              {tag}
              <button type="button" className="tag-remove" aria-label={`Remove tag ${tag}`} onClick={() => onChange(tags.filter((t) => t !== tag))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        {...field}
        value={text}
        maxLength={maxTagLength}
        disabled={full}
        placeholder={full ? `Up to ${maxTags} tags` : tags.length === 0 ? 'e.g. marketing — press Enter to add' : 'Add another tag'}
        onChange={(e) => (e.target.value.includes(',') ? add(e.target.value) : setText(e.target.value))}
        onKeyDown={onKeyDown}
        onBlur={() => text.trim() && add(text)}
      />
    </div>
  );
}
