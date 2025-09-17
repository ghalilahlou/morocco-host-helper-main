# Diagnostic de la Logique d'Enregistrement des Documents

## 🎯 **Problème Identifié**

Seuls les **documents d'identité** sont enregistrés, mais les **contrats** et **formulaires de police** ne sont pas générés automatiquement.

## 📋 **Analyse de la Logique Actuelle**

### **1. Fonction `submit-guest-info` (Edge Function)**

**Ce qui fonctionne :**
- ✅ Enregistre les invités dans `guests`
- ✅ Enregistre les documents d'identité dans `uploaded_documents`
- ✅ Crée les soumissions dans `guest_submissions`
- ✅ Met à jour `guest_name` dans `bookings`

**Ce qui manque :**
- ❌ **Ne génère PAS automatiquement les contrats**
- ❌ **Ne génère PAS automatiquement les formulaires de police**
- ❌ **Ne met pas à jour `documents_generated` dans `bookings`**

### **2. Services Frontend**

**`ApiService.generateDocuments()` :**
- ✅ Appelle `generate-contract`
- ✅ Appelle `generate-police-forms`
- ❌ **Mais n'est PAS appelé automatiquement après `submit-guest-info`**

**`DocumentSyncService` :**
- ✅ Peut générer contrats et police
- ❌ **Mais n'est PAS intégré dans le workflow principal**

### **3. Workflow Actuel (Problématique)**

```
1. Frontend → submit-guest-info
   ├── ✅ Crée booking
   ├── ✅ Crée guests
   ├── ✅ Enregistre documents d'identité
   └── ❌ NE génère PAS contrats/police

2. Frontend → generateDocuments (séparé)
   ├── ✅ Génère contrats
   └── ✅ Génère police
   └── ❌ Mais pas automatique
```

## 🔧 **Solutions Proposées**

### **Solution 1 : Modifier `submit-guest-info` (Recommandée)**

Ajouter la génération automatique des documents dans `submit-guest-info` :

```typescript
// Dans submit-guest-info/index.ts, après la création des invités
if (bookingId) {
  // Générer automatiquement les documents
  try {
    console.log('📄 Génération automatique des documents...');
    
    // Générer le contrat
    const { data: contractData, error: contractError } = await supabase.functions.invoke('generate-contract', {
      body: { bookingId: bookingId, action: 'generate' }
    });
    
    if (contractError) {
      console.error('❌ Erreur génération contrat:', contractError);
    } else {
      console.log('✅ Contrat généré:', contractData);
    }
    
    // Générer les formulaires de police
    const { data: policeData, error: policeError } = await supabase.functions.invoke('generate-police-forms', {
      body: { bookingId: bookingId }
    });
    
    if (policeError) {
      console.error('❌ Erreur génération police:', policeError);
    } else {
      console.log('✅ Formulaires police générés:', policeData);
    }
    
    // Mettre à jour le statut des documents
    await supabase
      .from('bookings')
      .update({
        documents_generated: {
          contract: !contractError,
          police: !policeError,
          identity: true
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);
      
  } catch (error) {
    console.error('❌ Erreur génération documents:', error);
  }
}
```

### **Solution 2 : Modifier le Frontend**

Appeler `generateDocuments` automatiquement après `submit-guest-info` :

```typescript
// Dans le composant qui appelle submit-guest-info
const handleSubmit = async () => {
  try {
    // 1. Soumettre les informations invité
    const result = await ApiService.submitGuestInfo(params);
    
    if (result.success && result.bookingId) {
      // 2. Générer automatiquement les documents
      const documentsResult = await ApiService.generateDocuments(result.bookingId);
      
      if (documentsResult.success) {
        console.log('✅ Tous les documents générés');
      }
    }
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
};
```

### **Solution 3 : Créer une Fonction Unifiée**

Créer une nouvelle fonction Edge `submit-guest-info-complete` qui fait tout :

```typescript
// Nouvelle fonction : submit-guest-info-complete
1. Créer booking + guests + documents d'identité
2. Générer automatiquement contrats + police
3. Mettre à jour documents_generated
4. Retourner le statut complet
```

## 🧪 **Test de la Solution**

### **Test 1 : Vérifier l'État Actuel**

```sql
-- Vérifier les documents existants
SELECT 
    'État actuel' as check_type,
    (SELECT COUNT(*) FROM uploaded_documents WHERE document_type IN ('passport', 'id_card')) as identity_docs,
    (SELECT COUNT(*) FROM generated_documents WHERE document_type = 'contract') as contracts,
    (SELECT COUNT(*) FROM generated_documents WHERE document_type = 'police_form') as police_forms,
    (SELECT COUNT(*) FROM bookings WHERE documents_generated IS NOT NULL) as bookings_with_docs_status;
```

### **Test 2 : Tester la Génération Manuelle**

```javascript
// Dans la console du navigateur
const testBookingId = "YOUR_BOOKING_ID";

// Tester la génération de documents
const { data, error } = await supabase.functions.invoke('generate-contract', {
  body: { bookingId: testBookingId, action: 'generate' }
});

console.log('Contrat:', { data, error });
```

### **Test 3 : Vérifier les Résultats**

```sql
-- Vérifier après génération
SELECT 
    b.id as booking_id,
    b.guest_name,
    b.documents_generated,
    COUNT(ud.id) as identity_docs,
    COUNT(gd.id) as generated_docs
FROM bookings b
LEFT JOIN uploaded_documents ud ON ud.booking_id = b.id
LEFT JOIN generated_documents gd ON gd.booking_id = b.id
WHERE b.id = 'YOUR_BOOKING_ID'
GROUP BY b.id, b.guest_name, b.documents_generated;
```

## 🎯 **Recommandation**

**Implémenter la Solution 1** : Modifier `submit-guest-info` pour générer automatiquement tous les documents.

**Avantages :**
- ✅ Workflow unifié
- ✅ Pas de changement frontend
- ✅ Génération automatique
- ✅ Cohérence des données

**Étapes :**
1. Modifier `submit-guest-info/index.ts`
2. Ajouter la génération automatique
3. Tester avec de nouvelles soumissions
4. Vérifier que tous les documents sont créés

## 📊 **Résultats Attendus**

Après correction :
- ✅ **Documents d'identité** : Enregistrés dans `uploaded_documents`
- ✅ **Contrats** : Générés dans `generated_documents`
- ✅ **Formulaires de police** : Générés dans `generated_documents`
- ✅ **Statut** : `documents_generated` mis à jour dans `bookings`

Voulez-vous que j'implémente la Solution 1 ?
