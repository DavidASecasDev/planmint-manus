/**
 * Tests for AnimatedMarker component and LiveMap GPS realtime improvements.
 *
 * Verifies:
 * 1. AnimatedMarker component exists and exports correctly
 * 2. LiveMap uses AnimatedMarker instead of static Marker for live car positions
 * 3. LiveMap liveRoutes are throttled (not re-fetched on every GPS update)
 * 4. useRealtimeEnCamino hook properly updates current_lat/current_lng on UPDATE events
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');

describe('AnimatedMarker component', () => {
  const filePath = path.join(ROOT, 'components/map/AnimatedMarker.tsx');

  it('exists', () => {
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('exports AnimatedMarker as a named export', () => {
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('export function AnimatedMarker');
  });

  it('uses requestAnimationFrame for smooth animation', () => {
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('requestAnimationFrame');
  });

  it('uses ease-out cubic easing', () => {
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('1 - Math.pow(1 - progress, 3)');
  });

  it('calls setLatLng on the marker ref for direct position updates', () => {
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('setLatLng');
  });

  it('accepts animationDuration prop', () => {
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('animationDuration');
  });

  it('cancels ongoing animation when position changes', () => {
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('cancelAnimationFrame');
  });
});

describe('LiveMap uses AnimatedMarker for live car markers', () => {
  const filePath = path.join(ROOT, 'pages/LiveMap.tsx');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(filePath, 'utf-8');
  });

  it('imports AnimatedMarker', () => {
    expect(content).toContain("import { AnimatedMarker }");
  });

  it('uses <AnimatedMarker> instead of <Marker> for live car positions', () => {
    expect(content).toContain('<AnimatedMarker');
    // The live car section should NOT use plain <Marker> for live positions
    const liveSection = content.split('Live location car markers')[1]?.split('Destination markers')[0] || '';
    expect(liveSection).toContain('AnimatedMarker');
    expect(liveSection).not.toContain('<Marker');
  });

  it('passes animationDuration to AnimatedMarker', () => {
    expect(content).toContain('animationDuration={2000}');
  });
});

describe('LiveMap liveRoutes are throttled', () => {
  const filePath = path.join(ROOT, 'pages/LiveMap.tsx');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(filePath, 'utf-8');
  });

  it('uses a timer ref for throttling liveRoutes', () => {
    expect(content).toContain('liveRouteTimerRef');
  });

  it('uses setInterval for periodic route updates (not on every GPS update)', () => {
    expect(content).toContain('setInterval');
    expect(content).toContain('30_000');
  });

  it('cleans up the interval on unmount', () => {
    expect(content).toContain('clearInterval(liveRouteTimerRef.current)');
  });
});

describe('useRealtimeEnCamino handles UPDATE events with location data', () => {
  const filePath = path.join(ROOT, 'hooks/useRealtimeEnCamino.ts');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(filePath, 'utf-8');
  });

  it('defines current_lat and current_lng in the EnCaminoRecord interface', () => {
    expect(content).toContain('current_lat');
    expect(content).toContain('current_lng');
  });

  it('handles UPDATE events by merging new data into existing records', () => {
    expect(content).toContain("case 'UPDATE':");
    expect(content).toContain('{ ...r, ...newRow }');
  });

  it('subscribes to postgres_changes on en_camino_tracking', () => {
    expect(content).toContain("table: 'en_camino_tracking'");
    expect(content).toContain('postgres_changes');
  });

  it('provides realtimeStatus for connection indicator', () => {
    expect(content).toContain('realtimeStatus');
    expect(content).toContain("'connected'");
    expect(content).toContain("'connecting'");
    expect(content).toContain("'disconnected'");
  });
});
