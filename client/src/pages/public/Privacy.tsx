import { motion } from 'framer-motion';
import { PublicLayout } from '@/components/public/PublicLayout';
import { PageHero } from '@/components/public/PageHero';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent } from '@/components/ui/card';
import { fadeInUp } from '@/lib/animations';

export const Privacy = () => {
  return (
    <PublicLayout>
      <SEOHead
        title="Política de Privacidad | PlanMint"
        description="Conoce cómo PlanMint protege tu información personal y tus datos. Tu privacidad es nuestra prioridad."
        canonical="/privacy"
      />

      <PageHero
        title="Política de Privacidad"
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
                  <h2>1. Información que recopilamos</h2>
                  <p>
                    Recopilamos información que nos proporcionas directamente:
                  </p>
                  <ul>
                    <li>Datos de cuenta: email, nombre, contraseña (hasheada)</li>
                    <li>Datos de uso: tareas, áreas, etiquetas, recordatorios</li>
                    <li>Datos de organización: nombre de la organización, miembros</li>
                    <li>Datos técnicos: dirección IP, tipo de navegador, dispositivo</li>
                  </ul>

                  <h2>2. Cómo usamos tu información</h2>
                  <p>Utilizamos la información para:</p>
                  <ul>
                    <li>Proporcionar y mantener el servicio</li>
                    <li>Mejorar y personalizar la experiencia</li>
                    <li>Enviar notificaciones que hayas configurado</li>
                    <li>Comunicarnos contigo sobre tu cuenta</li>
                    <li>Prevenir fraude y garantizar la seguridad</li>
                  </ul>

                  <h2>3. Compartición de datos</h2>
                  <p>
                    No vendemos ni compartimos tus datos personales con terceros para
                    fines publicitarios. Solo compartimos datos cuando:
                  </p>
                  <ul>
                    <li>Es necesario para proveer el servicio (proveedores cloud)</li>
                    <li>Lo requiere la ley</li>
                    <li>Tienes tu consentimiento explícito</li>
                  </ul>

                  <h2>4. Seguridad</h2>
                  <p>
                    Implementamos medidas de seguridad técnicas y organizativas para
                    proteger tus datos, incluyendo cifrado en tránsito, políticas de
                    acceso estrictas y auditorías regulares.
                  </p>

                  <h2>5. Retención de datos</h2>
                  <p>
                    Conservamos tus datos mientras mantengas tu cuenta activa. Puedes
                    solicitar la eliminación de tu cuenta y datos en cualquier momento
                    contactando a soporte.
                  </p>

                  <h2>6. Tus derechos</h2>
                  <p>Tienes derecho a:</p>
                  <ul>
                    <li>Acceder a tus datos personales</li>
                    <li>Rectificar datos incorrectos</li>
                    <li>Eliminar tus datos (derecho al olvido)</li>
                    <li>Portabilidad de datos</li>
                    <li>Oponerte al procesamiento</li>
                  </ul>

                  <h2>7. Cookies</h2>
                  <p>
                    Utilizamos cookies esenciales para el funcionamiento del servicio
                    (autenticación, preferencias). No utilizamos cookies de publicidad
                    ni tracking de terceros.
                  </p>

                  <h2>8. Cambios a esta política</h2>
                  <p>
                    Podemos actualizar esta política ocasionalmente. Te notificaremos
                    de cambios significativos por email o mediante un aviso en la app.
                  </p>

                  <h2>9. Contacto</h2>
                  <p>
                    Para cualquier pregunta sobre privacidad, contacta con nosotros:
                  </p>
                  <p>
                    Email:{' '}
                    <a href="mailto:privacidad@planmint.app">
                      privacidad@planmint.app
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
