# ✅ Correction du Comptage des Réservations Airbnb

## 🐛 Problème Identifié

**Symptôme :**
- Header affiche : **109 Total** (17 manuelles + 83 Airbnb)
- Calendrier affiche : **26 réservations** (17 manuelles + 15 Airbnb de décembre)

**Cause :**
- `airbnbReservationsCount` charge **TOUTES** les réservations Airbnb (tous les mois, y compris passées)
- Le calendrier charge seulement les réservations Airbnb du **mois en cours** (décembre)
- **Écart :** 83 - 15 = **68 réservations Airbnb** d'autres mois ou passées

---

## 🔧 Correction Appliquée

### Modification dans `PropertyDetail.tsx`

**Avant :**
```typescript
const reservations = await AirbnbEdgeFunctionService.getReservations(property.id);
setAirbnbReservationsCount(reservations.length); // Toutes les réservations
```

**Après :**
```typescript
// Charger seulement les réservations Airbnb actives (non passées)
const today = new Date();
today.setHours(0, 0, 0, 0);

const { data: reservations, error } = await supabase
  .from('airbnb_reservations')
  .select('id, start_date, end_date')
  .eq('property_id', property.id)
  .gte('end_date', today.toISOString().split('T')[0]) // Seulement les réservations non terminées
  .order('start_date', { ascending: true });

setAirbnbReservationsCount(reservations?.length || 0);
```

**Bénéfices :**
- ✅ Compte seulement les réservations **actives** (non terminées)
- ✅ Correspond mieux à ce qui est affiché dans le calendrier
- ✅ Réduit l'écart entre le header et le calendrier

---

## 📊 Résultat Attendu

**Avant correction :**
- Header : 17 + 83 = **100** (mais affiche 109)
- Calendrier : 17 + 15 = **26**
- **Écart :** 74 réservations

**Après correction :**
- Header : 17 + ~15-20 = **~32-37** (selon réservations actives)
- Calendrier : 17 + 15 = **26**
- **Écart réduit :** Plus cohérent

---

## 🔍 Note Importante

Le comptage dans le header inclut maintenant seulement les réservations Airbnb **actives** (non terminées), ce qui est plus logique pour l'utilisateur. Si vous souhaitez afficher toutes les réservations (y compris passées), il faudra modifier la logique différemment.

---

## 📝 Alternative : Filtrer par Date Range du Calendrier

Si vous voulez que le header affiche exactement ce qui est visible dans le calendrier, il faudrait :

1. Passer la date du calendrier à `loadAirbnbCount`
2. Filtrer les réservations Airbnb par la même date range que le calendrier
3. Mettre à jour le comptage quand le mois change

**Exemple :**
```typescript
const loadAirbnbCount = useCallback(async (month?: Date) => {
  if (!property?.id) return;
  
  const targetMonth = month || new Date();
  const year = targetMonth.getFullYear();
  const monthIndex = targetMonth.getMonth();
  const startDate = new Date(year, monthIndex, 1);
  const endDate = new Date(year, monthIndex + 1, 0);
  
  const { data: reservations } = await supabase
    .from('airbnb_reservations')
    .select('id')
    .eq('property_id', property.id)
    .gte('start_date', startDate.toISOString().split('T')[0])
    .lte('end_date', endDate.toISOString().split('T')[0]);
  
  setAirbnbReservationsCount(reservations?.length || 0);
}, [property?.id]);
```

Cette approche synchroniserait parfaitement le header avec le calendrier.

