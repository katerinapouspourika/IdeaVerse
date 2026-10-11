import { useState, type FormEvent } from 'react';

import { formatMoment } from '../api/dates';
import { useAddComment, useComments, useDeleteComment, useEditComment } from '../api/queries';
import { personLabel, type Comment } from '../api/types';
import { Field } from '../components/Field';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';

/** The idea's comments, open to everyone in its workspace. */
export function DiscussionSection({ ideaId }: { ideaId: string }) {
  const comments = useComments(ideaId);
  const remove = useDeleteComment(ideaId);

  const deleteComment = (comment: Comment) => {
    if (window.confirm('Delete this comment?')) {
      remove.mutate(comment.id);
    }
  };

  return (
    <section className="card stack" aria-labelledby="discussion-heading">
      <h2 id="discussion-heading">Discussion</h2>
      {comments.isLoading && <p className="muted">Loading…</p>}
      {comments.data?.length === 0 && <p className="muted">No comments yet. Share a thought, a question, or a link.</p>}
      {comments.data && comments.data.length > 0 && (
        <ol className="comments">
          {comments.data.map((comment) => (
            <CommentItem key={comment.id} ideaId={ideaId} comment={comment} onDelete={() => deleteComment(comment)} />
          ))}
        </ol>
      )}
      <ErrorMessage error={comments.error ?? remove.error} />
      <AddCommentForm ideaId={ideaId} />
    </section>
  );
}

function CommentItem({ ideaId, comment, onDelete }: { ideaId: string; comment: Comment; onDelete: () => void }) {
  const edit = useEditComment(ideaId);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);
  const author = comment.authorEmail ? personLabel(comment.authorName, comment.authorEmail) : 'A former member';

  const save = (event: FormEvent) => {
    event.preventDefault();
    edit.mutate({ id: comment.id, body }, { onSuccess: () => setEditing(false) });
  };

  return (
    <li className="comment">
      <div className="row spread wrap small">
        <strong>{author}</strong>
        <span className="muted">
          {formatMoment(comment.createdAt)}
          {comment.editedAt && ' · edited'}
        </span>
      </div>
      {editing ? (
        <form className="stack" onSubmit={save} aria-label="Edit comment">
          <Field label="Comment" error={fieldError(edit.error, 'body')}>
            {(props) => <textarea {...props} required rows={3} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />}
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
        <p className="description">{comment.body}</p>
      )}
      {!editing && (comment.canEdit || comment.canDelete) && (
        <div className="row">
          {comment.canEdit && (
            <button type="button" className="button ghost small" onClick={() => setEditing(true)}>
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

function AddCommentForm({ ideaId }: { ideaId: string }) {
  const add = useAddComment(ideaId);
  const [body, setBody] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    add.mutate(body, { onSuccess: () => setBody('') });
  };

  return (
    <form className="stack" onSubmit={submit} aria-label="Add comment">
      <Field label="Add a comment" error={fieldError(add.error, 'body')}>
        {(props) => <textarea {...props} required rows={3} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />}
      </Field>
      <ErrorMessage error={add.error} />
      <div className="row">
        <button type="submit" className="button" disabled={add.isPending || !body.trim()}>
          Comment
        </button>
      </div>
    </form>
  );
}
