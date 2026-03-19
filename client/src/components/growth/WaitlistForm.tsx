import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLeads } from '@/hooks/useLeads';
import { Mail, ArrowRight, Check } from 'lucide-react';

interface WaitlistFormProps {
  source?: string;
  referralCode?: string | null;
  className?: string;
  buttonText?: string;
  placeholder?: string;
}

export const WaitlistForm = ({
  source = 'landing',
  referralCode,
  className = '',
  buttonText = 'Unirse a la lista',
  placeholder = 'tu@email.com',
}: WaitlistFormProps) => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { createLead, isCreating } = useLeads();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    createLead(
      { email, source, referralCode },
      {
        onSuccess: () => {
          setIsSubmitted(true);
          setEmail('');
        },
      }
    );
  };

  if (isSubmitted) {
    return (
      <div className={`flex items-center gap-2 text-primary ${className}`}>
        <Check className="h-5 w-5" />
        <span>¡Gracias! Te avisaremos pronto.</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`flex gap-2 ${className}`}>
      <div className="relative flex-1">
        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="email"
          placeholder={placeholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="pl-10"
          required
        />
      </div>
      <Button type="submit" disabled={isCreating}>
        {buttonText}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </form>
  );
};
