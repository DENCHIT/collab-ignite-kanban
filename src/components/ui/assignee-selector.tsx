import { useState } from "react";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { AssigneeAvatars } from "./assignee-avatars";
import { UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssigneeSelectorProps {
  assignees: string[];
  boardMembers: Array<{ email: string; display_name: string }>;
  onAssigneesChange: (assignees: string[]) => void;
  className?: string;
  trigger?: React.ReactNode;
}

export const AssigneeSelector = ({
  assignees,
  boardMembers,
  onAssigneesChange,
  className,
  trigger
}: AssigneeSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggleAssignee = (email: string) => {
    const newAssignees = assignees.includes(email)
      ? assignees.filter(a => a !== email)
      : [...assignees, email];
    
    onAssigneesChange(newAssignees);
  };

  const defaultTrigger = (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-xs"
    >
      {assignees.length > 0 ? (
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          <span>{assignees.length}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <UserPlus className="h-3 w-3" />
          <span>Assign</span>
        </div>
      )}
    </Button>
  );

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {assignees.length > 0 && (
        <AssigneeAvatars 
          assignees={assignees} 
          boardMembers={boardMembers}
          maxVisible={2}
          size="sm"
        />
      )}
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          {trigger || defaultTrigger}
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Assign People</h4>
              <span className="text-xs text-muted-foreground">
                {assignees.length} assigned
              </span>
            </div>

            {boardMembers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                No board members found
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {boardMembers.map((member) => (
                  <div key={member.email} className="flex items-center gap-2 p-1 rounded hover:bg-muted/50">
                    <Checkbox
                      checked={assignees.includes(member.email)}
                      onCheckedChange={() => handleToggleAssignee(member.email)}
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <AssigneeAvatars 
                        assignees={[member.email]} 
                        boardMembers={[member]}
                        maxVisible={1}
                        size="sm"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{member.display_name}</div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {assignees.length > 0 && (
              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => onAssigneesChange([])}
                >
                  Clear All Assignees
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};