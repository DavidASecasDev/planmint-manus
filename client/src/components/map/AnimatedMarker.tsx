/**
 * AnimatedMarker — A Leaflet marker that smoothly animates to new positions.
 * 
 * Unlike react-leaflet's <Marker>, which may not reliably update the marker
 * position on prop changes (especially with divIcon), this component uses
 * a ref to call setLatLng() directly on the Leaflet marker instance,
 * with CSS transition for smooth movement.
 * 
 * This creates the "WhatsApp live location" effect where the marker
 * glides smoothly between GPS updates.
 */
import { useEffect, useRef } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

interface AnimatedMarkerProps {
  position: [number, number];
  icon: L.DivIcon | L.Icon;
  children?: React.ReactNode;
  /** Duration of the animation in ms (default: 1000) */
  animationDuration?: number;
  /** Unique key for this marker (used for CSS class targeting) */
  markerId?: string;
}

/**
 * Smoothly interpolates the marker position using requestAnimationFrame.
 * This gives a fluid "gliding" effect like WhatsApp/Google Maps live sharing.
 */
export function AnimatedMarker({
  position,
  icon,
  children,
  animationDuration = 1000,
  markerId,
}: AnimatedMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);
  const animationRef = useRef<number | null>(null);
  const currentPosRef = useRef<[number, number]>(position);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const startPos = currentPosRef.current;
    const endPos = position;

    // Skip animation if positions are the same or very close
    const distance = Math.sqrt(
      Math.pow(endPos[0] - startPos[0], 2) + Math.pow(endPos[1] - startPos[1], 2)
    );
    if (distance < 0.000001) return;

    // Cancel any ongoing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startTime = performance.now();
    const duration = animationDuration;

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);

      const lat = startPos[0] + (endPos[0] - startPos[0]) * eased;
      const lng = startPos[1] + (endPos[1] - startPos[1]) * eased;

      marker?.setLatLng([lat, lng]);
      currentPosRef.current = [lat, lng];

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
        currentPosRef.current = endPos;
      }
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [position[0], position[1], animationDuration]);

  return (
    <Marker
      ref={markerRef}
      position={currentPosRef.current}
      icon={icon}
    >
      {children}
    </Marker>
  );
}

export default AnimatedMarker;
