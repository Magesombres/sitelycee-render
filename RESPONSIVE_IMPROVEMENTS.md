# Améliorations Responsive - Site Lycée

## 📱 Changements apportés

### 1. **Chat (Style Discord)**
- **Desktop** : Panel fixe en bas à droite (350px × 400px)
- **Mobile** : 
  - Bouton flottant rond en bas à droite (💬)
  - Au clic : ouverture en plein écran
  - Badge de notification pour nouveaux messages
  - Transition smooth avec translateY

### 2. **Calendrier d'événements**
- **Desktop** : Vue grille hebdomadaire avec colonnes par jour
- **Tablette (< 1024px)** : Passage en vue liste
  - Suppression de la colonne des heures
  - Événements empilés verticalement
- **Mobile (< 768px)** : 
  - Vue mensuelle en 1 colonne
  - Événements compacts avec détails au clic

### 3. **Cards & Panels**
- **Tablette** : 2 colonnes pour les grilles
- **Mobile** : 
  - 1 colonne pour toutes les grilles
  - Cards en pleine largeur
  - Accordions pour event/club cards (expand au clic)
  - Indicateur ▼ qui rotate à 180° quand ouvert

### 4. **Modals**
- **Mobile** : 
  - Modals normaux : 95% de largeur
  - Modals `.large` : Plein écran (100% × 100%, border-radius: 0)
  - Scroll automatique si contenu trop long

### 5. **Hangman Game**
- **Mobile** :
  - Header avec wrap des infos
  - Clavier adapté (touches plus petites)
  - Lettres du mot réduites
  - Salle d'attente en pleine largeur
  - Boutons empilés verticalement

### 6. **Lobby Hangman**
- **Mobile** :
  - Cartes de mode en 1 colonne
  - Boutons "Créer" / "Rejoindre" en colonne
  - Stats en 1 colonne
  - Navbar en colonne
  - Modals plein écran

## 🎨 Classes Utilitaires

```html
<!-- Afficher uniquement sur mobile -->
<div class="mobile-only">...</div>

<!-- Afficher uniquement sur desktop -->
<div class="desktop-only">...</div>

<!-- Forcer l'empilement vertical sur mobile -->
<div class="mobile-stack">...</div>

<!-- Forcer pleine largeur sur mobile -->
<div class="mobile-full-width">...</div>
```

## 📂 Fichiers modifiés

1. **`public/responsive-override.css`** (NOUVEAU)
   - Overrides globaux pour l'app React
   - Events calendar responsive
   - Chat responsive
   - Cards, modals, tables

2. **`public/index.html`**
   - Ajout du lien vers `responsive-override.css`

3. **`public/games/hangman/css/game.css`**
   - Chat style Discord avec bouton flottant mobile
   - Media queries améliorées
   - Support extra small (480px)

4. **`public/games/hangman/css/lobby.css`**
   - Media queries tablet (1024px)
   - Media queries mobile (768px)
   - Media queries small (480px)
   - Modals plein écran

## 🔧 Breakpoints

| Breakpoint | Taille | Usage |
|------------|--------|-------|
| Desktop | > 1024px | Layout complet |
| Tablet | 768-1024px | 2 colonnes, simplifications |
| Mobile | 480-768px | 1 colonne, accordions |
| Small | < 480px | Ultra compact |

## ✅ Fonctionnalités Responsive

- ✅ Chat Discord-style avec bouton flottant
- ✅ Events calendar en liste sur mobile
- ✅ Cards en accordions (expand au clic)
- ✅ Modals plein écran sur mobile
- ✅ Hangman game adapté (clavier, lettres)
- ✅ Lobby avec boutons empilés
- ✅ Tables transformées en cards mobiles
- ✅ Touch targets 44px minimum
- ✅ Tap highlight désactivé
- ✅ Smooth transitions

## 🚀 Déploiement

Les changements CSS sont automatiquement appliqués. Aucune modification JavaScript nécessaire.

Pour tester :
1. Ouvrir les DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Tester différentes tailles : iPhone, iPad, etc.

## 💡 Recommandations futures

1. **Accordions JavaScript** : Ajouter listeners pour `.event-card` et `.club-card` pour toggle la classe `.expanded`
2. **Badge notifications** : Ajouter `data-count` attribute sur `#btn-chat`
3. **Swipe gestures** : Ajouter support touch pour fermer le chat
4. **Lazy loading** : Images events/clubs chargées à la demande
5. **Virtual scroll** : Pour listes très longues (leaderboard, messages)

## 🐛 Notes de Debug

Si le chat ne se transforme pas en bouton flottant :
- Vérifier que `responsive-override.css` est bien chargé
- Vérifier width viewport : `<meta name="viewport" content="width=device-width">`
- Vérifier la classe `hidden` sur `.chat-panel`

Si les events restent en grille :
- Les overrides CSS utilisent `!important` pour forcer les changements
- Vérifier l'ordre de chargement des CSS (override doit être dernier)
