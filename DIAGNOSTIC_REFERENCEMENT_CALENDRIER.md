# 🔍 DIAGNOSTIC EXHAUSTIF - Référencement du Calendrier

## 📊 Analyse Complète du Flux de Données

### 1. Sources de Données du Calendrier

Le calendrier affiche les réservations provenant de **DEUX sources différentes** :

#### Source A : Table `airbnb_reservations`
```sql
-- Requête dans calendarData.ts (ligne 63-69)
SELECT airbnb_booking_id, summary, guest_name, start_date, end_date
FROM airbnb_reservations
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND start_date >= '2025-12-01'
AND end_date <= '2025-12-31'
```

#### Source B : Table `bookings`
```sql
-- Requête dans calendarData.ts (ligne 49-55)
SELECT id, booking_reference, guest_name, check_in_date, check_out_date, status
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND check_in_date >= '2025-12-01'
AND check_out_date <= '2025-12-31'
```

---

## 🎯 Problème Identifié

### Les réservations `HMDMWXRRNC`, `HMXTD4Y7ZAQ`, `HMS4FEKFSQ` viennent de la table `bookings`, PAS de `airbnb_reservations` !

**Preuve :**
```typescript
// calendarData.ts ligne 49-55
const { data: bookingsData } = await supabase
  .from('bookings')  // ✅ Cette requête récupère AUSSI les bookings avec codes Airbnb
  .select('id, booking_reference, guest_name, check_in_date, check_out_date')
  .eq('property_id', propertyId)
  .gte('check_in_date', start)
  .lte('check_out_date', end);
```

**Résultat :** Même si vous supprimez toutes les réservations de `airbnb_reservations`, les réservations de la table `bookings` qui ont des codes Airbnb restent visibles !

---

## 🔄 Flux de Données Complet

### Étape 1 : Chargement des Données

```typescript
// CalendarView.tsx ligne 239
const calendarEvents = await fetchAirbnbCalendarEvents(propertyId, startStr, endStr);
```

### Étape 2 : Récupération depuis 2 Tables

```typescript
// calendarData.ts ligne 49-74

// 1. Récupérer les bookings (INCLUT les codes Airbnb)
const bookingsData = await supabase.from('bookings').select(...)

// 2. Récupérer les airbnb_reservations
const airbnbData = await supabase.from('airbnb_reservations').select(...)
```

### Étape 3 : Enrichissement

```typescript
// calendarData.ts ligne 78-115

// Pour chaque réservation Airbnb, chercher un booking correspondant
const data = airbnbData.map(ar => {
  const matchingBooking = bookingsData.find(b => {
    // Match par dates OU par booking_reference
    return datesMatch || refMatch;
  });
  
  // Utiliser le nom du booking si disponible
  return {
    guest_name: matchingBooking?.guest_name || ar.guest_name
  };
});
```

### Étape 4 : Conversion en Événements Calendrier

```typescript
// calendarData.ts ligne 120-163

const events = data.map(row => ({
  id: row.airbnb_booking_id,
  title: displayTitle,  // Nom du guest ou code Airbnb
  start: startStr,
  end: endStr,
  source: 'airbnb'
}));
```

---

## ❌ Pourquoi les Réservations Persistent

### Scénario Actuel

1. **Synchronisation ICS initiale** (il y a quelques jours/semaines)
   - Edge Function récupère les réservations du fichier ICS
   - Insère dans `airbnb_reservations`
   - **MAIS AUSSI** crée des entrées dans `bookings` avec les codes Airbnb

2. **Vous supprimez le lien ICS**
   - ✅ Les réservations de `airbnb_reservations` sont supprimées
   - ❌ Les réservations de `bookings` restent

3. **Le calendrier affiche toujours les réservations**
   - `fetchAirbnbCalendarEvents()` lit la table `bookings`
   - Trouve les réservations avec codes Airbnb (`HMDMWXRRNC`, etc.)
   - Les affiche dans le calendrier

---

## 🔍 Vérification en Base de Données

### Requête 1 : Vérifier les réservations dans `airbnb_reservations`

