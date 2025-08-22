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

const serve_handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user?.email) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin (ed@zoby.ai)
    if (user.email !== 'ed@zoby.ai') {
      throw new Error('Only administrators can send test emails');
    }

    const { recipient_email }: TestEmailRequest = await req.json();
    
    console.log(`Admin ${user.email} sending test email to ${recipient_email}`);

    // Send test email via Resend
    await resend.emails.send({
      from: "Zoby Boards <noreply@mail.zoby.ai>",
      to: [recipient_email],
      subject: "Test Email from Zoby Boards",
      html: `
        <h1>Test Email</h1>
        <p>This is a test email from Zoby Boards to verify that email delivery is working correctly.</p>
        <p><strong>Sent by:</strong> ${user.email}</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <div style="margin: 24px 0; padding: 16px; background: #f0f9ff; border-radius: 8px;">
          <p><strong>✅ Email configuration is working!</strong></p>
          <ul>
            <li>Domain: mail.zoby.ai</li>
            <li>Sender: noreply@mail.zoby.ai</li>
            <li>Service: Resend</li>
          </ul>
        </div>
        <p style="margin-top: 24px; color: #6b7280; font-size: 12px;">
          This email was sent by an administrator for testing purposes.
        </p>
      `,
    });

    console.log(`Test email sent successfully to ${recipient_email}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Test email sent to ${recipient_email}` 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in send-test-email function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(serve_handler);