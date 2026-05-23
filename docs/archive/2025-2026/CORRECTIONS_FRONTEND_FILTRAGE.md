# 🔧 CORRECTIONS FRONTEND - Filtrage par Documents

## 📋 Résumé des Corrections

### Problèmes Identifiés

1. **Calendrier** : `SHOW_ALL_BOOKINGS = true` affiche toutes les réservations
2. **Dashboard Cards** : Filtre seulement par `status='completed'` sans vérifier les documents
3. **Mobile Dashboard** : Aucun filtre par documents

---

## 🎯 Corrections à Appliquer

### Correction 1 : CalendarView.tsx (Ligne 787)

**Fichier :** `src/components/CalendarView.tsx`

**Avant :**
```typescript
const SHOW_ALL_BOOKINGS = true; // ✅ PERMANENT : Afficher toutes les réservations
```

**Après :**
```typescript
const SHOW_ALL_BOOKINGS = false; // ✅ Filtrer par documents requis
```

**Impact :**
- ✅ Seules les réservations avec tous les documents apparaissent dans le calendrier
- ✅ Les 28 réservations sans documents disparaissent

---

### Correction 2 : Dashboard.tsx (Lignes 82-91)

**Fichier :** `src/components/Dashboard.tsx`

**Avant :**
```typescript
// ✅ FILTRE 2 : Dans la vue Cards, n'afficher que les réservations terminées
if (viewMode === 'cards') {
  // ✅ SIMPLIFICATION : Seulement les réservations avec status='completed'
  // Si une réservation est 'completed', elle est considérée comme validée
  // On fait confiance au statut 'completed' qui indique que la réservation a été traitée
  if (booking.status !== 'completed') {
    return false;
  }
  // ✅ Si status='completed', on affiche la réservation (pas de vérification supplémentaire)
}
```

**Après :**
```typescript
// ✅ FILTRE 2 : Dans la vue Cards, n'afficher que les réservations avec documents complets
if (viewMode === 'cards') {
  // Vérifier que la réservation est completed ET a tous les documents requis
  if (booking.status === 'completed') {
    // Importer hasAllRequiredDocumentsForCalendar depuis @/utils/bookingDocuments
    const hasAllDocs = hasAllRequiredDocumentsForCalendar(booking);
    if (!hasAllDocs) {
      return false; // Exclure si documents manquants
    }
  } else if (booking.status !== 'confirmed') {
    // Exclure les réservations qui ne sont ni completed ni confirmed
    return false;
  }
  // Pour 'confirmed', on affiche aussi (en cours de traitement)
}
```

**Modifications nécessaires :**
1. Ajouter l'import en haut du fichier :
```typescript
import { hasAllRequiredDocumentsForCalendar } from '@/utils/bookingDocuments';
```

**Impact :**
- ✅ Cards affichent seulement les réservations completed avec tous les documents
- ✅ Cards affichent aussi les réservations confirmed (en cours)
- ✅ Cohérence avec le calendrier

---

### Correction 3 : MobileDashboard.tsx (Lignes 48-58)

**Fichier :** `src/components/MobileDashboard.tsx`

**Avant :**
```typescript
const filteredBookings = useMemo(() => {
  return bookings.filter(booking => {
    const matchesSearch = !searchTerm || 
                         booking.bookingReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.guests.some(guest => guest.fullName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
}, [bookings, searchTerm, statusFilter]);
```

**Après :**
```typescript
const filteredBookings = useMemo(() => {
  return bookings.filter(booking => {
    // ✅ FILTRE 1 : Vérifier les documents pour les réservations completed
    if (viewMode === 'cards' && booking.status === 'completed') {
      const hasAllDocs = hasAllRequiredDocumentsForCalendar(booking);
      if (!hasAllDocs) {
        return false; // Exclure si documents manquants
      }
    }
    
    // ✅ FILTRE 2 : Recherche par terme
    const matchesSearch = !searchTerm || 
                         booking.bookingReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.guests.some(guest => guest.fullName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // ✅ FILTRE 3 : Filtre par statut
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
}, [bookings, searchTerm, statusFilter, viewMode]);
```

**Modifications nécessaires :**
1. Ajouter l'import en haut du fichier :
```typescript
import { hasAllRequiredDocumentsForCalendar } from '@/utils/bookingDocuments';
```

2. Ajouter `viewMode` aux dépendances du useMemo

**Impact :**
- ✅ Mobile cards affichent seulement les réservations avec documents
- ✅ Cohérence entre desktop et mobile

---

## 📝 Checklist d'Application

### Phase 1 : Calendrier
- [ ] Ouvrir `src/components/CalendarView.tsx`
- [ ] Aller à la ligne 787
- [ ] Changer `true` en `false`
- [ ] Sauvegarder

### Phase 2 : Dashboard Desktop
- [ ] Ouvrir `src/components/Dashboard.tsx`
- [ ] Ajouter l'import ligne 10 :
  ```typescript
  import { hasAllRequiredDocumentsForCalendar } from '@/utils/bookingDocuments';
  ```
- [ ] Remplacer les lignes 82-91 par le nouveau code
- [ ] Sauvegarder

### Phase 3 : Dashboard Mobile
- [ ] Ouvrir `src/components/MobileDashboard.tsx`
- [ ] Ajouter l'import ligne 13 :
  ```typescript
  import { hasAllRequiredDocumentsForCalendar } from '@/utils/bookingDocuments';
  ```
- [ ] Remplacer les lignes 48-58 par le nouveau code
- [ ] Sauvegarder

### Phase 4 : Test
- [ ] Rafraîchir l'application
- [ ] Vérifier le calendrier (seulement réservations avec documents)
- [ ] Vérifier les cards desktop (seulement réservations avec documents)
- [ ] Vérifier les cards mobile (seulement réservations avec documents)
- [ ] Vérifier la cohérence entre les vues

---

## 🎯 Résultats Attendus

### Avant
- Calendrier : 72 réservations affichées
- Cards Desktop : ~68 réservations completed affichées
- Cards Mobile : ~68 réservations completed affichées

### Après
- Calendrier : ~44 réservations affichées (seulement avec documents)
- Cards Desktop : ~10 réservations affichées (completed + documents complets)
- Cards Mobile : ~10 réservations affichées (completed + documents complets)

---

## ⚠️ Notes Importantes

1. **Réservations Confirmed** : 
   - Dans les cards, on affiche aussi les `confirmed` (en cours de traitement)
   - Cela permet de voir les réservations en cours

2. **Réservations Pending** :
   - Les `pending` sont exclues des cards (sauf si filtre "En attente" sélectionné)
   - Elles apparaissent dans le calendrier si elles ont des documents

3. **Cohérence** :
   - Calendrier et Cards utilisent la même logique de filtrage
   - `hasAllRequiredDocumentsForCalendar()` vérifie : contrat + police + identité

---

## 🔄 Rollback (si problème)

Si les corrections causent des problèmes, revenir en arrière :

### CalendarView.tsx
```typescript
const SHOW_ALL_BOOKINGS = true; // Revenir à l'ancien comportement
```

### Dashboard.tsx
```typescript
// Supprimer l'import hasAllRequiredDocumentsForCalendar
// Revenir au code original lignes 82-91
```

### MobileDashboard.tsx
```typescript
// Supprimer l'import hasAllRequiredDocumentsForCalendar
// Revenir au code original lignes 48-58
```

---

**Prêt à appliquer les corrections ? 🚀**
