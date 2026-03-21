import { describe, it, expect } from 'vitest';
import {
  calculateDimensions,
  formatBytes,
  compressionSavings,
} from './imageCompression';
import type { CompressImageOptions, CompressImageResult } from './imageCompression';

// =============================================================================
// calculateDimensions – pure function, no DOM needed
// =============================================================================
describe('calculateDimensions', () => {
  it('returns original dimensions when both are within maxDimension', () => {
    const result = calculateDimensions(800, 600, 1200);
    expect(result).toEqual({ width: 800, height: 600, scaled: false });
  });

  it('returns original dimensions when exactly at maxDimension', () => {
    const result = calculateDimensions(1200, 1200, 1200);
    expect(result).toEqual({ width: 1200, height: 1200, scaled: false });
  });

  it('scales down landscape image preserving aspect ratio', () => {
    const result = calculateDimensions(4000, 3000, 1200);
    expect(result.scaled).toBe(true);
    expect(result.width).toBe(1200);
    expect(result.height).toBe(900);
    // Aspect ratio preserved
    expect(result.width / result.height).toBeCloseTo(4000 / 3000, 1);
  });

  it('scales down portrait image preserving aspect ratio', () => {
    const result = calculateDimensions(3000, 4000, 1200);
    expect(result.scaled).toBe(true);
    expect(result.width).toBe(900);
    expect(result.height).toBe(1200);
    expect(result.width / result.height).toBeCloseTo(3000 / 4000, 1);
  });

  it('scales down square image', () => {
    const result = calculateDimensions(2400, 2400, 1200);
    expect(result.scaled).toBe(true);
    expect(result.width).toBe(1200);
    expect(result.height).toBe(1200);
  });

  it('handles very wide panoramic images', () => {
    const result = calculateDimensions(10000, 500, 1200);
    expect(result.scaled).toBe(true);
    expect(result.width).toBe(1200);
    expect(result.height).toBe(60);
  });

  it('handles very tall images', () => {
    const result = calculateDimensions(500, 10000, 1200);
    expect(result.scaled).toBe(true);
    expect(result.width).toBe(60);
    expect(result.height).toBe(1200);
  });

  it('handles small maxDimension (e.g., thumbnails)', () => {
    const result = calculateDimensions(1920, 1080, 150);
    expect(result.scaled).toBe(true);
    expect(result.width).toBe(150);
    expect(result.height).toBe(84);
  });

  it('does not scale up small images', () => {
    const result = calculateDimensions(100, 50, 1200);
    expect(result).toEqual({ width: 100, height: 50, scaled: false });
  });

  it('handles 1x1 pixel image', () => {
    const result = calculateDimensions(1, 1, 1200);
    expect(result).toEqual({ width: 1, height: 1, scaled: false });
  });

  it('scales down when only width exceeds maxDimension', () => {
    const result = calculateDimensions(2400, 800, 1200);
    expect(result.scaled).toBe(true);
    expect(result.width).toBe(1200);
    expect(result.height).toBe(400);
  });

  it('scales down when only height exceeds maxDimension', () => {
    const result = calculateDimensions(800, 2400, 1200);
    expect(result.scaled).toBe(true);
    expect(result.width).toBe(400);
    expect(result.height).toBe(1200);
  });
});

// =============================================================================
// formatBytes – pure function
// =============================================================================
describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes under 1 KB', () => {
    expect(formatBytes(512)).toBe('512.0 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(5.5 * 1024 * 1024)).toBe('5.5 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB');
  });

  it('formats typical photo sizes', () => {
    // 3.2 MB photo
    const result = formatBytes(3.2 * 1024 * 1024);
    expect(result).toBe('3.2 MB');
  });

  it('formats typical compressed photo sizes', () => {
    // 450 KB compressed
    const result = formatBytes(450 * 1024);
    expect(result).toBe('450.0 KB');
  });
});

// =============================================================================
// compressionSavings – pure function
// =============================================================================
describe('compressionSavings', () => {
  it('returns 0 when original is 0', () => {
    expect(compressionSavings(0, 0)).toBe(0);
  });

  it('returns 0 when sizes are equal (no compression)', () => {
    expect(compressionSavings(1000, 1000)).toBe(0);
  });

  it('calculates 50% savings', () => {
    expect(compressionSavings(1000, 500)).toBe(50);
  });

  it('calculates 75% savings', () => {
    expect(compressionSavings(4000, 1000)).toBe(75);
  });

  it('calculates typical photo compression savings (~70-80%)', () => {
    // 5MB original → 1.2MB compressed = 76% savings
    const original = 5 * 1024 * 1024;
    const compressed = 1.2 * 1024 * 1024;
    const savings = compressionSavings(original, compressed);
    expect(savings).toBe(76);
  });

  it('handles negative savings (compressed larger than original)', () => {
    const savings = compressionSavings(100, 120);
    expect(savings).toBe(-20);
  });

  it('returns 100 when compressed to 0', () => {
    expect(compressionSavings(1000, 0)).toBe(100);
  });
});

// =============================================================================
// Type checks – ensure interfaces are well-formed
// =============================================================================
describe('Type contracts', () => {
  it('CompressImageOptions has correct defaults documented', () => {
    const opts: CompressImageOptions = {};
    // All fields are optional
    expect(opts.maxDimension).toBeUndefined();
    expect(opts.quality).toBeUndefined();
    expect(opts.skipBelowBytes).toBeUndefined();
    expect(opts.outputType).toBeUndefined();
  });

  it('CompressImageResult shape is correct', () => {
    const result: CompressImageResult = {
      file: new File([], 'test.jpg'),
      preview: 'data:image/jpeg;base64,...',
      originalSize: 5000000,
      compressedSize: 1200000,
      wasCompressed: true,
      width: 1200,
      height: 900,
    };
    expect(result.wasCompressed).toBe(true);
    expect(result.originalSize).toBeGreaterThan(result.compressedSize);
  });

  it('CompressImageResult for skipped file', () => {
    const result: CompressImageResult = {
      file: new File([], 'small.jpg'),
      preview: '',
      originalSize: 100000,
      compressedSize: 100000,
      wasCompressed: false,
      width: 800,
      height: 600,
    };
    expect(result.wasCompressed).toBe(false);
    expect(result.originalSize).toBe(result.compressedSize);
  });
});
