# 🚀 Démarrage rapide - SiteLycee sur Render

## ⏱️ 10 minutes pour déployer votre site

---

## 📋 Checklist avant de commencer

- [ ] Compte GitHub avec votre code
- [ ] Compte [Render](https://render.com) (gratuit)
- [ ] Compte [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (gratuit)

---

## 🎯 Étape 1: MongoDB Atlas (3 min)

1. Allez sur https://www.mongodb.com/cloud/atlas
2. Cliquez **"Build a Database"** → **"M0 FREE"**
3. Région: **Europe - Frankfurt** (ou proche de vous)
4. Cliquez **"Create"**

### Créer un utilisateur

1. **Database Access** → **Add New Database User**
2. Username: `sitelycee_user`
3. **Autogenerate Secure Password** → **Copiez-le !** 📋
4. **Read and write to any database** → **Add User**

### Autoriser les connexions

1. **Network Access** → **Add IP Address**
2. **Allow Access from Anywhere** (0.0.0.0/0) → **Confirm**

### Récupérer l'URI

1. **Database** → **Connect** → **Connect your application**
2. Copiez l'URI (ressemble à):
   ```
   mongodb+srv://sitelycee_user:<password>@cluster0.xxxxx.mongodb.net/
   ```
3. **Remplacez `<password>` par votre mot de passe**
4. **Ajoutez `sitelyee?retryWrites=true&w=majority` à la fin**
   ```
   mongodb+srv://sitelycee_user:VOTRE_MDP@cluster0.xxxxx.mongodb.net/sitelyee?retryWrites=true&w=majority
   ```

✅ **Gardez cet URI sous la main !**

---

## 🎯 Étape 2: Générer JWT_SECRET (1 min)

Ouvrez un terminal dans votre projet et exécutez:

```bash
node scripts/generate_jwt_secret.js
```

📋 **Copiez le secret généré !**

---

## 🎯 Étape 3: Déployer sur Render (5 min)

1. Allez sur https://render.com/dashboard
2. Cliquez **"New +"** → **"Web Service"**
3. **Connect GitHub** → Sélectionnez votre repository
4. Configuration:
   - **Name:** `sitelycee` (ou votre choix)
   - **Region:** Europe (Frankfurt)
   - **Branch:** `main`
   - **Root Directory:** `sitelycee-render-main`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

### Variables d'environnement (IMPORTANT!)

Cliquez **"Advanced"** puis ajoutez:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `MONGO_URI` | *L'URI MongoDB Atlas de l'étape 1* |
| `JWT_SECRET` | *Le secret généré à l'étape 2* |
| `CORS_ALLOW_ALL` | `1` |

### Optionnels (recommandés):

| Key | Value |
|-----|-------|
| `LOG_LEVEL` | `info` |
| `RATE_LIMIT_MAX` | `150` |

5. Cliquez **"Create Web Service"**

---

## 🎯 Étape 4: Vérifier le déploiement (1 min)

1. **Attendez 5 minutes** (première installation)
2. **Surveillez les logs** dans le dashboard Render
3. Recherchez:
   - ✅ `✅ MongoDB connecté`
   - ✅ `🚀 Serveur démarré sur le port XXXX`

4. **Testez votre site:**
   - Ouvrez l'URL fournie par Render (ex: `https://sitelycee.onrender.com`)
   - Testez `/health` → devrait retourner `{"ok": true}`

---

## ✅ C'est fini !

Votre site est en ligne ! 🎉

**URL de votre site:** https://VOTRE-SERVICE.onrender.com

---

## 🐛 Problèmes ?

### ❌ "MONGO_URI is not set"
→ Vérifiez que `MONGO_URI` est bien dans les variables Render

### ❌ "MongoNetworkError"
→ Vérifiez:
1. Que `0.0.0.0/0` est autorisé dans MongoDB Atlas (Network Access)
2. Que le mot de passe dans l'URI est correct
3. Si le mot de passe contient des caractères spéciaux (@, #, etc.), encodez-les avec https://www.urlencoder.org/

### ❌ "Authentication failed"
→ Le mot de passe dans l'URI est incorrect, revérifiez-le

### ❌ Le site ne charge pas
→ Vérifiez les logs Render pour les erreurs

### 💤 Le site est lent au premier chargement
→ C'est normal sur le plan gratuit (sommeil après 15 min d'inactivité)

---

## 📚 Documentation complète

Pour plus de détails, consultez:
- **[RENDER_SETUP.md](./RENDER_SETUP.md)** - Guide complet avec dépannage
- **[CORRECTIONS_APPLIQUEES.md](./CORRECTIONS_APPLIQUEES.md)** - Détails techniques

---

## 🔄 Mettre à jour votre site

1. **Commitez vos changements** sur GitHub
2. **Push** vers la branche `main`
3. Render redéploie automatiquement (2-5 min)

---

**Temps total: ~10 minutes** ⏱️
