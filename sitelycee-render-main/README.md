# Site du Lycée - Version Render

Ce projet est adapté pour être déployé sur **Render** avec Node.js et MongoDB.

> 📌 **IMPORTANT:** Ce projet a été récemment corrigé et optimisé pour Render.  
> Consultez [`CORRECTIONS_APPLIQUEES.md`](./CORRECTIONS_APPLIQUEES.md) pour les détails.

## � Documentation

- **[RENDER_SETUP.md](./RENDER_SETUP.md)** - Guide complet de déploiement sur Render (RECOMMANDÉ)
- **[CORRECTIONS_APPLIQUEES.md](./CORRECTIONS_APPLIQUEES.md)** - Liste des corrections et améliorations
- **[GUIDE_DEPLOYMENT.md](./GUIDE_DEPLOYMENT.md)** - Guide de déploiement original

## 🚀 Déploiement rapide sur Render

### Prérequis
1. Compte [Render](https://render.com) (gratuit)
2. Compte [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (gratuit)

### Étapes
1. **Créez un cluster MongoDB Atlas** (voir [RENDER_SETUP.md](./RENDER_SETUP.md))
2. **Connectez votre dépôt GitHub à Render**
3. **Configurez les variables d'environnement** (voir ci-dessous)
4. **Déployez !**

### Variables d'environnement obligatoires

```bash
NODE_ENV=production
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/sitelyee?retryWrites=true&w=majority
JWT_SECRET=<générez avec: node scripts/generate_jwt_secret.js>
CORS_ALLOW_ALL=1
```

### Variables optionnelles

```bash
LOG_LEVEL=info
RATE_LIMIT_MAX=150
NSFW_THRESHOLD=0.7
UPLOAD_MAX_DIM=1600
```

> 💡 **Astuce:** Utilisez `node scripts/generate_jwt_secret.js` pour générer un JWT_SECRET sécurisé.

## 🎮 Fonctionnalités

- ✅ **Authentification complète** (JWT)
- ✅ **Chat en temps réel** (WebSockets avec validation Zod)
- ✅ **Jeux intégrés** (Menteur, TicTacToe, MMORPG)
- ✅ **Gestion d'événements et clubs**
- ✅ **Upload et modération d'images**
- ✅ **Interface d'administration**
- ✅ **Rate limiting** (protection anti-abus)
- ✅ **Logs structurés** (Pino)

## 🔧 Développement local

```bash
# Installation
npm install

# Générer un JWT_SECRET pour le développement
node scripts/generate_jwt_secret.js

# Copier dans .env:
# JWT_SECRET=<secret_généré>

# Démarrer en mode développement
npm run dev

# Démarrer en production
npm start
```

### Structure du projet

```
sitelycee-render-main/
├── index.js              # Point d'entrée du serveur
├── .env                  # Variables d'environnement (NE PAS commit!)
├── models/               # Modèles MongoDB (Mongoose)
├── routes/               # Routes API Express
├── realtime/             # Logique WebSocket (Socket.IO)
├── middleware/           # Middlewares (auth, erreurs, validation)
├── scripts/              # Scripts utilitaires
├── public/               # Frontend React (build)
└── uploads/              # Uploads temporaires (éphémère sur Render!)
```

## ⚠️ Avertissements importants

### � Uploads éphémères
Les fichiers uploadés dans `/uploads` sont **perdus à chaque redéploiement** sur Render (plan gratuit).

**Solutions:**
- **Cloudinary** (gratuit, recommandé) - voir [RENDER_SETUP.md](./RENDER_SETUP.md)
- **AWS S3**
- **Render Disk** (payant)

### 💤 Latence du plan gratuit
Les instances gratuites Render s'endorment après 15 minutes d'inactivité (~30s de réveil).

**Solutions:**
- Upgrade vers un plan payant ($7/mois)
- Service de ping (UptimeRobot)

## 🧪 Tests

```bash
npm test
```

## �📞 Support

Si vous avez des questions sur le déploiement, consultez :
- **[RENDER_SETUP.md](./RENDER_SETUP.md)** - Guide détaillé avec dépannage
- [Documentation Render](https://render.com/docs)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)

## 🔒 Sécurité

- ✅ JWT pour l'authentification
- ✅ Helmet.js pour les headers de sécurité
- ✅ Rate limiting (150 req/15min)
- ✅ Validation Zod sur les WebSockets
- ✅ CORS configurable
- ✅ Sanitization HTML (sanitize-html)
- ✅ Vérification NSFW des images (Sharp)

## 📝 Licence

Voir [LICENSE](./LICENSE)
