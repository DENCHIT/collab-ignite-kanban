import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { loadIdeas, loadThresholds, saveThresholds, setAdminPasscode, setIsAdmin, setTeamPasscode } from "@/lib/session";
import { Idea, Thresholds } from "@/types/idea";
import { supabase } from "@/integrations/supabase/client";

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
  const [boards, setBoards] = useState<any[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
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
    const { data, error } = await supabase
      .from("boards")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Load boards failed", description: error.message });
    } else {
      setBoards(data ?? []);
    }
    setLoadingBoards(false);
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
    const { data, error } = await supabase
      .from("boards")
      .insert({ slug, name: boardName, passcode: boardPass, created_by: userData.user?.id, created_by_email: userData.user?.email ?? null })
      .select()
      .single();
    if (error) return toast({ title: "Create failed", description: error.message });
    const link = `${window.location.origin}/b/${data.slug}`;
    toast({ title: "Board created", description: `Share link ${link}` });
    setBoardSlug(data.slug);
    fetchBoards();
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boards.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell>{b.slug}</TableCell>
                      <TableCell>
                        <a href={`/b/${b.slug}`} className="underline" target="_blank" rel="noreferrer">
                          {`${window.location.origin}/b/${b.slug}`}
                        </a>
                      </TableCell>
                      <TableCell>{b.passcode}</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>—</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
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
