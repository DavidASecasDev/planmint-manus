import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAccidents } from '@/hooks/useAccidents';
import { Save } from 'lucide-react';
import type { Accident } from '@/types/garatech';

interface Props {
  accident: Accident;
  canManage: boolean;
}

export function AccidentNotesTab({ accident, canManage }: Props) {
  const { updateAccident } = useAccidents();
  const [notes, setNotes] = useState(accident.notes || '');
  const isDirty = notes !== (accident.notes || '');

  const handleSave = async () => {
    try {
      await updateAccident.mutateAsync({ id: accident.id, data: { notes } });
    } catch {}
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Notas Internas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={8}
          placeholder="Añade notas internas sobre el accidente..."
          disabled={!canManage}
        />
        {canManage && isDirty && (
          <Button onClick={handleSave} disabled={updateAccident.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Guardar notas
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
