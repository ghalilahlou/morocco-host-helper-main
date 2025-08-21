import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageCircle, Phone, Mail } from 'lucide-react';
interface ContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
export const ContactModal: React.FC<ContactModalProps> = ({
  open,
  onOpenChange
}) => {
  const {
    toast
  } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'support',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Mock submission - will be replaced with Resend integration later
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: "Message envoyé !",
        description: "Nous vous répondrons dans les plus brefs délais."
      });

      // Reset form
      setFormData({
        name: '',
        email: '',
        subject: 'support',
        message: ''
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue. Veuillez réessayer.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-center flex items-center justify-center space-x-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            <span>Nous contacter</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contact Info */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20">
            <h3 className="font-semibold text-primary mb-3">Autres moyens de nous joindre</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-primary" />
                <span className="text-sm">benmouaz.pro@gmail.com</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-primary" />
                <span className="text-sm">+33 1 23 45 67 89</span>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom complet *</Label>
                <Input id="name" type="text" value={formData.name} onChange={e => handleInputChange('name', e.target.value)} required placeholder="Votre nom" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={formData.email} onChange={e => handleInputChange('email', e.target.value)} required placeholder="votre@email.com" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Sujet *</Label>
              <Select value={formData.subject} onValueChange={value => handleInputChange('subject', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisissez un sujet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="support">Support technique</SelectItem>
                  <SelectItem value="billing">Facturation</SelectItem>
                  <SelectItem value="feature">Demande de fonctionnalité</SelectItem>
                  <SelectItem value="bug">Signaler un bug</SelectItem>
                  <SelectItem value="partnership">Partenariat</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea id="message" value={formData.message} onChange={e => handleInputChange('message', e.target.value)} required placeholder="Décrivez votre demande en détail..." rows={5} />
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Annuler
              </Button>

              <Button type="submit" disabled={isSubmitting || !formData.name || !formData.email || !formData.message} className="flex-1">
                {isSubmitting ? "Envoi en cours..." : <span className="flex items-center space-x-2">
                    <Send className="w-4 h-4" />
                    <span>Envoyer le message</span>
                  </span>}
              </Button>
            </div>
          </form>

          {/* Response Time Info */}
          <div className="text-center text-sm text-muted-foreground">
            <p>💬 Temps de réponse habituel : 4-6 heures en jours ouvrés</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>;
};
