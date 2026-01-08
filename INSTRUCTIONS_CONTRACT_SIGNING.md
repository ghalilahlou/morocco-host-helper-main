# 📋 Modifications ContractSigning - Instructions Détaillées

## 🎯 Objectifs

1. ✅ Unifier les icônes des étapes (copier depuis GuestVerification)
2. ✅ Supprimer le double sélecteur de langue (garder un seul à droite)
3. ✅ Centrer le titre "Votre contrat de location"
4. ✅ Zoom par défaut à 60% pour le PDF
5. ✅ Menu latéral caché par défaut
6. ✅ Bouton hamburger pour afficher/cacher le menu

## 📁 Fichiers à Modifier

### **1. WelcomingContractSignature.tsx**

#### **A. Icônes des Étapes (les 3 ronds en haut)**

Actuellement : Icônes différentes de GuestVerification
Objectif : Copier le style exact de Guest Verification

**Style à Appliquer** (copier depuis GuestVerification lignes 2354-2451):
```tsx
{/* Progress Steps - Matching Figma design */}
<div className="px-6 pb-8 flex items-start justify-center gap-16">
  {/* Step 1: Réservation */}
  <div className="flex flex-col items-center">
    <div 
      style={{
        width: '54px',
        height: '51px',
        borderRadius: '16px',
        background: currentStep === 'booking'
          ? '#55BA9F'
          : 'rgba(85, 186, 159, 0.42)',
        boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Home className="w-8 h-8" style={{ color: '#FFFFFF' }} />
    </div>
    <span style={{
      fontFamily: 'Inter, sans-serif',
      fontWeight: 600,
      fontSize: '14px',
      lineHeight: '20px',
      color: '#000000', // Toujours noir sur signature
      marginTop: '8px',
      minHeight: '40px',
      display: 'flex',
      alignItems: 'center',
      textAlign: 'center',
      flexDirection: 'column'
    }}>
      <span>Réservation</span>
      {/* Ligne noire sous Réservation complétée */}
      <div style={{
        width: '100%',
        height: '2px',
        backgroundColor: '#000000',
        marginTop: '4px'
      }} />
    </span>
  </div>
  
  {/* Step 2: Documents d'identité - COMPLÉTÉ */}
  <div className="flex flex-col items-center">
    <div style={{
      width: '54px',
      height: '51px',
      borderRadius: '16px',
      background: '#D7EFED', // Complété = turquoise clair
      boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <FileText className="w-8 h-8" style={{ color: '#FFFFFF' }} />
    </div>
    <span style={{
      fontFamily: 'Inter, sans-serif',
      fontWeight: 600,
      fontSize: '14px',
      lineHeight: '20px',
      color: '#000000',
      marginTop: '8px',
      minHeight: '40px',
      display: 'flex',
      alignItems: 'center',
      textAlign: 'center',
      flexDirection: 'column'
    }}>
      <span>Documents</span>
      {/* Ligne noire sous Documents complétés */}
      <div style={{
        width: '100%',
        height: '2px',
        backgroundColor: '#000000',
        marginTop: '4px'
      }} />
    </span>
  </div>
  
  {/* Step 3: Signature - EN COURS (ACTIF) */}
  <div className="flex flex-col items-center">
    <div style={{
      width: '54px',
      height: '51px',
      borderRadius: '16px',
      background: 'rgba(80, 172, 180, 0.8)', // Actif = #50ACB4 à 80%
      boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <PenTool className="w-8 h-8" style={{ color: '#FFFFFF' }} />
    </div>
    <span style={{
      fontFamily: 'Inter, sans-serif',
      fontWeight: 600,
      fontSize: '14px',
      lineHeight: '20px',
      color: '#000000',
      marginTop: '8px',
      minHeight: '40px',
      display: 'flex',
      alignItems: 'center',
      textAlign: 'center',
      flexDirection: 'column'
    }}>
      <span>Signature</span>
      {/* Ligne noire sous Signature active */}
      <div style={{
        width: '100%',
        height: '2px',
        backgroundColor: '#000000',
        marginTop: '4px'
      }} />
    </span>
  </div>
</div>
```

