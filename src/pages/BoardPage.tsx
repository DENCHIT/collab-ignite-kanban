import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Board } from "@/components/kanban/Board";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export default function BoardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const { slug } = useParams<{ slug?: string }>();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, [slug]);

  const checkAuth = async () => {
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setLoading(false);
        return;
      }

      setUser(session.user);

      // Check if user is already a member of this board
      if (slug) {
        const { data: memberStatus, error } = await supabase.rpc('is_board_member', {
          _board_slug: slug,
          _user_email: session.user.email
        });

        if (error) {
          console.error('Error checking membership:', error);
          toast({
            title: "Error",
            description: "Failed to check board access.",
            variant: "destructive",
          });
        } else {
          setIsMember(memberStatus === true);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasscodeVerify = async () => {
    if (!slug || !user) return;
    
    setVerifying(true);
    
    try {
      // Verify passcode
      const { data: isValid, error: verifyError } = await supabase.rpc('verify_board_passcode_secure', {
        _slug: slug,
        _passcode: passcode.trim()
      });

      if (verifyError) {
        console.error("Passcode verification error:", verifyError);
        toast({
          title: "Error",
          description: "Failed to verify passcode.",
          variant: "destructive",
        });
        return;
      }

      if (isValid !== true) {
        toast({
          title: "Invalid passcode",
          description: "Please check your passcode and try again.",
          variant: "destructive",
        });
        return;
      }

      // Get user profile for display name
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .single();

      // Add user to board
      const { data: addResult, error: addError } = await supabase.rpc('add_board_member', {
        _slug: slug,
        _email: user.email,
        _display_name: profile?.display_name || user.email?.split('@')[0] || 'User'
      });

      if (addError) {
        console.error("Error adding member:", addError);
        toast({
          title: "Warning",
          description: "Passcode verified but failed to register membership.",
          variant: "destructive",
        });
        return;
      }

      if (addResult === true) {
        setIsMember(true);
        toast({
          title: "Access granted!",
          description: "Welcome to the board.",
        });
      } else {
        toast({
          title: "Error",
          description: "Board not found.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Passcode verification failed:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-20">
        <div className="max-w-md mx-auto text-center">
          <div className="text-muted-foreground">Loading board...</div>
        </div>
      </div>
    );
  }

  // Redirect to home if not authenticated
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Show passcode form if not a member
  if (isMember === false) {
    return (
      <div className="container mx-auto py-20">
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h1 className="text-xl font-semibold">Enter Board Passcode</h1>
              <p className="text-sm text-muted-foreground">
                This board requires a passcode to join. Enter the passcode provided by your board administrator.
              </p>
              <Input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Board passcode"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePasscodeVerify();
                  }
                }}
              />
              <div className="flex gap-2">
                <Button 
                  onClick={handlePasscodeVerify} 
                  disabled={verifying || !passcode.trim()}
                  className="flex-1"
                >
                  {verifying ? "Verifying..." : "Join Board"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setPasscode("")}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show loading while checking membership
  if (isMember === null) {
    return (
      <div className="container mx-auto py-20">
        <div className="max-w-md mx-auto text-center">
          <div className="text-muted-foreground">Checking access...</div>
        </div>
      </div>
    );
  }

  // Show board if user is a member
  return (
    <main className="container mx-auto py-6">
      <Board boardSlug={slug} />
    </main>
  );
}
