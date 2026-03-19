// Phase 29: Updated Templates Page with Tabs
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTemplates } from '@/hooks/useTemplates';
import { useUserTemplates } from '@/hooks/useUserTemplates';
import { AppLayout } from '@/components/layout/AppLayout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { CardSkeleton } from '@/components/ui/loading-skeleton';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { UserTemplateCard } from '@/components/templates/UserTemplateCard';
import { 
  LayoutTemplate, 
  Search, 
  Star, 
  User, 
  Users, 
  Building2,
  ArrowRight,
  Globe,
  Heart,
  Plus,
  Upload,
  Shield
} from 'lucide-react';
import { Template, CATEGORY_LABELS, INDUSTRY_LABELS } from '@/types/templates';
import * as LucideIcons from 'lucide-react';

// Official Template Card (Phase 28)
const OfficialTemplateCard = ({ template }: { template: Template }) => {
  const IconComponent = (LucideIcons as any)[
    template.icon.split('-').map((s, i) => 
      i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
    ).join('')
  ] || LayoutTemplate;

  return (
    <Link to={`/templates/${template.slug}`}>
      <Card className="h-full hover:shadow-lg transition-all duration-200 hover:border-primary/50 cursor-pointer group">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
              style={{ backgroundColor: `${template.color}20` }}
            >
              <IconComponent 
                className="h-6 w-6" 
                style={{ color: template.color }} 
              />
            </div>
            <div className="flex gap-1.5">
              <Badge variant="secondary" className="text-xs gap-1">
                <Shield className="h-3 w-3" />
                Oficial
              </Badge>
              {template.is_featured && (
                <Badge variant="outline" className="text-xs">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  Destacada
                </Badge>
              )}
            </div>
          </div>
          <CardTitle className="text-lg group-hover:text-primary transition-colors">
            {template.name}
          </CardTitle>
          <CardDescription className="line-clamp-2">
            {template.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              {CATEGORY_LABELS[template.category]}
              {template.industry && ` · ${INDUSTRY_LABELS[template.industry] || template.industry}`}
            </Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

const Templates = () => {
  const navigate = useNavigate();
  const { templates, loadingTemplates } = useTemplates();
  const { 
    communityTemplates, 
    myTemplates, 
    favoriteTemplates,
    loadingCommunity,
    loadingMy,
    loadingFavorites,
    canCreateTemplates,
    canPublishTemplates,
    isFavorite,
    toggleFavorite,
    currentPlan,
  } = useUserTemplates();
  
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('official');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Filter by search
  const filterBySearch = <T extends { name: string; description: string }>(items: T[] | undefined) => {
    if (!items) return [];
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(item => 
      item.name.toLowerCase().includes(q) || 
      item.description.toLowerCase().includes(q)
    );
  };

  const filteredOfficial = filterBySearch(templates);
  const filteredCommunity = filterBySearch(communityTemplates);
  const filteredMy = filterBySearch(myTemplates);
  const filteredFavorites = filterBySearch(favoriteTemplates);

  const handleCreateTemplate = () => {
    if (!canCreateTemplates) {
      setShowUpgradeModal(true);
      return;
    }
    navigate('/templates/create');
  };

  return (
    <AppLayout title="Plantillas">
      <SEOHead
        title="Plantillas | PlanMint"
        description="Explora plantillas oficiales y de la comunidad para empezar más rápido"
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Plantillas</h1>
            <p className="text-muted-foreground mt-1">
              Explora plantillas oficiales y de la comunidad
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/templates/import')}>
              <Upload className="h-4 w-4 mr-2" />
              Importar JSON
            </Button>
            <Button onClick={handleCreateTemplate}>
              <Plus className="h-4 w-4 mr-2" />
              Crear plantilla
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar plantillas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="official" className="gap-1.5">
              <Shield className="h-4 w-4" />
              Oficiales
              {templates?.length ? <Badge variant="secondary" className="ml-1 text-xs">{templates.length}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="community" className="gap-1.5">
              <Globe className="h-4 w-4" />
              Comunidad
              {communityTemplates?.length ? <Badge variant="secondary" className="ml-1 text-xs">{communityTemplates.length}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="my" className="gap-1.5">
              <User className="h-4 w-4" />
              Mis plantillas
              {myTemplates?.length ? <Badge variant="secondary" className="ml-1 text-xs">{myTemplates.length}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="favorites" className="gap-1.5">
              <Heart className="h-4 w-4" />
              Favoritas
              {favoriteTemplates?.length ? <Badge variant="secondary" className="ml-1 text-xs">{favoriteTemplates.length}</Badge> : null}
            </TabsTrigger>
          </TabsList>

          {/* Official Templates */}
          <TabsContent value="official" className="mt-6">
            {loadingTemplates ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            ) : filteredOfficial.length === 0 ? (
              <EmptyState
                icon={LayoutTemplate}
                title="No hay plantillas oficiales"
                description={search ? "No se encontraron plantillas con tu búsqueda" : "No hay plantillas oficiales disponibles"}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredOfficial.map((template) => (
                  <OfficialTemplateCard key={template.id} template={template} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Community Templates */}
          <TabsContent value="community" className="mt-6">
            {loadingCommunity ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            ) : filteredCommunity.length === 0 ? (
              <EmptyState
                icon={Globe}
                title="No hay plantillas de la comunidad"
                description={search ? "No se encontraron plantillas con tu búsqueda" : "Sé el primero en compartir una plantilla"}
                action={canPublishTemplates ? {
                  label: 'Crear y publicar',
                  onClick: handleCreateTemplate,
                  icon: Plus,
                } : undefined}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCommunity.map((template) => (
                  <UserTemplateCard 
                    key={template.id} 
                    template={template}
                    isFavorite={isFavorite(template.id)}
                    onToggleFavorite={toggleFavorite}
                    linkPrefix="/templates/community"
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* My Templates */}
          <TabsContent value="my" className="mt-6">
            {loadingMy ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            ) : filteredMy.length === 0 ? (
              <EmptyState
                icon={User}
                title="No tienes plantillas"
                description={
                  canCreateTemplates 
                    ? "Crea una plantilla desde tu configuración actual"
                    : "Actualiza tu plan para crear plantillas"
                }
                action={{
                  label: canCreateTemplates ? 'Crear plantilla' : 'Actualizar plan',
                  onClick: handleCreateTemplate,
                  icon: Plus,
                }}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredMy.map((template) => (
                  <UserTemplateCard 
                    key={template.id} 
                    template={template}
                    showVisibility
                    linkPrefix="/templates/my"
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Favorites */}
          <TabsContent value="favorites" className="mt-6">
            {loadingFavorites ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            ) : filteredFavorites.length === 0 ? (
              <EmptyState
                icon={Heart}
                title="No tienes favoritas"
                description="Marca plantillas como favoritas para encontrarlas fácilmente"
                action={{
                  label: 'Explorar comunidad',
                  onClick: () => setActiveTab('community'),
                  icon: Globe,
                }}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredFavorites.map((template) => (
                  <UserTemplateCard 
                    key={template.id} 
                    template={template}
                    isFavorite={true}
                    onToggleFavorite={toggleFavorite}
                    linkPrefix="/templates/community"
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        limitMessage="Actualiza a Pro para crear y compartir plantillas"
        suggestedPlan="pro"
      />
    </AppLayout>
  );
};

export default Templates;
