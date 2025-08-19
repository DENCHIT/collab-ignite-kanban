import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { loadIdeas, loadThresholds, saveThresholds, setAdminPasscode, setIsAdmin, setTeamPasscode } from "@/lib/session";
import { Idea, Thresholds } from "@/types/idea";
import { supabase } from "@/integrations/supabase/client";
import { Copy } from "lucide-react";

interface BoardData {
  board_id: string;
  name: string;
  slug: string;
  passcode: string | null;
  item_type: string;
  idea_count: number;
  vote_count: number;
  member_count: number;
  created_at: string;
}

export default function Admin() {
  const [teamPass, setTeamPass] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [thresholds, setThresholds] = useState<Thresholds>(loadThresholds({ toDiscussion: 5, toProduction: 10, toBacklog: 5 }));

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("ed@zoby.ai");
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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? null);
    });
    document.title = "Admin Panel — Kanban Boards";
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => { if (userEmail === "ed@zoby.ai") { fetchBoards(); } }, [userEmail]);

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
    if (email !== "ed@zoby.ai") {
      toast({ title: "Access denied", description: "Only ed@zoby.ai can sign in as admin." });
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return toast({ title: "Sign-in error", description: error.message });
    toast({ title: "Signed in", description: `Welcome ${email}` });
  }

  async function signUpAdmin() {
    if (email !== "ed@zoby.ai") {
      toast({ title: "Sign-up blocked", description: "Only ed@zoby.ai can be the admin." });
      return;
    }
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
    
    const redirectUrl = `${window.location.origin}/admin`;
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
    setUserEmail(null);
  }

  async function fetchBoards() {
    setLoadingBoards(true);
    const { data, error } = await (supabase.rpc as any)('get_boards_admin_data');
    
    if (error) {
      toast({ title: "Load boards failed", description: error.message });
      setLoadingBoards(false);
      return;
    }

    setBoards(Array.isArray(data) ? data : []);
    setLoadingBoards(false);
  }

  async function fetchBoardMembers(boardId: string) {
    setLoadingMembers(true);
    const { data, error } = await supabase
      .from("board_members")
      .select("*")
      .eq("board_id", boardId)
      .order("joined_at", { ascending: false });
    if (error) {
      toast({ title: "Load members failed", description: error.message });
    } else {
      setBoardMembers(data ?? []);
    }
    setLoadingMembers(false);
  }

  async function updateMemberRole(memberId: string, newRole: "member" | "manager") {
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
      // Optimistically update UI so passcode appears immediately
      setBoards((prev) => prev.map((b) => 
        b.board_id === resetPasscodeBoard.board_id ? { ...b, passcode: newPasscode } : b
      ));
      setResetPasscodeBoard(null);
      setNewPasscode("");
      fetchBoards(); // Refresh from server
    }
  }

  async function createBoard() {
    if (userEmail !== "ed@zoby.ai") {
      toast({ title: "Access denied", description: "Only ed@zoby.ai can create boards." });
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
    
    const link = `${window.location.origin}/b/${data.slug}`;
    toast({ title: "Board created", description: `Share link ${link}` });
    setBoardSlug(data.slug);
    setBoardName("");
    setBoardPass("");
    setBoardItemType("idea");
    fetchBoards();
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied", description: "Passcode copied to clipboard" });
    }).catch(() => {
      toast({ title: "Copy failed", description: "Could not copy to clipboard" });
    });
  }

  if (userEmail !== "ed@zoby.ai") {
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
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ed@zoby.ai" />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" />
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

      <Card>
        <CardHeader>
          <CardTitle>Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Team passcode</Label>
              <Input type="password" value={teamPass} onChange={(e) => setTeamPass(e.target.value)} placeholder="Set team passcode" />
              <Button className="mt-2" onClick={() => { setTeamPasscode(teamPass); toast({ title: "Team passcode updated" }); }}>Save</Button>
            </div>
            <div>
              <Label>Admin passcode</Label>
              <Input type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} placeholder="Set admin passcode" />
              <Button className="mt-2" onClick={() => { setAdminPasscode(adminPass); setIsAdmin(true); toast({ title: "Admin passcode updated" }); }}>Save</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create Board</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={boardName} onChange={(e) => setBoardName(e.target.value)} placeholder="Client Feedback" />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={boardSlug} onChange={(e) => setBoardSlug(e.target.value)} placeholder="client-feedback" />
            </div>
            <div>
              <Label>Board passcode</Label>
              <Input type="password" value={boardPass} onChange={(e) => setBoardPass(e.target.value)} placeholder="Set board passcode" />
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

      <Card>
        <CardHeader>
          <CardTitle>Boards</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingBoards ? (
            <div className="text-sm text-muted-foreground">Loading boards...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>All boards</TableCaption>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Name</TableHead>
                     <TableHead>Slug</TableHead>
                     <TableHead>Link</TableHead>
                     <TableHead>Passcode</TableHead>
                     <TableHead>Ideas</TableHead>
                     <TableHead>Votes</TableHead>
                     <TableHead>Members</TableHead>
                     <TableHead>Actions</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {boards.map((b) => (
                     <TableRow key={b.board_id}>
                       <TableCell className="font-medium">{b.name}</TableCell>
                       <TableCell>{b.slug}</TableCell>
                      <TableCell>
                         <a href={`/b/${b.slug}`} className="underline" target="_blank" rel="noreferrer">
                           {`${window.location.origin}/b/${b.slug}`}
                         </a>
                       </TableCell>
                       <TableCell>
                         {b.passcode ? (
                           <div className="flex items-center gap-2">
                             <code className="text-sm bg-muted px-2 py-1 rounded">{b.passcode}</code>
                             <Button 
                               variant="ghost" 
                               size="sm"
                               onClick={() => copyToClipboard(b.passcode!)}
                             >
                               <Copy className="h-3 w-3" />
                             </Button>
                           </div>
                         ) : (
                           <span className="text-xs text-muted-foreground">
                             Not set (reset to create)
                           </span>
                         )}
                       </TableCell>
                       <TableCell>{b.idea_count}</TableCell>
                       <TableCell>{b.vote_count}</TableCell>
                       <TableCell>{b.member_count}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedBoard(b);
                                fetchBoardMembers(b.board_id);
                              }}
                            >
                              View Members
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setResetPasscodeBoard(b)}
                            >
                              Reset Passcode
                            </Button>
                          </div>
                        </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {resetPasscodeBoard && (
        <Card>
          <CardHeader>
            <CardTitle>Reset Passcode - {resetPasscodeBoard.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>New Passcode</Label>
              <Input 
                type="password" 
                value={newPasscode} 
                onChange={(e) => setNewPasscode(e.target.value)} 
                placeholder="Enter new passcode" 
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={resetBoardPasscode}>Update Passcode</Button>
              <Button 
                variant="secondary" 
                onClick={() => {
                  setResetPasscodeBoard(null);
                  setNewPasscode("");
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedBoard && (
        <Card>
          <CardHeader>
            <CardTitle>Board Members - {selectedBoard.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMembers ? (
              <div className="text-sm text-muted-foreground">Loading members...</div>
            ) : boardMembers.length === 0 ? (
              <div className="text-sm text-muted-foreground">No members have joined this board yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption>Board members and their roles</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {boardMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.display_name}</TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>
                          <Badge variant={member.role === "manager" ? "default" : "secondary"}>
                            {member.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(member.joined_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {member.role === "member" ? (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => updateMemberRole(member.id, "manager")}
                              >
                                Make Manager
                              </Button>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => updateMemberRole(member.id, "member")}
                              >
                                Remove Manager
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="mt-4">
              <Button 
                variant="secondary" 
                onClick={() => setSelectedBoard(null)}
              >
                Back to Boards
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button variant="secondary" onClick={exportCSV}>Export ideas CSV</Button>
          <Button onClick={() => toast({ title: "Setup required", description: "Connect Supabase to enable realtime and weekly digests." })}>Enable weekly email digest</Button>
        </CardContent>
      </Card>
    </main>
  );
}
