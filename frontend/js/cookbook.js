/**
 * Main Cookbook Alpine.js component
 * This module brings together all the utilities and provides the main app logic
 */
import { API_URL, SORT_OPTIONS, CATEGORY_COLORS } from './config.js';
import { storage } from './storage.js';
import { router } from './router.js';
import { validator } from './validation.js';
import { ingredientScaler } from './ingredient-scaler.js';
import { share } from './share.js';
import { api } from './api.js';
import { sorter } from './sorter.js';

export function cookbook() {
    return {
        // State
        recipes: [],
        isLoading: false,
        error: null,
        searchQuery: '',
        selectedTags: [],
        allTags: [],
        selectedRecipe: null,
        showFormModal: false,
        multiplier: 1,
        tagInput: '',
        uploading: false,
        saving: false,
        selectedFile: null,
        darkMode: document.documentElement.classList.contains('dark'),
        isOffline: !navigator.onLine,
        favorites: storage.getFavorites(),
        sortBy: storage.getSortPreference(),
        sortOptions: SORT_OPTIONS,
        toast: {
            show: false,
            message: '',
            type: 'success'
        },
        formErrors: {},
        formData: {
            id: null,
            title: '',
            tags: [],
            serves: '',
            cook_time: '',
            ingredientsText: '',
            directionsText: '',
            image_url: null
        },

        // Toast notifications
        showToast(message, type = 'success') {
            this.toast.message = message;
            this.toast.type = type;
            this.toast.show = true;
            setTimeout(() => {
                this.toast.show = false;
            }, 4000);
        },

        // Dark mode
        toggleDarkMode() {
            this.darkMode = !this.darkMode;
            if (this.darkMode) {
                document.documentElement.classList.add('dark');
                storage.setTheme('dark');
                document.querySelector('meta[name="theme-color"]').setAttribute('content', '#111827');
            } else {
                document.documentElement.classList.remove('dark');
                storage.setTheme('light');
                document.querySelector('meta[name="theme-color"]').setAttribute('content', '#10B981');
            }
        },

        // Initialization
        async init() {
            // Set up online/offline listeners
            window.addEventListener('online', () => { this.isOffline = false; });
            window.addEventListener('offline', () => { this.isOffline = true; });

            // Handle URL routing
            window.addEventListener('popstate', () => this.handleRoute());

            await this.fetchRecipes();
            this.handleRoute();
        },

        // Routing
        handleRoute() {
            const recipeId = router.getRecipeIdFromHash();
            if (recipeId) {
                const recipe = this.recipes.find(r => r.id === recipeId);
                if (recipe) {
                    this.selectedRecipe = recipe;
                    this.multiplier = 1;
                }
            } else {
                this.selectedRecipe = null;
            }
        },

        updateUrl(recipe = null) {
            if (recipe) {
                router.pushRecipe(recipe.id);
            } else {
                router.clearRecipe();
            }
        },

        // Data fetching
        async fetchRecipes() {
            this.isLoading = true;
            this.error = null;
            try {
                this.recipes = await api.fetchRecipes();
                
                // Extract unique tags
                const tagsSet = new Set();
                this.recipes.forEach(r => {
                    if (Array.isArray(r.tags)) {
                        r.tags.forEach(t => {
                            if (t && t.trim()) {
                                tagsSet.add(t);
                            }
                        });
                    }
                });
                this.allTags = Array.from(tagsSet).sort();
            } catch (error) {
                console.error('Error loading recipes:', error);
                this.error = 'Unable to load recipes. Please check your connection and try again.';
            } finally {
                this.isLoading = false;
            }
        },

        // Filtering and sorting
        get filteredRecipes() {
            if (!this.recipes) return [];

            const query = this.searchQuery.toLowerCase();

            let results = this.recipes.filter(recipe => {
                const matchesSearch = recipe.title.toLowerCase().includes(query) ||
                                      recipe.ingredients.some(i => i.toLowerCase().includes(query));
                const matchesTags = this.selectedTags.length === 0 ||
                                    this.selectedTags.every(tag => recipe.tags && recipe.tags.includes(tag));
                return matchesSearch && matchesTags;
            });

            return sorter.sort(results, this.sortBy, this.favorites);
        },

        toggleTag(tag) {
            if (this.selectedTags.includes(tag)) {
                this.selectedTags = this.selectedTags.filter(t => t !== tag);
            } else {
                this.selectedTags.push(tag);
            }
        },

        getCategoryColor(category) {
            return CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-800';
        },

        // Recipe navigation
        openRecipe(recipe) {
            this.selectedRecipe = recipe;
            this.multiplier = 1;
            this.updateUrl(recipe);
        },

        closeRecipe() {
            this.selectedRecipe = null;
            this.updateUrl(null);
        },

        resetFilters() {
            this.selectedTags = [];
            this.searchQuery = '';
        },

        // Favorites
        toggleFavorite(recipeId) {
            const index = this.favorites.indexOf(recipeId);
            if (index > -1) {
                this.favorites.splice(index, 1);
            } else {
                this.favorites.push(recipeId);
            }
            storage.setFavorites(this.favorites);
        },

        isFavorite(recipeId) {
            return this.favorites.includes(recipeId);
        },

        // Sorting
        setSortBy(value) {
            this.sortBy = value;
            storage.setSortPreference(value);
        },

        // Sharing
        async shareRecipe(recipe) {
            await share.shareRecipe(recipe, this.showToast.bind(this));
        },

        copyRecipeLink(recipe) {
            share.copyToClipboard(recipe, this.showToast.bind(this));
        },

        // Ingredient scaling
        scaleIngredient(ingredient, multiplier) {
            return ingredientScaler.scale(ingredient, multiplier);
        },

        getStepNumber(directions, currentIndex) {
            let stepNumber = 0;
            for (let i = 0; i <= currentIndex; i++) {
                if (!directions[i].startsWith('__SECTION__')) {
                    stepNumber++;
                }
            }
            return stepNumber;
        },

        // Form handling
        validateForm() {
            this.formErrors = validator.validateRecipeForm(this.formData);
            return validator.isValid(this.formErrors);
        },

        openForm(recipe = null) {
            this.tagInput = '';
            this.selectedFile = null;
            this.formErrors = {};
            if (recipe) {
                this.formData = {
                    id: recipe.id,
                    title: recipe.title,
                    tags: recipe.tags ? [...recipe.tags] : [],
                    serves: recipe.serves,
                    cook_time: recipe.cook_time,
                    ingredientsText: recipe.ingredients.join('\n'),
                    directionsText: recipe.directions.join('\n'),
                    image_url: recipe.image_url || null
                };
            } else {
                this.formData = {
                    id: null,
                    title: '',
                    tags: [],
                    serves: '',
                    cook_time: '',
                    ingredientsText: '',
                    directionsText: '',
                    image_url: null
                };
            }
            this.showFormModal = true;
        },

        closeForm() {
            this.showFormModal = false;
            this.tagInput = '';
            this.selectedFile = null;
            this.formErrors = {};
            this.formData = {
                id: null,
                title: '',
                tags: [],
                serves: '',
                cook_time: '',
                ingredientsText: '',
                directionsText: '',
                image_url: null
            };
        },

        handleFileSelect(event) {
            const file = event.target.files[0];
            if (file) {
                this.selectedFile = file;
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.formData.image_url = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        },

        addTag() {
            const tag = this.tagInput.trim();
            const normalizedTag = tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
            if (normalizedTag && !this.formData.tags.some(t => t.toLowerCase() === normalizedTag.toLowerCase())) {
                this.formData.tags.push(normalizedTag);
            }
            this.tagInput = '';
        },

        removeTag(index) {
            this.formData.tags.splice(index, 1);
        },

        handleBackspace() {
            if (this.tagInput === '' && this.formData.tags.length > 0) {
                this.formData.tags.pop();
            }
        },

        async saveRecipe() {
            if (this.tagInput.trim()) {
                this.addTag();
            }

            if (!this.validateForm()) {
                this.showToast('Please fix the errors in the form', 'error');
                return;
            }

            this.saving = true;
            this.uploading = false;
            let imageUrl = this.formData.image_url;

            // Upload image if selected
            if (this.selectedFile) {
                this.uploading = true;
                try {
                    const uploadResult = await api.uploadImage(this.selectedFile);
                    imageUrl = uploadResult.url;
                } catch (e) {
                    console.error('Image upload error:', e);
                    this.showToast(`Failed to upload image: ${e.message}`, 'error');
                    this.saving = false;
                    this.uploading = false;
                    return;
                }
                this.uploading = false;
            }

            const recipeData = {
                title: this.formData.title,
                tags: this.formData.tags,
                serves: this.formData.serves,
                cook_time: this.formData.cook_time,
                ingredients: this.formData.ingredientsText.split('\n').filter(line => line.trim() !== ''),
                directions: this.formData.directionsText.split('\n').filter(line => line.trim() !== ''),
                image_url: imageUrl
            };

            try {
                if (this.formData.id) {
                    await api.updateRecipe(this.formData.id, recipeData);
                } else {
                    await api.createRecipe(recipeData);
                }

                await this.fetchRecipes();
                this.closeForm();
                this.showToast(
                    this.formData.id ? 'Recipe updated successfully!' : 'Recipe added successfully!',
                    'success'
                );

                if (this.formData.id && this.selectedRecipe && this.selectedRecipe.id === this.formData.id) {
                    this.selectedRecipe = this.recipes.find(r => r.id === this.formData.id);
                }
            } catch (error) {
                console.error('Error saving recipe:', error);
                this.showToast(`Failed to save recipe: ${error.message}`, 'error');
            } finally {
                this.saving = false;
                this.uploading = false;
            }
        }
    };
}

// Export for global access
window.cookbook = cookbook;