**Imports nécessaires**:
```tsx
import { Home, FileText, PenTool } from 'lucide-react';
```

#### **B. Header - Supprimer Double Language Switcher**

Actuellement : 2 sélecteurs de langue visibles
Objectif : 1 seul à droite

**Chercher** :
- Toutes les instances de `<LanguageSwitcher />`
- Il devrait y en avoir 2 dans le fichier

**Modifier** :
- Garder celui qui est positionné à droite (`justify-end` ou `flex-end`)
- Supprimer l'autre

#### **C. Centrer le Titre "Votre contrat de location"**

**Chercher** :
```tsx
<h1>Votre contrat de location</h1>
// ou
Votre contrat de location
```

**Modifier** :
Ajouter `textAlign: 'center'` au style ou `className="text-center"`

#### **D. Zoom PDF par Défaut à 60%**

**Chercher** :
- La variable de state pour le zoom
- Probablement `const [scale, setScale] = useState(1)` ou similaire

**Modifier** :
```tsx
const [scale, setScale] = useState(0.6); // 60% au lieu de 100%
```

#### **E. Menu Latéral Caché par Défaut + Bouton Hamburger**

**État pour le menu** :
```tsx
const [isMenuOpen, setIsMenuOpen] = useState(false); // Caché par défaut
```

**Bouton Hamburger** (à ajouter en haut à gauche) :
```tsx
import { Menu } from 'lucide-react';

<button
  onClick={() => setIsMenuOpen(!isMenuOpen)}
  style={{
    position: 'fixed',
    top: '20px',
    left: '20px',
    zIndex: 1000,
    background: '#FFFFFF',
    border: '1px solid #D9D9D9',
    borderRadius: '8px',
    padding: '12px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  }}
  aria-label="Toggle menu"
>
  <Menu className="w-6 h-6" style={{ color: '#1E1E1E' }} />
</button>
```

**Menu Latéral** (conditionnel) :
```tsx
{isMenuOpen && (
  <div style={{
    position: 'fixed',
    left: 0,
    top: 0,
    width: '300px',
    height: '100vh',
    background: '#FFFFFF',
    boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
    zIndex: 999,
    overflowY: 'auto',
    padding: '80px 24px 24px 24px' // Space for close button
  }}>
    {/* Contenu du menu ici */}
    {/* Sommaire du contrat, navigation, etc. */}
  </div>
)}
```

## 🎨 Design Final Attendu

```
┌──────────────────────────────────────────────────────────┐
│  ☰                                        [FR EN ES]     │ Header
│                                                          │
│     🏠          📄          ✍️                           │ Icônes
│  Réservation  Documents  Signature                       │
│  ─────────    ─────────   ─────────                      │
│                                                          │
│         Votre contrat de location                        │ Titre centré
│                                                          │
│  ┌────────────────────────────────────────────┐         │
│  │                                            │         │
│  │       [PDF CONTRAT ZOOM 60%]              │         │ PDF plein écran
│  │                                            │         │
│  │                                            │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
└──────────────────────────────────────────────────────────┘

Menu latéral caché, bouton ☰ pour l'afficher
```

## ✅ Checklist de Vérification

- [ ] 3 icônes : Home, FileText, PenTool avec couleurs progressives
- [ ] Ligne noire sous chaque label d'étape
- [ ] Un seul LanguageSwitcher à droite
- [ ] Titre centré
- [ ] PDF affiché à 60% par défaut
- [ ] Menu caché au chargement
- [ ] Bouton hamburger fonctionnel en haut à gauche
- [ ] Le contrat occupe tout l'espace disponible

## 🔍 Points d'Attention

1. **Imports** : S'assurer que tous les icons (Home, FileText, PenTool, Menu) sont importés depuis lucide-react
2. **État** : Ajouter `const [isMenuOpen, setIsMenuOpen] = useState(false);`
3. **Z-index** : Menu (999), Bouton (1000) pour superposition correcte
4. **Responsive** : Tester sur mobile que le menu s'affiche correctement

Modifiez le fichier en suivant ces instructions étape par étape ! 🚀
