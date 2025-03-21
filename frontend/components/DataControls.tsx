'use client';

import { useState, useEffect } from 'react';
import { DatasetType, CountryType, RegionType } from '@/lib/types';
import { exportDataAsJSON } from '@/lib/api';
import { downloadAsFile } from '@/lib/utils';

interface DataControlsProps {
  onApplyFilters: (filters: {
    datasets: DatasetType[];
    countries: CountryType[];
    regions: RegionType[];
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

interface ExtendedDataControlsProps extends DataControlsProps {
  activeDatasets?: DatasetType[];
  activeCountries?: CountryType[];
  activeRegions?: RegionType[];
  activeYears?: number[];
}

export default function DataControls({ 
  onApplyFilters, 
  datasetRanges = {
    PopDensity: { min: 0, max: 100 },
    Precipitation: { min: 0, max: 1000 },
    EVI: { min: 0, max: 1 },
    NDVI: { min: 0, max: 1 }
  },
  thresholdValues = {
    PopDensity: 1,
    Precipitation: 1,
    EVI: 0.1,
    NDVI: 0.1
  },
  onThresholdChange,
  activeDatasets,
  activeCountries,
  activeRegions,
  activeYears
}: ExtendedDataControlsProps) {
  const [selectedDatasets, setSelectedDatasets] = useState<DatasetType[]>(['PopDensity']);
  const [selectedCountries, setSelectedCountries] = useState<CountryType[]>(['Mali']);
  const [selectedRegions, setSelectedRegions] = useState<RegionType[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([2015]);
  
  const [showThresholds, setShowThresholds] = useState<boolean>(false);
  const [localThresholds, setLocalThresholds] = useState<{
    [dataset: string]: number;
  }>(thresholdValues);
  const [viewMode, setViewMode] = useState<'countries' | 'regions'>('countries');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Reset selections when switching view modes
  useEffect(() => {
    if (viewMode === 'countries') {
      setSelectedRegions([]);
      if (selectedCountries.length === 0) {
        setSelectedCountries(['Mali']); // Default country
      }
    } else {
      setSelectedCountries([]);
      if (selectedRegions.length === 0) {
        // Select the first available region if none is selected
        const allRegions: RegionType[] = ['Assaba_Hodh_El_Gharbi_Tagant', 'Sahel_Est_Centre-Est'];
        setSelectedRegions([allRegions[0]]);
      }
    }
  }, [viewMode]);
  
  // Update local state when external selections change
  useEffect(() => {
    if (activeDatasets && activeDatasets.length > 0) {
      setSelectedDatasets(activeDatasets);
    }
  }, [activeDatasets]);
  
  useEffect(() => {
    if (activeCountries && activeCountries.length > 0) {
      setSelectedCountries(activeCountries);
      
      // If countries are selected, ensure we're in countries mode
      // But only on initial data load, not when user is manually switching tabs
      if (viewMode !== 'countries' && !activeRegions?.length) {
        setViewMode('countries');
        setSelectedRegions([]);
      }
    }
  }, [activeCountries]);
  
  // Handle external region selections
  useEffect(() => {
    if (activeRegions && activeRegions.length > 0) {
      setSelectedRegions(activeRegions);
      
      // If regions are selected, ensure we're in regions mode
      // But only on initial data load, not when user is manually switching tabs
      if (viewMode !== 'regions' && !activeCountries?.length) {
        setViewMode('regions');
        setSelectedCountries([]);
      }
    }
  }, [activeRegions]);
  
  useEffect(() => {
    if (activeYears && activeYears.length > 0) {
      setSelectedYears(activeYears);
    }
  }, [activeYears]);
  
  // Update local thresholds when external thresholds change
  useEffect(() => {
    setLocalThresholds(thresholdValues);
  }, [thresholdValues]);

  // Dataset options from backend DatasetEnum
  const datasetOptions: DatasetType[] = ['PopDensity', 'Precipitation', 'LandCover', 'EVI', 'NDVI'];
  
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
    // If we're selecting a country, make sure we're in countries mode
    // and clear any selected regions
    if (viewMode !== 'countries') {
      setViewMode('countries');
      setSelectedRegions([]);
    }
    
    setSelectedCountries(prev => 
      prev.includes(country)
        ? prev.filter(c => c !== country)
        : [...prev, country]
    );
  };

  // Handle toggling a region selection
  const toggleRegion = (region: RegionType) => {
    // If we're selecting a region, make sure we're in regions mode
    // and clear any selected countries
    if (viewMode !== 'regions') {
      setViewMode('regions');
      setSelectedCountries([]);
    }
    
    setSelectedRegions(prev => 
      prev.includes(region)
        ? prev.filter(r => r !== region)
        : [...prev, region]
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
      PopDensity: 1,
      Precipitation: 1,
      EVI: 0.1,
      NDVI: 0.1
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
      countries: viewMode === 'countries' ? selectedCountries : [],
      regions: viewMode === 'regions' ? selectedRegions : [],
      years: selectedYears,
      thresholds: localThresholds
    });
  };

  // Handle data export
  const handleExportData = async () => {
    if (isExporting) return; // Prevent multiple clicks
    
    try {
      // Show loading state
      setIsExporting(true);
      
      // Export the data
      const exportData = await exportDataAsJSON({
        datasets: selectedDatasets,
        countries: viewMode === 'countries' ? selectedCountries : [],
        regions: viewMode === 'regions' ? selectedRegions : [],
        years: selectedYears,
      });
      
      // Generate filename with current date
      const date = new Date().toISOString().split('T')[0];
      const filename = `geo-data-export-${date}.json`;
      
      // Download the file
      downloadAsFile(exportData, filename);
    } catch (error) {
      console.error('Error exporting data:', error);
      // You could show an error message to the user here
    } finally {
      // Reset loading state
      setIsExporting(false);
    }
  };

  // Define all available regions
  const regionOptions: RegionType[] = ['Assaba_Hodh_El_Gharbi_Tagant', 'Sahel_Est_Centre-Est'];

  return (
    <div className="p-4 max-w-md bg-white rounded-lg shadow-lg">
      <h2 className="text-lg font-bold mb-3 text-gray-800">Data Controls</h2>
      
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-medium text-gray-700">Datasets</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedDatasets(datasetOptions)}
              className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors duration-200"
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedDatasets(['PopDensity'])} // Default to at least one dataset
              className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors duration-200"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {datasetOptions.map(dataset => (
            <button
              key={dataset}
              onClick={() => toggleDataset(dataset)}
              className={`px-3 py-1 rounded-full text-sm ${
                selectedDatasets.includes(dataset)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              } transition-colors duration-200`}
            >
              {dataset.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
      
      {/* View mode toggle */}
      <div className="mb-4">
        <div className="flex items-center justify-center gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => {
              // Explicitly reset regions when switching to countries
              setSelectedRegions([]);
              setViewMode('countries');
            }}
            className={`flex-1 py-2 rounded-md text-sm font-medium ${
              viewMode === 'countries'
                ? 'bg-blue-500 text-white'
                : 'bg-transparent text-gray-700 hover:bg-gray-200'
            } transition-colors duration-200`}
          >
            Countries
          </button>
          <button
            onClick={() => {
              // Explicitly reset countries when switching to regions
              setSelectedCountries([]);
              setViewMode('regions');
            }}
            className={`flex-1 py-2 rounded-md text-sm font-medium ${
              viewMode === 'regions'
                ? 'bg-blue-500 text-white'
                : 'bg-transparent text-gray-700 hover:bg-gray-200'
            } transition-colors duration-200`}
          >
            Regions
          </button>
        </div>
      </div>
      
      {/* Show countries selector when in countries mode */}
      {viewMode === 'countries' && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-medium text-gray-700">Countries</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedCountries(countryOptions)}
                className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors duration-200"
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedCountries(['Mali'])} // Default to at least one country
                className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors duration-200"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {countryOptions.map(country => (
              <button
                key={country}
                onClick={() => toggleCountry(country)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedCountries.includes(country)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } transition-colors duration-200`}
              >
                {country.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Show regions selector when in regions mode */}
      {viewMode === 'regions' && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-medium text-gray-700">Regions</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedRegions(regionOptions)}
                className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors duration-200"
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedRegions(['Assaba_Hodh_El_Gharbi_Tagant'])} // Default to at least one region
                className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors duration-200"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {regionOptions.map(region => (
              <button
                key={region}
                onClick={() => toggleRegion(region)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedRegions.includes(region)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } transition-colors duration-200`}
              >
                {region.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            <p>Mauritania: Assaba Hodh El Gharbi Tagant</p>
            <p>Burkina Faso: Sahel Est Centre-Est</p>
          </div>
        </div>
      )}
      
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-medium text-gray-700">Years</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedYears(yearOptions)}
              className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors duration-200"
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedYears([])}
              className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors duration-200"
            >
              Clear All
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {yearOptions.map(year => (
            <button
              key={year}
              onClick={() => toggleYear(year)}
              className={`px-3 py-1 rounded-full text-sm ${
                selectedYears.includes(year)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              } transition-colors duration-200`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <button
          onClick={() => setShowThresholds(!showThresholds)}
          className="flex items-center text-sm font-medium text-gray-700 mb-2 hover:text-blue-500 transition-colors"
        >
          <span>{showThresholds ? '▼' : '►'} Advanced Filtering Options</span>
        </button>
        
        {showThresholds && (
          <div className="border-l-2 border-blue-200 pl-3 py-2">
            <h3 className="font-medium mb-2 text-sm text-gray-700">Value Thresholds</h3>
            
            <div className="space-y-4">
              {selectedDatasets.includes('PopDensity') && (
                <div>
                  <div className="flex justify-between">
                    <label className="text-xs font-medium text-gray-700">Population Density</label>
                    <span className="text-xs text-gray-600">Min: {localThresholds.PopDensity}</span>
                  </div>
                  <input
                    type="range"
                    min={Math.floor(datasetRanges.PopDensity.min)}
                    max={Math.ceil(datasetRanges.PopDensity.max)}
                    value={localThresholds.PopDensity}
                    onChange={(e) => handleLocalThresholdChange("PopDensity", parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs mt-1 text-gray-600">
                    <span>{Math.floor(datasetRanges.PopDensity.min)}</span>
                    <span>{Math.ceil(datasetRanges.PopDensity.max)}</span>
                  </div>
                </div>
              )}
              
              {selectedDatasets.includes('Precipitation') && (
                <div>
                  <div className="flex justify-between">
                    <label className="text-xs font-medium text-gray-700">Precipitation</label>
                    <span className="text-xs text-gray-600">Min: {localThresholds.Precipitation}</span>
                  </div>
                  <input
                    type="range"
                    min={Math.floor(datasetRanges.Precipitation.min)}
                    max={Math.ceil(datasetRanges.Precipitation.max)}
                    value={localThresholds.Precipitation}
                    onChange={(e) => handleLocalThresholdChange("Precipitation", parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs mt-1 text-gray-600">
                    <span>{Math.floor(datasetRanges.Precipitation.min)}</span>
                    <span>{Math.ceil(datasetRanges.Precipitation.max)}</span>
                  </div>
                </div>
              )}
              
              {selectedDatasets.includes('EVI') && (
                <div>
                  <div className="flex justify-between">
                    <label className="text-xs font-medium text-gray-700">EVI</label>
                    <span className="text-xs text-gray-600">Min: {localThresholds.EVI.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={localThresholds.EVI}
                    onChange={(e) => handleLocalThresholdChange("EVI", parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs mt-1 text-gray-600">
                    <span>0.00</span>
                    <span>1.00</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    <span>Enhanced Vegetation Index (0.0-1.0)</span>
                  </div>
                </div>
              )}
              
              {selectedDatasets.includes('NDVI') && (
                <div>
                  <div className="flex justify-between">
                    <label className="text-xs font-medium text-gray-700">NDVI</label>
                    <span className="text-xs text-gray-600">Min: {localThresholds.NDVI.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={localThresholds.NDVI}
                    onChange={(e) => handleLocalThresholdChange("NDVI", parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs mt-1 text-gray-600">
                    <span>0.00</span>
                    <span>1.00</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    <span>Normalized Difference Vegetation Index (0.0-1.0)</span>
                  </div>
                </div>
              )}
              
              <button
                onClick={resetThresholds}
                className="w-full py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-xs font-medium text-gray-700 transition-colors duration-200"
              >
                Reset All Thresholds
              </button>
            </div>
          </div>
        )}
      </div>
      
      <button
        onClick={handleApply}
        className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors duration-200 font-medium"
      >
        {viewMode === 'countries' 
          ? `Apply Filters (${selectedCountries.length} ${selectedCountries.length === 1 ? 'Country' : 'Countries'})` 
          : `Apply Filters (${selectedRegions.length} ${selectedRegions.length === 1 ? 'Region' : 'Regions'})`}
      </button>
      
      <div className="mt-3">
        <button
          onClick={handleExportData}
          disabled={isExporting}
          className={`w-full py-2 border ${isExporting ? 'bg-gray-100 text-gray-500' : 'border-gray-300 hover:bg-gray-100 text-gray-700'} rounded-md transition-colors duration-200 font-medium flex items-center justify-center`}
        >
          {isExporting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Exporting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Current Data
            </>
          )}
        </button>
      </div>
    </div>
  );
}