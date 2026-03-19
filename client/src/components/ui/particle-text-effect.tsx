import { useEffect, useRef, useCallback, useState } from "react";
import { cn } from "@/lib/utils";

interface Vector2D {
  x: number;
  y: number;
}

class Particle {
  pos: Vector2D = { x: 0, y: 0 };
  vel: Vector2D = { x: 0, y: 0 };
  acc: Vector2D = { x: 0, y: 0 };
  target: Vector2D = { x: 0, y: 0 };

  closeEnoughTarget = 100;
  maxSpeed = 1.0;
  maxForce = 0.1;
  particleSize = 10;
  isKilled = false;

  startColor = { r: 0, g: 0, b: 0 };
  targetColor = { r: 0, g: 0, b: 0 };
  colorWeight = 0;
  colorBlendRate = 0.01;

  move() {
    let proximityMult = 1;
    const distance = Math.sqrt(
      Math.pow(this.pos.x - this.target.x, 2) +
        Math.pow(this.pos.y - this.target.y, 2)
    );

    if (distance < this.closeEnoughTarget) {
      proximityMult = distance / this.closeEnoughTarget;
    }

    const towardsTarget = {
      x: this.target.x - this.pos.x,
      y: this.target.y - this.pos.y,
    };

    const magnitude = Math.sqrt(
      towardsTarget.x * towardsTarget.x + towardsTarget.y * towardsTarget.y
    );
    if (magnitude > 0) {
      towardsTarget.x =
        (towardsTarget.x / magnitude) * this.maxSpeed * proximityMult;
      towardsTarget.y =
        (towardsTarget.y / magnitude) * this.maxSpeed * proximityMult;
    }

    const steer = {
      x: towardsTarget.x - this.vel.x,
      y: towardsTarget.y - this.vel.y,
    };

    const steerMagnitude = Math.sqrt(
      steer.x * steer.x + steer.y * steer.y
    );
    if (steerMagnitude > 0) {
      steer.x = (steer.x / steerMagnitude) * this.maxForce;
      steer.y = (steer.y / steerMagnitude) * this.maxForce;
    }

    this.acc.x += steer.x;
    this.acc.y += steer.y;

    this.vel.x += this.acc.x;
    this.vel.y += this.acc.y;
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this.acc.x = 0;
    this.acc.y = 0;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.colorWeight < 1.0) {
      this.colorWeight = Math.min(
        this.colorWeight + this.colorBlendRate,
        1.0
      );
    }

    const currentColor = {
      r: Math.round(
        this.startColor.r +
          (this.targetColor.r - this.startColor.r) * this.colorWeight
      ),
      g: Math.round(
        this.startColor.g +
          (this.targetColor.g - this.startColor.g) * this.colorWeight
      ),
      b: Math.round(
        this.startColor.b +
          (this.targetColor.b - this.startColor.b) * this.colorWeight
      ),
    };

    ctx.fillStyle = `rgba(${currentColor.r}, ${currentColor.g}, ${currentColor.b}, 0.8)`;
    ctx.fillRect(this.pos.x, this.pos.y, 2, 2);
  }

  kill(width: number, height: number) {
    if (!this.isKilled) {
      const angle = Math.random() * Math.PI * 2;
      const mag = (width + height) / 2;
      this.target.x = width / 2 + Math.cos(angle) * mag;
      this.target.y = height / 2 + Math.sin(angle) * mag;

      this.startColor = {
        r:
          this.startColor.r +
          (this.targetColor.r - this.startColor.r) * this.colorWeight,
        g:
          this.startColor.g +
          (this.targetColor.g - this.startColor.g) * this.colorWeight,
        b:
          this.startColor.b +
          (this.targetColor.b - this.startColor.b) * this.colorWeight,
      };
      this.targetColor = { r: 0, g: 0, b: 0 };
      this.colorWeight = 0;

      this.isKilled = true;
    }
  }
}

function getPrimaryColor(): { r: number; g: number; b: number } {
  if (typeof window === "undefined") return { r: 59, g: 130, b: 246 };
  const style = getComputedStyle(document.documentElement);
  const hslRaw = style.getPropertyValue("--primary").trim();
  const parts = hslRaw.split(/\s+/);
  if (parts.length >= 3) {
    const h = parseFloat(parts[0]);
    const s = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;
    return hslToRgb(h, s, l);
  }
  return { r: 59, g: 130, b: 246 };
}

