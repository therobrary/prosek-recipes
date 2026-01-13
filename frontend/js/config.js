/**
 * Application configuration
 */
export const API_URL = 'https://family-recipes-backend.robrary.workers.dev/api/recipes';

export const SORT_OPTIONS = [
    { value: 'title', label: 'A-Z' },
    { value: 'title-desc', label: 'Z-A' },
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'favorites', label: 'Favorites First' }
];

export const CATEGORY_COLORS = {
    'Dessert': 'bg-pink-100 text-pink-800',
    'Main Dish': 'bg-red-100 text-red-800',
    'Soup & Stew': 'bg-yellow-100 text-yellow-800',
    'Salad': 'bg-green-100 text-green-800',
    'Breakfast': 'bg-blue-100 text-blue-800',
    'Beverage': 'bg-purple-100 text-purple-800',
    'Mexican': 'bg-orange-100 text-orange-800',
    'Pasta & Italian': 'bg-emerald-100 text-emerald-800'
};

export const VALIDATION_LIMITS = {
    title: 200,
    serves: 100,
    cookTime: 100,
    ingredient: 500,
    direction: 2000,
    tag: 50
};
