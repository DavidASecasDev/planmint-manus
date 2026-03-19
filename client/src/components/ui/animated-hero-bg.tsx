import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedHeroBgProps {
  children?: React.ReactNode;
  className?: string;
}

export function AnimatedHeroBg({ children, className }: AnimatedHeroBgProps) {
  return (
    <div className={cn("relative w-full overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background", className)}>
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Blob 1 - top left */}
      <motion.div
        className="absolute -top-20 -left-20 h-[400px] w-[400px] rounded-full bg-primary/10 blur-[100px]"
        animate={{
          x: [0, 60, -30, 0],
          y: [0, 40, -20, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
        }}
      />

      {/* Blob 2 - top right */}
      <motion.div
        className="absolute -top-10 right-0 h-[350px] w-[350px] rounded-full bg-primary/[0.07] blur-[100px]"
        animate={{
          x: [0, -50, 30, 0],
          y: [0, 50, -10, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
        }}
      />

      {/* Blob 3 - center bottom */}
      <motion.div
        className="absolute bottom-0 left-1/3 h-[300px] w-[300px] rounded-full bg-primary/[0.05] blur-[100px]"
        animate={{
          x: [0, 40, -40, 0],
          y: [0, -30, 20, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
}
