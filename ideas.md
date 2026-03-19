# PlanMint Preview — Brainstorm de Diseño

PlanMint es una plataforma SaaS de gestión de tareas, objetivos y equipos. La landing actual tiene un estilo limpio con tonos azules/verdes, fondo blanco, y un mockup de dashboard. Necesitamos replicar la esencia pero con un diseño que se sienta más pulido y profesional.

---

<response>
<text>

## Idea 1: "Soft Corporate" — Diseño Institucional Moderno

**Design Movement**: Corporate Minimalism con toques de Glassmorphism sutil.

**Core Principles**:
1. Jerarquía visual clara con tipografía bold en títulos y ligera en cuerpo.
2. Espacios amplios que transmiten confianza y profesionalismo.
3. Colores institucionales (azul profundo + verde menta) con acentos cálidos.

**Color Philosophy**: Azul oscuro (#1a365d) como color de autoridad, verde menta (#38b2ac) como acento de frescura, fondo blanco roto (#fafafa) para suavidad. El contraste entre el azul serio y el verde fresco comunica "productividad sin estrés".

**Layout Paradigm**: Hero centrado con mockup flotante, secciones alternadas izquierda-derecha con ilustraciones, grid de 3 columnas para features.

**Signature Elements**: Cards con sombra suave y borde redondeado, iconos en círculos de color, badges de "Más popular" en pricing.

**Interaction Philosophy**: Hover suaves con scale(1.02), transiciones de 300ms, scroll reveal de abajo hacia arriba.

**Animation**: Fade-in secuencial en las cards de features, counter animado en estadísticas, hover glow en botones CTA.

**Typography System**: DM Sans para títulos (bold, tracking tight), Inter para cuerpo (regular/medium). Tamaños: H1 4xl-5xl, H2 3xl, body base-lg.

</text>
<probability>0.08</probability>
</response>

<response>
<text>

## Idea 2: "Organic Flow" — Diseño Orgánico con Movimiento Natural

**Design Movement**: Organic Modernism inspirado en formas naturales y fluidas.

**Core Principles**:
1. Formas curvas y orgánicas que rompen la rigidez de las grids tradicionales.
2. Gradientes suaves que imitan la naturaleza (amanecer, agua, vegetación).
3. Tipografía con personalidad que transmite cercanía sin perder profesionalismo.
4. Micro-animaciones que dan vida a cada interacción.

**Color Philosophy**: Gradiente principal de verde esmeralda (#059669) a teal (#0d9488), con fondos de crema suave (#fefce8) y texto en slate oscuro (#1e293b). El verde evoca crecimiento y productividad orgánica, no forzada.

**Layout Paradigm**: Secciones con bordes ondulados (SVG waves), contenido asimétrico con elementos flotantes, hero con composición diagonal donde el texto va a la izquierda y el mockup se inclina ligeramente.

**Signature Elements**: Blobs SVG animados como fondos decorativos, líneas curvas que conectan secciones, iconos dibujados a mano (hand-drawn style).

**Interaction Philosophy**: Elementos que "respiran" con animaciones sutiles de scale, parallax suave en scroll, botones que se expanden orgánicamente al hover.

**Animation**: Blobs que se transforman lentamente (morph), cards que aparecen con spring physics (framer-motion), números que cuentan hacia arriba al entrar en viewport.

**Typography System**: Outfit para títulos (semibold, redondeada y moderna), Source Sans 3 para cuerpo. Los títulos grandes usan gradient text para reforzar la identidad orgánica.

</text>
<probability>0.05</probability>
</response>

<response>
<text>

## Idea 3: "Mint Fresh" — Diseño Fresco y Directo

**Design Movement**: Neo-Brutalism suavizado, inspirado en apps modernas como Linear y Notion.

**Core Principles**:
1. Claridad absoluta: cada elemento tiene un propósito, sin decoración gratuita.
2. Contraste fuerte entre secciones para guiar el ojo.
3. Tipografía como elemento gráfico principal (títulos enormes, peso variable).
4. Color como sistema de señalización, no como decoración.

**Color Philosophy**: Fondo blanco puro (#ffffff) con secciones alternas en mint muy claro (#f0fdf4). El color primario es un verde menta vibrante (#10b981) que se usa solo en CTAs y acentos. Texto en negro casi puro (#0f172a). La paleta es intencionalmente reducida para que cada toque de color tenga impacto.

**Layout Paradigm**: Full-width sections con contenido en container estrecho (max-w-4xl). Hero con título gigante (6xl+) y subtítulo conciso. Features en lista vertical con iconos alineados, no en grid. Pricing horizontal con scroll en móvil.

**Signature Elements**: Bordes definidos (no sombras difusas), badges con fondo de color sólido, checkmarks verdes en listas de features, mockup del dashboard con borde y sombra dura.

**Interaction Philosophy**: Transiciones rápidas (150ms), hover con cambio de fondo sólido (no gradiente), focus states muy visibles. Todo se siente instantáneo y preciso.

**Animation**: Entrada rápida con fade + translateY corto (10px), stagger de 50ms entre elementos hermanos, sin animaciones continuas que distraigan.

**Typography System**: Satoshi o Geist para todo (un solo font family), diferenciando por peso: títulos en Black (900), subtítulos en Bold (700), cuerpo en Regular (400). El contraste de peso crea jerarquía sin necesidad de múltiples fuentes.

</text>
<probability>0.07</probability>
</response>

---

## Decisión

Elijo la **Idea 3: "Mint Fresh"** porque:
1. Se alinea perfectamente con la identidad de marca "PlanMint" (mint = menta).
2. El estilo limpio y directo es ideal para una herramienta de productividad.
3. La paleta reducida facilita la consistencia y el mantenimiento.
4. El enfoque en tipografía como elemento gráfico reduce la dependencia de imágenes.
5. Las animaciones rápidas y precisas transmiten la eficiencia que promete el producto.
