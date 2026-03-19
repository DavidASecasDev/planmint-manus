import { useState, useRef, useEffect, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string, mentionedUserIds: string[]) => void;
  users: User[];
  placeholder?: string;
  disabled?: boolean;
}

export function MentionInput({ 
  value, 
  onChange, 
  users, 
  placeholder,
  disabled 
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionedUsers, setMentionedUsers] = useState<Map<string, string>>(new Map());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const filteredUsers = users.filter(u => 
    u.name && u.name.toLowerCase().includes(suggestionQuery.toLowerCase())
  ).slice(0, 5);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart;
    setCursorPosition(cursor);

    // Find if we're typing a mention
    const textBeforeCursor = newValue.slice(0, cursor);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setShowSuggestions(true);
      setSuggestionQuery(mentionMatch[1]);
    } else {
      setShowSuggestions(false);
      setSuggestionQuery('');
    }

    // Update mentioned users - remove any that are no longer in text
    const updatedMentions = new Map<string, string>();
    mentionedUsers.forEach((name, id) => {
      if (newValue.includes(`@${name}`)) {
        updatedMentions.set(id, name);
      }
    });
    setMentionedUsers(updatedMentions);

    onChange(newValue, Array.from(updatedMentions.keys()));
  };

  const insertMention = useCallback((user: User) => {
    if (!user.name || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);
    
    // Find the @ symbol position
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (!mentionMatch) return;

    const atPosition = textBeforeCursor.lastIndexOf('@');
    const newText = value.slice(0, atPosition) + `@${user.name} ` + textAfterCursor;
    
    // Add to mentioned users
    const newMentions = new Map(mentionedUsers);
    newMentions.set(user.id, user.name);
    setMentionedUsers(newMentions);

    onChange(newText, Array.from(newMentions.keys()));
    setShowSuggestions(false);
    setSuggestionQuery('');

    // Focus back to textarea
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = atPosition + (user.name ?? '').length + 2;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [value, cursorPosition, mentionedUsers, onChange]);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filteredUsers.length === 0) return;

    if (e.key === 'Escape') {
      setShowSuggestions(false);
    } else if (e.key === 'Enter' && showSuggestions) {
      e.preventDefault();
      insertMention(filteredUsers[0]);
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
        className="resize-none"
      />
      
      {showSuggestions && filteredUsers.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-40 overflow-y-auto"
        >
          {filteredUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                "focus:bg-accent focus:text-accent-foreground focus:outline-none"
              )}
              onClick={() => insertMention(user)}
            >
              @{user.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
