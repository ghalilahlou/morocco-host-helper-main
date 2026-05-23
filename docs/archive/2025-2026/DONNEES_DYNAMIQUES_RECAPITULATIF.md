# ✅ RENDRE LES DONNÉES DYNAMIQUES - Récapitulatif

## 🎯 Objectif

Afficher les **vraies données** de la réservation dans le Récapitulatif au lieu de valeurs statiques ou par défaut.

## 📊 État Actuel

### Récapitulatif (ligne 173-189)

```typescript
const guestName = guestData?.guests?.[0]?.fullName || bookingData?.guests?.[0]?.fullName || 'Cher invité';
const propertyName = propertyData?.name || 'Notre magnifique propriété';
const checkInDate = bookingData?.checkInDate ? new Date(bookingData.checkInDate).toLocaleDateString('fr-FR', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
}) : '';
const checkOutDate = bookingData?.checkOutDate ? new Date(bookingData.checkOutDate).toLocaleDateString('fr-FR', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
}) : '';
```

### Affichage (ligne 924-1006)

```typescript
{/* Property */}
<p>Propriété</p>
<p>{propertyName || 'Votre hébergement'}</p>

{/* Dates */}
<p>Dates</p>
<p>{checkInDate} - {checkOutDate}</p>

{/* Voyageurs */}
<p>Voyageurs</p>
<p>{guestName} + {(bookingData?.numberOfGuests || 1) - 1} autres</p>
```

## 🔍 Problème Identifié

### Données Affichées vs Données Réelles

| Champ | Affiché Actuellement | Devrait Afficher |
|-------|---------------------|------------------|
| **Propriété** | "Propriété" | Nom réel de la propriété |
| **Dates** | ✅ Dynamique | ✅ OK |
| **Voyageurs** | "Chef invité + 0 autres" | "MOUHCINE TEMSAMANI + 0 autres" |

### Source des Données

Les données des guests sont dans `guest_submissions`:
```sql
SELECT 
  guest_data->>'full_name' as full_name,
  guest_data->>'email' as email
FROM guest_submissions
WHERE booking_id = 'xxx';
```

**Résultat**: `full_name = "MOUHCINE TEMSAMANI"`

Mais dans le composant, `guestData?.guests?.[0]?.fullName` retourne probablement `undefined` ou "Chef invité".

## ✅ Solution

### 1. Récupérer les Données depuis `guest_submissions`

**Fichier**: `src/components/WelcomingContractSignature.tsx`

**Ajouter** après la ligne 172:

```typescript
// ✅ NOUVEAU: Récupérer les vraies données des guests depuis guest_submissions
const [realGuestData, setRealGuestData] = useState<any>(null);

useEffect(() => {
  const fetchGuestData = async () => {
    const bookingId = getBookingId();
    if (!bookingId) return;

    try {
      const { data: submissions, error } = await supabase
        .from('guest_submissions')
        .select('guest_data, extracted_data')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Erreur récupération guest data:', error);
        return;
      }

      if (submissions) {
        const guestData = submissions.guest_data || {};
        const extractedData = submissions.extracted_data || {};
        
        setRealGuestData({
          fullName: guestData.full_name || guestData.fullName || guestData.name || 
                   extractedData.full_name || extractedData.fullName || '',
          email: guestData.email || extractedData.email || '',
          nationality: guestData.nationality || extractedData.nationality || '',
          // ... autres champs
        });
      }
    } catch (error) {
      console.error('Erreur fetch guest data:', error);
    }
  };

  fetchGuestData();
}, [bookingData?.id]);
```

### 2. Utiliser les Vraies Données

**Modifier** la ligne 173:

```typescript
// ❌ AVANT
const guestName = guestData?.guests?.[0]?.fullName || bookingData?.guests?.[0]?.fullName || 'Cher invité';

// ✅ APRÈS
const guestName = realGuestData?.fullName || 
                  guestData?.guests?.[0]?.fullName || 
                  bookingData?.guests?.[0]?.fullName || 
                  'Cher invité';
```

### 3. Afficher le Nombre Réel de Voyageurs

**Modifier** la ligne 1004:

```typescript
// ❌ AVANT
<p>{guestName} + {(bookingData?.numberOfGuests || 1) - 1} autres</p>

// ✅ APRÈS - Récupérer le nombre réel de guests
const totalGuests = await supabase
  .from('guest_submissions')
  .select('id', { count: 'exact' })
  .eq('booking_id', bookingId);

<p>{guestName} + {(totalGuests.count || 1) - 1} autres</p>
```

## 🧪 Tests

### Test 1: Vérifier les Données dans la Console

Ajouter des logs:

```typescript
console.log('📊 Récapitulatif - Données:', {
  guestName,
  propertyName,
  checkInDate,
  checkOutDate,
  numberOfGuests: bookingData?.numberOfGuests,
  realGuestData
});
```

### Test 2: Vérifier l'Affichage

**Avant** ❌:
```
Propriété
Propriété

Dates
mercredi 21 janvier 2026 - samedi 24 janvier 2026

Voyageurs
Chef invité + 0 autres
```

**Après** ✅:
```
Propriété
Studio Casa (ou le vrai nom)

Dates
mercredi 21 janvier 2026 - samedi 24 janvier 2026

Voyageurs
MOUHCINE TEMSAMANI + 1 autres
```

## 📋 Checklist

- [ ] Ajouter `useState` pour `realGuestData`
- [ ] Ajouter `useEffect` pour récupérer les données depuis `guest_submissions`
- [ ] Modifier `guestName` pour utiliser `realGuestData`
- [ ] Modifier le nombre de voyageurs pour être dynamique
- [ ] Tester l'affichage
- [ ] Vérifier les logs console

## 💡 Alternative Rapide

Si vous voulez une solution plus simple sans modifier le code, vérifiez que:

1. **`guestData` est bien passé** au composant avec la bonne structure:
   ```typescript
   guestData = {
     guests: [
       {
         fullName: "MOUHCINE TEMSAMANI",
         email: "...",
         ...
       }
     ]
   }
   ```

2. **`bookingData` contient** `numberOfGuests`:
   ```typescript
   bookingData = {
     numberOfGuests: 2,  // Nombre réel de guests
     ...
   }
   ```

## 🎯 Résultat Attendu

Toutes les données du Récapitulatif doivent être **dynamiques** et refléter les vraies informations de la réservation, pas des valeurs par défaut ou statiques.
