'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import MapLegend from './MapLegend';

// Initialize Mapbox with the token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface GeoJsonResponse {
  response: string;
  tif_files: string[];
  mbtiles_files: string[];
  geojson_files: string[];
  error: string;
}

type Coordinate = [number, number];
type Ring = Coordinate[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

interface GeoJSONFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: Polygon | MultiPolygon;
  };
  properties: Record<string, any>;
}

interface GeoJSON {
  type: string;
  features: GeoJSONFeature[];
}

export default function Map() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDataset, setCurrentDataset] = useState<{
    title: string;
    colorScale: Array<{ color: string; label: string }>;
    unit?: string;
  } | null>(null);
  const [responseData, setResponseData] = useState<GeoJsonResponse | null>(null);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  // Function to toggle debug information
  const handleToggleDebug = () => {
    setShowDebug(prev => !prev);
  };

  // Function to fetch GeoJSON data from backend
  const fetchGeoJsonData = async (query: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("Sending query to backend:", query);
      
      // Try to access the backend API directly
      const response = await fetch('http://localhost:8000/graphs/geo-files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        mode: 'cors',
        body: JSON.stringify({
          query: query
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data: GeoJsonResponse = await response.json();
      console.log("Received response:", data);
      
      // Store the response for debugging
      setResponseData(data);
      
      return data;
    } catch (err) {
      console.error('Error fetching GeoJSON:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Function to load GeoJSON data to the map
  const addGeoJsonToMap = async (geojsonUrl: string, layerId: string) => {
    if (!map.current) return;
    
    try {
      console.log(`Fetching GeoJSON from: ${geojsonUrl}`);
      
      // Fetch the GeoJSON data with full URL
      const fullUrl = geojsonUrl.startsWith('http') 
        ? geojsonUrl 
        : `http://localhost:8000${geojsonUrl.startsWith('/') ? '' : '/'}${geojsonUrl}`;
      
      console.log(`Using full URL: ${fullUrl}`);
      
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch GeoJSON: ${response.status} ${response.statusText}`);
      }
      
      const geojsonData = await response.json();
      console.log("GeoJSON data loaded:", geojsonData);
      
      // Check if source already exists and remove it along with its layers
      if (map.current.getSource(layerId)) {
        if (map.current.getLayer(`${layerId}-fill`)) {
          map.current.removeLayer(`${layerId}-fill`);
        }
        if (map.current.getLayer(`${layerId}-line`)) {
          map.current.removeLayer(`${layerId}-line`);
        }
        map.current.removeSource(layerId);
      }
      
      // Transform GeoJSON coordinates if needed
      if (geojsonData.features && geojsonData.features.length > 0) {
        console.log("Processing GeoJSON with features:", geojsonData.features.length);
        
        // Create a deep copy of the GeoJSON to transform
        const transformedGeoJSON = JSON.parse(JSON.stringify(geojsonData));
        
        // Check if transformation is needed by examining sample coordinates
        let needsTransformation = false;
        if (transformedGeoJSON.features[0]?.geometry?.coordinates) {
          const coords = transformedGeoJSON.features[0].geometry.coordinates;
          let sampleCoord;
          
          if (transformedGeoJSON.features[0].geometry.type === 'Polygon') {
            sampleCoord = coords[0][0];
          } else if (transformedGeoJSON.features[0].geometry.type === 'MultiPolygon') {
            sampleCoord = coords[0][0][0];
          }
          
          if (sampleCoord) {
            const [x, y] = sampleCoord;
            if (Math.abs(x) > 180 || Math.abs(y) > 90) {
              needsTransformation = true;
              console.log("Coordinates need transformation:", sampleCoord);
            }
          }
        }
        
        // Only transform if needed
        if (needsTransformation) {
          // Transform all features
          transformedGeoJSON.features.forEach((feature: any) => {
            if (feature.geometry.type === 'Polygon') {
              feature.geometry.coordinates = feature.geometry.coordinates.map((ring: any) => {
                return ring.map(transformSinusoidalToWGS84);
              });
            } else if (feature.geometry.type === 'MultiPolygon') {
              feature.geometry.coordinates = feature.geometry.coordinates.map((polygon: any) => {
                return polygon.map((ring: any) => {
                  return ring.map(transformSinusoidalToWGS84);
                });
              });
            }
          });
        }
        
        // Add the transformed GeoJSON as a source
        map.current.addSource(layerId, {
          type: 'geojson',
          data: transformedGeoJSON
        });
        
        // Add fill layer
        map.current.addLayer({
          id: `${layerId}-fill`,
          type: 'fill',
          source: layerId,
          paint: {
            'fill-color': [
              'interpolate',
              ['linear'],
              ['get', 'value'],
              0, '#edf8e9',
              0.2, '#c7e9c0', 
              0.4, '#a1d99b',
              0.6, '#74c476',
              0.8, '#31a354',
              1, '#006d2c'
            ],
            'fill-opacity': 0.75
          }
        });
        
        // Add outline layer
        map.current.addLayer({
          id: `${layerId}-line`,
          type: 'line',
          source: layerId,
          paint: {
            'line-color': '#000',
            'line-width': 0.5
          }
        });
        
        // Fit map to the geojson bounds
        const bounds = new mapboxgl.LngLatBounds();
        transformedGeoJSON.features.forEach((feature: any) => {
          if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates[0].forEach((coord: [number, number]) => {
              bounds.extend(coord);
            });
          } else if (feature.geometry.type === 'MultiPolygon') {
            feature.geometry.coordinates.forEach((polygon: any) => {
              polygon[0].forEach((coord: [number, number]) => {
                bounds.extend(coord);
              });
            });
          }
        });
        
        // Only fit bounds if we have valid coordinates
        if (!bounds.isEmpty()) {
          map.current.fitBounds(bounds, {
            padding: 20
          });
        }
      }
    } catch (err) {
      console.error('Error adding GeoJSON to map:', err);
      setError(`Failed to load GeoJSON: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Function to handle query submissions from the sidebar
  const handleQuerySubmission = async (query: string) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log("Processing query:", query);
      
      // Clear any existing layers first
      clearExistingLayers();
      
      const data = await fetchGeoJsonData(query);
      if (data && data.geojson_files && data.geojson_files.length > 0) {
        // Generate a layer ID based on the query
        const layerId = `query-${Date.now()}`;
        setActiveLayerId(layerId);
        await addGeoJsonToMap(data.geojson_files[0], layerId);
        
        // Set the legend based on the query content
        const lowerQuery = query.toLowerCase();
        
        if (lowerQuery.includes('rainfall') || lowerQuery.includes('precipitation')) {
          setCurrentDataset({
            title: 'Rainfall Data',
            colorScale: [
              { color: '#0571b0', label: 'Low' },
              { color: '#92c5de', label: 'Medium-Low' },
              { color: '#f7f7f7', label: 'Medium' },
              { color: '#f4a582', label: 'Medium-High' },
              { color: '#ca0020', label: 'High' }
            ],
            unit: 'mm'
          });
        } else if (lowerQuery.includes('population')) {
          setCurrentDataset({
            title: 'Population Density',
            colorScale: [
              { color: '#feedde', label: 'Very Low' },
              { color: '#fdbe85', label: 'Low' },
              { color: '#fd8d3c', label: 'Medium' },
              { color: '#e6550d', label: 'High' },
              { color: '#a63603', label: 'Very High' }
            ],
            unit: 'people/km²'
          });
        } else if (lowerQuery.includes('vegetation') || lowerQuery.includes('productivity')) {
          setCurrentDataset({
            title: 'Vegetation Productivity',
            colorScale: [
              { color: '#edf8fb', label: 'Very Low' },
              { color: '#b2e2e2', label: 'Low' },
              { color: '#66c2a4', label: 'Medium' },
              { color: '#2ca25f', label: 'High' },
              { color: '#006d2c', label: 'Very High' }
            ],
            unit: 'gC/m²/day'
          });
        } else if (lowerQuery.includes('land cover') || lowerQuery.includes('land use')) {
          setCurrentDataset({
            title: 'Land Cover Types',
            colorScale: [
              { color: '#8c510a', label: 'Urban' },
              { color: '#d8b365', label: 'Cropland' },
              { color: '#f6e8c3', label: 'Grassland' },
              { color: '#c7eae5', label: 'Forest' },
              { color: '#5ab4ac', label: 'Wetland' },
              { color: '#01665e', label: 'Water' }
            ]
          });
        } else {
          // Generic dataset legend if type can't be determined
          setCurrentDataset({
            title: 'Dataset Values',
            colorScale: [
              { color: '#0571b0', label: 'Low' },
              { color: '#92c5de', label: 'Medium-Low' },
              { color: '#f7f7f7', label: 'Medium' },
              { color: '#f4a582', label: 'Medium-High' },
              { color: '#ca0020', label: 'High' }
            ]
          });
        }
      } else {
        // If no data is returned, show an error message
        setError("No data found for your query. Please try a different query.");
        setCurrentDataset(null);
      }
    } catch (error) {
      console.error("Error processing query:", error);
      setError("Failed to process query. Please try again.");
      setCurrentDataset(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if the container and mapboxgl token are available
    if (mapContainer.current && mapboxgl.accessToken) {
      if (!map.current) {
        // Create a new map instance
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/light-v11',
          center: [-11.75, 16.75], // Centered on Assaba region, Mauritania
          zoom: 7,
          projection: {
            name: 'mercator' // Using mercator projection for better compatibility
          }
        });
        
        // Add navigation controls
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
        
        // Add scale control
        map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');
        
        // Fit to Mauritania bounds
        map.current.fitBounds([
          [-17.0, 14.5], // Southwest coordinates
          [-5.0, 21.0]   // Northeast coordinates
        ]);
      }
    }
    
    // Add event listener for query submission
    const handleQuerySubmit = (event: CustomEvent) => {
      handleQuerySubmission(event.detail.query);
    };
    
    window.addEventListener('querySubmit', handleQuerySubmit as EventListener);
    window.addEventListener('toggleDebug', handleToggleDebug as EventListener);
    
    // Cleanup event listeners on component unmount
    return () => {
      window.removeEventListener('querySubmit', handleQuerySubmit as EventListener);
      window.removeEventListener('toggleDebug', handleToggleDebug as EventListener);
      
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Transform from sinusoidal to WGS84 coordinates
  const transformSinusoidalToWGS84 = (coord: [number, number]): [number, number] => {
    // Parameters for sinusoidal projection transformation
    const R = 6371000.0; // Earth's radius in meters
    const lonOrigin = -11.75; // Central meridian for Assaba region
    
    const [x, y] = coord;
    
    // If coordinates are already in a reasonable range for WGS84 (longitude/latitude)
    if (Math.abs(x) <= 180 && Math.abs(y) <= 90) {
      return coord;
    }
    
    // Assume values are in sinusoidal projection and convert to radians
    const xRad = x / R;
    const yRad = y / R;
    
    // Convert sinusoidal coordinates back to longitude/latitude
    const lat = yRad * (180 / Math.PI);
    const lon = (xRad / Math.cos(yRad)) * (180 / Math.PI) + lonOrigin;
    
    // Ensure coordinates are within reasonable bounds for the region
    const boundedLon = Math.max(-20, Math.min(0, lon));
    const boundedLat = Math.max(10, Math.min(25, lat));
    
    return [boundedLon, boundedLat];
  };

  // Function to clear existing layers before adding new ones
  const clearExistingLayers = () => {
    if (map.current && activeLayerId) {
      try {
        // Remove existing layers
        if (map.current.getLayer(`${activeLayerId}-fill`)) {
          map.current.removeLayer(`${activeLayerId}-fill`);
        }
        if (map.current.getLayer(`${activeLayerId}-line`)) {
          map.current.removeLayer(`${activeLayerId}-line`);
        }
        // Remove the source
        if (map.current.getSource(activeLayerId)) {
          map.current.removeSource(activeLayerId);
        }
        console.log(`Cleared previous layer: ${activeLayerId}`);
      } catch (err) {
        console.error('Error clearing previous layers:', err);
      }
    }
  };

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      
      {/* Loading indicator */}
      {loading && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-white py-1 px-3 rounded-full shadow-md flex items-center">
          <div className="w-4 h-4 border-2 border-t-transparent border-blue-500 rounded-full animate-spin mr-2"></div>
          <span className="text-sm font-medium">Loading map data...</span>
        </div>
      )}
      
      {/* Error display */}
      {error && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-red-50 border border-red-200 text-red-800 py-1 px-3 rounded-md shadow-md text-sm max-w-xs text-center">
          {error}
        </div>
      )}
      
      {/* Map Legend */}
      {currentDataset && <MapLegend title={currentDataset.title} colorScale={currentDataset.colorScale} unit={currentDataset.unit} />}
      
      {/* Debug Panel */}
      {showDebug && responseData && (
        <div className="absolute top-12 right-2 bg-white p-2 rounded shadow-md w-80 max-h-80 overflow-auto text-xs font-mono">
          <h3 className="font-bold mb-1">Debug Response:</h3>
          <pre>{JSON.stringify(responseData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}