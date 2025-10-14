// Settings Manager for Hangman

const API_BASE = window.location.origin;

// Default settings
const DEFAULT_SETTINGS = {
  theme: 'dark',
  primaryColor: '#9333ea',
  secondaryColor: '#ec4899',
  displayMode: 'classic',
  animations: true,
  soundEnabled: true,
  volume: 0.5,
  showUsedLetters: true,
  autoHint: true,
  confirmQuit: true,
  difficulty: 'medium'
};

// Settings Manager
class SettingsManager {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.token = localStorage.getItem('token');
  }

  // Load settings from API
  async loadFromAPI() {
    if (!this.token) {
      console.warn('[Settings] Pas de token, utilisation des paramètres par défaut');
      this.loadFromLocalStorage();
      return this.settings;
    }

    try {
      const response = await fetch(`${API_BASE}/hangman/stats`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      if (response.ok) {
        const stats = await response.json();
        this.settings = { ...DEFAULT_SETTINGS, ...stats.settings };
        this.saveToLocalStorage();
        return this.settings;
      } else {
        console.warn('[Settings] Erreur API, utilisation localStorage');
        this.loadFromLocalStorage();
        return this.settings;
      }
    } catch (err) {
      console.error('[Settings] Erreur chargement:', err);
      this.loadFromLocalStorage();
      return this.settings;
    }
  }

  // Save settings to API
  async saveToAPI(newSettings) {
    if (!this.token) {
      console.warn('[Settings] Pas de token, sauvegarde en localStorage uniquement');
      this.settings = { ...this.settings, ...newSettings };
      this.saveToLocalStorage();
      return this.settings;
    }

    try {
      const response = await fetch(`${API_BASE}/hangman/stats/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(newSettings)
      });

      if (response.ok) {
        const stats = await response.json();
        this.settings = { ...DEFAULT_SETTINGS, ...stats.settings };
        this.saveToLocalStorage();
        return this.settings;
      } else {
        throw new Error('Erreur lors de la sauvegarde');
      }
    } catch (err) {
      console.error('[Settings] Erreur sauvegarde:', err);
      // Fallback to localStorage
      this.settings = { ...this.settings, ...newSettings };
      this.saveToLocalStorage();
      return this.settings;
    }
  }

  // Load from localStorage
  loadFromLocalStorage() {
    const stored = localStorage.getItem('hangman_settings');
    if (stored) {
      try {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } catch (err) {
        console.error('[Settings] Erreur parse localStorage:', err);
        this.settings = { ...DEFAULT_SETTINGS };
      }
    }
  }

  // Save to localStorage
  saveToLocalStorage() {
    localStorage.setItem('hangman_settings', JSON.stringify(this.settings));
  }

  // Apply settings to DOM
  apply() {
    document.body.setAttribute('data-theme', this.settings.theme);
    document.body.setAttribute('data-display', this.settings.displayMode);
    document.body.setAttribute('data-animations', this.settings.animations);

    // Apply custom colors
    if (this.settings.primaryColor) {
      document.documentElement.style.setProperty('--primary-color', this.settings.primaryColor);
    }
    if (this.settings.secondaryColor) {
      document.documentElement.style.setProperty('--secondary-color', this.settings.secondaryColor);
    }
  }

  // Get single setting
  get(key) {
    return this.settings[key];
  }

  // Get all settings
  getAll() {
    return { ...this.settings };
  }

  // Reset to defaults
  reset() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveToLocalStorage();
    if (this.token) {
      this.saveToAPI(this.settings);
    }
    this.apply();
    return this.settings;
  }
}

// Export for use in other files
if (typeof window !== 'undefined') {
  window.SettingsManager = SettingsManager;
}
