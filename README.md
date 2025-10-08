# Site du Lycée - Version Render

Ce projet est adapté pour être déployé sur **Render** avec Node.js et MongoDB.

## 🚀 Déploiement sur Render

### Étapes automatisées :
1. **Connectez votre dépôt GitHub à Render**
2. **Configurez les variables d'environnement** (voir ci-dessous)
3. **Render se charge du reste !**

### Variables d'environnement à configurer sur Render :

```
NODE_ENV=production
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/sitelyee
JWT_SECRET=your_super_secret_jwt_key_here
LOG_LEVEL=info
CORS_ALLOW_ALL=1
```

### Base de données :
- Vous pouvez utiliser **MongoDB Atlas** (gratuit) ou **Render PostgreSQL** (avec adaptation du code)
- Pour MongoDB Atlas : https://www.mongodb.com/cloud/atlas

## 🎮 Fonctionnalités

- ✅ **Authentification complète**
- ✅ **Chat en temps réel** (WebSockets)
- ✅ **Jeux intégrés** (Menteur, TicTacToe, MMORPG)
- ✅ **Gestion d'événements**
- ✅ **Upload et modération d'images**
- ✅ **Interface d'administration**

## 🔧 Développement local

```bash
npm install
npm run dev
```

## 📞 Support

Si vous avez des questions sur le déploiement, consultez :
- [Documentation Render](https://render.com/docs)
- [MongoDB Atlas Setup](https://docs.atlas.mongodb.com/getting-started/)