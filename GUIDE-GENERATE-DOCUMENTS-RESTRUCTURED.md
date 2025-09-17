# Guide d'utilisation - Fonction generate-documents restructurée

## Vue d'ensemble

La fonction `generate-documents-restructured` a été créée pour résoudre les problèmes de la fonction originale et implémenter un workflow de génération et signature de documents plus robuste. Cette version inclut **TOUTES** les fonctionnalités de votre fonction originale avec des améliorations significatives.

## Principales améliorations

### 1. **Génération avant signature**
- Le contrat est maintenant généré **avant** la signature
- L'utilisateur peut voir le contrat avant de le signer
- Le document est enregistré dans la base de données dès sa génération

### 2. **Gestion des actions**
La fonction supporte trois actions principales :
- `generate` : Génère un nouveau document
- `sign` : Signe un document existant
- `regenerate` : Régénère un document (utile pour les mises à jour)

### 3. **Stockage en base de données**
- Tous les documents sont automatiquement sauvegardés dans la table `uploaded_documents`
- Suivi du statut de signature
- Historique des versions de documents

### 4. **Fonctionnalités complètes de la fonction originale**
- ✅ **Polices Unicode** : Support complet des caractères français avec DejaVu fonts
- ✅ **Génération de contrats détaillés** : Tous les articles et sections du contrat original
- ✅ **Fiches de police complètes** : Format officiel marocain avec tous les champs
- ✅ **Validation des invités** : Vérification des données avant génération
- ✅ **Enrichissement des données** : Récupération depuis `guest_submissions`
- ✅ **Signatures multiples** : Support des signatures propriétaire et invité
- ✅ **Mode preview** : Génération sans base de données
- ✅ **Gestion d'erreurs robuste** : Codes d'erreur spécifiques

## Structure de la base de données

### Table `uploaded_documents` (colonnes ajoutées)
```sql
- is_signed: BOOLEAN (indique si le document est signé)
- signature_data: TEXT (données de signature en base64)
- signed_at: TIMESTAMP (date de signature)
- document_url: TEXT (URL du document généré)
```

### Table `bookings` (colonnes ajoutées)
```sql
- contract_generated_at: TIMESTAMP (date de génération du contrat)
- contract_signed_at: TIMESTAMP (date de signature du contrat)
- police_forms_generated_at: TIMESTAMP (date de génération des fiches de police)
```

## Utilisation

### 1. Générer un contrat (avant signature)

```javascript
const response = await fetch('/functions/v1/generate-documents-restructured', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    bookingId: 'booking-uuid',
    documentType: 'contract',
    action: 'generate'
  })
});

const result = await response.json();
// result.documentUrl contient le contrat non signé
// result.documentId contient l'ID du document en base
```

### 2. Signer un contrat existant

```javascript
const response = await fetch('/functions/v1/generate-documents-restructured', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    bookingId: 'booking-uuid',
    documentType: 'contract',
    action: 'sign',
    signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    signedAt: '2025-01-30T10:30:00Z'
  })
});

const result = await response.json();
// result.documentUrl contient le contrat signé
// result.signed = true
```

### 3. Générer des fiches de police

```javascript
const response = await fetch('/functions/v1/generate-documents-restructured', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    bookingId: 'booking-uuid',
    documentType: 'police',
    action: 'generate'
  })
});

const result = await response.json();
// result.documentUrl contient les fiches de police
```

### 4. Régénérer un document (après mise à jour des données)

```javascript
const response = await fetch('/functions/v1/generate-documents-restructured', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    bookingId: 'booking-uuid',
    documentType: 'contract',
    action: 'regenerate',
    signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...', // optionnel
    signedAt: '2025-01-30T10:30:00Z' // optionnel
  })
});

const result = await response.json();
// Le document est régénéré avec les nouvelles données
```

## Workflow recommandé

### Pour un nouveau booking :

1. **Générer le contrat** (action: `generate`)
   - L'utilisateur peut voir le contrat
   - Le document est sauvegardé en base

2. **L'utilisateur signe le contrat** (action: `sign`)
   - La signature est ajoutée au document
   - Le document signé remplace l'ancien en base

3. **Générer les fiches de police** (action: `generate`, documentType: `police`)
   - Les fiches sont générées et sauvegardées

### Pour mettre à jour un document existant :

1. **Régénérer le document** (action: `regenerate`)
   - Le document est mis à jour avec les nouvelles données
   - Si une signature existait, elle est préservée

## Vérification du statut des documents

Utilisez la vue `v_booking_document_status` pour vérifier le statut des documents :

