import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PublicLayout } from '@/components/public/PublicLayout';
import { PageHero } from '@/components/public/PageHero';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { blogPosts, blogCategories } from '@/data/blogPosts';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { Calendar, Clock, ArrowRight } from 'lucide-react';

export const Blog = () => {
  return (
    <PublicLayout>
      <SEOHead
        title="Blog | PlanMint"
        description="Artículos sobre productividad, gestión de tareas, objetivos y equipos. Consejos prácticos para ser más productivo."
        canonical="/blog"
      />

      <PageHero
        title="Blog de PlanMint"
        subtitle="Consejos, guías y mejores prácticas para gestionar tareas, objetivos y equipos."
      >
        {/* Categories */}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {blogCategories.map((category) => (
            <Badge key={category.slug} variant="secondary" className="cursor-pointer hover:bg-secondary/80">
              {category.label}
            </Badge>
          ))}
        </div>
      </PageHero>

      {/* Posts Grid */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid gap-8 md:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
          >
            {blogPosts.map((post) => (
              <motion.div key={post.slug} variants={fadeInUp}>
                <Card className="group h-full transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30">
                  <CardContent className="p-6">
                    <Badge variant="outline" className="mb-4">
                      {post.categoryLabel}
                    </Badge>
                    <Link to={`/blog/${post.slug}`}>
                      <h2 className="text-xl font-semibold group-hover:text-primary transition-colors line-clamp-2">
                        {post.title}
                      </h2>
                    </Link>
                    <p className="mt-3 text-muted-foreground line-clamp-3">
                      {post.excerpt}
                    </p>
                    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(post.publishedAt).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {post.readTime} min
                        </span>
                      </div>
                    </div>
                    <Link 
                      to={`/blog/${post.slug}`}
                      className="mt-4 inline-flex items-center text-sm font-medium text-primary hover:underline"
                    >
                      Leer más
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </PublicLayout>
  );
};
