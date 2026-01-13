/**
 * Form validation utilities
 */
import { VALIDATION_LIMITS } from './config.js';

export const validator = {
    /**
     * Validate the recipe form data
     * @param {Object} formData - The form data to validate
     * @returns {Object} - Object with field names as keys and error messages as values
     */
    validateRecipeForm(formData) {
        const errors = {};

        // Title validation
        if (!formData.title.trim()) {
            errors.title = 'Title is required';
        } else if (formData.title.length > VALIDATION_LIMITS.title) {
            errors.title = `Title must be ${VALIDATION_LIMITS.title} characters or less`;
        }

        // Serves validation
        if (formData.serves && formData.serves.length > VALIDATION_LIMITS.serves) {
            errors.serves = `Serves must be ${VALIDATION_LIMITS.serves} characters or less`;
        }

        // Cook time validation
        if (formData.cook_time && formData.cook_time.length > VALIDATION_LIMITS.cookTime) {
            errors.cook_time = `Cook time must be ${VALIDATION_LIMITS.cookTime} characters or less`;
        }

        // Ingredients validation
        const ingredients = formData.ingredientsText
            .split('\n')
            .filter(line => line.trim() !== '');
        
        if (ingredients.length === 0) {
            errors.ingredients = 'At least one ingredient is required';
        } else if (ingredients.some(i => i.length > VALIDATION_LIMITS.ingredient)) {
            errors.ingredients = `Each ingredient must be ${VALIDATION_LIMITS.ingredient} characters or less`;
        }

        // Directions validation
        const directions = formData.directionsText
            .split('\n')
            .filter(line => line.trim() !== '');
        
        if (directions.length === 0) {
            errors.directions = 'At least one direction is required';
        } else if (directions.some(d => d.length > VALIDATION_LIMITS.direction)) {
            errors.directions = `Each direction must be ${VALIDATION_LIMITS.direction} characters or less`;
        }

        // Tags validation
        if (formData.tags.some(t => t.length > VALIDATION_LIMITS.tag)) {
            errors.tags = `Each tag must be ${VALIDATION_LIMITS.tag} characters or less`;
        }

        return errors;
    },

    /**
     * Check if validation passed
     */
    isValid(errors) {
        return Object.keys(errors).length === 0;
    }
};
