'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MapLegendProps {
  title: string;
  colorScale: Array<{
    color: string;
    label: string;
  }>;
  unit?: string;
}

export default function MapLegend({ title, colorScale, unit }: MapLegendProps) {
  return (
    <Card className="absolute bottom-4 right-4 w-56 shadow-md">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-2">
        <div className="flex flex-col space-y-1">
          {colorScale.map((item, index) => (
            <div key={index} className="flex items-center">
              <div 
                className="w-6 h-6 mr-2 rounded-sm border border-border" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-muted-foreground">
                {item.label} {unit && index === colorScale.length - 1 ? `(${unit})` : ''}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}