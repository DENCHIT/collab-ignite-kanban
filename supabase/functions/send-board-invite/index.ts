import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  board_id: string;
  board_name: string;
  board_slug: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

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

    const { email, board_id, board_name, board_slug }: InviteRequest = await req.json();

    console.log("Processing invite for:", { email, board_id, board_name, board_slug });

    // Verify the user is a member of the board they're inviting to
    const { data: membership, error: membershipError } = await supabase
      .from('board_members')
      .select('role')
      .eq('board_id', board_id)
      .eq('email', user.email!)
      .single();

    if (membershipError || !membership) {
      throw new Error("You are not a member of this board");
    }

    // Check if the invitee is already a member
    const { data: existingMember } = await supabase
      .from('board_members')
      .select('id')
      .eq('board_id', board_id)
      .eq('email', email)
      .single();

    if (existingMember) {
      throw new Error("This user is already a member of this board");
    }

    // Get or create a display name from email
    const displayName = email.split('@')[0];
    
    // Add the user directly to the board_members table
    const { error: addMemberError } = await supabase
      .from('board_members')
      .insert({
        board_id: board_id,
        email: email,
        display_name: displayName,
        role: 'member'
      });

    if (addMemberError) {
      console.error("Error adding board member:", addMemberError);
      // If it's a duplicate error, that's okay - the user is already a member
      if (!addMemberError.message?.includes('duplicate') && !addMemberError.message?.includes('already exists')) {
        throw new Error(`Failed to add user to board: ${addMemberError.message}`);
      }
    }

    console.log("User added to board successfully");

    // Send the invitation email
    const emailResponse = await resend.emails.send({
      from: "Zoby Boards <noreply@mail.zoby.ai>",
      to: [email],
      subject: `You've been invited to join "${board_name}" on Zoby Boards`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; margin-bottom: 20px;">You've been invited to join a board!</h1>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #0066cc; margin-top: 0;">${board_name}</h2>
            <p style="color: #666; margin-bottom: 0;">You've been invited by ${user.email} to collaborate on this board.</p>
          </div>
          
          <p style="color: #333; line-height: 1.6;">
            Zoby Boards is a collaborative platform where teams can share ideas, track tasks, and work together effectively.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://boards.zoby.ai/board/${board_slug}" 
               style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Join Board
            </a>
          </div>
          
          <p style="color: #888; font-size: 14px; margin-top: 30px;">
            If the button doesn't work, you can copy and paste this link into your browser:<br>
            <a href="https://boards.zoby.ai/board/${board_slug}" style="color: #0066cc;">https://boards.zoby.ai/board/${board_slug}</a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #888; font-size: 12px; text-align: center;">
            This invitation was sent by ${user.email}. If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    console.log("Email response:", emailResponse);

    // Check if email sending failed due to domain verification
    if (emailResponse.error) {
      console.error("Email sending error:", emailResponse.error);
      
      // If it's a domain verification error, still complete the invite but warn about email
      if (emailResponse.error.message?.includes("verify a domain")) {
        console.log("Domain verification required for email, but user added to board successfully");
        return new Response(JSON.stringify({ 
          success: true, 
          warning: "User added to board, but email notification failed. Please verify your domain at resend.com/domains to send emails to other recipients." 
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      } else {
        throw new Error(`Failed to send email: ${emailResponse.error.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-board-invite function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);