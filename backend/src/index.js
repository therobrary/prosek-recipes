// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://recipes.robrary.com',
  'https://family-recipes-backend.robrary.workers.dev',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
];

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
