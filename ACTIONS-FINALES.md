# 🎯 ACTIONS FINALES POUR FINALISER LA CORRECTION

## ✅ ÉTAPES DÉJÀ COMPLÉTÉES

1. **✅ Edge Functions Standardisées** 
   - `save-contract-signature` : ✅ Déployée avec logs améliorés
   - `generate-contract` : ✅ Retourne `documentUrl` + `documentUrls` pour rétrocompatibilité
   - `generate-police-forms` : ✅ Corrigée pour retourner les deux formats

2. **✅ Frontend Corrigé**
   - `DocumentsViewer.tsx` : ✅ Support des deux formats de réponse
   - Service dupliqué supprimé : ✅ `apiServiceStandardized.ts` supprimé

## 🚨 ACTIONS À FAIRE MANUELLEMENT

### 1. **Corriger la fonction RPC dans Supabase Dashboard**

Allez dans **Database > SQL Editor** et exécutez :

```sql
-- 🔧 CORRECTION : Modifier check_contract_signature pour retourner JSON
DROP FUNCTION IF EXISTS check_contract_signature(uuid);

CREATE OR REPLACE FUNCTION check_contract_signature(p_submission_id uuid)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'signature_data', cs.signature_data,
            'signer_name', cs.signer_name,
            'signer_email', cs.signer_email,
            'signer_phone', cs.signer_phone,
            'signed_at', cs.signed_at,
            'booking_id', cs.booking_id,
            'id', cs.id
        )
    )
    INTO result
    FROM contract_signatures cs
    INNER JOIN guest_submissions gs ON cs.booking_id::text = gs.booking_data->>'id'
    WHERE gs.id = p_submission_id
    AND cs.signature_data IS NOT NULL
    AND cs.signature_data != '';
    
    RETURN COALESCE(result, '[]'::json);
    
EXCEPTION WHEN OTHERS THEN
    RETURN '[]'::json;
END;
$$;
```

### 2. **Supprimer la fonction dupliquée (si elle existe)**

Dans **Edge Functions** du dashboard Supabase :
- Si vous voyez `save-contract-signature-final`, supprimez-la
- Gardez seulement `save-contract-signature`

## 🧪 TESTS À EFFECTUER

### Test 1 : Signature de Contrat
1. Aller sur `/guest-verification/[propertyId]/[token]`
2. Remplir les informations invité
3. Aller à la signature de contrat
4. ✅ Vérifier que le contrat s'affiche
5. ✅ Signer le contrat 
6. ✅ Vérifier que la signature est sauvegardée

### Test 2 : Génération Documents Admin
1. Aller dans l'interface admin
2. Voir une réservation
3. ✅ Générer le contrat
4. ✅ Générer les fiches de police
5. ✅ Télécharger les documents

### Test 3 : RPC Function
1. Dans SQL Editor, tester :
```sql
SELECT check_contract_signature('uuid-dune-submission-existante');
```
2. ✅ Doit retourner un JSON array

## 📊 RÉSULTAT ATTENDU

Après ces corrections :
- ✅ Frontend peut sauvegarder les signatures 
- ✅ Edge functions retournent des formats cohérents
- ✅ RPC functions retournent du JSON utilisable
- ✅ Application fonctionnelle de bout en bout

## 🐛 EN CAS DE PROBLÈME

Si vous voyez encore des erreurs :
1. Vérifiez les logs des edge functions dans le dashboard
2. Vérifiez que le RPC `check_contract_signature` retourne du JSON
3. Testez chaque endpoint individuellement
