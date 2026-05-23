# Solution Finale - Correction du problème de Dialog

## Problème
L'erreur `NotFoundError: Failed to execute 'removeChild'` se produit car Radix Dialog crée un portal qui tente de se démonter après que le nœud DOM parent ait déjà été supprimé.

## Solution Alternative - Utiliser un Portal Externe

Si le problème persiste après avoir vidé le cache, voici une solution alternative qui utilise un portal externe pour les Dialogs :

### 1. Créer un composant DialogWrapper séparé

```tsx
// src/components/DialogWrapper.tsx
import { createPortal } from 'react-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export const DialogWrapper = ({ 
  open, 
  onOpenChange, 
  children 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  children: React.ReactNode;
}) => {
  if (!open) return null;
  
  const portalRoot = document.getElementById('dialog-portal') || document.body;
  
  return createPortal(
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>,
    portalRoot
  );
};
```

### 2. Ajouter un div portal dans index.html

```html
<div id="dialog-portal"></div>
```

### 3. Utiliser le wrapper dans DocumentUploadStep

```tsx
import { DialogWrapper } from '@/components/DialogWrapper';

// Dans le JSX
{showPreview && (
  <DialogWrapper
    open={!!showPreview}
    onOpenChange={(open) => !open && setShowPreview(null)}
  >
    <DialogContent>
      {/* contenu */}
    </DialogContent>
  </DialogWrapper>
)}
```

## Solution Immédiate - Vider le Cache

1. Arrêter le serveur de développement
2. Supprimer le cache Vite : `rm -rf node_modules/.vite` (ou `Remove-Item -Recurse -Force node_modules\.vite` sur Windows)
3. Redémarrer : `npm run dev`
4. Vider le cache du navigateur (Ctrl+Shift+Delete)
5. Tester à nouveau

## Vérification que l'Edge Function est appelée

Pour vérifier que l'appel à l'Edge Function fonctionne :

1. Ouvrir la console du navigateur
2. Chercher les logs : `🚀 [HOST WORKFLOW] Invocation Edge Function...`
3. Vérifier les logs Supabase Edge Functions dans le dashboard
4. Si aucun log n'apparaît, vérifier :
   - Que `bookingData.id` existe
   - Que `guestInfo` est bien formé
   - Que `idDocuments` contient au moins un document
   - Que l'appel ne crash pas avant d'atteindre cette ligne

## Debug Step-by-Step

1. **Vérifier que le wizard ne crash pas avant la soumission**
   - Ajouter `console.log('🔍 [DEBUG] Avant handleSubmit')` au début de `handleSubmit`
   - Si ce log n'apparaît pas, le problème est dans la validation des étapes

2. **Vérifier que la création du booking fonctionne**
   - Chercher les logs : `✅ [DIAGNOSTIC] Booking créé avec succès`
   - Si ce log n'apparaît pas, le problème est dans l'insertion en base

3. **Vérifier que l'appel Edge Function est fait**
   - Chercher les logs : `📤 [HOST WORKFLOW] Appel submit-guest-info-unified...`
   - Si ce log n'apparaît pas, le problème est dans le workflow host

4. **Vérifier la réponse de l'Edge Function**
   - Chercher les logs : `⏱️ [HOST WORKFLOW] Edge Function répondue en Xms`
   - Si ce log n'apparaît pas, l'appel a échoué ou timeout


