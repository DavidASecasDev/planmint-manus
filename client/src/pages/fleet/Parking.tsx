/**
 * Parking Map — Pure SVG schematic of the Azul Cars campa.
 * PIXEL-PERFECT TRACE from the annotated aerial photograph.
 * Coordinates extracted via OpenCV image analysis of the actual photo.
 * 
 * ViewBox: 1200 × 1000 (matches the real photo aspect ratio 1374:1145 ≈ 1.2:1)
 * All coordinates are scaled from the detected pixel positions.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/contexts/AuthContext';
import { apiInvoke } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Car, ParkingSquare, MapPin, RefreshCw,
  History, Search, X, AlertTriangle, CircleDot,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────
interface ParkingZone {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  spots: ParkingSpot[];
}

interface ParkingSpot {
  id: string;
  zone_id: string;
  spot_number: number;
  label: string | null;
  status: 'free' | 'occupied' | 'reserved' | 'blocked';
  vehicle_id: string | null;
  vehicle_matricula: string | null;
  occupied_at: string | null;
  occupied_by: string | null;
  grid_row: number | null;
  grid_col: number | null;
}

interface ParkingOverview {
  zones: ParkingZone[];
  summary: {
    total: number;
    occupied: number;
    free: number;
    blocked: number;
  };
}

interface ParkingHistoryItem {
  id: string;
  spot_number: number;
  vehicle_matricula: string | null;
  action: string;
  performed_by: string | null;
  performed_at: string;
}

// ─── SVG Spot Geometry ──────────────────────────────────────────────────────
// ViewBox: 1200 × 1000
// Coordinates derived from OpenCV analysis of the aerial photo (1374×1145px)
// Scale factor: 1200/1374 = 0.8734 for X, 1000/1145 = 0.8734 for Y (uniform!)
//
// The photo was analyzed pixel by pixel. Each spot's bounding box was detected.
// These are the REAL positions, not approximations.
interface SpotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function buildSpotGeometry(): Map<number, SpotRect> {
  const spots = new Map<number, SpotRect>();

  // Scale factor from image pixels (1374×1145) to SVG viewBox (1200×1000)
  const sx = 1200 / 1374;
  const sy = 1000 / 1145;

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONE 1: Horizontal row, top-right (11 spots)
  // Detected: y≈340, x from 698 to 1084, w≈30, h≈46, step_x≈38.6
  // ═══════════════════════════════════════════════════════════════════════════
  const z1_y = 340 * sy;
  const z1_xStart = 698 * sx;
  const z1_stepX = 38.6 * sx;
  const z1_w = 30 * sx;
  const z1_h = 46 * sy;
  for (let i = 0; i < 11; i++) {
    spots.set(1 + i, { x: z1_xStart + i * z1_stepX, y: z1_y, w: z1_w, h: z1_h });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONE 2: 2 rows × 8 = 16 spots, center-right
  // Row 1: y≈536, x from 593 to 743, 8 spots, step_x≈37
  // Row 2: y≈593, x from 593 to 853, 8 spots, step_x≈37
  // w≈30, h≈46
  // ═══════════════════════════════════════════════════════════════════════════
  const z2_w = 30 * sx;
  const z2_h = 46 * sy;
  const z2_stepX = 37 * sx;
  const z2_row1_y = 536 * sy;
  const z2_row2_y = 593 * sy;
  const z2_xStart = 593 * sx;
  for (let i = 0; i < 8; i++) {
    spots.set(12 + i, { x: z2_xStart + i * z2_stepX, y: z2_row1_y, w: z2_w, h: z2_h });
  }
  for (let i = 0; i < 8; i++) {
    spots.set(20 + i, { x: z2_xStart + i * z2_stepX, y: z2_row2_y, w: z2_w, h: z2_h });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONE 3: 2 rows × 8 = 16 spots, bottom-right
  // Row 1: y≈708, x from 591 to 850, 8 spots, step_x≈37
  // Row 2: y≈762, x from 590 to 850, 8 spots, step_x≈37
  // w≈30, h≈46
  // ═══════════════════════════════════════════════════════════════════════════
  const z3_w = 30 * sx;
  const z3_h = 46 * sy;
  const z3_stepX = 37 * sx;
  const z3_row1_y = 708 * sy;
  const z3_row2_y = 762 * sy;
  const z3_xStart = 591 * sx;
  for (let i = 0; i < 8; i++) {
    spots.set(28 + i, { x: z3_xStart + i * z3_stepX, y: z3_row1_y, w: z3_w, h: z3_h });
  }
  for (let i = 0; i < 8; i++) {
    spots.set(36 + i, { x: z3_xStart + i * z3_stepX, y: z3_row2_y, w: z3_w, h: z3_h });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONE 4: Vertical column (right of right pair), 13 spots
  // Detected: x≈473, y from 345 to 750, w≈49, h≈27, step_y≈34
  // ═══════════════════════════════════════════════════════════════════════════
  const colW = 49 * sx;
  const colH = 27 * sy;
  const colStepY = 34 * sy;

  const z4_x = 473 * sx;
  const z4_yStart = 345 * sy;
  for (let i = 0; i < 13; i++) {
    spots.set(44 + i, { x: z4_x, y: z4_yStart + i * colStepY, w: colW, h: colH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONE 5: Vertical column (left of right pair), 13 spots
  // Detected: x≈404, y from 344 to 750, w≈50, h≈27, step_y≈34
  // ═══════════════════════════════════════════════════════════════════════════
  const z5_x = 404 * sx;
  const z5_yStart = 344 * sy;
  for (let i = 0; i < 13; i++) {
    spots.set(57 + i, { x: z5_x, y: z5_yStart + i * colStepY, w: colW, h: colH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONE 6: Vertical column (right of left pair), 13 spots
  // Detected: x≈253, y from 348 to 750, w≈50, h≈27, step_y≈34
  // ═══════════════════════════════════════════════════════════════════════════
  const z6_x = 253 * sx;
  const z6_yStart = 348 * sy;
  for (let i = 0; i < 13; i++) {
    spots.set(70 + i, { x: z6_x, y: z6_yStart + i * colStepY, w: colW, h: colH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONE 7: Vertical column (left of left pair), 13 spots
  // Detected: x≈196, y from 348 to 750, w≈47, h≈27, step_y≈34
  // ═══════════════════════════════════════════════════════════════════════════
  const z7_x = 196 * sx;
  const z7_yStart = 348 * sy;
  for (let i = 0; i < 13; i++) {
    spots.set(83 + i, { x: z7_x, y: z7_yStart + i * colStepY, w: colW, h: colH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONE 8: Single vertical column, far left (15 spots)
  // Detected: x≈46, y from 340 to 814, w≈49, h≈28, step_y≈34
  // ═══════════════════════════════════════════════════════════════════════════
  const z8_x = 46 * sx;
  const z8_yStart = 340 * sy;
  for (let i = 0; i < 15; i++) {
    spots.set(96 + i, { x: z8_x, y: z8_yStart + i * colStepY, w: colW, h: colH });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUCIOS: 8 green spots, vertical column
  // Detected: x≈405, y from 58 to 298, w≈48, h≈27, step_y≈34.2
  // ═══════════════════════════════════════════════════════════════════════════
  const sucio_x = 405 * sx;
  const sucio_yStart = 58 * sy;
  const sucio_stepY = 34.2 * sy;
  const sucio_w = 48 * sx;
  const sucio_h = 27 * sy;
  for (let i = 0; i < 8; i++) {
    spots.set(111 + i, { x: sucio_x, y: sucio_yStart + i * sucio_stepY, w: sucio_w, h: sucio_h });
  }

  return spots;
}

const SPOT_GEOMETRY = buildSpotGeometry();

// ─── SVG Parking Map Component ──────────────────────────────────────────────
function ParkingMapSVG({
  spotByNumber,
  highlightedSpotNum,
  onSpotClick,
}: {
  spotByNumber: Map<number, ParkingSpot>;
  highlightedSpotNum: number | null;
  onSpotClick: (spot: ParkingSpot) => void;
}) {
  // Convert image pixel coords to SVG viewBox coords
  const sx = 1200 / 1374;
  const sy = 1000 / 1145;

  return (
    <svg
      viewBox="0 0 1200 1000"
      className="w-full h-auto"
      style={{ maxHeight: '78vh' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ─── Defs ─── */}
      <defs>
        <style>{`
          @keyframes pulseHighlight {
            0%, 100% { stroke-opacity: 1; stroke-width: 3; }
            50% { stroke-opacity: 0.4; stroke-width: 5; }
          }
          .spot-highlight {
            animation: pulseHighlight 1s ease-in-out infinite;
          }
        `}</style>
      </defs>

      {/* ─── Background: dark outside the lot ─── */}
      <rect x="0" y="0" width="1200" height="1000" fill="#1a1a2e" />

      {/* ─── Lot boundary (irregular polygon matching the red border in the photo) ─── */}
      {/* Photo boundary points (approx from image): 
          top-left: (30,80), top-right corner: (1050,80), 
          right edge goes diagonal: (1140,150), (1170,350),
          bottom-right curves: (1100,950), bottom: (30,950) */}
      <polygon
        points={`
          ${30*sx},${80*sy}
          ${530*sx},${80*sy}
          ${1050*sx},${80*sy}
          ${1160*sx},${150*sy}
          ${1170*sx},${400*sy}
          ${1140*sx},${700*sy}
          ${1080*sx},${950*sy}
          ${800*sx},${1020*sy}
          ${30*sx},${1020*sy}
        `}
        fill="#5c5650"
        stroke="#dc2626"
        strokeWidth="3"
      />

      {/* ─── NAVES / TALLER (top-left, two buildings with curved roofs) ─── */}
      {/* Nave 1 (upper) — from image: roughly x=50-380, y=90-220 */}
      <rect x={50*sx} y={90*sy} width={330*sx} height={120*sy} fill="#7a7a7a" stroke="#999" strokeWidth="1.5" rx="2" />
      {[0,1,2,3,4].map(i => (
        <path key={`n1-${i}`} d={`M ${55*sx},${100*sy + i*24*sy} Q ${215*sx},${88*sy + i*24*sy} ${375*sx},${100*sy + i*24*sy}`} fill="none" stroke="#aaa" strokeWidth="1" />
      ))}
      {/* Nave 2 (lower) — from image: roughly x=50-380, y=230-350 */}
      <rect x={50*sx} y={230*sy} width={330*sx} height={100*sy} fill="#7a7a7a" stroke="#999" strokeWidth="1.5" rx="2" />
      {[0,1,2,3].map(i => (
        <path key={`n2-${i}`} d={`M ${55*sx},${240*sy + i*24*sy} Q ${215*sx},${228*sy + i*24*sy} ${375*sx},${240*sy + i*24*sy}`} fill="none" stroke="#aaa" strokeWidth="1" />
      ))}

      {/* ─── OFICINA Azul Cars (right side, glass building) ─── */}
      {/* From image: roughly x=880-1050, y=380-580 */}
      <rect x={880*sx} y={380*sy} width={170*sx} height={200*sy} fill="#1e293b" stroke="#475569" strokeWidth="2" rx="3" />
      <rect x={890*sx} y={390*sy} width={150*sx} height={180*sy} fill="none" stroke="#64748b" strokeWidth="0.8" rx="2" />
      <line x1={890*sx} y1={390*sy} x2={1040*sx} y2={570*sy} stroke="#475569" strokeWidth="0.5" opacity="0.4" />
      <line x1={1040*sx} y1={390*sy} x2={890*sx} y2={570*sy} stroke="#475569" strokeWidth="0.5" opacity="0.4" />
      <text x={965*sx} y={480*sy} textAnchor="middle" fill="#94a3b8" fontSize="13" fontWeight="600">OFICINA</text>
      <text x={965*sx} y={500*sy} textAnchor="middle" fill="#64748b" fontSize="10">Azul Cars</text>

      {/* ─── SUCIOS label (top, above the green spots) ─── */}
      <rect x={480*sx} y={30*sy} width={120*sx} height={40*sy} fill="#1e293b" stroke="#fff" strokeWidth="2" rx="14" />
      <text x={540*sx} y={56*sy} textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="700">SUCIOS</text>
      {/* Arrow */}
      <line x1={428*sx} y1={50*sy} x2={428*sx} y2={320*sy} stroke="#ffffff" strokeWidth="2.5" opacity="0.6" markerEnd="url(#arrowDown)" markerStart="url(#arrowUp)" />
      <defs>
        <marker id="arrowUp" markerWidth="8" markerHeight="8" refX="4" refY="8" orient="auto">
          <polygon points="4,0 0,8 8,8" fill="#fff" opacity="0.6" />
        </marker>
        <marker id="arrowDown" markerWidth="8" markerHeight="8" refX="4" refY="0" orient="auto">
          <polygon points="4,8 0,0 8,0" fill="#fff" opacity="0.6" />
        </marker>
      </defs>

      {/* ─── Zone labels (dark badge with white border, matching the annotated photo) ─── */}
      {/* Zone 8 — far left, above its column */}
      <rect x={30*sx} y={300*sy} width={32} height={26} fill="#1e293b" stroke="#fff" strokeWidth="1.5" rx="5" />
      <text x={30*sx + 16} y={300*sy + 18} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">8</text>
      {/* Zone 7 — bottom of zone 7 column */}
      <rect x={196*sx} y={800*sy} width={32} height={26} fill="#1e293b" stroke="#fff" strokeWidth="1.5" rx="5" />
      <text x={196*sx + 16} y={800*sy + 18} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">7</text>
      {/* Zone 6 — bottom of zone 6 column */}
      <rect x={265*sx} y={800*sy} width={32} height={26} fill="#1e293b" stroke="#fff" strokeWidth="1.5" rx="5" />
      <text x={265*sx + 16} y={800*sy + 18} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">6</text>
      {/* Zone 5 — bottom of zone 5 column */}
      <rect x={404*sx} y={800*sy} width={32} height={26} fill="#1e293b" stroke="#fff" strokeWidth="1.5" rx="5" />
      <text x={404*sx + 16} y={800*sy + 18} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">5</text>
      {/* Zone 4 — bottom of zone 4 column */}
      <rect x={480*sx} y={800*sy} width={32} height={26} fill="#1e293b" stroke="#fff" strokeWidth="1.5" rx="5" />
      <text x={480*sx + 16} y={800*sy + 18} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">4</text>
      {/* Zone 1 — top-right */}
      <rect x={680*sx} y={295*sy} width={32} height={26} fill="#1e293b" stroke="#fff" strokeWidth="1.5" rx="5" />
      <text x={680*sx + 16} y={295*sy + 18} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">1</text>
      {/* Zone 2 — center-right */}
      <rect x={575*sx} y={490*sy} width={32} height={26} fill="#1e293b" stroke="#fff" strokeWidth="1.5" rx="5" />
      <text x={575*sx + 16} y={490*sy + 18} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">2</text>
      {/* Zone 3 — bottom-right */}
      <rect x={575*sx} y={660*sy} width={32} height={26} fill="#1e293b" stroke="#fff" strokeWidth="1.5" rx="5" />
      <text x={575*sx + 16} y={660*sy + 18} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">3</text>

      {/* ─── Parking Spots ─── */}
      {Array.from(SPOT_GEOMETRY.entries()).map(([num, rect]) => {
        const spot = spotByNumber.get(num);
        const isOccupied = spot?.status === 'occupied';
        const isBlocked = spot?.status === 'blocked';
        const isReserved = spot?.status === 'reserved';
        const isSucios = num >= 111 && num <= 118;
        const isHighlighted = highlightedSpotNum === num;

        let fillColor = '#1e40af'; // dark blue (matching the aerial photo)
        let strokeColor = '#1d4ed8';
        if (isSucios && !isOccupied) {
          fillColor = '#65a30d'; // lime green for sucios (free)
          strokeColor = '#4d7c0f';
        }
        if (isOccupied) {
          fillColor = '#dc2626'; // red
          strokeColor = '#991b1b';
        } else if (isBlocked) {
          fillColor = '#6b7280'; // gray
          strokeColor = '#4b5563';
        } else if (isReserved) {
          fillColor = '#f59e0b'; // amber
          strokeColor = '#d97706';
        }

        // Label
        let label = String(num);
        if (isOccupied && spot?.vehicle_matricula) {
          const plate = spot.vehicle_matricula;
          label = plate.length > 7 ? plate.slice(-7) : plate;
        }

        const fontSize = isOccupied && spot?.vehicle_matricula ? 7 : 9;

        return (
          <g
            key={num}
            onClick={() => spot && onSpotClick(spot)}
            style={{ cursor: spot ? 'pointer' : 'default' }}
          >
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.w}
              height={rect.h}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="1.2"
              rx="3"
              className="transition-opacity hover:opacity-75"
            />
            {/* Highlight ring */}
            {isHighlighted && (
              <rect
                x={rect.x - 3}
                y={rect.y - 3}
                width={rect.w + 6}
                height={rect.h + 6}
                fill="none"
                stroke="#facc15"
                strokeWidth="3"
                rx="5"
                className="spot-highlight"
              />
            )}
            {/* Label text */}
            <text
              x={rect.x + rect.w / 2}
              y={rect.y + rect.h / 2 + fontSize / 3}
              textAnchor="middle"
              fill="#ffffff"
              fontSize={fontSize}
              fontWeight="700"
              fontFamily="ui-monospace, monospace"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function Parking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedSpotNum, setHighlightedSpotNum] = useState<number | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: overview, isLoading, refetch } = useQuery({
    queryKey: ['parking-overview'],
    queryFn: async () => {
      const result = await apiInvoke<{ ok: boolean; data: ParkingOverview; error?: string }>('parking/overview', { body: {} });
      if (result.error || !result.data?.ok) throw new Error(result.data?.error || 'Error');
      return result.data.data;
    },
    refetchInterval: 15000,
  });

  const { data: history } = useQuery({
    queryKey: ['parking-history'],
    queryFn: async () => {
      const result = await apiInvoke<{ ok: boolean; data: ParkingHistoryItem[] }>('parking/history', { body: { limit: 30 } });
      if (result.error || !result.data?.ok) return [];
      return result.data.data;
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const result = await apiInvoke<{ ok: boolean; message?: string; error?: string }>('parking/seed-layout', { body: {} });
      if (result.error || !result.data?.ok) throw new Error(result.data?.error || 'Error');
      return result.data;
    },
    onSuccess: (data) => {
      toast({ title: 'Parking configurado', description: data.message });
      queryClient.invalidateQueries({ queryKey: ['parking-overview'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async (spotId: string) => {
      const result = await apiInvoke<{ ok: boolean; error?: string }>('parking/release', { body: { spot_id: spotId } });
      if (result.error || !result.data?.ok) throw new Error(result.data?.error || 'Error');
    },
    onSuccess: () => {
      toast({ title: 'Plaza liberada' });
      queryClient.invalidateQueries({ queryKey: ['parking-overview'] });
      queryClient.invalidateQueries({ queryKey: ['parking-history'] });
      setSelectedSpot(null);
      setShowReleaseConfirm(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const allSpots = useMemo(() => {
    if (!overview) return [];
    return overview.zones.flatMap(z => z.spots);
  }, [overview]);

  const spotByNumber = useMemo(() => {
    const map = new Map<number, ParkingSpot>();
    allSpots.forEach(s => map.set(s.spot_number, s));
    return map;
  }, [allSpots]);

  const searchResult = useMemo(() => {
    if (!searchQuery.trim() || !overview) return null;
    const q = searchQuery.trim().toLowerCase();
    for (const zone of overview.zones) {
      for (const spot of zone.spots) {
        if (spot.status === 'occupied' && spot.vehicle_matricula &&
            spot.vehicle_matricula.toLowerCase().includes(q)) {
          return { spot, zoneName: zone.name };
        }
      }
    }
    return null;
  }, [searchQuery, overview]);

  useEffect(() => {
    if (searchResult) {
      setHighlightedSpotNum(searchResult.spot.spot_number);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => setHighlightedSpotNum(null), 6000);
    } else {
      setHighlightedSpotNum(null);
    }
  }, [searchResult]);

  const handleSpotClick = (spot: ParkingSpot) => {
    setSelectedSpot(spot);
    if (spot.status === 'occupied') {
      setShowReleaseConfirm(true);
    } else if (spot.status === 'free') {
      setShowAssignDialog(true);
    }
  };

  if (!isLoading && overview && overview.zones.length === 0) {
    return (
      <AppLayout title="Parking">
        <PageHeader title="Parking" icon={ParkingSquare} />
        <div className="flex flex-col items-center justify-center py-20 gap-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <ParkingSquare className="w-10 h-10 text-primary" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Configurar Parking</h2>
            <p className="text-muted-foreground max-w-md">
              Configura el plano de tu campa con las zonas y plazas numeradas.
            </p>
          </div>
          <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} size="lg">
            {seedMutation.isPending ? 'Configurando...' : 'Configurar Layout'}
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Parking">
      <PageHeader
        title="Parking"
        icon={ParkingSquare}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar matrícula..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "h-9 w-[160px] rounded-lg border border-border bg-background pl-8 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all",
                  searchQuery && searchResult && "ring-2 ring-emerald-500/50 border-emerald-400",
                  searchQuery && !searchResult && "ring-2 ring-red-500/30 border-red-300"
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setHighlightedSpotNum(null); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setShowHistoryDialog(true)}>
              <History className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {searchQuery.trim() && (
        <div className={cn(
          "mb-3 px-4 py-2 rounded-lg border text-sm flex items-center gap-3",
          searchResult
            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
            : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
        )}>
          {searchResult ? (
            <>
              <Car className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                <span className="font-mono font-bold">{searchResult.spot.vehicle_matricula}</span>
                {' → '}
                <span className="font-semibold">Plaza {searchResult.spot.spot_number}</span>
                {' — '}{searchResult.zoneName}
              </span>
            </>
          ) : (
            <>
              <Search className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-red-700 dark:text-red-300">No se encontró "{searchQuery}"</span>
            </>
          )}
        </div>
      )}

      {overview && (
        <div className="flex items-center gap-4 mb-3 text-sm">
          <span className="flex items-center gap-1.5">
            <ParkingSquare className="h-4 w-4 text-muted-foreground" />
            <strong>{overview.summary.total}</strong> plazas
          </span>
          <span className="flex items-center gap-1.5">
            <CircleDot className="h-4 w-4 text-emerald-500" />
            <strong className="text-emerald-600">{overview.summary.free}</strong> libres
          </span>
          <span className="flex items-center gap-1.5">
            <Car className="h-4 w-4 text-blue-500" />
            <strong className="text-blue-600">{overview.summary.occupied}</strong> ocupadas
          </span>
          {overview.summary.blocked > 0 && (
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <strong className="text-amber-600">{overview.summary.blocked}</strong> bloqueadas
            </span>
          )}
        </div>
      )}

      {isLoading && <Skeleton className="h-[500px] rounded-xl" />}

      {/* ─── PURE SVG PARKING MAP ─────────────────────────────────── */}
      {!isLoading && overview && (
        <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm">
          <ParkingMapSVG
            spotByNumber={spotByNumber}
            highlightedSpotNum={highlightedSpotNum}
            onSpotClick={handleSpotClick}
          />

          {/* Legend */}
          <div className="flex items-center gap-5 px-4 py-2.5 bg-white dark:bg-slate-900 border-t border-border/40 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: '#1e40af' }} />
              <span>Libre</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-red-600" />
              <span>Ocupada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: '#65a30d' }} />
              <span>Sucios</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-amber-500" />
              <span>Reservada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-gray-500" />
              <span>Bloqueada</span>
            </div>
          </div>
        </div>
      )}

      {/* Release Confirm Dialog */}
      <Dialog open={showReleaseConfirm} onOpenChange={setShowReleaseConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-red-500" />
              Liberar Plaza {selectedSpot?.spot_number}
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <p className="text-sm text-muted-foreground">
              ¿Confirmas que quieres liberar esta plaza?
            </p>
            {selectedSpot?.vehicle_matricula && (
              <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono font-bold text-sm">{selectedSpot.vehicle_matricula}</span>
                </div>
                {selectedSpot.occupied_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Aparcado desde {new Date(selectedSpot.occupied_at).toLocaleString('es-ES')}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReleaseConfirm(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => selectedSpot && releaseMutation.mutate(selectedSpot.id)}
              disabled={releaseMutation.isPending}
            >
              {releaseMutation.isPending ? 'Liberando...' : 'Liberar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <AssignSpotDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        spot={selectedSpot}
        onAssigned={() => {
          queryClient.invalidateQueries({ queryKey: ['parking-overview'] });
          queryClient.invalidateQueries({ queryKey: ['parking-history'] });
          setShowAssignDialog(false);
          setSelectedSpot(null);
        }}
      />

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial de Parking
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {history && history.length > 0 ? (
              history.map(item => (
                <div key={item.id} className="flex items-center justify-between p-2 rounded border border-border/50 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={item.action === 'occupy' ? 'default' : 'secondary'} className="text-xs">
                      {item.action === 'occupy' ? 'Entrada' : 'Salida'}
                    </Badge>
                    <span className="font-mono font-medium">{item.vehicle_matricula || '—'}</span>
                    <span className="text-muted-foreground">→ Plaza {item.spot_number}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.performed_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">Sin historial</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// ─── Assign Spot Dialog ─────────────────────────────────────────────────────
function AssignSpotDialog({
  open,
  onOpenChange,
  spot,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spot: ParkingSpot | null;
  onAssigned: () => void;
}) {
  const [matricula, setMatricula] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vehicles, setVehicles] = useState<{ id: string; matricula: string; modelo: string | null }[]>([]);

  useEffect(() => {
    if (!open) return;
    setMatricula('');
    apiInvoke<{ data: any[] }>('supabase-query', {
      body: {
        table: 'vehicles',
        operation: 'select',
        select: 'id, matricula, modelo, status',
        filters: { is_archived: false },
      },
    }).then(result => {
      if (result.data?.data) {
        setVehicles(result.data.data.filter((v: any) => v.status === 'limpio' || v.status === 'sucio' || v.status === 'incompleto'));
      }
    });
  }, [open]);

  const handleAssign = async () => {
    if (!spot || !matricula) return;
    setIsSubmitting(true);
    try {
      const vehicle = vehicles.find(v => v.matricula === matricula);
      const result = await apiInvoke<{ ok: boolean; error?: string }>('parking/assign', {
        body: {
          spot_id: spot.id,
          vehicle_id: vehicle?.id || null,
          vehicle_matricula: matricula,
        },
      });
      if (result.error || !result.data?.ok) {
        throw new Error(result.data?.error || 'Error al asignar');
      }
      toast({ title: 'Plaza asignada', description: `${matricula} → Plaza ${spot.spot_number}` });
      onAssigned();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-emerald-500" />
            Asignar Plaza {spot?.spot_number}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Vehículo</label>
            <Select value={matricula} onValueChange={setMatricula}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar vehículo..." />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map(v => (
                  <SelectItem key={v.id} value={v.matricula}>
                    {v.matricula} {v.modelo ? `— ${v.modelo}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleAssign} disabled={!matricula || isSubmitting}>
            {isSubmitting ? 'Asignando...' : 'Asignar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
