// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://recipes.robrary.com',
  'https://family-recipes-backend.robrary.workers.dev',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
];

const DEFAULT_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (compatible; FamilyRecipesBot/1.0; +https://recipes.robrary.com)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const MAX_IMPORT_HTML_BYTES = 2_000_000;
const MAX_IMPORT_IMAGE_BYTES = 10_000_000;

function getString(value) {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return null;
  if (Array.isArray(value) && value.length > 0) return getString(value[0]);
  if (typeof value === 'number') return String(value);
  return null;
}

function isProbablyBlockedHost(hostname) {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '127.0.0.1' || host === '::1') return true;

  // Block literal private IPv4 ranges. (DNS-based checks are limited in Workers.)
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;

  return false;
}

function extractJsonLdScripts(html) {
  const scripts = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const content = match[1]?.trim();
    if (content) scripts.push(content);
  }
  return scripts;
}

function asArray(value) {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeType(typeValue) {
  if (typeof typeValue === 'string') return [typeValue];
  if (Array.isArray(typeValue)) return typeValue.filter(t => typeof t === 'string');
  return [];
}

function findRecipeInJsonLd(jsonLdObj) {
  const candidates = [];

  const visit = obj => {
    if (!obj || typeof obj !== 'object') return;

    const types = normalizeType(obj['@type']);
    if (types.includes('Recipe')) {
      candidates.push(obj);
    }

    if (Array.isArray(obj['@graph'])) {
      for (const item of obj['@graph']) visit(item);
    }
  };

  if (Array.isArray(jsonLdObj)) {
    for (const item of jsonLdObj) visit(item);
  } else {
    visit(jsonLdObj);
  }

  // Sometimes pages nest a Recipe inside an array without @graph.
  if (candidates.length === 0 && jsonLdObj && typeof jsonLdObj === 'object') {
    for (const value of Object.values(jsonLdObj)) {
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
      }
    }
  }

  return candidates[0] || null;
}

