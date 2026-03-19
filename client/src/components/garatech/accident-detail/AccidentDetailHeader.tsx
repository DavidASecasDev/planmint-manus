import { Badge } from '@/components/ui/badge';
import {
  ACCIDENT_SEVERITY_LABELS,
  ACCIDENT_SEVERITY_COLORS,
  ACCIDENT_STATUS_LABELS,
  ACCIDENT_STATUS_COLORS,
  type Accident,
  type AccidentSeverity,
  type AccidentStatus,
} from '@/types/garatech';

interface Props {
  accident: Accident;
}

export function AccidentDetailHeader({ accident }: Props) {
  const severityColors = ACCIDENT_SEVERITY_COLORS[accident.severity as AccidentSeverity] || ACCIDENT_SEVERITY_COLORS.leve;
  const statusColors = ACCIDENT_STATUS_COLORS[accident.status as AccidentStatus] || ACCIDENT_STATUS_COLORS.reportado;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <h1 className="text-xl font-bold">{accident.accident_number || 'Accidente'}</h1>
      <Badge style={{ backgroundColor: severityColors.bg, color: severityColors.text }} className="border-0">
        {ACCIDENT_SEVERITY_LABELS[accident.severity as AccidentSeverity] || accident.severity}
        {accident.has_injuries && ' + Heridos'}
      </Badge>
      <Badge style={{ backgroundColor: statusColors.bg, color: statusColors.text }} className="border-0">
        {ACCIDENT_STATUS_LABELS[accident.status as AccidentStatus] || accident.status}
      </Badge>
    </div>
  );
}
