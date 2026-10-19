import { Pause, Play } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

/**
 * The clip in the home page's hero: for now a How it works recording. To swap in a purpose-made clip, point `src` at
 * its files (`.mp4`, `.webm`, and a `.webp` poster, 16:10) and describe what it shows.
 */
export const heroClip = {
  src: '/how-it-works/plan-what-it-needs',
  label: 'IdeaVerse in action',
  description:
    'An idea’s page in IdeaVerse: three things the idea needs are added — a budget sign-off, a teaser video, and a launch venue — and two are ticked off as its progress bar fills.',
};

/**
 * The hero's product clip in a browser-window frame. It plays muted and on a loop, starting on its own only for
 * visitors who have not asked for reduced motion; everyone else sees its poster with a play button.
 */
export function HeroClip() {
  const video = useRef<HTMLVideoElement>(null);
  const descriptionId = useId();
  const [playing, setPlaying] = useState(false);

  // In an effect, so the prerendered page never touches matchMedia. A browser that blocks autoplay leaves the play button.
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches) {
      video.current?.play().catch(() => {});
    }
  }, []);

  return (
    <figure className="browser-frame">
      <div className="browser-bar" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="browser-screen">
        <video
          ref={video}
          muted
          loop
          playsInline
          preload="none"
          width={1024}
          height={640}
          poster={`${heroClip.src}.webp`}
          aria-label={heroClip.label}
          aria-describedby={descriptionId}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        >
          <source src={`${heroClip.src}.mp4`} type="video/mp4" />
          <source src={`${heroClip.src}.webm`} type="video/webm" />
        </video>
        {playing ? (
          <button type="button" className="video-pause" onClick={() => video.current?.pause()} aria-label="Pause video">
            <Pause aria-hidden="true" size={18} fill="currentColor" />
          </button>
        ) : (
          <button type="button" className="video-play" onClick={() => void video.current?.play()} aria-label="Play video">
            <Play aria-hidden="true" size={30} fill="currentColor" />
          </button>
        )}
      </div>
      <figcaption id={descriptionId} className="visually-hidden">
        {heroClip.description}
      </figcaption>
    </figure>
  );
}
