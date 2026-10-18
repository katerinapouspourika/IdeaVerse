import { useState, type FormEvent, type ReactNode } from 'react';

import { formatAgo, formatMoment } from '../api/dates';
import { useAddComment, useComments, useDeleteComment, useEditComment, useWorkspaceMembers } from '../api/queries';
import { personLabel, type Comment } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useConfirm, useToast } from '../components/Feedback';
import { Field } from '../components/Field';
import { ErrorMessage, LoadError, fieldError } from '../components/ErrorMessage';
import { Skeleton } from '../components/Skeleton';
import { MentionTextarea, type Mentionable } from '../mentions/MentionTextarea';
import { maxBodyLength, mentionLabels, segments, toBody, toEditable, type Mention } from '../mentions/mentions';
import { useLinkedItem } from './useLinkedItem';

/** The idea's comments, open to everyone in its workspace, who can mention each other with `@`. */
export function DiscussionSection({ ideaId, workspaceId }: { ideaId: string; workspaceId: string }) {
  const comments = useComments(ideaId);
  const people = useMentionable(workspaceId);
  const remove = useDeleteComment(ideaId);
  const confirm = useConfirm();
  const toast = useToast();
  const linked = useLinkedItem('comment', comments.data?.map((c) => c.id));

  const deleteComment = async (comment: Comment) => {
    if (await confirm({ title: 'Delete this comment?', message: 'This cannot be undone.', confirmLabel: 'Delete comment', danger: true })) {
      remove.mutate(comment.id, { onSuccess: () => toast({ message: 'Comment deleted' }) });
    }
  };

  return (
    <section className="card stack" aria-labelledby="discussion-heading">
      <h2 id="discussion-heading">Discussion</h2>
      {comments.isLoading && <Skeleton lines={2} />}
      {comments.data?.length === 0 && <p className="muted">No comments yet. Share a thought, a question, or a link.</p>}
      {comments.data && comments.data.length > 0 && (
        <ol className="comments">
          {comments.data.map((comment) => (
            <CommentItem
              key={comment.id}
              ideaId={ideaId}
              comment={comment}
              people={people}
              linked={linked === comment.id}
              onDelete={() => void deleteComment(comment)}
            />
          ))}
        </ol>
      )}
      <LoadError queries={comments} />
      <ErrorMessage error={remove.error} />
      <AddCommentForm ideaId={ideaId} people={people} />
    </section>
  );
}

/** The people in the workspace someone can mention, everyone but themselves, named as the API names them. */
function useMentionable(workspaceId: string): Mentionable[] {
  const members = useWorkspaceMembers(workspaceId);
  const { account } = useAuth();
  const labels = mentionLabels(members.data ?? []);
  return (members.data ?? [])
    .filter((m) => m.email !== account?.email)
    .map((m) => ({ userId: m.userId, name: labels.get(m.userId) ?? m.email, email: m.email }));
}

const tooLong = 'This comment is too long once its mentions are saved. Shorten it a little.';

/** Web addresses in a comment; punctuation that usually ends a sentence is left out of them. */
const urlPattern = /\bhttps?:\/\/[^\s<>"]*[^\s<>".,;:!?)\]}'’”]/gi;