```sql
SELECT 
  booking_id,
  booking_reference,
  has_contract,
  contract_signed,
  has_police_forms,
  contract_generated_at,
  contract_signed_at,
  police_forms_generated_at
FROM v_booking_document_status 
WHERE booking_id = 'your-booking-uuid';
```

## Gestion des erreurs

La fonction retourne des erreurs structurées :

```javascript
{
  success: false,
  message: "Description de l'erreur",
  code: "ERROR_CODE" // optionnel
}
```

### Codes d'erreur courants :
- `BOOKING_NOT_FOUND` : Le booking n'existe pas
- `PROPERTY_NOT_FOUND` : La propriété n'est pas trouvée
- `INVALID_DOCUMENT_TYPE` : Type de document invalide
- `SIGNATURE_REQUIRED` : Signature requise pour l'action 'sign'
- `NO_EXISTING_DOCUMENT` : Aucun document existant à signer

## Migration depuis l'ancienne fonction

Pour migrer depuis l'ancienne fonction :

1. **Remplacer les appels** :
   - Ancien : `generate-documents` avec `signatureData`
   - Nouveau : `generate-documents-restructured` avec `action: 'sign'`

2. **Séparer la génération et la signature** :
   - Générer d'abord avec `action: 'generate'`
   - Signer ensuite avec `action: 'sign'`

3. **Utiliser les nouveaux champs de réponse** :
   - `documentId` pour référencer le document en base
   - `signed` pour vérifier le statut de signature

## Avantages de la nouvelle approche

1. **Meilleure UX** : L'utilisateur voit le contrat avant de le signer
2. **Traçabilité** : Historique complet des documents en base
3. **Flexibilité** : Possibilité de régénérer sans perdre la signature
4. **Robustesse** : Gestion d'erreurs améliorée
5. **Performance** : Évite la régénération inutile de documents

## Fonctionnalités détaillées

### 🔤 **Support Unicode complet**
- **Polices DejaVu** : Chargement automatique des polices DejaVu pour le support complet des caractères français
- **Fallback intelligent** : Utilisation des polices standard si DejaVu n'est pas disponible
- **Cache des polices** : Mise en cache pour améliorer les performances
- **Sanitisation du texte** : Nettoyage automatique des caractères spéciaux

### 📄 **Génération de contrats détaillés**
- **Structure complète** : Tous les articles du contrat original (1-7)
- **Informations dynamiques** : 
  - Statut du propriétaire (particulier/société)
  - Informations de l'entreprise (nom, numéro d'enregistrement, adresse)
  - Règles de maison personnalisées
- **Gestion des invités** : Liste complète avec validation
- **Signatures multiples** : Support des signatures propriétaire et invité
- **Horodatage électronique** : Date et heure de signature

### 🏛️ **Fiches de police officielles**
- **Format marocain** : Conforme aux exigences administratives
- **Champs complets** : Tous les champs requis (nom, prénom, date de naissance, etc.)
- **Validation stricte** : Vérification des données avant génération
- **Signature propriétaire** : Intégration automatique si disponible
- **Bordures officielles** : Mise en forme conforme

### 🔍 **Validation et enrichissement des données**
- **Validation des invités** : Vérification des données minimales requises
- **Enrichissement automatique** : Récupération depuis `guest_submissions`
- **Fallback intelligent** : Utilisation des données de la DB si les soumissions sont incomplètes
- **Gestion des erreurs** : Messages d'erreur détaillés avec codes spécifiques

### 🖊️ **Système de signatures avancé**
- **Récupération automatique** : Recherche dans `contract_signatures` si non fournie
- **Support multi-format** : PNG et JPG
- **Redimensionnement intelligent** : Ajustement automatique des dimensions
- **Horodatage** : Date et heure de signature
- **Informations du signataire** : Nom et détails du signataire

## Tests

### Script de test complet
Un script de test complet est fourni dans `test-generate-documents-restructured.js` :

```bash
node test-generate-documents-restructured.js
```

### Tests manuels

```bash
# Test de génération de contrat
curl -X POST http://localhost:54321/functions/v1/generate-documents-restructured \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "bookingId": "test-booking-id",
    "documentType": "contract",
    "action": "generate"
  }'

# Test de signature
curl -X POST http://localhost:54321/functions/v1/generate-documents-restructured \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "bookingId": "test-booking-id",
    "documentType": "contract",
    "action": "sign",
    "signatureData": "data:image/png;base64,test-signature-data"
  }'

# Test de génération de fiches de police
curl -X POST http://localhost:54321/functions/v1/generate-documents-restructured \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "bookingId": "test-booking-id",
    "documentType": "police",
    "action": "generate"
  }'
```
