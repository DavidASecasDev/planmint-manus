import { useState, useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SkeletonTransitionProps {
  /** Whether the data is still loading */
  isLoading: boolean;
  /** The skeleton placeholder to show while loading */
  skeleton: ReactNode;
  /** The real content to show once loaded */
  children: ReactNode;
  /** Duration of the crossfade in ms (default 300) */
  duration?: number;
  /** Additional className for the wrapper */
  className?: string;
}

/**
 * Smooth crossfade transition between skeleton and real content.
 * - While loading: shows skeleton at full opacity
 * - When loading finishes: fades out skeleton, then fades in content
 * - Prevents layout shift by using absolute positioning during transition
 */
export function SkeletonTransition({
  isLoading,
  skeleton,
  children,
  duration = 300,
  className,
}: SkeletonTransitionProps) {
  const [phase, setPhase] = useState<'skeleton' | 'transitioning' | 'content'>(
    isLoading ? 'skeleton' : 'content'
  );
  const prevLoading = useRef(isLoading);

  useEffect(() => {
    // Only trigger transition when going from loading → loaded
    if (prevLoading.current && !isLoading) {
      setPhase('transitioning');
      const timer = setTimeout(() => {
        setPhase('content');
      }, duration);
      return () => clearTimeout(timer);
    }

    // If loading starts again, go back to skeleton immediately
    if (!prevLoading.current && isLoading) {
      setPhase('skeleton');
    }

    prevLoading.current = isLoading;
  }, [isLoading, duration]);

  const transitionStyle = {
    transition: `opacity ${duration}ms ease-in-out`,
  };

  if (phase === 'skeleton') {
    return (
      <div className={cn('relative', className)}>
        <div style={{ ...transitionStyle, opacity: 1 }}>
          {skeleton}
        </div>
      </div>
    );
  }

  if (phase === 'transitioning') {
    return (
      <div className={cn('relative', className)}>
        {/* Skeleton fading out */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{ ...transitionStyle, opacity: 0 }}
        >
          {skeleton}
        </div>
        {/* Content fading in */}
        <div style={{ ...transitionStyle, opacity: 1 }}>
          {children}
        </div>
      </div>
    );
  }

  // phase === 'content'
  return (
    <div className={cn('relative', className)}>
      <div style={{ ...transitionStyle, opacity: 1 }}>
        {children}
      </div>
    </div>
  );
}
