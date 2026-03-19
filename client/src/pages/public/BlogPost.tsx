import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PublicLayout } from '@/components/public/PublicLayout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getBlogPost, blogPosts } from '@/data/blogPosts';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { Calendar, Clock, ArrowLeft, ArrowRight, User } from 'lucide-react';

export const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPost(slug) : undefined;

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const relatedPosts = blogPosts
    .filter((p) => p.category === post.category && p.slug !== post.slug)
    .slice(0, 2);

  // Simple markdown to HTML conversion for basic formatting
  const renderContent = (content: string) => {
    return content
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-2xl font-bold mt-8 mb-4">{line.replace('## ', '')}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-xl font-semibold mt-6 mb-3">{line.replace('### ', '')}</h3>;
        }
        if (line.startsWith('- **')) {
          const match = line.match(/- \*\*(.+?)\*\*: (.+)/);
          if (match) {
            return (
              <li key={i} className="ml-4 mb-2">
                <strong>{match[1]}</strong>: {match[2]}
              </li>
            );
          }
        }
        if (line.startsWith('- ')) {
          return <li key={i} className="ml-4 mb-2">{line.replace('- ', '')}</li>;
        }
        if (/^\d+\. \*\*/.test(line)) {
          const match = line.match(/^\d+\. \*\*(.+?)\*\*:? ?(.*)$/);
          if (match) {
            return (
              <li key={i} className="ml-4 mb-2">
                <strong>{match[1]}</strong>{match[2] ? `: ${match[2]}` : ''}
              </li>
            );
          }
        }
        if (/^\d+\. /.test(line)) {
          return <li key={i} className="ml-4 mb-2">{line.replace(/^\d+\. /, '')}</li>;
        }
        if (line.startsWith('---')) {
          return <hr key={i} className="my-8 border-border" />;
        }
        if (line.includes('❌') || line.includes('✅')) {
          return <p key={i} className="ml-4 mb-1 font-mono text-sm">{line}</p>;
        }
        if (line.includes('**')) {
          const parts = line.split(/\*\*(.+?)\*\*/g);
          return (
            <p key={i} className="mb-4">
              {parts.map((part, j) => (j % 2 === 1 ? <strong key={j}>{part}</strong> : part))}
            </p>
          );
        }
        if (line.includes('[') && line.includes('](/')) {
          const match = line.match(/\[(.+?)\]\((.+?)\)/);
          if (match) {
            return (
              <p key={i} className="mb-4">
                <Link to={match[2]} className="text-primary hover:underline">
                  {match[1]}
                </Link>
              </p>
            );
          }
        }
        if (line.trim()) {
          return <p key={i} className="mb-4 text-muted-foreground">{line}</p>;
        }
        return null;
      })
      .filter(Boolean);
  };

  return (
    <PublicLayout>
      <SEOHead
        title={post.metaTitle}
        description={post.metaDescription}
        canonical={`/blog/${post.slug}`}
        ogType="article"
        article={{
          publishedTime: post.publishedAt,
          author: post.author,
          section: post.categoryLabel,
        }}
      />

      <article className="py-20 sm:py-28 bg-gradient-to-b from-primary/5 to-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {/* Back link */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.5 }}
          >
            <Link
              to="/blog"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al blog
            </Link>
          </motion.div>

          {/* Header */}
          <motion.header
            className="mb-8"
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Badge variant="outline" className="mb-4">
              {post.categoryLabel}
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {post.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {post.author}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(post.publishedAt).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {post.readTime} min de lectura
              </span>
            </div>
          </motion.header>
        </div>
      </article>

      {/* Content */}
      <div className="pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="prose prose-lg max-w-none"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {renderContent(post.content)}
          </motion.div>

          {/* CTA */}
          <motion.div
            className="mt-12 rounded-xl bg-muted/50 p-8 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-xl font-semibold">¿Listo para organizarte mejor?</h3>
            <p className="mt-2 text-muted-foreground">
              Prueba PlanMint gratis y gestiona tareas, objetivos y equipos en un solo lugar.
            </p>
            <Link to="/register">
              <Button size="lg" className="mt-4">
                Empezar gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <motion.section
          className="border-t py-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <motion.h2 variants={fadeInUp} className="text-2xl font-bold mb-8">Artículos relacionados</motion.h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {relatedPosts.map((related) => (
                <motion.div key={related.slug} variants={fadeInUp}>
                  <Link
                    to={`/blog/${related.slug}`}
                    className="group block rounded-lg border p-6 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30"
                  >
                    <h3 className="font-semibold group-hover:text-primary transition-colors line-clamp-2">
                      {related.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {related.excerpt}
                    </p>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>
      )}
    </PublicLayout>
  );
};
