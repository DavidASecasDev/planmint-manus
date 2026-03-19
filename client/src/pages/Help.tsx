import { useState, useMemo } from 'react';
import { Search, BookOpen, ChevronRight } from 'lucide-react';
import * as Icons from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { helpSections, HelpSection as HelpSectionType } from '@/data/helpContent';
import { HelpSection } from '@/components/help/HelpSection';
import { HelpQuickLinks } from '@/components/help/HelpQuickLinks';
import { HelpBreadcrumb } from '@/components/help/HelpBreadcrumb';
import { useOrganizationModules } from '@/hooks/useOrganizationModules';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';

export default function Help() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string>(helpSections[0]?.id || '');
  const [openSubsections, setOpenSubsections] = useState<Record<string, boolean>>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const { isModuleEnabled } = useOrganizationModules();

  // Filter sections based on modules
  const filteredSections = useMemo(() => {
    return helpSections.filter((section) => {
      if (section.moduleKey) {
        return isModuleEnabled(section.moduleKey);
      }
      return true;
    });
  }, [isModuleEnabled]);

  // Filter by search query
  const searchFilteredSections = useMemo(() => {
    if (!searchQuery.trim()) return filteredSections;

    const query = searchQuery.toLowerCase();
    return filteredSections
      .map((section) => ({
        ...section,
        subsections: section.subsections.filter(
          (sub) =>
            sub.title.toLowerCase().includes(query) ||
            sub.content.toLowerCase().includes(query) ||
            sub.tags?.some(tag => tag.toLowerCase().includes(query))
        ),
      }))
      .filter((section) => section.subsections.length > 0);
  }, [filteredSections, searchQuery]);

  const currentSection = searchFilteredSections.find((s) => s.id === activeSection) || searchFilteredSections[0];

  const toggleSubsection = (subsectionId: string) => {
    setOpenSubsections((prev) => ({
      ...prev,
      [subsectionId]: !prev[subsectionId],
    }));
  };

  // Get icon component
  const getIcon = (iconName: string) => {
    const IconComponent = Icons[iconName as keyof typeof Icons] as React.ComponentType<{ className?: string }>;
    return IconComponent || Icons.HelpCircle;
  };

  return (
    <AppLayout title="Centro de Ayuda">
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-border bg-gradient-to-b from-card to-background flex flex-col shrink-0">
          {/* Header */}
          <div className="p-6 border-b border-border bg-gradient-to-br from-primary/5 to-purple-500/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Centro de Ayuda</h1>
                <p className="text-xs text-muted-foreground">Manual de usuario</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en el manual..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>
            {searchQuery && (
              <p className="text-xs text-muted-foreground mt-2">
                {searchFilteredSections.reduce((acc, s) => acc + s.subsections.length, 0)} resultados
              </p>
            )}
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1">
            <nav className="p-3 space-y-1">
              {searchFilteredSections.map((section) => {
                const Icon = getIcon(section.icon);
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium transition-all',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1 text-left">{section.title}</span>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          'text-[10px] px-1.5 py-0',
                          isActive ? 'bg-primary-foreground/20 text-primary-foreground' : ''
                        )}
                      >
                        {section.subsections.length}
                      </Badge>
                      {section.moduleKey && (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            'text-[9px] px-1 py-0',
                            isActive ? 'border-primary-foreground/30 text-primary-foreground' : ''
                          )}
                        >
                          Módulo
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </nav>
          </ScrollArea>

          {/* Quick Links */}
          <div className="p-3 border-t border-border hidden lg:block">
            <HelpQuickLinks onFeedbackClick={() => setShowFeedback(true)} />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-muted/30">
          <ScrollArea className="h-full">
            <div className="p-6 max-w-4xl mx-auto">
              {/* Breadcrumb */}
              {currentSection && (
                <HelpBreadcrumb
                  items={[
                    { label: currentSection.title }
                  ]}
                  className="mb-6"
                />
              )}

              {currentSection ? (
                <div className="space-y-6">
                  {/* Section Header Card */}
                  <Card className="overflow-hidden border-0 shadow-lg">
                    <div className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/5 p-6">
                      <div className="flex items-start gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg">
                          {(() => {
                            const Icon = getIcon(currentSection.icon);
                            return <Icon className="h-7 w-7 text-white" />;
                          })()}
                        </div>
                        <div className="flex-1">
                          <h2 className="text-2xl font-bold text-foreground mb-1">
                            {currentSection.title}
                          </h2>
                          {currentSection.description && (
                            <p className="text-muted-foreground">
                              {currentSection.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-3">
                            <Badge variant="secondary" className="gap-1">
                              {currentSection.subsections.length} temas
                            </Badge>
                            {currentSection.moduleKey && (
                              <Badge variant="outline" className="gap-1">
                                Módulo opcional
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Subsections */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Contenido</CardTitle>
                      <CardDescription>
                        Haz clic en un tema para expandir su contenido
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {currentSection.subsections.map((subsection) => (
                        <HelpSection
                          key={subsection.id}
                          subsection={subsection}
                          isOpen={openSubsections[subsection.id] || false}
                          onToggle={() => toggleSubsection(subsection.id)}
                        />
                      ))}
                    </CardContent>
                  </Card>

                  {/* Related Topics */}
                  {currentSection.subsections.some(s => s.relatedTopics?.length) && (
                    <Card className="border-dashed">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">
                          Temas relacionados
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {Array.from(
                            new Set(
                              currentSection.subsections
                                .flatMap(s => s.relatedTopics || [])
                            )
                          ).slice(0, 6).map((topicId) => {
                            const topic = filteredSections
                              .flatMap(s => s.subsections)
                              .find(sub => sub.id === topicId);
                            if (!topic) return null;
                            return (
                              <Badge
                                key={topicId}
                                variant="secondary"
                                className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors gap-1"
                                onClick={() => {
                                  const section = filteredSections.find(s => 
                                    s.subsections.some(sub => sub.id === topicId)
                                  );
                                  if (section) {
                                    setActiveSection(section.id);
                                    setOpenSubsections(prev => ({ ...prev, [topicId]: true }));
                                  }
                                }}
                              >
                                <ChevronRight className="h-3 w-3" />
                                {topic.title}
                              </Badge>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <Search className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground mb-2">
                      No se encontraron resultados
                    </h2>
                    <p className="text-muted-foreground max-w-sm mx-auto">
                      Intenta con otros términos de búsqueda o navega por las secciones del manual
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <FeedbackModal
        open={showFeedback}
        onOpenChange={setShowFeedback}
      />
    </AppLayout>
  );
}