function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c; g = x;
  } else if (h < 120) {
    r = x; g = c;
  } else if (h < 180) {
    g = c; b = x;
  } else if (h < 240) {
    g = x; b = c;
  } else if (h < 300) {
    r = x; b = c;
  } else {
    r = c; b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/** Measure the longest word to determine canvas width */
function measureLongestWord(words: string[], fontSize: number, fontFamily: string) {
  const offscreen = document.createElement("canvas");
  const ctx = offscreen.getContext("2d")!;
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  let maxWidth = 0;
  for (const word of words) {
    const w = ctx.measureText(word).width;
    if (w > maxWidth) maxWidth = w;
  }
  return Math.ceil(maxWidth);
}

interface ParticleTextEffectProps {
  words?: string[];
  className?: string;
  /** Inline mode: renders as an inline-block element sized to fit the words */
  inline?: boolean;
  /** Font size in px for inline mode (should match surrounding text) */
  fontSize?: number;
}

const DEFAULT_WORDS = ["PlanMint", "Tareas", "Objetivos", "Equipos", "Progreso"];
const FONT_FAMILY = "Inter, Arial, sans-serif";

export function ParticleTextEffect({
  words = DEFAULT_WORDS,
  className,
  inline = false,
  fontSize: propFontSize,
}: ParticleTextEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const frameCountRef = useRef(0);
  const wordIndexRef = useRef(0);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);

  const pixelSteps = inline ? 4 : 6;

  const nextWord = useCallback(
    (word: string, canvas: HTMLCanvasElement, fs: number) => {
      const offscreen = document.createElement("canvas");
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const offCtx = offscreen.getContext("2d")!;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const renderFontSize = inline ? fs * dpr : Math.min(canvas.width / 6, 120);

      offCtx.fillStyle = "white";
      offCtx.font = `bold ${renderFontSize}px ${FONT_FAMILY}`;
      offCtx.textAlign = inline ? "left" : "center";
      offCtx.textBaseline = inline ? "alphabetic" : "middle";

      const textX = inline ? 0 : canvas.width / 2;
      const textY = inline ? canvas.height * 0.78 : canvas.height / 2;
      offCtx.fillText(word, textX, textY);

      const imageData = offCtx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      const primaryColor = getPrimaryColor();
      const newColor = {
        r: Math.min(255, primaryColor.r + Math.floor(Math.random() * 40 - 20)),
        g: Math.min(255, primaryColor.g + Math.floor(Math.random() * 40 - 20)),
        b: Math.min(255, primaryColor.b + Math.floor(Math.random() * 40 - 20)),
      };

      const particles = particlesRef.current;
      let particleIndex = 0;

      const coordsIndexes: number[] = [];
      for (let i = 0; i < pixels.length; i += pixelSteps * 4) {
        coordsIndexes.push(i);
      }

      for (let i = coordsIndexes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [coordsIndexes[i], coordsIndexes[j]] = [coordsIndexes[j], coordsIndexes[i]];
      }

      for (const coordIndex of coordsIndexes) {
        const alpha = pixels[coordIndex + 3];
        if (alpha > 0) {
          const x = (coordIndex / 4) % canvas.width;
          const y = Math.floor(coordIndex / 4 / canvas.width);

          let particle: Particle;

          if (particleIndex < particles.length) {
            particle = particles[particleIndex];
            particle.isKilled = false;
            particleIndex++;
          } else {
            particle = new Particle();
            const angle = Math.random() * Math.PI * 2;
            const mag = (canvas.width + canvas.height) / 2;
            particle.pos.x = canvas.width / 2 + Math.cos(angle) * mag;
            particle.pos.y = canvas.height / 2 + Math.sin(angle) * mag;

            particle.maxSpeed = Math.random() * 6 + 4;
            particle.maxForce = particle.maxSpeed * 0.05;
            particle.particleSize = Math.random() * 6 + 6;
            particle.colorBlendRate = Math.random() * 0.0275 + 0.0025;

            particles.push(particle);
          }

          particle.startColor = {
            r:
              particle.startColor.r +
              (particle.targetColor.r - particle.startColor.r) *
                particle.colorWeight,
            g:
              particle.startColor.g +
              (particle.targetColor.g - particle.startColor.g) *
                particle.colorWeight,
            b:
              particle.startColor.b +
              (particle.targetColor.b - particle.startColor.b) *
                particle.colorWeight,
          };
          particle.targetColor = newColor;
          particle.colorWeight = 0;

          particle.target.x = x;
          particle.target.y = y;
        }
      }

      for (let i = particleIndex; i < particles.length; i++) {
        particles[i].kill(canvas.width, canvas.height);
      }
    },
    [pixelSteps, inline]
  );

  // Calculate canvas size for inline mode
  useEffect(() => {
    if (!inline || !propFontSize) return;
    const maxW = measureLongestWord(words, propFontSize, FONT_FAMILY);
    // Add small horizontal padding, height = fontSize * 1.3
    setCanvasSize({ w: maxW + 8, h: Math.ceil(propFontSize * 1.3) });
  }, [inline, propFontSize, words]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const fs = propFontSize || 72;

    const setupCanvas = () => {
      if (inline && canvasSize) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = canvasSize.w * dpr;
        canvas.height = canvasSize.h * dpr;
        canvas.style.width = `${canvasSize.w}px`;
        canvas.style.height = `${canvasSize.h}px`;
      } else if (!inline) {
        const rect = container.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }
      nextWord(words[wordIndexRef.current], canvas, fs);
    };

    setupCanvas();

    let observer: ResizeObserver | null = null;
    if (!inline) {
      observer = new ResizeObserver(setupCanvas);
      observer.observe(container);
    }

    const animate = () => {
      const ctx = canvas.getContext("2d")!;
      const particles = particlesRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.move();
        particle.draw(ctx);

        if (particle.isKilled) {
          if (
            particle.pos.x < -50 ||
            particle.pos.x > canvas.width + 50 ||
            particle.pos.y < -50 ||
            particle.pos.y > canvas.height + 50
          ) {
            particles.splice(i, 1);
          }
        }
      }

      frameCountRef.current++;
      if (frameCountRef.current % 240 === 0) {
        wordIndexRef.current = (wordIndexRef.current + 1) % words.length;
        nextWord(words[wordIndexRef.current], canvas, fs);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      observer?.disconnect();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [words, nextWord, inline, canvasSize, propFontSize]);

  if (inline) {
    return (
      <span
        ref={containerRef}
        className={cn("inline-block pointer-events-none", className)}
        style={canvasSize ? { width: canvasSize.w, height: canvasSize.h, verticalAlign: '-0.15em' } : undefined}
      >
        <canvas
          ref={canvasRef}
          className="block"
        />
      </span>
    );
  }

  return (
    <div ref={containerRef} className={cn("w-full h-full", className)}>
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
      />
    </div>
  );
}
