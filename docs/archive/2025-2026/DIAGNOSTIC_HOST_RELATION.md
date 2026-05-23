# 🔍 DIAGNOSTIC - Erreur Relation host_profiles

## ❌ Erreur

```
Could not find a relationship between 'bookings' and 'host_profiles' in the schema cache
```

## 🔍 Cause

La table `bookings` n'a **pas de foreign key** directe vers `host_profiles`.

## 📊 Structure Probable

```
bookings
├── id
├── property_id → properties(id)
├── host_id (?)
└── ...

properties
├── id
├── host_id → host_profiles(id)
└── ...

host_profiles
├── id
├── full_name
├── email
├── phone
└── ...
```

## ✅ Solutions Possibles

### Solution 1: Récupérer via `properties`

Si `properties` a une relation avec `host_profiles`:

```typescript
const { data: booking, error: bookingError } = await supabase
  .from('bookings')
  .select(`
    *,
    property:properties(
      *,
      contract_template,
      host:host_profiles(*)  // ✅ Via properties
    )
  `)
  .eq('id', bookingId)
  .single();

// Accès:
const hostData = booking.property?.host || {};
```

### Solution 2: Requête Séparée

```typescript
// 1. Récupérer le booking et la property
const { data: booking } = await supabase
  .from('bookings')
  .select(`
    *,
    property:properties(
      *,
      contract_template,
      host_id
    )
  `)
  .eq('id', bookingId)
  .single();

// 2. Récupérer le host séparément
const hostId = booking.property?.host_id;
if (hostId) {
  const { data: host } = await supabase
    .from('host_profiles')
    .select('*')
    .eq('id', hostId)
    .single();
    
  // Utiliser host.email, host.phone, etc.
}
```

### Solution 3: Utiliser `booking.host_id`

Si `bookings` a un champ `host_id`:

```typescript
const { data: booking } = await supabase
  .from('bookings')
  .select('*, property:properties(*)')
  .eq('id', bookingId)
  .single();

const { data: host } = await supabase
  .from('host_profiles')
  .select('*')
  .eq('id', booking.host_id)
  .single();
```

## 🎯 Recommandation

Utiliser **Solution 1** si `properties.host_id` existe, sinon **Solution 2**.

## 📝 Vérification SQL

```sql
-- Vérifier la structure de properties
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'properties';

-- Vérifier s'il y a un host_id
SELECT host_id FROM properties LIMIT 1;

-- Vérifier la structure de bookings
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bookings';
```
