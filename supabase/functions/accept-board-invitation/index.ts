import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AcceptInvitationRequest {
  token: string;
  display_name: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Authentication failed");
    }

    const { token: invitationToken, display_name }: AcceptInvitationRequest = await req.json();

    console.log("Processing invitation acceptance for:", { invitationToken, user_email: user.email });

    // Get the invitation details
    const { data: invitation, error: invitationError } = await supabase
      .from('board_invitations')
      .select(`
        *,
        boards (
          id,
          name,
          slug
        )
      `)
      .eq('token', invitationToken)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (invitationError || !invitation) {
      throw new Error("Invalid or expired invitation");
    }

    // Verify the invitation is for the current user
    if (invitation.email !== user.email) {
      throw new Error("This invitation is not for your email address");
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('board_members')
      .select('id')
      .eq('board_id', invitation.board_id)
      .eq('email', user.email!)
      .single();

    if (existingMember) {
      throw new Error("You are already a member of this board");
    }

    // Add user to board
    const { error: addMemberError } = await supabase
      .from('board_members')
      .insert({
        board_id: invitation.board_id,
        email: user.email!,
        display_name: display_name,
        role: 'member'
      });

    if (addMemberError) {
      console.error('Error adding board member:', addMemberError);
      throw new Error("Failed to add you to the board");
    }

    // Mark invitation as used
    const { error: updateError } = await supabase
      .from('board_invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('token', invitationToken);

    if (updateError) {
      console.error('Error marking invitation as used:', updateError);
      // Don't throw here as the user was successfully added
    }

    console.log("User successfully added to board:", invitation.boards.name);

    return new Response(JSON.stringify({ 
      success: true,
      board_name: invitation.boards.name,
      board_slug: invitation.boards.slug
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in accept-board-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);