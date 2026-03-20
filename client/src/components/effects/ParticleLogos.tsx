/*
 * ParticleLogos — Canvas-based particle effect
 * Particles form each company logo, then dissolve and reform into the next one.
 * Uses the gold/warm palette from Azul Cars brand on navy background.
 *
 * How it works:
 * 1. Load each logo image onto an off-screen canvas
 * 2. Sample non-transparent pixel positions from the logo
 * 3. Assign each particle a target position from the sampled points
 * 4. Animate particles from random/scattered positions → target positions (formation)
 * 5. After a hold period, scatter particles and transition to the next logo
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
  '#C9A96E', // gold
  '#D4B87A', // light gold
  '#B8956A', // amber
  '#E0C88C', // pale gold
  '#A68B5B', // dark gold
  '#CCAA70', // warm tan
  '#D9BC82', // wheat
  '#BFA068', // bronze
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
  speed: number;
  wobbleAngle: number;
  wobbleSpeed: number;
  wobbleRadius: number;
}

// ── Configuration ──
const PARTICLE_COUNT = 3000;
const FORMATION_DURATION = 2500; // ms to form logo
const HOLD_DURATION = 3000; // ms to hold formed logo
const DISSOLVE_DURATION = 1500; // ms to dissolve
const SAMPLE_RESOLUTION = 3; // pixel sampling step

function sampleLogoPositions(
  img: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
  count: number,
): { x: number; y: number }[] {
  // Guard against zero dimensions
  if (canvasWidth <= 0 || canvasHeight <= 0 || img.width <= 0 || img.height <= 0) {
    return Array.from({ length: count }, () => ({
      x: (canvasWidth || 400) / 2 + (Math.random() - 0.5) * 200,
      y: (canvasHeight || 400) / 2 + (Math.random() - 0.5) * 100,
    }));
  }

  const offscreen = document.createElement('canvas');
  // Scale image to fit within the canvas area with padding
  const padding = 60;
  const availW = canvasWidth - padding * 2;
  const availH = canvasHeight - padding * 2;
  const scale = Math.min(availW / img.width, availH / img.height);
  const drawW = Math.max(1, img.width * scale);
  const drawH = Math.max(1, img.height * scale);
  const offsetX = (canvasWidth - drawW) / 2;
  const offsetY = (canvasHeight - drawH) / 2;

  offscreen.width = Math.max(1, Math.round(canvasWidth));
  offscreen.height = Math.max(1, Math.round(canvasHeight));
  const ctx = offscreen.getContext('2d')!;
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

  const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
  const pixels = imageData.data;
  const positions: { x: number; y: number }[] = [];

  for (let y = 0; y < canvasHeight; y += SAMPLE_RESOLUTION) {
    for (let x = 0; x < canvasWidth; x += SAMPLE_RESOLUTION) {
      const i = (y * canvasWidth + x) * 4;
      const alpha = pixels[i + 3];
      if (alpha > 30) {
        positions.push({ x, y });
      }
    }
  }

  // If we have more positions than needed, randomly sample
  if (positions.length > count) {
    const shuffled = positions.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  // If we have fewer, duplicate some
  while (positions.length < count) {
    const src = positions[Math.floor(Math.random() * positions.length)];
    positions.push({
      x: src.x + (Math.random() - 0.5) * 4,
      y: src.y + (Math.random() - 0.5) * 4,
    });
  }

  return positions;
}

export function ParticleLogos() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const phaseRef = useRef<'forming' | 'holding' | 'dissolving'>('forming');
  const phaseStartRef = useRef(0);
  const currentLogoRef = useRef(0);
  const logoPositionsRef = useRef<{ x: number; y: number }[][]>([]);
  const imagesLoadedRef = useRef(false);

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
        size: Math.random() * 2.5 + 1,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        alpha: Math.random() * 0.3 + 0.1,
        speed: Math.random() * 0.02 + 0.01,
        wobbleAngle: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.02 + 0.005,
        wobbleRadius: Math.random() * 2 + 0.5,
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
        const positions = sampleLogoPositions(img, width, height, PARTICLE_COUNT);
        allPositions.push(positions);
      } catch (err) {
        console.warn(`Failed to load logo: ${logo.name}`, err);
        // Fallback: random center cluster
        const fallback = Array.from({ length: PARTICLE_COUNT }, () => ({
          x: width / 2 + (Math.random() - 0.5) * 200,
          y: height / 2 + (Math.random() - 0.5) * 100,
        }));
        allPositions.push(fallback);
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
      // Wait for the canvas to have non-zero dimensions (layout may not be ready yet)
      let rect = canvas.getBoundingClientRect();
      let retries = 0;
      while ((rect.width === 0 || rect.height === 0) && retries < 20) {
        await new Promise(r => setTimeout(r, 100));
        rect = canvas.getBoundingClientRect();
        retries++;
      }
      if (rect.width === 0 || rect.height === 0) return; // still no size, bail

      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;

      // Initialize particles in random positions
      particlesRef.current = initParticles(w, h);

      // Load all logo positions
      logoPositionsRef.current = await loadAllLogos(w, h);
      imagesLoadedRef.current = true;

      // Set first logo targets
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

        particlesRef.current.forEach((p) => {
          p.wobbleAngle += p.wobbleSpeed;

          if (phase === 'forming') {
            const progress = Math.min(elapsed / FORMATION_DURATION, 1);
            // Ease-out cubic
            const ease = 1 - Math.pow(1 - progress, 3);
            p.x = p.originX + (p.targetX - p.originX) * ease;
            p.y = p.originY + (p.targetY - p.originY) * ease;
            p.alpha = 0.15 + progress * 0.75;
          } else if (phase === 'holding') {
            // Gentle wobble around target
            p.x = p.targetX + Math.sin(p.wobbleAngle) * p.wobbleRadius;
            p.y = p.targetY + Math.cos(p.wobbleAngle * 0.7) * p.wobbleRadius;
            p.alpha = 0.85 + Math.sin(p.wobbleAngle * 2) * 0.1;
          } else if (phase === 'dissolving') {
            const progress = Math.min(elapsed / DISSOLVE_DURATION, 1);
            const ease = progress * progress; // ease-in
            p.x = p.targetX + (p.originX - p.targetX) * ease;
            p.y = p.targetY + (p.originY - p.targetY) * ease;
            p.alpha = 0.9 * (1 - progress) + 0.05;
          }

          // Draw particle
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.fill();
        });

        ctx.globalAlpha = 1;

        // Phase transitions
        if (phase === 'forming' && elapsed >= FORMATION_DURATION) {
          phaseRef.current = 'holding';
          phaseStartRef.current = time;
        } else if (phase === 'holding' && elapsed >= HOLD_DURATION) {
          // Prepare dissolve: set new random origins for next formation
          const nextIdx = (currentLogoRef.current + 1) % logoPositionsRef.current.length;
          particlesRef.current.forEach((p) => {
            p.originX = w * Math.random();
            p.originY = h * Math.random();
          });
          phaseRef.current = 'dissolving';
          phaseStartRef.current = time;
        } else if (phase === 'dissolving' && elapsed >= DISSOLVE_DURATION) {
          // Move to next logo
          currentLogoRef.current = (currentLogoRef.current + 1) % logoPositionsRef.current.length;
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

    // Handle resize
    const handleResize = () => {
      if (!running) return;
      cancelAnimationFrame(animRef.current);
      imagesLoadedRef.current = false;
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
