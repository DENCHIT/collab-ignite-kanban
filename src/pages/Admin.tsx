import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  const [boardName, setBoardName] = useState("");
  const [boardSlug, setBoardSlug] = useState("");
  const [boardPass, setBoardPass] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

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
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) return toast({ title: "Sign-in error", description: error.message });
    toast({ title: "Magic link sent", description: `Check ${email}` });
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
  }
  return (
    <main className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-semibold">Admin Panel</h1>

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
