# 🔧 Correction : Affichage des Boutons "Générer" pour les Réservations Airbnb

## Date : 26 Novembre 2025

## 📋 Problème Identifié

### **Boutons "Générer" affichés prématurément**
- ❌ **Symptôme** : Pour les réservations Airbnb en statut "En attente", les boutons "Générer" pour le contrat et la fiche de police sont affichés même si :
  - Le client n'a pas encore rempli le formulaire de vérification
  - Aucune pièce d'identité n'a été uploadée
  - Aucun guest avec informations complètes n'existe
- ❌ **Cause** : La condition d'affichage vérifiait uniquement le statut (`pending` ou `completed`) sans vérifier la présence de données clients
- ❌ **Impact** : UX dégradée - les boutons sont affichés mais ne peuvent pas fonctionner correctement sans données clients

---

## 🛠️ Solution Implémentée

### **Vérification des Données Clients Avant Affichage**

#### 1. **Nouvel État `hasGuestData`**
```typescript
const [hasGuestData, setHasGuestData] = useState(false);
```

Cet état vérifie si la réservation a des données clients suffisantes pour générer les documents.

#### 2. **Calcul de `hasGuestData` dans `loadDocuments`**
```typescript
// ✅ NOUVEAU : Vérifier si la réservation a des données clients suffisantes
const hasIdentityDocuments = finalIdentityDocs.length > 0;
const bookingTyped = booking as Booking;
const hasCompleteGuests = bookingTyped?.guests && bookingTyped.guests.length > 0 && 
  bookingTyped.guests.some(guest => 
    guest.fullName && 
    guest.documentNumber && 
    guest.nationality
  );

setHasGuestData(hasIdentityDocuments || hasCompleteGuests || false);
```

**Conditions pour `hasGuestData === true` :**
- ✅ Il y a des pièces d'identité uploadées (`uploaded_documents` avec `document_type` = `identity`, `identity_upload`, `id-document`, ou `passport`)
- ✅ OU il y a des guests avec informations complètes (`full_name`, `document_number`, `nationality`)

#### 3. **Modification de la Condition d'Affichage de la Section**
```typescript
// ❌ AVANT
{(status === 'completed' || status === 'pending') && !isAirbnb && (

// ✅ APRÈS
{(status === 'completed' || (status === 'pending' && hasGuestData)) && !isAirbnb && (
```

**Résultat :**
- ✅ Les réservations `completed` affichent toujours la section (documents déjà générés ou à générer)
- ✅ Les réservations `pending` n'affichent la section que si `hasGuestData === true`

#### 4. **Modification des Boutons "Générer"**
```typescript
// ❌ AVANT
{documents.contractUrl ? (
  <Button>Voir</Button>
) : (
  <Button onClick={handleGenerateContract}>Générer</Button>
)}

// ✅ APRÈS
{documents.contractUrl ? (
  <Button>Voir</Button>
) : hasGuestData ? (
  <Button onClick={handleGenerateContract}>Générer</Button>
) : (
  <span className="text-sm text-gray-400">En attente des informations clients</span>
)}
```

**Résultat :**
- ✅ Si le document existe : Bouton "Voir" / "Télécharger"
- ✅ Si pas de document ET `hasGuestData === true` : Bouton "Générer"
- ✅ Si pas de document ET `hasGuestData === false` : Message "En attente des informations clients"

---

## 📊 Comportement par Scénario

### **Scénario 1 : Réservation Airbnb en attente (sans données clients)**
- ✅ **Section "Documents enregistrés"** : **MASQUÉE**
- ✅ **Boutons "Générer"** : **MASQUÉS**
- ✅ **Message** : Aucun message (section complètement masquée)

### **Scénario 2 : Réservation Airbnb en attente (avec pièce d'identité uploadée)**
- ✅ **Section "Documents enregistrés"** : **VISIBLE**
- ✅ **Boutons "Générer"** : **VISIBLES** (car `hasGuestData === true`)
- ✅ **Message** : Boutons fonctionnels

### **Scénario 3 : Réservation Airbnb en attente (avec guests complets)**
- ✅ **Section "Documents enregistrés"** : **VISIBLE**
- ✅ **Boutons "Générer"** : **VISIBLES** (car `hasGuestData === true`)
- ✅ **Message** : Boutons fonctionnels

### **Scénario 4 : Réservation terminée**
- ✅ **Section "Documents enregistrés"** : **TOUJOURS VISIBLE** (peu importe `hasGuestData`)
- ✅ **Boutons "Générer"** : Visibles si pas de document, masqués si document existe
- ✅ **Message** : Boutons "Voir" / "Télécharger" si document existe

---

## 🔍 Flux de Données

### **1. Chargement des Documents (`loadDocuments`)**
```
1. Charger uploaded_documents pour la réservation
2. Filtrer les pièces d'identité (identity, identity_upload, id-document, passport)
3. Charger les guests de la réservation
4. Calculer hasGuestData :
   - hasIdentityDocuments = pièces d'identité trouvées ?
   - hasCompleteGuests = guests avec full_name, document_number, nationality ?
   - hasGuestData = hasIdentityDocuments || hasCompleteGuests
5. Mettre à jour l'état hasGuestData
```

### **2. Affichage Conditionnel**
```
1. Vérifier le statut de la réservation
2. Si status === 'completed' : Toujours afficher la section
3. Si status === 'pending' : Afficher seulement si hasGuestData === true
4. Pour chaque document (contrat, police) :
   - Si document existe : Bouton "Voir" / "Télécharger"
   - Si pas de document ET hasGuestData : Bouton "Générer"
   - Si pas de document ET !hasGuestData : Message "En attente..."
```

---

## ✅ Résultat Final

### **Avant :**
- ❌ Boutons "Générer" affichés pour toutes les réservations `pending`
- ❌ Boutons non fonctionnels si pas de données clients
- ❌ Confusion pour l'utilisateur

### **Après :**
- ✅ Boutons "Générer" affichés uniquement si données clients disponibles
- ✅ Message clair "En attente des informations clients" si pas de données
- ✅ Section masquée complètement si réservation `pending` sans données clients
- ✅ UX améliorée et cohérente

---

## 📝 Fichiers Modifiés

1. ✅ `src/components/UnifiedBookingModal.tsx`
   - Ajout de l'état `hasGuestData`
   - Calcul de `hasGuestData` dans `loadDocuments`
   - Modification de la condition d'affichage de la section
   - Modification des boutons "Générer" pour vérifier `hasGuestData`

---

## 🚀 Tests à Effectuer

1. **Réservation Airbnb en attente (sans données)** :
   - ✅ Vérifier que la section "Documents enregistrés" est masquée
   - ✅ Vérifier qu'aucun bouton "Générer" n'est visible

2. **Réservation Airbnb en attente (avec pièce d'identité)** :
   - ✅ Vérifier que la section "Documents enregistrés" est visible
   - ✅ Vérifier que les boutons "Générer" sont visibles et fonctionnels

3. **Réservation terminée** :
   - ✅ Vérifier que la section "Documents enregistrés" est toujours visible
   - ✅ Vérifier que les boutons "Voir" / "Télécharger" sont visibles si document existe

---

## 🎯 Conclusion

Les boutons "Générer" ne s'affichent maintenant que lorsque la réservation a des données clients suffisantes (pièces d'identité uploadées ou guests avec informations complètes). Cela garantit que les documents peuvent être générés correctement et améliore l'expérience utilisateur.

