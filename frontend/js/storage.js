/**
 * Storage utilities for localStorage operations
 */
const KEYS = {
    FAVORITES: 'recipe-favorites',
    SORT: 'recipe-sort',
    THEME: 'theme',
    PWA_DISMISSED: 'pwa-install-dismissed'
};

export const storage = {
    getFavorites() {
        try {
            return JSON.parse(localStorage.getItem(KEYS.FAVORITES) || '[]');
        } catch {
            return [];
        }
    },

    setFavorites(favorites) {
        localStorage.setItem(KEYS.FAVORITES, JSON.stringify(favorites));
    },

    getSortPreference() {
        return localStorage.getItem(KEYS.SORT) || 'title';
    },

    setSortPreference(value) {
        localStorage.setItem(KEYS.SORT, value);
    },

    getTheme() {
        return localStorage.getItem(KEYS.THEME);
    },

    setTheme(theme) {
        localStorage.setItem(KEYS.THEME, theme);
    },

    isPWADismissed() {
        return localStorage.getItem(KEYS.PWA_DISMISSED) === 'true';
    },

    dismissPWA() {
        localStorage.setItem(KEYS.PWA_DISMISSED, 'true');
    }
};
