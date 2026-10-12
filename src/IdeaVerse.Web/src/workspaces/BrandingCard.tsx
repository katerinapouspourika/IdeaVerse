import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { useChangeBranding } from '../api/queries';
import type { Workspace } from '../api/types';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';
import { WorkspaceBadge } from './WorkspaceBadge';
import { workspaceColors, type WorkspaceColor } from './workspaceColors';

/** The largest logo the API accepts. */
const maxLogoBytes = 512 * 1024;

/**
 * Lets the owner and admins give the workspace a colour from the preset palette and a logo, shown beside its name in the
 * header. Fonts stay the app's own.
 */
export function BrandingCard({ workspace }: { workspace: Workspace }) {
  const change = useChangeBranding(workspace.id);
  const file = useRef<HTMLInputElement>(null);
  const [tooBig, setTooBig] = useState(false);
  // Shows the colour just picked straight away, while it is saved and the workspace list reloads.
  const picking = change.variables && 'color' in change.variables && !change.isError ? change.variables.color : undefined;
  const selected = picking !== undefined ? picking : (workspace.color ?? null);
  const logoError = tooBig ? 'Choose an image of up to 512 KB.' : fieldError(change.error, 'logo');

  const upload = (picked: File | undefined) => {
    setTooBig(picked !== undefined && picked.size > maxLogoBytes);
    if (picked && picked.size <= maxLogoBytes) {
      change.mutate({ logo: picked });
    }
  };

  return (
    <section className="card stack" aria-labelledby="branding-heading">
      <h2 id="branding-heading">Look</h2>
      <fieldset className="stack tight">
        <legend>Colour</legend>
        <div className="swatches">
          <label className="swatch" title="Default">
            <input type="radio" name="workspace-color" checked={selected === null} onChange={() => change.mutate({ color: null })} />
            <span className="swatch-dot" style={{ background: '#232b8f' }} aria-hidden="true" />
            <span className="visually-hidden">Default</span>
          </label>
          {(Object.keys(workspaceColors) as WorkspaceColor[]).map((key) => (
            <label key={key} className="swatch" title={workspaceColors[key].label}>
              <input type="radio" name="workspace-color" checked={selected === key} onChange={() => change.mutate({ color: key })} />
              <span className="swatch-dot" style={{ background: workspaceColors[key].value }} aria-hidden="true" />
              <span className="visually-hidden">{workspaceColors[key].label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="stack tight">
        <span className="label">Logo</span>
        <div className="row wrap">
          <WorkspaceBadge workspace={workspace} size={48} />
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="visually-hidden"
            aria-label="Upload a logo"
            onChange={(e) => {
              upload(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button type="button" className="button small" disabled={change.isPending} onClick={() => file.current?.click()}>
            <Upload aria-hidden="true" size={16} /> {workspace.logoUpdatedAt ? 'Replace logo' : 'Upload logo'}
          </button>
          {workspace.logoUpdatedAt && (
            <button type="button" className="button ghost small" disabled={change.isPending} onClick={() => change.mutate({ logo: null })}>
              Remove logo
            </button>
          )}
        </div>
        <small className="muted">A square PNG, JPEG, or WebP image of up to 512 KB. It shows beside the workspace’s name.</small>
        {logoError && (
          <p role="alert" className="error">
            {logoError}
          </p>
        )}
      </div>
      {!logoError && <ErrorMessage error={change.error} />}
    </section>
  );
}
