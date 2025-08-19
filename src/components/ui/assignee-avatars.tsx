import { Avatar, AvatarFallback } from "./avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { cn } from "@/lib/utils";

interface AssigneeAvatarsProps {
  assignees: string[];
  boardMembers?: Array<{ email: string; display_name: string }>;
  maxVisible?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const AssigneeAvatars = ({ 
  assignees, 
  boardMembers = [],
  maxVisible = 3,
  size = "sm",
  className 
}: AssigneeAvatarsProps) => {
  const visibleAssignees = assignees.slice(0, maxVisible);
  const hiddenCount = Math.max(0, assignees.length - maxVisible);

  const getDisplayName = (email: string) => {
    const member = boardMembers.find(m => m.email === email);
    return member?.display_name || email.split('@')[0];
  };

  const getInitials = (email: string) => {
    const displayName = getDisplayName(email);
    return displayName
      .split(' ')
      .map(word => word.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const sizeClasses = {
    sm: "h-6 w-6 text-xs",
    md: "h-8 w-8 text-sm", 
    lg: "h-10 w-10 text-base"
  };

  if (assignees.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex -space-x-1", className)}>
      {visibleAssignees.map((email) => (
        <Tooltip key={email}>
          <TooltipTrigger asChild>
            <Avatar className={cn(
              "border-2 border-background cursor-pointer hover:z-10 transition-transform hover:scale-110",
              sizeClasses[size]
            )}>
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {getInitials(email)}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getDisplayName(email)}</p>
          </TooltipContent>
        </Tooltip>
      ))}
      
      {hiddenCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Avatar className={cn(
              "border-2 border-background cursor-pointer bg-muted",
              sizeClasses[size]
            )}>
              <AvatarFallback className="bg-muted text-muted-foreground font-medium">
                +{hiddenCount}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>
            <p>{hiddenCount} more assignee{hiddenCount > 1 ? 's' : ''}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};