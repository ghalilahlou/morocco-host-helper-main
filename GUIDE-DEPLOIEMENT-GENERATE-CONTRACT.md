# Guide de Déploiement - generate-contract

## 🚨 **Problème Identifié**

La fonction `generate-contract` déployée utilise encore l'ancienne version avec des erreurs :
- `ReferenceError: validateRequiredFields is not defined`
- `ReferenceError: ERROR_CODES is not defined` 
- `ReferenceError: handleEdgeFunctionError is not defined`

## ✅ **Solution Appliquée**

Le fichier local `supabase/functions/generate-contract/index.ts` a été corrigé avec :
- ✅ Fonction `validateRequiredFields` définie
- ✅ Fonction `validateBookingId` définie
- ✅ Fonction `validateAction` définie
- ✅ Fonction `handleError` définie
- ✅ Headers CORS corrects
- ✅ Gestion d'erreurs complète

## 🚀 **Étapes de Déploiement**

### **1. Vérifier le Fichier Local**

```bash
# Vérifier que le fichier contient les fonctions corrigées
grep -n "validateRequiredFields" supabase/functions/generate-contract/index.ts
grep -n "handleError" supabase/functions/generate-contract/index.ts
```

**Résultat attendu :**
```
53:function validateRequiredFields(data: any, fields: string[]) {
168:function handleError(error: any, context: string) {
```

### **2. Redéployer la Fonction**

```bash
# Redéployer generate-contract
supabase functions deploy generate-contract
```

### **3. Vérifier le Déploiement**

```bash
# Vérifier que la fonction est déployée
supabase functions list
```

### **4. Tester la Fonction**

```javascript
// Test dans la console du navigateur
const testData = {
  bookingId: "YOUR_BOOKING_ID",
  action: "generate"
};

const response = await fetch('/functions/v1/generate-contract', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + (localStorage.getItem('supabase.auth.token') || 'your-token-here')
  },
  body: JSON.stringify(testData)
});

console.log('Statut:', response.status);
const result = await response.json();
console.log('Résultat:', result);
```

## 📊 **Vérification SQL**

```sql
-- Vérifier que les contrats sont générés
SELECT 
    'Contrats générés' as check_type,
    gd.id as contract_id,
    gd.booking_id,
    gd.document_type,
    gd.is_signed,
    gd.file_name,
    gd.created_at
FROM generated_documents gd
WHERE gd.document_type = 'contract'
ORDER BY gd.created_at DESC
LIMIT 5;
```

## 🔍 **Logs à Surveiller**

Après redéploiement, les logs devraient montrer :
- ✅ `🚀 generate-contract function started`
- ✅ `📝 Request data: { bookingId: "...", action: "generate" }`
- ✅ `📋 Fetching booking from database: ...`
- ✅ `✅ Booking fetched successfully`
- ✅ `📄 Contract content generated`
- ✅ `💾 Saving generated contract for booking: ...`
- ✅ `✅ Contract saved successfully: ...`
- ✅ `✅ Function completed successfully`

**Plus d'erreurs :**
- ❌ `ReferenceError: validateRequiredFields is not defined`
- ❌ `ReferenceError: ERROR_CODES is not defined`
- ❌ `ReferenceError: handleEdgeFunctionError is not defined`

## 🚨 **Problèmes Potentiels**

### **1. Cache de Déploiement**
Si le déploiement ne fonctionne pas :
```bash
# Forcer le redéploiement
supabase functions deploy generate-contract --no-verify-jwt
```

### **2. Version en Cache**
Si Supabase utilise encore l'ancienne version :
```bash
# Redémarrer les fonctions
supabase functions serve --no-verify-jwt
```

### **3. Vérifier les Variables d'Environnement**
```bash
# Vérifier que les variables sont définies
supabase secrets list
```

## ✅ **Résultats Attendus**

Après redéploiement réussi :
- ✅ **Contrats générés** : Enregistrés dans `generated_documents`
- ✅ **Pas d'erreurs** : Plus de `ReferenceError`
- ✅ **Headers CORS** : Fonction accessible depuis le frontend
- ✅ **Gestion d'erreurs** : Messages d'erreur clairs
- ✅ **Validation** : Paramètres validés correctement

## 🧪 **Test Complet**

```javascript
// Test complet du workflow
const testWorkflow = async () => {
  console.log('🧪 Test du workflow complet...');
  
  // 1. Tester generate-contract
  const contractResponse = await fetch('/functions/v1/generate-contract', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + (localStorage.getItem('supabase.auth.token') || 'your-token-here')
    },
    body: JSON.stringify({
      bookingId: "YOUR_BOOKING_ID",
      action: "generate"
    })
  });
  
  if (contractResponse.ok) {
    const contractResult = await contractResponse.json();
    console.log('✅ Contrat généré:', contractResult);
  } else {
    const error = await contractResponse.text();
    console.log('❌ Erreur contrat:', error);
  }
};

testWorkflow();
```

## 📞 **Support**

Si le problème persiste :
1. Vérifier les logs de déploiement
2. Redémarrer Supabase CLI
3. Vérifier la connectivité réseau
4. Contacter le support Supabase

---

**Note :** Ce guide doit être suivi après avoir corrigé le fichier local `generate-contract/index.ts`.
