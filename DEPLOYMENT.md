# Deployment Guide for Cari's Family Recipes

This project consists of a Cloudflare Worker backend (using D1 database) and a static HTML frontend.

## Prerequisites

1.  **Cloudflare Account**: You need a Cloudflare account.
2.  **Node.js & NPM**: Ensure you have Node.js installed.
3.  **Wrangler CLI**: Install the Cloudflare Wrangler CLI globally:
    ```bash
    npm install -g wrangler
    ```
4.  **Login**: Authenticate Wrangler with your Cloudflare account:
    ```bash
    wrangler login
    ```

## Backend Deployment

1.  **Create the D1 Database**:
    Run the following command to create a new D1 database for the project:
    ```bash
    wrangler d1 create family-recipes-db
    ```
    *Copy the `database_id` from the output of this command.*

2.  **Configure `wrangler.toml`**:
    Open `backend/wrangler.toml` and replace `YOUR_DATABASE_ID` with the ID you copied in the previous step.

3.  **Apply Schema**:
    Create the database tables by executing the schema file:
    ```bash
    wrangler d1 execute family-recipes-db --file=backend/schema.sql --remote
    ```

4.  **Seed Data (Optional)**:
    Populate the database with initial recipes:
    ```bash
    wrangler d1 execute family-recipes-db --file=backend/seed.sql --remote
    ```

5.  **Deploy the Worker**:
    Navigate to the backend directory and deploy:
    ```bash
    cd backend
    wrangler deploy
    ```
    *Note the "Worker URL" displayed in the output (e.g., `https://family-recipes-backend.<your-subdomain>.workers.dev`).*

## Frontend Deployment

1.  **Update API URL**:
    Open `frontend/index.html` in a text editor.
    Find the line:
    ```javascript
    const API_URL = '/api/recipes';
    ```
    Replace `'/api/recipes'` with your full Worker URL from the backend deployment step, appending `/api/recipes`:
    ```javascript
    const API_URL = 'https://family-recipes-backend.<your-subdomain>.workers.dev/api/recipes';
    ```

2.  **Deploy to Cloudflare Pages**:
    You can deploy the `frontend` directory directly to Cloudflare Pages.

    **Option A: Using Wrangler (Recommended)**
    From the root of the project (ensure you are in `prosek-recipes/`, not `backend/`):
    ```bash
    wrangler pages deploy frontend --project-name=family-recipes-frontend
    ```
    Follow the prompts to create the project.

    **Option B: Cloudflare Dashboard**
    1.  Go to the Cloudflare Dashboard > Pages.
    2.  Click "Create a project" > "Direct Upload".
    3.  Upload the `frontend` folder.

3.  **Access the App**:
    Visit the URL provided by Cloudflare Pages after deployment!
