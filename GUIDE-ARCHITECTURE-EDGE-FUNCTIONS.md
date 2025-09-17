# Guide d'architecture - Edge Functions séparées

## 🎯 **Problème résolu**

L'edge function `generate-documents` était trop chargée et causait des erreurs de parsing. Nous avons **dispatcher les responsabilités** en créant des fonctions spécialisées.

## 🏗️ **Nouvelle architecture**

```
supabase/functions/
├── generate-contract/
│   └── index.ts          # Génération et signature de contrats
├── generate-police-forms/
│   └── index.ts          # Génération de fiches de police
└── document-utils/
    └── index.ts          # Utilitaires de gestion des documents
```

## 📋 **Fonctions créées**

### 1. **`generate-contract`** - Gestion des contrats
**URL :** `/functions/v1/generate-contract`

**Actions supportées :**
- `generate` : Génère un nouveau contrat
- `sign` : Signe un contrat existant
- `regenerate` : Régénère un contrat

**Exemple d'utilisation :**
```javascript
// Générer un contrat
const response = await fetch('/functions/v1/generate-contract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    bookingId: 'booking-uuid',
    action: 'generate'
  })
});

// Signer un contrat
const signedResponse = await fetch('/functions/v1/generate-contract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    bookingId: 'booking-uuid',
    action: 'sign',
    signatureData: 'data:image/png;base64,...',
    signedAt: '2025-01-30T10:30:00Z'
  })
});
```

### 2. **`generate-police-forms`** - Fiches de police
**URL :** `/functions/v1/generate-police-forms`

**Fonctionnalités :**
- Validation des données d'invités
- Génération de fiches individuelles
- Support des signatures propriétaire
- Format officiel marocain

**Exemple d'utilisation :**
```javascript
const response = await fetch('/functions/v1/generate-police-forms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    bookingId: 'booking-uuid'
  })
});
```

### 3. **`document-utils`** - Utilitaires
**URL :** `/functions/v1/document-utils`

**Actions supportées :**
- `get-document-status` : Statut des documents d'un booking
- `list-documents` : Liste tous les documents d'un booking
- `delete-document` : Supprime un document

**Exemple d'utilisation :**
```javascript
// Obtenir le statut des documents
const statusResponse = await fetch('/functions/v1/document-utils', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'get-document-status',
    bookingId: 'booking-uuid'
  })
});

// Lister les documents
const listResponse = await fetch('/functions/v1/document-utils', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'list-documents',
    bookingId: 'booking-uuid'
  })
});
```

## ✅ **Avantages de cette architecture**

### 1. **Simplicité**
- Chaque fonction a une responsabilité claire
- Code plus facile à maintenir et déboguer
- Moins de risques d'erreurs de parsing

### 2. **Performance**
- Fonctions plus légères et rapides
- Déploiement plus stable
- Moins de mémoire utilisée

### 3. **Flexibilité**
- Possibilité de déployer les fonctions indépendamment
- Facile d'ajouter de nouvelles fonctionnalités
- Tests plus ciblés

### 4. **Sécurité**
- Chaque fonction peut avoir ses propres permissions
- Isolation des responsabilités
- Moins de surface d'attaque

## 🔄 **Workflow recommandé**

### Pour un nouveau booking :

```javascript
// 1. Générer le contrat
const contract = await fetch('/functions/v1/generate-contract', {
  method: 'POST',
  body: JSON.stringify({
    bookingId: 'booking-uuid',
    action: 'generate'
  })
});

// 2. L'utilisateur examine le contrat, puis le signe
const signedContract = await fetch('/functions/v1/generate-contract', {
  method: 'POST',
  body: JSON.stringify({
    bookingId: 'booking-uuid',
    action: 'sign',
    signatureData: signatureData
  })
});

// 3. Générer les fiches de police
const policeForms = await fetch('/functions/v1/generate-police-forms', {
  method: 'POST',
  body: JSON.stringify({
    bookingId: 'booking-uuid'
  })
});

// 4. Vérifier le statut final
const status = await fetch('/functions/v1/document-utils', {
  method: 'POST',
  body: JSON.stringify({
    action: 'get-document-status',
    bookingId: 'booking-uuid'
  })
});
```

## 🧪 **Tests**

### Test de génération de contrat
```bash
curl -X POST http://localhost:54321/functions/v1/generate-contract \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "test-booking-id",
    "action": "generate"
  }'
```

### Test de génération de fiches de police
```bash
curl -X POST http://localhost:54321/functions/v1/generate-police-forms \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "test-booking-id"
  }'
```

### Test des utilitaires
```bash
curl -X POST http://localhost:54321/functions/v1/document-utils \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get-document-status",
    "bookingId": "test-booking-id"
  }'
```

## 📊 **Migration depuis l'ancienne fonction**

### Ancien code :
```javascript
// Ancienne fonction monolithique
const response = await fetch('/functions/v1/generate-documents', {
  method: 'POST',
  body: JSON.stringify({
    bookingId: 'booking-uuid',
    documentType: 'contract',
    signatureData: signatureData
  })
});
```

### Nouveau code :
```javascript
// 1. Générer d'abord
const contract = await fetch('/functions/v1/generate-contract', {
  method: 'POST',
  body: JSON.stringify({
    bookingId: 'booking-uuid',
    action: 'generate'
  })
});

// 2. Signer ensuite
const signedContract = await fetch('/functions/v1/generate-contract', {
  method: 'POST',
  body: JSON.stringify({
    bookingId: 'booking-uuid',
    action: 'sign',
    signatureData: signatureData
  })
});
```

## 🚀 **Déploiement**

### 1. Déployer les nouvelles fonctions
```bash
supabase functions deploy generate-contract
supabase functions deploy generate-police-forms
supabase functions deploy document-utils
```

### 2. Tester chaque fonction individuellement
```bash
# Test generate-contract
supabase functions serve generate-contract

# Test generate-police-forms
supabase functions serve generate-police-forms

# Test document-utils
supabase functions serve document-utils
```

### 3. Mettre à jour le frontend
Remplacer les appels à l'ancienne fonction par les nouvelles fonctions spécialisées.

## 🔧 **Maintenance**

### Ajouter une nouvelle fonctionnalité
1. Créer une nouvelle fonction spécialisée
2. Déployer indépendamment
3. Tester sans affecter les autres fonctions

### Déboguer un problème
1. Identifier la fonction concernée
2. Tester uniquement cette fonction
3. Corriger sans affecter les autres

### Mettre à jour une fonctionnalité
1. Modifier uniquement la fonction concernée
2. Déployer indépendamment
3. Tester la fonction modifiée

## 📈 **Évolutions futures possibles**

- **`generate-receipt`** : Génération de reçus
- **`generate-invoice`** : Génération de factures
- **`document-merge`** : Fusion de documents
- **`document-archive`** : Archivage de documents

Cette architecture modulaire permet d'ajouter facilement de nouvelles fonctionnalités sans impacter les fonctions existantes.

