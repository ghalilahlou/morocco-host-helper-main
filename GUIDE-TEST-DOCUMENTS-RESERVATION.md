# Guide de Test - Documents de Réservation

## 🎯 **Objectif**
Tester l'enregistrement des documents de réservation : pièce d'identité, contrat, police, etc.

## 📋 **Types de Documents à Tester**

### **1. Documents Uploadés par les Invités**
- **Pièce d'identité** (`passport`, `id_card`)
- **Contrat** (`contract`)
- **Formulaire de police** (`police_form`)
- **Autres documents** (`other`)

### **2. Documents Générés par le Système**
- **Contrat généré** (`contract`)
- **Formulaire de police généré** (`police_form`)
- **Reçu** (`receipt`)

### **3. Signatures**
- **Signature de contrat** (`contract_signatures`)
- **Données de signature** (`signature_data`)

## 🧪 **Scripts de Test Disponibles**

### **1. Test SQL Complet**
```sql
-- Exécuter dans Supabase
-- Fichier: test-documents-reservation.sql
```

### **2. Test JavaScript Simple**
```bash
# Exécuter dans le terminal
node test-simple-documents.js
```

### **3. Test de Fonction**
```javascript
// Dans la console du navigateur
const testData = {
  propertyId: "test-property-123",
  bookingData: {
    checkInDate: "2024-02-15",
    checkOutDate: "2024-02-20",
    numberOfGuests: 2
  },
  guestData: {
    guests: [{
      fullName: "Test User",
      nationality: "Moroccan",
      documentType: "passport",
      documentNumber: "AB123456"
    }],
    documentUrls: [
      "https://example.com/passport.pdf",
      "https://example.com/contract.pdf"
    ]
  }
};

const response = await fetch('/functions/v1/submit-guest-info', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testData)
});
```

## 📊 **Vérifications à Effectuer**

### **1. Documents Uploadés**
- ✅ Pièce d'identité enregistrée
- ✅ Contrat uploadé
- ✅ Formulaire de police
- ✅ Statut de traitement (`completed`, `pending`, `failed`)

### **2. Documents Générés**
- ✅ Contrat généré automatiquement
- ✅ Formulaire de police généré
- ✅ Reçu généré
- ✅ Documents signés

### **3. Signatures**
- ✅ Signature de contrat
- ✅ Données de signature stockées
- ✅ Date de signature enregistrée

### **4. Soumissions d'Invités**
- ✅ Soumission créée
- ✅ Données d'invité stockées
- ✅ URLs de documents enregistrées
- ✅ Statut de soumission

## 🔍 **Requêtes de Vérification**

### **Vérifier les Types de Documents**
```sql
SELECT 
    document_type,
    COUNT(*) as count,
    COUNT(CASE WHEN processing_status = 'completed' THEN 1 END) as completed
FROM uploaded_documents
GROUP BY document_type
ORDER BY count DESC;
```

### **Vérifier les Documents par Réservation**
```sql
SELECT 
    b.id as booking_id,
    b.guest_name,
    COUNT(ud.id) as total_documents,
    COUNT(CASE WHEN ud.document_type = 'passport' THEN 1 END) as passports,
    COUNT(CASE WHEN ud.document_type = 'contract' THEN 1 END) as contracts,
    COUNT(CASE WHEN ud.document_type = 'police_form' THEN 1 END) as police_forms
FROM bookings b
LEFT JOIN uploaded_documents ud ON ud.booking_id = b.id
WHERE b.created_at >= NOW() - INTERVAL '7 days'
GROUP BY b.id, b.guest_name
ORDER BY b.created_at DESC;
```

### **Vérifier les Documents Générés**
```sql
SELECT 
    b.id as booking_id,
    b.guest_name,
    COUNT(gd.id) as total_generated_docs,
    COUNT(CASE WHEN gd.document_type = 'contract' THEN 1 END) as generated_contracts,
    COUNT(CASE WHEN gd.is_signed = true THEN 1 END) as signed_documents
FROM bookings b
LEFT JOIN generated_documents gd ON gd.booking_id = b.id
WHERE b.created_at >= NOW() - INTERVAL '7 days'
GROUP BY b.id, b.guest_name
ORDER BY b.created_at DESC;
```

## ⚠️ **Problèmes Courants**

### **1. Aucun Document Généré**
- **Symptôme** : 0 documents dans `generated_documents`
- **Cause** : Processus de génération non fonctionnel
- **Solution** : Vérifier les Edge Functions de génération

### **2. Documents Non Traités**
- **Symptôme** : `processing_status = 'pending'` ou `'failed'`
- **Cause** : Erreur dans le traitement des documents
- **Solution** : Vérifier les logs de traitement

### **3. Signatures Manquantes**
- **Symptôme** : Contrats non signés
- **Cause** : Processus de signature non fonctionnel
- **Solution** : Vérifier le système de signature

### **4. Soumissions Incomplètes**
- **Symptôme** : Données d'invité manquantes
- **Cause** : Erreur dans `submit-guest-info`
- **Solution** : Vérifier la fonction Edge

## 🎯 **Résultats Attendus**

### **Après un Test Réussi :**
- ✅ Documents uploadés enregistrés
- ✅ Documents générés créés
- ✅ Signatures enregistrées
- ✅ Soumissions complètes
- ✅ Relations entre tables intactes

### **Métriques de Succès :**
- **100%** des réservations ont des documents
- **100%** des documents sont traités
- **100%** des contrats sont signés
- **100%** des soumissions sont complètes

## 🚀 **Actions de Suivi**

1. **Exécuter** les scripts de test
2. **Analyser** les résultats
3. **Identifier** les problèmes
4. **Corriger** les erreurs
5. **Valider** les corrections
6. **Monitorer** les performances

## 📞 **Support**

Si vous rencontrez des problèmes :
1. Vérifiez les logs de la console
2. Exécutez les scripts de diagnostic
3. Consultez la documentation des tables
4. Testez avec des données simples

Votre système de gestion des documents de réservation devrait maintenant être entièrement testable ! 🎯
