import { useState } from "react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { Plus, Smile } from "lucide-react";

interface CommentReactionsProps {
  reactions?: Record<string, string[]>; // emoji -> array of user emails
  onReact: (emoji: string) => void;
  currentUserEmail: string;
  className?: string;
}

const QUICK_REACTIONS = ["👍", "❤️", "🎉", "😂", "😮", "😢", "🚀", "👀"];

export const CommentReactions = ({ 
  reactions = {}, 
  onReact, 
  currentUserEmail, 
  className 
}: CommentReactionsProps) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const handleReaction = (emoji: string) => {
    onReact(emoji);
    setIsPopoverOpen(false);
  };

  const getUsersForEmoji = (emoji: string) => {
    return reactions[emoji] || [];
  };

  const hasUserReacted = (emoji: string) => {
    return getUsersForEmoji(emoji).includes(currentUserEmail);
  };

  const getReactionCount = (emoji: string) => {
    return getUsersForEmoji(emoji).length;
  };

  const getReactionTooltip = (emoji: string) => {
    const users = getUsersForEmoji(emoji);
    if (users.length === 0) return "";
    if (users.length === 1) return users[0];
    if (users.length <= 3) return users.join(", ");
    return `${users.slice(0, 2).join(", ")} and ${users.length - 2} others`;
  };

  // Get reactions that have at least one user
  const activeReactions = Object.entries(reactions).filter(([_, users]) => users.length > 0);

  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      {/* Show existing reactions */}
      {activeReactions.map(([emoji, users]) => (
        <Tooltip key={emoji}>
          <TooltipTrigger asChild>
            <Button
              variant={hasUserReacted(emoji) ? "secondary" : "ghost"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onReact(emoji)}
            >
              <span className="mr-1">{emoji}</span>
              <span>{getReactionCount(emoji)}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {getReactionTooltip(emoji)}
          </TooltipContent>
        </Tooltip>
      ))}

      {/* Add reaction button */}
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Smile className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <div className="grid grid-cols-4 gap-1">
            {QUICK_REACTIONS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-base hover:bg-muted"
                onClick={() => handleReaction(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};