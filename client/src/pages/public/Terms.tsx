import { motion } from 'framer-motion';
import { PublicLayout } from '@/components/public/PublicLayout';
import { PageHero } from '@/components/public/PageHero';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent } from '@/components/ui/card';
import { fadeInUp } from '@/lib/animations';

export const Terms = () => {
  return (
    <PublicLayout>
      <SEOHead
        title="Términos de Servicio | PlanMint"
        description="Lee los términos y condiciones de uso de PlanMint. Información sobre tu cuenta, pagos y responsabilidades."
        canonical="/terms"
      />

      <PageHero
        title="Términos de Servicio"
        subtitle="Última actualización: Diciembre 2024"
      />

      <section className="pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <Card>
              <CardContent className="p-8 sm:p-12">
                <div className="prose prose-neutral dark:prose-invert max-w-none">
                  <h2>1. Aceptación de los términos</h2>
                  <p>
                    Al acceder y usar PlanMint ("el Servicio"), aceptas estos
                    términos de servicio. Si no estás de acuerdo, no uses el servicio.
                  </p>

                  <h2>2. Descripción del servicio</h2>
                  <p>
                    PlanMint es una aplicación de gestión de tareas, objetivos y
                    proyectos. Ofrecemos planes gratuitos y de pago con diferentes
                    características y límites.
                  </p>

                  <h2>3. Cuentas de usuario</h2>
                  <ul>
                    <li>Debes proporcionar información precisa al registrarte</li>
                    <li>Eres responsable de mantener la seguridad de tu cuenta</li>
                    <li>
                      No puedes compartir credenciales ni usar cuentas de otros
                    </li>
                    <li>Debes tener al menos 16 años para usar el servicio</li>
                  </ul>

                  <h2>4. Uso aceptable</h2>
                  <p>Te comprometes a no:</p>
                  <ul>
                    <li>Violar leyes o regulaciones aplicables</li>
                    <li>Infringir derechos de terceros</li>
                    <li>Intentar acceder a datos de otros usuarios</li>
                    <li>Usar el servicio para spam o actividades maliciosas</li>
                    <li>Interferir con el funcionamiento del servicio</li>
                  </ul>

                  <h2>5. Contenido del usuario</h2>
                  <p>
                    Mantienes la propiedad de todo el contenido que creas en el
                    servicio (tareas, notas, etc.). Nos otorgas licencia limitada para
                    almacenar y procesar ese contenido únicamente para proveer el
                    servicio.
                  </p>

                  <h2>6. Planes y pagos</h2>
                  <ul>
                    <li>Los precios están en euros y pueden cambiar con aviso</li>
                    <li>
                      Las suscripciones se renuevan automáticamente salvo
                      cancelación
                    </li>
                    <li>
                      No hay reembolsos parciales por cancelación a mitad de período
                    </li>
                    <li>
                      Puedes cancelar en cualquier momento desde la configuración
                    </li>
                  </ul>

                  <h2>7. Limitación de responsabilidad</h2>
                  <p>
                    El servicio se proporciona "tal cual". No garantizamos
                    disponibilidad ininterrumpida ni ausencia de errores. No somos
                    responsables de daños indirectos derivados del uso del servicio.
                  </p>

                  <h2>8. Modificaciones del servicio</h2>
                  <p>
                    Podemos modificar, suspender o discontinuar cualquier parte del
                    servicio en cualquier momento. Te notificaremos de cambios
                    significativos con antelación razonable.
                  </p>

                  <h2>9. Terminación</h2>
                  <p>
                    Podemos suspender o terminar tu cuenta si violas estos términos.
                    Puedes eliminar tu cuenta en cualquier momento desde la
                    configuración.
                  </p>

                  <h2>10. Ley aplicable</h2>
                  <p>
                    Estos términos se rigen por las leyes de España. Cualquier disputa
                    se someterá a los tribunales de Madrid, España.
                  </p>

                  <h2>11. Cambios a los términos</h2>
                  <p>
                    Podemos actualizar estos términos. Los cambios entrarán en vigor
                    al publicarse. El uso continuado implica aceptación.
                  </p>

                  <h2>12. Contacto</h2>
                  <p>
                    Para preguntas sobre estos términos:
                  </p>
                  <p>
                    Email:{' '}
                    <a href="mailto:legal@planmint.app">
                      legal@planmint.app
                    </a>
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </PublicLayout>
  );
};
