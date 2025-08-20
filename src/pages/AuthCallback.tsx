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
      try {
        // Handle auth callback (email confirmation, password reset, etc.)
        const { data, error } = await supabase.auth.getSession();
        
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

        // Get the next URL parameter (where to redirect after auth)
        const nextUrl = searchParams.get('next');
        
        if (data.session) {
          toast({
            title: "Welcome!",
            description: "You've been successfully authenticated.",
          });
          
          // Redirect to the original board URL or home
          navigate(nextUrl || '/', { replace: true });
        } else {
          // No session, redirect to home
          navigate('/');
        }
      } catch (error) {
        console.error('Unexpected error in auth callback:', error);
        navigate('/');
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