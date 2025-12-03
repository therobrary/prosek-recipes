// This is a test comment to trigger CI/CD.
export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
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
          const extension = contentType.split('/')[1] || 'bin';
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
        const { title, serves, cook_time, ingredients, directions, tags, image_url } = data;

        const result = await env.DB.prepare(
          'INSERT INTO recipes (title, serves, cook_time, ingredients, directions, tags, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(title, serves, cook_time, JSON.stringify(ingredients), JSON.stringify(directions), JSON.stringify(tags || []), image_url || null)
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
           const { title, serves, cook_time, ingredients, directions, tags, image_url } = data;

           await env.DB.prepare(
             'UPDATE recipes SET title = ?, serves = ?, cook_time = ?, ingredients = ?, directions = ?, tags = ?, image_url = ? WHERE id = ?'
           )
           .bind(title, serves, cook_time, JSON.stringify(ingredients), JSON.stringify(directions), JSON.stringify(Array.isArray(tags) ? tags : []), image_url || null, id)
           .run();

           return new Response(JSON.stringify({ success: true }), {
             headers: { ...corsHeaders, 'Content-Type': 'application/json' },
           });
        }

        if (request.method === 'DELETE') {
            await env.DB.prepare('DELETE FROM recipes WHERE id = ?').bind(id).run();
            // Optional: We could delete the image from R2 here if we fetched the recipe first to get the URL.
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
