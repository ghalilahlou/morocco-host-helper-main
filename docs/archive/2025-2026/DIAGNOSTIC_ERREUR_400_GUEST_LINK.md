# 🔍 DIAGNOSTIC - Erreur 400 sur issue-guest-link

## ❌ Problème Identifié

**Erreur :** `POST https://csopyblkfyofwkeqqegd.supabase.co/functions/v1/issue-guest-link 400 (Bad Request)`

**Localisation :** `src/pages/GuestVerification.tsx` ligne 522

**Cause :** L'appel à la fonction Edge `issue-guest-link` avec l'action `resolve` reçoit des données invalides ou incomplètes.

---

## 📋 Code Actuel (Ligne 522-528)

```typescript
// Fallback : Vérifier le token si pas de paramètres d'URL
const { data, error } = await supabase.functions.invoke('issue-guest-link', {
  body: {
    action: 'resolve',
    propertyId,
    token
  }
});
```

---

## 🔍 Analyse de l'Edge Function

L'Edge Function `issue-guest-link` attend :

### Pour l'action 'issue' :
- ✅ `propertyId` (string, requis)
- `bookingId` (string, optionnel)
- `airbnbCode` (string, optionnel)
- `expiresIn` (number, optionnel)
- `linkType` (string, optionnel)
- `reservationData` (object, optionnel)

### Pour l'action 'resolve' :
- ✅ `action: 'resolve'` (string, requis)
- ✅ `token` (string, requis)
- `propertyId` (string, optionnel)
- `airbnbCode` (string, optionnel)

---

## ⚠️ Problèmes Potentiels

1. **propertyId ou token vide/undefined**
   - Si `propertyId` ou `token` est `undefined`, l'Edge Function retourne 400

2. **Format de token invalide**
   - Le token doit être une chaîne valide

3. **Token expiré ou inexistant**
   - Si le token n'existe pas en base, erreur 400

---

## 🔧 Solution 1 : Ajouter Validation Avant l'Appel

**Fichier :** `src/pages/GuestVerification.tsx`  
**Ligne :** 520-533

**Modification :**

```typescript
// Fallback : Vérifier le token si pas de paramètres d'URL
// ✅ VALIDATION : Vérifier que propertyId et token sont valides
if (!propertyId || !token) {
  console.error('❌ propertyId ou token manquant:', { propertyId, token });
  return;
}

console.log('🔍 Appel issue-guest-link avec:', { propertyId, token });

const { data, error } = await supabase.functions.invoke('issue-guest-link', {
  body: {
    action: 'resolve',
    propertyId,
    token
  }
});

if (error) {
  console.error('❌ Erreur lors de la vérification du token:', error);
  // ✅ NOUVEAU : Logger les détails de l'erreur
  console.error('Détails erreur:', {
    message: error.message,
    status: error.status,
    statusText: error.statusText
  });
  return;
}
```

---

## 🔧 Solution 2 : Vérifier l'Edge Function

L'Edge Function peut retourner 400 si :

1. **Validation échoue** (lignes 198-234 de `issue-guest-link/index.ts`)
   - `propertyId` n'est pas une string
   - `propertyId` est vide

2. **Token invalide** (fonction `handleResolve`)
   - Token n'existe pas en base
   - Token expiré
   - Token désactivé

---

## 🎯 Actions Recommandées

### Action 1 : Vérifier les Logs Console

**Dans la console du navigateur, chercher :**
```
🔍 Appel issue-guest-link avec: { propertyId: "...", token: "..." }
```

**Vérifier que :**
- `propertyId` n'est pas `undefined` ou `null`
- `token` n'est pas `undefined` ou `null`

### Action 2 : Vérifier les Logs Supabase

**Dans Supabase Dashboard :**
1. Aller dans "Edge Functions"
2. Cliquer sur "issue-guest-link"
3. Voir les logs récents
4. Chercher l'erreur exacte

**Logs attendus :**
```
❌ Missing or invalid propertyId: undefined
```
OU
```
❌ Token not found or expired
```

### Action 3 : Tester avec des Valeurs Hardcodées

**Temporairement, tester avec :**
```typescript
console.log('🧪 TEST - Valeurs reçues:', { propertyId, token });

// Test avec valeurs hardcodées
const testPropertyId = propertyId || 'test-property-id';
const testToken = token || 'test-token';

const { data, error } = await supabase.functions.invoke('issue-guest-link', {
  body: {
    action: 'resolve',
    propertyId: testPropertyId,
    token: testToken
  }
});
```

---

## 📊 Diagnostic Complet

### Étape 1 : Vérifier les Paramètres URL

**Ouvrir la console et taper :**
```javascript
const urlParams = new URLSearchParams(window.location.search);
console.log('propertyId:', urlParams.get('propertyId'));
console.log('token:', urlParams.get('token'));
```

### Étape 2 : Vérifier le State React

**Dans le composant, ajouter :**
```typescript
useEffect(() => {
  console.log('🔍 State actuel:', { propertyId, token, isValidToken });
}, [propertyId, token, isValidToken]);
```

### Étape 3 : Vérifier la Base de Données

**Dans Supabase SQL Editor :**
```sql
SELECT 
  id,
  token,
  property_id,
  is_active,
  expires_at,
  created_at
FROM property_verification_tokens
WHERE token = 'VOTRE_TOKEN_ICI'
  AND property_id = 'VOTRE_PROPERTY_ID_ICI';
```

---

## 🚀 Correction Rapide

**Appliquer cette modification maintenant :**

```typescript
// Ligne 520-533 dans GuestVerification.tsx
// Fallback : Vérifier le token si pas de paramètres d'URL
if (!propertyId || !token) {
  console.error('❌ [ICS] propertyId ou token manquant, abandon');
  return;
}

try {
  console.log('🔍 [ICS] Appel issue-guest-link resolve:', { propertyId, token: token.substring(0, 8) + '...' });
  
  const { data, error } = await supabase.functions.invoke('issue-guest-link', {
    body: {
      action: 'resolve',
      propertyId,
      token
    }
  });

  if (error) {
    console.error('❌ [ICS] Erreur issue-guest-link:', {
      message: error.message,
      details: error
    });
    return;
  }

  console.log('✅ [ICS] Réponse issue-guest-link:', data);

  // ... reste du code
} catch (err) {
  console.error('❌ [ICS] Exception lors de l\'appel:', err);
}
```

---

## 📞 Prochaines Étapes

1. **Appliquer la correction** ci-dessus
2. **Tester** en cliquant sur "Copier le lien"
3. **Vérifier les logs** dans la console
4. **Reporter** les valeurs de `propertyId` et `token`

---

**Si le problème persiste, nous aurons besoin de :**
- Les logs de la console
- Les logs de l'Edge Function Supabase
- L'URL complète utilisée
