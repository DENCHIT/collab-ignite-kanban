import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";

interface EmailPreferencesProps {
  user: User;
}

interface EmailPrefs {
  mentions: boolean;
  assigned: boolean;
  new_items: boolean;
  items_moved: boolean;
  new_board_members: boolean;
  admin_digest: 'off' | 'daily' | 'weekly';
}

export default function EmailPreferences({ user }: EmailPreferencesProps) {
  const [preferences, setPreferences] = useState<EmailPrefs>({
    mentions: true,
    assigned: true,
    new_items: true,
    items_moved: false,
    new_board_members: true,
    admin_digest: 'off'
  });
  const [loading, setLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPreferences();
    checkUserRoles();
  }, [user]);

  const loadPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('email_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setPreferences({
          mentions: data.mentions,
          assigned: data.assigned,
          new_items: data.new_items,
          items_moved: data.items_moved,
          new_board_members: data.new_board_members,
          admin_digest: data.admin_digest
        });
      }
    } catch (error) {
      console.error('Failed to load email preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkUserRoles = async () => {
    try {
      // Check if user is admin
      const isAdminUser = user.email === 'ed@zoby.ai';
      setIsAdmin(isAdminUser);

      // Check if user manages any boards
      const { data: managedBoards } = await supabase
        .from('board_members')
        .select('board_id')
        .eq('email', user.email)
        .eq('role', 'manager');

      setIsManager((managedBoards?.length || 0) > 0);
    } catch (error) {
      console.error('Failed to check user roles:', error);
    }
  };

  const updatePreference = async (key: keyof EmailPrefs, value: boolean | string) => {
    try {
      const newPreferences = { ...preferences, [key]: value };
      setPreferences(newPreferences);

      // Upsert preferences
      const { error } = await supabase
        .from('email_preferences')
        .upsert({
          user_id: user.id,
          email: user.email,
          ...newPreferences
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast({
        title: "Preferences updated",
        description: "Your email notification preferences have been saved.",
      });
    } catch (error: any) {
      // Revert the change on error
      loadPreferences();
      toast({
        title: "Error",
        description: error.message || "Failed to update preferences.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Loading preferences...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Notifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Member notifications */}
        <div>
          <h4 className="font-medium mb-3">Member Notifications</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="mentions">Mentions</Label>
                <p className="text-sm text-muted-foreground">
                  When someone mentions you in a comment
                </p>
              </div>
              <Switch
                id="mentions"
                checked={preferences.mentions}
                onCheckedChange={(checked) => updatePreference('mentions', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="assigned">Assigned</Label>
                <p className="text-sm text-muted-foreground">
                  When you're assigned to work on an idea or task
                </p>
              </div>
              <Switch
                id="assigned"
                checked={preferences.assigned}
                onCheckedChange={(checked) => updatePreference('assigned', checked)}
              />
            </div>
          </div>
        </div>

        {/* Manager notifications */}
        {(isManager || isAdmin) && (
          <div>
            <h4 className="font-medium mb-3">Manager Notifications</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="new_items">New Ideas/Tasks</Label>
                  <p className="text-sm text-muted-foreground">
                    When new ideas or tasks are created in boards you manage
                  </p>
                </div>
                <Switch
                  id="new_items"
                  checked={preferences.new_items}
                  onCheckedChange={(checked) => updatePreference('new_items', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="items_moved">Ideas/Tasks Moved</Label>
                  <p className="text-sm text-muted-foreground">
                    When ideas or tasks are moved between columns
                  </p>
                </div>
                <Switch
                  id="items_moved"
                  checked={preferences.items_moved}
                  onCheckedChange={(checked) => updatePreference('items_moved', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="new_board_members">New Board Members</Label>
                  <p className="text-sm text-muted-foreground">
                    When new members join boards you manage
                  </p>
                </div>
                <Switch
                  id="new_board_members"
                  checked={preferences.new_board_members}
                  onCheckedChange={(checked) => updatePreference('new_board_members', checked)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Admin notifications */}
        {isAdmin && (
          <div>
            <h4 className="font-medium mb-3">Admin Notifications</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="admin_digest">Activity Digest</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive a summary of activity across all boards
                  </p>
                </div>
                <Select
                  value={preferences.admin_digest}
                  onValueChange={(value) => updatePreference('admin_digest', value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Off</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {!isManager && !isAdmin && (
          <div className="text-sm text-muted-foreground">
            Additional notification options will appear when you become a board manager or admin.
          </div>
        )}
      </CardContent>
    </Card>
  );
}