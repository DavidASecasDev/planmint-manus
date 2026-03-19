import type { FleetVehicleDamage } from '@/types/fleet';
import { FLEET_DAMAGE_STATUS_OPTIONS } from '@/types/fleet';

interface VehicleCroquisProps {
  damages: FleetVehicleDamage[];
  onDamageClick?: (damage: FleetVehicleDamage) => void;
  onZoneClick?: (x: number, y: number, zona: string) => void;
  interactive?: boolean;
}

// Zone hitboxes for top-down car view (x, y, width, height in % coordinates)
const ZONES = [
  { key: 'frontal', label: 'Frontal', x: 35, y: 0, w: 30, h: 18 },
  { key: 'trasera', label: 'Trasera', x: 35, y: 82, w: 30, h: 18 },
  { key: 'lateral_izq', label: 'Lat. Izq.', x: 0, y: 18, w: 35, h: 64 },
  { key: 'lateral_der', label: 'Lat. Der.', x: 65, y: 18, w: 35, h: 64 },
  { key: 'techo', label: 'Techo', x: 35, y: 30, w: 30, h: 40 },
  { key: 'ruedas', label: 'Ruedas', x: 10, y: 15, w: 10, h: 10 },
  { key: 'interior', label: 'Interior', x: 38, y: 35, w: 24, h: 30 },
];

function getSeverityColor(severidad: string) {
  switch (severidad) {
    case 'grave': return 'hsl(0, 84%, 60%)';
    case 'moderado': return 'hsl(25, 95%, 53%)';
    default: return 'hsl(48, 96%, 53%)';
  }
}

function getStatusColor(status: string) {
  return FLEET_DAMAGE_STATUS_OPTIONS.find(o => o.value === status)?.color || 'hsl(0, 84%, 60%)';
}

export function VehicleCroquis({ damages, onDamageClick, onZoneClick, interactive = false }: VehicleCroquisProps) {
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive || !onZoneClick) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Determine zone
    const zone = ZONES.find(z =>
      x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h
    );
    onZoneClick(x, y, zone?.key || 'general');
  };

  return (
    <div className="relative w-full max-w-[280px] mx-auto">
      <svg
        viewBox="0 0 100 100"
        className={`w-full ${interactive ? 'cursor-crosshair' : ''}`}
        onClick={handleSvgClick}
      >
        {/* Car body - top-down silhouette */}
        <path
          d="M 35 5 Q 35 2 40 2 L 60 2 Q 65 2 65 5 L 67 15 Q 68 18 68 22 L 70 25 L 70 75 L 68 78 Q 68 82 67 85 L 65 95 Q 65 98 60 98 L 40 98 Q 35 98 35 95 L 33 85 Q 32 82 32 78 L 30 75 L 30 25 L 32 22 Q 32 18 33 15 Z"
          fill="hsl(var(--muted))"
          stroke="hsl(var(--border))"
          strokeWidth="0.8"
        />
        {/* Windshield */}
        <path
          d="M 38 15 L 62 15 Q 63 18 63 22 L 37 22 Q 37 18 38 15 Z"
          fill="hsl(var(--primary) / 0.1)"
          stroke="hsl(var(--border))"
          strokeWidth="0.4"
        />
        {/* Rear window */}
        <path
          d="M 38 85 L 62 85 Q 63 82 63 78 L 37 78 Q 37 82 38 85 Z"
          fill="hsl(var(--primary) / 0.1)"
          stroke="hsl(var(--border))"
          strokeWidth="0.4"
        />
        {/* Side windows */}
        <rect x="31" y="28" width="3" height="20" rx="1" fill="hsl(var(--primary) / 0.1)" stroke="hsl(var(--border))" strokeWidth="0.3" />
        <rect x="66" y="28" width="3" height="20" rx="1" fill="hsl(var(--primary) / 0.1)" stroke="hsl(var(--border))" strokeWidth="0.3" />
        {/* Wheels */}
        <rect x="25" y="18" width="7" height="12" rx="2" fill="hsl(var(--foreground) / 0.3)" stroke="hsl(var(--border))" strokeWidth="0.5" />
        <rect x="68" y="18" width="7" height="12" rx="2" fill="hsl(var(--foreground) / 0.3)" stroke="hsl(var(--border))" strokeWidth="0.5" />
        <rect x="25" y="70" width="7" height="12" rx="2" fill="hsl(var(--foreground) / 0.3)" stroke="hsl(var(--border))" strokeWidth="0.5" />
        <rect x="68" y="70" width="7" height="12" rx="2" fill="hsl(var(--foreground) / 0.3)" stroke="hsl(var(--border))" strokeWidth="0.5" />
        {/* Headlights */}
        <rect x="38" y="3" width="8" height="3" rx="1" fill="hsl(48, 96%, 53% / 0.4)" />
        <rect x="54" y="3" width="8" height="3" rx="1" fill="hsl(48, 96%, 53% / 0.4)" />
        {/* Taillights */}
        <rect x="38" y="94" width="8" height="3" rx="1" fill="hsl(0, 84%, 60% / 0.4)" />
        <rect x="54" y="94" width="8" height="3" rx="1" fill="hsl(0, 84%, 60% / 0.4)" />

        {/* Damage dots */}
        {damages.map(d => d.croquis_x != null && d.croquis_y != null && (
          <g key={d.id}>
            <circle
              cx={d.croquis_x}
              cy={d.croquis_y}
              r="3"
              fill={d.status === 'reparado' ? getStatusColor('reparado') : getSeverityColor(d.severidad)}
              stroke="hsl(var(--background))"
              strokeWidth="0.8"
              className={`${onDamageClick ? 'cursor-pointer' : ''} transition-all`}
              onClick={(e) => {
                e.stopPropagation();
                onDamageClick?.(d);
              }}
            />
            {d.status === 'reparado' && (
              <text x={d.croquis_x} y={d.croquis_y + 1.2} textAnchor="middle" fontSize="3" fill="white">✓</text>
            )}
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: 'hsl(48, 96%, 53%)' }} />
          Leve
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: 'hsl(25, 95%, 53%)' }} />
          Moderado
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: 'hsl(0, 84%, 60%)' }} />
          Grave
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: 'hsl(142, 76%, 36%)' }} />
          Reparado
        </span>
      </div>
    </div>
  );
}
