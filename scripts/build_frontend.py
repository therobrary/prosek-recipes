#!/usr/bin/env python3
"""
Build the frontend for deployment.

Copies the entire frontend/ directory to dist/ and injects the API_URL
into both index.html (inline app) and js/config.js (modular app).

Usage:
    python3 scripts/build_frontend.py --api-url https://your-worker.workers.dev/api/recipes
"""
import os
import argparse
import sys
import re
import shutil

API_URL_PATTERN = r"(const API_URL\s*=\s*)['\"](.*?)['\"]"

def inject_api_url(filepath, api_url):
    """Replace API_URL in a file. Returns True if a replacement was made."""
    with open(filepath, 'r') as f:
        content = f.read()

    def replacer(m):
        return f"{m.group(1)}'{api_url}'"

    new_content, count = re.subn(API_URL_PATTERN, replacer, content)

    if count == 0:
        # Fallback: literal placeholder
        new_content = content.replace('__API_URL__', api_url)
        count = 1 if '__API_URL__' in content else 0

    if count > 0:
        with open(filepath, 'w') as f:
            f.write(new_content)

    return count > 0

def build_frontend(api_url):
    frontend_dir = 'frontend'
    dist_dir = 'dist'

    if not os.path.isdir(frontend_dir):
        print(f"Error: {frontend_dir}/ not found.")
        sys.exit(1)

    # Clean and recreate dist/
    if os.path.isdir(dist_dir):
        shutil.rmtree(dist_dir)
    shutil.copytree(frontend_dir, dist_dir)

    # Inject API_URL into index.html (inline app)
    index_path = os.path.join(dist_dir, 'index.html')
    if os.path.exists(index_path):
        injected = inject_api_url(index_path, api_url)
        print(f"  index.html: {'updated' if injected else 'no API_URL found'}")

    # Inject API_URL into js/config.js (modular app)
    config_path = os.path.join(dist_dir, 'js', 'config.js')
    if os.path.exists(config_path):
        injected = inject_api_url(config_path, api_url)
        print(f"  js/config.js: {'updated' if injected else 'no API_URL found'}")
    else:
        print(f"  js/config.js: not found (skipping)")

    print(f"\nBuild complete. Output in {dist_dir}/ with API_URL={api_url}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Build frontend with environment variables')
    parser.add_argument('--api-url', required=True, help='The API URL to inject')
    args = parser.parse_args()
    build_frontend(args.api_url)
