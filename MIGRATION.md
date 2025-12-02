# Database Migration Guide

This update changes the database schema to support multiple tags per recipe instead of a single category.

## Steps to Apply Changes

1.  **Backup Your Data**:
    It is always recommended to backup your D1 database before running manual migrations.
    ```bash
    wrangler d1 export family-recipes-db --remote > backup.sql
    ```

2.  **Run the Migration Script**:
    Execute the migration SQL file against your remote database. This will add the `tags` column, populate it with existing `category` data, and remove the old `category` column.
    ```bash
    wrangler d1 execute family-recipes-db --file=backend/migrations/0001_category_to_tags.sql --remote
    ```

3.  **Deploy the Updated Backend**:
    The backend code has been updated to handle the new schema. Deploy it:
    ```bash
    cd backend
    wrangler deploy
    ```

4.  **Deploy the Updated Frontend**:
    Deploy the frontend changes to Cloudflare Pages (or your hosting provider):
    ```bash
    # From project root
    wrangler pages deploy frontend --project-name=family-recipes-frontend
    ```

## Verification
After deployment, open the application. Existing recipes should show their old category as a tag. You should be able to add multiple tags to new or existing recipes.
