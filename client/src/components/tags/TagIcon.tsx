import {
  Tag,
  Star,
  Briefcase,
  Home,
  Car,
  Heart,
  AlertCircle,
  Check,
  Calendar,
  Target,
  Flag,
  Bookmark,
  Zap,
  Clock,
  Users,
  LucideIcon,
} from 'lucide-react';
import { CSSProperties } from 'react';

const iconMap: Record<string, LucideIcon> = {
  tag: Tag,
  star: Star,
  briefcase: Briefcase,
  home: Home,
  car: Car,
  heart: Heart,
  'alert-circle': AlertCircle,
  check: Check,
  calendar: Calendar,
  target: Target,
  flag: Flag,
  bookmark: Bookmark,
  zap: Zap,
  clock: Clock,
  users: Users,
};

interface TagIconProps {
  icon: string;
  className?: string;
  style?: CSSProperties;
  size?: number;
}

export function TagIcon({ icon, className, style, size }: TagIconProps) {
  const IconComponent = iconMap[icon] || Tag;
  const computedClassName = className || (size ? undefined : 'h-4 w-4');
  return <IconComponent className={computedClassName} style={style} size={size} />;
}

export function getTagIconComponent(icon: string): LucideIcon {
  return iconMap[icon] || Tag;
}
