/**
 * 📱 UTILITAIRES DE PARTAGE MOBILE
 * Solutions alternatives au copier-coller sur mobile
 * 
 * - Web Share API : Partage natif vers toutes les apps
 * - WhatsApp Direct : Ouvre WhatsApp avec message pré-rempli
 * - SMS : Ouvre l'app SMS avec le lien
 * - Email : Ouvre l'app email avec le lien
 * - QR Code : Génère un QR code (via API externe)
 */

/**
 * Détecte si le navigateur supporte le Web Share API
 * Note: Sur Android Chrome, navigator.canShare peut ne pas exister
 * même si navigator.share fonctionne
 */
export const canShare = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.share !== 'function') return false;
  
  // Sur iOS Safari et Android Chrome moderne, share() est supporté
  // canShare() n'est pas toujours disponible mais share() peut fonctionner quand même
  return true;
};

/**
 * Détecte si on est sur mobile
 */
export const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Détecte si on est sur iOS
 */
export const isIOS = (): boolean => {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

/**
 * Détecte si on est sur Android
 */
export const isAndroid = (): boolean => {
  return /Android/i.test(navigator.userAgent);
};

/**
 * Interface pour les options de partage
 */
export interface ShareOptions {
  title?: string;
  text?: string;
  url: string;
  guestName?: string;
  propertyName?: string;
  checkIn?: string;
  checkOut?: string;
}

/**
 * Résultat d'une action de partage
 */
export interface ShareResult {
  success: boolean;
  method: 'webshare' | 'whatsapp' | 'sms' | 'email' | 'copy' | 'fallback';
  error?: string;
}

/**
 * 📱 SOLUTION 1 : Web Share API (Partage natif)
 * Ouvre le menu de partage natif du système (iOS/Android)
 * L'utilisateur peut choisir l'app de destination (Airbnb, WhatsApp, etc.)
 * 
 * Compatibilité:
 * - iOS Safari 12.2+ ✅
 * - Chrome Android 61+ ✅
 * - Samsung Internet ✅
 * - Firefox Android (partiel)
 */
export const shareNative = async (options: ShareOptions): Promise<ShareResult> => {
  const { title, text, url, guestName, propertyName, checkIn, checkOut } = options;
  
  // Construire le message de partage
  const shareTitle = title || `Lien de réservation${propertyName ? ` - ${propertyName}` : ''}`;
  let shareText = text || '';
  
  if (!shareText) {
    const parts = [];
    if (guestName) parts.push(`Pour: ${guestName}`);
    if (propertyName) parts.push(`Propriété: ${propertyName}`);
    if (checkIn && checkOut) parts.push(`Du ${checkIn} au ${checkOut}`);
    parts.push('Cliquez sur le lien pour compléter votre réservation:');
    shareText = parts.join('\n');
  }

  // Vérifier si Web Share est supporté
  if (!canShare()) {
    console.log('📱 [SHARE] Web Share API non supportée');
    return {
      success: false,
      method: 'webshare',
      error: 'Le partage natif n\'est pas supporté sur ce navigateur'
    };
  }

  try {
    // Android: Certaines versions ne supportent que url, pas text+url ensemble
    // On essaie d'abord avec tout, puis fallback sur url seul
    let shareData: ShareData = {
      title: shareTitle,
      text: shareText,
      url: url
    };

    // Vérifier si les données sont partageables (si canShare existe)
    if (navigator.canShare) {
      if (!navigator.canShare(shareData)) {
        // Fallback: essayer sans le text (certains Android)
        console.log('📱 [SHARE] Tentative avec URL seule (Android compatibility)');
        shareData = { title: shareTitle, url: url };
        
        if (!navigator.canShare(shareData)) {
          // Dernier fallback: juste l'URL
          shareData = { url: url };
        }
      }
    }

    console.log('📱 [SHARE] Données de partage:', shareData);
    console.log('📱 [SHARE] Plateforme:', isIOS() ? 'iOS' : isAndroid() ? 'Android' : 'Autre');
    
    await navigator.share(shareData);
    console.log('✅ [SHARE] Partage natif réussi');
    return { success: true, method: 'webshare' };
  } catch (error: any) {
    // AbortError = l'utilisateur a annulé (pas une erreur)
    if (error.name === 'AbortError') {
      console.log('📱 [SHARE] Partage annulé par l\'utilisateur');
      return { success: false, method: 'webshare', error: 'Partage annulé' };
    }
    
    // NotAllowedError = pas dans un contexte sécurisé ou pas déclenché par un geste utilisateur
    if (error.name === 'NotAllowedError') {
      console.warn('📱 [SHARE] NotAllowedError - contexte non autorisé');
      return {
        success: false,
        method: 'webshare',
        error: 'Partage non autorisé dans ce contexte'
      };
    }
    
    console.error('❌ [SHARE] Erreur Web Share:', error);
    return {
      success: false,
      method: 'webshare',
      error: error.message || 'Erreur lors du partage'
    };
  }
};

/**
 * 📱 SOLUTION 2 : WhatsApp Direct
 * Ouvre WhatsApp avec un message pré-rempli contenant le lien
 */
export const shareToWhatsApp = (options: ShareOptions): ShareResult => {
  const { url, guestName, propertyName, checkIn, checkOut } = options;
  
  // Construire le message WhatsApp
  const lines = ['🏠 *Lien de réservation*', ''];
  if (guestName) lines.push(`👤 Pour: ${guestName}`);
  if (propertyName) lines.push(`📍 ${propertyName}`);
  if (checkIn && checkOut) lines.push(`📅 Du ${checkIn} au ${checkOut}`);
  lines.push('', '👉 Cliquez ici pour compléter votre réservation:', url);
  
  const message = encodeURIComponent(lines.join('\n'));
  
  // Utiliser wa.me pour compatibilité maximale
  const whatsappUrl = `https://wa.me/?text=${message}`;
  
  try {
    window.open(whatsappUrl, '_blank');
    console.log('✅ [SHARE] WhatsApp ouvert');
    return { success: true, method: 'whatsapp' };
  } catch (error: any) {
    console.error('❌ [SHARE] Erreur WhatsApp:', error);
    return {
      success: false,
      method: 'whatsapp',
      error: error.message || 'Impossible d\'ouvrir WhatsApp'
    };
  }
};

/**
 * 📱 SOLUTION 3 : SMS
 * Ouvre l'app SMS avec le lien pré-rempli
 */
export const shareViaSMS = (options: ShareOptions, phoneNumber?: string): ShareResult => {
  const { url, guestName, propertyName } = options;
  
  // Construire le message SMS (plus court que WhatsApp)
  let message = `Lien de réservation`;
  if (propertyName) message += ` - ${propertyName}`;
  message += `: ${url}`;
  
  const encodedMessage = encodeURIComponent(message);
  
  // Format différent pour iOS vs Android
  let smsUrl: string;
  if (isIOS()) {
    // iOS utilise &body= 
    smsUrl = phoneNumber 
      ? `sms:${phoneNumber}&body=${encodedMessage}`
      : `sms:&body=${encodedMessage}`;
  } else {
    // Android utilise ?body=
    smsUrl = phoneNumber
      ? `sms:${phoneNumber}?body=${encodedMessage}`
      : `sms:?body=${encodedMessage}`;
  }
  
  try {
    window.location.href = smsUrl;
    console.log('✅ [SHARE] SMS ouvert');
    return { success: true, method: 'sms' };
  } catch (error: any) {
    console.error('❌ [SHARE] Erreur SMS:', error);
    return {
      success: false,
      method: 'sms',
      error: error.message || 'Impossible d\'ouvrir l\'app SMS'
    };
  }
};

/**
 * 📱 SOLUTION 4 : Email
 * Ouvre l'app email avec le lien pré-rempli
 */
export const shareViaEmail = (options: ShareOptions, recipientEmail?: string): ShareResult => {
  const { url, guestName, propertyName, checkIn, checkOut } = options;
  
  // Sujet de l'email
  const subject = encodeURIComponent(
    `Lien de réservation${propertyName ? ` - ${propertyName}` : ''}`
  );
  
  // Corps de l'email
  const bodyLines = ['Bonjour,', ''];
  bodyLines.push('Voici le lien pour compléter votre réservation:');
  bodyLines.push('');
  if (propertyName) bodyLines.push(`Propriété: ${propertyName}`);
  if (checkIn && checkOut) bodyLines.push(`Dates: du ${checkIn} au ${checkOut}`);
  bodyLines.push('');
  bodyLines.push(`Lien: ${url}`);
  bodyLines.push('');
  bodyLines.push('Cordialement');
  
  const body = encodeURIComponent(bodyLines.join('\n'));
  
  const mailtoUrl = recipientEmail
    ? `mailto:${recipientEmail}?subject=${subject}&body=${body}`
    : `mailto:?subject=${subject}&body=${body}`;
  
  try {
    window.location.href = mailtoUrl;
    console.log('✅ [SHARE] Email ouvert');
    return { success: true, method: 'email' };
  } catch (error: any) {
    console.error('❌ [SHARE] Erreur Email:', error);
    return {
      success: false,
      method: 'email',
      error: error.message || 'Impossible d\'ouvrir l\'app email'
    };
  }
};

/**
 * 📱 SOLUTION 5 : Générer URL de QR Code
 * Utilise l'API QR Server (gratuite, sans clé API)
 */
export const generateQRCodeUrl = (url: string, size: number = 200): string => {
  const encodedUrl = encodeURIComponent(url);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedUrl}&format=png&margin=10`;
};

/**
 * 📱 FONCTION PRINCIPALE : Afficher les options de partage
 * Retourne les méthodes de partage disponibles selon la plateforme
 */
export interface ShareMethod {
  id: string;
  label: string;
  icon: string; // Emoji ou nom d'icône
  available: boolean;
  action: () => Promise<ShareResult> | ShareResult;
}

export const getShareMethods = (options: ShareOptions): ShareMethod[] => {
  const methods: ShareMethod[] = [];
  
  // 1. Partage natif (Web Share API) - priorité sur mobile
  if (isMobile() && canShare()) {
    methods.push({
      id: 'native',
      label: 'Partager',
      icon: '📤',
      available: true,
      action: () => shareNative(options)
    });
  }
  
  // 2. WhatsApp - toujours disponible
  methods.push({
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: '💬',
    available: true,
    action: () => shareToWhatsApp(options)
  });
  
  // 3. SMS - seulement sur mobile
  if (isMobile()) {
    methods.push({
      id: 'sms',
      label: 'SMS',
      icon: '📱',
      available: true,
      action: () => shareViaSMS(options)
    });
  }
  
  // 4. Email - toujours disponible
  methods.push({
    id: 'email',
    label: 'Email',
    icon: '📧',
    available: true,
    action: () => shareViaEmail(options)
  });
  
  return methods;
};

