import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Board } from "@/components/kanban/Board";
import { getAdminPasscode, getDisplayName, getTeamPasscode, getUserEmail, setAdminPasscode, setDisplayName, setIsAdmin, setTeamPasscode, setUserEmail } from "@/lib/session";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function BoardPage() {
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [step, setStep] = useState<"passcode" | "email" | "name" | "board">("passcode");
  const [passcode, setPasscode] = useState("");
  const [email, setEmail] = useState("");
  const [name, setNameInput] = useState("");
  const { slug } = useParams<{ slug?: string }>();

  useEffect(() => {
    console.log("BoardPage mounted with slug:", slug);
    const savedName = getDisplayName();
    const savedEmail = getUserEmail();
    if (savedName) setNameInput(savedName);
    if (savedEmail) setEmail(savedEmail);
    
    // If user already unlocked this board, skip passcode step
    const localPass = getTeamPasscode(slug);
    console.log("Local passcode for slug:", localPass);
    if (localPass) {
      setHasAccess(true);
      // If user already has email and name saved, skip directly to board
      if (savedEmail && savedName) {
        setStep("board");
      } else if (savedEmail) {
        setStep("name");
      } else {
        setStep("email");
      }
    }
  }, [slug]);

  async function handlePasscode() {
    if (slug) {
      // Use the new secure passcode verification function
      const { data, error } = await supabase.rpc('verify_board_passcode_secure', { 
        _slug: slug, 
        _passcode: passcode 
      });
      
      if (error) {
        console.error("Error verifying passcode:", error);
        toast({ 
          title: "Error", 
          description: "Failed to verify passcode",
          variant: "destructive" 
        });
        return;
      }
      
      if (data === true) {
        // Store authentication token (not the actual passcode)
        setTeamPasscode('authenticated', slug);
        setHasAccess(true);
        setStep("email");
        toast({ title: "Access granted!" });
        return;
      }
      
      // Check if it's admin passcode (still needed for admin functions)
      const adminPass = getAdminPasscode();
      if (adminPass && passcode === adminPass) {
        setIsAdmin(true);
        setHasAccess(true);
        setStep("email");
        toast({ title: "Admin access granted!" });
        return;
      }
      
      toast({ 
        title: "Access denied", 
        description: "Invalid passcode",
        variant: "destructive" 
      });
      return;
    }
    
    // Legacy handling for boards without slug (shouldn't happen in new system)
    const teamCode = getTeamPasscode();
    if (!teamCode) {
      // First admin visit: set initial passcode
      setTeamPasscode(passcode);
      toast({ title: "Team passcode set" });
      setHasAccess(true);
      setStep("email");
      return;
    }
    if (passcode === teamCode) {
      setHasAccess(true);
      setStep("email");
    } else if (passcode === getAdminPasscode()) {
      setIsAdmin(true);
      setHasAccess(true);
      setStep("email");
    } else {
      toast({ title: "Wrong passcode" });
    }
  }

  function handleEmail() {
    if (!email.trim() || !email.includes("@")) {
      toast({ title: "Please enter a valid email" });
      return;
    }
    setStep("name");
  }

  async function handleName() {
    if (!name.trim()) {
      toast({ title: "Please enter a display name" });
      return;
    }
    setDisplayName(name.trim());
    setUserEmail(email.trim());
    
    // Add user to board members
    if (slug) {
      await addMemberToBoard(slug, email.trim(), name.trim());
    }
    
    setStep("board");
  }

  async function addMemberToBoard(boardSlug: string, userEmail: string, displayName: string) {
    try {
      const { data: boardData } = await supabase
        .from("boards")
        .select("id")
        .eq("slug", boardSlug)
        .single();

      if (boardData) {
        const { error } = await supabase
          .from("board_members")
          .upsert({
            board_id: boardData.id,
            email: userEmail,
            display_name: displayName,
            role: "member"
          }, {
            onConflict: "board_id,email"
          });

        if (error && !error.message.includes("duplicate")) {
          console.error("Error adding member to board:", error);
        }
      }
    } catch (error) {
      console.error("Error adding member to board:", error);
    }
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
                  <p className="text-sm text-muted-foreground">Tip: For shared boards, enter the passcode provided by your admin. Admins can also unlock with the admin passcode from /admin.</p>
                </>
              )}
              {step === "email" && (
                <>
                  <h1 className="text-xl font-semibold">Enter your email</h1>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" />
                  <Button onClick={handleEmail}>Continue</Button>
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
      <Board boardSlug={slug} />
    </main>
  );
}
