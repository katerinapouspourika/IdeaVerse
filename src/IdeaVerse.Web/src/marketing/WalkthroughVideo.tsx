import { Play } from 'lucide-react';
import { useRef, useState } from 'react';

import type { Walkthrough } from './walkthroughs';

/**
 * A walkthrough clip that shows its poster with a large play button in the middle until it plays.
 * The browser's own controls appear once it has started, and the button comes back whenever it is paused.
 */
export function WalkthroughVideo({ walkthrough }: { walkthrough: Walkthrough }) {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(true);

  const play = () => {
    setStarted(true);
    void video.current?.play();
  };

  return (
    <div className="walkthrough-video">
      <video
        ref={video}
        controls={started}
        muted
        loop
        playsInline
        preload="metadata"
        width={1024}
        height={640}
        poster={`/how-it-works/${walkthrough.slug}.webp`}
        aria-label={`Video: ${walkthrough.title}`}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
      >
        <source src={`/how-it-works/${walkthrough.slug}.mp4`} type="video/mp4" />
        <source src={`/how-it-works/${walkthrough.slug}.webm`} type="video/webm" />
      </video>
      {paused && (
        <button type="button" className="video-play" onClick={play} aria-label={`Play video: ${walkthrough.title}`}>
          <Play aria-hidden="true" size={30} fill="currentColor" />
        </button>
      )}
    </div>
  );
}
