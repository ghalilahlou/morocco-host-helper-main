# 🔧 PLAN DE CORRECTION - FRONTEND & BACKEND

## 📊 AUDIT COMPLET

### ❌ PROBLÈMES IDENTIFIÉS

#### 1. **Edge Function Name Mismatch**
- **Problème** : Frontend appelle `save-contract-signature` mais la fonction s'appelle `save-contract-signature-final`
- **Impact** : 404 Error, fonction non trouvée
- **Solution** : Renommer ou créer un alias

#### 2. **RPC Function Return Type**
- **Problème** : `check_contract_signature` retourne TABLE au lieu d'un JSON array
- **Impact** : Frontend ne peut pas accéder à `signature[0].signature_data`
- **Solution** : Modifier le RPC pour retourner JSON

#### 3. **Edge Function Response Format**
- **Problème** : Inconsistance entre `documentUrl` (singular) et `documentUrls` (plural)
- **Impact** : Frontend ne trouve pas les données
- **Solution** : Standardiser le format de response

#### 4. **Services Duplicated**
- **Problème** : `ApiService` et `ApiServiceStandardized` font la même chose
- **Impact** : Confusion et code dupliqué
- **Solution** : Utiliser un seul service

## 🛠️ CORRECTIONS À APPLIQUER

### ✅ CORRECTION 1 : Rename Edge Function
```bash
# Renommer save-contract-signature-final → save-contract-signature
```

### ✅ CORRECTION 2 : Fix RPC Function
```sql
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
            'signed_at', cs.signed_at,
            'booking_id', cs.booking_id
        )
    )
    INTO result
    FROM contract_signatures cs
    INNER JOIN guest_submissions gs ON cs.booking_id = gs.booking_data->>'id'::uuid
    WHERE gs.id = p_submission_id;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;
```

### ✅ CORRECTION 3 : Standardize Edge Function Response
```typescript
// Dans generate-contract/index.ts
return new Response(JSON.stringify({
  documentUrl: dataUrl,  // Toujours singular
  documentUrls: [dataUrl], // Aussi plural pour rétrocompatibilité
  // ...
}), { ... });
```

### ✅ CORRECTION 4 : Unified Service
```typescript
// Utiliser seulement ApiService, supprimer ApiServiceStandardized
```

## 📋 ORDRE D'EXÉCUTION

1. **Renommer Edge Function** : `save-contract-signature-final` → `save-contract-signature`
2. **Corriger RPC Function** : `check_contract_signature` pour retourner JSON
3. **Standardiser Response Format** dans toutes les edge functions
4. **Nettoyer Services** : Supprimer duplication
5. **Tester Integration** : Frontend → Edge Functions → Database

## 🎯 RÉSULTAT ATTENDU

- ✅ Frontend peut appeler `save-contract-signature` avec succès
- ✅ RPC `check_contract_signature` retourne des données utilisables
- ✅ Toutes les edge functions ont un format de response cohérent
- ✅ Un seul service API unifié
- ✅ Application fonctionnelle de bout en bout
