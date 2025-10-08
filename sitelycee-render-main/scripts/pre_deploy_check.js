#!/usr/bin/env node

/**
 * Script de vérification pré-déploiement
 * 
 * Ce script vérifie que votre application est prête à être déployée sur Render.
 * 
 * Usage:
 *   node scripts/pre_deploy_check.js
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 Vérification pré-déploiement pour Render\n');
console.log('═'.repeat(60));

let errors = 0;
let warnings = 0;

// Vérification 1: Fichiers essentiels
console.log('\n📁 Vérification des fichiers essentiels...');
const requiredFiles = [
  'index.js',
  'package.json',
  '.env.example',
  '.gitignore',
  'Procfile',
];

requiredFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, '..', file))) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} manquant`);
    errors++;
  }
});

// Vérification 2: package.json
console.log('\n📦 Vérification de package.json...');
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  
  if (pkg.scripts && pkg.scripts.start) {
    console.log(`  ✅ Script "start" défini: ${pkg.scripts.start}`);
  } else {
    console.log('  ❌ Script "start" manquant dans package.json');
    errors++;
  }
  
  // Vérifier les dépendances essentielles
  const requiredDeps = ['express', 'mongoose', 'dotenv', 'socket.io', 'zod'];
  requiredDeps.forEach(dep => {
    if (pkg.dependencies && pkg.dependencies[dep]) {
      console.log(`  ✅ Dépendance "${dep}" présente`);
    } else {
      console.log(`  ❌ Dépendance "${dep}" manquante`);
      errors++;
    }
  });
} catch (e) {
  console.log('  ❌ Erreur lors de la lecture de package.json');
  errors++;
}

// Vérification 3: .env (ne doit pas être commité)
console.log('\n🔐 Vérification de la sécurité...');
if (fs.existsSync(path.join(__dirname, '..', '.env'))) {
  console.log('  ⚠️  Fichier .env détecté (local)');
  console.log('      ATTENTION: Assurez-vous qu\'il est dans .gitignore');
  warnings++;
} else {
  console.log('  ✅ Pas de fichier .env (normal pour un repo)');
}

// Vérification 4: .gitignore
console.log('\n🚫 Vérification de .gitignore...');
try {
  const gitignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
  
  if (gitignore.includes('.env')) {
    console.log('  ✅ .env est ignoré par git');
  } else {
    console.log('  ❌ .env devrait être dans .gitignore');
    errors++;
  }
  
  if (gitignore.includes('node_modules')) {
    console.log('  ✅ node_modules est ignoré par git');
  } else {
    console.log('  ❌ node_modules devrait être dans .gitignore');
    errors++;
  }
} catch (e) {
  console.log('  ⚠️  Impossible de lire .gitignore');
  warnings++;
}

// Vérification 5: Structure des dossiers
console.log('\n📂 Vérification de la structure...');
const requiredDirs = ['models', 'routes', 'middleware', 'realtime', 'public'];
requiredDirs.forEach(dir => {
  if (fs.existsSync(path.join(__dirname, '..', dir))) {
    console.log(`  ✅ Dossier "${dir}" présent`);
  } else {
    console.log(`  ⚠️  Dossier "${dir}" manquant`);
    warnings++;
  }
});

// Vérification 6: Code source
console.log('\n📝 Vérification du code source...');
try {
  const indexContent = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  
  if (indexContent.includes('0.0.0.0')) {
    console.log('  ✅ Binding sur 0.0.0.0 détecté (requis par Render)');
  } else {
    console.log('  ⚠️  Pas de binding sur 0.0.0.0 détecté');
    console.log('      Assurez-vous que server.listen() utilise "0.0.0.0"');
    warnings++;
  }
  
  if (indexContent.includes('process.env.PORT')) {
    console.log('  ✅ Utilisation de process.env.PORT détecté');
  } else {
    console.log('  ❌ process.env.PORT non détecté');
    console.log('      Render impose le port via cette variable');
    errors++;
  }
  
  if (indexContent.includes('process.env.MONGO_URI') || indexContent.includes('process.env.MONGODB_URI')) {
    console.log('  ✅ Utilisation de MONGO_URI via env détecté');
  } else {
    console.log('  ❌ MONGO_URI non configuré via process.env');
    errors++;
  }
} catch (e) {
  console.log('  ❌ Erreur lors de la lecture de index.js');
  errors++;
}

// Vérification 7: Documentation
console.log('\n📚 Vérification de la documentation...');
const docFiles = ['README.md', 'RENDER_SETUP.md', 'QUICK_START.md'];
docFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, '..', file))) {
    console.log(`  ✅ ${file} présent`);
  } else {
    console.log(`  ⚠️  ${file} manquant`);
    warnings++;
  }
});

// Résumé
console.log('\n' + '═'.repeat(60));
console.log('\n📊 RÉSUMÉ\n');

if (errors === 0 && warnings === 0) {
  console.log('🎉 PARFAIT ! Votre application est prête pour Render !\n');
  console.log('Prochaines étapes:');
  console.log('  1. Lisez QUICK_START.md pour déployer en 10 minutes');
  console.log('  2. Configurez MongoDB Atlas');
  console.log('  3. Générez un JWT_SECRET: node scripts/generate_jwt_secret.js');
  console.log('  4. Déployez sur Render\n');
  process.exit(0);
} else if (errors === 0) {
  console.log(`⚠️  ${warnings} avertissement(s) détecté(s)\n`);
  console.log('Votre application devrait fonctionner, mais vérifiez les avertissements ci-dessus.\n');
  process.exit(0);
} else {
  console.log(`❌ ${errors} erreur(s) et ${warnings} avertissement(s) détecté(s)\n`);
  console.log('Corrigez les erreurs avant de déployer sur Render.\n');
  process.exit(1);
}
