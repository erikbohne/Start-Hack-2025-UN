'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  
  return (
    <div className={cn(
      "flex items-start gap-3 py-4",
      isUser ? "flex-row-reverse" : ""
    )}>
      <Avatar className={cn(
        "mt-0.5",
        isUser ? "bg-primary" : "bg-muted"
      )}>
        <AvatarFallback>
          {isUser ? 'U' : 'AI'}
        </AvatarFallback>
        {!isUser && (
          <AvatarImage src="/bot-avatar.png" alt="AI Assistant" />
        )}
      </Avatar>
      <div className={cn(
        "rounded-lg px-4 py-3 max-w-[85%]",
        isUser 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted text-muted-foreground"
      )}>
        <p className="text-sm leading-normal">{message.content}</p>
        <div className={cn(
          "text-xs mt-1 opacity-70",
          isUser ? "text-right" : "text-left"
        )}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
} 