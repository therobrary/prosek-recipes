/**
 * Ingredient scaling utilities
 */
export const ingredientScaler = {
    /**
     * Scale an ingredient amount by a multiplier
     */
    scale(ingredient, multiplier) {
        if (multiplier === 1) return ingredient;
        if (ingredient.startsWith('__SECTION__')) return ingredient;

        // Regex to find leading numbers (integers, decimals, fractions)
        return ingredient.replace(/^([\d\s\/.\-]+)(.*)/, (match, amount, rest) => {
            // Check if it's a range (e.g. 1-2)
            if (amount.includes('-') && !amount.includes('/')) {
                const parts = amount.split('-').map(p => this.parseNumber(p.trim()));
                if (parts.every(p => !isNaN(p))) {
                    const scaled = parts.map(p => this.formatNumber(p * multiplier)).join('-');
                    return `${scaled}${rest}`;
                }
            }

            const val = this.parseNumber(amount.trim());
            if (!isNaN(val)) {
                let suffix = rest;
                if (suffix && !suffix.startsWith(' ') && /^[a-zA-Z]/.test(suffix)) {
                    suffix = ' ' + suffix;
                }
                return `${this.formatNumber(val * multiplier)}${suffix}`;
            }
            return match;
        });
    },

    /**
     * Parse a number string (supports fractions like "1/2" or "1 1/2")
     */
    parseNumber(str) {
        if (!str) return NaN;
        str = str.trim();
        
        // Mixed number (e.g., "1 1/2")
        if (str.includes(' ')) {
            const parts = str.split(' ');
            if (parts.length === 2) {
                return this.parseNumber(parts[0]) + this.parseNumber(parts[1]);
            }
        }
        
        // Fraction (e.g., "1/2")
        if (str.includes('/')) {
            const [num, den] = str.split('/');
            return parseFloat(num) / parseFloat(den);
        }
        
        return parseFloat(str);
    },

    /**
     * Format a number back to a nice string (with fractions for common values)
     */
    formatNumber(num) {
        if (Number.isInteger(num)) return num.toString();

        const tolerance = 0.05;
        const decimal = num - Math.floor(num);
        const whole = Math.floor(num);

        const fractions = {
            0.25: '1/4',
            0.33: '1/3',
            0.5: '1/2',
            0.66: '2/3',
            0.75: '3/4'
        };

        for (const [val, str] of Object.entries(fractions)) {
            if (Math.abs(decimal - parseFloat(val)) < tolerance) {
                return whole > 0 ? `${whole} ${str}` : str;
            }
        }

        return parseFloat(num.toFixed(2)).toString();
    }
};
