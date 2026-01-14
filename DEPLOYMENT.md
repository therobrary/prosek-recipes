# Deployment Guide for Cari's Family Recipes

This guide covers the setup and deployment of the application to the Cloudflare platform. The system is composed of a Worker (Backend), a D1 Database, an R2 Storage Bucket, and a Pages site (Frontend).

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

## 1. Backend Infrastructure Setup

### Create Resources

1.  **Create the D1 Database**:
    ```bash
    wrangler d1 create family-recipes-db
    ```
    *Copy the `database_id` from the output.*

2.  **Create the R2 Bucket**:
    This bucket will store recipe images.
    ```bash
    wrangler r2 bucket create family-recipes-images
    ```

### Configure Backend

1.  **Update `wrangler.toml`**:
    Open `backend/wrangler.toml`.
    *   Replace the `database_id` under `[[d1_databases]]` with the ID you copied.
    *   Ensure the `bucket_name` under `[[r2_buckets]]` matches `family-recipes-images`.

2.  **Initialize Database**:
    Apply the schema to create the necessary tables.
    ```bash
    wrangler d1 execute family-recipes-db --file=backend/schema.sql --remote
    ```
    *(Optional) Seed with initial data:*
    ```bash
    wrangler d1 execute family-recipes-db --file=backend/seed.sql --remote
    ```

### Deploy Backend Worker

#### Configure recipe URL import (optional)

The backend supports importing recipes by URL (JSON-LD first, then optional LLM fallback).

If you want the LLM fallback enabled, set these Worker secrets:

- `OPENAI_BASE_URL`: Full OpenAI-compatible chat-completions endpoint URL (e.g. `https://your-host.example/v1/chat/completions`)
- `OPENAI_API_KEY`: API key for that endpoint
- `OPENAI_MODEL`: Model name (e.g. `gpt-4o-mini`)

Set Worker secrets via Wrangler:
```bash
cd backend
wrangler secret put OPENAI_BASE_URL
wrangler secret put OPENAI_API_KEY
wrangler secret put OPENAI_MODEL
```

Navigate to the backend directory and deploy:
```bash
cd backend
wrangler deploy
```
*Note the "Worker URL" displayed in the output (e.g., `https://family-recipes-backend.<your-subdomain>.workers.dev`). You will need this for the frontend.*

## 2. Frontend Deployment

### Configuration

1.  **Update API URL**:
    Open `frontend/index.html` in a text editor.
    Find the line:
    ```javascript
    const API_URL = 'https://...';
    ```
    Replace the URL with your deployed Worker URL (from the previous step), ensuring you append `/api/recipes`.
    
    *Example:*
    ```javascript
    const API_URL = 'https://family-recipes-backend.my-subdomain.workers.dev/api/recipes';
    ```

### Deploy to Cloudflare Pages

You can deploy the `frontend` folder directly to Cloudflare Pages.

**Using Wrangler (Recommended)**
From the project root (not `backend/`):
```bash
wrangler pages deploy frontend --project-name=family-recipes-frontend
```
Follow the prompts to create the project if it's your first time.

## 3. Automated Deployment (CI/CD)

This repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically deploys changes when you push to the `main` branch.

### Setup Secrets in GitHub

To enable this, go to your GitHub repository **Settings > Secrets and variables > Actions** and add the following secrets:

*   `CLOUDFLARE_API_TOKEN`: Create this in your Cloudflare Dashboard (User Profile > API Tokens) with the "Edit Cloudflare Workers" template.
*   `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID (found on the right sidebar of the Cloudflare Dashboard overview).

Once configured, any commit to `main` will trigger a deployment of both the backend and frontend.

If you want URL import LLM fallback enabled via CI/CD, also add these secrets to GitHub Actions:

- `OPENAI_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Then update your workflow (`.github/workflows/deploy.yml`) to pass them as Wrangler secrets (or run `wrangler secret put ...` in the workflow).

## 4. Local Development

To run the project locally:

1.  **Backend**:
    ```bash
    cd backend
    wrangler dev --local --persist
    ```
    This starts a local instance of the Worker with a local D1 database and R2 bucket simulation.

2.  **Frontend**:
    You can use the python script to build a distribution version pointing to your local API, or simply edit `index.html` to point to `http://localhost:8787/api/recipes`.