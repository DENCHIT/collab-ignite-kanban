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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, X } from "lucide-react";
import EmailPreferences from "@/components/EmailPreferences";

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
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
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
      // Load profile - create one if it doesn't exist
      let { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .single();

      // If no profile exists, create one
      if (profileError && profileError.code === 'PGRST116') {
        const { error: createError } = await supabase.rpc('init_profile_for_current_user');
        if (!createError) {
          // Try to load the profile again after creation
          const { data: newProfileData } = await supabase
            .from('profiles')
            .select('*')
            .single();
          profileData = newProfileData;
        }
      }

      if (profileData) {
        setProfile(profileData);
        setDisplayName(profileData.display_name || "");
        setAvatarUrl(profileData.avatar_url || "");
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
      // Use upsert to handle case where profile doesn't exist
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user?.id,
          email: user?.email,
          display_name: displayName.trim()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, display_name: displayName.trim() } : {
        id: '',
        display_name: displayName.trim(),
        email: user?.email || '',
        avatar_url: avatarUrl
      });
      
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

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Remove old avatar if exists
      if (avatarUrl) {
        const oldFileName = avatarUrl.split('/').pop();
        if (oldFileName) {
          await supabase.storage
            .from('avatars')
            .remove([`${user.id}/${oldFileName}`]);
        }
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile using upsert
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          email: user.email,
          display_name: displayName || user.email?.split('@')[0] || '',
          avatar_url: publicUrl
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setAvatarUrl(publicUrl);
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : {
        id: '',
        display_name: displayName || user.email?.split('@')[0] || '',
        email: user.email || '',
        avatar_url: publicUrl
      });
      
      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload avatar.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    if (!user || !avatarUrl) return;

    setUploading(true);
    try {
      // Remove from storage
      const fileName = avatarUrl.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('avatars')
          .remove([`${user.id}/${fileName}`]);
      }

      // Update profile using upsert
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          email: user.email,
          display_name: displayName || user.email?.split('@')[0] || '',
          avatar_url: null
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setAvatarUrl("");
      setProfile(prev => prev ? { ...prev, avatar_url: null } : {
        id: '',
        display_name: displayName || user.email?.split('@')[0] || '',
        email: user.email || '',
        avatar_url: null
      });
      
      toast({
        title: "Avatar removed",
        description: "Your profile picture has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Remove failed",
        description: error.message || "Failed to remove avatar.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail.trim()) return;

    setSendingTest(true);
    try {
      const response = await supabase.functions.invoke('send-test-email', {
        body: { recipient_email: testEmail.trim() },
      });

      if (response.error) {
        console.error('Edge function error:', response.error);
        throw new Error(response.error.message || 'Failed to send test email');
      }

      toast({
        title: "Test email sent",
        description: `Test email sent to ${testEmail.trim()}`,
      });

      setTestEmail("");
    } catch (error: any) {
      console.error('Test email error:', error);
      toast({
        title: "Failed to send test email",
        description: error.message || "Failed to send test email.",
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
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

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Profile Section */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={avatarUrl} alt="Profile picture" />
                      <AvatarFallback className="text-lg">
                        {profile?.display_name 
                          ? profile.display_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                          : (profile?.email || user.email || '').substring(0, 2).toUpperCase()
                        }
                      </AvatarFallback>
                    </Avatar>
                    {avatarUrl && (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                        onClick={removeAvatar}
                        disabled={uploading}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-center space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      id="avatar-upload"
                      disabled={uploading}
                    />
                    <Label htmlFor="avatar-upload" className="cursor-pointer">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        disabled={uploading}
                        asChild
                      >
                        <span>
                          <Upload className="h-4 w-4 mr-2" />
                          {uploading ? "Uploading..." : "Upload Avatar"}
                        </span>
                      </Button>
                    </Label>
                    <p className="text-xs text-muted-foreground text-center">
                      JPG, PNG or GIF. Max 5MB.
                    </p>
                  </div>
                </div>

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

        {/* Email Preferences Section */}
        <div className="max-w-2xl mx-auto">
          <EmailPreferences user={user} />
        </div>

        {/* Admin Test Email Section */}
        {user?.email === 'ed@zoby.ai' && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Admin: Test Email Delivery</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendTestEmail} className="space-y-4">
                <div>
                  <Label htmlFor="testEmail">Send Test Email To</Label>
                  <Input
                    id="testEmail"
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This will send a test email from noreply@mail.zoby.ai to verify email delivery
                  </p>
                </div>
                <Button type="submit" disabled={sendingTest} className="w-full">
                  {sendingTest ? "Sending..." : "Send Test Email"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}