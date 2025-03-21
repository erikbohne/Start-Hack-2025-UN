"use client";

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import mapboxgl from "mapbox-gl";
import { DatasetType, CountryType } from "@/lib/types";

// Define the context shape
interface MapContextType {
  // Map references
  mapContainer: React.RefObject<HTMLDivElement>;
  map: React.RefObject<mapboxgl.Map | null>;
  mapIsReady: React.RefObject<boolean>;
  
  // State
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  is3DMode: boolean;
  setIs3DMode: React.Dispatch<React.SetStateAction<boolean>>;
  dataControlsExpanded: boolean;
  setDataControlsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Animation state
  animating: boolean;
  setAnimating: React.Dispatch<React.SetStateAction<boolean>>;
  displayYear: number | null;
  setDisplayYear: React.Dispatch<React.SetStateAction<number | null>>;
  animationTimerRef: React.RefObject<NodeJS.Timeout | null>;
  animationSpeed: React.RefObject<number>;
  
  // Data references
  cachedGeojsonData: React.RefObject<{ [key: string]: any }>;
  yearSequence: React.RefObject<number[]>;
  currentYearIndexRef: React.RefObject<number>;
  datasetCountryCombo: React.RefObject<{ dataset: string; country: string }[]>;
  activeLayers: React.RefObject<string[]>;
  
  // Thresholds and ranges
  thresholdValues: { [dataset: string]: number };
  setThresholdValues: React.Dispatch<React.SetStateAction<{ [dataset: string]: number }>>;
  datasetRanges: React.RefObject<{ [dataset: string]: { min: number; max: number } }>;
  
  // Functions
  toggle3DMode: () => void;
  applyThresholdFilter: () => void;
  updateVisibleYear: (yearToShow: number) => void;
  animateStep: () => void;
  toggleAnimation: () => void;
  changeAnimationSpeed: (speedMs: number) => void;
  handleThresholdChange: (dataset: string, value: number) => void;
  loadGeoData: (datasets: DatasetType[], countries: CountryType[], years: number[]) => Promise<void>;
  handleApplyFilters: (filters: {
    datasets: DatasetType[];
    countries: CountryType[];
    years: number[];
    thresholds?: { [dataset: string]: number };
  }) => void;
  handleYearSelection: (index: number) => void;
}

// Create the context with a default undefined value
const MapContext = createContext<MapContextType | undefined>(undefined);

// Provider component
export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // We'll initialize with the same values as in the Map component
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [is3DMode, setIs3DMode] = useState<boolean>(false);
  const [dataControlsExpanded, setDataControlsExpanded] = useState<boolean>(false);

  // Animation state
  const [animating, setAnimating] = useState<boolean>(false);
  const [displayYear, setDisplayYear] = useState<number | null>(null);
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationSpeed = useRef<number>(2000);

  // Data management
  const cachedGeojsonData = useRef<{ [key: string]: any }>({});
  const yearSequence = useRef<number[]>([]);
  const currentYearIndexRef = useRef<number>(0);
  const datasetCountryCombo = useRef<{ dataset: string; country: string }[]>([]);
  const activeLayers = useRef<string[]>([]);
  const mapIsReady = useRef<boolean>(false);

  // Data filters
  const [thresholdValues, setThresholdValues] = useState<{
    [dataset: string]: number;
  }>({
    PopDensity: 1,
    Precipitation: 1,
  });

  // Range information for datasets
  const datasetRanges = useRef<{
    [dataset: string]: { min: number; max: number };
  }>({
    PopDensity: { min: 0, max: 100 },
    Precipitation: { min: 0, max: 1000 },
  });

  // These functions will be overridden by the Map component when it connects to context
  const toggle3DMode = useCallback(() => {
    setIs3DMode(prev => !prev);
  }, []);

  const applyThresholdFilter = useCallback(() => {
    // Implemented by Map component
    console.log("applyThresholdFilter called - stub implementation");
  }, [displayYear, thresholdValues]);

  const updateVisibleYear = useCallback((yearToShow: number) => {
    setDisplayYear(yearToShow);
  }, []);

  const animateStep = useCallback(() => {
    // Implemented by Map component
    console.log("animateStep called - stub implementation");
  }, [animating]);

  const toggleAnimation = useCallback(() => {
    setAnimating(prev => !prev);
  }, []);

  const changeAnimationSpeed = useCallback((speedMs: number) => {
    animationSpeed.current = speedMs;
  }, []);

  const handleThresholdChange = useCallback((dataset: string, value: number) => {
    setThresholdValues(prev => ({
      ...prev,
      [dataset]: value,
    }));
  }, []);

  const loadGeoData = async (
    datasets: DatasetType[],
    countries: CountryType[],
    years: number[]
  ) => {
    // Stub implementation that will be overridden by Map component
    console.log("loadGeoData called with:", {datasets, countries, years});
    console.log("This function will be implemented by the Map component");
    
    // Set some basic state to show it was called
    yearSequence.current = years;
    currentYearIndexRef.current = 0;
    
    datasetCountryCombo.current = [];
    datasets.forEach(dataset => {
      countries.forEach(country => {
        datasetCountryCombo.current.push({
          dataset,
          country
        });
      });
    });
    
    if (years.length > 0) {
      setDisplayYear(years[0]);
    }
  };

  const handleApplyFilters = (filters: {
    datasets: DatasetType[];
    countries: CountryType[];
    years: number[];
    thresholds?: { [dataset: string]: number };
  }) => {
    if (filters.thresholds) {
      setThresholdValues(filters.thresholds);
    }
    loadGeoData(filters.datasets, filters.countries, filters.years);
  };

  const handleYearSelection = (index: number) => {
    currentYearIndexRef.current = index;
    updateVisibleYear(yearSequence.current[index]);
  };

  // Context value
  const value: MapContextType = {
    mapContainer,
    map,
    mapIsReady,
    isLoading,
    setIsLoading,
    error,
    setError,
    is3DMode,
    setIs3DMode,
    dataControlsExpanded,
    setDataControlsExpanded,
    animating,
    setAnimating,
    displayYear,
    setDisplayYear,
    animationTimerRef,
    animationSpeed,
    cachedGeojsonData,
    yearSequence,
    currentYearIndexRef,
    datasetCountryCombo,
    activeLayers,
    thresholdValues,
    setThresholdValues,
    datasetRanges,
    toggle3DMode,
    applyThresholdFilter,
    updateVisibleYear,
    animateStep,
    toggleAnimation,
    changeAnimationSpeed,
    handleThresholdChange,
    loadGeoData,
    handleApplyFilters,
    handleYearSelection,
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};

// Custom hook for using the context
export const useMapContext = () => {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
};