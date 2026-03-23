import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useTransferBrokers } from '@/hooks/useTransferBrokers';
import { usePermissions } from '@/hooks/usePermissions';

interface BrokerSelectProps {
  value: string;
  onChange: (name: string, brokerId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function BrokerSelect({ value, onChange, placeholder = 'Seleccionar broker...', disabled }: BrokerSelectProps) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const { brokers, createBroker, isCreating, isLoading } = useTransferBrokers();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  
  // Wait for permissions to load to avoid race conditions
  const canAdd = !permissionsLoading && (hasPermission('transfers.manage_brokers') || hasPermission('transfers.manage'));

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const broker = await createBroker({ name: newName.trim() });
      onChange(broker.name, broker.id);
      setNewName('');
      setDialogOpen(false);
      setOpen(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const selectedBroker = brokers.find(b => b.name === value);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={disabled}
          >
            {value || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar broker..." />
            <CommandList>
              <CommandEmpty>
                {isLoading ? 'Cargando...' : 'No se encontraron brokers.'}
              </CommandEmpty>
              <CommandGroup>
                {brokers.map((broker) => (
                  <CommandItem
                    key={broker.id}
                    value={broker.name}
                    onSelect={() => {
                      onChange(broker.name, broker.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === broker.name ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {broker.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              {canAdd && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setDialogOpen(true);
                        setOpen(false);
                      }}
                      className="text-primary"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Añadir nuevo broker
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Añadir Broker</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre del broker"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isCreating || !newName.trim()}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Añadir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
