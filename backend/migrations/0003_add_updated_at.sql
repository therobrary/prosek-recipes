-- Migration: Add updated_at column
ALTER TABLE recipes ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
