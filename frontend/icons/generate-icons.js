#!/usr/bin/env node
/**
 * PWA Icon Generator
 *
 * This script generates PNG icons from the SVG source.
 *
 * Prerequisites:
 *   npm install sharp
 *
 * Usage:
 *   node generate-icons.js
 *
 * Alternatively, you can use online tools like:
 *   - https://realfavicongenerator.net/
 *   - https://www.pwabuilder.com/imageGenerator
 */

const fs = require('fs');
const path = require('path');

async function generateIcons() {
    let sharp;
    try {
        sharp = require('sharp');
    } catch (e) {
        console.log('Sharp library not found. Install it with: npm install sharp');
        console.log('\nAlternatively, use an online tool to convert the SVG:');
        console.log('  1. Open icons/icon.svg in a browser');
        console.log('  2. Use https://cloudconvert.com/svg-to-png');
        console.log('  3. Generate sizes: 192x192 and 512x512');
        console.log('  4. Save as icon-192.png, icon-512.png, icon-maskable-192.png, icon-maskable-512.png');
        return;
    }

    const svgPath = path.join(__dirname, 'icon.svg');
    const svgBuffer = fs.readFileSync(svgPath);

    const sizes = [
        { size: 192, name: 'icon-192.png' },
        { size: 512, name: 'icon-512.png' },
        { size: 192, name: 'icon-maskable-192.png' },
        { size: 512, name: 'icon-maskable-512.png' },
        { size: 32, name: 'icon-32.png' },
        { size: 16, name: 'icon-16.png' },
        { size: 152, name: 'icon-152.png' },
    ];

    for (const { size, name } of sizes) {
        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(path.join(__dirname, name));
        console.log(`Generated: ${name}`);
    }

    console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
