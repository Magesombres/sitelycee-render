#!/usr/bin/env node

/**
 * Générateur de JWT_SECRET sécurisé
 * 
 * Usage:
 *   node scripts/generate_jwt_secret.js
 * 
 * Ce script génère un secret aléatoire de 32 bytes encodé en base64
 * à utiliser comme JWT_SECRET dans vos variables d'environnement.
 */

const crypto = require('crypto');

console.log('\n🔐 Générateur de JWT_SECRET sécurisé\n');
console.log('━'.repeat(60));

const secret = crypto.randomBytes(32).toString('base64');

console.log('\n✅ Votre JWT_SECRET généré:\n');
console.log(`   ${secret}\n`);
console.log('━'.repeat(60));
console.log('\n📋 Instructions:\n');
console.log('1. Copiez le secret ci-dessus');
console.log('2. Sur Render, allez dans Environment → Variables');
console.log('3. Ajoutez une nouvelle variable:');
console.log('   - Nom: JWT_SECRET');
console.log(`   - Valeur: ${secret}`);
console.log('\n⚠️  IMPORTANT: Ne partagez JAMAIS ce secret publiquement!\n');
