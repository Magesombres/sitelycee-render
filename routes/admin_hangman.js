// Route admin temporaire pour seed Hangman (À SUPPRIMER APRÈS UTILISATION)
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const HangmanWord = require('../models/HangmanWord');
const { authMiddleware, isAdmin } = require('../middleware/authMiddleware');

// Route pour seed (TEMPORAIRE - supprimer après utilisation !)
router.post('/seed-hangman-words', authMiddleware, isAdmin, async (req, res) => {
  try {
    // Supprimerles anciens mots
    await HangmanWord.deleteMany({});
    
    const wordsData = [
      // ANIMAUX
      { word: 'CHAT', category: 'animaux', difficulty: 'facile', hint: 'Félin domestique' },
      { word: 'CHIEN', category: 'animaux', difficulty: 'facile', hint: 'Meilleur ami de l\'homme' },
      { word: 'OISEAU', category: 'animaux', difficulty: 'facile', hint: 'Animal qui vole' },
      { word: 'POULE', category: 'animaux', difficulty: 'facile', hint: 'Pond des œufs' },
      { word: 'VACHE', category: 'animaux', difficulty: 'facile', hint: 'Donne du lait' },
      { word: 'LAPIN', category: 'animaux', difficulty: 'facile', hint: 'Aime les carottes' },
      { word: 'SOURIS', category: 'animaux', difficulty: 'facile', hint: 'Petit rongeur' },
      { word: 'ELEPHANT', category: 'animaux', difficulty: 'moyen', hint: 'Le plus gros animal terrestre' },
      { word: 'GIRAFE', category: 'animaux', difficulty: 'moyen', hint: 'A un très long cou' },
      { word: 'KANGOUROU', category: 'animaux', difficulty: 'moyen', hint: 'Marsupial australien' },
      { word: 'CROCODILE', category: 'animaux', difficulty: 'moyen', hint: 'Reptile des rivières' },
      { word: 'PAPILLON', category: 'animaux', difficulty: 'moyen', hint: 'Insecte coloré' },
      { word: 'PINGOUIN', category: 'animaux', difficulty: 'moyen', hint: 'Oiseau des régions froides' },
      { word: 'TORTUE', category: 'animaux', difficulty: 'moyen', hint: 'Porte sa maison sur son dos' },
      { word: 'HIPPOPOTAME', category: 'animaux', difficulty: 'difficile', hint: 'Gros mammifère aquatique' },
      { word: 'RHINOCEROS', category: 'animaux', difficulty: 'difficile', hint: 'A une corne sur le nez' },
      
      // VILLES
      { word: 'PARIS', category: 'villes', difficulty: 'facile', hint: 'Capitale de la France' },
      { word: 'LYON', category: 'villes', difficulty: 'facile', hint: 'Ville gastronomique' },
      { word: 'MARSEILLE', category: 'villes', difficulty: 'moyen', hint: 'Plus vieille ville de France' },
      { word: 'TOULOUSE', category: 'villes', difficulty: 'moyen', hint: 'Ville rose' },
      { word: 'BORDEAUX', category: 'villes', difficulty: 'moyen', hint: 'Ville du vin' },
      { word: 'NICE', category: 'villes', difficulty: 'facile', hint: 'Ville de la Côte d\'Azur' },
      { word: 'STRASBOURG', category: 'villes', difficulty: 'difficile', hint: 'Capitale européenne' },
      { word: 'LONDRES', category: 'villes', difficulty: 'moyen', hint: 'Capitale du Royaume-Uni' },
      { word: 'ROME', category: 'villes', difficulty: 'facile', hint: 'Capitale de l\'Italie' },
      { word: 'TOKYO', category: 'villes', difficulty: 'facile', hint: 'Capitale du Japon' },
      
      // PAYS
      { word: 'FRANCE', category: 'pays', difficulty: 'facile', hint: 'Pays du fromage' },
      { word: 'ESPAGNE', category: 'pays', difficulty: 'facile', hint: 'Pays de la paella' },
      { word: 'ITALIE', category: 'pays', difficulty: 'facile', hint: 'Pays des pâtes' },
      { word: 'ALLEMAGNE', category: 'pays', difficulty: 'moyen', hint: 'Pays de la bière' },
      { word: 'PORTUGAL', category: 'pays', difficulty: 'moyen', hint: 'Pays voisin de l\'Espagne' },
      { word: 'BELGIQUE', category: 'pays', difficulty: 'moyen', hint: 'Pays des frites' },
      
      // MÉTIERS
      { word: 'DOCTEUR', category: 'metiers', difficulty: 'facile', hint: 'Soigne les malades' },
      { word: 'POMPIER', category: 'metiers', difficulty: 'facile', hint: 'Éteint les feux' },
      { word: 'CUISINIER', category: 'metiers', difficulty: 'moyen', hint: 'Prépare les plats' },
      { word: 'ARCHITECTE', category: 'metiers', difficulty: 'difficile', hint: 'Dessine les bâtiments' },
      { word: 'POLICIER', category: 'metiers', difficulty: 'moyen', hint: 'Fait respecter la loi' },
      { word: 'PROFESSEUR', category: 'metiers', difficulty: 'moyen', hint: 'Enseigne aux élèves' },
      
      // SPORTS
      { word: 'FOOTBALL', category: 'sports', difficulty: 'facile', hint: 'Sport le plus populaire' },
      { word: 'TENNIS', category: 'sports', difficulty: 'facile', hint: 'Sport de raquette' },
      { word: 'NATATION', category: 'sports', difficulty: 'moyen', hint: 'Sport aquatique' },
      { word: 'BASKETBALL', category: 'sports', difficulty: 'moyen', hint: 'Sport avec un panier' },
      { word: 'VOLLEYBALL', category: 'sports', difficulty: 'moyen', hint: 'Sport avec un filet' },
      { word: 'ATHLETISME', category: 'sports', difficulty: 'difficile', hint: 'Course, saut, lancer' },
      
      // FRUITS (catégorie: nourriture)
      { word: 'POMME', category: 'nourriture', difficulty: 'facile', hint: 'Fruit rouge ou vert' },
      { word: 'BANANE', category: 'nourriture', difficulty: 'facile', hint: 'Fruit jaune allongé' },
      { word: 'FRAISE', category: 'nourriture', difficulty: 'facile', hint: 'Petit fruit rouge' },
      { word: 'ANANAS', category: 'nourriture', difficulty: 'moyen', hint: 'Fruit tropical épineux' },
      { word: 'PASTEQUE', category: 'nourriture', difficulty: 'moyen', hint: 'Gros fruit d\'été' },
      { word: 'KIWI', category: 'nourriture', difficulty: 'facile', hint: 'Fruit vert poilu' },
      
      // LÉGUMES (catégorie: nourriture)
      { word: 'CAROTTE', category: 'nourriture', difficulty: 'facile', hint: 'Légume orange' },
      { word: 'TOMATE', category: 'nourriture', difficulty: 'facile', hint: 'Fruit-légume rouge' },
      { word: 'SALADE', category: 'nourriture', difficulty: 'facile', hint: 'Feuilles vertes' },
      { word: 'COURGETTE', category: 'nourriture', difficulty: 'moyen', hint: 'Légume vert allongé' },
      { word: 'AUBERGINE', category: 'nourriture', difficulty: 'moyen', hint: 'Légume violet' },
      { word: 'POIVRON', category: 'nourriture', difficulty: 'moyen', hint: 'Légume de différentes couleurs' },
      
      // COULEURS (catégorie: general)
      { word: 'ROUGE', category: 'general', difficulty: 'facile', hint: 'Couleur du sang' },
      { word: 'BLEU', category: 'general', difficulty: 'facile', hint: 'Couleur du ciel' },
      { word: 'VERT', category: 'general', difficulty: 'facile', hint: 'Couleur de l\'herbe' },
      { word: 'JAUNE', category: 'general', difficulty: 'facile', hint: 'Couleur du soleil' },
      { word: 'VIOLET', category: 'general', difficulty: 'moyen', hint: 'Mélange de bleu et rouge' },
      { word: 'ROSE', category: 'general', difficulty: 'facile', hint: 'Rouge clair' },
      { word: 'NOIR', category: 'general', difficulty: 'facile', hint: 'Couleur de la nuit' },
    ];
    
    // Ajouter automatiquement le champ length à chaque mot
    const words = wordsData.map(wordData => ({
      ...wordData,
      length: wordData.word.length
    }));
    
    await HangmanWord.insertMany(words);
    
    res.json({ 
      success: true, 
      message: `${words.length} mots insérés avec succès !`,
      count: words.length
    });
  } catch (error) {
    console.error('Erreur seed:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
