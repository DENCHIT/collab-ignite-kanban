import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";
import { Resend } from "npm:resend@2.0.0";

const supabaseUrl = "https://sixpcrgvsxfhtthwdbkm.supabase.co";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(resendApiKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  recipient_email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Test email function called");
    
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log("Missing or invalid authorization header");
      throw new Error('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];
    console.log("Got auth token");

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user?.email) {
      console.log("Authentication failed:", authError);
      throw new Error('Unauthorized');
    }

    console.log("User authenticated:", user.email);

    // Check if user is admin (ed@zoby.ai)
    if (user.email !== 'ed@zoby.ai') {
      console.log("Non-admin user attempted to send test email:", user.email);
      throw new Error('Only administrators can send test emails');
    }

    const { recipient_email }: TestEmailRequest = await req.json();
    console.log(`Admin ${user.email} sending test email to: ${recipient_email}`);

    // Send test email via Resend
    const emailResult = await resend.emails.send({
      from: "Zoby Boards <noreply@mail.zoby.ai>",
      to: [recipient_email],
      subject: "Test Email from Zoby Boards",
      html: `
        <h1>Test Email Success! 🎉</h1>
        <p>This test email confirms that the Zoby Boards email system is working correctly.</p>
        <p><strong>Sent by:</strong> ${user.email}</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <div style="margin: 24px 0; padding: 16px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #0ea5e9;">
          <p><strong>✅ Email configuration verified!</strong></p>
          <ul style="margin: 8px 0;">
            <li>Domain: mail.zoby.ai</li>
            <li>Sender: noreply@mail.zoby.ai</li>
            <li>Service: Resend</li>
            <li>Function: send-test-email</li>
          </ul>
        </div>
        <p style="margin-top: 24px; color: #6b7280; font-size: 12px;">
          This email was sent by an administrator for testing purposes.
        </p>
      `,
    });

    console.log("Email sent successfully:", emailResult);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Test email sent successfully to ${recipient_email}`,
      emailId: emailResult.data?.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in send-test-email function:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);