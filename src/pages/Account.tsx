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
import { Upload, X, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [canCreateBoards, setCanCreateBoards] = useState(false);
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardType, setNewBoardType] = useState("idea");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });
  }, []);

  const loadUserData = async (uid: string) => {
    try {
      // Load profile - create one if it doesn't exist
      let { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();

      // If no profile exists, create one
      if (!profileData && !profileError) {
        const { error: createError } = await supabase.rpc('init_profile_for_current_user');
        if (!createError) {
          // Try to load the profile again after creation
          const { data: newProfileData } = await supabase
            .from('profiles')
            .select('*')
            .maybeSingle();
          profileData = newProfileData;
        }
      }

      if (profileData) {
        setProfile(profileData);
        setDisplayName(profileData.display_name || "");
        setAvatarUrl(profileData.avatar_url || "");
      }

      // Check if user can create boards (admin or manager)
      const { data: hasManagerRole } = await supabase.rpc('has_role', {
        _user_email: user?.email || '',
        _role: 'manager'
      });
      const { data: hasAdminRole } = await supabase.rpc('has_role', {
        _user_email: user?.email || '',
        _role: 'admin'
      });
      
      setCanCreateBoards(hasManagerRole || hasAdminRole);

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
        const oldFileName = avatarUrl.split('/').pop()?.split('?')[0];
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
      const fileName = avatarUrl.split('/').pop()?.split('?')[0];
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast({ title: "Passwords don't match", description: "Please retype your new password.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmNewPassword("");
      toast({ title: "Password updated", description: "Your password was changed successfully." });
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message || "Couldn't change password.", variant: "destructive" });
    } finally {
      setChangingPassword(false);
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

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;

    setCreatingBoard(true);
    try {
      // Create slug from name
      const slug = newBoardName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      // Insert new board
      const { data: newBoard, error } = await supabase
        .from('boards')
        .insert({
          name: newBoardName.trim(),
          slug: slug,
          item_type: newBoardType,
          created_by: user?.id,
          created_by_email: user?.email
        })
        .select()
        .single();

      if (error) throw error;

      // Add user as manager of the board
      const { error: memberError } = await supabase
        .from('board_members')
        .insert({
          board_id: newBoard.id,
          email: user?.email,
          display_name: profile?.display_name || user?.email?.split('@')[0] || 'User',
          role: 'manager'
        });

      if (memberError) throw memberError;

      // Refresh boards list
      const { data: boardsData } = await supabase.rpc('get_my_boards');
      if (boardsData) {
        setBoards(boardsData);
      }

      setNewBoardName("");
      setNewBoardType("idea");
      setIsCreateDialogOpen(false);
      
      toast({
        title: "Board created",
        description: `"${newBoardName.trim()}" has been created successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create board.",
        variant: "destructive",
      });
    } finally {
      setCreatingBoard(false);
    }
  };

  const handleDeleteBoard = async (boardId: string, boardName: string) => {
    try {
      // Delete the board
      const { error } = await supabase
        .from('boards')
        .delete()
        .eq('id', boardId);

      if (error) throw error;

      // Remove from local state
      setBoards(prev => prev.filter(board => board.board_id !== boardId));
      
      toast({
        title: "Board deleted",
        description: `"${boardName}" has been deleted successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete board.",
        variant: "destructive",
      });
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
              <form onSubmit={handleUpdateProfile} className="space-y-4" key="profile-form">
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
                      data-lpignore="true"
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
                    data-lpignore="true"
                    name="user_email"
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
                    data-lpignore="true"
                    name="display_name"
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
              <div className="flex items-center justify-between">
                <CardTitle>My Boards ({boards.length})</CardTitle>
                {canCreateBoards && (
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Board
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Board</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCreateBoard} className="space-y-4">
                        <div>
                          <Label htmlFor="boardName">Board Name</Label>
                          <Input
                            id="boardName"
                            value={newBoardName}
                            onChange={(e) => setNewBoardName(e.target.value)}
                            placeholder="Enter board name"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="boardType">Item Type</Label>
                          <Select value={newBoardType} onValueChange={setNewBoardType}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="idea">Ideas</SelectItem>
                              <SelectItem value="task">Tasks</SelectItem>
                              <SelectItem value="bug">Bugs</SelectItem>
                              <SelectItem value="feature">Features</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button type="submit" disabled={creatingBoard} className="flex-1">
                            {creatingBoard ? "Creating..." : "Create Board"}
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setIsCreateDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
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
                      <div className="flex items-center gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/b/${board.board_slug}`}>
                            Open
                          </Link>
                        </Button>
                        {board.role === 'manager' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Board</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{board.board_name}"? 
                                  This action cannot be undone and will permanently delete the board and all its content.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteBoard(board.board_id, board.board_name)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete Board
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Change Password Section */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4" key="change-password-form">
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                  autoComplete="new-password"
                  name="new_password"
                />
              </div>
              <div>
                <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                <Input
                  id="confirmNewPassword"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  minLength={6}
                  required
                  autoComplete="new-password"
                  name="confirm_new_password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={changingPassword}>
                {changingPassword ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

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