// Script pour peupler la base de données avec des mots français pour le jeu du pendu
const mongoose = require('mongoose');
const HangmanWord = require('../models/HangmanWord');

// Connexion à MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sitelyee';

const wordsByCategory = {
  animaux: [
    // Facile (4-6 lettres)
    { word: 'CHAT', difficulty: 'facile', hint: 'Félin domestique' },
    { word: 'CHIEN', difficulty: 'facile', hint: 'Meilleur ami de l\'homme' },
    { word: 'OISEAU', difficulty: 'facile', hint: 'Animal qui vole' },
    { word: 'POULE', difficulty: 'facile', hint: 'Pond des œufs' },
    { word: 'VACHE', difficulty: 'facile', hint: 'Donne du lait' },
    { word: 'LAPIN', difficulty: 'facile', hint: 'Aime les carottes' },
    { word: 'SOURIS', difficulty: 'facile', hint: 'Petit rongeur' },
    // Moyen (7-10 lettres)
    { word: 'ELEPHANT', difficulty: 'moyen', hint: 'Le plus gros animal terrestre' },
    { word: 'GIRAFE', difficulty: 'moyen', hint: 'A un très long cou' },
    { word: 'KANGOUROU', difficulty: 'moyen', hint: 'Marsupial australien' },
    { word: 'CROCODILE', difficulty: 'moyen', hint: 'Reptile des rivières' },
    { word: 'PAPILLON', difficulty: 'moyen', hint: 'Insecte coloré' },
    { word: 'PINGOUIN', difficulty: 'moyen', hint: 'Oiseau des régions froides' },
    { word: 'TORTUE', difficulty: 'moyen', hint: 'Porte sa maison sur son dos' },
    // Difficile (11+ lettres)
    { word: 'HIPPOPOTAME', difficulty: 'difficile', hint: 'Gros mammifère aquatique' },
    { word: 'RHINOCEROS', difficulty: 'difficile', hint: 'A une corne sur le nez' },
    { word: 'CHAUVE-SOURIS', difficulty: 'difficile', hint: 'Mammifère volant nocturne' }
  ],
  
  villes: [
    // France
    { word: 'PARIS', difficulty: 'facile', hint: 'Capitale de la France' },
    { word: 'LYON', difficulty: 'facile', hint: 'Ville gastronomique' },
    { word: 'MARSEILLE', difficulty: 'moyen', hint: 'Plus vieille ville de France' },
    { word: 'TOULOUSE', difficulty: 'moyen', hint: 'Ville rose' },
    { word: 'BORDEAUX', difficulty: 'moyen', hint: 'Ville du vin' },
    { word: 'NICE', difficulty: 'facile', hint: 'Ville de la Côte d\'Azur' },
    { word: 'STRASBOURG', difficulty: 'difficile', hint: 'Capitale européenne' },
    // Monde
    { word: 'LONDRES', difficulty: 'moyen', hint: 'Capitale du Royaume-Uni' },
    { word: 'ROME', difficulty: 'facile', hint: 'Capitale de l\'Italie' },
    { word: 'TOKYO', difficulty: 'facile', hint: 'Capitale du Japon' },
    { word: 'NEW YORK', difficulty: 'moyen', hint: 'Big Apple' },
    { word: 'BARCELONE', difficulty: 'moyen', hint: 'Ville de Gaudi' }
  ],
  
  pays: [
    { word: 'FRANCE', difficulty: 'facile', hint: 'Pays du fromage' },
    { word: 'ESPAGNE', difficulty: 'moyen', hint: 'Pays de la paella' },
    { word: 'ITALIE', difficulty: 'facile', hint: 'Pays des pâtes' },
    { word: 'ALLEMAGNE', difficulty: 'moyen', hint: 'Pays de la bière' },
    { word: 'JAPON', difficulty: 'facile', hint: 'Pays du soleil levant' },
    { word: 'BRESIL', difficulty: 'facile', hint: 'Pays du football' },
    { word: 'CANADA', difficulty: 'facile', hint: 'Pays du sirop d\'érable' },
    { word: 'AUSTRALIE', difficulty: 'moyen', hint: 'Pays des kangourous' },
    { word: 'ANGLETERRE', difficulty: 'difficile', hint: 'Pays de la reine' },
    { word: 'PORTUGAL', difficulty: 'moyen', hint: 'Pays voisin de l\'Espagne' }
  ],
  
  metiers: [
    { word: 'MEDECIN', difficulty: 'moyen', hint: 'Soigne les malades' },
    { word: 'AVOCAT', difficulty: 'facile', hint: 'Défend en justice' },
    { word: 'BOULANGER', difficulty: 'moyen', hint: 'Fait du pain' },
    { word: 'POMPIER', difficulty: 'moyen', hint: 'Éteint les incendies' },
    { word: 'PROFESSEUR', difficulty: 'difficile', hint: 'Enseigne' },
    { word: 'FERMIER', difficulty: 'moyen', hint: 'Travaille à la ferme' },
    { word: 'POLICIER', difficulty: 'moyen', hint: 'Protège les citoyens' },
    { word: 'CUISINIER', difficulty: 'moyen', hint: 'Prépare les repas' },
    { word: 'ARCHITECTE', difficulty: 'difficile', hint: 'Conçoit des bâtiments' },
    { word: 'MUSICIEN', difficulty: 'moyen', hint: 'Joue de la musique' }
  ],
  
  objets: [
    { word: 'LIVRE', difficulty: 'facile', hint: 'Pour lire' },
    { word: 'STYLO', difficulty: 'facile', hint: 'Pour écrire' },
    { word: 'CHAISE', difficulty: 'facile', hint: 'Pour s\'asseoir' },
    { word: 'TABLE', difficulty: 'facile', hint: 'Meuble plat' },
    { word: 'ORDINATEUR', difficulty: 'difficile', hint: 'Machine informatique' },
    { word: 'TELEPHONE', difficulty: 'moyen', hint: 'Pour appeler' },
    { word: 'LUNETTES', difficulty: 'moyen', hint: 'Pour mieux voir' },
    { word: 'MONTRE', difficulty: 'facile', hint: 'Donne l\'heure' },
    { word: 'VOITURE', difficulty: 'moyen', hint: 'Véhicule à moteur' },
    { word: 'BICYCLETTE', difficulty: 'difficile', hint: 'Vélo' }
  ],
  
  nourriture: [
    { word: 'PAIN', difficulty: 'facile', hint: 'Aliment de base' },
    { word: 'FROMAGE', difficulty: 'moyen', hint: 'Produit laitier' },
    { word: 'POMME', difficulty: 'facile', hint: 'Fruit rouge ou vert' },
    { word: 'BANANE', difficulty: 'facile', hint: 'Fruit jaune' },
    { word: 'CHOCOLAT', difficulty: 'moyen', hint: 'Friandise adorée' },
    { word: 'PIZZA', difficulty: 'facile', hint: 'Spécialité italienne' },
    { word: 'CROISSANT', difficulty: 'moyen', hint: 'Viennoiserie française' },
    { word: 'SPAGHETTI', difficulty: 'moyen', hint: 'Pâtes longues' },
    { word: 'HAMBURGER', difficulty: 'moyen', hint: 'Fast-food américain' },
    { word: 'CREPE', difficulty: 'facile', hint: 'Spécialité bretonne' }
  ],
  
  sports: [
    { word: 'FOOTBALL', difficulty: 'moyen', hint: 'Sport avec un ballon rond' },
    { word: 'TENNIS', difficulty: 'facile', hint: 'Sport avec une raquette' },
    { word: 'NATATION', difficulty: 'moyen', hint: 'Sport dans l\'eau' },
    { word: 'BASKETBALL', difficulty: 'difficile', hint: 'Sport avec un panier' },
    { word: 'RUGBY', difficulty: 'facile', hint: 'Sport avec un ballon ovale' },
    { word: 'ATHLETISME', difficulty: 'difficile', hint: 'Course, saut, lancer' },
    { word: 'JUDO', difficulty: 'facile', hint: 'Art martial japonais' },
    { word: 'CYCLISME', difficulty: 'moyen', hint: 'Sport à vélo' },
    { word: 'ESCALADE', difficulty: 'moyen', hint: 'Grimper' },
    { word: 'ESCRIME', difficulty: 'moyen', hint: 'Sport avec une épée' }
  ],
  
  general: [
    { word: 'SOLEIL', difficulty: 'facile', hint: 'Étoile de notre système' },
    { word: 'LUNE', difficulty: 'facile', hint: 'Satellite de la Terre' },
    { word: 'ETOILE', difficulty: 'facile', hint: 'Brille dans le ciel' },
    { word: 'MONTAGNE', difficulty: 'moyen', hint: 'Sommet élevé' },
    { word: 'OCEAN', difficulty: 'facile', hint: 'Grande étendue d\'eau' },
    { word: 'FORET', difficulty: 'facile', hint: 'Beaucoup d\'arbres' },
    { word: 'DESERT', difficulty: 'facile', hint: 'Région aride' },
    { word: 'RIVIERE', difficulty: 'moyen', hint: 'Cours d\'eau' },
    { word: 'VOLCAN', difficulty: 'facile', hint: 'Crache de la lave' },
    { word: 'ARC-EN-CIEL', difficulty: 'difficile', hint: 'Couleurs après la pluie' },
    { word: 'MAISON', difficulty: 'facile', hint: 'Habitation' },
    { word: 'ECOLE', difficulty: 'facile', hint: 'Lieu d\'apprentissage' },
    { word: 'HOPITAL', difficulty: 'moyen', hint: 'Soigne les malades' },
    { word: 'RESTAURANT', difficulty: 'difficile', hint: 'On y mange' },
    { word: 'BIBLIOTHEQUE', difficulty: 'difficile', hint: 'Plein de livres' },
    { word: 'CINEMA', difficulty: 'facile', hint: 'Pour voir des films' },
    { word: 'THEATRE', difficulty: 'moyen', hint: 'Pour voir des pièces' },
    { word: 'MUSEE', difficulty: 'facile', hint: 'Exposition d\'art' },
    { word: 'JARDIN', difficulty: 'facile', hint: 'Espace avec des plantes' },
    { word: 'PARC', difficulty: 'facile', hint: 'Espace vert en ville' }
  ]
};

