/**
 * Recipe sorting utilities
 */
export const sorter = {
    /**
     * Sort recipes by the specified criteria
     */
    sort(recipes, sortBy, favorites = []) {
        const sorted = [...recipes];
        
        switch (sortBy) {
            case 'title':
                sorted.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'title-desc':
                sorted.sort((a, b) => b.title.localeCompare(a.title));
                break;
            case 'newest':
                sorted.sort((a, b) => (b.id || 0) - (a.id || 0));
                break;
            case 'oldest':
                sorted.sort((a, b) => (a.id || 0) - (b.id || 0));
                break;
            case 'favorites':
                sorted.sort((a, b) => {
                    const aFav = favorites.includes(a.id) ? 1 : 0;
                    const bFav = favorites.includes(b.id) ? 1 : 0;
                    if (bFav !== aFav) return bFav - aFav;
                    return a.title.localeCompare(b.title);
                });
                break;
            default:
                sorted.sort((a, b) => a.title.localeCompare(b.title));
        }
        
        return sorted;
    }
};
