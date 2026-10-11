import type { MouseEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

const param = 'idea';

/** Opens ideas in the side panel, recorded in the address as `?idea=<id>`, so it can be shared and Back closes it. */
export function useIdeaPanel() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const openId = params.get(param);

  const open = (id: string) =>
    setParams(
      (current) => {
        current.set(param, id);
        return current;
      },
      // Switching from one open idea to another replaces it, so Back closes the panel instead of stepping through ideas.
      { replace: openId !== null, state: { panelOpened: true } },
    );

  const close = () => {
    if ((location.state as { panelOpened?: boolean } | null)?.panelOpened) {
      void navigate(-1);
    } else {
      setParams(
        (current) => {
          current.delete(param);
          return current;
        },
        { replace: true },
      );
    }
  };

  /**
   * Props for a link to an idea's page that opens the panel instead on a plain click; a click with a modifier key, or the
   * middle button, still opens the page, as links do.
   */
  const linkProps = (id: string) => ({
    to: `/ideas/${id}`,
    onClick: (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();
      open(id);
    },
  });

  return { openId, open, close, linkProps };
}
