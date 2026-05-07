# Deployment Guide - Cari's Family Recipes

This guide provides step-by-step instructions for deploying the Family Recipes application from scratch to Cloudflare's infrastructure. Follow these steps to set up your own instance of the application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Backend Deployment](#backend-deployment)
4. [Frontend Deployment](#frontend-deployment)
5. [Verification](#verification)
6. [CI/CD Setup (Optional)](#cicd-setup-optional)
7. [Troubleshooting](#troubleshooting)
8. [Next Steps](#next-steps)

---

## Prerequisites

Before you begin, ensure you have the following:

### Required Accounts & Tools

- **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com) (free tier works)
- **GitHub Account**: For optional CI/CD automation
- **Node.js & npm**: Version 18 or higher ([nodejs.org](https://nodejs.org))
- **Git**: For cloning the repository

### Install Wrangler CLI

Wrangler is Cloudflare's command-line tool for managing Workers and infrastructure:

```bash
npm install -g wrangler
```

Verify installation:
```bash
wrangler --version
```

### Authenticate Wrangler

Login to your Cloudflare account:

```bash
wrangler login
```

This will open a browser window for authentication. Once complete, Wrangler will have access to your Cloudflare account.

---

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/therobrary/prosek-recipes.git
cd prosek-recipes
```

### 2. Install Dependencies

```bash
npm install
```

---

## Backend Deployment

The backend consists of a Cloudflare Worker (API), D1 database (SQLite), and R2 storage bucket (images).

### Step 1: Create Cloudflare D1 Database

Create a new D1 database to store recipes:

```bash
wrangler d1 create "family-recipes-db"
```

**Important**: Copy the `database_id` from the output. It will look like this:
```
✅ Successfully created DB 'family-recipes-db' in region WEUR
Created your database using D1's new storage backend.

[[d1_databases]]
binding = "DB"
database_name = "family-recipes-db"
database_id = "a486d94c-cf9d-40c7-8b73-a958cccb174e"
```

### Step 2: Create Cloudflare R2 Bucket

Create an R2 bucket for storing recipe images:

```bash
wrangler r2 bucket create "family-recipes-images"
```

You should see:
```
✅ Created bucket 'family-recipes-images' with default storage class set to Standard.
```

### Step 3: Update Backend Configuration

Edit `backend/wrangler.toml` and update the `database_id`:

```toml
name = "family-recipes-backend"
main = "src/index.js"
compatibility_date = "2025-01-01"

[[d1_databases]]
binding = "DB"
database_name = "family-recipes-db"
database_id = "YOUR_DATABASE_ID_HERE"  # ← Replace with your database_id

[[r2_buckets]]
binding = "IMAGES_BUCKET"
bucket_name = "family-recipes-images"
```

### Step 4: Initialize Database Schema

Apply the database schema to create the necessary tables:

```bash
wrangler d1 execute "family-recipes-db" --file=backend/schema.sql --remote
```

You should see:
```
🌀 Mapping SQL input into an array of statements
🌀 Executing on remote database family-recipes-db:
🚣 Executed 2 commands in 0.123 seconds
```

Then apply any pending migrations (run in order):

```bash
wrangler d1 execute "family-recipes-db" --file=backend/migrations/0001_category_to_tags.sql --remote
wrangler d1 execute "family-recipes-db" --file=backend/migrations/0002_add_image_url.sql --remote
wrangler d1 execute "family-recipes-db" --file=backend/migrations/0003_add_updated_at.sql --remote
```

### Step 5: (Optional) Seed with Sample Data

If you want to start with example recipes:

```bash
wrangler d1 execute "family-recipes-db" --file=backend/seed.sql --remote
```

### Step 6: (Optional) Configure Recipe URL Import

The application can import recipes from URLs. It first tries to extract structured JSON-LD data, then optionally falls back to an LLM for extraction.

To enable LLM fallback, set these Worker secrets:

```bash
cd backend

# Set OpenAI-compatible API endpoint
wrangler secret put OPENAI_BASE_URL
# Enter: https://api.openai.com/v1/chat/completions

# Set API key
wrangler secret put OPENAI_API_KEY
# Enter your API key

# Set model name
wrangler secret put OPENAI_MODEL
# Enter: gpt-4o-mini
```

**Note**: You can use any OpenAI-compatible API (OpenAI, Azure OpenAI, local LLM servers, etc.)

If you skip this step, URL import will still work but only for sites with structured JSON-LD data.

### Step 7: Deploy the Backend Worker

Deploy your Worker to Cloudflare:

```bash
cd backend
wrangler deploy
```

You should see output like:
```
Total Upload: XX.XX KiB / gzip: XX.XX KiB
Uploaded family-recipes-backend (X.XX sec)
Published family-recipes-backend (X.XX sec)
  https://family-recipes-backend.YOUR-SUBDOMAIN.workers.dev
```

**Important**: Copy the Worker URL (e.g., `https://family-recipes-backend.YOUR-SUBDOMAIN.workers.dev`). You'll need this for the frontend configuration.

---

## Frontend Deployment

The frontend is a static site deployed to Cloudflare Pages.

### Step 1: Configure API URL

You have two options for configuring the frontend to connect to your backend:

#### Option A: Using the Build Script (Recommended)

Create a distribution build with the correct API URL:

```bash
# From the project root
python3 scripts/build_frontend.py --api-url https://family-recipes-backend.YOUR-SUBDOMAIN.workers.dev/api/recipes
```

This creates a `dist/` folder with the configured frontend.

#### Option B: Manual Configuration

Edit `frontend/js/config.js` and find the line:

```javascript
export const API_URL = 'https://...';
```

Replace it with your Worker URL (from backend deployment) plus `/api/recipes`:

```javascript
export const API_URL = 'https://family-recipes-backend.YOUR-SUBDOMAIN.workers.dev/api/recipes';
```

### Step 2: Deploy to Cloudflare Pages

Deploy the frontend to Cloudflare Pages:

#### If you used the build script:
```bash
wrangler pages deploy dist --project-name=family-recipes-frontend
```

#### If you manually edited index.html:
```bash
wrangler pages deploy frontend --project-name=family-recipes-frontend
```

On first deployment, you'll be prompted:
```
? Create a new project? (Y/n)
```
Type `Y` and press Enter.

After deployment completes, you'll see:
```
✨ Success! Uploaded X files (X.XX sec)

✨ Deployment complete! Take a peek over at https://RANDOM-ID.family-recipes-frontend.pages.dev
```

Your application is now live at the provided URL!

---

## Verification

### 1. Test the Application

1. Open the Cloudflare Pages URL in your browser
2. The homepage should display with a clean, mobile-friendly recipe interface
3. Try creating a test recipe:
   - Click "Add Recipe" or the "+" button
   - Fill in recipe details
   - Add ingredients and directions
   - Upload an image (optional)
   - Save the recipe
4. Verify the recipe appears in your list
5. Test search and filter functionality

### 2. Test Backend API Directly (Optional)

You can test the backend API directly:

```bash
# Get all recipes
curl https://family-recipes-backend.YOUR-SUBDOMAIN.workers.dev/api/recipes

# Should return: {"recipes":[]}  (or your seed data)
```

### 3. Check Database

Verify data is being stored:

```bash
wrangler d1 execute "family-recipes-db" --command="SELECT * FROM recipes" --remote
```

### 4. Check R2 Bucket

If you uploaded images, verify they're stored:

```bash
wrangler r2 object list "family-recipes-images"
```

---

## CI/CD Setup (Optional)

Automate deployments when you push to the `main` branch using GitHub Actions.

### Step 1: Get Cloudflare Credentials

1. **API Token**:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Navigate to: **User Profile** (top right) → **API Tokens**
   - Click **Create Token**
   - Use the **Edit Cloudflare Workers** template
   - Click **Continue to summary** → **Create Token**
   - Copy the token (you won't see it again)

2. **Account ID**:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Select **Workers & Pages** from the left sidebar
   - Your Account ID is displayed on the right sidebar

### Step 2: Add GitHub Secrets

1. Go to your GitHub repository
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add:

   | Name | Value |
   |------|-------|
   | `CLOUDFLARE_API_TOKEN` | Your API token from Step 1 |
   | `CLOUDFLARE_ACCOUNT_ID` | Your Account ID from Step 1 |

4. (Optional) If you want URL import with LLM fallback in CI/CD, also add:
   - `OPENAI_BASE_URL`
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`

### Step 3: Enable Workflow

The repository includes a GitHub Actions workflow at `.github/workflows/deploy.yml`. 

Once you've added the secrets, any push to the `main` branch will automatically:
1. Deploy the backend Worker
2. Deploy the frontend to Pages
3. Update Worker secrets (if configured)

### Step 4: Test CI/CD

Make a small change and push to `main`:

```bash
# Make a change, commit, and push
git add .
git commit -m "Test CI/CD deployment"
git push origin main
```

Check the **Actions** tab in your GitHub repository to see the deployment progress.

---

## Troubleshooting

### Issue: "Error: No such bucket"

**Solution**: Ensure you created the R2 bucket with the exact name `family-recipes-images`:
```bash
wrangler r2 bucket create "family-recipes-images"
```

### Issue: "Error: Database not found"

**Solution**: 
1. Verify you created the database: `wrangler d1 list`
2. Ensure the `database_id` in `backend/wrangler.toml` matches your database
3. Make sure you're deploying from the `backend/` directory

### Issue: Frontend shows "Failed to fetch recipes"

**Solutions**:
1. Check the API URL in `frontend/js/config.js` is correct
2. Verify the backend Worker is deployed: `wrangler deployments list --name=family-recipes-backend`
3. Check CORS settings in `backend/src/index.js` - you may need to add your Pages domain to `ALLOWED_ORIGINS`
4. Test the API directly with curl: `curl https://your-worker.workers.dev/api/recipes`

### Issue: Images not uploading

**Solutions**:
1. Verify R2 bucket exists: `wrangler r2 bucket list`
2. Check bucket name in `backend/wrangler.toml` matches `family-recipes-images`
3. Ensure image size is under 10MB (default limit)
4. Note: All uploaded images are automatically resized (max 1600px) and converted to WebP for optimal performance

### Issue: "Duplicate title" error when saving a recipe

**Solution**: A recipe with that title (case-insensitive) already exists. Choose a different title or edit the existing recipe instead.

### Issue: CI/CD deployment fails

**Solutions**:
1. Verify GitHub secrets are set correctly
2. Check the workflow logs in the **Actions** tab
3. Ensure your Cloudflare API token has the correct permissions
4. Verify the Account ID is correct

### Issue: Database migrations needed

If you're updating from an older version, check `MIGRATION.md` for migration steps.

### Getting Help

- Check the [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- Review [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- Open an issue on the GitHub repository

---

## Next Steps

### Customize Your Instance

1. **Update CORS Origins**: Edit `backend/src/index.js` to add your custom domain to `ALLOWED_ORIGINS`
2. **Custom Domain**: Add a custom domain in Cloudflare Pages settings
3. **PWA Configuration**: Update `frontend/manifest.json` with your app details
4. **Branding**: Customize colors, icons, and text in `frontend/index.html`

### Secure Your Instance

1. **Environment Variables**: Keep sensitive data in Wrangler secrets, not in code
2. **Access Control**: Consider adding authentication if needed
3. **Backup Data**: Regularly export your database:
   ```bash
   wrangler d1 export "family-recipes-db" --remote > backup.sql
   ```

### Monitor & Maintain

1. **View Logs**: Check Worker logs in the Cloudflare Dashboard
2. **Monitor Usage**: Track usage in Cloudflare analytics
3. **Update Dependencies**: Keep Wrangler and dependencies up to date
4. **Database Maintenance**: Periodically check database size and performance

### Advanced Features

- **Import Recipes**: Use the URL import feature to quickly add recipes from websites
- **Scale Servings**: Use the built-in serving scaler for recipes
- **Tag Organization**: Create a tag system for better recipe organization
- **Offline Support**: The app is a PWA and works offline once cached

---

## Summary

You now have a fully functional, serverless recipe management application running on Cloudflare's infrastructure! 

**What you've deployed:**
- ✅ Backend API (Cloudflare Workers)
- ✅ Database (Cloudflare D1)
- ✅ Image Storage (Cloudflare R2)
- ✅ Frontend (Cloudflare Pages)
- ✅ CI/CD Pipeline (GitHub Actions) - Optional

**Your application includes:**
- Recipe creation, editing, and viewing
- Image uploads
- Tagging and categorization
- Search and filter
- Mobile-friendly, responsive design
- PWA support for offline use
- URL-based recipe import

Enjoy your new digital cookbook! 🍳📱
