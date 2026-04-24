/**
 * PhotoAnnotator — Canvas-based photo annotation tool for fleet inspections.
 *
 * Tools:
 * - Freehand: Draw freely on the photo
 * - Arrow: Draw arrows to point at damage
 * - Circle: Draw circles to highlight areas
 * - Undo: Remove last annotation
 *
 * The component renders the photo on a canvas and overlays drawing tools.
 * On confirm, it exports the annotated image as a File.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  Pencil,
  Circle,
  MoveUpRight,
  Undo2,
  Check,
  X,
  Eraser,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Tool = 'freehand' | 'arrow' | 'circle';

interface Stroke {
  tool: Tool;
  color: string;
  lineWidth: number;
  points: Array<{ x: number; y: number }>;
}

interface PhotoAnnotatorProps {
  /** The image source URL (blob: or data: or https:) */
  imageSrc: string;
  /** Called with the annotated image file and preview URL */
  onConfirm: (file: File, preview: string) => void;
  /** Called when user cancels annotation */
  onCancel: () => void;
}

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#ffffff'];
const LINE_WIDTHS = [3, 5, 8];

export function PhotoAnnotator({ imageSrc, onConfirm, onCancel }: PhotoAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [tool, setTool] = useState<Tool>('freehand');
  const [color, setColor] = useState('#ef4444');
  const [lineWidth, setLineWidth] = useState(5);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Load image and set up canvas
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Resize canvas to fit container while maintaining aspect ratio
  useEffect(() => {
    if (!imageLoaded || !imageRef.current || !containerRef.current) return;

    const updateSize = () => {
      const container = containerRef.current;
      if (!container || !imageRef.current) return;

      const containerWidth = container.clientWidth;
      const imgAspect = imageRef.current.naturalWidth / imageRef.current.naturalHeight;
      const maxHeight = window.innerHeight * 0.5;

      let w = containerWidth;
      let h = containerWidth / imgAspect;

      if (h > maxHeight) {
        h = maxHeight;
        w = h * imgAspect;
      }

      setCanvasSize({ width: Math.floor(w), height: Math.floor(h) });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [imageLoaded]);

  // Redraw canvas whenever strokes change
  useEffect(() => {
    if (!canvasRef.current || !imageRef.current || canvasSize.width === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const img = imageRef.current;

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw all completed strokes
    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;
    for (const stroke of allStrokes) {
      drawStroke(ctx, stroke);
    }
  }, [strokes, currentStroke, canvasSize, imageLoaded]);

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length < 1) return;

    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = stroke.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (stroke.tool) {
      case 'freehand': {
        if (stroke.points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
        break;
      }
      case 'arrow': {
        if (stroke.points.length < 2) return;
        const start = stroke.points[0];
        const end = stroke.points[stroke.points.length - 1];

        // Draw line
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLen = stroke.lineWidth * 4;
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
          end.x - headLen * Math.cos(angle - Math.PI / 6),
          end.y - headLen * Math.sin(angle - Math.PI / 6),
        );
        ctx.lineTo(
          end.x - headLen * Math.cos(angle + Math.PI / 6),
          end.y - headLen * Math.sin(angle + Math.PI / 6),
        );
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'circle': {
        if (stroke.points.length < 2) return;
        const center = stroke.points[0];
        const edge = stroke.points[stroke.points.length - 1];
        const radius = Math.sqrt(
          Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2),
        );
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
    }
  };

  const getCanvasPoint = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      let clientX: number, clientY: number;
      if ('touches' in e) {
        if (e.touches.length === 0) return null;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      const point = getCanvasPoint(e);
      if (!point) return;

      setIsDrawing(true);
      setCurrentStroke({
        tool,
        color,
        lineWidth,
        points: [point],
      });
    },
    [tool, color, lineWidth, getCanvasPoint],
  );

  const handlePointerMove = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!isDrawing || !currentStroke) return;
      e.preventDefault();
      const point = getCanvasPoint(e);
      if (!point) return;

      setCurrentStroke((prev) => {
        if (!prev) return prev;
        if (prev.tool === 'freehand') {
          return { ...prev, points: [...prev.points, point] };
        } else {
          // For arrow and circle, only keep start and current end
          return { ...prev, points: [prev.points[0], point] };
        }
      });
    },
    [isDrawing, currentStroke, getCanvasPoint],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawing || !currentStroke) return;
    setIsDrawing(false);

    // Only add stroke if it has meaningful content
    if (currentStroke.points.length >= 2) {
      setStrokes((prev) => [...prev, currentStroke]);
    }
    setCurrentStroke(null);
  }, [isDrawing, currentStroke]);

  const handleUndo = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1));
  }, []);

  const handleClearAll = useCallback(() => {
    setStrokes([]);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!canvasRef.current || !imageRef.current) return;

    // Create a full-resolution canvas for export
    const img = imageRef.current;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = img.naturalWidth;
    exportCanvas.height = img.naturalHeight;
    const ctx = exportCanvas.getContext('2d')!;

    // Draw image at full resolution
    ctx.drawImage(img, 0, 0, exportCanvas.width, exportCanvas.height);

    // Scale strokes to full resolution
    const scaleX = exportCanvas.width / canvasSize.width;
    const scaleY = exportCanvas.height / canvasSize.height;

    for (const stroke of strokes) {
      const scaledStroke: Stroke = {
        ...stroke,
        lineWidth: stroke.lineWidth * Math.max(scaleX, scaleY),
        points: stroke.points.map((p) => ({
          x: p.x * scaleX,
          y: p.y * scaleY,
        })),
      };
      drawStroke(ctx, scaledStroke);
    }

    // Export as JPEG
    exportCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `annotated_${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        const preview = exportCanvas.toDataURL('image/jpeg', 0.85);
        onConfirm(file, preview);
      },
      'image/jpeg',
      0.85,
    );
  }, [strokes, canvasSize, onConfirm]);

  const hasAnnotations = strokes.length > 0;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Tool selection */}
        <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setTool('freehand')}
            className={`p-2 rounded-md transition-colors ${
              tool === 'freehand'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title="Dibujo libre"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setTool('arrow')}
            className={`p-2 rounded-md transition-colors ${
              tool === 'arrow'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title="Flecha"
          >
            <MoveUpRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setTool('circle')}
            className={`p-2 rounded-md transition-colors ${
              tool === 'circle'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title="Círculo"
          >
            <Circle className="h-4 w-4" />
          </button>
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-border mx-0.5" />

        {/* Color selection */}
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                color === c ? 'border-foreground scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-border mx-0.5" />

        {/* Line width */}
        <div className="flex gap-1 items-center">
          {LINE_WIDTHS.map((lw) => (
            <button
              key={lw}
              type="button"
              onClick={() => setLineWidth(lw)}
              className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                lineWidth === lw
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50'
              }`}
              title={`Grosor ${lw}`}
            >
              <div
                className="rounded-full bg-current"
                style={{ width: lw + 2, height: lw + 2 }}
              />
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Undo / Clear */}
        <button
          type="button"
          onClick={handleUndo}
          disabled={strokes.length === 0}
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Deshacer"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleClearAll}
          disabled={strokes.length === 0}
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Borrar todo"
        >
          <Eraser className="h-4 w-4" />
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden border border-border bg-muted/20"
      >
        {!imageLoaded && (
          <div className="w-full aspect-[4/3] flex items-center justify-center">
            <div className="h-6 w-6 animate-spin border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
        {imageLoaded && canvasSize.width > 0 && (
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            style={{
              width: canvasSize.width,
              height: canvasSize.height,
              touchAction: 'none',
              cursor: tool === 'freehand' ? 'crosshair' : 'crosshair',
            }}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1 h-11 rounded-xl"
        >
          <X className="h-4 w-4 mr-1.5" />
          {hasAnnotations ? 'Sin anotar' : 'Cancelar'}
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          className="flex-1 h-11 rounded-xl"
          disabled={!hasAnnotations}
        >
          <Check className="h-4 w-4 mr-1.5" />
          Guardar anotación
        </Button>
      </div>
    </div>
  );
}
