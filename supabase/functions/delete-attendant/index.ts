import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DeleteAttendantRequest {
  attendant_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('===== DELETE ATTENDANT FUNCTION STARTED =====');
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    console.log('Request headers:', {
      authorization: authHeader ? 'present' : 'missing',
      contentType: req.headers.get("Content-Type")
    });

    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: "Unauthorized - Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestUser) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized - Invalid or expired token",
          details: authError?.message
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: isSuperAdmin } = await supabaseAdmin
      .from("super_admins")
      .select("user_id")
      .eq("user_id", requestUser.id)
      .maybeSingle();

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, api_key")
      .eq("user_id", requestUser.id)
      .maybeSingle();

    if (!isSuperAdmin && !company) {
      return new Response(
        JSON.stringify({ error: "Only super admins or company admins can delete attendants" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body: DeleteAttendantRequest = await req.json();
    const { attendant_id } = body;

    if (!attendant_id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: attendant_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: attendant, error: fetchError } = await supabaseAdmin
      .from("attendants")
      .select("id, user_id, company_id")
      .eq("id", attendant_id)
      .maybeSingle();

    if (fetchError || !attendant) {
      return new Response(
        JSON.stringify({ error: "Attendant not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (company && company.id !== attendant.company_id) {
      return new Response(
        JSON.stringify({ error: "Company admins can only delete attendants from their own company" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('Attempting to delete attendant:', attendant_id, 'user_id:', attendant.user_id);

    if (attendant.user_id) {
      console.log('Deleting user from auth first:', attendant.user_id);
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(
        attendant.user_id
      );

      if (deleteUserError) {
        console.error('Error deleting user from auth:', deleteUserError);
        return new Response(
          JSON.stringify({
            error: 'Failed to delete user from auth',
            details: deleteUserError.message
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      console.log('User deleted from auth successfully');
    }

    console.log('Now deleting attendant from database');
    const { error: deleteAttendantError } = await supabaseAdmin
      .from("attendants")
      .delete()
      .eq("id", attendant_id);

    if (deleteAttendantError) {
      console.error('Error deleting attendant:', deleteAttendantError);
      return new Response(
        JSON.stringify({
          error: deleteAttendantError.message,
          details: deleteAttendantError
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('Attendant deleted successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: "Attendant deleted successfully"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
