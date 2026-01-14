# Cari's Family Recipes

A digital cookbook application for preserving and sharing treasured family recipes. This project is built as a serverless application on the Cloudflare platform, ensuring high availability, low latency, and minimal maintenance.

## Features

*   **Recipe Management:** Create, read, and update recipes.
*   **Rich Media:** Upload and attach photos to your recipes.
*   **Tagging System:** Organize recipes with flexible tags (e.g., "Dinner", "Dessert", "Vegetarian").
*   **Smart Scaling:** Automatically scale ingredient amounts for different serving sizes.
*   **Mobile-First Design:** Fully responsive UI/UX designed for use in the kitchen on phones and tablets.
*   **PWA Support:** Installable as a Progressive Web App (PWA).
*   **Search & Filter:** Instant search and category filtering.

## Tech Stack

*   **Frontend:**
    *   Static HTML/JS
    *   [Alpine.js](https://alpinejs.dev/) for interactivity
    *   [Tailwind CSS](https://tailwindcss.com/) for styling
    *   Cloudflare Pages for hosting
*   **Backend:**
    *   [Cloudflare Workers](https://workers.cloudflare.com/) (Serverless JavaScript)
    *   [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite Database)
    *   [Cloudflare R2](https://developers.cloudflare.com/r2/) (Object Storage for images)

## Documentation

*   **[Deployment Guide](DEPLOYMENT.md):** Complete instructions for setting up the infrastructure and deploying the application to your own Cloudflare account.
*   **[Migration History](MIGRATION.md):** A log of database schema changes and updates.

## Project Structure

*   `backend/`: Contains the Worker code, database schema, and `wrangler.toml` configuration.
*   `frontend/`: Contains the static website files (`index.html`, assets).
*   `scripts/`: Utility scripts (e.g., `build_frontend.py` for environment injection).
*   `.github/workflows/`: CI/CD configuration for automated deployment via GitHub Actions.

## Quick Start (Local Development)

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Run Backend (Local):**
    ```bash
    cd backend
    npm run start
    # or
    npx wrangler dev
    ```

3.  **Run Frontend:**
    You can serve the `frontend` directory using any static file server (e.g., `python3 -m http.server` inside `frontend/`) or simply open `frontend/index.html` in your browser (though some features requiring the API may need CORS configuration or a proxy).

## License

[MIT](LICENSE)
