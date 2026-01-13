/**
 * Share utilities using Web Share API
 */
import { router } from './router.js';

export const share = {
    /**
     * Check if native sharing is supported
     */
    isSupported() {
        return navigator.share && navigator.canShare;
    },

    /**
     * Share a recipe using native share or clipboard fallback
     */
    async shareRecipe(recipe, showToast) {
        const shareData = {
            title: recipe.title,
            text: `Check out this recipe: ${recipe.title}`,
            url: router.getRecipeUrl(recipe.id)
        };

        if (this.isSupported() && navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData);
                return true;
            } catch (err) {
                if (err.name !== 'AbortError') {
                    return this.copyToClipboard(recipe, showToast);
                }
                return false;
            }
        } else {
            return this.copyToClipboard(recipe, showToast);
        }
    },

    /**
     * Copy recipe link to clipboard
     */
    async copyToClipboard(recipe, showToast) {
        const url = router.getRecipeUrl(recipe.id);
        try {
            await navigator.clipboard.writeText(url);
            if (showToast) {
                showToast('Link copied to clipboard!', 'success');
            }
            return true;
        } catch {
            if (showToast) {
                showToast('Could not copy link', 'error');
            }
            return false;
        }
    }
};
