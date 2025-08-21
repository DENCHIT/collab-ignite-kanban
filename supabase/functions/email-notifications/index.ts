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

interface NotificationRequest {
  event_type: 'mention' | 'assigned' | 'new_item' | 'moved' | 'new_board_member';
  board_id: string;
  idea_id?: string;
  actor_email: string;
  recipients?: string[];
  payload?: any;
}

const serve_handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event_type, board_id, idea_id, actor_email, recipients, payload }: NotificationRequest = await req.json();
    
    console.log(`Processing ${event_type} notification for board ${board_id}`);

    // Get board info
    const { data: board } = await supabase
      .from('boards')
      .select('name, slug')
      .eq('id', board_id)
      .single();

    if (!board) {
      throw new Error('Board not found');
    }

    let targetRecipients: string[] = [];

    // Determine recipients based on event type
    if (recipients) {
      targetRecipients = recipients;
    } else {
      switch (event_type) {
        case 'mention':
        case 'assigned':
          // These should have explicit recipients
          throw new Error(`${event_type} events require explicit recipients`);

        case 'new_item':
        case 'moved':
          // Notify board managers
          const { data: managers } = await supabase
            .from('board_members')
            .select('email')
            .eq('board_id', board_id)
            .eq('role', 'manager');
          
          targetRecipients = managers?.map(m => m.email) || [];
          break;

        case 'new_board_member':
          // Notify board managers
          const { data: boardManagers } = await supabase
            .from('board_members')
            .select('email')
            .eq('board_id', board_id)
            .eq('role', 'manager');
          
          targetRecipients = boardManagers?.map(m => m.email) || [];
          break;
      }
    }

    // Remove actor from recipients
    targetRecipients = targetRecipients.filter(email => email !== actor_email);

    if (targetRecipients.length === 0) {
      console.log('No recipients to notify');
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get email preferences for recipients
    const { data: preferences } = await supabase
      .from('email_preferences')
      .select('email, mentions, assigned, new_items, items_moved, new_board_members')
      .in('email', targetRecipients);

    // Filter recipients based on their preferences
    const enabledRecipients = targetRecipients.filter(email => {
      const prefs = preferences?.find(p => p.email === email);
      if (!prefs) return true; // Default to enabled if no preferences set

      switch (event_type) {
        case 'mention': return prefs.mentions;
        case 'assigned': return prefs.assigned;
        case 'new_item': return prefs.new_items;
        case 'moved': return prefs.items_moved;
        case 'new_board_member': return prefs.new_board_members;
        default: return false;
      }
    });

    if (enabledRecipients.length === 0) {
      console.log('All recipients have disabled this notification type');
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get idea info if needed
    let idea = null;
    if (idea_id) {
      const { data: ideaData } = await supabase
        .from('ideas')
        .select('title, status, creator_name')
        .eq('id', idea_id)
        .single();
      idea = ideaData;
    }

    // Generate email content
    const { subject, html } = generateEmailContent(event_type, board, idea, payload);

    // Send emails
    let sentCount = 0;
    for (const email of enabledRecipients) {
      try {
        // Verify recipient is a board member before sending
        const { data: memberCheck } = await supabase
          .from('board_members')
          .select('email')
          .eq('board_id', board_id)
          .eq('email', email)
          .single();

        if (!memberCheck) {
          console.log(`Skipping email to ${email} - not a board member`);
          continue;
        }

        await resend.emails.send({
          from: "Zoby Boards <noreply@mail.zoby.ai>",
          to: [email],
          subject,
          html,
        });
        sentCount++;
        console.log(`Email sent to ${email} for ${event_type} on board ${board?.name}`);
      } catch (error) {
        console.error(`Failed to send email to ${email}:`, error);
      }
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in email-notifications function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

function generateEmailContent(event_type: string, board: any, idea: any, payload: any) {
  const boardUrl = `https://boards.zoby.ai/b/${board.slug}`;
  
  switch (event_type) {
    case 'mention':
      return {
        subject: `You were mentioned in ${board.name}`,
        html: `
          <h2>You were mentioned!</h2>
          <p>Someone mentioned you in a comment on <strong>${idea?.title || 'an idea'}</strong> in the board <strong>${board.name}</strong>.</p>
          <p><a href="${boardUrl}" style="background: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">View Board</a></p>
        `
      };

    case 'assigned':
      return {
        subject: `You were assigned to ${idea?.title || 'an idea'} in ${board.name}`,
        html: `
          <h2>You've been assigned!</h2>
          <p>You were assigned to work on <strong>${idea?.title || 'an idea'}</strong> in the board <strong>${board.name}</strong>.</p>
          <p><strong>Status:</strong> ${idea?.status || 'Unknown'}</p>
          <p><a href="${boardUrl}" style="background: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">View Board</a></p>
        `
      };

    case 'new_item':
      return {
        subject: `New ${board.item_type || 'idea'} added to ${board.name}`,
        html: `
          <h2>New ${board.item_type || 'idea'} added!</h2>
          <p><strong>${idea?.title}</strong> was created by ${idea?.creator_name} in <strong>${board.name}</strong>.</p>
          <p><a href="${boardUrl}" style="background: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">View Board</a></p>
        `
      };

    case 'moved':
      return {
        subject: `${idea?.title || 'An idea'} was moved in ${board.name}`,
        html: `
          <h2>${board.item_type || 'Idea'} moved!</h2>
          <p><strong>${idea?.title}</strong> was moved ${payload?.from ? `from ${payload.from}` : ''} to <strong>${payload?.to || idea?.status}</strong> in <strong>${board.name}</strong>.</p>
          ${payload?.reason ? `<p><strong>Reason:</strong> ${payload.reason}</p>` : ''}
          <p><a href="${boardUrl}" style="background: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">View Board</a></p>
        `
      };

    case 'new_board_member':
      return {
        subject: `New member joined ${board.name}`,
        html: `
          <h2>New team member!</h2>
          <p><strong>${payload?.member_name || 'Someone'}</strong> (${payload?.member_email || ''}) joined the board <strong>${board.name}</strong>.</p>
          <p><a href="${boardUrl}" style="background: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">View Board</a></p>
        `
      };

    default:
      return {
        subject: `Activity in ${board.name}`,
        html: `
          <h2>Board Activity</h2>
          <p>There was activity in the board <strong>${board.name}</strong>.</p>
          <p><a href="${boardUrl}" style="background: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">View Board</a></p>
        `
      };
  }
}

serve(serve_handler);