import { Link } from 'react-router-dom';
import logo from '@/assets/logo.png';

export const PublicFooter = () => {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-5">
          {/* Brand */}
          <div className="space-y-4 md:col-span-2">
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="PlanMint" className="h-10 w-auto" />
            </Link>
            <p className="text-sm text-muted-foreground">
              Organiza tareas, objetivos y proyectos con claridad.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="mb-4 font-semibold">Producto</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/features" className="text-muted-foreground hover:text-foreground">
                  Funcionalidades
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-muted-foreground hover:text-foreground">
                  Precios
                </Link>
              </li>
              <li>
                <Link to="/use-cases" className="text-muted-foreground hover:text-foreground">
                  Casos de uso
                </Link>
              </li>
              <li>
                <Link to="/alternatives" className="text-muted-foreground hover:text-foreground">
                  Alternativas
                </Link>
              </li>
              <li>
                <Link to="/blog" className="text-muted-foreground hover:text-foreground">
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-4 font-semibold">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/privacy" className="text-muted-foreground hover:text-foreground">
                  Privacidad
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-muted-foreground hover:text-foreground">
                  Términos
                </Link>
              </li>
              <li>
                <Link to="/security" className="text-muted-foreground hover:text-foreground">
                  Seguridad
                </Link>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="mb-4 font-semibold">Cuenta</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/login" className="text-muted-foreground hover:text-foreground">
                  Iniciar sesión
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-muted-foreground hover:text-foreground">
                  Crear cuenta
                </Link>
              </li>
              <li className="text-muted-foreground">
                soporte@planmint.app
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} PlanMint. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
};
