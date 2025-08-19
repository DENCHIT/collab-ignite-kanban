import { useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { useToast } from "./use-toast";

interface WatchButtonProps {
  isWatching: boolean;
  onToggleWatch: () => Promise<void>;
  className?: string;
}

export const WatchButton = ({ isWatching, onToggleWatch, className }: WatchButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleClick = async () => {
    setIsLoading(true);
    try {
      await onToggleWatch();
      toast({
        title: isWatching ? "Stopped watching" : "Now watching",
        description: isWatching 
          ? "You will no longer receive notifications for this idea" 
          : "You'll receive notifications when this idea is updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update watch status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClick}
          disabled={isLoading}
          className={className}
        >
          {isWatching ? (
            <Bell className="h-4 w-4 text-primary" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isWatching ? "Stop watching" : "Watch for updates"}
      </TooltipContent>
    </Tooltip>
  );
};