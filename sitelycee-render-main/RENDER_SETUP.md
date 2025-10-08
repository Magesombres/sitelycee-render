# 🚀 Guide de déploiement sur Render

Ce guide vous aidera à déployer votre application SiteLycee sur Render avec MongoDB Atlas.

## 📋 Prérequis

- Un compte [Render](https://render.com) (gratuit)
- Un compte [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (gratuit)

---

## 1️⃣ Configuration de MongoDB Atlas

### Étape 1: Créer un cluster gratuit

1. Connectez-vous sur https://www.mongodb.com/cloud/atlas
2. Cliquez sur **"Build a Database"**
3. Sélectionnez **"M0 FREE"** (512 MB gratuit)
4. Choisissez une région proche de votre service Render (ex: Europe - Frankfurt)
5. Nommez votre cluster (ex: `sitelycee-cluster`)
6. Cliquez sur **"Create"**

### Étape 2: Créer un utilisateur de base de données

1. Dans le panneau latéral, allez dans **"Database Access"**
2. Cliquez sur **"Add New Database User"**
3. Choisissez **"Password"** comme méthode d'authentification
4. Créez un nom d'utilisateur (ex: `sitelycee_user`)
5. **Générez un mot de passe sécurisé** (notez-le, vous en aurez besoin)
6. Database User Privileges: **"Read and write to any database"**
7. Cliquez sur **"Add User"**

### Étape 3: Autoriser les connexions réseau

1. Dans le panneau latéral, allez dans **"Network Access"**
2. Cliquez sur **"Add IP Address"**
3. Cliquez sur **"Allow Access from Anywhere"** (0.0.0.0/0)
   > ⚠️ Ceci est nécessaire car Render utilise des IPs dynamiques
4. Cliquez sur **"Confirm"**

### Étape 4: Récupérer l'URI de connexion

1. Retournez dans **"Database"** (panneau latéral)
2. Cliquez sur **"Connect"** pour votre cluster
3. Sélectionnez **"Connect your application"**
4. Driver: **"Node.js"**
5. Copiez l'URI de connexion (ressemble à):
   ```
   mongodb+srv://sitelycee_user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. **Remplacez `<password>` par le mot de passe créé à l'étape 2**
7. **Ajoutez le nom de la base** après `.net/`: 
   ```
   mongodb+srv://sitelycee_user:MON_MDP@cluster0.xxxxx.mongodb.net/sitelyee?retryWrites=true&w=majority
   ```

---

## 2️⃣ Configuration sur Render

### Étape 1: Créer un nouveau Web Service

1. Connectez-vous sur https://render.com
2. Cliquez sur **"New +"** → **"Web Service"**
3. Connectez votre repository GitHub/GitLab
4. Sélectionnez le repository de votre projet

### Étape 2: Configuration du service

Configurez votre service avec les paramètres suivants:

| Paramètre | Valeur |
|-----------|--------|
| **Name** | `sitelycee` (ou votre choix) |
| **Region** | Choisir la même région que MongoDB Atlas |
| **Branch** | `main` (ou votre branche) |
| **Root Directory** | `sitelycee-render-main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

### Étape 3: Variables d'environnement

Cliquez sur **"Advanced"** puis ajoutez les variables d'environnement suivantes:

#### Variables OBLIGATOIRES:

```bash
# Node environment
NODE_ENV=production

# MongoDB (REMPLACEZ avec votre URI Atlas)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/sitelyee?retryWrites=true&w=majority

# JWT Secret (GÉNÉREZ un secret unique - voir ci-dessous)
JWT_SECRET=<GÉNÉREZ_UN_SECRET_UNIQUE>
```

**Pour générer un JWT_SECRET sécurisé:**

Ouvrez un terminal et exécutez:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copiez le résultat et utilisez-le comme valeur pour `JWT_SECRET`.

#### Variables OPTIONNELLES:

```bash
# CORS (1 pour autoriser tous les domaines)
CORS_ALLOW_ALL=1

# Logs
LOG_LEVEL=info

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=150

# Upload settings
NSFW_THRESHOLD=0.7
UPLOAD_MAX_DIM=1600
```

### Étape 4: Déployer

1. Cliquez sur **"Create Web Service"**
2. Render va automatiquement:
   - Cloner votre repository
   - Installer les dépendances (`npm install`)
   - Démarrer le serveur (`npm start`)
3. Le premier déploiement peut prendre **5-10 minutes**
4. Une fois terminé, votre URL sera: `https://votre-service.onrender.com`

---

## 3️⃣ Vérification du déploiement

### Tester la connexion

1. Ouvrez l'URL de votre service Render
2. Vérifiez les logs dans le dashboard Render:
   - ✅ `MongoDB connecté` → Succès
   - ✅ `Serveur démarré sur le port XXXX` → Succès
   - ❌ `Erreur MongoDB` → Vérifiez votre `MONGO_URI`

### Endpoints de test

- **Health check**: `https://votre-service.onrender.com/health`
  - Devrait retourner: `{"ok": true}`

- **Page d'accueil**: `https://votre-service.onrender.com/`
  - Devrait afficher votre application React

---

## 🔧 Dépannage

### ❌ Erreur: "MONGO_URI is not set"

**Solution:** Vérifiez que la variable `MONGO_URI` est bien définie dans les variables d'environnement de Render.

### ❌ Erreur: "MongoNetworkError" ou "connection timeout"

**Solutions:**
1. Vérifiez que `0.0.0.0/0` est autorisé dans MongoDB Atlas → Network Access
2. Vérifiez que votre URI contient bien le mot de passe correct
3. Vérifiez que le nom de la base est présent dans l'URI (après `.net/`)

### ❌ Erreur: "Authentication failed"

**Solutions:**
1. Vérifiez le nom d'utilisateur et le mot de passe dans l'URI
2. Si le mot de passe contient des caractères spéciaux (`@`, `#`, etc.), encodez-les:
   - Utilisez https://www.urlencoder.org/
   - Exemple: `p@ssw0rd` → `p%40ssw0rd`

### ❌ Le site ne charge pas / erreur 502

**Solutions:**
1. Vérifiez les logs Render pour les erreurs
2. Assurez-vous que `NODE_ENV=production` est défini
3. Vérifiez que le port est bien détecté (logs: "Serveur démarré sur le port...")

### 💤 Le site est lent au premier chargement

C'est normal avec le plan gratuit de Render. Les instances gratuites s'endorment après 15 minutes d'inactivité et prennent ~30 secondes à se réveiller.

**Solutions:**
- **Upgrade** vers un plan payant ($7/mois) pour éviter le sommeil
- **Utilisez un service de ping** (ex: [UptimeRobot](https://uptimerobot.com/)) pour garder le service actif

---

## 📁 Problème: Uploads de fichiers perdus

⚠️ **IMPORTANT:** Sur Render (plan gratuit), le système de fichiers est **éphémère**. Les fichiers uploadés dans `/uploads` sont perdus à chaque redéploiement.

### Solution recommandée: Cloudinary

1. Créez un compte gratuit sur https://cloudinary.com (25 GB gratuits)
2. Récupérez vos credentials (Dashboard → API Keys)
3. Ajoutez ces variables d'environnement sur Render:
   ```bash
   CLOUDINARY_NAME=votre_cloud_name
   CLOUDINARY_KEY=votre_api_key
   CLOUDINARY_SECRET=votre_api_secret
   ```
4. Modifiez `routes/media.js` pour utiliser Cloudinary au lieu du filesystem local

**Alternative:** Désactivez temporairement les uploads en commentant les routes dans `routes/media.js`.

---

## 🔒 Sécurité en production

### ✅ Checklist de sécurité

- [ ] `JWT_SECRET` unique et sécurisé (32+ caractères aléatoires)
- [ ] `MONGO_URI` avec un mot de passe fort
- [ ] Rate limiting activé (`RATE_LIMIT_MAX=150`)
- [ ] Variables sensibles **uniquement** dans Render (jamais dans le code)
- [ ] `.env` ajouté au `.gitignore`
- [ ] HTTPS activé (automatique sur Render)

---

## 📊 Monitoring

### Logs en temps réel

Dans le dashboard Render, cliquez sur **"Logs"** pour voir:
- Les requêtes HTTP
- Les erreurs
- Les connexions WebSocket
- L'état de MongoDB

### Métriques

Dans **"Metrics"**, surveillez:
- CPU usage
- Memory usage
- Request count
- Response time

---

## 🆙 Mise à jour de l'application

1. **Commitez vos changements** sur GitHub/GitLab
2. **Push** vers la branche configurée (ex: `main`)
3. Render détecte automatiquement les changements et redéploie
4. Le redéploiement prend **2-5 minutes**

Pour désactiver le déploiement automatique:
- Dashboard Render → Settings → Auto-Deploy: **Off**

---

## 💡 Ressources utiles

- [Documentation Render](https://render.com/docs)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Support Render](https://render.com/support)

---

## ❓ Besoin d'aide?

1. Vérifiez les logs dans le dashboard Render
2. Consultez ce guide de dépannage
3. Contactez le support Render (plan gratuit: email seulement)

---

**Dernière mise à jour:** 8 octobre 2025
