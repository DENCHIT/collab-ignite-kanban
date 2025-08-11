import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Board } from "@/components/kanban/Board";
import { getAdminPasscode, getDisplayName, getTeamPasscode, setAdminPasscode, setDisplayName, setIsAdmin, setTeamPasscode } from "@/lib/session";

export default function BoardPage() {
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [step, setStep] = useState<"passcode" | "name" | "board">("passcode");
  const [passcode, setPasscode] = useState("");
  const [name, setNameInput] = useState("");

  useEffect(() => {
    const savedName = getDisplayName();
    if (savedName) setNameInput(savedName);
  }, []);

  function handlePasscode() {
    const teamCode = getTeamPasscode();
    if (!teamCode) {
      // First admin visit: set initial passcode
      setTeamPasscode(passcode);
      toast({ title: "Team passcode set" });
      setHasAccess(true);
      setStep("name");
      return;
    }
    if (passcode === teamCode) {
      setHasAccess(true);
      setStep("name");
    } else if (passcode === getAdminPasscode()) {
      setIsAdmin(true);
      setHasAccess(true);
      setStep("name");
    } else {
      toast({ title: "Wrong passcode" });
    }
  }

  function handleName() {
    if (!name.trim()) {
      toast({ title: "Please enter a display name" });
      return;
    }
    setDisplayName(name.trim());
    setStep("board");
  }

  if (!hasAccess || step !== "board") {
    return (
      <div className="container mx-auto py-10">
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="p-6 space-y-4">
              {step === "passcode" && (
                <>
                  <h1 className="text-xl font-semibold">Enter team passcode</h1>
                  <Input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Team passcode" />
                  <div className="flex gap-2">
                    <Button onClick={handlePasscode} className="flex-1">Continue</Button>
                    <Button variant="secondary" onClick={() => { setIsAdmin(false); setPasscode(""); }}>Reset</Button>
                  </div>
                  <p className="text-sm text-muted-foreground">Tip: first user can set the passcode. Admins can also unlock with the admin passcode from /admin.</p>
                </>
              )}
              {step === "name" && (
                <>
                  <h1 className="text-xl font-semibold">Choose a display name</h1>
                  <Input value={name} onChange={(e) => setNameInput(e.target.value)} placeholder="Your name" />
                  <Button onClick={handleName}>Enter board</Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <main className="container mx-auto py-6">
      <Board />
    </main>
  );
}
