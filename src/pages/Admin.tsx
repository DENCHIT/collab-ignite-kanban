import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { toast } from "@/hooks/use-toast";
import { useSessionReady } from "@/hooks/useSessionReady";
import { loadIdeas, loadThresholds, saveThresholds } from "@/lib/session";
import { Idea, Thresholds } from "@/types/idea";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Trash2, ExternalLink } from "lucide-react";

interface BoardData {
  board_id: string;
  name: string;
  slug: string;
  item_type: string;
  idea_count: number;
  vote_count: number;
  member_count: number;
  created_at: string;
  created_by_email?: string;
}

interface ManagerActivity {
  email: string;
  display_name: string;
  role: 'admin' | 'manager';
  assigned_at: string;
  boards_created: number;
  total_ideas: number;
  total_votes: number;
  total_members: number;
  assistant_count: number;
}

export default function Admin() {
  const { ready, session, userEmail } = useSessionReady();
  const [thresholds, setThresholds] = useState<Thresholds>(loadThresholds({ toDiscussion: 5, toProduction: 10, toBacklog: 5 }));
  
  const [userRole, setUserRole] = useState<'admin' | 'manager' | null>(null);
  const [canCreateBoards, setCanCreateBoards] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [boardName, setBoardName] = useState("");
  const [boardSlug, setBoardSlug] = useState("");
  const [boardPass, setBoardPass] = useState("");
  const [boardItemType, setBoardItemType] = useState<"idea" | "task">("idea");
  const [boards, setBoards] = useState<BoardData[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<any>(null);
  const [boardMembers, setBoardMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [resetPasscodeBoard, setResetPasscodeBoard] = useState<any>(null);
  const [newPasscode, setNewPasscode] = useState("");
  const [deleteBoard, setDeleteBoard] = useState<BoardData | null>(null);
  
  // Manager management state
  const [managers, setManagers] = useState<ManagerActivity[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [newManagerEmail, setNewManagerEmail] = useState("");
  const [newManagerRole, setNewManagerRole] = useState<'manager'>('manager');
  const [showAddManager, setShowAddManager] = useState(false);

  useEffect(() => {
    document.title = "Admin Panel — Kanban Boards";
  }, []);

  // Fetch user role when session is ready
  useEffect(() => {
    if (!ready || !userEmail) {
      setUserRole(null);
      return;
    }

    // Defer the Supabase call to avoid auth callback deadlock
    setTimeout(async () => {
      try {
        const { data } = await supabase.rpc('get_user_role', { _user_email: userEmail });
        setUserRole(data);
      } catch (error) {
        console.error('Error fetching user role:', error);
        setUserRole(null);
      }
    }, 0);
  }, [ready, userEmail]);

  // Determine if user can create boards (admin or has manager role)
  useEffect(() => {
    if (!ready || !userEmail) {
      setCanCreateBoards(false);
      return;
    }

    const adminEmail = userEmail === "ed@zoby.ai";
    if (adminEmail) {
      setCanCreateBoards(true);
      return;
    }

    // Defer the Supabase call to avoid auth callback deadlock
    setTimeout(async () => {
      try {
        const { data } = await supabase.rpc('has_role', { _user_email: userEmail, _role: 'manager' });
        setCanCreateBoards(!!data);
      } catch (error) {
        console.error('Error checking manager role:', error);
        setCanCreateBoards(false);
      }
    }, 0);
  }, [ready, userEmail]);

  // Fetch data when session is ready and user is authenticated
  useEffect(() => { 
    if (!ready || !userEmail || (!userRole && userEmail !== "ed@zoby.ai")) {
      return;
    }
    
    // Defer data fetching to avoid auth callback conflicts
    setTimeout(() => {
      fetchBoards(); 
      if (userEmail === "ed@zoby.ai") {
        fetchManagers();
      }
    }, 0);
  }, [ready, userEmail, userRole]);

  async function fetchManagers() {
    setLoadingManagers(true);
    try {
      const { data, error } = await supabase.rpc('get_manager_activity').throwOnError();
      
      setManagers(data || []);
    } catch (error: any) {
      console.error("Error fetching managers:", error);
      toast({ title: "Load managers failed", description: error.message });
    }
    setLoadingManagers(false);
  }

  async function addManager() {
    if (!newManagerEmail || !newManagerRole) {
      toast({ title: "Missing fields", description: "Enter email and select role." });
      return;
    }
    
    // Get user ID from profiles table - user must have signed up and created a profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', newManagerEmail)
      .single();
    
    if (profileError || !profile) {
      toast({ title: "User not found", description: "The user must sign up and log in at least once first." });
      return;
    }
    
    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: profile.user_id,
        email: newManagerEmail,
        role: newManagerRole,
        assigned_by: userEmail || 'admin'
      });
    
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        toast({ title: "Already exists", description: "This user already has this role." });
      } else {
        toast({ title: "Add manager failed", description: error.message });
      }
    } else {
      toast({ title: "Manager added", description: `${newManagerEmail} is now a ${newManagerRole}` });
      setNewManagerEmail("");
      setNewManagerRole('manager');
      setShowAddManager(false);
      fetchManagers();
    }
  }

  async function removeManager(email: string) {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('email', email);
    
    if (error) {
      toast({ title: "Remove failed", description: error.message });
    } else {
      toast({ title: "Manager removed", description: `${email} removed from managers` });
      fetchManagers();
    }
  }

  function exportCSV() {
    const ideas = loadIdeas<Idea[]>([]);
    const rows = [
      ["id", "title", "creator", "score", "status", "lastActivityAt"],
      ...ideas.map((i) => [i.id, i.title, i.creatorName, i.score, i.status, i.lastActivityAt]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/\"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ideas.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function slugify(text: string) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  }

  async function signInAdmin() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return toast({ title: "Sign-in error", description: error.message });
    toast({ title: "Signed in", description: `Welcome ${email}` });
  }

  async function signUpAdmin() {
    const redirectUrl = `${window.location.origin}/admin`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl }
    });
    if (error) return toast({ title: "Sign-up error", description: error.message });
    toast({ title: "Check your email", description: "Confirm to complete sign up." });
  }

  async function resetPassword() {
    if (!resetEmail) {
      toast({ title: "Email required", description: "Please enter your email address." });
      return;
    }
    
    const redirectUrl = `${window.location.origin}/auth/reset`;
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: redirectUrl
    });
    
    if (error) {
      toast({ title: "Reset failed", description: error.message });
    } else {
      toast({ 
        title: "Check your email", 
        description: "We've sent you a password reset link." 
      });
      setShowForgotPassword(false);
      setResetEmail("");
    }
  }

  async function signOutAdmin() {
    await supabase.auth.signOut();
  }

  async function fetchBoards() {
    setLoadingBoards(true);
    try {
      const { data, error } = await supabase.rpc('get_accessible_boards').throwOnError();
      
      setBoards(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error("Error fetching boards:", error);
      toast({ title: "Load boards failed", description: error.message });
    }
    setLoadingBoards(false);
  }

  async function fetchBoardMembers(boardId: string) {
    console.log('Fetching members for board:', boardId);
    console.log('Current user email:', userEmail);
    setLoadingMembers(true);
    const { data, error } = await supabase
      .from("board_members")
      .select("*")
      .eq("board_id", boardId)
      .order("joined_at", { ascending: false });
    console.log('Members query result:', { data, error });
    if (error) {
      toast({ title: "Load members failed", description: error.message });
    } else {
      setBoardMembers(data ?? []);
      console.log('Set board members:', data ?? []);
    }
    setLoadingMembers(false);
  }

  async function updateMemberRole(memberId: string, newRole: "member" | "manager" | "assistant") {
    const { error } = await supabase
      .from("board_members")
      .update({ role: newRole })
      .eq("id", memberId);
    
    if (error) {
      toast({ title: "Update failed", description: error.message });
    } else {
      toast({ title: "Role updated", description: `Member is now a ${newRole}` });
      if (selectedBoard) {
        fetchBoardMembers(selectedBoard.board_id);
      }
    }
  }

  async function removeMember(memberId: string, memberEmail: string) {
    const { error } = await supabase
      .from("board_members")
      .delete()
      .eq("id", memberId);
    
    if (error) {
      toast({ title: "Remove failed", description: error.message });
    } else {
      toast({ title: "Member removed", description: `${memberEmail} removed from board` });
      if (selectedBoard) {
        fetchBoardMembers(selectedBoard.board_id);
      }
    }
  }

  async function resetBoardPasscode() {
    if (!resetPasscodeBoard || !newPasscode) {
      toast({ title: "Missing fields", description: "Enter a new passcode." });
      return;
    }
    
    const { error } = await supabase.rpc('set_board_passcode', {
      _board_id: resetPasscodeBoard.board_id,
      _passcode: newPasscode
    });
    
    if (error) {
      toast({ title: "Reset failed", description: error.message });
    } else {
      toast({ 
        title: "Passcode reset", 
        description: `New passcode for "${resetPasscodeBoard.name}": ${newPasscode}` 
      });
      // Optimistically update UI to show new passcode
      setBoards((prev) => prev.map((b) => 
        b.board_id === resetPasscodeBoard.board_id ? { ...b } : b
      ));
      setResetPasscodeBoard(null);
      setNewPasscode("");
      fetchBoards(); // Refresh from server
    }
  }

  // Privileges
  const isAdmin = userEmail === "ed@zoby.ai";
  const hasManagerAccess = canCreateBoards;

  async function createBoard() {
    if (!hasManagerAccess) {
      toast({ title: "Access denied", description: "Only admin and Level A managers can create boards." });
      return;
    }
    const slug = boardSlug || slugify(boardName);
    if (!boardName || !slug || !boardPass) {
      toast({ title: "Missing fields", description: "Enter name, slug, and passcode." });
      return;
    }
    
    const { data: userData } = await supabase.auth.getUser();
    
    // Create board without passcode (stored separately for security)
    const { data, error } = await supabase
      .from("boards")
      .insert({ 
        slug, 
        name: boardName, 
        item_type: boardItemType,
        created_by: userData.user?.id, 
        created_by_email: userData.user?.email ?? null 
      })
      .select()
      .single();
    
    if (error) return toast({ title: "Create failed", description: error.message });
    
    // Set the hashed passcode using the secure function
    const { error: passcodeError } = await supabase.rpc('set_board_passcode', {
      _board_id: data.id,
      _passcode: boardPass
    });
    
    if (passcodeError) {
      console.error("Error setting passcode:", passcodeError);
      toast({ title: "Warning", description: "Board created but passcode may not be set correctly." });
    }
    
    // Add creator as a board member automatically
    const { error: memberError } = await supabase.rpc('add_board_member', {
      _slug: data.slug,
      _email: userData.user?.email ?? '',
      _display_name: userData.user?.email?.split('@')[0] ?? 'Manager'
    });
    
    if (memberError) {
      console.error("Error adding creator as member:", memberError);
    }
    
    const link = `${window.location.origin}/b/${data.slug}`;
    toast({ title: "Board created", description: `Share link ${link}` });
    setBoardSlug(data.slug);
    setBoardName("");
    setBoardPass("");
    setBoardItemType("idea");
    fetchBoards();
  }

  async function confirmDeleteBoard() {
    if (!deleteBoard) return;
    
    const { error } = await supabase
      .from("boards")
      .delete()
      .eq("id", deleteBoard.board_id);
    
    if (error) {
      toast({ title: "Delete failed", description: error.message });
    } else {
      toast({ title: "Board deleted", description: `"${deleteBoard.name}" has been deleted.` });
      setBoards(prev => prev.filter(b => b.board_id !== deleteBoard.board_id));
      setDeleteBoard(null);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied", description: "Passcode copied to clipboard" });
    }).catch(() => {
      toast({ title: "Copy failed", description: "Could not copy to clipboard" });
    });
  }

  if (!ready) {
    return (
      <main className="container mx-auto py-6">
        <div className="text-center">Loading...</div>
      </main>
    );
  }

  if (!userEmail || (!isAdmin && !userRole)) {
    return (
      <main className="container mx-auto py-6 space-y-6">
        <h1 className="text-2xl font-semibold">Admin Login</h1>

        <Card>
          <CardHeader>
            <CardTitle>{showForgotPassword ? "Reset Password" : "Sign in"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!showForgotPassword ? (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Email</Label>
                    <Input 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      placeholder="ed@zoby.ai"
                      autoComplete="username"
                      name="admin_email" 
                    />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      placeholder="Enter password"
                      autoComplete="current-password"
                      name="admin_password" 
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={signInAdmin}>Sign in</Button>
                  <Button variant="secondary" onClick={signUpAdmin}>Create admin account</Button>
                </div>
                <div className="text-center">
                  <Button 
                    variant="link" 
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm"
                  >
                    Forgot your password?
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label>Email</Label>
                  <Input 
                    type="email" 
                    value={resetEmail} 
                    onChange={(e) => setResetEmail(e.target.value)} 
                    placeholder="ed@zoby.ai" 
                  />
                </div>
                <div className="flex gap-3">
                  <Button onClick={resetPassword}>Send Reset Link</Button>
                  <Button 
                    variant="secondary" 
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmail("");
                    }}
                  >
                    Back to Sign In
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-semibold">Admin Panel</h1>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="text-sm">Signed in as {userEmail}</div>
          <Button variant="secondary" onClick={signOutAdmin}>Sign out</Button>
        </CardContent>
      </Card>


      {hasManagerAccess && (
        <Card>
          <CardHeader>
            <CardTitle>Create Board</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>Name</Label>
                <Input 
                  value={boardName} 
                  onChange={(e) => setBoardName(e.target.value)} 
                  placeholder="Client Feedback"
                  data-lpignore="true"
                  name="board_name" 
                />
              </div>
              <div>
                <Label>Slug</Label>
                <Input 
                  value={boardSlug} 
                  onChange={(e) => setBoardSlug(e.target.value)} 
                  placeholder="client-feedback"
                  data-lpignore="true"
                  name="board_slug" 
                />
              </div>
              <div>
                <Label>Board passcode</Label>
                <Input 
                  type="password" 
                  value={boardPass} 
                  onChange={(e) => setBoardPass(e.target.value)} 
                  placeholder="Set board passcode"
                  autoComplete="new-password"
                  name="board_passcode" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Item Type</Label>
              <div className="flex items-center gap-3">
                <Toggle 
                  pressed={boardItemType === "idea"} 
                  onPressedChange={(pressed) => setBoardItemType(pressed ? "idea" : "task")}
                  variant="outline"
                >
                  Ideas
                </Toggle>
                <Toggle 
                  pressed={boardItemType === "task"} 
                  onPressedChange={(pressed) => setBoardItemType(pressed ? "task" : "idea")}
                  variant="outline"
                >
                  Tasks
                </Toggle>
                <span className="text-sm text-muted-foreground">
                  This changes the "New {boardItemType === "idea" ? "Idea" : "Task"}" button text in the board
                </span>
              </div>
            </div>
            <Button onClick={createBoard}>Create board</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Auto-move thresholds</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>Backlog → Discussion</Label>
            <Input type="number" value={thresholds.toDiscussion} onChange={(e) => setThresholds({ ...thresholds, toDiscussion: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Discussion → Production</Label>
            <Input type="number" value={thresholds.toProduction} onChange={(e) => setThresholds({ ...thresholds, toProduction: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Any → Backlog at ≤ -X</Label>
            <Input type="number" value={thresholds.toBacklog} onChange={(e) => setThresholds({ ...thresholds, toBacklog: Number(e.target.value) })} />
          </div>
          <Button className="mt-2" onClick={() => { saveThresholds(thresholds); toast({ title: "Thresholds saved (refresh board)" }); }}>Save thresholds</Button>
        </CardContent>
      </Card>

      {/* Manager Management - Only visible to super admin */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Manager Activity
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAddManager(true)}
              >
                Add Manager
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingManagers ? (
              <div className="text-sm text-muted-foreground">Loading managers...</div>
            ) : managers.length === 0 ? (
              <div className="text-sm text-muted-foreground">No managers found.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption>Manager activity and statistics</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Boards</TableHead>
                      <TableHead>Ideas</TableHead>
                      <TableHead>Votes</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Board Assistants</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {managers.map((manager) => (
                      <TableRow key={manager.email}>
                        <TableCell className="font-medium">{manager.email}</TableCell>
                        <TableCell>{manager.display_name}</TableCell>
                        <TableCell>
                          <Badge variant={
                            manager.role === 'admin' ? 'default' : 'secondary'
                          }>
                            {manager.role === 'admin' ? 'Super Admin' : 'Manager'}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(manager.assigned_at).toLocaleDateString()}</TableCell>
                        <TableCell>{manager.boards_created}</TableCell>
                        <TableCell>{manager.total_ideas}</TableCell>
                        <TableCell>{manager.total_votes}</TableCell>
                        <TableCell>{manager.total_members}</TableCell>
                        <TableCell>{manager.assistant_count}</TableCell>
                        <TableCell>
                          {manager.role !== 'admin' && (
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => removeManager(manager.email)}
                            >
                              Remove
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Manager Dialog */}
      {showAddManager && (
        <Card>
          <CardHeader>
            <CardTitle>Add Manager</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input 
                  type="email" 
                  value={newManagerEmail}
                  onChange={(e) => setNewManagerEmail(e.target.value)}
                  placeholder="manager@company.com" 
                />
              </div>
              <div>
                <Label>Role</Label>
                <div className="flex gap-2">
                  <Toggle 
                    pressed={newManagerRole === 'manager'} 
                    onPressedChange={(pressed) => pressed && setNewManagerRole('manager')}
                    variant="outline"
                  >
                    Manager (Can create boards and manage them)
                  </Toggle>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={addManager}>Add Manager</Button>
              <Button variant="secondary" onClick={() => {
                setShowAddManager(false);
                setNewManagerEmail("");
                setNewManagerRole('manager');
              }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Boards</h2>
          {boards.length > 1 && (
            <div className="text-sm text-muted-foreground">
              {boards.length} boards • Use arrows to navigate
            </div>
          )}
        </div>
        
        {loadingBoards ? (
          <Card className="h-[500px]">
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-sm text-muted-foreground">Loading boards...</div>
            </CardContent>
          </Card>
        ) : boards.length === 0 ? (
          <Card className="h-[500px]">
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <div className="text-sm text-muted-foreground">No boards found</div>
                <div className="text-xs text-muted-foreground">Create your first board above</div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Carousel className="w-full">
            <CarouselContent>
              {boards.map((board) => (
                <CarouselItem key={board.board_id}>
                  <Card className="h-[500px]">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <CardTitle className="text-2xl">{board.name}</CardTitle>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline">{board.slug}</Badge>
                            <Badge variant="secondary">{board.item_type}</Badge>
                          </div>
                        </div>
                        <a 
                          href={`/b/${board.slug}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open
                        </a>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-6 h-full pb-6">
                      {/* Statistics */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <div className="text-2xl font-bold text-primary">{board.idea_count}</div>
                          <div className="text-xs text-muted-foreground">Ideas</div>
                        </div>
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <div className="text-2xl font-bold text-primary">{board.vote_count}</div>
                          <div className="text-xs text-muted-foreground">Votes</div>
                        </div>
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <div className="text-2xl font-bold text-primary">{board.member_count}</div>
                          <div className="text-xs text-muted-foreground">Members</div>
                        </div>
                      </div>

                      {/* Board Link */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Board Link</Label>
                        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                          <code className="flex-1 text-sm break-all">
                            {`${window.location.origin}/b/${board.slug}`}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/b/${board.slug}`);
                              toast({ title: "Copied", description: "Board link copied to clipboard" });
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Security Info */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Security</Label>
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="text-sm text-muted-foreground">
                            Passcode is securely encrypted and not accessible via admin panel
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-3 pt-4">
                        <Button 
                          onClick={() => {
                            setSelectedBoard(board);
                            fetchBoardMembers(board.board_id);
                          }}
                          className="flex-1 min-w-[120px]"
                        >
                          Manage Members
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => setResetPasscodeBoard(board)}
                          className="flex-1 min-w-[120px]"
                        >
                          Reset Passcode
                        </Button>
                        <Button 
                          variant="destructive"
                          onClick={() => setDeleteBoard(board)}
                          className="flex-1 min-w-[120px]"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Board
                        </Button>
                      </div>

                      {/* Board Info */}
                      <div className="pt-4 border-t">
                        <div className="text-xs text-muted-foreground">
                          Created {new Date(board.created_at).toLocaleDateString()}
                          {board.created_by_email && ` by ${board.created_by_email}`}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            {boards.length > 1 && (
              <>
                <CarouselPrevious className="left-4" />
                <CarouselNext className="right-4" />
              </>
            )}
          </Carousel>
        )}
      </div>

      {selectedBoard && (
        <Card>
          <CardHeader>
            <CardTitle>Managing Board: {selectedBoard.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Board members</div>
              <Button variant="outline" size="sm" onClick={() => setSelectedBoard(null)}>Close</Button>
            </div>
            
            {loadingMembers ? (
              <div className="text-sm text-muted-foreground">Loading members...</div>
            ) : boardMembers.length === 0 ? (
              <div className="text-sm text-muted-foreground">No members found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boardMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>{member.display_name}</TableCell>
                      <TableCell>
                        <Badge variant={member.role === 'manager' ? 'default' : 'secondary'}>
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(member.joined_at).toLocaleDateString()}</TableCell>
                       <TableCell>
                         <div className="flex gap-1">
                           <select 
                             value={member.role} 
                             onChange={(e) => updateMemberRole(member.id, e.target.value as "member" | "manager" | "assistant")}
                             className="text-sm border rounded px-2 py-1"
                           >
                             <option value="member">Member</option>
                             <option value="manager">Board Manager</option>
                             <option value="assistant">Board Assistant</option>
                           </select>
                           <Button 
                             size="sm" 
                             variant="destructive"
                             onClick={() => removeMember(member.id, member.email)}
                           >
                             Remove
                           </Button>
                         </div>
                       </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {resetPasscodeBoard && (
        <Card>
          <CardHeader>
            <CardTitle>Reset passcode for: {resetPasscodeBoard.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>New passcode</Label>
              <Input 
                type="password" 
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                placeholder="Enter new passcode" 
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={resetBoardPasscode}>Update passcode</Button>
              <Button variant="secondary" onClick={() => {
                setResetPasscodeBoard(null);
                setNewPasscode("");
              }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Board Confirmation Dialog */}
      <Dialog open={!!deleteBoard} onOpenChange={() => setDeleteBoard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Board</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteBoard?.name}"? This action cannot be undone and will permanently delete all ideas, votes, and member data for this board.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteBoard(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteBoard}>
              Delete Board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
