import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AuthFormProps {
  onSuccess: () => void;
}

export default function AuthForm({ onSuccess }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const { toast } = useToast();

  // Create callback URL with current page as next parameter
  const currentPath = window.location.pathname + window.location.search;
  const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(currentPath)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        try { localStorage.setItem('postAuthRedirect', currentPath); } catch {}
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        toast({
          title: "Welcome back!",
          description: "You've been signed in successfully.",
        });
      } else {
        try { localStorage.setItem('postAuthRedirect', currentPath); } catch {}
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: callbackUrl,
          },
        });

        if (error) throw error;

        // Initialize profile after signup
        const { error: profileError } = await supabase.rpc('init_profile_for_current_user', {
          _display_name: displayName.trim() || null
        });

        if (profileError) {
          console.warn('Profile initialization failed:', profileError);
        }

        // Since email confirmation is disabled, user gets instant session
        if (data.session) {
          toast({
            title: "Welcome!",
            description: "Your account has been created and you're signed in.",
          });
        } else {
          toast({
            title: "Account created!",
            description: "Please check your email to confirm your account.",
          });
        }
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Authentication error",
        description: error.message || "An error occurred during authentication.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address to reset your password.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      try { localStorage.setItem('postAuthRedirect', currentPath); } catch {}
      
      // Use Supabase's built-in password reset
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset`
      });

      if (error) throw error;

      setResetEmailSent(true);
      toast({
        title: "Reset email sent",
        description: "Check your email for password reset instructions.",
      });
    } catch (error: any) {
      toast({
        title: "Reset failed",
        description: error.message || "Failed to send reset email.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{isLogin ? "Sign In" : "Create Account"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" key="auth-form">
          <div>
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              name="email"
            />
          </div>
          
          {!isLogin && (
            <div>
              <Input
                type="text"
                placeholder="Display name (optional)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                data-lpignore="true"
                name="display_name"
              />
            </div>
          )}
          
          <div>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isLogin ? "current-password" : "new-password"}
              name={isLogin ? "password" : "new_password"}
            />
          </div>
          
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Loading..." : (isLogin ? "Sign In" : "Create Account")}
          </Button>
        </form>
        
        <div className="mt-4 text-center space-y-2">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
          
          {isLogin && (
            <div>
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={loading || resetEmailSent}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                {resetEmailSent ? "Reset email sent!" : "Forgot password?"}
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}