import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the SERVICE_ROLE_KEY
    // This allows us to bypass RLS and create users
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Parse request body
    const { email, password, tenantId, name } = await req.json()

    // Validation
    if (!email || !password || !tenantId || !name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Create the Auth User
    const { data: user, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto confirm email
      user_metadata: { name },
    })

    if (createUserError) {
      console.error('Create User Error:', createUserError)
      return new Response(
        JSON.stringify({ error: createUserError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Create the Profile (linked to Tenant)
    // Note: Normally a Trigger handles this, but we want to force specific attributes like role='partner'
    // and specific tenant_id immediately.
    
    // Check if profile was already created by a Trigger (if you have one)
    // If you have a "handle_new_user" trigger, it might have inserted a default profile.
    // We should UPDATE it or INSERT if not exists.
    
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.user.id,
        tenant_id: tenantId,
        role: 'partner',
        name: name,
        updated_at: new Date().toISOString(),
      })

    if (profileError) {
      console.error('Profile Error:', profileError)
      // Optional: Delete the user if profile creation fails to maintain consistency
      await supabaseAdmin.auth.admin.deleteUser(user.user.id)
      
      return new Response(
        JSON.stringify({ error: 'Failed to create user profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ user: user.user, message: 'Partner created successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
