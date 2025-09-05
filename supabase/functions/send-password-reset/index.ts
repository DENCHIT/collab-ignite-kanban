import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PasswordResetRequest {
  email: string;
  redirectTo?: string;
}

// Rate limiting table (in-memory for this example - in production use Redis or database)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Simple rate limiting function
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(ip);
  
  if (!userLimit || now > userLimit.resetTime) {
    // Reset or create new limit
    rateLimitMap.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 }); // 15 minutes
    return false;
  }
  
  if (userLimit.count >= 3) { // Max 3 attempts per 15 minutes
    return true;
  }
  
  userLimit.count++;
  return false;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Basic rate limiting by IP
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    if (isRateLimited(clientIP)) {
      return new Response(
        JSON.stringify({ message: 'Password reset email sent if account exists.' }),
        { 
          status: 200, // Always return 200 to prevent information disclosure
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { email, redirectTo }: PasswordResetRequest = await req.json();

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ message: 'Password reset email sent if account exists.' }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ message: 'Password reset email sent if account exists.' }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Generate password reset link using Supabase Auth
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: redirectTo || 'https://sixpcrgvsxfhtthwdbkm.supabase.co'
      }
    });

    if (error) {
      console.error('Error generating reset link:', error);
      // Always return success to prevent user enumeration
      return new Response(
        JSON.stringify({ message: 'Password reset email sent if account exists.' }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Send email only if user exists (data.user will be null if user doesn't exist)
    if (data.user) {
      try {
        await resend.emails.send({
          from: 'IdeaFlow <no-reply@resend.dev>',
          to: [email],
          subject: 'Reset Your Password',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #333;">Reset Your Password</h1>
              <p>You requested a password reset for your IdeaFlow account.</p>
              <p>Click the link below to reset your password:</p>
              <a href="${data.properties?.action_link}" 
                 style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
                Reset Password
              </a>
              <p>This link will expire in 1 hour for security reasons.</p>
              <p>If you didn't request this reset, you can safely ignore this email.</p>
              <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px;">IdeaFlow Team</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Still return success to prevent information disclosure
      }
    }

    // Always return the same response regardless of whether user exists
    return new Response(
      JSON.stringify({ message: 'Password reset email sent if account exists.' }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error in password reset function:', error);
    return new Response(
      JSON.stringify({ message: 'Password reset email sent if account exists.' }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

serve(handler);