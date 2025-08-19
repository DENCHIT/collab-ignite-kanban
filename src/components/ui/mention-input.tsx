import { useState, useRef, useEffect } from "react";
import { Textarea } from "./textarea";

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMention?: (email: string) => void;
  placeholder?: string;
  className?: string;
  boardMembers?: Array<{ email: string; display_name: string }>;
}

export const MentionInput = ({ 
  value, 
  onChange, 
  onMention, 
  placeholder, 
  className, 
  boardMembers = [] 
}: MentionInputProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    onChange(newValue);

    // Check for @ mentions
    const beforeCursor = newValue.slice(0, cursorPos);
    const atIndex = beforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const afterAt = beforeCursor.slice(atIndex + 1);
      const spaceIndex = afterAt.indexOf(' ');
      
      if (spaceIndex === -1 && afterAt.length <= 20) {
        setMentionStart(atIndex);
        setMentionQuery(afterAt);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const insertMention = (member: { email: string; display_name: string }) => {
    const beforeMention = value.slice(0, mentionStart);
    const afterMention = value.slice(mentionStart + mentionQuery.length + 1);
    const newValue = `${beforeMention}@${member.display_name} ${afterMention}`;
    
    onChange(newValue);
    onMention?.(member.email);
    setShowSuggestions(false);
    
    // Focus back on textarea
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const filteredMembers = boardMembers.filter(member =>
    member.display_name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={className}
      />
      
      {showSuggestions && filteredMembers.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filteredMembers.slice(0, 5).map((member) => (
            <div
              key={member.email}
              className="px-3 py-2 cursor-pointer hover:bg-muted flex flex-col"
              onClick={() => insertMention(member)}
            >
              <span className="font-medium">{member.display_name}</span>
              <span className="text-sm text-muted-foreground">{member.email}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};