import { useState, type FormEvent } from 'react';

import { addDays, todayIso } from '../api/dates';
import { useAddComponents, useCreateIdea } from '../api/queries';
import { useToast } from '../components/Feedback';
import { Field } from '../components/Field';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';
import { TagInput } from '../components/TagInput';
import { findTemplate, templates, type IdeaTemplate } from '../templates/templates';

interface NewIdeaFormProps {
  workspaceId: string;
  /** Title and description to start from, such as a brainstormed idea's. */
  initial?: { title: string; description: string };
  /** The template to start from, by its slug, as the template gallery asks for. */
  template?: string;
  onDone: () => void;
}

/** Whether a template's title has a part to fill in, such as "Launch: [product name]". */
const hasPlaceholder = (title: string) => /\[[^\]]*\]/.test(title);

/** The title a template starts the idea with: its own when complete, or none when the user has a part to fill in. */
const startingTitle = (template: IdeaTemplate) => (hasPlaceholder(template.title) ? '' : template.title);

/**
 * Adds an idea, either blank or from a template. A template fills in the fields, which can still be changed, and its
 * checklist is added to the idea once it is saved. A template title with a part to fill in, such as
 * "Launch: [product name]", is offered as the title's placeholder and hint instead, so the brackets are never saved.
 */
export function NewIdeaForm({ workspaceId, initial, template: initialTemplate, onDone }: NewIdeaFormProps) {
  const create = useCreateIdea(workspaceId);
  const addComponents = useAddComponents();
  const toast = useToast();
  const today = todayIso();
  const starting = findTemplate(initialTemplate);
  const [templateSlug, setTemplateSlug] = useState(starting?.slug ?? '');
  const [title, setTitle] = useState(starting ? startingTitle(starting) : (initial?.title ?? ''));
  const [description, setDescription] = useState(starting?.description ?? initial?.description ?? '');
  const [targetDate, setTargetDate] = useState(addDays(today, starting?.days ?? 14));
  const [tags, setTags] = useState<string[]>(starting?.tags ?? []);
  const template = findTemplate(templateSlug);
  const suggestion = template && hasPlaceholder(template.title) ? template.title : undefined;

  const chooseTemplate = (slug: string) => {
    setTemplateSlug(slug);
    const chosen = findTemplate(slug);
    if (chosen) {
      setTitle(startingTitle(chosen));
      setDescription(chosen.description);
      setTags(chosen.tags);
      setTargetDate(addDays(today, chosen.days));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const idea = await create.mutateAsync({ title, description: description || null, targetDate, tags }).catch(() => null);
    if (!idea) {
      return;
    }
    if (template) {
      await addComponents
        .mutateAsync({ ideaId: idea.id, components: template.components.map((c) => ({ title: c.title, notes: c.notes ?? null })) })
        .catch(() => toast({ message: `Added “${idea.title}”, but not all of its checklist. Add the rest on its page.`, tone: 'error' }));
    }
    onDone();
  };
  const saving = create.isPending || addComponents.isPending;

  return (
    <form className="card stack" onSubmit={(event) => void submit(event)} aria-label="New idea">
      <h2>New idea</h2>
      <Field label="Start from" hint={template ? `Adds ${template.components.length} things it needs once saved.` : undefined}>
        {(props) => (
          <select {...props} value={templateSlug} onChange={(e) => chooseTemplate(e.target.value)}>
            <option value="">A blank idea</option>
            {templates.map((t) => (
              <option key={t.slug} value={t.slug}>
                Template: {t.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      {template && (
        <details className="template-preview small">
          <summary>What the {template.name.toLowerCase()} template adds</summary>
          <ul>
            {template.components.map((c) => (
              <li key={c.title}>{c.title}</li>
            ))}
          </ul>
        </details>
      )}
      <Field label="Title" hint={suggestion ? `Suggested: ${suggestion}` : undefined} error={fieldError(create.error, 'title')}>
        {(props) => (
          <input
            {...props}
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={suggestion ?? 'e.g. Black Friday teaser campaign'}
          />
        )}
      </Field>
      <Field label="Target date" error={fieldError(create.error, 'targetDate')}>
        {(props) => (
          <input {...props} type="date" required min={today} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        )}
      </Field>
      <Field label=<>Description <span className="muted">(optional)</span></>>
        {(props) => (
          <textarea {...props} rows={3} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />
        )}
      </Field>
      <Field label=<>Tags <span className="muted">(optional)</span></> hint="Type a tag and press Enter to add it." error={fieldError(create.error, 'tags')}>
        {(props) => <TagInput {...props} tags={tags} onChange={setTags} />}
      </Field>
      <ErrorMessage error={create.error} />
      <div className="row">
        <button type="submit" className="button primary" disabled={saving}>
          {saving ? 'Saving…' : 'Add idea'}
        </button>
        <button type="button" className="button ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

