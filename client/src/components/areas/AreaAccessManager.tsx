import { useState } from 'react';
import { useAreaAccess } from '@/hooks/useAreaAccess';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { X, Plus, User, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AreaAccessManagerProps {
  areaId?: string;
  selectedSubjects: Array<{ type: 'user' | 'role' | 'team'; id: string; name?: string }>;
  onSubjectsChange: (subjects: Array<{ type: 'user' | 'role' | 'team'; id: string; name?: string }>) => void;
}

export function AreaAccessManager({
  areaId,
  selectedSubjects,
  onSubjectsChange,
}: AreaAccessManagerProps) {
  const { availableUsers, availableRoles, isAdmin } = useAreaAccess(areaId);
  const [selectedType, setSelectedType] = useState<'user' | 'role'>('user');
  const [selectedId, setSelectedId] = useState<string>('');

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Solo los administradores pueden gestionar el acceso personalizado.
      </p>
    );
  }

  const handleAdd = () => {
    if (!selectedId) return;

    const subject = selectedType === 'user'
      ? availableUsers.find((u) => u.id === selectedId)
      : availableRoles.find((r) => r.id === selectedId);

    if (!subject) return;

    // Check if already added
    const exists = selectedSubjects.some(
      (s) => s.type === selectedType && s.id === selectedId
    );
    if (exists) return;

    onSubjectsChange([
      ...selectedSubjects,
      { type: selectedType, id: selectedId, name: subject.name },
    ]);
    setSelectedId('');
  };

  const handleRemove = (type: string, id: string) => {
    onSubjectsChange(selectedSubjects.filter((s) => !(s.type === type && s.id === id)));
  };

  const availableItems = selectedType === 'user' ? availableUsers : availableRoles;
  const filteredItems = availableItems.filter(
    (item) => !selectedSubjects.some((s) => s.type === selectedType && s.id === item.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="sr-only">Tipo de acceso</Label>
          <Select
            value={selectedType}
            onValueChange={(v) => {
              setSelectedType(v as 'user' | 'role');
              setSelectedId('');
            }}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Usuario
                </span>
              </SelectItem>
              <SelectItem value="role">
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Rol
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-[2]">
          <Label className="sr-only">Seleccionar</Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder={`Seleccionar ${selectedType === 'user' ? 'usuario' : 'rol'}...`} />
            </SelectTrigger>
            <SelectContent>
              {filteredItems.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground text-center">
                  No hay {selectedType === 'user' ? 'usuarios' : 'roles'} disponibles
                </div>
              ) : (
                filteredItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={handleAdd}
          disabled={!selectedId}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Selected subjects */}
      {selectedSubjects.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Acceso otorgado a:</Label>
          <div className="flex flex-wrap gap-2">
            {selectedSubjects.map((subject) => (
              <Badge
                key={`${subject.type}-${subject.id}`}
                variant="secondary"
                className={cn(
                  'gap-1.5 pr-1.5 text-sm',
                  subject.type === 'user' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                  subject.type === 'role' && 'bg-green-500/10 text-green-600 dark:text-green-400'
                )}
              >
                {subject.type === 'user' ? <User className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                {subject.name || subject.id.slice(0, 8)}
                <button
                  type="button"
                  onClick={() => handleRemove(subject.type, subject.id)}
                  className="ml-1 rounded-full p-0.5 hover:bg-background/50"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {selectedSubjects.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          Agrega usuarios o roles que podrán ver esta área.
        </p>
      )}
    </div>
  );
}
