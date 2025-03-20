'use client';

import { useState } from 'react';
import { DatasetType, CountryType } from '@/lib/types';

interface DataControlsProps {
  onApplyFilters: (filters: {
    datasets: DatasetType[];
    countries: CountryType[];
    years: number[];
    thresholds?: {
      [dataset: string]: number;
    };
  }) => void;
  datasetRanges?: {
    [dataset: string]: { min: number; max: number };
  };
  thresholdValues?: {
    [dataset: string]: number;
  };
  onThresholdChange?: (dataset: string, value: number) => void;
}

export default function DataControls({ 
  onApplyFilters, 
  datasetRanges = {
    PopDensity: { min: 0, max: 100 },
    Precipitation: { min: 0, max: 1000 }
  },
  thresholdValues = {
    PopDensity: 0,
    Precipitation: 0
  },
  onThresholdChange
}: DataControlsProps) {
  const [selectedDatasets, setSelectedDatasets] = useState<DatasetType[]>(['PopDensity']);
  const [selectedCountries, setSelectedCountries] = useState<CountryType[]>(['Mali']);
  const [selectedYears, setSelectedYears] = useState<number[]>([2015]);
  const [showThresholds, setShowThresholds] = useState<boolean>(false);
  const [localThresholds, setLocalThresholds] = useState<{
    [dataset: string]: number;
  }>(thresholdValues);

  // Dataset options from backend DatasetEnum
  const datasetOptions: DatasetType[] = ['PopDensity', 'Precipitation'];
  
  // Country options from backend CountryEnum
  const countryOptions: CountryType[] = [
    'Burkina_Faso',
    'Chad',
    'Mali',
    'Mauritania',
    'Niger',
    'Senegal',
    'Sudan'
  ];

  // Generate year options (2010-2020 for example)
  const yearOptions = Array.from({ length: 11 }, (_, i) => 2010 + i);

  // Handle toggling a dataset selection
  const toggleDataset = (dataset: DatasetType) => {
    setSelectedDatasets(prev => 
      prev.includes(dataset)
        ? prev.filter(d => d !== dataset)
        : [...prev, dataset]
      );
  };

  // Handle toggling a country selection
  const toggleCountry = (country: CountryType) => {
    setSelectedCountries(prev => 
      prev.includes(country)
        ? prev.filter(c => c !== country)
        : [...prev, country]
    );
  };

  // Handle toggling a year selection
  const toggleYear = (year: number) => {
    setSelectedYears(prev => 
      prev.includes(year)
        ? prev.filter(y => y !== year)
        : [...prev, year]
    );
  };

  // Handle local threshold changes
  const handleLocalThresholdChange = (dataset: string, value: number) => {
    setLocalThresholds(prev => ({
      ...prev,
      [dataset]: value
    }));
    
    // If we have an external handler, call it too (for realtime updates)
    if (onThresholdChange) {
      onThresholdChange(dataset, value);
    }
  };

  // Reset thresholds to default values
  const resetThresholds = () => {
    const resetValues = {
      PopDensity: 0,
      Precipitation: 0
    };
    setLocalThresholds(resetValues);
    
    // If we have an external handler, call it too
    if (onThresholdChange) {
      Object.entries(resetValues).forEach(([dataset, value]) => {
        onThresholdChange(dataset, value);
      });
    }
  };

  // Handle filter application
  const handleApply = () => {
    onApplyFilters({
      datasets: selectedDatasets,
      countries: selectedCountries,
      years: selectedYears,
      thresholds: localThresholds
    });
  };

  return (
    <div className="p-4 max-w-md bg-white/10 backdrop-blur-[2px] rounded-lg border-0">
      <h2 className="text-lg font-bold mb-3 text-black">Data Controls</h2>
      
      <div className="mb-4">
        <h3 className="font-medium mb-1 text-black">Datasets</h3>
        <div className="flex flex-wrap gap-2">
          {datasetOptions.map(dataset => (
            <button
              key={dataset}
              onClick={() => toggleDataset(dataset)}
              className={`px-3 py-1 rounded-full text-sm backdrop-blur-sm ${
                selectedDatasets.includes(dataset)
                  ? 'bg-white/40 text-black'
                  : 'bg-white/20 text-black'
              }`}
            >
              {dataset.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
      
      <div className="mb-4">
        <h3 className="font-medium mb-1 text-black">Countries</h3>
        <div className="flex flex-wrap gap-2">
          {countryOptions.map(country => (
            <button
              key={country}
              onClick={() => toggleCountry(country)}
              className={`px-3 py-1 rounded-full text-sm backdrop-blur-sm ${
                selectedCountries.includes(country)
                  ? 'bg-white/40 text-black'
                  : 'bg-white/20 text-black'
              }`}
            >
              {country.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
      
      <div className="mb-4">
        <h3 className="font-medium mb-1 text-black">Years</h3>
        <div className="flex flex-wrap gap-2">
          {yearOptions.map(year => (
            <button
              key={year}
              onClick={() => toggleYear(year)}
              className={`px-3 py-1 rounded-full text-sm backdrop-blur-sm ${
                selectedYears.includes(year)
                  ? 'bg-white/40 text-black'
                  : 'bg-white/20 text-black'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <button
          onClick={() => setShowThresholds(!showThresholds)}
          className="flex items-center text-sm font-medium text-black mb-2"
        >
          <span>{showThresholds ? '▼' : '►'} Advanced Filtering Options</span>
        </button>
        
        {showThresholds && (
          <div className="border-l border-white/20 pl-3 py-2">
            <h3 className="font-medium mb-2 text-sm text-black">Value Thresholds</h3>
            
            <div className="space-y-4">
              {selectedDatasets.includes('PopDensity') && (
                <div>
                  <div className="flex justify-between">
                    <label className="text-xs font-medium text-black">Population Density</label>
                    <span className="text-xs text-black">Min: {localThresholds.PopDensity}</span>
                  </div>
                  <input
                    type="range"
                    min={Math.floor(datasetRanges.PopDensity.min)}
                    max={Math.ceil(datasetRanges.PopDensity.max)}
                    value={localThresholds.PopDensity}
                    onChange={(e) => handleLocalThresholdChange("PopDensity", parseInt(e.target.value))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs mt-1 text-black">
                    <span>{Math.floor(datasetRanges.PopDensity.min)}</span>
                    <span>{Math.ceil(datasetRanges.PopDensity.max)}</span>
                  </div>
                </div>
              )}
              
              {selectedDatasets.includes('Precipitation') && (
                <div>
                  <div className="flex justify-between">
                    <label className="text-xs font-medium text-black">Precipitation</label>
                    <span className="text-xs text-black">Min: {localThresholds.Precipitation}</span>
                  </div>
                  <input
                    type="range"
                    min={Math.floor(datasetRanges.Precipitation.min)}
                    max={Math.ceil(datasetRanges.Precipitation.max)}
                    value={localThresholds.Precipitation}
                    onChange={(e) => handleLocalThresholdChange("Precipitation", parseInt(e.target.value))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs mt-1 text-black">
                    <span>{Math.floor(datasetRanges.Precipitation.min)}</span>
                    <span>{Math.ceil(datasetRanges.Precipitation.max)}</span>
                  </div>
                </div>
              )}
              
              <button
                onClick={resetThresholds}
                className="w-full py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded text-xs font-medium text-black transition-colors duration-200"
              >
                Reset All Thresholds
              </button>
            </div>
          </div>
        )}
      </div>
      
      <button
        onClick={handleApply}
        className="w-full py-2 bg-white/30 hover:bg-white/40 text-black rounded-md transition-colors duration-200 backdrop-blur-sm font-medium"
      >
        Apply Filters
      </button>
    </div>
  );
}