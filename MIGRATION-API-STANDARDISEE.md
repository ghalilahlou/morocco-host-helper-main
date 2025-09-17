# Migration vers l'API Standardisée

## 🎯 Objectif

Cette migration implémente une API standardisée pour les Edge Functions avec rétrocompatibilité complète, permettant une transition en douceur vers de nouveaux formats de réponse tout en maintenant la compatibilité avec le code existant.

## 📋 Checklist de Validation

### ✅ **Backend (Edge Functions)**

- [x] **Réponse API standardisée** avec champ principal `data`
- [x] **Champs de rétrocompatibilité** (`documentUrls`, `documents`)
- [x] **Structure d'erreur normalisée** avec codes et messages
- [x] **Validation des entrées** avec messages d'erreur clairs
- [x] **Gestion d'erreurs robuste** avec fallbacks

### ✅ **Frontend (Adapters)**

- [x] **Adapter de rétrocompatibilité** pour normaliser les réponses
- [x] **Support des anciens formats** pendant la transition
- [x] **Affichage des erreurs standardisées** (code + message)
- [x] **Fallback automatique** vers les anciennes versions

### ✅ **Tests E2E**

- [x] **Nouveau client + nouvelle API** - Test des nouveaux formats
- [x] **Ancien client + nouvelle API** - Test de rétrocompatibilité
- [x] **Erreurs simulées** - Test des codes d'erreur (400, 500)
- [x] **Validation des formats** - Vérification de la cohérence

## 🚀 Déploiement

### 1. **Déployer les nouvelles Edge Functions**

```bash
# Déployer les fonctions standardisées
supabase functions deploy generate-contract-standardized
supabase functions deploy generate-police-forms-standardized
```

### 2. **Tester la compatibilité**

```bash
# Exécuter les tests E2E
node test-compatibility-e2e.js
```

### 3. **Migrer le frontend**

```bash
# Exécuter la migration automatique
node migrate-to-standardized-api.js
```

### 4. **Vérifier le déploiement**

```bash
# Tester les nouvelles fonctions
node test-compatibility-e2e.js
```

## 📊 Formats de Réponse

### **Nouveau Format Standardisé**

```typescript
{
  success: boolean,
  data?: {
    documentUrl: string,
    documentId?: string,
    signed: boolean,
    signedAt?: string,
    signerName?: string
  },
  error?: {
    code: string,
    message: string,
    details?: any
  },
  // Champs de rétrocompatibilité
  documentUrl?: string,
  documentUrls?: string[],
  documents?: Array<{ url: string; type?: string }>,
  signed?: boolean,
  message?: string
}
```

### **Ancien Format (Maintenu)**

```typescript
{
  documentUrl: string,
  documentId: string,
  signed: boolean
}
```

## 🔧 Codes d'Erreur Standardisés

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `INVALID_INPUT` | Données d'entrée invalides | 400 |
| `INVALID_ACTION` | Action non autorisée | 400 |
| `NOT_FOUND` | Ressource non trouvée | 404 |
| `UNAUTHORIZED` | Accès non autorisé | 401 |
| `VALIDATION_ERROR` | Erreur de validation | 400 |
| `INTERNAL_ERROR` | Erreur interne du serveur | 500 |
| `MISSING_REQUIRED_FIELD` | Champ requis manquant | 400 |
| `INVALID_TOKEN` | Token invalide ou expiré | 401 |
| `BOOKING_NOT_FOUND` | Réservation non trouvée | 404 |
| `PROPERTY_NOT_FOUND` | Propriété non trouvée | 404 |
| `NO_GUESTS_FOUND` | Aucun invité trouvé | 400 |
| `INCOMPLETE_GUEST_DATA` | Données d'invité incomplètes | 400 |

## 🔄 Adapters Frontend

### **Adapter de Contrat**

```typescript
const normalizeContractResponse = (response: any) => {
  return {
    url: response.data?.documentUrl 
          || response.documentUrl 
          || response.documentUrls?.[0] 
          || response.documents?.[0]?.url,
    signed: response.data?.signed ?? response.signed ?? false
  };
};
```

### **Adapter de Fiches de Police**

```typescript
const normalizePoliceFormsResponse = (response: any) => {
  return {
    urls: response.data?.documentUrl 
            ? [response.data.documentUrl, ...(response.documentUrls || [])]
            : response.documentUrls || [],
    guestCount: response.data?.guestCount || response.guestCount || 0
  };
};
```

## 🧪 Tests de Validation

### **Test 1: Nouveau Format**

```bash
# Test avec les nouvelles fonctions
curl -X POST https://your-project.supabase.co/functions/v1/generate-contract-standardized \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"bookingId": "valid-uuid", "action": "generate"}'
```

**Résultat attendu:**
```json
{
  "success": true,
  "data": {
    "documentUrl": "data:application/pdf;base64,...",
    "documentId": "uuid",
    "signed": false
  },
  "documentUrl": "data:application/pdf;base64,...",
  "signed": false
}
```

### **Test 2: Rétrocompatibilité**

```bash
# Test avec les anciennes fonctions
curl -X POST https://your-project.supabase.co/functions/v1/generate-contract \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"bookingId": "valid-uuid", "action": "generate"}'
```

**Résultat attendu:**
```json
{
  "documentUrl": "data:application/pdf;base64,...",
  "documentId": "uuid",
  "signed": false
}
```

### **Test 3: Gestion d'Erreurs**

```bash
# Test avec des paramètres invalides
curl -X POST https://your-project.supabase.co/functions/v1/generate-contract-standardized \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"bookingId": "invalid-id"}'
```

**Résultat attendu:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid bookingId format"
  }
}
```

## 🔄 Rollback

En cas de problème, vous pouvez restaurer les fichiers précédents :

```bash
# Restaurer les fichiers sauvegardés
node migrate-to-standardized-api.js --rollback
```

## 📈 Monitoring

### **Métriques à Surveiller**

1. **Taux de succès des appels API**
2. **Temps de réponse des Edge Functions**
3. **Erreurs par code d'erreur**
4. **Utilisation des anciens vs nouveaux formats**

### **Logs à Surveiller**

```bash
# Surveiller les logs des Edge Functions
supabase functions logs generate-contract-standardized
supabase functions logs generate-police-forms-standardized
```

## 🎯 Prochaines Étapes

1. **Déployer en production** avec monitoring
2. **Migrer progressivement** les clients
3. **Déprécier les anciennes versions** après validation
4. **Supprimer le code de rétrocompatibilité** une fois la migration terminée

## 📞 Support

En cas de problème :

1. Vérifiez les logs des Edge Functions
2. Exécutez les tests E2E
3. Consultez le rapport de migration
4. Contactez l'équipe de développement

---

**Note:** Cette migration est conçue pour être non-destructive et permettre un rollback rapide en cas de problème.
