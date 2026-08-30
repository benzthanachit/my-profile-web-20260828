import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ASSETS_BUCKET, PROFILE_PHOTO_PREFIX } from '../constants';
import { fetchLatestFileUrl } from '../services/api';

const PEEK_DURATION_MS = 3000;
const CYCLE_DURATION_MS = 10000; // time from one peek's start to the next
const HIDDEN_DURATION_MS = CYCLE_DURATION_MS - PEEK_DURATION_MS;
const INITIAL_DELAY_MS = 2500;

type CornerName = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const CORNERS: Record<CornerName, { style: React.CSSProperties; hidden: string }> = {
  'bottom-right': { style: { bottom: '-24px', right: '-24px' }, hidden: 'translate(70px, 70px)' },
  'bottom-left': { style: { bottom: '-24px', left: '-24px' }, hidden: 'translate(-70px, 70px)' },
  'top-right': { style: { top: '-24px', right: '-24px' }, hidden: 'translate(70px, -70px)' },
  'top-left': { style: { top: '-24px', left: '-24px' }, hidden: 'translate(-70px, -70px)' },
};
const CORNER_NAMES = Object.keys(CORNERS) as CornerName[];

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

  const { style, hidden } = CORNERS[corner];

  return (
    <div
      className="fixed z-40 pointer-events-none"
      style={{
        ...style,
        transform: isPeeking ? 'translate(0, 0)' : hidden,
        transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <button
        onClick={peekAtNewCorner}
        aria-hidden="true"
        tabIndex={-1}
        className={`pointer-events-auto block w-16 h-16 sm:w-24 sm:h-24 rounded-full border-4 border-blue-600 dark:border-accent-blue shadow-xl overflow-hidden ${isPeeking ? 'animate-peekaboo-wobble' : ''}`}
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
