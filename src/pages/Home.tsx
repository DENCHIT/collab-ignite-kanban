import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import AuthForm from "@/components/auth/AuthForm";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";

// Safety net: Auto-redirect authenticated users if they have a saved redirect path
const RootAutoRedirect = ({ user }: { user: User | null }) => {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (user) {
      const savedPath = localStorage.getItem('postAuthRedirect');
      if (savedPath && savedPath !== '/' && savedPath !== '/#') {
        localStorage.removeItem('postAuthRedirect');
        navigate(savedPath, { replace: true });
      }
    }
  }, [user, navigate]);
  
  return null;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Add the safety net component
  const autoRedirect = <RootAutoRedirect user={user} />;

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-20">
        {autoRedirect}
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-lg text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-20">
        {autoRedirect}
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <div className="mb-8">
            <h1 className="text-6xl font-bold text-primary mb-4">
              Zoby Boards
            </h1>
            <p className="text-lg text-muted-foreground">
              Welcome to Zoby Boards, the place to add, vote on, and track ideas and work.
            </p>
          </div>
          
          <AuthForm onSuccess={() => {}} />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-20">
      {autoRedirect}
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-primary mb-4">
            Zoby Boards
          </h1>
        </div>
        
        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
          <CardContent className="p-8 space-y-4">
            <p className="text-lg text-muted-foreground leading-relaxed">
              Welcome back! You can now access any board you're a member of, or join new boards with a passcode.
            </p>
            <div className="flex gap-3 justify-center">
              <Button asChild>
                <Link to="/account">View My Boards</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}