function normalizeInstructions(instructions) {
  if (!instructions) return [];

  if (typeof instructions === 'string') {
    return instructions
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  const out = [];

  for (const item of asArray(instructions)) {
    if (!item) continue;

    if (typeof item === 'string') {
      const text = item.trim();
      if (text) out.push(text);
      continue;
    }

    if (typeof item === 'object') {
      const types = normalizeType(item['@type']);

      if (types.includes('HowToSection')) {
        const name = getString(item.name);
        if (name) out.push(`__SECTION__${name}`);

        const steps = normalizeInstructions(item.itemListElement || item.steps || item.elements);
        for (const step of steps) out.push(step);
        continue;
      }

      const text = getString(item.text) || getString(item.name);
      if (text) out.push(text.trim());

      const nested = item.itemListElement || item.steps || item.elements;
      if (nested) {
        for (const step of normalizeInstructions(nested)) out.push(step);
      }
    }
  }

  return out.filter(Boolean);
}

function mapJsonLdRecipeToModel(recipe, fallbackTitle) {
  const title = (getString(recipe.name) || fallbackTitle || '').trim();

  const ingredients = asArray(recipe.recipeIngredient)
    .map(i => (typeof i === 'string' ? i.trim() : ''))
    .filter(Boolean);

  const directions = normalizeInstructions(recipe.recipeInstructions);

  const serves = getString(recipe.recipeYield);
  const cookTime = getString(recipe.totalTime) || getString(recipe.cookTime) || getString(recipe.prepTime);

  const imageUrl =
    getString(recipe.image) ||
    (recipe.image && typeof recipe.image === 'object' ? getString(recipe.image.url) : null);

  return {
    title,
    serves: serves || null,
    cook_time: cookTime || null,
    ingredients,
    directions,
    tags: [],
    image_url: imageUrl || null,
  };
}

async function fetchTextWithLimit(targetUrl) {
  const response = await fetch(targetUrl, { headers: DEFAULT_FETCH_HEADERS, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to fetch URL (status ${response.status})`);
  }

  const contentLength = response.headers.get('Content-Length');
  if (contentLength && Number(contentLength) > MAX_IMPORT_HTML_BYTES) {
    throw new Error('Page too large to import');
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_IMPORT_HTML_BYTES) {
    throw new Error('Page too large to import');
  }

  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    throw new Error('URL did not return an HTML page');
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
}

function stripHtmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitleFromHtml(html) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  return match[1].replace(/\s+/g, ' ').trim();
}

async function importImageToR2(imageUrl, requestUrl, env) {
  if (!imageUrl) return null;

  let parsed;
  try {
    parsed = new URL(imageUrl, requestUrl);
  } catch {
    return null;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  if (isProbablyBlockedHost(parsed.hostname)) return null;

  const response = await fetch(parsed.toString(), { headers: DEFAULT_FETCH_HEADERS, redirect: 'follow' });
  if (!response.ok) return null;

  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.startsWith('image/')) return null;

  const contentLength = response.headers.get('Content-Length');
  if (contentLength && Number(contentLength) > MAX_IMPORT_IMAGE_BYTES) return null;

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_IMPORT_IMAGE_BYTES) return null;

  // Derive extension from known mime types.
  const mimeToExt = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
  };
  const ext = mimeToExt[contentType.split(';')[0].trim()] || 'bin';

  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  const key = `imported/${timestamp}-${random}.${ext}`;

  await env.IMAGES_BUCKET.put(key, buffer, {
    httpMetadata: { contentType: contentType.split(';')[0].trim() },
  });

  const origin = new URL(requestUrl).origin;
  return `${origin}/api/images/${key}`;
}

async function callOpenAiCompatibleChat({ endpoint, apiKey, model, messages }) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.2 }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`LLM request failed (status ${response.status}) ${errText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('LLM returned no content');
  }

  return content;
}

function parsePossibleJsonFromText(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  // Fallback: attempt to extract the first JSON object block.
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const substring = trimmed.slice(firstBrace, lastBrace + 1);
    return JSON.parse(substring);
  }

  throw new Error('Failed to parse JSON from LLM response');
}

function normalizeImportedRecipeShape(obj) {
  return {
    title: typeof obj.title === 'string' ? obj.title : '',
    serves: typeof obj.serves === 'string' ? obj.serves : null,
    cook_time: typeof obj.cook_time === 'string' ? obj.cook_time : null,
    ingredients: Array.isArray(obj.ingredients) ? obj.ingredients.filter(i => typeof i === 'string') : [],
    directions: Array.isArray(obj.directions) ? obj.directions.filter(d => typeof d === 'string') : [],
    tags: [],
    image_url: typeof obj.image_url === 'string' ? obj.image_url : null,
  };
}

// Input validation helper
function validateRecipeData(data) {
  const errors = [];

  // Title is required and must be a non-empty string
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    errors.push('Title is required');
  } else if (data.title.length > 200) {
    errors.push('Title must be 200 characters or less');
  }

  // Serves is optional but must be a string if provided
  if (data.serves !== undefined && data.serves !== null && typeof data.serves !== 'string') {
    errors.push('Serves must be a string');
  } else if (data.serves && data.serves.length > 100) {
    errors.push('Serves must be 100 characters or less');
  }

  // Cook time is optional but must be a string if provided
  if (data.cook_time !== undefined && data.cook_time !== null && typeof data.cook_time !== 'string') {
    errors.push('Cook time must be a string');
  } else if (data.cook_time && data.cook_time.length > 100) {
    errors.push('Cook time must be 100 characters or less');
  }

  // Ingredients must be an array of strings
  if (!Array.isArray(data.ingredients)) {
    errors.push('Ingredients must be an array');
  } else {
    if (data.ingredients.length === 0) {
      errors.push('At least one ingredient is required');
    }
    for (let i = 0; i < data.ingredients.length; i++) {
      if (typeof data.ingredients[i] !== 'string') {
        errors.push(`Ingredient at index ${i} must be a string`);
        break;
      }
      if (data.ingredients[i].length > 500) {
        errors.push(`Ingredient at index ${i} exceeds 500 character limit`);
        break;
      }
    }
  }

  // Directions must be an array of strings
  if (!Array.isArray(data.directions)) {
    errors.push('Directions must be an array');
  } else {
    if (data.directions.length === 0) {
      errors.push('At least one direction is required');
    }
    for (let i = 0; i < data.directions.length; i++) {
      if (typeof data.directions[i] !== 'string') {
        errors.push(`Direction at index ${i} must be a string`);
        break;
      }
      if (data.directions[i].length > 2000) {
        errors.push(`Direction at index ${i} exceeds 2000 character limit`);
        break;
      }
    }
  }

  // Tags must be an array of strings (optional, can be empty)
  if (data.tags !== undefined && data.tags !== null) {
    if (!Array.isArray(data.tags)) {
      errors.push('Tags must be an array');
    } else {
      for (let i = 0; i < data.tags.length; i++) {
        if (typeof data.tags[i] !== 'string') {
          errors.push(`Tag at index ${i} must be a string`);
          break;
        }
        if (data.tags[i].length > 50) {
          errors.push(`Tag at index ${i} exceeds 50 character limit`);
          break;
        }
      }
    }
  }

  // Image URL is optional but must be a valid URL if provided
  if (data.image_url !== undefined && data.image_url !== null && data.image_url !== '') {
    if (typeof data.image_url !== 'string') {
      errors.push('Image URL must be a string');
    } else if (data.image_url.length > 500) {
      errors.push('Image URL must be 500 characters or less');
    }
  }

  return errors;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    
    // Check if origin is allowed
    const isAllowedOrigin = origin && ALLOWED_ORIGINS.includes(origin);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Serve images from R2
      const imageMatch = path.match(/^\/api\/images\/(.+)$/);
      if (imageMatch && request.method === 'GET') {
          const key = imageMatch[1];
          const object = await env.IMAGES_BUCKET.get(key);

          if (!object) {
              return new Response('Image not found', { status: 404, headers: corsHeaders });
          }

          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set('etag', object.httpEtag);
          headers.set('Access-Control-Allow-Origin', '*');
          headers.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

          return new Response(object.body, {
              headers,
          });
      }

      // Upload Image Endpoint
      if (path === '/api/upload-image' && request.method === 'PUT') {
          const contentType = request.headers.get('Content-Type');
          if (!contentType || !contentType.startsWith('image/')) {
              return new Response(JSON.stringify({ error: 'Invalid content type. Only images allowed.' }), { status: 400, headers: corsHeaders });
          }

          // Generate a unique filename
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(2, 10);
          const mimeToExt = {
              'image/jpeg': 'jpg',
              'image/jpg': 'jpg',
              'image/png': 'png',
              'image/gif': 'gif',
              'image/webp': 'webp',
              'image/svg+xml': 'svg'
          };
          const extension = mimeToExt[contentType] || 'bin';
          const key = `${timestamp}-${random}.${extension}`;

          await env.IMAGES_BUCKET.put(key, request.body, {
              httpMetadata: { contentType: contentType }
          });

          // Return the full URL that can be used to retrieve the image
          const imageUrl = `${url.origin}/api/images/${key}`;

          return new Response(JSON.stringify({ success: true, url: imageUrl, key: key }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
      }


      if (path === '/api/recipes' && request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM recipes ORDER BY title ASC').all();
        // Parse JSON strings back to arrays
        const recipes = results.map(r => {
            let tags = [];
            try {
                // Handle case where tags might be null or invalid JSON
                tags = r.tags ? JSON.parse(r.tags) : [];
            } catch (e) {
                console.warn('Failed to parse tags for recipe', r.id, e);
                // Improved fallback: try to parse as comma-separated string, else empty array
                if (typeof r.tags === 'string' && r.tags.trim() !== '') {
                    tags = r.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
                } else {
                    tags = [];
                }
            }

            let ingredients = [];
            try {
                ingredients = JSON.parse(r.ingredients);
            } catch (e) {
                console.warn('Failed to parse ingredients for recipe', r.id, e);
            }

            let directions = [];
            try {
                directions = JSON.parse(r.directions);
            } catch (e) {
                console.warn('Failed to parse directions for recipe', r.id, e);
            }

            return {
                ...r,
                ingredients: ingredients,
                directions: directions,
                tags: tags
            };
        });

        return new Response(JSON.stringify(recipes), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60' // Cache for 60 seconds
          },
        });
      }

      if (path === '/api/recipes/import' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const targetUrl = body?.url;
        if (!targetUrl || typeof targetUrl !== 'string') {
          return new Response(JSON.stringify({ success: false, error: 'Missing url' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        let parsedTargetUrl;
        try {
          parsedTargetUrl = new URL(targetUrl);
        } catch {
          return new Response(JSON.stringify({ success: false, error: 'Invalid url' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!['http:', 'https:'].includes(parsedTargetUrl.protocol)) {
          return new Response(JSON.stringify({ success: false, error: 'Only http(s) URLs are supported' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (isProbablyBlockedHost(parsedTargetUrl.hostname)) {
          return new Response(JSON.stringify({ success: false, error: 'This host is not allowed' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const html = await fetchTextWithLimit(parsedTargetUrl.toString());
        const htmlTitle = extractTitleFromHtml(html);

        let imported = null;
        let source = null;

        // Primary: JSON-LD schema.org Recipe.
        const scripts = extractJsonLdScripts(html);
        for (const scriptText of scripts) {
          try {
            const obj = JSON.parse(scriptText);
            const recipeObj = findRecipeInJsonLd(obj);
            if (!recipeObj) continue;

            const mapped = mapJsonLdRecipeToModel(recipeObj, htmlTitle);
            if (mapped.ingredients.length > 0 && mapped.directions.length > 0) {
              imported = mapped;
              source = 'jsonld';
              break;
            }
          } catch {
            // ignore JSON parse errors
          }
        }

        // Fallback: LLM parse of page text.
        if (!imported) {
          const endpoint = env.OPENAI_BASE_URL;
          const apiKey = env.OPENAI_API_KEY;
          const model = env.OPENAI_MODEL;

          if (!endpoint || !apiKey || !model) {
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Recipe not found in page metadata, and LLM fallback is not configured',
              }),
              { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const pageText = stripHtmlToText(html);
          const content = pageText.slice(0, 15_000);

          const messages = [
            {
              role: 'system',
              content:
                'Extract a cooking recipe from the provided webpage content. Return ONLY JSON with keys: title (string), serves (string|null), cook_time (string|null), ingredients (string[]), directions (string[]), image_url (string|null). Do not include markdown or commentary.',
            },
            {
              role: 'user',
              content: JSON.stringify({ url: parsedTargetUrl.toString(), title: htmlTitle, content }),
            },
          ];

          const llmText = await callOpenAiCompatibleChat({ endpoint, apiKey, model, messages });
          const llmJson = parsePossibleJsonFromText(llmText);
          imported = normalizeImportedRecipeShape(llmJson);
          source = 'llm';
        }

        // Import image into R2 (if any)
        if (imported?.image_url) {
          const storedImageUrl = await importImageToR2(imported.image_url, request.url, env);
          imported.image_url = storedImageUrl;
        }

        const validationErrors = validateRecipeData(imported);
        if (validationErrors.length > 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'Validation failed', details: validationErrors, source }),
            { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true, recipe: imported, source }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (path === '/api/recipes' && request.method === 'POST') {
        const data = await request.json();
        
        // Validate input
        const validationErrors = validateRecipeData(data);
        if (validationErrors.length > 0) {
            return new Response(JSON.stringify({ error: 'Validation failed', details: validationErrors }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const { title, serves, cook_time, ingredients, directions, tags, image_url } = data;

        const result = await env.DB.prepare(
          'INSERT INTO recipes (title, serves, cook_time, ingredients, directions, tags, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(title.trim(), serves || null, cook_time || null, JSON.stringify(ingredients), JSON.stringify(directions), JSON.stringify(tags || []), image_url || null)
        .run();

        return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Handle /api/recipes/:id
      const idMatch = path.match(/^\/api\/recipes\/(\d+)$/);
      if (idMatch) {
        const id = idMatch[1];

        if (request.method === 'PUT') {
           const data = await request.json();
           
           // Validate input
           const validationErrors = validateRecipeData(data);
           if (validationErrors.length > 0) {
               return new Response(JSON.stringify({ error: 'Validation failed', details: validationErrors }), {
                   status: 400,
                   headers: { ...corsHeaders, 'Content-Type': 'application/json' }
               });
           }

           const { title, serves, cook_time, ingredients, directions, tags, image_url } = data;

           // Delete old image from R2 if image_url has changed
           const { results: existingRecipe } = await env.DB.prepare('SELECT image_url FROM recipes WHERE id = ?').bind(id).all();
           if (existingRecipe[0]?.image_url && existingRecipe[0].image_url !== image_url) {
               const oldKeyMatch = existingRecipe[0].image_url.match(/\/api\/images\/(.+)$/);
               if (oldKeyMatch) {
                   await env.IMAGES_BUCKET.delete(oldKeyMatch[1]);
               }
           }

           await env.DB.prepare(
             'UPDATE recipes SET title = ?, serves = ?, cook_time = ?, ingredients = ?, directions = ?, tags = ?, image_url = ? WHERE id = ?'
           )
           .bind(title.trim(), serves || null, cook_time || null, JSON.stringify(ingredients), JSON.stringify(directions), JSON.stringify(Array.isArray(tags) ? tags : []), image_url || null, id)
           .run();

           return new Response(JSON.stringify({ success: true }), {
             headers: { ...corsHeaders, 'Content-Type': 'application/json' },
           });
        }

        if (request.method === 'DELETE') {
            // Fetch the recipe to get the image_url before deleting
            const { results } = await env.DB.prepare('SELECT image_url FROM recipes WHERE id = ?').bind(id).all();
            if (results[0]?.image_url) {
                const keyMatch = results[0].image_url.match(/\/api\/images\/(.+)$/);
                if (keyMatch) await env.IMAGES_BUCKET.delete(keyMatch[1]);
            }
            await env.DB.prepare('DELETE FROM recipes WHERE id = ?').bind(id).run();
            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });

    } catch (err) {
      console.error('Internal Server Error:', err);
      return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500, headers: corsHeaders });
    }
  },
};
