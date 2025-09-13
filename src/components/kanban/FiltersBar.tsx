import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export interface FiltersState {
  q: string;
  highScore: boolean;
  recent: boolean;
  mine: boolean;
  blocked: boolean;
  assignedToMe: boolean;
}

export function FiltersBar({ value, onChange, itemType = "idea" }: { value: FiltersState; onChange: (v: FiltersState) => void; itemType?: string }) {
  const itemLabel = itemType === "task" ? "tasks" : "ideas";
  return (
    <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
      <Input
        data-lpignore="true"
        name="search_filter"
        placeholder="Search..."
        className="max-w-md"
        value={value.q}
        onChange={(e) => onChange({ ...value, q: e.target.value })}
      />
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><Switch checked={value.highScore} onCheckedChange={(v) => onChange({ ...value, highScore: v, recent: v ? false : value.recent })} /> High score</label>
        <label className="flex items-center gap-2"><Switch checked={value.recent} onCheckedChange={(v) => onChange({ ...value, recent: v, highScore: v ? false : value.highScore })} /> Recent</label>
        <label className="flex items-center gap-2"><Switch checked={value.mine} onCheckedChange={(v) => onChange({ ...value, mine: v })} /> My {itemLabel}</label>
        <label className="flex items-center gap-2"><Switch checked={value.assignedToMe} onCheckedChange={(v) => onChange({ ...value, assignedToMe: v })} /> Assigned to me</label>
        <label className="flex items-center gap-2"><Switch checked={value.blocked} onCheckedChange={(v) => onChange({ ...value, blocked: v })} /> Blocked</label>
      </div>
    </div>
  );
}
