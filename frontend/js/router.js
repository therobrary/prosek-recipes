/**
 * URL routing utilities using History API
 */
export const router = {
    /**
     * Get the current recipe ID from the URL hash
     */
    getRecipeIdFromHash() {
        const hash = window.location.hash;
        if (hash.startsWith('#/recipe/')) {
            return parseInt(hash.replace('#/recipe/', ''), 10);
        }
        return null;
    },

    /**
     * Update URL to show a specific recipe
     */
    pushRecipe(recipeId) {
        const newUrl = `#/recipe/${recipeId}`;
        if (window.location.hash !== newUrl) {
            history.pushState({ recipeId }, '', newUrl);
        }
    },

    /**
     * Clear the recipe from the URL
     */
    clearRecipe() {
        if (window.location.hash !== '' && window.location.hash !== '#') {
            history.pushState({}, '', window.location.pathname);
        }
    },

    /**
     * Get the full shareable URL for a recipe
     */
    getRecipeUrl(recipeId) {
        return window.location.origin + window.location.pathname + `#/recipe/${recipeId}`;
    }
};
