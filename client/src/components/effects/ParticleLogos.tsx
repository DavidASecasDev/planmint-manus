/*
 * ParticleLogos — Canvas-based particle effect
 * Particles form each company logo, then dissolve and reform into the next one.
 * Uses the gold/warm palette from Azul Cars brand on navy background.
 *
 * Key design decisions:
 * - 6000 particles at size 0.8–1.8px for crisp, readable logo formations
 * - Generous padding (20% on each side) so logos never get clipped
 * - Logos are scaled to fit within the safe area, centered vertically
 * - Sampling resolution of 2px for fine detail capture
 */
import { useEffect, useRef, useCallback } from 'react';

// ── Logo CDN URLs (white logos on transparent bg) ──
const LOGOS = [
  {
    name: 'Azul Cars',
    url: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663452253312/ixFK4yeJEEAkh8kCZkpztM/JDJerQoEHdAPkIQV_7d3082e3.png',
  },
  {
    name: 'Bluebnc',
    url: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663452253312/ixFK4yeJEEAkh8kCZkpztM/RNMXrbwMCtfXxWKj_1969822a.png',
  },
  {
    name: 'Azul Privé',
    url: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663452253312/ixFK4yeJEEAkh8kCZkpztM/rSZzhtiSNSYWIdCO_3d313c31.png',
  },
  {
    name: 'Azul Group',
    url: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663452253312/ixFK4yeJEEAkh8kCZkpztM/ByjYshxwpzSytyIm_fa54030e.png',
  },
  {
    name: 'Azul Spaces',
    url: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663452253312/ixFK4yeJEEAkh8kCZkpztM/ADLexKwRdqmKeWvN_0b430350.png',
  },
];

// ── Particle color palette (warm golds, ambers, tans) ──
const PARTICLE_COLORS = [
  '#C9A96E',
  '#D4B87A',
  '#B8956A',
  '#E0C88C',
  '#A68B5B',
  '#CCAA70',
  '#D9BC82',
  '#BFA068',
];

interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  originX: number;
  originY: number;
  size: number;
  color: string;
  alpha: number;
  wobbleAngle: number;
  wobbleSpeed: number;
  wobbleRadius: number;
}

// ── Configuration ──
const PARTICLE_COUNT = 6000;
const FORMATION_DURATION = 2200;
const HOLD_DURATION = 3500;
const DISSOLVE_DURATION = 1200;
const SAMPLE_RESOLUTION = 2; // finer sampling for better detail

/**
 * Sample non-transparent pixel positions from a logo image,
 * scaled and centered within a safe area of the canvas.
 */
function sampleLogoPositions(
  img: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
  count: number,
): { x: number; y: number }[] {
  if (canvasWidth <= 0 || canvasHeight <= 0 || img.width <= 0 || img.height <= 0) {
    return Array.from({ length: count }, () => ({
      x: (canvasWidth || 400) / 2 + (Math.random() - 0.5) * 200,
      y: (canvasHeight || 400) / 2 + (Math.random() - 0.5) * 100,
    }));
  }

  const offscreen = document.createElement('canvas');

  // Safe area: 20% padding on left/right, 25% on top/bottom
  const padX = canvasWidth * 0.15;
  const padY = canvasHeight * 0.20;
  const safeW = canvasWidth - padX * 2;
  const safeH = canvasHeight - padY * 2;

  // Scale logo to fit within safe area (never exceed it)
  const scaleX = safeW / img.width;
  const scaleY = safeH / img.height;
  const scale = Math.min(scaleX, scaleY) * 0.85; // 85% of max to add extra breathing room

  const drawW = img.width * scale;
  const drawH = img.height * scale;

  // Center within the full canvas
  const offsetX = (canvasWidth - drawW) / 2;
  const offsetY = (canvasHeight - drawH) / 2;

  offscreen.width = Math.round(canvasWidth);
  offscreen.height = Math.round(canvasHeight);
  const ctx = offscreen.getContext('2d')!;
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

  const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
  const pixels = imageData.data;
  const positions: { x: number; y: number }[] = [];
  const w = offscreen.width;

  for (let y = 0; y < offscreen.height; y += SAMPLE_RESOLUTION) {
    for (let x = 0; x < w; x += SAMPLE_RESOLUTION) {
      const i = (y * w + x) * 4;
      if (pixels[i + 3] > 30) {
        positions.push({ x, y });
      }
    }
  }

  // Shuffle and pick the right amount
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  if (positions.length >= count) {
    return positions.slice(0, count);
  }

  // Duplicate if not enough
  const result = [...positions];
  while (result.length < count) {
    const src = positions[Math.floor(Math.random() * positions.length)];
    result.push({
      x: src.x + (Math.random() - 0.5) * 2,
      y: src.y + (Math.random() - 0.5) * 2,
    });
  }
  return result;
}