/** Text with its http(s) addresses as links that open in a new tab. React escapes the text, so nothing in it becomes markup. */
function Linkified({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(urlPattern)) {
    parts.push(text.slice(last, match.index));
    parts.push(
      <a key={match.index} href={match[0]} target="_blank" rel="noopener noreferrer">
        {match[0]}
      </a>,
    );
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}

/** A comment's text, with its mentions marked and its web addresses linked. */
function CommentBody({ body }: { body: string }) {
  return (
    <p className="description">
      {segments(body).map((part, i) =>
        'mention' in part ? (
          <span key={i} className="mention">
            @{part.mention.name}
          </span>
        ) : (
          <Linkified key={i} text={part.text} />
        ),
      )}
    </p>
  );
}

interface CommentItemProps {
  ideaId: string;
  comment: Comment;
  people: Mentionable[];
  /** Whether a link, such as a notification's, just brought the user to this comment. */
  linked: boolean;
  onDelete: () => void;
}

function CommentItem({ ideaId, comment, people, linked, onDelete }: CommentItemProps) {
  const edit = useEditComment(ideaId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => toEditable(comment.body));
  const [mentions, setMentions] = useState<Mention[]>(draft.mentions);
  const author = comment.authorEmail ? personLabel(comment.authorName, comment.authorEmail) : 'A former member';

  const [lengthError, setLengthError] = useState<string | null>(null);

  const save = (event: FormEvent) => {
    event.preventDefault();
    const body = toBody(draft.text, mentions);
    setLengthError(body.length > maxBodyLength ? tooLong : null);
    if (body.length <= maxBodyLength) {
      edit.mutate({ id: comment.id, body }, { onSuccess: () => setEditing(false) });
    }
  };

  return (
    <li id={`comment-${comment.id}`} tabIndex={-1} className={linked ? 'comment linked' : 'comment'}>
      <div className="row spread wrap small">
        <strong>{author}</strong>
        <span className="muted">
          <time dateTime={comment.createdAt} title={formatMoment(comment.createdAt)}>
            {formatAgo(comment.createdAt)}
          </time>
          {comment.editedAt && ' · edited'}
        </span>
      </div>
      {editing ? (
        <form className="stack" onSubmit={save} aria-label="Edit comment">
          <Field label="Comment" error={lengthError ?? fieldError(edit.error, 'body')}>
            {(props) => (
              <MentionTextarea
                {...props}
                required
                rows={3}
                maxLength={4000}
                value={draft.text}
                onChange={(text) => setDraft({ ...draft, text })}
                mentions={mentions}
                onMentionsChange={setMentions}
                people={people}
              />
            )}
          </Field>
          <ErrorMessage error={edit.error} />
          <div className="row">
            <button type="submit" className="button primary small" disabled={edit.isPending}>
              Save
            </button>
            <button type="button" className="button ghost small" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <CommentBody body={comment.body} />
      )}
      {!editing && (comment.canEdit || comment.canDelete) && (
        <div className="row">
          {comment.canEdit && (
            <button
              type="button"
              className="button ghost small"
              onClick={() => {
                const editable = toEditable(comment.body);
                setDraft(editable);
                setMentions(editable.mentions);
                setEditing(true);
              }}
            >
              Edit
            </button>
          )}
          {comment.canDelete && (
            <button type="button" className="button ghost small" onClick={onDelete} aria-label={`Delete comment by ${author}`}>
              Delete
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function AddCommentForm({ ideaId, people }: { ideaId: string; people: Mentionable[] }) {
  const add = useAddComment(ideaId);
  const [body, setBody] = useState('');
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [lengthError, setLengthError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const saved = toBody(body, mentions);
    setLengthError(saved.length > maxBodyLength ? tooLong : null);
    if (saved.length > maxBodyLength) {
      return;
    }
    add.mutate(saved, {
      onSuccess: () => {
        setBody('');
        setMentions([]);
      },
    });
  };

  return (
    <form className="stack" onSubmit={submit} aria-label="Add comment">
      <Field label="Add a comment" hint="Type @ to mention someone in the workspace." error={lengthError ?? fieldError(add.error, 'body')}>
        {(props) => (
          <MentionTextarea
            {...props}
            required
            rows={3}
            maxLength={4000}
            value={body}
            onChange={setBody}
            mentions={mentions}
            onMentionsChange={setMentions}
            people={people}
          />
        )}
      </Field>
      <ErrorMessage error={add.error} />
      <div className="row">
        <button type="submit" className="button primary" disabled={add.isPending || !body.trim()}>
          Comment
        </button>
      </div>
    </form>
  );
}
