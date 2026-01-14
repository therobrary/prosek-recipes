/**
 * API service for recipe operations
 */
import { API_URL } from './config.js';

export const api = {
    /**
     * Fetch all recipes
     */
    async fetchRecipes() {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error('Failed to fetch recipes');
        }
        return response.json();
    },

    /**
     * Create a new recipe
     */
    async createRecipe(recipeData) {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(recipeData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (errorData.details) {
                throw new Error(errorData.details.join(', '));
            }
            throw new Error(errorData.error || 'Failed to create recipe');
        }
        
        return response.json();
    },

    /**
     * Update an existing recipe
     */
    async updateRecipe(id, recipeData) {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(recipeData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (errorData.details) {
                throw new Error(errorData.details.join(', '));
            }
            throw new Error(errorData.error || 'Failed to update recipe');
        }
        
        return response.json();
    },

    /**
     * Delete a recipe
     */
    async deleteRecipe(id) {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete recipe');
        }
        
        return response.json();
    },

    /**
     * Upload an image
     */
    async uploadImage(file) {
        const uploadUrl = API_URL.replace('/api/recipes', '') + '/api/upload-image';
        const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type
            },
            body: file
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Image upload failed');
        }

        return response.json();
    },

    /**
     * Import a recipe from a thirdparty URL
     */
    async importRecipeFromUrl(url) {
        const importUrl = API_URL.replace('/api/recipes', '') + '/api/recipes/import';
        const response = await fetch(importUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            const details = Array.isArray(data.details) ? data.details.join(', ') : null;
            throw new Error(details || data.error || 'Failed to import recipe');
        }

        return data;
    }
};
