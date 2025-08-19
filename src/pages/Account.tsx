import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Profile {
  id: string;
  display_name: string;
  email: string;
  avatar_url?: string;
}

interface Board {
  board_id: string;
  board_name: string;
  board_slug: string;
  item_type: string;
  role: string;
  joined_at: string;
}

export default function Account() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadUserData();
      } else {
        setLoading(false);
      }
    });
  }, []);

  const loadUserData = async () => {
    try {
      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .single();

      if (!profileError && profileData) {
        setProfile(profileData);
        setDisplayName(profileData.display_name);
      }

      // Load boards
      const { data: boardsData, error: boardsError } = await supabase.rpc('get_my_boards');

      if (!boardsError && boardsData) {
        setBoards(boardsData);
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
      toast({
        title: "Error",
        description: "Failed to load your account data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() })
        .eq('user_id', user?.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, display_name: displayName.trim() } : null);
      
      toast({
        title: "Profile updated",
        description: "Your display name has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-muted-foreground">Loading your account...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container mx-auto py-20">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary mb-2">My Account</h1>
          <p className="text-muted-foreground">Manage your profile and view your boards</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Profile Section */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input 
                    id="email" 
                    value={profile?.email || user.email || ""} 
                    disabled 
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Email cannot be changed
                  </p>
                </div>

                <div>
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your display name"
                    required
                  />
                </div>

                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? "Updating..." : "Update Profile"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Boards Section */}
          <Card>
            <CardHeader>
              <CardTitle>My Boards ({boards.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {boards.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>You haven't joined any boards yet.</p>
                  <p className="text-sm mt-2">
                    Use a board link and passcode to join a board.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {boards.map((board) => (
                    <div 
                      key={board.board_id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/b/${board.board_slug}`}
                            className="font-medium hover:text-primary underline"
                          >
                            {board.board_name}
                          </Link>
                          <Badge variant="secondary" className="text-xs">
                            {board.role}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {board.item_type} • Joined {new Date(board.joined_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/b/${board.board_slug}`}>
                          Open
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}