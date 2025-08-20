import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const nextUrl = searchParams.get('next') || localStorage.getItem('postAuthRedirect') || '/';
      try {
        const url = window.location.href;

        // Try to complete any pending auth flows (OAuth/PKCE, magic links)
        if (url.includes('code=')) {
          try {
            await supabase.auth.exchangeCodeForSession(url);
          } catch (e) {
            console.warn('exchangeCodeForSession not applicable:', e);
          }
        }

        // Initial check
        let { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Auth callback error:', error);
          toast({
            title: "Authentication error",
            description: error.message,
            variant: "destructive",
          });
          navigate('/');
          return;
        }

        if (data.session) {
          toast({ title: "Welcome!", description: "You've been successfully authenticated." });
          localStorage.removeItem('postAuthRedirect');
          navigate(nextUrl, { replace: true });
          return;
        }

        // Fallback: wait briefly for hash-based auth to finish
        await new Promise<void>((resolve) => {
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session && (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY')) {
              subscription.unsubscribe();
              resolve();
            }
          });
          setTimeout(() => {
            subscription.unsubscribe();
            resolve();
          }, 5000);
        });

        ({ data } = await supabase.auth.getSession());
        if (data.session) {
          toast({ title: "Welcome!", description: "You're signed in." });
          localStorage.removeItem('postAuthRedirect');
          navigate(nextUrl, { replace: true });
          return;
        }

        toast({ title: "Authentication error", description: "Could not complete sign-in.", variant: "destructive" });
        navigate('/', { replace: true });
      } catch (error: any) {
        console.error('Unexpected error in auth callback:', error);
        toast({ title: "Authentication error", description: error.message || 'Unexpected error', variant: 'destructive' });
        navigate('/', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams, toast]);

  return (
    <div className="container mx-auto py-20">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Completing Authentication</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Please wait...</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}