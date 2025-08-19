import { useState } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Checkbox } from "./checkbox";
import { ProgressBar } from "./progress-bar";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { IdeaChecklistItem } from "@/types/idea";
import { cn } from "@/lib/utils";

interface ChecklistProps {
  items: IdeaChecklistItem[];
  onItemsChange: (items: IdeaChecklistItem[]) => void;
  onItemToggle?: (itemId: string) => void;
  className?: string;
  showProgress?: boolean;
  readonly?: boolean;
}

export const Checklist = ({
  items,
  onItemsChange,
  onItemToggle,
  className,
  showProgress = true,
  readonly = false
}: ChecklistProps) => {
  const [newItemText, setNewItemText] = useState("");

  const completedCount = items.filter(item => item.completed).length;
  const totalCount = items.length;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

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
    onItemToggle?.(itemId);
  };

  const handleDeleteItem = (itemId: string) => {
    const updatedItems = items.filter(item => item.id !== itemId);
    onItemsChange(updatedItems);
  };

  const handleEditItem = (itemId: string, newText: string) => {
    if (!newText.trim()) return;
    
    const updatedItems = items.map(item =>
      item.id === itemId ? { ...item, text: newText.trim() } : item
    );
    onItemsChange(updatedItems);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {showProgress && totalCount > 0 && (
        <ProgressBar 
          value={completedCount} 
          max={totalCount} 
          showLabel 
          size="sm"
        />
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            onToggle={() => handleToggleItem(item.id)}
            onDelete={() => handleDeleteItem(item.id)}
            onEdit={(newText) => handleEditItem(item.id, newText)}
            readonly={readonly}
          />
        ))}
      </div>

      {!readonly && (
        <div className="flex gap-2">
          <Input
            placeholder="Add a checklist item..."
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddItem();
              }
            }}
            className="text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddItem}
            disabled={!newItemText.trim()}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

interface ChecklistItemProps {
  item: IdeaChecklistItem;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: (text: string) => void;
  readonly?: boolean;
}

const ChecklistItem = ({ item, onToggle, onDelete, onEdit, readonly }: ChecklistItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);

  const handleSaveEdit = () => {
    if (editText.trim() !== item.text) {
      onEdit(editText);
    }
    setIsEditing(false);
    setEditText(item.text);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText(item.text);
  };

  return (
    <div className="group flex items-center gap-2 p-2 rounded-md hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2 flex-1">
        <Checkbox
          checked={item.completed}
          onCheckedChange={onToggle}
          disabled={readonly}
        />
        
        {isEditing && !readonly ? (
          <Input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSaveEdit();
              } else if (e.key === "Escape") {
                handleCancelEdit();
              }
            }}
            className="text-sm h-6 px-1"
            autoFocus
          />
        ) : (
          <span
            className={cn(
              "flex-1 text-sm cursor-pointer select-none",
              item.completed && "line-through text-muted-foreground",
              !readonly && "hover:text-foreground"
            )}
            onClick={() => !readonly && setIsEditing(true)}
          >
            {item.text}
          </span>
        )}
      </div>

      {!readonly && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};