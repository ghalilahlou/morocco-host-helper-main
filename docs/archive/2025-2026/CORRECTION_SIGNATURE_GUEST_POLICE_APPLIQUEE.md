# ✅ CORRECTION APPLIQUÉE : Signature Guest dans Fiche de Police

## 📋 **Résumé des Modifications**

La signature du guest apparaît maintenant dans les fiches de police PDF, à la fois pour les nouveaux documents et les documents existants.

---

## 🔧 **Modifications Apportées**

### **1. Fichier Principal** : `submit-guest-info-unified/index.ts`

#### **A. Récupération de la signature guest (ligne ~1636)**
```typescript
// ✅ NOUVEAU : Récupérer la signature du guest depuis contract_signatures
const { data: guestSignatureData, error: signatureError } = await supabaseClient
  .from('contract_signatures')
  .select('signature_data, signed_at, signer_name')
  .eq('booking_id', bookingId)
  .eq('signature_type', 'guest')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

const guestSignature = guestSignatureData?.signature_data || null;
const guestSignedAt = guestSignatureData?.signed_at || null;
```

#### **B. Passage de la signature à generatePoliceFormsPDF (ligne ~1938)**
```typescript
// ✅ NOUVEAU : Passer la signature du guest à la fonction de génération PDF
const policeUrl = await generatePoliceFormsPDF(
  supabaseClient, 
  booking, 
  false, 
  guestSignature, 
  guestSignedAt
);
```

#### **C. Modification de la signature de fonction (ligne ~5061)**
```typescript
async function generatePoliceFormsPDF(
  client: any, 
  booking: any, 
  isPreview: boolean = false,
  guestSignatureData?: string | null,  // ✅ NOUVEAU
  guestSignedAt?: string | null         // ✅ NOUVEAU
): Promise<string>
```

#### **D. Affichage de la signature dans le PDF (ligne ~5727)**
Ajout de 169 lignes de code pour :
- Afficher le label "Signature du locataire" (français + arabe)
- Embedder l'image de la signature (PNG ou JPEG)
- Positionner la signature à droite de la page
- Afficher la date de signature
- Gérer les fallbacks (ligne vide si pas de signature)

#### **E. Support du mode preview (ligne ~2844)**
Récupération de la signature pour le mode preview Dashboard

#### **F. Nouvelle action `regenerate_police_with_signature` (ligne ~2833)**
Permet de régénérer les fiches de police existantes avec les signatures

---

## 🚀 **Déploiement**

### **Étape 1 : Déployer la fonction modifiée**

```bash
cd c:\Users\ghali\Videos\morocco-host-helper-main-main
supabase functions deploy submit-guest-info-unified
```

**Résultat attendu :**
```
Deploying Function (project ref: votre-projet-id)
        Deploying ... submit-guest-info-unified (project: votre-projet-id)
        ✓ Deployed submit-guest-info-unified (version: xxxxx)
```

### **Étape 2 : Vérifier les logs**

```bash
supabase functions logs submit-guest-info-unified --follow
```

**Rechercher dans les logs :**
- `[Police] 🔍 Récupération signature du guest...`
- `[Police] 📝 Signature guest récupérée:`
- `[Police] 🎨 Embedding guest signature in police form...`
- `[Police] ✅ Guest signature embedée dans le PDF avec succès!`

---

## 🧪 **Tests**

### **Test 1 : Nouveau guest avec signature**

1. Soumettre un nouveau guest via le formulaire
2. Le guest signe le contrat
3. Vérifier que la fiche de police générée contient :
   - ✅ Signature du loueur (en bas à gauche)
   - ✅ Signature du guest (en bas à droite)

### **Test 2 : Régénérer une fiche existante**

Pour un booking qui a déjà une signature guest mais une fiche de police sans signature :

```bash
# Via cURL (remplacer BOOKING_ID et SUPABASE_ANON_KEY)
curl -X POST \
  https://VOTRE_PROJET.supabase.co/functions/v1/submit-guest-info-unified \
  -H "Authorization: Bearer VOTRE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "regenerate_police_with_signature",
    "bookingId": "BOOKING_ID"
  }'
```

**Résultat attendu :**
```json
{
  "success": true,
  "message": "Fiche de police régénérée avec signature guest",
  "policeUrl": "https://...",
  "hasGuestSignature": true
}
```

### **Test 3 : Vérifier visuellement le PDF**

1. Télécharger la fiche de police depuis le dashboard
2. Vérifier visuellement :
   - **En bas à gauche** : "Signature du loueur" + signature
   - **En bas à droite** : "Signature du locataire" + signature + date
   - **Texte arabe** : توقيع المستأجر (signature du locataire)

---

## 🔄 **Régénération en masse**

### **Étape 1 : Identifier les bookings à régénérer**

Exécuter le script SQL :
```sql
-- Voir: scripts/identify_police_forms_to_regenerate.sql
```

Ceci retourne la liste des `booking_id` nécessitant une régénération.

### **Étape 2 : Créer un script de régénération en masse**

