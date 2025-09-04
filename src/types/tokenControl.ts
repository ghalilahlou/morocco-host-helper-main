// Types pour le système de contrôle des tokens

export type TokenControlType = 'blocked' | 'limited' | 'unlimited';

export interface TokenControlSettings {
  id: string;
  property_id: string;
  is_enabled: boolean;
  max_reservations: number | null;
  current_reservations: number;
  control_type: TokenControlType;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface TokenControlResponse {
  allowed: boolean;
  reason?: string;
  remaining_reservations?: number;
  control_type: TokenControlType;
}

export interface TokenControlFormData {
  property_id: string;
  control_type: TokenControlType;
  max_reservations?: number;
  is_enabled: boolean;
}

// Options de contrôle pour l'interface admin
export const TOKEN_CONTROL_OPTIONS = [
  {
    value: 'blocked' as TokenControlType,
    label: 'Bloqué',
    description: 'Aucun token ne peut être généré pour cette propriété',
    icon: '🚫',
    color: 'destructive'
  },
  {
    value: 'limited' as TokenControlType,
    label: 'Limité',
    description: 'Nombre limité de tokens peuvent être générés',
    icon: '🔢',
    color: 'warning'
  },
  {
    value: 'unlimited' as TokenControlType,
    label: 'Illimité',
    description: 'Tokens illimités pour cette propriété',
    icon: '♾️',
    color: 'success'
  }
] as const;

// Messages d'erreur pour chaque type de contrôle
export const TOKEN_CONTROL_MESSAGES = {
  blocked: {
    title: 'Génération de tokens bloquée',
    description: 'L\'administrateur a bloqué la génération de tokens pour cette propriété.',
    action: 'Contactez l\'administrateur pour plus d\'informations.'
  },
  limited: {
    title: 'Limite de tokens atteinte',
    description: 'Le nombre maximum de tokens autorisés pour cette propriété a été atteint.',
    action: 'Contactez l\'administrateur pour augmenter la limite.'
  },
  unlimited: {
    title: 'Tokens autorisés',
    description: 'La génération de tokens est autorisée pour cette propriété.',
    action: 'Vous pouvez générer des tokens normalement.'
  }
} as const;
