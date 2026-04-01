# Esthétique — Connexion, inscription, en-tête et pied de page

Document **purement visuel** : couleurs, proportions, typographie, états et composition. **Aucun chemin de fichier ni référence technique.**

---

## 1. Pages « Se connecter » et « Créer un compte »

### 1.1 Structure générale (grand écran)

L’écran est divisé en **deux colonnes verticales** sur une hauteur minimale pleine fenêtre.

- **Colonne gauche** (environ **la moitié** de la largeur, visible à partir d’un breakpoint « large ») : panneau **sombre**, avec **photo d’ambiance** en fond plein écran (même univers visuel que le hero de la page d’accueil : logement / nature).
- **Colonne droite** (toujours visible, occupe tout l’espace sur petit écran) : fond **blanc pur**, formulaire **centré** verticalement et horizontalement dans la zone utile.

Sur **mobile / tablette**, la colonne sombre disparaît : seul le panneau **blanc** reste, avec le **logo couleur** en haut du bloc formulaire.

### 1.2 Traitement du panneau gauche (image + voile)

- **Image** : remplissage **cover**, centrée, sans répétition.
- **Voile** : dégradé **vertical** du haut vers le bas, du plus opaque au légèrement plus transparent, en teinte **bleu nuit** (`rgba` autour de **26, 26, 46** avec opacités ~**0,88** puis ~**0,78**). L’ensemble garde une lecture **sombre et premium**, le texte blanc reste lisible.
- **Padding** intérieur généreux (équivalent **3rem** côté grand écran) sur les quatre côtés.
- **Disposition interne** : **trois zones** empilées avec `space-between` implicite — **haut** : logo ; **centre** : message principal (+ liste sur l’inscription) ; **bas** : ligne de copyright.

### 1.3 Logo

- **Grand écran, panneau sombre** : logo **version claire** (texte / pictogramme adaptés au fond foncé), hauteur d’affichage **32 px**, cliquable pour retourner à l’accueil.
- **Petit écran** : logo **version standard** (adaptée au fond blanc), même hauteur **32 px**, au-dessus du titre du formulaire, avec marge inférieure pour respirer.

### 1.4 Typographie — panneau gauche

- **Titre accroche** (`h2`) : **blanc**, **gras**, taille **très grande** (équivalent **2,25rem**), **tracking** serré.
  - Connexion : *« Bienvenue de retour »*.
  - Inscription : *« Simplifiez votre check-in dès aujourd’hui »*.
- **Sous-texte** (connexion uniquement sous le titre) : **blanc à ~60 % d’opacité**, taille **grande** (équivalent **1,125rem**).
- **Liste à puces** (inscription) : chaque ligne en **blanc ~70 %**, **petit corps** ; à gauche, pastille **ronde** avec fond **teal très transparent** (~30 % d’opacité) et **coche** teal vif au centre (icône **11 px**). Espacement vertical confortable entre les lignes.

### 1.5 Pied du panneau gauche

- Ligne **© année Checky** en **blanc à ~30 % d’opacité**, **petit corps**. Agit comme **pied de zone** discret, sans bordure ni séparateur.

---

## 2. Panneau droit — formulaire (connexion et inscription)

### 2.1 Conteneur

- Largeur maximale du bloc formulaire : **étroite** (équivalent **24rem**), pour une colonne de lecture confortable.
- Espacement vertical **large** entre les blocs (titre, champs, boutons, séparateur).

### 2.2 Titre de page