```sql
SELECT 
  airbnb_booking_id,
  guest_name,
  start_date,
  end_date
FROM public.airbnb_reservations
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND airbnb_booking_id IN ('HMDMWXRRNC', 'HMXTD4Y7ZAQ', 'HMS4FEKFSQ');
```

**Résultat attendu :** 0 lignes (car vous avez supprimé le lien ICS)

### Requête 2 : Vérifier les réservations dans `bookings`

```sql
SELECT 
  id,
  booking_reference,
  guest_name,
  check_in_date,
  check_out_date,
  status,
  created_at
FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference IN ('HMDMWXRRNC', 'HMXTD4Y7ZAQ', 'HMS4FEKFSQ');
```

**Résultat attendu :** 3 lignes (ce sont ces réservations qui apparaissent dans le calendrier !)

---

## 🎯 Origine du Problème

### Pourquoi ces réservations sont dans `bookings` ?

**2 possibilités :**

#### Possibilité 1 : Création Manuelle
Quelqu'un a créé manuellement ces réservations avec les codes Airbnb comme `booking_reference`.

#### Possibilité 2 : Synchronisation Automatique Ancienne
Une ancienne version de l'Edge Function créait des entrées dans `bookings` en plus de `airbnb_reservations`.

**Vérification :**
```sql
-- Voir quand ces réservations ont été créées
SELECT 
  booking_reference,
  created_at,
  updated_at
FROM public.bookings
WHERE booking_reference IN ('HMDMWXRRNC', 'HMXTD4Y7ZAQ', 'HMS4FEKFSQ')
ORDER BY created_at;
```

---

## ✅ Solutions Proposées

### Solution 1 : Nettoyage Manuel (IMMÉDIAT)

**Supprimer les réservations de la table `bookings` qui ont des codes Airbnb :**

```sql
-- ATTENTION : Vérifier d'abord ce qui sera supprimé
SELECT 
  id,
  booking_reference,
  guest_name,
  check_in_date,
  check_out_date
FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference ~ '^HM[A-Z0-9]+$';

-- Si OK, supprimer
DELETE FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference IN ('HMDMWXRRNC', 'HMXTD4Y7ZAQ', 'HMS4FEKFSQ');
```

---

### Solution 2 : Modifier `handleDeleteUrl` pour Supprimer des 2 Tables (AUTOMATIQUE)

**Fichier :** `src/pages/AirbnbSyncHelp.tsx`

```typescript
const handleDeleteUrl = async () => {
  if (!propertyId) return;
  
  const confirmed = window.confirm(
    "⚠️ Attention : Cette action supprimera le lien ICS ET toutes les réservations Airbnb.\n\nÊtes-vous sûr ?"
  );
  
  if (!confirmed) return;
  
  setIsLoading(true);
  try {
    // 1. Supprimer les réservations de airbnb_reservations
    const { error: deleteAirbnbError } = await supabase
      .from('airbnb_reservations')
      .delete()
      .eq('property_id', propertyId);
    
    if (deleteAirbnbError) throw deleteAirbnbError;
    
    // 2. ✅ NOUVEAU : Supprimer aussi les bookings avec codes Airbnb
    const { error: deleteBookingsError } = await supabase
      .from('bookings')
      .delete()
      .eq('property_id', propertyId)
      .like('booking_reference', 'HM%');  // Codes Airbnb commencent par HM
    
    if (deleteBookingsError) throw deleteBookingsError;
    
    // 3. Supprimer l'URL ICS
    const { error } = await supabase
      .from('properties')
      .update({ airbnb_ics_url: null })
      .eq('id', propertyId);
    
    if (error) throw error;
    
    toast.success("URL et toutes les réservations Airbnb supprimées");
    
    // 4. Rediriger vers le calendrier
    setTimeout(() => {
      navigate(`/dashboard/property/${propertyId}`);
    }, 1000);
    
  } catch (err) {
    console.error(err);
    toast.error("Impossible de supprimer");
  } finally {
    setIsLoading(false);
  }
};
```

