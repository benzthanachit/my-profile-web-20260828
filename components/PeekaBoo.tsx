import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ASSETS_BUCKET, PROFILE_PHOTO_PREFIX } from '../constants';
import { fetchLatestFileUrl } from '../services/api';

const PEEK_DURATION_MS = 3000;
const CYCLE_DURATION_MS = 10000; // time from one peek's start to the next
const HIDDEN_DURATION_MS = CYCLE_DURATION_MS - PEEK_DURATION_MS;
const INITIAL_DELAY_MS = 2500;

const SIZE = 80; // fixed circle diameter (px), same at every breakpoint so the vw/vh math below stays exact
const OVERLAP = 24; // px past the edge it sits at while peeking, like the corner it's poking out of
const DODGE = 70; // extra px pushed further off-screen while hidden

type CornerName = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type Axis = 'near' | 'far';

const CORNER_AXES: Record<CornerName, { x: Axis; y: Axis }> = {
  'top-left': { x: 'near', y: 'near' },
  'top-right': { x: 'far', y: 'near' },
  'bottom-left': { x: 'near', y: 'far' },
  'bottom-right': { x: 'far', y: 'far' },
};
const CORNER_NAMES = Object.keys(CORNER_AXES) as CornerName[];

// The wrapper is always anchored at the viewport's top-left (top:0; left:0) and never moves
// its own position/anchor properties - every corner, and the peek/hidden states, are expressed
// purely as a `transform: translate()` value using vw/vh so no JS viewport measurement is
// needed. Keeping it to one always-transitioned property avoids the instability of swapping
// which CSS side (top/bottom, left/right) is set, which broke the transition mid-dodge.
// `extraPx` folds the dodge offset into the same expression instead of nesting a second
// calc() around this one - nested calc() didn't reliably resolve in testing.
const edge = (axis: Axis, viewportUnit: 'vw' | 'vh', extraPx: number) =>
  axis === 'near' ? `${-OVERLAP + extraPx}px` : `calc(100${viewportUnit} - ${SIZE - OVERLAP - extraPx}px)`;

const peekTransform = (corner: CornerName) => {
  const { x, y } = CORNER_AXES[corner];
  return `translate(${edge(x, 'vw', 0)}, ${edge(y, 'vh', 0)})`;
};

const hiddenTransform = (corner: CornerName) => {
  const { x, y } = CORNER_AXES[corner];
  const dodgeX = x === 'near' ? -DODGE : DODGE;
  const dodgeY = y === 'near' ? -DODGE : DODGE;
  return `translate(${edge(x, 'vw', dodgeX)}, ${edge(y, 'vh', dodgeY)})`;
};

const randomCorner = (exclude?: CornerName): CornerName => {
  const options = exclude ? CORNER_NAMES.filter(c => c !== exclude) : CORNER_NAMES;
  return options[Math.floor(Math.random() * options.length)];
};

// A little easter egg: the site owner's photo peeks up from a random screen corner every
// so often, then ducks back down - and instantly dodges to a different corner if you try to
// click it. Purely decorative and non-essential, so it's aria-hidden and excluded from tab
// order rather than competing for screen-reader/keyboard attention.
const PeekaBoo: React.FC = () => {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isPeeking, setIsPeeking] = useState(false);
  const [corner, setCorner] = useState<CornerName>(() => randomCorner());
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    fetchLatestFileUrl(ASSETS_BUCKET, PROFILE_PHOTO_PREFIX)
      .then(setPhotoUrl)
      .catch(error => console.error('Failed to fetch profile photo:', error));
  }, []);

  // Shows up at a new random corner, waits PEEK_DURATION_MS, hides, waits
  // HIDDEN_DURATION_MS, then calls itself again - one loop that both the initial
  // mount and a click-triggered dodge feed into, so there's never more than one
  // pending timer.
  const peekAtNewCorner = useCallback(() => {
    setCorner(prev => randomCorner(prev));
    setIsPeeking(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsPeeking(false);
      timeoutRef.current = setTimeout(peekAtNewCorner, HIDDEN_DURATION_MS);
    }, PEEK_DURATION_MS);
  }, []);

  useEffect(() => {
    if (!photoUrl) return;
    timeoutRef.current = setTimeout(peekAtNewCorner, INITIAL_DELAY_MS);
    return () => clearTimeout(timeoutRef.current);
  }, [photoUrl, peekAtNewCorner]);

  if (!photoUrl) return null;

  return (
    <div
      className="fixed top-0 left-0 z-[60] pointer-events-none"
      style={{
        transform: isPeeking ? peekTransform(corner) : hiddenTransform(corner),
        transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <button
        onClick={() => isPeeking && peekAtNewCorner()}
        aria-hidden="true"
        tabIndex={-1}
        style={{ width: SIZE, height: SIZE }}
        className={`block rounded-full border-4 border-blue-600 dark:border-accent-blue shadow-xl overflow-hidden ${isPeeking ? 'pointer-events-auto animate-peekaboo-wobble' : 'pointer-events-none'}`}
      >
        <img src={photoUrl} alt="" className="w-full h-full object-cover" />
      </button>
      <style>{`
        @keyframes peekaboo-wobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-6deg); }
          75% { transform: rotate(6deg); }
        }
        .animate-peekaboo-wobble {
          animation: peekaboo-wobble 2.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default PeekaBoo;
