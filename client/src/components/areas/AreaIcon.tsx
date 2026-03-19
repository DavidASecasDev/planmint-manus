import * as React from 'react';
import {
  Folder,
  Briefcase,
  Home,
  Car,
  Heart,
  Target,
  Book,
  Cog,
  Star,
  Wallet,
  Users,
  Plane,
  LucideIcon,
} from 'lucide-react';
import { CSSProperties } from 'react';

const iconMap: Record<string, LucideIcon> = {
  folder: Folder,
  briefcase: Briefcase,
  home: Home,
  car: Car,
  heart: Heart,
  target: Target,
  book: Book,
  cog: Cog,
  star: Star,
  wallet: Wallet,
  users: Users,
  plane: Plane,
};

interface AreaIconProps {
  icon: string;
  className?: string;
  style?: CSSProperties;
  size?: number;
}

export const AreaIcon = React.forwardRef<SVGSVGElement, AreaIconProps>(
  ({ icon, className, style, size }, ref) => {
    const IconComponent = iconMap[icon] || Folder;
    const computedClassName = className || (size ? undefined : 'h-5 w-5');
    return <IconComponent ref={ref} className={computedClassName} style={style} size={size} />;
  }
);
AreaIcon.displayName = 'AreaIcon';

export function getIconComponent(icon: string): LucideIcon {
  return iconMap[icon] || Folder;
}
