# Guide de Standardisation des Formulaires

## Objectif
Uniformiser tous les formulaires d'insertion dans le projet pour qu'ils suivent le même style visuel et structure que le formulaire "Ajouter un bien" (`CreatePropertyDialog.tsx`).

## Style de Référence : CreatePropertyDialog.tsx

### 1. Structure Générale des Cards

```tsx
<Card className="property-form-card border-0" style={{ 
  background: '#FFFFFF', 
  boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)', 
  borderRadius: '12px' 
}}>
```

### 2. En-tête de Section (CardHeader)

```tsx
<CardHeader className="pb-2">
  <div className="flex items-center gap-2">
    <IconComponent className="w-5 h-5 text-[#040404]" />
    <CardTitle className="property-section-title" style={{ 
      fontFamily: "'Fira Sans Condensed', sans-serif", 
      fontWeight: 400, 
      fontSize: '16px', 
      color: '#040404' 
    }}>
      Titre de la Section
    </CardTitle>
  </div>
  <CardDescription className="property-section-description" style={{ 
    fontFamily: "'Fira Sans Condensed', sans-serif", 
    fontWeight: 400, 
    fontSize: '12px', 
    color: '#4B5563' 
  }}>
    Description explicative
  </CardDescription>
</CardHeader>
```

### 3. Labels de Champs

```tsx
<Label htmlFor="fieldName">
  Nom du champ *
</Label>
```

**Style** :
- `*` rouge pour les champs obligatoires
- Police : Inter, font-weight: 500, fontSize: 12px
- Couleur : #040404

### 4. Champs Input

```tsx
<Input 
  id="fieldName" 
  placeholder="ex: Exemple de texte" 
  {...register('fieldName', { required: 'Message d\'erreur' })} 
/>
```

**Style** :
- Fond blanc
- Border subtle
- Border-radius: 8px
- Placeholder gris clair

### 5. Layout de Grille

**2 colonnes** :
```tsx
<div className="grid grid-cols-2 gap-4">
  <div className="space-y-2">
    {/* Champ 1 */}
  </div>
  <div className="space-y-2">
    {/* Champ 2 */}
  </div>
</div>
```

**3 colonnes** :
```tsx
<div className="grid grid-cols-3 gap-4">
  {/* 3 champs */}
</div>
```

**Pleine largeur** :
```tsx
<div className="space-y-2">
  {/* Champ pleine largeur */}
</div>
```

### 6. Messages d'Erreur

```tsx
{errors.fieldName && (
  <span className="text-sm text-destructive">
    {errors.fieldName.message}
  </span>
)}
```

**Style** :
- Font-size: 12px (text-sm)
- Couleur : destructive (rouge)

### 7. Select / Dropdown

```tsx
<Controller 
  name="fieldName" 
  control={control} 
  rules={{ required: 'Message d\'erreur' }} 
  render={({ field }) => (
    <Select value={field.value} onValueChange={field.onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Sélectionnez une option" />
      </SelectTrigger>
      <SelectContent className="z-[1120]">
        <SelectItem value="option1">Option 1</SelectItem>
        <SelectItem value="option2">Option 2</SelectItem>
      </SelectContent>
    </Select>
  )}
/>
```

### 8. Textarea

```tsx
<Textarea 
  id="fieldName" 
  placeholder="Description…" 
  rows={3} 
  {...register('fieldName')} 
/>
```

### 9. Zones d'Upload de Fichiers

```tsx
<div className="property-upload-zone rounded-xl p-4" style={{ background: '#2D2F39' }}>
  <div className="property-upload-zone-inner flex flex-col items-center justify-center gap-3 p-6 rounded-md" 
       style={{ background: '#1E1E1E', border: '1px dashed #5A5B62' }}>
    <Upload className="w-6 h-6 text-[#B0B2BC]" />
    <div className="text-center">
      <p className="property-upload-zone-text text-sm font-medium" style={{ color: '#B0B2BC' }}>
        Glissez-déposez vos documents
      </p>
      <p className="property-upload-zone-subtext text-xs mt-1" style={{ color: 'rgba(176, 178, 188, 0.5)' }}>
        Formats acceptés...
      </p>
    </div>
  </div>
  <div className="flex justify-center mt-4">
    <button
      type="button"
      className="property-upload-button px-4 py-2 rounded-xl text-sm font-medium"
      style={{ background: '#2D2F39', border: '1px solid #FFFFFF', color: '#FFFFFF' }}
    >
      Importer
    </button>
  </div>
</div>
```

## Palettes de Couleurs

### Couleurs Principales
- **Background Card** : `#FFFFFF`
- **Background Dialog** : `#FDFDF9`
- **Texte Principal** : `#040404`
- **Texte Secondaire** : `#4B5563`
- **Texte Placeholder** : `#9CA3AF`
- **Border** : `#EBEBEB`

### Couleurs d'État
- **Erreur** : `destructive` (rouge)
- **Succès** : `#10B981` (vert)
- **Hover** : Légère opacité ou darken

