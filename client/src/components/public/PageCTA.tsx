import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { fadeInUp } from '@/lib/animations';
import { ArrowRight } from 'lucide-react';

interface PageCTAProps {
  title: string;
  subtitle: string;
  buttonText?: string;
  buttonLink?: string;
  children?: ReactNode;
}

export const PageCTA = ({
  title,
  subtitle,
  buttonText = 'Empezar gratis',
  buttonLink = '/register',
  children,
}: PageCTAProps) => {
  return (
    <motion.section
      className="border-t bg-gradient-to-b from-background to-muted/30 py-20"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={fadeInUp}
      transition={{ duration: 0.7 }}
    >
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
        <p className="mt-4 text-muted-foreground">{subtitle}</p>
        <Link to={buttonLink}>
          <Button size="lg" className="mt-6">
            {buttonText}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        {children}
      </div>
    </motion.section>
  );
};
