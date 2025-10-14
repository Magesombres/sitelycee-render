# 🐛 Debug et Test du Jeu Hangman

## ✅ Corrections effectuées

### 1. Carte de jeu dédiée créée
- ❌ Avant : Hangman était dans la liste "Jeux HTML" avec Menteur, Hexwar, Pixco
- ✅ Maintenant : Hangman a sa **propre carte** avec badges "Nouveau" (vert) et "En ligne" (violet)
- 📝 Description : "6 modes, multijoueur, système ELO"

### 2. Logs de debug ajoutés
J'ai ajouté des `console.log` pour diagnostiquer les problèmes :
- ✅ Vérification du token JWT
- ✅ Comptage des boutons trouvés
- ✅ Logs à chaque clic
- ✅ Vérification de l'existence des modales

---

## 🧪 Comment tester

### Étape 1 : Attendre le déploiement
1. Va sur **Render Dashboard** : https://dashboard.render.com
2. Trouve ton service `sitelycee`
3. Attends que le statut soit **"Live"** (vert)
4. Vérifie les logs de déploiement (pas d'erreur)

### Étape 2 : Ouvrir le jeu
1. Va sur https://sitelycee.onrender.com
2. **Connecte-toi** avec ton compte
3. Va dans **Jeux** (`/games`)
4. Tu devrais voir la nouvelle carte **"Le Pendu"** avec badges vert/violet
5. Clique sur **"Jouer"**

### Étape 3 : Ouvrir la console du navigateur
**Sur Chrome/Edge :**
- Appuie sur `F12`
- Ou clic droit → "Inspecter"
- Va dans l'onglet **"Console"**

**Sur Firefox :**
- Appuie sur `F12`
- Ou clic droit → "Examiner l'élément"
- Va dans l'onglet **"Console"**

### Étape 4 : Vérifier les logs
Tu devrais voir dans la console :
```
[Hangman Lobby] Initialisation...
[Hangman Lobby] Token présent: true
[Hangman Lobby] Setup event listeners...
[Hangman Lobby] Boutons de jeu trouvés: 6
[Hangman Lobby] Boutons navbar: {stats: true, leaderboard: true, settings: true, logout: true}
[Hangman Lobby] Initialisation terminée
```

---

## 🔍 Diagnostic des problèmes

### Problème : "Token présent: false"
**Cause :** Tu n'es pas connecté ou le token a expiré

**Solution :**
1. Retourne sur la page d'accueil `/`
2. Déconnecte-toi puis reconnecte-toi
3. Retourne sur le jeu

---

### Problème : "Boutons de jeu trouvés: 0"
**Cause :** Le CSS ne charge pas ou le HTML est cassé

**Solution :**
1. Appuie sur `Ctrl+Shift+R` (ou `Cmd+Shift+R` sur Mac) pour **vider le cache**
2. Vérifie dans l'onglet **"Network"** (Réseau) de DevTools si les fichiers se chargent :
   - `lobby.css` → Status 200
   - `themes.css` → Status 200
   - `lobby.js` → Status 200
   - `settings.js` → Status 200

---

### Problème : "Boutons navbar: {stats: false, ...}"
**Cause :** Les IDs des boutons ne correspondent pas

**Solution :**
1. Vérifie que tu es bien sur la bonne page (`/games/web/hangman`)
2. Regarde le code HTML (clic droit → "Voir le code source")
3. Cherche `id="btn-stats"` - il doit exister

---

### Problème : Les boutons ne font rien quand je clique
**Causes possibles :**
1. **JavaScript ne se charge pas**
   - Vérifie l'onglet "Network" → cherche `lobby.js` → Status 200
   - Vérifie l'onglet "Console" → pas d'erreurs rouges

2. **Erreur JavaScript**
   - Regarde la console, cherche des erreurs en rouge
   - Envoie-moi le message d'erreur

3. **Token manquant**
   - Vérifie `[Hangman Lobby] Token présent: true`
   - Si false, reconnecte-toi

---

## 🎯 Test des fonctionnalités

### Test 1 : Boutons de navigation
Clique sur chaque bouton en haut :
- **📊 Mes Stats** → Modal s'ouvre avec tes stats (ou 0 si première fois)
- **🏆 Classement** → Modal s'ouvre avec le leaderboard (vide au début)
- **⚙️ Paramètres** → Modal s'ouvre avec les options (thème, son, etc.)
- **🚪 Retour** → Retour au menu des jeux

**Logs attendus dans la console :**
```
[Hangman Lobby] Afficher modal stats
```
ou
```
[Hangman Lobby] Afficher modal leaderboard
```

### Test 2 : Modes de jeu solo
Clique sur **"Jouer"** d'un mode (Normal, Chrono ou Survie) :

**Logs attendus :**
```
[Hangman Lobby] Mode sélectionné: normal
```

**Résultat attendu :**
- Redirection vers `/games/web/hangman/game.html?room=XXXXXX&mode=normal`
- Le jeu démarre avec un mot en underscores

### Test 3 : Modes multijoueur
Clique sur **"Créer"** (Multiplayer) :

**Résultat attendu :**
- Alert : "Création de room multiplayer - À implémenter"
- (Normal, c'est pas encore implémenté)

---

## 📊 Vérifier la base de données

### Vérifier que les mots sont bien là
1. Va sur **MongoDB Atlas** : https://cloud.mongodb.com
2. Connecte-toi
3. Clique sur ton cluster
4. **Browse Collections**
5. Cherche la collection `hangmanwords`
6. Tu devrais voir **~100 documents**

**Si vide :**
```bash
node scripts/seed_hangman_words.js
```

---

## 🆘 Messages d'erreur courants

### "Cannot read property 'addEventListener' of null"
**Problème :** Un élément HTML n'existe pas

**Solution :** J'ai déjà ajouté des vérifications (`if (btnStats)`), mais si tu vois cette erreur :
1. Note le nom de l'élément manquant
2. Vérifie dans le HTML qu'il existe avec le bon `id`

### "401 Unauthorized"
**Problème :** Token JWT invalide ou expiré

**Solution :**
1. Déconnecte-toi et reconnecte-toi
2. Le token se rafraîchira automatiquement

### "Network error" ou "Failed to fetch"
**Problème :** Le serveur ne répond pas

**Solution :**
1. Vérifie que Render est bien **"Live"**
2. Vérifie les logs Render pour voir s'il y a des erreurs serveur
3. Vérifie que les routes `/hangman/*` sont bien enregistrées dans `index.js`

---

## 🎮 Une fois que tout fonctionne

### Tester un jeu complet (Mode Normal)
1. Clique sur **"Jouer"** du mode Normal
2. Le jeu devrait charger avec :
   - Un mot en underscores : `_ _ _ _ _`
   - Un clavier A-Z
   - 6 vies (❤️❤️❤️❤️❤️❤️)
   - Catégorie affichée
3. Clique sur des lettres
4. Les lettres correctes se révèlent
5. Les lettres incorrectes dessinent le pendu
6. Gagne ou perds
7. Modal de fin s'affiche avec les stats

### Tester le Mode Chrono
1. Clique sur **"Jouer"** du mode Chrono
2. Un timer de 30 secondes devrait démarrer
3. Si tu ne finis pas à temps → défaite

### Tester les Paramètres
1. Clique sur **⚙️ Paramètres**
2. Change le thème (Dark → Light → Chalkboard → Neon)
3. Clique **"Sauvegarder"**
4. Le thème change immédiatement
5. Recharge la page → le thème est conservé

---

## 📝 Checklist complète

### Menu des jeux (`/games`)
- [ ] Carte "Le Pendu" visible
- [ ] Badges "Nouveau" (vert) et "En ligne" (violet)
- [ ] Bouton "Jouer" cliquable
- [ ] Redirection vers `/games/web/hangman`

### Page lobby (`/games/web/hangman`)
- [ ] Page se charge correctement
- [ ] 6 cartes de modes visibles
- [ ] 4 cartes de stats rapides
- [ ] Mini leaderboard (top 5)
- [ ] Boutons navbar fonctionnent

### Boutons de navigation
- [ ] 📊 Mes Stats → Modal s'ouvre
- [ ] 🏆 Classement → Modal s'ouvre avec tabs
- [ ] ⚙️ Paramètres → Modal s'ouvre
- [ ] 🚪 Retour → Retour à `/games`

### Modes de jeu
- [ ] Mode Normal → Démarre un jeu
- [ ] Mode Chrono → Démarre avec timer
- [ ] Mode Survie → Démarre en mode streak
- [ ] Mode Multiplayer → Affiche "À implémenter"
- [ ] Mode Open Room → Affiche "À implémenter"
- [ ] Mode Duel → Affiche "À implémenter"

### Gameplay (page game)
- [ ] Mot s'affiche en underscores
- [ ] Clavier A-Z visible et cliquable
- [ ] Lettres correctes se révèlent
- [ ] Lettres incorrectes → pendu se dessine
- [ ] Vies décrémentent
- [ ] Victoire/défaite détectée
- [ ] Modal de fin s'affiche

### Paramètres
- [ ] Changement de thème fonctionne
- [ ] Sauvegarde dans la base de données
- [ ] Persiste après rechargement

---

## 🚀 Si tout fonctionne

**Félicitations !** 🎉 Le jeu du pendu est opérationnel !

Tu peux maintenant :
1. Jouer aux 3 modes solo (Normal, Chrono, Survie)
2. Voir tes stats s'accumuler
3. Monter dans le classement ELO (mode Duel - quand implémenté)
4. Personnaliser ton expérience avec les thèmes

---

## 📞 Si ça ne marche toujours pas

**Envoie-moi :**
1. **Screenshot de la console** (onglet Console dans DevTools)
2. **Screenshot de l'onglet Network** (fichiers en erreur)
3. **Message d'erreur exact** (copie-colle du texte rouge)
4. **URL exacte** où tu es

Je pourrai diagnostiquer le problème précis ! 🔧