---

### Solution 3 : Modifier `calendarData.ts` pour Exclure les Codes Airbnb de `bookings` (FILTRAGE)

**Fichier :** `src/services/calendarData.ts`

```typescript
// Ligne 49-55 : Modifier la requête pour exclure les codes Airbnb
const { data: bookingsData, error: bookingsError } = await supabase
  .from('bookings')
  .select('id, booking_reference, guest_name, check_in_date, check_out_date, status')
  .eq('property_id', propertyId)
  .gte('check_in_date', start)
  .lte('check_out_date', end)
  .not('booking_reference', 'like', 'HM%')  // ✅ NOUVEAU : Exclure les codes Airbnb
  .order('check_in_date', { ascending: true });
```

**Avantage :** Les codes Airbnb dans `bookings` ne seront plus affichés dans le calendrier.

**Inconvénient :** Si vous avez des réservations légitimes avec codes Airbnb dans `bookings`, elles ne seront plus visibles.

---

## 📊 Tableau Comparatif des Solutions

| Solution | Avantages | Inconvénients | Recommandation |
|----------|-----------|---------------|----------------|
| **1. Nettoyage Manuel** | - Immédiat<br>- Contrôle total | - À refaire à chaque fois<br>- Nécessite accès SQL | ⭐⭐⭐ Court terme |
| **2. Modifier handleDeleteUrl** | - Automatique<br>- Permanent | - Supprime TOUS les codes HM% | ⭐⭐⭐⭐⭐ **RECOMMANDÉ** |
| **3. Filtrer dans calendarData** | - Pas de suppression<br>- Réversible | - Cache le problème<br>- Peut masquer des données légitimes | ⭐⭐ Temporaire |

---

## 🎯 Recommandation Finale

### Approche en 2 Étapes

#### Étape 1 : IMMÉDIAT - Nettoyage Manuel
```sql
DELETE FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference IN ('HMDMWXRRNC', 'HMXTD4Y7ZAQ', 'HMS4FEKFSQ');
```

#### Étape 2 : PERMANENT - Modifier le Code
Implémenter la **Solution 2** pour que la suppression du lien ICS supprime automatiquement :
1. Les réservations de `airbnb_reservations`
2. Les réservations de `bookings` avec codes Airbnb

---

## 🔍 Diagnostic Complet

### État Actuel du Système

```
┌─────────────────────────────────────────────────────────────┐
│                    CALENDRIER                               │
│                                                             │
│  Affiche les réservations de 2 sources :                   │
│                                                             │
│  1. airbnb_reservations (✅ Supprimées quand lien supprimé) │
│  2. bookings (❌ Persistent même après suppression du lien) │
│                                                             │
│  Résultat : Réservations fantômes visibles                 │
└─────────────────────────────────────────────────────────────┘
```

### Flux de Données Problématique

```
Synchronisation ICS
       ↓
   ┌───────────────────┐
   │ Edge Function     │
   │ sync-airbnb-      │
   │ unified           │
   └───────────────────┘
       ↓
   ┌───────────────────┐
   │ airbnb_           │  ← ✅ Supprimées
   │ reservations      │
   └───────────────────┘
       
       ↓ (Ancien système ?)
       
   ┌───────────────────┐
   │ bookings          │  ← ❌ Persistent !
   │ (codes Airbnb)    │
   └───────────────────┘
       ↓
   ┌───────────────────┐
   │ calendarData.ts   │
   │ fetchAirbnb       │
   │ CalendarEvents()  │
   └───────────────────┘
       ↓
   ┌───────────────────┐
   │ CALENDRIER        │
   │ Affiche les       │
   │ réservations      │
   └───────────────────┘
```

---

## ✅ Conclusion

**Le problème n'est PAS dans la logique de synchronisation ICS, mais dans le fait que le calendrier lit DEUX tables différentes.**

**Solution recommandée :** Implémenter la Solution 2 pour que la suppression du lien ICS nettoie les deux tables.

---

**Voulez-vous que j'implémente la Solution 2 maintenant ?** 🚀
