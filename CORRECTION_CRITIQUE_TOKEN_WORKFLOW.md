# 🚨 Correction Critique - Workflow Bloqué (Token Dupliqué)

## ❌ **Problème Critique Identifié**

```
❌ Token invalide ou expiré: JSON object requested, multiple (or no) rows returned
```

### 🔍 **Cause**

L'Edge Function `submit-guest-info-unified` utilisait `.single()` pour récupérer le token :

```typescript
// ❌ AVANT : Échoue si plusieurs tokens identiques existent
const { data: tokenData, error: tokenError} = await supabase
  .from('property_verification_tokens')
  .select(...)
  .eq('token', token)
  .eq('is_active', true)
  .gt('expires_at', new Date().toISOString())
  .single(); // ❌ Échoue si multiple ou zero rows
```

**Problème** : Si plusieurs tokens identiques existent dans la base de données (à cause de clics multiples ou de re-génération), `.single()` échoue avec l'erreur "multiple rows returned".

---

## ✅ **Solution Appliquée**

**Fichier modifié :** `supabase/functions/submit-guest-info-unified/index.ts`

### Changement 1 : Utiliser `.maybeSingle()` + Tri par Date

```typescript
// ✅ APRÈS : Prend le token le plus récent si plusieurs existent
const { data: tokenData, error: tokenError } = await supabase
  .from('property_verification_tokens')
  .select(...)
  .eq('token', token)
  .eq('is_active', true)
  .gt('expires_at', new Date().toISOString())
  .order('created_at', { ascending: false }) // ✅ Tri par date décroissante
  .limit(1) // ✅ Prendre seulement le plus récent
  .maybeSingle(); // ✅ Retourne null si aucun, data si 1, data si plusieurs (après limit)
```

**Avantages :**
- ✅ Si **1 token** : Fonctionne normalement
- ✅ Si **plusieurs tokens** : Prend le **plus récent** automatiquement
- ✅ Si **0 token** : Retourne `null` proprement (pas d'erreur)

### Changement 2 : Toutes les Validations de Token Corrigées

**4 occurrences corrigées** dans le même fichier :
1. Ligne ~309 : `validatePropertyToken()` - Validation normale
2. Ligne ~459 : `resolveBookingOnlyInternal()` - Résolution de booking
3. Ligne ~582 : `createBookingFromIcsReservation()` - Création depuis ICS
4. Ligne ~1668 : `validatePropertyTokenIndependent()` - Validation indépendante

**Toutes utilisent maintenant** :
```typescript
.order('created_at', { ascending: false })
.limit(1)
.maybeSingle()
```

---

## 📊 **Résultat Attendu**

### ✅ Logs de Succès

```
🔍 Validation directe du token: {token: "UcCeaPN6..."}
✅ Token validé avec succès
🚀 Utilisation du workflow unifié...
📤 Envoi au serveur: {...}
✅ Documents générés avec succès !
```

### ❌ Ce qui NE devrait PLUS apparaître

```
❌ Token invalide ou expiré: JSON object requested, multiple (or no) rows returned
```

---

## 🧪 **Tests à Effectuer**

### Test 1 : Upload Document + Signature (ICS Direct Link)

1. Cliquer sur "Générer lien" depuis une réservation ICS
2. Ouvrir le lien dans le navigateur
3. Uploader un document d'identité
4. ✅ Vérifier : **Aucune erreur** "Token invalide"
5. ✅ Le workflow doit continuer vers la signature

### Test 2 : Génération Multiple de Liens (Test Tokens Dupliqués)

1. Cliquer **3 fois rapidement** sur "Générer lien"
2. Ouvrir le lien généré
3. Uploader un document
4. ✅ Vérifier : Le workflow fonctionne malgré les tokens multiples

### Test 3 : Workflow Complet

1. Upload document → Extraction OpenAI réussie
2. Signature sur le canvas → Signature capturée
3. Soumission → ✅ **Contrat généré + Police générée**
4. Redirection vers page de signature → ✅ **Signature du contrat**

---

## 📋 **Récapitulatif des Fichiers Modifiés**

### 1. `supabase/functions/submit-guest-info-unified/index.ts`
- **Lignes ~309, 459, 582, 1668** : Toutes les validations de token corrigées
- **Changement** : `.single()` → `.order().limit(1).maybeSingle()`
- **Impact** : ✅ Plus d'erreur "multiple rows returned"

---

## 🎯 **Résultat Final**

| Avant | Après |
|-------|-------|
| ❌ Workflow bloqué si tokens dupliqués | ✅ Prend automatiquement le plus récent |
| ❌ Erreur "multiple rows returned" | ✅ Aucune erreur, workflow fluide |
| ❌ Impossible d'uploader document | ✅ Upload + signature + contrat fonctionnent |

---

## 🚀 **Action Immédiate**

**Testez maintenant le workflow complet :**

1. Générer un lien ICS
2. Uploader un document d'identité
3. Vérifier que **AUCUNE erreur "Token invalide"** n'apparaît
4. Compléter le workflow jusqu'à la signature du contrat

**Résultat attendu** : ✅ **Workflow 100% fonctionnel** ! 🎉

---

## 📝 **Logs Attendus (Succès)**

```
🔍 Validation directe du token: {token: "UcCeaPN6..."}
✅ Token validé avec succès
🤖 Starting OpenAI-powered document extraction...
✅ Successfully extracted data via OpenAI
🚀 Utilisation du workflow unifié...
📤 Envoi au serveur...
✅ [DocumentServiceUnified] Unified submission successful !
✅ Documents générés avec succès !
🎉 Navigation vers page de signature...
```

**Plus aucune erreur "Token invalide" ! ✅**