```javascript
// regenerate-all-police-forms.js
const SUPABASE_URL = 'https://VOTRE_PROJET.supabase.co';
const SUPABASE_ANON_KEY = 'VOTRE_ANON_KEY';

// Liste des booking IDs (depuis la requête SQL)
const bookingIds = [
  'booking-id-1',
  'booking-id-2',
  // ... etc
];

async function regeneratePoliceForm(bookingId) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-guest-info-unified`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'regenerate_police_with_signature',
      bookingId: bookingId
    })
  });
  
  const result = await response.json();
  console.log(`Booking ${bookingId}:`, result.success ? '✅' : '❌', result.message || result.error);
  
  // Attendre 500ms entre chaque appel pour ne pas surcharger
  await new Promise(resolve => setTimeout(resolve, 500));
}

async function regenerateAll() {
  console.log(`Régénération de ${bookingIds.length} fiches de police...`);
  
  for (const bookingId of bookingIds) {
    await regeneratePoliceForm(bookingId);
  }
  
  console.log('✅ Régénération terminée!');
}

regenerateAll();
```

### **Étape 3 : Exécuter le script**

```bash
node regenerate-all-police-forms.js
```

---

## 📊 **Vérification Base de Données**

### **1. Vérifier les signatures guests**

```sql
-- Voir: scripts/check_guest_signature.sql
SELECT 
  cs.id,
  cs.booking_id,
  cs.signer_name,
  CASE WHEN cs.signature_data IS NOT NULL THEN 'OUI' ELSE 'NON' END as has_signature,
  LENGTH(cs.signature_data) as signature_length,
  cs.signed_at
FROM contract_signatures cs
WHERE cs.signature_type = 'guest'
  AND cs.created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY cs.created_at DESC
LIMIT 20;
```

### **2. Vérifier les fiches de police**

```sql
SELECT 
  b.id as booking_id,
  b.booking_reference,
  b.guest_name,
  COUNT(ud.id) as police_forms_count,
  MAX(ud.created_at) as last_police_generated
FROM bookings b
LEFT JOIN uploaded_documents ud ON ud.booking_id = b.id AND ud.document_type = 'police_form'
WHERE b.status IN ('confirmed', 'pending')
GROUP BY b.id, b.booking_reference, b.guest_name
ORDER BY last_police_generated DESC NULLS LAST
LIMIT 20;
```

---

## ✅ **Checklist de Validation**

### **Avant déploiement**
- [x] Code modifié et testé localement
- [x] Documentation créée
- [x] Scripts SQL créés
- [x] Script de régénération en masse préparé

### **Déploiement**
- [ ] Fonction déployée sur Supabase
- [ ] Logs vérifiés (pas d'erreurs)
- [ ] Test avec un nouveau guest
- [ ] Test avec régénération d'une fiche existante

### **Validation**
- [ ] PDF généré contient la signature guest
- [ ] PDF généré contient la signature loueur
- [ ] Position et taille des signatures correctes
- [ ] Date de signature affichée
- [ ] Texte arabe bien rendu

### **Régénération masse (si nécessaire)**
- [ ] Liste des bookings identifiée
- [ ] Script de régénération testé sur 1-2 bookings
- [ ] Régénération en masse exécutée
- [ ] Vérification visuelle de quelques PDFs

---

## 🐛 **Dépannage**

### **Problème : Signature ne s'affiche pas**

**Vérifier :**
1. La signature existe en base :
   ```sql
   SELECT signature_data FROM contract_signatures 
   WHERE booking_id = 'BOOKING_ID' AND signature_type = 'guest';
   ```

2. Les logs Supabase :
   ```
   [Police] 🔍 Récupération signature du guest...
   [Police] 📝 Signature guest récupérée: { hasSignature: true }
   ```

3. Format de la signature (doit commencer par `data:image/png;base64,` ou `data:image/jpeg;base64,`)

### **Problème : Erreur lors de la régénération**

**Vérifier les logs :**
```bash
supabase functions logs submit-guest-info-unified --follow
```

**Erreurs courantes :**
- `Booking non trouvé` → Vérifier que le booking_id existe
- `Format de signature non supporté` → Vérifier le format de signature_data
- `Erreur embedding signature` → Vérifier que signature_data est valide (base64)

---

## 📝 **Notes Importantes**

1. **Nouveaux documents** : Les fiches de police générées après le déploiement incluront automatiquement la signature guest (si elle existe)

2. **Documents existants** : Utilisez l'action `regenerate_police_with_signature` pour ajouter les signatures aux fiches déjà générées

3. **Fallback** : Si un guest n'a pas de signature, une ligne vide est affichée pour signature manuelle

4. **Performance** : La régénération en masse doit être faite avec un délai entre chaque appel (500ms recommandé)

5. **Compatibilité** : Le code supporte les formats PNG et JPEG pour les signatures

---

**Date de correction :** 2026-01-12  
**Version :** 1.0  
**Statut :** ✅ Prêt pour déploiement
