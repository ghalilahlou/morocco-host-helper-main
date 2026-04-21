import type { Guest } from '@/types/booking';

/** URL complète du flux vérification invité (réservation classique, ex. `/v/{token}`). Définir dans `.env` : VITE_DEV_GUEST_VERIFICATION_URL=... */
export const DEV_GUEST_VERIFICATION_URL =
  (import.meta.env.VITE_DEV_GUEST_VERIFICATION_URL as string | undefined)?.trim() || '';

/** Données invité de démonstration (compléter le formulaire sans pièce réelle). */
export const DEV_PRESET_GUEST: Guest = {
  fullName: 'Invité démo',
  dateOfBirth: new Date(1990, 6, 15),
  nationality: 'FRANÇAIS',
  documentNumber: 'AB1234567',
  documentType: 'passport',
  documentIssueDate: new Date(2030, 11, 31),
  profession: 'Salarié',
  motifSejour: 'TOURISME',
  adressePersonnelle: '1 rue de démonstration, Paris',
  email: 'demo@example.com',
  placeOfBirth: 'Paris',
};