export function ParticleLogos() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const phaseRef = useRef<'forming' | 'holding' | 'dissolving'>('forming');
  const phaseStartRef = useRef(0);
  const currentLogoRef = useRef(0);
  const logoPositionsRef = useRef<{ x: number; y: number }[][]>([]);

  const initParticles = useCallback((width: number, height: number) => {
    const particles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      particles.push({
        x,
        y,
        targetX: x,
        targetY: y,
        originX: x,
        originY: y,
        size: Math.random() * 1.0 + 0.8, // 0.8 – 1.8px (much smaller)
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        alpha: Math.random() * 0.2 + 0.05,
        wobbleAngle: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.015 + 0.003,
        wobbleRadius: Math.random() * 1.2 + 0.3,
      });
    }
    return particles;
  }, []);

  const loadAllLogos = useCallback(async (width: number, height: number) => {
    const allPositions: { x: number; y: number }[][] = [];

    for (const logo of LOGOS) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = logo.url;
        });
        allPositions.push(sampleLogoPositions(img, width, height, PARTICLE_COUNT));
      } catch (err) {
        console.warn(`Failed to load logo: ${logo.name}`, err);
        allPositions.push(
          Array.from({ length: PARTICLE_COUNT }, () => ({
            x: width / 2 + (Math.random() - 0.5) * 200,
            y: height / 2 + (Math.random() - 0.5) * 100,
          })),
        );
      }
    }

    return allPositions;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const setup = async () => {
      // Wait for layout
      let rect = canvas.getBoundingClientRect();
      let retries = 0;
      while ((rect.width === 0 || rect.height === 0) && retries < 30) {
        await new Promise((r) => setTimeout(r, 80));
        rect = canvas.getBoundingClientRect();
        retries++;
      }
      if (rect.width === 0 || rect.height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const w = rect.width;
      const h = rect.height;

      particlesRef.current = initParticles(w, h);
      logoPositionsRef.current = await loadAllLogos(w, h);

      if (logoPositionsRef.current.length > 0) {
        const positions = logoPositionsRef.current[0];
        particlesRef.current.forEach((p, i) => {
          p.targetX = positions[i].x;
          p.targetY = positions[i].y;
          p.originX = p.x;
          p.originY = p.y;
        });
      }

      phaseRef.current = 'forming';
      phaseStartRef.current = performance.now();

      const animate = (time: number) => {
        if (!running) return;

        const elapsed = time - phaseStartRef.current;
        const phase = phaseRef.current;

        ctx.clearRect(0, 0, w, h);

        const particles = particlesRef.current;
        const len = particles.length;

        for (let idx = 0; idx < len; idx++) {
          const p = particles[idx];
          p.wobbleAngle += p.wobbleSpeed;

          if (phase === 'forming') {
            const progress = Math.min(elapsed / FORMATION_DURATION, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            p.x = p.originX + (p.targetX - p.originX) * ease;
            p.y = p.originY + (p.targetY - p.originY) * ease;
            p.alpha = 0.1 + progress * 0.85;
          } else if (phase === 'holding') {
            p.x = p.targetX + Math.sin(p.wobbleAngle) * p.wobbleRadius;
            p.y = p.targetY + Math.cos(p.wobbleAngle * 0.7) * p.wobbleRadius;
            p.alpha = 0.9 + Math.sin(p.wobbleAngle * 2) * 0.08;
          } else if (phase === 'dissolving') {
            const progress = Math.min(elapsed / DISSOLVE_DURATION, 1);
            const ease = progress * progress;
            p.x = p.targetX + (p.originX - p.targetX) * ease;
            p.y = p.targetY + (p.originY - p.targetY) * ease;
            p.alpha = 0.95 * (1 - progress) + 0.03;
          }

          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = 1;

        // Phase transitions
        if (phase === 'forming' && elapsed >= FORMATION_DURATION) {
          phaseRef.current = 'holding';
          phaseStartRef.current = time;
        } else if (phase === 'holding' && elapsed >= HOLD_DURATION) {
          particlesRef.current.forEach((p) => {
            p.originX = w * Math.random();
            p.originY = h * Math.random();
          });
          phaseRef.current = 'dissolving';
          phaseStartRef.current = time;
        } else if (phase === 'dissolving' && elapsed >= DISSOLVE_DURATION) {
          currentLogoRef.current =
            (currentLogoRef.current + 1) % logoPositionsRef.current.length;
          const positions = logoPositionsRef.current[currentLogoRef.current];
          particlesRef.current.forEach((p, i) => {
            p.originX = p.x;
            p.originY = p.y;
            p.targetX = positions[i].x;
            p.targetY = positions[i].y;
          });
          phaseRef.current = 'forming';
          phaseStartRef.current = time;
        }

        animRef.current = requestAnimationFrame(animate);
      };

      animRef.current = requestAnimationFrame(animate);
    };

    setup();

    const handleResize = () => {
      if (!running) return;
      cancelAnimationFrame(animRef.current);
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform before re-setup
      setup();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [initParticles, loadAllLogos]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ display: 'block' }}
    />
  );
}
