import { useState } from 'react';
import { SuperAdminLayout } from './SuperAdminLayout';
import { usePlatformFeedback } from '@/hooks/useSuperAdmin';
import { useSuperAdminActions } from '@/hooks/useSuperAdminActions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageSquare, Search, Eye, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FeedbackDetailDialog } from '@/components/super-admin/FeedbackDetailDialog';

export default function Feedback() {
  const { data: feedback, isLoading } = usePlatformFeedback();
  const { updateFeedback, deleteFeedback } = useSuperAdminActions();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null);

  const filteredFeedback = feedback?.filter((fb: any) => {
    const matchesSearch = fb.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fb.organizations?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || fb.feedback_type === typeFilter;
    
    let matchesStatus = true;
    if (statusFilter === 'unread') {
      matchesStatus = !fb.read_at;
    } else if (statusFilter === 'read') {
      matchesStatus = !!fb.read_at && !fb.resolved_at;
    } else if (statusFilter === 'resolved') {
      matchesStatus = !!fb.resolved_at;
    }
    
    return matchesSearch && matchesType && matchesStatus;
  }) || [];

  // Count unread feedback
  const unreadCount = feedback?.filter((fb: any) => !fb.read_at).length || 0;

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'bug':
        return <Badge variant="destructive">Bug</Badge>;
      case 'suggestion':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Sugerencia</Badge>;
      case 'question':
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">Pregunta</Badge>;
      case 'praise':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Elogio</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const getStatusIndicator = (fb: any) => {
    if (fb.resolved_at) {
      return (
        <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
          <CheckCircle className="h-3 w-3" />
          Resuelto
        </Badge>
      );
    }
    if (fb.read_at) {
      return (
        <Badge variant="outline" className="gap-1">
          <Eye className="h-3 w-3" />
          Leído
        </Badge>
      );
    }
    return (
      <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 gap-1">
        <Clock className="h-3 w-3" />
        Nuevo
      </Badge>
    );
  };

  const handleMarkRead = () => {
    if (selectedFeedback) {
      updateFeedback.mutate({
        feedbackId: selectedFeedback.id,
        readAt: new Date().toISOString(),
      });
    }
  };

  const handleMarkResolved = () => {
    if (selectedFeedback) {
      updateFeedback.mutate({
        feedbackId: selectedFeedback.id,
        readAt: selectedFeedback.read_at || new Date().toISOString(),
        resolvedAt: new Date().toISOString(),
      });
    }
  };

  const handleUpdateNotes = (notes: string) => {
    if (selectedFeedback) {
      updateFeedback.mutate(
        { feedbackId: selectedFeedback.id, internalNotes: notes },
        { onSuccess: () => setSelectedFeedback(null) }
      );
    }
  };

  const handleDelete = () => {
    if (selectedFeedback) {
      deleteFeedback.mutate(
        { feedbackId: selectedFeedback.id },
        { onSuccess: () => setSelectedFeedback(null) }
      );
    }
  };

  return (
    <SuperAdminLayout title="Feedback Global">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  Todo el Feedback
                  {unreadCount > 0 && (
                    <Badge className="bg-orange-500 text-white">{unreadCount} nuevos</Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-2">
                  Feedback recibido de todas las organizaciones
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{feedback?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex gap-4 mb-6 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar en feedback..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="suggestion">Sugerencia</SelectItem>
                  <SelectItem value="question">Pregunta</SelectItem>
                  <SelectItem value="praise">Elogio</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="unread">No leídos</SelectItem>
                  <SelectItem value="read">Leídos</SelectItem>
                  <SelectItem value="resolved">Resueltos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Feedback List */}
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : filteredFeedback.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No se encontró feedback
              </div>
            ) : (
              <div className="space-y-4">
                {filteredFeedback.map((fb: any) => (
                  <Card 
                    key={fb.id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${!fb.read_at ? 'border-l-4 border-l-orange-500' : ''}`}
                    onClick={() => setSelectedFeedback(fb)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {getTypeBadge(fb.feedback_type)}
                            {getStatusIndicator(fb)}
                            <span className="text-sm text-muted-foreground">
                              de <span className="font-medium text-foreground">{fb.organizations?.name || 'Organización desconocida'}</span>
                            </span>
                          </div>
                          <p className="text-sm line-clamp-2">{fb.message}</p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                            <span>Por: {fb.profiles?.name || 'Usuario desconocido'}</span>
                            <span>•</span>
                            <span>{format(new Date(fb.created_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}</span>
                          </div>
                          {fb.internal_notes && (
                            <div className="mt-2 p-2 rounded bg-muted/50 text-xs">
                              <strong>Notas:</strong> {fb.internal_notes}
                            </div>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedFeedback(fb); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <FeedbackDetailDialog
        open={!!selectedFeedback}
        onOpenChange={(open) => !open && setSelectedFeedback(null)}
        feedback={selectedFeedback}
        onMarkRead={handleMarkRead}
        onMarkResolved={handleMarkResolved}
        onUpdateNotes={handleUpdateNotes}
        onDelete={handleDelete}
        isLoading={updateFeedback.isPending || deleteFeedback.isPending}
      />
    </SuperAdminLayout>
  );
}