### Couleurs Spécifiques
- **Upload Zone Background** : `#2D2F39`
- **Upload Zone Inner** : `#1E1E1E`
- **Upload Zone Border** : `#5A5B62` (dashed)
- **Upload Zone Text** : `#B0B2BC`

## Espacements Standards

- **Gap entre colonnes** : `gap-4` (16px)
- **Space-y entre champs** : `space-y-2` ou `space-y-4`
- **Padding Card Content** : classe `CardContent` avec `space-y-4`
- **Padding Header** : `className="pb-2"`

## Polices de Caractères

### Titres de Section
- **Police** : 'Fira Sans Condensed', sans-serif
- **Weight** : 400
- **Size** : 16px
- **Color** : #040404

### Descriptions
- **Police** : 'Fira Sans Condensed', sans-serif
- **Weight** : 400
- **Size** : 12px
- **Color** : #4B5563

### Labels
- **Police** : 'Inter', sans-serif
- **Weight** : 500
- **Size** : 12px
- **Color** : #040404

### Inputs / Placeholders
- **Police** : 'Inter', sans-serif (hérité)
- **Placeholder Color** : #9CA3AF

## Points d'Application

### Formulaires à Uniformiser

1. **GuestVerification.tsx**
   - 📍 Formulaire d'ajout/modification de voyageur
   - 📍 Formulaire d'informations personnelles
   - 📍 Upload de documents d'identité

2. **Autres formulaires du projet**
   - 📍 Formulaire de réservation
   - 📍 Formulaire de contact
   - 📍 Tous autres formulaires d'insertion/modification

### Actions à Réaliser

1. ✅ Identifier tous les formulaires dans le projet
2. ✅ Appliquer le même style de Card avec background blanc et shadow
3. ✅ Standardiser les labels avec police et couleur uniforme
4. ✅ Uniformiser les inputs (placeholder, border-radius, etc.)
5. ✅ Appliquer le même layout de grille (grid-cols-2 gap-4)
6. ✅ Standardiser les messages d'erreur
7. ✅ Appliquer les mêmes zones d'upload de fichiers
8. ✅ Uniformiser les boutons d'action

## Exemple Complet : Formulaire Voyageur

```tsx
<Card className="property-form-card border-0" style={{ 
  background: '#FFFFFF', 
  boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)', 
  borderRadius: '12px' 
}}>
  <CardHeader className="pb-2">
    <div className="flex items-center gap-2">
      <User className="w-5 h-5 text-[#040404]" />
      <CardTitle className="property-section-title" style={{ 
        fontFamily: "'Fira Sans Condensed', sans-serif", 
        fontWeight: 400, 
        fontSize: '16px', 
        color: '#040404' 
      }}>
        Voyageur 1
      </CardTitle>
    </div>
    <CardDescription className="property-section-description" style={{ 
      fontFamily: "'Fira Sans Condensed', sans-serif", 
      fontWeight: 400, 
      fontSize: '12px', 
      color: '#4B5563' 
    }}>
      Certains champs seront pré-remplis automatiquement lorsque vous aurez importé vos documents.
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">Nom complet *</Label>
        <Input 
          id="full_name" 
          placeholder="ex: Mohammed Alaoui" 
          {...register('full_name', { required: 'Le nom complet est obligatoire' })} 
        />
        {errors.full_name && (
          <span className="text-sm text-destructive">{errors.full_name.message}</span>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="birth_date">Date de naissance *</Label>
        <Input 
          id="birth_date" 
          type="date" 
          {...register('birth_date', { required: 'La date de naissance est obligatoire' })} 
        />
        {errors.birth_date && (
          <span className="text-sm text-destructive">{errors.birth_date.message}</span>
        )}
      </div>
    </div>
    
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="nationality">Nationalité *</Label>
        <Input 
          id="nationality" 
          placeholder="ex: Marocaine" 
          {...register('nationality', { required: 'La nationalité est obligatoire' })} 
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="document_number">Numéro de document *</Label>
        <Input 
          id="document_number" 
          placeholder="ex: AB123456" 
          {...register('document_number', { required: 'Le numéro de document est obligatoire' })} 
        />
      </div>
    </div>
    
    {/* Suite du formulaire... */}
  </CardContent>
</Card>
```

## Checklist de Conformité

Avant de valider un formulaire, vérifier que :

- [ ] Les Cards ont le fond blanc (#FFFFFF) et shadow (0px 4px 4px rgba(0, 0, 0, 0.25))
- [ ] Les CardTitle utilisent Fira Sans Condensed, 16px, poids 400
- [ ] Les CardDescription utilisent Fira Sans Condensed, 12px, couleur #4B5563
- [ ] Les Labels sont en Inter, 12px, poids 500
- [ ] Les champs obligatoires ont un astérisque (*) rouge
- [ ] Les grilles utilisent `grid-cols-2 gap-4` ou `grid-cols-3 gap-4`
- [ ] Les messages d'erreur sont en `text-sm text-destructive`
- [ ] Les inputs ont des placeholders descriptifs (ex: ...)
- [ ] Les zones d'upload suivent le même style sombre (#2D2F39 / #1E1E1E)
- [ ] Les boutons d'action sont uniformes en style et couleur
