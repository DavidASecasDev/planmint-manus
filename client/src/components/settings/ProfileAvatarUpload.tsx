import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Camera, Loader2 } from 'lucide-react';
import { AvatarCropDialog } from './AvatarCropDialog';
import { compressImage } from '@/lib/imageCompression';

export function ProfileAvatarUpload() {
  const { profile, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Solo se permiten imágenes', variant: 'destructive' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Error', description: 'La imagen no puede superar 2MB', variant: 'destructive' });
      return;
    }

    setCropFile(file);
    setCropOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCrop = async (blob: Blob) => {
    setCropOpen(false);
    setCropFile(null);
    if (!profile) return;

    setUploading(true);
    try {
      // Compress the cropped avatar
      const avatarFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      const compressed = await compressImage(avatarFile, { maxDimension: 512, quality: 0.85 });
      const filePath = `${profile.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, compressed.file, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      await refreshProfile();
      toast({ title: 'Foto actualizada', description: 'Tu foto de perfil ha sido actualizada' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative group">
        <Avatar className="h-16 w-16">
          {profile?.avatar_url && (
            <AvatarImage src={profile.avatar_url} alt={profile?.name || ''} />
          )}
          <AvatarFallback className="text-lg bg-primary/10 text-primary font-medium">
            {getInitials(profile?.name || null)}
          </AvatarFallback>
        </Avatar>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-foreground" />
          ) : (
            <Camera className="h-5 w-5 text-foreground" />
          )}
        </button>
      </div>
      <div className="space-y-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Subiendo...' : 'Cambiar foto'}
        </Button>
        <p className="text-xs text-muted-foreground">JPG, PNG. Máximo 2MB</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <AvatarCropDialog
        open={cropOpen}
        file={cropFile}
        onClose={() => { setCropOpen(false); setCropFile(null); }}
        onCrop={handleCrop}
      />
    </div>
  );
}
