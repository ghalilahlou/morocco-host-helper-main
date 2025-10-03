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
import { useGuestVerification } from '@/hooks/useGuestVerification';
import { toast } from '@/hooks/use-toast';
import { Loader2, Key, CheckCircle, XCircle } from 'lucide-react';

interface BookingPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  onSuccess?: (token: string) => void;
}

export const BookingPasswordModal = ({
  isOpen,
  onClose,
  propertyId,
  onSuccess
}: BookingPasswordModalProps) => {
  const [password, setPassword] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    status: 'idle' | 'valid' | 'invalid';
    message?: string;
  }>({ status: 'idle' });

  const { validateBookingPassword } = useGuestVerification();

  const handleValidate = async () => {
    if (!password.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir le code de réservation",
        variant: "destructive"
      });
      return;
    }

    setIsValidating(true);
    setValidationResult({ status: 'idle' });

    try {
      const result = await validateBookingPassword(propertyId, password.trim().toUpperCase());
      
      if (result.valid && result.token) {
        setValidationResult({ 
          status: 'valid', 
          message: 'Code de réservation valide !' 
        });
        
        toast({
          title: "Succès",
          description: "Code de réservation validé avec succès"
        });

        // Appeler le callback de succès si fourni
        if (onSuccess) {
          onSuccess(result.token);
        }

        // Fermer le modal après un délai
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        setValidationResult({ 
          status: 'invalid', 
          message: result.error || 'Code de réservation invalide' 
        });
        
        toast({
          title: "Erreur",
          description: result.error || "Code de réservation invalide",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error validating password:', error);
      setValidationResult({ 
        status: 'invalid', 
        message: 'Erreur lors de la validation' 
      });
      
      toast({
        title: "Erreur",
        description: "Erreur lors de la validation du code",
        variant: "destructive"
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setValidationResult({ status: 'idle' });
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isValidating) {
      handleValidate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Validation du code de réservation
          </DialogTitle>
          <DialogDescription>
            Saisissez le code de réservation Airbnb pour accéder au formulaire de vérification.
            <br />
            <span className="text-sm text-muted-foreground">
              Ce code est uniquement requis pour les réservations Airbnb.
            </span>
            <br />
            <span className="text-sm text-muted-foreground">
              Exemple : HMYCNJZ3MH, HMQXWW9Y4M, etc.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="password">Code de réservation Airbnb</Label>
            <Input
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              placeholder="Ex: HMYCNJZ3MH"
              className="uppercase"
              disabled={isValidating}
              autoComplete="off"
            />
          </div>

          {/* Résultat de validation */}
          {validationResult.status !== 'idle' && (
            <div className={`flex items-center gap-2 p-3 rounded-md ${
              validationResult.status === 'valid' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {validationResult.status === 'valid' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">
                {validationResult.message}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isValidating}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleValidate}
            disabled={isValidating || !password.trim()}
          >
            {isValidating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validation...
              </>
            ) : (
              'Valider'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
