'use client';
import { useState, useEffect } from 'react';
import Map from '@/components/Map';
import QueryInput from '@/components/QueryInput';
import YearSlider from '@/components/YearSlider';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(2022);
  const [currentDataset, setCurrentDataset] = useState('');
  const [hasActiveQuery, setHasActiveQuery] = useState(false);
  const [baseQuery, setBaseQuery] = useState('');
  
  // Available year range for the datasets
  const startYear = 2010;
  const endYear = 2023;
  
  // Function to handle query submission and trigger the map component
  const handleQuerySubmit = (query: string) => {
    setIsLoading(true);
    setBaseQuery(query);
    setHasActiveQuery(true);
    
    // Add the year to the query if not already included
    const queryWithYear = ensureYearInQuery(query, selectedYear);
    
    // Determine dataset type from query
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('rainfall') || lowerQuery.includes('precipitation')) {
      setCurrentDataset('Rainfall');
    } else if (lowerQuery.includes('population')) {
      setCurrentDataset('Population Density');
    } else if (lowerQuery.includes('vegetation') || lowerQuery.includes('productivity')) {
      setCurrentDataset('Vegetation Productivity');
    } else if (lowerQuery.includes('land cover') || lowerQuery.includes('land use')) {
      setCurrentDataset('Land Cover');
    } else {
      setCurrentDataset('');
    }
    
    // Create a custom event to notify the Map component
    const event = new CustomEvent('querySubmit', { 
      detail: { query: queryWithYear }
    });
    window.dispatchEvent(event);
    
    // Reset loading state after a delay to allow processing to start
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };
  
  // Add a debounce timer to prevent too many API calls
  const [yearChangeTimer, setYearChangeTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Function to handle year change with debounce
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    
    if (hasActiveQuery) {
      // Clear any existing timer
      if (yearChangeTimer) {
        clearTimeout(yearChangeTimer);
      }
      
      // Set a new timer - only trigger API call after 500ms of inactivity
      const timer = setTimeout(() => {
        // Only trigger a new query if we have an active base query
        const queryWithYear = ensureYearInQuery(baseQuery, year);
        
        setIsLoading(true);
        
        // Create a custom event to notify the Map component
        const event = new CustomEvent('querySubmit', { 
          detail: { query: queryWithYear }
        });
        window.dispatchEvent(event);
        
        setTimeout(() => {
          setIsLoading(false);
        }, 500);
      }, 500);
      
      setYearChangeTimer(timer);
    }
  };
  
  // Clean up timer on component unmount
  useEffect(() => {
    return () => {
      if (yearChangeTimer) {
        clearTimeout(yearChangeTimer);
      }
    };
  }, [yearChangeTimer]);
  
  // Ensure the query includes the year
  const ensureYearInQuery = (query: string, year: number): string => {
    // If the query already contains a year, replace it
    const yearRegex = /\b(19|20)\d{2}\b/g; // Matches years from 1900-2099
    if (yearRegex.test(query)) {
      return query.replace(yearRegex, year.toString());
    }
    
    // Otherwise, add the year to the query
    return `${query} for ${year}`;
  };
  
  return (
    <main className="flex min-h-screen flex-col">
      {/* Main content */}
      <div className="flex flex-1 mt-16">
        {/* Map section - 60% width */}
        <section className="w-[60%] h-[calc(100vh-4rem)] relative">
          <Map />
        </section>
        
        {/* Right sidebar - 40% width */}
        <section className="w-[40%] bg-muted h-[calc(100vh-4rem)] p-4 overflow-y-auto border-l border-border">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-xl text-primary">GeoData Explorer</CardTitle>
              <CardDescription>
                Enter a natural language query to visualize geospatial data for the Assaba region in Mauritania.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QueryInput 
                onSubmit={handleQuerySubmit} 
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
          
          {/* Year selector */}
          {hasActiveQuery && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-md">Temporal Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <YearSlider 
                  startYear={startYear}
                  endYear={endYear}
                  currentYear={selectedYear}
                  onChange={handleYearChange}
                  disabled={isLoading}
                  dataset={currentDataset}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Move the slider or click on a year to analyze temporal changes.
                </p>
              </CardContent>
            </Card>
          )}
          
          {/* Dataset info */}
          {currentDataset && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-md">Current Dataset</CardTitle>
              </CardHeader>
              <CardContent className="pb-2">
                <p>{currentDataset} data for Assaba region</p>
                <p className="text-sm text-muted-foreground">Year: {selectedYear}</p>
                <div className="flex items-center mt-2">
                  <div className={`w-3 h-3 rounded-full mr-2 ${isLoading ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                  <p className="text-xs">{isLoading ? 'Loading data...' : 'Data loaded'}</p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Debug toggle */}
          <div className="absolute bottom-4 right-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent('toggleDebug'))}
            >
              Toggle Debug
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}