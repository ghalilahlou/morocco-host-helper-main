/**
 * 📱 HOOK POUR LE MODAL DE PARTAGE
 * Gère l'état du modal de partage de manière globale
 */

import { useState, useCallback } from 'react';
import { isMobile } from '@/lib/shareUtils';

export interface ShareModalData {
  url: string;
  guestName?: string;
  propertyName?: string;
  checkIn?: string;
  checkOut?: string;
}

export const useShareModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [shareData, setShareData] = useState<ShareModalData | null>(null);

  /**
   * Ouvre le modal de partage avec les données fournies
   * Sur mobile, affiche le modal
   * Sur desktop, retourne false (pour utiliser le copier classique)
   */
  const openShareModal = useCallback((data: ShareModalData): boolean => {
    // Sur mobile, ouvrir le modal de partage
    if (isMobile()) {
      setShareData(data);
      setIsOpen(true);
      return true;
    }
    
    // Sur desktop, ne pas ouvrir le modal
    return false;
  }, []);

  /**
   * Ferme le modal de partage
   */
  const closeShareModal = useCallback(() => {
    setIsOpen(false);
    // Conserver les données un moment pour l'animation de fermeture
    setTimeout(() => {
      setShareData(null);
    }, 300);
  }, []);

  return {
    isOpen,
    shareData,
    openShareModal,
    closeShareModal,
    isMobile: isMobile()
  };
};

export default useShareModal;

