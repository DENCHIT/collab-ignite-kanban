import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSessionReady } from "@/hooks/useSessionReady";
import AuthForm from "@/components/auth/AuthForm";
import { Mail, Users, CheckCircle, Clock, AlertCircle } from "lucide-react";

export default function InvitationAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { ready, user } = useSessionReady();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    
    if (!token) {
      setError("Invalid invitation link");
      setLoading(false);
      return;
    }

    loadInvitation();
  }, [ready, token]);

  async function loadInvitation() {
    try {
      // First, get the invitation details
      const { data: invitationData, error: invitationError } = await supabase
        .from('board_invitations')
        .select('*')
        .eq('token', token)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (invitationError || !invitationData) {
        console.error('Invitation error:', invitationError);
        setError("This invitation link is invalid or has expired");
        return;
      }

      // Then, get the board details
      const { data: boardData, error: boardError } = await supabase
        .from('boards')
        .select('id, name, slug')
        .eq('id', invitationData.board_id)
        .single();

      if (boardError || !boardData) {
        console.error('Board error:', boardError);
        setError("Failed to load board information");
        return;
      }

      // Combine the data in the expected format
      setInvitation({
        ...invitationData,
        boards: boardData
      });
    } catch (error) {
      console.error('Error loading invitation:', error);
      setError("Failed to load invitation details");
    } finally {
      setLoading(false);
    }
  }

  async function acceptInvitation() {
    if (!user || !invitation) return;

    setAccepting(true);

    try {
      // Add user to board
      const { error: addMemberError } = await supabase.functions.invoke('accept-board-invitation', {
        body: {
          token,
          display_name: user.email?.split('@')[0] || 'User'
        }
      });

      if (addMemberError) {
        throw addMemberError;
      }

      toast({
        title: "Success!",
        description: `You've been added to ${invitation.boards.name}`
      });

      // Redirect to the board
      navigate(`/b/${invitation.boards.slug}`);
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to accept invitation"
      });
    } finally {
      setAccepting(false);
    }
  }

  if (!ready || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-2">
              <Clock className="h-5 w-5 animate-spin" />
              <span>Loading invitation...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Invalid Invitation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => navigate('/')} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <Mail className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h1 className="text-2xl font-bold">Join Board Invitation</h1>
            <p className="text-muted-foreground mt-2">
              You've been invited to join <strong>{invitation?.boards?.name}</strong>
            </p>
          </div>
          
          <AuthForm 
            onSuccess={() => {
              // The user is now logged in, reload the page to trigger the invitation acceptance
              window.location.reload();
            }}
          />
          
          <div className="text-center text-sm text-muted-foreground">
            After signing in, you'll automatically be added to the board.
          </div>
        </div>
      </div>
    );
  }

  // Check if user is already a member or if the invitation is for them
  if (user.email !== invitation?.email) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              Invitation Mismatch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              This invitation was sent to <strong>{invitation?.email}</strong>, but you're signed in as <strong>{user.email}</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              Please sign in with the correct email address or contact the person who sent the invitation.
            </p>
            <Button onClick={() => navigate('/')} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Board Invitation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold">{invitation?.boards?.name}</h2>
            <p className="text-muted-foreground mt-1">
              Invited by {invitation?.invited_by_email}
            </p>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>You'll be automatically added to this board</span>
            </div>
          </div>

          <Button 
            onClick={acceptInvitation}
            disabled={accepting}
            className="w-full"
          >
            {accepting ? "Joining Board..." : "Accept Invitation"}
          </Button>

          <Button 
            variant="outline" 
            onClick={() => navigate('/')}
            className="w-full"
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}