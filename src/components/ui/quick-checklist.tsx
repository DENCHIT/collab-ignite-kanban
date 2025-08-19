import { useState } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Checkbox } from "./checkbox";
import { ProgressBar } from "./progress-bar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Plus, CheckSquare, Trash2 } from "lucide-react";
import { IdeaChecklistItem } from "@/types/idea";
import { cn } from "@/lib/utils";

interface QuickChecklistProps {
  items: IdeaChecklistItem[];
  onItemsChange: (items: IdeaChecklistItem[]) => void;
  className?: string;
  trigger?: React.ReactNode;
}

export const QuickChecklist = ({
  items,
  onItemsChange,
  className,
  trigger
}: QuickChecklistProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newItemText, setNewItemText] = useState("");

  const completedCount = items.filter(item => item.completed).length;
  const totalCount = items.length;

  const handleAddItem = () => {
    if (!newItemText.trim()) return;
    
    const newItem: IdeaChecklistItem = {
      id: crypto.randomUUID(),
      text: newItemText.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    };

    onItemsChange([...items, newItem]);
    setNewItemText("");
  };

  const handleToggleItem = (itemId: string) => {
    const updatedItems = items.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    onItemsChange(updatedItems);
  };

  const handleDeleteItem = (itemId: string) => {
    const updatedItems = items.filter(item => item.id !== itemId);
    onItemsChange(updatedItems);
  };

  const defaultTrigger = (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-xs"
    >
      <CheckSquare className="h-3 w-3 mr-1" />
      {totalCount > 0 ? `${completedCount}/${totalCount}` : "Add"}
    </Button>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger || defaultTrigger}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Checklist</h4>
            <span className="text-xs text-muted-foreground">
              {completedCount}/{totalCount}
            </span>
          </div>

          {totalCount > 0 && (
            <ProgressBar 
              value={completedCount} 
              max={totalCount} 
              size="sm"
            />
          )}

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 group">
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={() => handleToggleItem(item.id)}
                />
                <span
                  className={cn(
                    "flex-1 text-sm cursor-pointer select-none",
                    item.completed && "line-through text-muted-foreground"
                  )}
                >
                  {item.text}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDeleteItem(item.id)}
                >
                  <Trash2 className="h-2 w-2" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Input
              placeholder="Add item..."
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddItem();
                }
              }}
              className="text-xs h-7"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleAddItem}
              disabled={!newItemText.trim()}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};