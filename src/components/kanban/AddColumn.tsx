import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Check, X } from "lucide-react";

interface AddColumnProps {
  onAddColumn: (name: string) => void;
}

export function AddColumn({ onAddColumn }: AddColumnProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [columnName, setColumnName] = useState("");

  const handleSubmit = () => {
    if (columnName.trim()) {
      onAddColumn(columnName.trim());
      setColumnName("");
      setIsAdding(false);
    }
  };

  const handleCancel = () => {
    setColumnName("");
    setIsAdding(false);
  };

  if (isAdding) {
    return (
      <div className="flex-none w-80 h-full">
        <Card className="h-full bg-card border-dashed border-2">
          <CardContent className="p-4 space-y-3">
            <Input
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              placeholder="Column name"
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit();
                } else if (e.key === 'Escape') {
                  handleCancel();
                }
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!columnName.trim()}
              >
                <Check className="h-3 w-3 mr-1" />
                Add
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-none w-20 h-full">
      <Card className="h-full bg-muted/30 border-dashed border-2 hover:bg-muted/50 transition-colors cursor-pointer">
        <CardContent className="p-4 flex items-center justify-center h-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAdding(true)}
            className="flex flex-col items-center gap-2 h-full w-full"
          >
            <Plus className="h-6 w-6" />
            <span className="text-xs">Add</br>Column</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}