import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const target = url.searchParams.get("url");

    if (!target) {
      return new Response(JSON.stringify({ error: "Missing url parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const method = req.method;
    const requestBody = method !== "GET" ? await req.text() : undefined;

    const response = await fetch(target, {
      method,
      headers: { "Content-Type": "application/json" },
      body: requestBody,
    });

    const rawData = await response.text();

    let contentType = response.headers.get("Content-Type") || "application/json";
    let responseBody = rawData;

    if (!contentType.includes("application/json")) {
      try {
        JSON.parse(rawData);
        contentType = "application/json";
      } catch {
        responseBody = JSON.stringify({ text: rawData });
        contentType = "application/json";
      }
    }

    return new Response(responseBody, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
