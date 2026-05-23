# 🚨 SOLUTION RADICALE : React.memo pour les Formulaires

## Problème Persistant

Même après :
1. ✅ Simplification de `handleFileUpload`
2. ✅ Clés stables (`guest-form-${index}`)
3. ✅ Référence stable pour `deduplicatedGuests`

L'erreur **`NotFoundError: Failed to execute 'removeChild'`** persiste toujours.

---

## Analyse Finale

### Ce Qui Se Passe

1. `setUploadedDocuments` ou `setGuests` est appelé dans `handleFileUpload`
2. Le composant `GuestVerification` se re-render
3. `deduplicatedGuests` useMemo recalcule → Nouvelle référence d'array (même avec la ref stable, le contenu des guests change)
4. Les composants enfants (formulaires avec Select) détectent que `guest` prop a changé
5. React re-rend les Select Radix UI
6. **Les Portals des Select tentent de se nettoyer pendant le re-render**
7. Conflit avec le cycle de vie React → `NotFoundError`

---

## Solution Proposée

### Option 1 : React.memo sur les Formulaires Individuels

Créer un composant `GuestFormCard` mémoisé :

```typescript
const GuestFormCard = React.memo(({
  guest,
  index,
  updateGuest,
  removeGuest,
  deduplicatedGuestsLength,
  uploadedDocuments,
  t
}: {
  guest: Guest;
  index: number;
  updateGuest: (index: number, field: keyof Guest, value: any) => void;
  removeGuest: (index: number) => void;
  deduplicatedGuestsLength: number;
  uploadedDocuments: UploadedDocument[];
  t: any;
}) => {
  // Tout le JSX du formulaire ici
  return (
    <Card className="p-6 border-2 border-gray-100 ...">
      {/* Formulaire complet */}
    </Card>
  );
}, (prevProps, nextProps) => {
  // Comparaison personnalisée : ne re-render que si guest change vraiment
  return (
    prevProps.guest.fullName === nextProps.guest.fullName &&
    prevProps.guest.documentNumber === nextProps.guest.documentNumber &&
    prevProps.guest.nationality === nextProps.guest.nationality &&
    prevProps.guest.documentType === nextProps.guest.documentType &&
    prevProps.guest.motifSejour === nextProps.guest.motifSejour &&
    prevProps.guest.email === nextProps.guest.email &&
    prevProps.guest.profession === nextProps.guest.profession &&
    prevProps.guest.dateOfBirth?.getTime() === nextProps.guest.dateOfBirth?.getTime() &&
    prevProps.guest.adressePersonnelle === nextProps.guest.adressePersonnelle &&
    prevProps.deduplicatedGuestsLength === nextProps.deduplicatedGuestsLength &&
    prevProps.uploadedDocuments.length === nextProps.uploadedDocuments.length
  );
});
```

### Option 2 : Désactiver Complètement l'Extraction Automatique

Si React.memo ne fonctionne pas, **désactiver temporairement** le remplissage automatique :

1. L'upload de document ajoute juste le document à `uploadedDocuments`
2. Ne met PAS à jour `guests` automatiquement
3. L'utilisateur remplit manuellement le formulaire
4. Cliquer sur "Extraire les données" appelle OpenAI et remplit le formulaire

Avantages :
- Zéro re-render pendant l'upload
- Zéro erreur Portal
- L'utilisateur garde le contrôle

Inconvénients :
- UX moins magique
- Une étape manuelle supplémentaire

### Option 3 : Désactiver les Portals Radix UI

Remplacer tous les `Select` Radix UI par des `<select>` HTML natifs :

```tsx
<select
  value={guest.nationality || ''}
  onChange={(e) => updateGuest(index, 'nationality', e.target.value)}
  className="h-12 border-2 hover:border-primary/50"
>
  <option value="">Sélectionner la nationalité</option>
  {NATIONALITIES.map(nat => (
    <option key={nat} value={nat}>{nat}</option>
  ))}
</select>
```

Avantages :
- Zéro conflit Portal
- Performance native
- Zéro erreur

Inconvénients :
- UI moins moderne
- Moins de customisation CSS

---

## Recommandation

Essayer **Option 1** (React.memo) en premier. Si ça ne fonctionne pas après 1 test, passer directement à **Option 3** (Select natifs).

---

## Prochaines Étapes

1. Créer `GuestFormCard` avec React.memo
2. Tester l'upload de document
3. Si erreur persiste → Remplacer les Select Radix par des select natifs
4. Valider que le workflow complet fonctionne

