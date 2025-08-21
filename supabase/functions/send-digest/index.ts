import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";
import { Resend } from "npm:resend@2.0.0";

const supabaseUrl = "https://sixpcrgvsxfhtthwdbkm.supabase.co";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(resendApiKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DigestRequest {
  period: 'daily' | 'weekly';
}

const serve_handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { period }: DigestRequest = await req.json();
    
    console.log(`Processing ${period} digest`);

    // Find users who want this digest frequency
    const { data: users } = await supabase
      .from('email_preferences')
      .select('email, user_id')
      .eq('admin_digest', period);

    if (!users || users.length === 0) {
      console.log(`No users found for ${period} digest`);
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${users.length} users for ${period} digest`);

    // Calculate time window
    const now = new Date();
    const hoursBack = period === 'daily' ? 24 : 168; // 7 days = 168 hours
    const since = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

    let sentCount = 0;

    for (const user of users) {
      try {
        // Get boards this user manages (admin sees all activity)
        const { data: managedBoards } = await supabase
          .from('board_members')
          .select(`
            board_id,
            boards!inner(name, slug, item_type)
          `)
          .eq('email', user.email)
          .eq('role', 'manager');

        if (!managedBoards || managedBoards.length === 0) {
          console.log(`User ${user.email} manages no boards, skipping`);
          continue;
        }

        const boardIds = managedBoards.map(b => b.board_id);

        // Get recent activity across managed boards
        const { data: recentIdeas } = await supabase
          .from('ideas')
          .select('id, title, status, creator_name, board_id, created_at, updated_at, last_activity_at')
          .in('board_id', boardIds)
          .gte('last_activity_at', since.toISOString())
          .order('last_activity_at', { ascending: false });

        if (!recentIdeas || recentIdeas.length === 0) {
          console.log(`No recent activity for user ${user.email}, skipping`);
          continue;
        }

        // Get recent notifications for context
        const { data: recentNotifications } = await supabase
          .from('notifications')
          .select('type, message, created_at, idea_id')
          .eq('user_email', user.email)
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: false });

        // Generate digest content
        const html = generateDigestHtml(period, managedBoards, recentIdeas, recentNotifications || []);

        // Send digest email
        await resend.emails.send({
          from: "Zoby Boards <noreply@mail.zoby.ai>",
          to: [user.email],
          subject: `Your ${period} Zoby Boards digest`,
          html,
        });

        sentCount++;
        console.log(`Digest sent to ${user.email}`);

      } catch (error) {
        console.error(`Failed to send digest to ${user.email}:`, error);
      }
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in send-digest function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

function generateDigestHtml(period: string, boards: any[], ideas: any[], notifications: any[]) {
  const periodLabel = period === 'daily' ? 'Daily' : 'Weekly';
  
  let html = `
    <h1>Your ${periodLabel} Zoby Boards Digest</h1>
    <p>Here's what happened across your boards in the past ${period === 'daily' ? '24 hours' : 'week'}:</p>
  `;

  // Group ideas by board
  const boardMap = new Map();
  boards.forEach(b => {
    if (b.boards) {
      boardMap.set(b.board_id, b.boards);
    }
  });

  const ideasByBoard = new Map();
  ideas.forEach(idea => {
    if (!ideasByBoard.has(idea.board_id)) {
      ideasByBoard.set(idea.board_id, []);
    }
    ideasByBoard.get(idea.board_id).push(idea);
  });

  // Generate board sections
  for (const [boardId, boardIdeas] of ideasByBoard) {
    const board = boardMap.get(boardId);
    if (!board) continue;

    html += `
      <div style="margin: 24px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="margin: 0 0 12px 0; color: #1f2937;">
          <a href="https://boards.zoby.ai/b/${board.slug}" style="color: #2563eb; text-decoration: none;">
            ${board.name}
          </a>
        </h2>
        
        <div style="margin-bottom: 16px;">
          <strong>${boardIdeas.length}</strong> ${board.item_type || 'idea'}${boardIdeas.length !== 1 ? 's' : ''} with activity
        </div>

        <div style="font-size: 14px;">
    `;

    // Show recent ideas for this board
    boardIdeas.slice(0, 5).forEach(idea => {
      const activityTime = new Date(idea.last_activity_at).toLocaleDateString();
      html += `
          <div style="margin: 8px 0; padding: 8px; background: #f9fafb; border-radius: 4px;">
            <strong>${idea.title}</strong> - ${idea.status}
            <div style="color: #6b7280; font-size: 12px;">
              by ${idea.creator_name} • Last activity: ${activityTime}
            </div>
          </div>
      `;
    });

    if (boardIdeas.length > 5) {
      html += `
          <div style="margin: 8px 0; color: #6b7280; font-size: 12px;">
            ... and ${boardIdeas.length - 5} more
          </div>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }

  // Add summary of notifications
  if (notifications.length > 0) {
    const notificationCounts = notifications.reduce((acc, notif) => {
      acc[notif.type] = (acc[notif.type] || 0) + 1;
      return acc;
    }, {});

    html += `
      <div style="margin: 24px 0; padding: 16px; background: #f0f9ff; border-radius: 8px;">
        <h3 style="margin: 0 0 12px 0;">Your Activity Summary</h3>
        <ul style="margin: 0; padding-left: 20px;">
    `;

    Object.entries(notificationCounts).forEach(([type, count]) => {
      html += `<li>${count} ${type} notification${count !== 1 ? 's' : ''}</li>`;
    });

    html += `
        </ul>
      </div>
    `;
  }

  html += `
    <div style="margin: 32px 0; padding: 16px; background: #f9fafb; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 12px 0;">Want to change your digest frequency?</p>
      <a href="https://boards.zoby.ai/account" style="background: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">
        Update Email Preferences
      </a>
    </div>
    
    <div style="margin: 24px 0; text-align: center; color: #6b7280; font-size: 12px;">
      <p>You're receiving this because you're an admin on Zoby Boards.</p>
    </div>
  `;

  return html;
}

serve(serve_handler);