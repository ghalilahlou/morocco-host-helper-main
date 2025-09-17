# 🔧 CORRECTION EXTRACTION DONNÉES GUEST

## ✅ **PROBLÈME IDENTIFIÉ ET RÉSOLU**

### **Problème principal** :
- La fonction `generate-contract` cherchait les données guest dans la table `guest_submissions` 
- **MAIS** les données sont en réalité stockées dans la table `guests`
- Résultat : Aucune donnée guest n'était récupérée pour le contrat

### **Solution appliquée** :
- ✅ Correction de la source de données : `guest_submissions` → `guests`
- ✅ Extraction complète de tous les champs disponibles
- ✅ Ajout des informations supplémentaires dans le contrat

## 📊 **FLUX DE DONNÉES CORRIGÉ**

### **1. Frontend → Base de données** :
```
GuestVerification.tsx → submit-guest-info → table guests
```

### **2. Structure de la table `guests`** :
```sql
CREATE TABLE public.guests (
  id UUID PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id),
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  document_number TEXT NOT NULL,
  nationality TEXT NOT NULL,
  place_of_birth TEXT,
  document_type document_type NOT NULL,
  profession TEXT,                    -- ✅ AJOUTÉ
  motif_sejour TEXT DEFAULT 'TOURISME', -- ✅ AJOUTÉ
  adresse_personnelle TEXT,           -- ✅ AJOUTÉ
  email TEXT,                         -- ✅ AJOUTÉ
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### **3. Extraction corrigée dans `generate-contract`** :

**AVANT** (incorrect) :
```typescript
// ❌ Cherchait dans guest_submissions
const { data: guestSubmissions } = await client
  .from('guest_submissions')
  .select('guest_data, document_urls')
  .eq('booking_id', bookingId);
```

**MAINTENANT** (correct) :
```typescript
// ✅ Cherche dans la table guests (source principale)
const { data: guestsData, error: guestsError } = await client
  .from('guests')
  .select('*')
  .eq('booking_id', bookingId)
  .order('created_at', { ascending: true });
```

## 🔍 **DONNÉES EXTRAITES MAINTENANT**

### **Informations de base** :
- ✅ **Nom complet** : `full_name`
- ✅ **Date de naissance** : `date_of_birth`
- ✅ **Lieu de naissance** : `place_of_birth`
- ✅ **Nationalité** : `nationality`
- ✅ **Type de document** : `document_type`
- ✅ **Numéro de pièce d'identité** : `document_number`

### **Informations supplémentaires** :
- ✅ **Profession** : `profession`
- ✅ **Motif du séjour** : `motif_sejour`
- ✅ **Adresse personnelle** : `adresse_personnelle`
- ✅ **Email** : `email`

## 📄 **AFFICHAGE DANS LE CONTRAT**

Le contrat affiche maintenant **TOUTES** les informations du client :

```
LE LOCATAIRE :
Nom complet: MARCEL YVES GUY PICARD
Date de naissance: 06/03/1951
Lieu de naissance: [si fourni]
Nationalité: FRANÇAIS
Type de document: Carte d'identité
Numéro de pièce d'identité: 121193103152
Profession: [si fournie]
Motif du séjour: Tourisme
Adresse personnelle: [si fournie]
Email: [si fourni]
```

## 🔧 **LOGS DE DÉBOGAGE AJOUTÉS**

### **Logs de récupération** :
```
🔍 Récupération des données d'invités depuis la table guests...
📋 Données d'invités trouvées dans la table guests: [...]
👤 Traitement de l'invité depuis la table guests: {...}
```

### **Logs de traitement** :
```
🔍 Processing guest data from guests table: {
  fullName: "MARCEL YVES GUY PICARD",
  documentNumber: "121193103152",
  nationality: "FRANÇAIS",
  documentType: "Carte d'identité",
  dateOfBirth: "06/03/1951",
  placeOfBirth: "",
  profession: "",
  motifSejour: "TOURISME",
  adressePersonnelle: "",
  email: ""
}
```

### **Logs de confirmation** :
```
✅ Guest added to contract from guests table: {
  name: "MARCEL YVES GUY PICARD",
  documentNumber: "121193103152",
  nationality: "FRANÇAIS",
  documentType: "Carte d'identité",
  profession: "",
  motifSejour: "TOURISME"
}
✅ 1 invités récupérés depuis la table guests
```

## 🎯 **RÉSULTAT ATTENDU**

### **Le contrat affiche maintenant** :
1. ✅ **Toutes les informations du client** depuis "Informations des clients"
2. ✅ **Signatures visibles** (hôte et guest)
3. ✅ **Contrat complet** avec tous les articles
4. ✅ **Logs de débogage** pour tracer les données

### **Test de validation** :
- Les données du client doivent apparaître dans le contrat
- Les logs doivent montrer la récupération depuis la table `guests`
- Toutes les informations supplémentaires doivent être affichées

---

**Date** : $(date)
**Statut** : Extraction des données guest corrigée - Source : table `guests`
