# Fix: Cache du navigateur pour Pixco

## Problème
Le navigateur utilise l'ancienne version de `/games/pixco/src/app.js` qui essaie encore de se connecter via WebSocket natif (`wss://sitelycee.onrender.com/ws`) au lieu de Socket.IO.

## Solutions

### Solution 1: Forcer le rechargement (côté utilisateur)
1. Ouvrir DevTools (F12)
2. Onglet "Network" ou "Réseau"
3. Cocher "Disable cache"
4. Faire Ctrl+Shift+R (ou Cmd+Shift+R sur Mac) pour hard refresh

### Solution 2: Ajouter un cache-busting au chargement des modules
Modifier `public/games/pixco/index.html` pour ajouter un paramètre de version:

```html
<script type="module" src="./src/app.js?v=2"></script>
```

### Solution 3: Ajouter des headers HTTP pour désactiver le cache des modules
Dans `index.js`, ajouter des headers pour les fichiers .js dans /games/:

```javascript
app.use('/games', express.static(path.join(__dirname, 'public/games'), {
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));
```

## Vérification
Une fois le cache vidé, ouvrir la console DevTools et vérifier:
- Aucune erreur "WebSocket connection to 'wss://...' failed"
- Message "[Pixco] Socket connected" ou similaire
- Le fichier `app.js` chargé doit contenir `socket.io` et non `new WebSocket`
