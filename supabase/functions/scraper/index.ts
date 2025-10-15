// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()

    if (!url) {
      throw new Error('URL is required');
    }

    // Create a Supabase client with the user's auth token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get the user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Authentication failed');
    }

    // Scrape the page using Browserless.io
    const browserlessApiKey = Deno.env.get('BROWSERLESS_API_KEY');
    if (!browserlessApiKey) {
      throw new Error('Browserless API key is not configured.');
    }

    const puppeteerScript = `
      module.exports = async ({ page, context }) => {
        const { url } = context;
        
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 90000
        });

        // This evaluate block scrolls down the page to load lazy-loaded content.
        await page.evaluate(async () => {
          await new Promise(resolve => {
            let lastHeight = 0;
            let scrolls = 0;
            const maxScrolls = 30; 
            const scrollInterval = 3000; // 3 seconds

            const interval = setInterval(() => {
              const newHeight = document.body.scrollHeight;
              
              if (newHeight === lastHeight || scrolls >= maxScrolls) {
                clearInterval(interval);
                resolve();
              } else {
                lastHeight = newHeight;
                window.scrollTo(0, document.body.scrollHeight);
                scrolls++;
              }
            }, scrollInterval);
          });
        });

        // Return the full page content after all scrolling is complete.
        return await page.content();
      };
    `;

    const payload = {
      code: puppeteerScript,
      context: { url: url }
    };

    const browserlessResponse = await fetch(`https://production-sfo.browserless.io/function?token=${browserlessApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!browserlessResponse.ok) {
      const errorBody = await browserlessResponse.text();
      throw new Error(`Browserless API Error (Status: ${browserlessResponse.status}): ${errorBody}`);
    }
    
    const html = await browserlessResponse.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) throw new Error("Failed to parse HTML from Browserless response");

    const links = doc.querySelectorAll('a');
    const extractedData = [];
    for (const link of links) {
      const href = link.getAttribute('href');
      const title = link.textContent.trim();
      if (href && !href.startsWith('#') && !href.startsWith('javascript:') && title) {
        const absoluteUrl = new URL(href, url).href;
        extractedData.push({ href: absoluteUrl, title });
      }
    }

    // Create admin client to insert data
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Prepare data for insertion
    const linksToInsert = extractedData.map(link => ({
      user_id: user.id,
      scraped_url: url,
      link_href: link.href,
      link_title: link.title,
    }));

    if (linksToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin.from('scraped_links').insert(linksToInsert);
      if (insertError) {
        console.error('DB Insert Error:', insertError);
        throw new Error(`Database error: ${insertError.message}`);
      }
    }

    return new Response(JSON.stringify({ data: extractedData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Scraper function error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})