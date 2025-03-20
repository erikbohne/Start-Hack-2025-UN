'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SendIcon, Loader2 } from "lucide-react";
import { ChatMessage, Message } from './ChatMessage';
import { v4 as uuidv4 } from 'uuid';

interface ChatProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  content: 'Hello! I can help you visualize geospatial data for the Assaba region in Mauritania. Try asking me about rainfall, population density, land cover, or vegetation productivity.',
  role: 'assistant',
  timestamp: new Date()
};

const EXAMPLE_PROMPTS = [
  "Show me rainfall data for Assaba region in 2022",
  "Display population density in Assaba for 2020",
  "Visualize land cover types in Assaba for 2018",
  "Show vegetation productivity in Assaba from 2015 to 2020"
];

export default function Chat({ onSubmit, isLoading }: ChatProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (scrollArea) {
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  }, [messages]);

  // Focus input when component loads
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    // Add user message
    const userMessage: Message = {
      id: uuidv4(),
      content: input.trim(),
      role: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    onSubmit(input.trim());
    setInput('');
    
    // Add loading message from assistant
    setTimeout(() => {
      const assistantMessage: Message = {
        id: uuidv4(),
        content: 'Visualizing your data now...',
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <Card className="flex flex-col h-full border-none shadow-none">
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="text-xl">GeoData Explorer</CardTitle>
        <CardDescription>
          Ask questions to visualize geospatial data
        </CardDescription>
      </CardHeader>
      
      <ScrollArea ref={scrollAreaRef} className="flex-1 px-4">
        <div className="space-y-1 pt-1">
          {messages.map(message => (
            <ChatMessage key={message.id} message={message} />
          ))}
        </div>
      </ScrollArea>
      
      <div className="px-4 pt-2 pb-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {EXAMPLE_PROMPTS.map((prompt, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => handleExampleClick(prompt)}
            >
              {prompt}
            </Button>
          ))}
        </div>
        
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            ref={textareaRef}
            placeholder="Ask about geospatial data..."
            className="min-h-10 resize-none flex-1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendIcon className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </Card>
  );
} 