-- Migration: Convert category to tags
-- 1. Add new tags column
ALTER TABLE recipes ADD COLUMN tags TEXT;

-- 2. Migrate existing categories to tags (as a JSON array containing the single category)
UPDATE recipes SET tags = '["' || category || '"]' WHERE category IS NOT NULL;
UPDATE recipes SET tags = '[]' WHERE category IS NULL;

-- 3. Drop the old category column
ALTER TABLE recipes DROP COLUMN category;
