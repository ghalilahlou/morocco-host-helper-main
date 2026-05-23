# ✅ SOLUTION - Afficher Signature Guest dans Fiche de Police

## 📊 Situation Actuelle

✅ **Code existant**: Le code pour afficher la signature du guest dans la fiche de police **existe déjà**!
- Récupération: lignes 1676-1733
- Affichage: lignes 5818-5887

## 🔍 Diagnostic À Faire

### Étape 1: Déployer le Code Modifié

```powershell
cd c:\Users\ghali\Videos\morocco-host-helper-main-main
supabase functions deploy submit-guest-info-unified
```

### Étape 2: Régénérer la Fiche de Police

```sql
-- 1. Supprimer l'ancienne fiche
DELETE FROM uploaded_documents 
WHERE booking_id = '08b873d5-b584-4881-aa16-0cd8a18f214a' 
  AND document_type = 'police';

-- 2. Régénérer via interface ou API
```

### Étape 3: Vérifier les Logs dans Supabase

Chercher dans **Supabase Dashboard → Edge Functions → Logs**:

```
🔍 [POLICE] DIAGNOSTIC COMPLET AVANT GÉNÉRATION:
  hasGuestSignature: true/false  ← IMPORTANT!
  guestSignatureLength: XXX
  guestSignaturePreview: data:image/png;base64,... ← Doit commencer comme ça
  guestSignatureFormat: BASE64_IMAGE ← Doit être ça
```

ET

```
[Police] 🔍 Vérification signature guest pour PDF:
  hasGuestSignatureData: true/false
  startsWithDataImage: true/false
```

ET

```
[Police] ✅ Signature guest intégrée
OU
[Police] ❌ Erreur signature guest: ...
```

---

## 🎯 Scénarios Possibles

### Scénario A: `hasGuestSignature: false`

❌ **Problème**: La signature n'est pas récupérée de `contract_signatures`

**Solution**: Vérifier que la signature existe:
```sql
SELECT signature_data, LENGTH(signature_data) as len
FROM contract_signatures
WHERE booking_id = '08b873d5-b584-4881-aa16-0cd8a18f214a';
```

Si vide → Le guest n'a jamais signé le contrat

### Scénario B: `hasGuestSignature: true` MAIS `startsWithDataImage: false`

❌ **Problème**: Format de signature invalide

**Solution**: La signature dans la DB n'est pas au format `data:image/...`

### Scénario C: `hasGuestSignature: true` ET `startsWithDataImage: true` MAIS erreur après

❌ **Problème**: Erreur lors de l'embedding de l'image

**Solution**: Vérifier le message d'erreur dans les logs

### Scénario D: Tout OK dans les logs MAIS signature invisible dans le PDF

❌ **Problème**: Positionnement hors de la page

**Solution**: Modifier les coordonnées Y (ligne 5860)

---

##  Prochaines Étapes

1. **Déployer** le code modifié
2. **Régénérer** la fiche de police
3. **Copier** les logs et me les envoyer
4. J'analyserai et donnerai la solution exacte

---

## 🔧 Si Besoin de Créer une Signature Test

Si aucune signature n'existe dans `contract_signatures`:

```sql
-- Insérer une signature test pour le booking
INSERT INTO contract_signatures (
  booking_id,
  signature_data,
  signer_name,
  signer_email,
  signed_at
)
VALUES (
  '08b873d5-b584-4881-aa16-0cd8a18f214a',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC',
  'MOUHCINE TEMSAMANI',
  'ghalilahlou24@gmail.com',
  NOW()
);
```

Puis régénérer.

---

**Date**: 2026-01-12 13:49
**Statut**: Code modifié, prêt à tester
