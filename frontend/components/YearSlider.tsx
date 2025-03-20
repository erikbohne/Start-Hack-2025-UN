'use client';

import { useState, useEffect } from 'react';
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ReloadIcon } from "@radix-ui/react-icons";

interface YearSliderProps {
  startYear: number;
  endYear: number;
  currentYear: number;
  onChange: (year: number) => void;
  disabled?: boolean;
  dataset?: string;
}

export default function YearSlider({ 
  startYear, 
  endYear, 
  currentYear,
  onChange,
  disabled = false,
  dataset = ''
}: YearSliderProps) {
  const [year, setYear] = useState(currentYear);
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
  
  // Update local state when currentYear prop changes
  useEffect(() => {
    setYear(currentYear);
  }, [currentYear]);
  
  const handleChange = (value: number[]) => {
    const newYear = value[0];
    setYear(newYear);
    onChange(newYear);
  };
  
  const handleYearButtonClick = (selectedYear: number) => {
    setYear(selectedYear);
    onChange(selectedYear);
  };
  
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium">
          {dataset ? `${dataset} - ` : ''}Year: {year}
        </h3>
        {disabled && (
          <ReloadIcon className="w-4 h-4 animate-spin" />
        )}
      </div>
      
      <Slider
        min={startYear}
        max={endYear}
        step={1}
        value={[year]}
        onValueChange={handleChange}
        disabled={disabled}
        className="w-full"
      />
      
      <div className="flex justify-between mt-2 text-xs overflow-x-auto pb-1">
        <div className="flex space-x-1">
          {years.map((y) => (
            <Button 
              key={y}
              variant={year === y ? "default" : "outline"}
              size="sm"
              onClick={() => handleYearButtonClick(y)}
              disabled={disabled}
              className="h-7 min-w-[35px] flex-shrink-0 px-2"
            >
              {y}
            </Button>
          ))}
        </div>
      </div>
      
      <div className="flex justify-between mt-1">
        <span className="text-xs text-muted-foreground">{startYear}</span>
        <span className="text-xs text-muted-foreground">{endYear}</span>
      </div>
    </div>
  );
}