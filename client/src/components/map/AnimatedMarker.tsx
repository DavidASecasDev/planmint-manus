/**
 * AnimatedMarker — A Leaflet marker that smoothly animates to new positions.
 *
 * Uses requestAnimationFrame with ease-out cubic interpolation for smooth
 * "WhatsApp live location" style movement between GPS updates.
 *
 * Key design decisions:
 * - Bypasses react-leaflet's Marker component entirely to avoid ref timing issues
 * - Creates and manages the Leaflet marker instance directly via useMap()
 * - Stores current interpolated position in a ref for animation continuity
 * - Cleans up marker on unmount
 */
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface AnimatedMarkerProps {
  position: [number, number];
  icon: L.DivIcon | L.Icon;
  children?: React.ReactNode;
  /** Duration of the animation in ms (default: 2000) */
  animationDuration?: number;
  /** Unique key for this marker (used for CSS class targeting) */
  markerId?: string;
  /** Popup content as HTML string */
  popupContent?: string;
}

/**
 * Smoothly interpolates the marker position using requestAnimationFrame.
 * This gives a fluid "gliding" effect like WhatsApp/Google Maps live sharing.
 *
 * Instead of using react-leaflet's <Marker> (which has ref timing issues with
 * createLayerComponent), this component creates a native Leaflet marker and
 * manages it imperatively. This guarantees we always have access to the marker
 * instance for setLatLng() calls.
 */
export function AnimatedMarker({
  position,
  icon,
  children,
  animationDuration = 2000,
  markerId,
  popupContent,
}: AnimatedMarkerProps) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const animationRef = useRef<number | null>(null);
  const currentPosRef = useRef<[number, number]>(position);
  const targetPosRef = useRef<[number, number]>(position);
  const durationRef = useRef(animationDuration);
  durationRef.current = animationDuration;

  // Create marker on mount, remove on unmount
  useEffect(() => {
    const marker = L.marker(position, { icon }).addTo(map);
    markerRef.current = marker;
    currentPosRef.current = position;
    targetPosRef.current = position;

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      map.removeLayer(marker);
      markerRef.current = null;
    };
    // Only run on mount/unmount — position changes handled by the animation effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, icon]);

  // Update popup content when it changes
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker || !popupContent) return;
    marker.bindPopup(popupContent);
  }, [popupContent]);

  // Animate to new position when position prop changes
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const newLat = position[0];
    const newLng = position[1];
    const prevTarget = targetPosRef.current;

    // Skip if target hasn't meaningfully changed
    if (
      Math.abs(newLat - prevTarget[0]) < 0.000001 &&
      Math.abs(newLng - prevTarget[1]) < 0.000001
    ) {
      return;
    }

    // Update target
    targetPosRef.current = [newLat, newLng];

    // Start animation from current interpolated position to new target
    const startPos: [number, number] = [...currentPosRef.current];
    const endPos: [number, number] = [newLat, newLng];

    const distance = Math.sqrt(
      Math.pow(endPos[0] - startPos[0], 2) + Math.pow(endPos[1] - startPos[1], 2)
    );

    // If distance is negligible, just snap
    if (distance < 0.000001) {
      marker.setLatLng(endPos);
      currentPosRef.current = endPos;
      return;
    }

    // Cancel any ongoing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    const startTime = performance.now();
    const duration = durationRef.current;

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);

      const lat = startPos[0] + (endPos[0] - startPos[0]) * eased;
      const lng = startPos[1] + (endPos[1] - startPos[1]) * eased;

      if (!marker) return;
      marker.setLatLng([lat, lng]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position[0], position[1]]);

  // This component doesn't render any React elements — it's purely imperative
  return null;
}

export default AnimatedMarker;