- **`h1`** : **bleu nuit de marque** (hex **#1A1A2E**), **très gras**, taille **1,875rem**, **tracking** serré.
  - *« Se connecter »* ou *« Créer un compte »*.
- **Ligne d’aide** sous le titre : **gris moyen** (`gray-500`), **petit corps**, marge top minimale.
- **Lien** dans cette ligne : **teal** **#2DBFB8**, **semi-gras**, survol vers **#22A8A2**, transition de couleur fluide.

### 2.3 Message d’erreur

- Fond **rose très pâle** (`red-50`), bordure **rouge doux** (`red-200`), coins **très arrondis** (équivalent **0,75rem**).
- Texte **rouge foncé** (`red-700`), **petit corps**, padding horizontal et vertical contenu.

### 2.4 Labels et champs

- **Label** : **petit corps**, **medium**, couleur **bleu nuit** (#1A1A2E).
- **Champ texte** :
  - Bordure **gris très clair** (`gray-200`).
  - Coins **arrondis larges** (`rounded-xl`).
  - Au focus : **anneau** (ring) **teal** pour l’alignement avec la marque.
- **Mot de passe** : champ identique avec **zone réservée à droite** pour le bouton œil (afficher / masquer) en **gris** **400**, survol **gris 600**, icône **16 px**.

### 2.5 Indicateur de force du mot de passe (inscription uniquement)

- Trois **barres fines** horizontales côte à côte (`flex`), chacune **arrondie en pilule**, hauteur **4 px**, espacement minimal entre elles.
- **Non rempli** : fond **gris 200**.
- **Faible** : une barre **rouge** (`red-400`).
- **Moyen** : deux barres **jaune** (`yellow-400`).
- **Fort** : trois barres **vert** (`green-500`).
- Libellé textuel à droite (**Faible** / **Moyen** / **Fort**) en **très petit** **gris 400**.

### 2.6 Bouton principal (soumission)

- **Pleine largeur**.
- Fond **teal** #2DBFB8, texte **blanc**.
- Forme **pilule** (bords totalement arrondis).
- Taille **large** (hauteur confortable au clic).
- Survol **#22A8A2**, actif **#1A9690**.
- Pendant chargement : **icône spinner** **16 px** à gauche du libellé, animation de rotation.

### 2.7 Séparateur « ou »

- **Ligne horizontale** pleine largeur, **gris 200**, au centre vertical du libellé.
- Mot **« ou »** en **très petit** **gris 400**, sur fond **blanc** (bandeau qui masque la ligne), **centré**, padding horizontal pour l’effet « pilule de texte » sur la ligne.

### 2.8 Bouton « Continuer avec Google »

- Variant **contour** : bordure **gris 200**, fond blanc, texte **gris 600**.
- **Pilule**, pleine largeur, même gabarit que le bouton principal.
- Survol : bordure et texte passent **teal**.
- **Icône Google** officielle (quatre couleurs : bleu **#4285F4**, vert **#34A853**, jaune **#FBBC05**, rouge **#EA4335**), **16 px**, marge à droite du texte.

### 2.9 Pied du panneau formulaire

- **Connexion** : ligne **centrée**, **très petit** **gris 400**, mention du **compte de démonstration** (email / mot de passe) pour les tests.
- **Inscription** : **même style** ; texte légal — acceptation des **CGU** et **politique de confidentialité** ; mots-liens **soulignés**, survol **teal**.

---

## 3. Cohérence avec la marque (rappel chiffré)

| Élément | Valeur ou usage |
|--------|------------------|
| Teal principal | **#2DBFB8** |
| Bleu nuit titres / contrastes | **#1A1A2E** |
| Teal hover bouton | **#22A8A2** |
| Teal actif | **#1A9690** |
| Voile panneau gauche | **rgba(26,26,46,0.78–0.88)** |
| Texte secondaire | **gray-500**, **gray-400** |
| Bordures neutres | **gray-200** |

---

## 4. En-tête du site marketing (barre de navigation)

*Présent sur la page d’accueil et les pages qui réutilisent ce bandeau — pas sur les écrans connexion / inscription, qui ont leur propre hiérarchie.*

### 4.1 Position et fond

- **Fixe** en haut de la fenêtre, **pleine largeur**, index d’empilement élevé pour rester au-dessus du défilement.
- Fond **blanc**.
- **Ombre portée très légère** sous la barre pour la séparer du contenu.

### 4.2 Dimensions et grille

- Hauteur de ligne **fixe** (~**4rem**).
- Contenu **centré** avec largeur max généreuse et marges latérales responsives.
- Trois zones : **logo à gauche**, **liens au centre** (grand écran), **boutons à droite**.

### 4.3 Logo

- Logo **couleur** sur fond blanc, hauteur **32 px**, aligné à gauche.

### 4.4 Liens de navigation (desktop)

- Texte **petit**, **gris 500**, **medium**.
- Espacement horizontal **large** entre les liens.
- Au survol : couleur **teal** ; transition **~200 ms**.

### 4.5 Boutons d’action (desktop)

- **Secondaire** — « Se connecter » : bouton **contour**, bordure et texte **teal** ; survol **fond teal** et texte **blanc** ; état pressé teal plus profond.
- **Primaire** — « S’inscrire » : fond **teal**, texte **blanc**, forme **pilule**, padding horizontal confortable ; mêmes hovers/actifs que sur les formulaires.

### 4.6 Mobile

- Liens et boutons regroupés derrière une **icône menu** (hamburger / fermeture), zone tactile **arrondie** gris clair au survol.
- Panneau déroulant : fond **blanc**, **bordure haute** gris très pâle, liens empilés, puis les deux boutons en **colonne** avec les mêmes styles que sur desktop.

---

## 5. Pied de page du site marketing

### 5.1 Fond et hauteur

- Fond **plein bleu nuit** (**#1A1A2E**), texte **blanc**.
- Padding vertical **important** (équivalent **4rem**).

### 5.2 Zone principale (grille)

- Sur grand écran : **quatre colonnes** logiques — les **deux premières** fusionnées pour la **marque** et le **texte descriptif** ; colonnes **Produit** et **Légal** avec listes de liens.
- Espacement **large** entre colonnes et entre lignes de liste.

### 5.3 Marque (bloc gauche étendu)

- Logo **version clair** (adapté fond sombre), hauteur **~28 px**.
- Paragraphe descriptif : **blanc ~60 % d’opacité**, **petit corps**, interligne détendu, largeur max limitée pour des lignes courtes.
- Réseaux sociaux : texte **blanc ~40 %**, **petit** ; au survol **teal**.

### 5.4 Colonnes Produit et Légal

- **Titres de colonne** : **semi-gras**, **petit**.
- **Liens** : **blanc ~60 %** ; survol **blanc plein** ; **petit corps**, liste verticale avec espacement régulier.

### 5.5 Bande inférieure (sous la grille)

- **Séparateur** : trait horizontal **blanc ~10 %** d’opacité.
- Padding top sur cette bande.
- **Copyright** : **blanc ~40 %**, **petit**.
- **Ligne secondaire** (légal / hébergement) : **encore plus discret**, **très petit** **blanc ~40 %**.
- Sur mobile : empilement vertical centré ou aligné avec léger écart entre les deux lignes.

---

## 6. Synthèse comparative

| Zone | Ambiance dominante |
|------|---------------------|
| **Connexion / inscription** | Split **sombre + image** / **blanc** ; accent **teal** sur actions ; formulaire **compact** et **pilules**. |
| **En-tête marketing** | **Blanc**, **plat**, **ombre légère** ; navigation **grise** → **teal** ; CTA **contour** + **plein**. |
| **Pied marketing** | **Bloc sombre** plein largeur ; hiérarchie **blanc / blanc atténué** ; survols **teal** sur réseaux. |

Les pages **connexion** et **inscription** **n’affichent pas** la barre blanche ni le pied marketing : elles forment un **écran autonome** centré sur l’authentification, tout en **réutilisant** les mêmes **codes couleur**, **typographie** et **rayons de boutons** que le reste du produit.

---

*Document descriptif pour maquettes, charte ou cahier des charges UX — à actualiser si l’interface évolue.*
