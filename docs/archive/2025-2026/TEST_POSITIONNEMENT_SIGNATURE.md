# 🧪 Test de Positionnement de la Signature (Mode Debug)

## 🎯 Objectif

Vérifier si la signature du loueur est **générée mais invisible** à cause d'un débordement vertical du PDF.

## 📝 Modification Effectuée

**Fichier**: `supabase/functions/submit-guest-info-unified/index.ts`  
**Ligne**: ~5729

**Changement**: La signature du loueur est maintenant positionnée **temporairement en HAUT de la page** au lieu d'en bas.

```typescript
// ✅ AVANT (position normale - en bas)
y: yPosition - finalHeight

// ✅ APRÈS (position test - en haut)
y: testYPosition  // En haut de la page (pageHeight - 100 - finalHeight)
```

---

## 🚀 Déploiement

### Option 1: Via Supabase CLI (Recommandé)

```powershell
# 1. Se placer dans le dossier du projet
cd c:\Users\ghali\Videos\morocco-host-helper-main-main

# 2. Déployer uniquement la fonction modifiée
supabase functions deploy submit-guest-info-unified

# 3. Attendre la confirmation
# ✅ Deployed Function submit-guest-info-unified with version xyz
```

### Option 2: Via Supabase Dashboard

1. Aller sur **Supabase Dashboard**: https://supabase.com/dashboard
2. Sélectionner votre projet
3. **Edge Functions** → `submit-guest-info-unified`
4. **Deploy new version**
5. Copier-coller le contenu du fichier `index.ts`
6. **Deploy**

---

## 🧪 Test

### Étape 1: Supprimer l'ancienne fiche de police

```sql
DELETE FROM uploaded_documents 
WHERE booking_id = '99b22159-ac08-4cc6-9cbf-251463ad0df6' 
  AND document_type = 'police';
```

### Étape 2: Régénérer la fiche de police

**Via API**:
```bash
POST https://csopyblkfyofwkeqqegd.supabase.co/functions/v1/submit-guest-info-unified

Headers:
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json

Body:
{
  "action": "regenerate_police",
  "bookingId": "99b22159-ac08-4cc6-9cbf-251463ad0df6"
}
```

**Via Dashboard Supabase** → Edge Functions → `submit-guest-info-unified` → **Invoke**

### Étape 3: Vérifier les Logs

Dans **Supabase Dashboard → Edge Functions → Logs**, chercher:

```
⚠️ TEST MODE: Signature du loueur positionnée EN HAUT de la page
  normalYPosition: XXX  (position qu'elle aurait en bas)
  testYPosition: YYY    (position actuelle en haut)
  positionDifference: ZZZ
```

**Points clés à observer**:

1. **normalYPosition < 0** → ❌ La signature débordait hors de la page!
2. **normalYPosition > 0** → ✅ La signature était dans la page (problème ailleurs)
3. **positionDifference > 500** → ⚠️ Grande différence, signature probablement hors page

### Étape 4: Télécharger et Vérifier le PDF

```sql
-- Récupérer l'URL du nouveau document
SELECT 
    document_url,
    created_at
FROM uploaded_documents 
WHERE booking_id = '99b22159-ac08-4cc6-9cbf-251463ad0df6'
  AND document_type = 'police'
ORDER BY created_at DESC
LIMIT 1;
```

**Ouvrir le PDF et vérifier**:
- ✅ La signature du loueur apparaît-elle **en HAUT à gauche** de la page?
- Si OUI → Le problème était bien le débordement vertical
- Si NON → Le problème est ailleurs (signature non générée, format invalide, etc.)

---

## 🎯 Interprétation des Résultats

### Scénario A: La signature apparaît EN HAUT ✅

**Conclusion**: La signature est bien générée mais le positionnement normal (en bas) la plaçait **hors de la zone visible**.

**Solution définitive**:
1. Réduire le contenu avant la section signatures
2. OU augmenter la taille de la page
3. OU déplacer la signatu à un meilleur endroit

**Prochaine étape**: 
- Revenir au positionnement normal mais ajouter une vérification de débordement
- Ajuster `yPosition` pour garantir que les signatures restent visibles

### Scénario B: La signature n'apparaît TOUJOURS PAS ❌

**Conclusion**: Le problème n'est PAS le positionnement mais plutôt:
- Signature manquante en BDD
- Format invalide (SVG au lieu de PNG/JPEG)
- Erreur lors de l'embedding de l'image
- Signature trop petite (126 caractères = test)

**Prochaine étape**:
1. Vérifier le contenu exact de `landlord_signature` en BDD
2. Créer une vraie signature avec `signature-creator.html`
3. Intégrer avec `scripts/ajouter-signature-vraie.sql`

---

## 🔧 Retour à la Normale

Une fois le test terminé, vous devrez **remettre le positionnement normal**:

```typescript
// Remplacer:
y: testYPosition

// Par:
y: yPosition - finalHeight
```

Puis redéployer: `supabase functions deploy submit-guest-info-unified`

---

## 📊 Diagnostic Complet

| Observation | Cause Probable | Solution |
|-------------|----------------|----------|
| Signature visible en haut | Débordement en bas | Ajuster positionnement |
| Signature toujours invisible | Signature manquante/invalide | Créer vraie signature |
| `normalYPosition < 0` dans logs | Contenu trop long | Réduire contenu du PDF |
| `sig_length: 126` en BDD | Signature test utilisée | Remplacer par vraie signature |

---

## 📝 Checklist

- [ ] Fonction modifiée et déployée
- [ ] Ancienne fiche de police supprimée
- [ ] Nouvelle fiche de police générée
- [ ] Logs vérifiés (TEST MODE message présent)
- [ ] PDF téléchargé et ouvert
- [ ] Résultat interprété
- [ ] Action suivante déterminée

---

**Date**: 2026-01-12  
**Version**: Test de débordement v1  
**Auteur**: Antigravity AI Assistant
