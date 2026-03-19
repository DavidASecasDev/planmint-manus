import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { Team } from '@/hooks/useTeams';

const COLORS = [
  '#4F46E5', // indigo
  '#0EA5E9', // sky
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#6366F1', // indigo
];

interface TeamFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: Team | null;
  onSubmit: (data: { name: string; description?: string; color?: string }) => void;
  isLoading?: boolean;
}

export function TeamFormDialog({ open, onOpenChange, team, onSubmit, isLoading }: TeamFormDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    if (team) {
      setName(team.name);
      setDescription(team.description || '');
      setColor(team.color || COLORS[0]);
    } else {
      setName('');
      setDescription('');
      setColor(COLORS[0]);
    }
  }, [team, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim() || undefined, color });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{team ? 'Editar equipo' : 'Crear equipo'}</DialogTitle>
          <DialogDescription>
            {team ? 'Modifica los datos del equipo' : 'Crea un nuevo equipo para organizar a los miembros'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del equipo</Label>
              <Input
                id="name"
                placeholder="Ej: Desarrollo, Marketing, Ventas..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Textarea
                id="description"
                placeholder="Describe el propósito del equipo..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`h-8 w-8 rounded-full transition-all ${
                      color === c ? 'ring-2 ring-offset-2 ring-primary' : ''
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {team ? 'Guardar' : 'Crear equipo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
