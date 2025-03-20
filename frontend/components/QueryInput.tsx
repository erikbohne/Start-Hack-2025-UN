'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReloadIcon } from "@radix-ui/react-icons";

interface QueryInputProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
}

export default function QueryInput({ onSubmit, isLoading }: QueryInputProps) {
  const [query, setQuery] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSubmit(query);
    }
  };

  const sampleQueries = [
    "Rainfall data for assaba region in 2022",
    "Population density in assaba for 2020",
    "Land cover types in assaba for 2018",
    "Vegetation productivity in assaba from 2015 to 2020"
  ];

  return (
    <div className="w-full max-w-md">      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="query" className="text-sm font-medium">
            What data would you like to visualize?
          </label>
          <Textarea
            id="query"
            rows={2}
            className="resize-none"
            placeholder="E.g., Rainfall data for assaba region in 2022"
            value={query}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQuery(e.target.value)}
            disabled={isLoading}
          />
        </div>
        
        <Button
          type="submit"
          className="w-full"
          disabled={isLoading || !query.trim()}
        >
          {isLoading ? (
            <span className="flex items-center">
              <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </span>
          ) : 'Generate Map Data'}
        </Button>
      </form>
      
      <div className="mt-4 border-t pt-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          Try these examples:
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {sampleQueries.map((sampleQuery, index) => (
            <Button
              key={index}
              variant="ghost"
              className="justify-start h-auto text-sm p-2"
              onClick={() => {
                setQuery(sampleQuery);
              }}
              disabled={isLoading}
            >
              &ldquo;{sampleQuery}&rdquo;
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}