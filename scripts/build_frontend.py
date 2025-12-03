import os
import argparse
import sys
import re

def build_frontend(api_url):
    frontend_dir = 'frontend'
    dist_dir = 'dist'
    input_file = os.path.join(frontend_dir, 'index.html')
    output_file = os.path.join(dist_dir, 'index.html')

    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        sys.exit(1)

    if not os.path.exists(dist_dir):
        os.makedirs(dist_dir)

    with open(input_file, 'r') as f:
        content = f.read()

    # Regex to find: const API_URL = '...'; or "..."
    pattern = r"const API_URL\s*=\s*['\"].*?['\"];"
    replacement = f"const API_URL = '{api_url}';"

    new_content, count = re.subn(pattern, replacement, content)

    if count == 0:
        # If regex fails, try replacing specific placeholder if it existed (though we rely on regex mostly)
        new_content = content.replace('__API_URL__', api_url)

    with open(output_file, 'w') as f:
        f.write(new_content)

    print(f"Build complete. Output written to {output_file} with API_URL={api_url}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Build frontend with environment variables')
    parser.add_argument('--api-url', required=True, help='The API URL to inject')
    args = parser.parse_args()

    build_frontend(args.api_url)
