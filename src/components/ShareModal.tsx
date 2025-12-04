/**
 * 📱 MODAL DE PARTAGE MOBILE
 * Interface utilisateur pour partager un lien sur mobile
 * Alternatives au copier-coller : Web Share, WhatsApp, SMS, Email, QR Code
 */

import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Copy, Check, Share2, MessageCircle, Mail, Smartphone, QrCode, X, ExternalLink } from 'lucide-react';
import { 
  shareNative, 
  shareToWhatsApp, 
  shareViaSMS, 
  shareViaEmail,
  generateQRCodeUrl,
  canShare,
  isMobile,
  ShareOptions 
} from '@/lib/shareUtils';
import { copyToClipboardSimple } from '@/lib/clipboardSimple';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title?: string;
  guestName?: string;
  propertyName?: string;
  checkIn?: string;
  checkOut?: string;
}

export const ShareModal = ({
  isOpen,
  onClose,
  url,
  title = 'Partager le lien',
  guestName,
  propertyName,
  checkIn,
  checkOut
}: ShareModalProps) => {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const shareOptions: ShareOptions = {
    url,
    guestName,
    propertyName,
    checkIn,
    checkOut,
    title: `Lien de réservation${propertyName ? ` - ${propertyName}` : ''}`
  };

  // Copier le lien
  const handleCopy = useCallback(async (event?: React.MouseEvent) => {
    setIsSharing(true);
    try {
      const result = await copyToClipboardSimple(url, event);
      if (result.success) {
        setCopied(true);
        toast({
          title: '✅ Lien copié !',
          description: 'Le lien a été copié dans le presse-papiers',
        });
        setTimeout(() => setCopied(false), 3000);
      } else {
        toast({
          title: 'Copie manuelle requise',
          description: 'Appuyez longuement sur le lien pour le copier',
          duration: 5000,
        });
      }
    } finally {
      setIsSharing(false);
    }
  }, [url]);

  // Partage natif (Web Share API)
  const handleNativeShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const result = await shareNative(shareOptions);
      if (result.success) {
        toast({
          title: '✅ Partagé !',
          description: 'Le lien a été partagé avec succès',
        });
        onClose();
      } else if (result.error !== 'Partage annulé') {
        toast({
          title: 'Erreur de partage',
          description: result.error,
          variant: 'destructive',
        });
      }
    } finally {
      setIsSharing(false);
    }
  }, [shareOptions, onClose]);

  // WhatsApp
  const handleWhatsApp = useCallback(() => {
    const result = shareToWhatsApp(shareOptions);
    if (result.success) {
      toast({
        title: '📱 WhatsApp ouvert',
        description: 'Sélectionnez le contact pour envoyer le lien',
      });
    }
  }, [shareOptions]);

  // SMS
  const handleSMS = useCallback(() => {
    const result = shareViaSMS(shareOptions);
    if (result.success) {
      toast({
        title: '📱 SMS ouvert',
        description: 'Entrez le numéro et envoyez le message',
      });
    }
  }, [shareOptions]);

  // Email
  const handleEmail = useCallback(() => {
    const result = shareViaEmail(shareOptions);
    if (result.success) {
      toast({
        title: '📧 Email ouvert',
        description: 'Complétez l\'adresse et envoyez',
      });
    }
  }, [shareOptions]);

  // Toggle QR Code
  const handleToggleQR = useCallback(() => {
    setShowQR(!showQR);
  }, [showQR]);

  const qrCodeUrl = generateQRCodeUrl(url, 200);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {propertyName && <span className="font-medium">{propertyName}</span>}
            {checkIn && checkOut && (
              <span className="text-muted-foreground"> • {checkIn} → {checkOut}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Zone de lien avec copie */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Lien de réservation</label>
            <div className="flex gap-2">
              <Input
                value={url}
                readOnly
                className="flex-1 text-sm bg-muted/50 font-mono"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                disabled={isSharing}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Boutons de partage */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Partager via</label>
            
            <div className="grid grid-cols-2 gap-2">
              {/* Partage natif (mobile uniquement avec support) */}
              {isMobile() && canShare() && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 h-12"
                  onClick={handleNativeShare}
                  disabled={isSharing}
                >
                  <Share2 className="h-5 w-5 text-blue-600" />
                  <span>Partager...</span>
                </Button>
              )}

              {/* WhatsApp */}
              <Button
                variant="outline"
                className="w-full justify-start gap-2 h-12"
                onClick={handleWhatsApp}
              >
                <MessageCircle className="h-5 w-5 text-green-600" />
                <span>WhatsApp</span>
              </Button>

              {/* SMS (mobile uniquement) */}
              {isMobile() && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 h-12"
                  onClick={handleSMS}
                >
                  <Smartphone className="h-5 w-5 text-blue-500" />
                  <span>SMS</span>
                </Button>
              )}

              {/* Email */}
              <Button
                variant="outline"
                className="w-full justify-start gap-2 h-12"
                onClick={handleEmail}
              >
                <Mail className="h-5 w-5 text-orange-600" />
                <span>Email</span>
              </Button>

              {/* QR Code */}
              <Button
                variant={showQR ? "secondary" : "outline"}
                className="w-full justify-start gap-2 h-12"
                onClick={handleToggleQR}
              >
                <QrCode className="h-5 w-5 text-purple-600" />
                <span>QR Code</span>
              </Button>
            </div>
          </div>

          {/* QR Code (si affiché) */}
          {showQR && (
            <div className="flex flex-col items-center gap-3 p-4 bg-muted/30 rounded-lg border">
              <img
                src={qrCodeUrl}
                alt="QR Code du lien"
                className="w-48 h-48 rounded-lg shadow-sm"
              />
              <p className="text-xs text-muted-foreground text-center">
                Scannez ce QR code avec un téléphone pour ouvrir le lien
              </p>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="gap-2"
              >
                <a href={qrCodeUrl} download="qr-reservation.png" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Télécharger le QR
                </a>
              </Button>
            </div>
          )}

          {/* Instructions pour mobile */}
          {isMobile() && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                💡 <strong>Astuce mobile :</strong> Utilisez le bouton "Partager..." pour envoyer directement le lien vers une application (Airbnb, Notes, etc.)
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareModal;

