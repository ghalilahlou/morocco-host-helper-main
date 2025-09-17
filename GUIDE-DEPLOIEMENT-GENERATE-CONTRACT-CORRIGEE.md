# Guide de Déploiement - Fonction generate-contract Corrigée

## ✅ Statut de la Correction

La fonction `generate-contract` a été **complètement corrigée** et toutes les erreurs `ReferenceError` ont été résolues :

### 🔧 Corrections Apportées

1. **✅ Fonctions manquantes ajoutées :**
   - `validateRequiredFields()`
   - `validateBookingId()`
   - `validateAction()`
   - `handleEdgeFunctionError()`

2. **✅ Constantes définies :**
   - `ERROR_CODES` avec tous les codes d'erreur

3. **✅ Headers CORS ajoutés :**
   - `Access-Control-Allow-Origin: *`
   - `Access-Control-Allow-Headers`
   - `Access-Control-Allow-Methods`

4. **✅ Gestion d'erreur standardisée :**
   - Fonction `handleEdgeFunctionError()` complète
   - Réponses d'erreur cohérentes

## 🚀 Déploiement

### Étape 1: Vérifier le Fichier
```bash
# Vérifier que le fichier corrigé existe
ls -la supabase/functions/generate-contract/index.ts

# Vérifier le contenu (optionnel)
head -20 supabase/functions/generate-contract/index.ts
```

### Étape 2: Déployer la Fonction
```bash
# Déployer la fonction corrigée
supabase functions deploy generate-contract

# Ou si vous voulez forcer le déploiement
supabase functions deploy generate-contract --no-verify-jwt
```

### Étape 3: Vérifier le Déploiement
```bash
# Lister les fonctions déployées
supabase functions list

# Vérifier les logs de déploiement
supabase functions logs generate-contract --follow
```

## 🧪 Test de la Fonction Corrigée

### Test 1: Génération de Contrat
```bash
# Test avec un booking_id valide
curl -X POST 'https://csopyblkfyofwkeqqegd.supabase.co/functions/v1/generate-contract' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "bookingId": "VOTRE_BOOKING_ID",
    "action": "generate"
  }'
```

### Test 2: Signature de Contrat
```bash
# Test de signature
curl -X POST 'https://csopyblkfyofwkeqqegd.supabase.co/functions/v1/generate-contract' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "bookingId": "VOTRE_BOOKING_ID",
    "action": "sign",
    "signatureData": "data:image/png;base64,..."
  }'
```

## 📊 Vérification des Logs

### Logs Attendus (Succès)
```
🚀 generate-contract function started
📥 Request data: { bookingId: "...", action: "generate" }
🔍 Fetching booking from database: ...
✅ Booking found: { id: "...", property: "..." }
📄 Generating contract...
📄 Creating contract PDF...
✅ Contract generated successfully
```

### Logs d'Erreur (Problèmes)
```
❌ Validation error: Missing required field: bookingId
❌ Booking query error: ...
❌ Error in generate-contract: ...
```

## 🔍 Diagnostic des Problèmes

### Problème 1: Erreur 401 Unauthorized
**Cause :** Headers d'authentification manquants
**Solution :** Vérifier que `Authorization` et `apikey` sont présents

### Problème 2: Erreur 404 Booking Not Found
**Cause :** `bookingId` invalide ou inexistant
**Solution :** Vérifier que le `bookingId` existe dans la table `bookings`

### Problème 3: Erreur 500 Internal Server Error
**Cause :** Erreur dans la logique de la fonction
**Solution :** Vérifier les logs détaillés pour identifier l'erreur

## 📋 Checklist de Déploiement

- [ ] Fichier `index.ts` corrigé et testé
- [ ] Fonction déployée avec succès
- [ ] Logs de déploiement vérifiés
- [ ] Test de génération de contrat réussi
- [ ] Test de signature de contrat réussi
- [ ] Vérification des headers CORS
- [ ] Test avec différents `bookingId`

## 🎯 Résultats Attendus

Après le déploiement, vous devriez voir :

1. **✅ Plus d'erreurs `ReferenceError`**
2. **✅ Génération de contrats fonctionnelle**
3. **✅ Signatures de contrats fonctionnelles**
4. **✅ Headers CORS corrects**
5. **✅ Gestion d'erreur standardisée**

## 🚨 En Cas de Problème

Si vous rencontrez encore des erreurs :

1. **Vérifiez les logs :**
   ```bash
   supabase functions logs generate-contract --follow
   ```

2. **Testez localement :**
   ```bash
   supabase functions serve generate-contract
   ```

3. **Vérifiez la configuration :**
   ```bash
   supabase status
   ```

4. **Redéployez si nécessaire :**
   ```bash
   supabase functions deploy generate-contract --no-verify-jwt
   ```

## 📞 Support

Si vous avez besoin d'aide supplémentaire, fournissez :
- Les logs d'erreur complets
- Le `bookingId` utilisé pour le test
- La réponse de la fonction
- Les headers de la requête

