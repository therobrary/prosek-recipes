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
        const recipes = results.map(r => ({
            ...r,
            ingredients: JSON.parse(r.ingredients),
            directions: JSON.parse(r.directions)
        }));
        return new Response(JSON.stringify(recipes), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (path === '/api/recipes' && request.method === 'POST') {
        const data = await request.json();
        const { title, serves, cook_time, ingredients, directions, category } = data;

        const result = await env.DB.prepare(
          'INSERT INTO recipes (title, serves, cook_time, ingredients, directions, category) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(title, serves, cook_time, JSON.stringify(ingredients), JSON.stringify(directions), category)
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
           const { title, serves, cook_time, ingredients, directions, category } = data;

           await env.DB.prepare(
             'UPDATE recipes SET title = ?, serves = ?, cook_time = ?, ingredients = ?, directions = ?, category = ? WHERE id = ?'
           )
           .bind(title, serves, cook_time, JSON.stringify(ingredients), JSON.stringify(directions), category, id)
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
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  },
};