async function seedWords() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connecté à MongoDB');

    // Supprimer les mots existants
    await HangmanWord.deleteMany({});
    console.log('🗑️  Mots existants supprimés');

    let totalAdded = 0;

    // Ajouter les mots par catégorie
    for (const [category, words] of Object.entries(wordsByCategory)) {
      for (const wordData of words) {
        await HangmanWord.create({
          word: wordData.word,
          category,
          difficulty: wordData.difficulty,
          length: wordData.word.replace(/[- ]/g, '').length, // Sans espaces ni tirets
          hint: wordData.hint
        });
        totalAdded++;
      }
      console.log(`✅ Catégorie "${category}": ${words.length} mots ajoutés`);
    }

    console.log(`\n🎉 Total: ${totalAdded} mots ajoutés avec succès!`);
    
    // Statistiques
    const stats = await HangmanWord.aggregate([
      { $group: { 
        _id: { category: '$category', difficulty: '$difficulty' }, 
        count: { $sum: 1 } 
      }},
      { $sort: { '_id.category': 1, '_id.difficulty': 1 } }
    ]);
    
    console.log('\n📊 Répartition:');
    stats.forEach(s => {
      console.log(`  ${s._id.category} (${s._id.difficulty}): ${s.count} mots`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Déconnexion de MongoDB');
    process.exit(0);

  } catch (err) {
    console.error('❌ Erreur:', err);
    process.exit(1);
  }
}

// Lancer le script
seedWords();
