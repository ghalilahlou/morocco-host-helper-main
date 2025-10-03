import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Loader2, Key, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AirbnbCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCodeSubmit: (code: string) => void;
  isValidating?: boolean;
  error?: string;
}

export const AirbnbCodeModal = ({ 
  isOpen, 
  onClose, 
  onCodeSubmit, 
  isValidating = false,
  error 
}: AirbnbCodeModalProps) => {
  const [code, setCode] = useState('');

  const handleSubmit = () => {
    const normalizedCode = code.trim().toUpperCase();
    
    if (normalizedCode.length < 8) {
      toast({
        title: "Code trop court",
        description: "Le code de réservation Airbnb doit contenir au moins 8 caractères",
        variant: "destructive"
      });
      return;
    }

    if (!normalizedCode.startsWith('HM')) {
      toast({
        title: "Format incorrect",
        description: "Le code de réservation Airbnb doit commencer par 'HM'",
        variant: "destructive"
      });
      return;
    }

    onCodeSubmit(normalizedCode);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isValidating && code.length >= 8) {
      handleSubmit();
    }
  };

  const handleClose = () => {
    if (!isValidating) {
      setCode('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Code de réservation Airbnb requis
          </DialogTitle>
          <DialogDescription>
            Ce lien nécessite votre code de réservation Airbnb pour l'accès sécurisé.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription>
              Votre code de réservation Airbnb commence par <strong>HM</strong> suivi de 8 à 10 caractères (ex: HMXYZ12345).
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="airbnb-code">Code de réservation Airbnb *</Label>
            <Input
              id="airbnb-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="HMXXXXXXXX"
              maxLength={12}
              className="font-mono text-lg tracking-wider"
              disabled={isValidating}
              autoFocus
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            <p>💡 Vous pouvez trouver ce code dans :</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Votre email de confirmation Airbnb</li>
              <li>L'application Airbnb (section "Voyages")</li>
              <li>Le message de votre hôte</li>
            </ul>
          </div>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isValidating}
            className="w-full sm:w-auto"
          >
            Annuler
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isValidating || code.length < 8}
            className="w-full sm:w-auto"
          >
            {isValidating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Vérification...
              </>
            ) : (
              'Valider l\'accès'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
