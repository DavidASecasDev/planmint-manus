import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { LucideIcon } from 'lucide-react';

interface PageHeroProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children?: ReactNode;
}

export const PageHero = ({ title, subtitle, icon: Icon, children }: PageHeroProps) => {
  return (
    <section className="py-20 sm:py-28 bg-gradient-to-b from-primary/5 to-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center"
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          transition={{ duration: 0.6 }}
        >
          {Icon && <Icon className="mx-auto h-16 w-16 text-primary mb-6" />}
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              {subtitle}
            </p>
          )}
          {children}
        </motion.div>
      </div>
    </section>
  );
};
