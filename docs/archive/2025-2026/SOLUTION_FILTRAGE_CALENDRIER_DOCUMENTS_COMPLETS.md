# Solution Définitive - Filtrage Calendrier Documents Complets

## 🎯 Problème Identifié

Les réservations terminées (`status='completed'`) avec tous les documents requis (identité, contrat, police d'assurance) n'apparaissaient pas dans le calendrier officiel du dashboard.

## ✅ Solution Appliquée

### 1. Fonction de Vérification des Documents Complets

**Fichier : `src/utils/bookingDocuments.ts`**

Création de la fonction `hasAllRequiredDocumentsForCalendar()` qui vérifie :

1. **Status = 'completed'** : La réservation doit être terminée
2. **Contrat présent** : Vérifié depuis `documents_generated.contract`
3. **Police d'assurance présente** : Vérifié depuis `documents_generated.police` ou `policeForm`
4. **Document d'identité présent** : Vérifié depuis plusieurs sources :
   - `documents_generated.identity`
   - `submissionStatus.hasDocuments` (pour EnrichedBooking)
   - `guests` avec `documentNumber`
   - `has_documents` (vue matérialisée)
   - `hasRealSubmissions` avec documents
   - `realGuestCount > 0` ou `realGuestNames.length > 0`

### 2. Filtrage dans CalendarView

**Fichier : `src/components/CalendarView.tsx`**

Modification du `useMemo` `allReservations` pour filtrer les réservations :

```typescript
// Filtrer les bookings pour ne garder que ceux qui sont 'completed' avec tous les documents
const filteredBookings = bookings.filter(booking => {
  // Pour les réservations manuelles (bookings), vérifier qu'elles ont tous les documents
  if (booking.status === 'completed') {
    return hasAllRequiredDocumentsForCalendar(booking);
  }
  // Garder les autres statuts (pending, confirmed, etc.)
  return true;
});
```

## 📋 Critères d'Affichage

Une réservation apparaît dans le calendrier si :

### Réservations 'completed'
- ✅ Status = `'completed'`
- ✅ Contrat présent (`documents_generated.contract`)
- ✅ Police d'assurance présente (`documents_generated.police`)
- ✅ Document d'identité présent (au moins une des sources ci-dessus)

### Autres statuts
- ✅ Toutes les réservations avec status `'pending'`, `'confirmed'`, `'archived'` sont affichées (pas de filtre)

## 🔍 Logs de Debug

En mode développement, la fonction `hasAllRequiredDocumentsForCalendar()` log les détails de vérification :

```typescript
console.log('🔍 [hasAllRequiredDocumentsForCalendar] Vérification:', {
  bookingId: booking?.id?.substring(0, 8),
  status: booking?.status,
  hasContract,
  hasPolice,
  hasIdentity,
  hasAllDocuments,
  // ... autres détails
});
```

## 🧪 Tests

Pour vérifier que la solution fonctionne :

1. **Ouvrir la console du navigateur** (F12)
2. **Aller sur le calendrier** du dashboard
3. **Vérifier les logs** :
   - `📊 [CalendarView] Réservations finales pour affichage`
   - `completedWithAllDocsCount` : Nombre de réservations completed avec tous les documents
   - `completedWithAllDocsDetails` : Détails de ces réservations

## 📝 Notes Importantes

1. **Les réservations Airbnb** ne sont pas filtrées (elles sont affichées telles quelles)
2. **Seules les réservations manuelles** avec status `'completed'` sont filtrées
3. **Les autres statuts** (`pending`, `confirmed`, etc.) sont toujours affichés pour permettre le suivi

## 🔄 Prochaines Étapes (Optionnel)

Si vous souhaitez afficher uniquement les réservations avec documents complets (même pour les autres statuts) :

```typescript
// Filtrer TOUTES les réservations
const filteredBookings = bookings.filter(booking => {
  return hasAllRequiredDocumentsForCalendar(booking);
});
```

## ✅ Résultat Attendu

Maintenant, le calendrier affiche :
- ✅ Toutes les réservations `'completed'` avec tous les documents (identité + contrat + police)
- ✅ Toutes les réservations avec d'autres statuts (pour le suivi)
- ✅ Toutes les réservations Airbnb synchronisées

Les réservations `'completed'` sans tous les documents ne sont **plus affichées** dans le calendrier.

