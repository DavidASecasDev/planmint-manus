import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import logo from '@/assets/logo.png';

export const PublicNavbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="PlanMint Logo" className="h-9 w-9 rounded-lg object-contain" />
            <span className="text-xl font-bold">PlanMint</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:gap-6">
            <Link to="/features" className="text-muted-foreground hover:text-foreground transition-colors">
              Funcionalidades
            </Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Precios
            </Link>
            <Link to="/security" className="text-muted-foreground hover:text-foreground transition-colors">
              Seguridad
            </Link>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex md:items-center md:gap-3">
            <Link to="/login">
              <Button variant="ghost">Iniciar sesión</Button>
            </Link>
            <Link to="/register">
              <Button>Empezar gratis</Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden border-t bg-background">
          <div className="space-y-1 px-4 py-4">
            <Link
              to="/features"
              className="block py-2 text-muted-foreground hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              Funcionalidades
            </Link>
            <Link
              to="/pricing"
              className="block py-2 text-muted-foreground hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              Precios
            </Link>
            <Link
              to="/security"
              className="block py-2 text-muted-foreground hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              Seguridad
            </Link>
            <div className="pt-4 space-y-2">
              <Link to="/login" onClick={() => setIsOpen(false)}>
                <Button variant="outline" className="w-full">Iniciar sesión</Button>
              </Link>
              <Link to="/register" onClick={() => setIsOpen(false)}>
                <Button className="w-full">Empezar gratis</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
