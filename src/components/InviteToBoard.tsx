import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail } from "lucide-react";

interface Board {
  board_id: string;
  board_name: string;
  board_slug: string;
  role: string;
}

export default function InviteToBoard() {
  const [email, setEmail] = useState("");
  const [selectedBoard, setSelectedBoard] = useState("");
  const [passcode, setPasscode] = useState("");
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadUserBoards();
  }, []);

  async function loadUserBoards() {
    try {
      const { data, error } = await supabase.rpc('get_my_boards');
      
      if (error) {
        console.error('Error loading boards:', error);
        return;
      }

      setBoards(data || []);
    } catch (error) {
      console.error('Error loading boards:', error);
    } finally {
      setLoadingBoards(false);
    }
  }

  async function handleInvite() {
    if (!email || !selectedBoard || !passcode) {
      toast({ 
        title: "Missing information", 
        description: "Please enter an email, select a board, and provide the board passcode." 
      });
      return;
    }

    if (!email.includes('@')) {
      toast({ 
        title: "Invalid email", 
        description: "Please enter a valid email address." 
      });
      return;
    }

    setLoading(true);

    try {
      const selectedBoardData = boards.find(b => b.board_id === selectedBoard);
      
      const { error } = await supabase.functions.invoke('send-board-invite', {
        body: {
          email,
          board_id: selectedBoard,
          board_name: selectedBoardData?.board_name || 'Board',
          board_slug: selectedBoardData?.board_slug || '',
          passcode
        }
      });

      if (error) {
        throw error;
      }

      toast({ 
        title: "Invitation sent!", 
        description: `Invitation sent to ${email}` 
      });
      
      setEmail("");
      setSelectedBoard("");
      setPasscode("");
    } catch (error) {
      console.error('Error sending invite:', error);
      toast({ 
        title: "Error", 
        description: "Failed to send invitation. Please try again." 
      });
    } finally {
      setLoading(false);
    }
  }

  if (loadingBoards) {
    return (
      <Card className="backdrop-blur-sm bg-card/80 border-border/50">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading boards...</div>
        </CardContent>
      </Card>
    );
  }

  if (boards.length === 0) {
    return (
      <Card className="backdrop-blur-sm bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5" />
            Invite to Board
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-center">
            You need to be a member of at least one board to send invitations.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-sm bg-card/80 border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="h-5 w-5" />
          Invite to Board
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email address</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="Enter email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="board-select">Select board</Label>
          <Select value={selectedBoard} onValueChange={setSelectedBoard}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a board" />
            </SelectTrigger>
            <SelectContent>
              {boards.map((board) => (
                <SelectItem key={board.board_id} value={board.board_id}>
                  {board.board_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="board-passcode">Board passcode</Label>
          <Input
            id="board-passcode"
            type="text"
            placeholder="Enter the board passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
          />
        </div>

        <Button 
          onClick={handleInvite} 
          disabled={loading || !email || !selectedBoard || !passcode}
          className="w-full"
        >
          {loading ? "Sending..." : "Send Invitation"}
        </Button>
      </CardContent>
    </Card>
  );
}