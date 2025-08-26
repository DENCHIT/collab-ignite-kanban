import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
  redirectTo?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Password reset function called');
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, redirectTo }: PasswordResetRequest = await req.json();
    console.log('Processing password reset for:', email);

    // Generate a secure token for password reset
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Store the reset token in a secure way (you might want to create a password_reset_tokens table)
    // For now, we'll use the built-in Supabase auth flow
    const { error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
    });

    if (error) {
      console.error('Error generating reset link:', error);
      throw error;
    }

    // Create reset URL
    const resetUrl = redirectTo || `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?type=recovery&token=${token}`;

    const emailResponse = await resend.emails.send({
      from: "Zoby Boards <noreply@boards.zoby.ai>",
      to: [email],
      subject: "Reset your password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Reset Your Password</h1>
          <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
            We received a request to reset your password for your Zoby Boards account.
          </p>
          <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
            Click the button below to reset your password:
          </p>
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${resetUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #888; font-size: 14px; line-height: 1.5;">
            If you didn't request this password reset, you can safely ignore this email.
            This link will expire in 24 hours.
          </p>
          <p style="color: #888; font-size: 14px; line-height: 1.5;">
            If the button doesn't work, copy and paste this link into your browser:
            <br>
            ${resetUrl}
          </p>
        </div>
      `,
    });

    console.log('Password reset email sent successfully:', emailResponse);

    return new Response(JSON.stringify({ 
      success: true,
      message: "Password reset email sent successfully" 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in password reset function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);