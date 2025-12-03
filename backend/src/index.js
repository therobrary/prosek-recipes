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
            return {
                ...r,
                ingredients: JSON.parse(r.ingredients),
                directions: JSON.parse(r.directions),
                tags: JSON.parse(r.tags || '[]')
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
        const { title, serves, cook_time, ingredients, directions, tags } = data;

        const result = await env.DB.prepare(
          'INSERT INTO recipes (title, serves, cook_time, ingredients, directions, tags) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(title, serves, cook_time, JSON.stringify(ingredients), JSON.stringify(directions), JSON.stringify(tags || []))
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
           const { title, serves, cook_time, ingredients, directions, tags } = data;

           await env.DB.prepare(
             'UPDATE recipes SET title = ?, serves = ?, cook_time = ?, ingredients = ?, directions = ?, tags = ? WHERE id = ?'
           )
           .bind(title, serves, cook_time, JSON.stringify(ingredients), JSON.stringify(directions), JSON.stringify(Array.isArray(tags) ? tags : []), id)
           .run();

           return new Response(JSON.stringify({ success: true }), {
             headers: { ...corsHeaders, 'Content-Type': 'application/json' },
           });
        }

        if (request.method === 'DELETE') {
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
