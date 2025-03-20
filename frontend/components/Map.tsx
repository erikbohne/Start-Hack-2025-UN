'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function Map() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [is3DMode, setIs3DMode] = useState<boolean>(false); // Toggle for 2D/3D mode
  const [dataControlsExpanded, setDataControlsExpanded] =
    useState<boolean>(true); // Control panel expansion state

  // Animation state
  const [animating, setAnimating] = useState<boolean>(false);
  const [displayYear, setDisplayYear] = useState<number | null>(null);
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationSpeed = useRef<number>(2000); // 2 seconds per year by default

  // Data management
  const cachedGeojsonData = useRef<{ [key: string]: any }>({});
  const yearSequence = useRef<number[]>([]);
  const currentYearIndexRef = useRef<number>(0);
  const datasetCountryCombo = useRef<{ dataset: string; country: string }[]>(
    []
  );
  const activeLayers = useRef<string[]>([]);
  const mapIsReady = useRef<boolean>(false);

  // Data filters
  const [thresholdValues, setThresholdValues] = useState<{
    [dataset: string]: number;
  }>({
    PopDensity: 0,
    Precipitation: 0,
  });

  // Range information for datasets
  const datasetRanges = useRef<{
    [dataset: string]: { min: number; max: number };
  }>({
    PopDensity: { min: 0, max: 100 },
    Precipitation: { min: 0, max: 1000 },
  });

  // Handle toggling between 2D and 3D mode
  const toggle3DMode = useCallback(() => {
    setIs3DMode((prev) => !prev);

    // Need to recreate the map when changing projections
    if (map.current) {
      // Store current state
      const center = map.current.getCenter();
      const zoom = map.current.getZoom();

      // Remove existing map
      map.current.remove();
      map.current = null;

      // Will be recreated on next render with new projection
      setTimeout(() => {
        if (!mapContainer.current) return;

        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: "mapbox://styles/adis123/cm2trla51000q01qw78sv431j",
          projection: !is3DMode ? "globe" : "mercator", // Toggle to opposite of current state
          zoom: zoom,
          center: center,
          attributionControl: true,
          maxZoom: 10,
          renderWorldCopies: false,
        }); 

        const mapInstance = map.current;

        mapInstance.on("load", () => {
          console.log("Map recreated successfully");
          // Add fog if switching to 3D mode
          if (!is3DMode) {
            // Using !is3DMode because state hasn't updated yet
            mapInstance.setFog({});
          }
          mapIsReady.current = true;

          // Reload current layers if any
          if (
            yearSequence.current.length > 0 &&
            datasetCountryCombo.current.length > 0
          ) {
            // Use existing filter settings
            loadGeoData(
              datasetCountryCombo.current
                .map((item) => item.dataset)
                .filter((v, i, a) => a.indexOf(v) === i) as DatasetType[],
              datasetCountryCombo.current
                .map((item) => item.country)
                .filter((v, i, a) => a.indexOf(v) === i) as CountryType[],
              yearSequence.current
            );
          }
        });

        mapInstance.addControl(new mapboxgl.NavigationControl());
        mapInstance.scrollZoom.enable();
      }, 100);
    }
  }, [is3DMode]);

  // Initialize the map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    mapboxgl.accessToken = 'pk.eyJ1IjoiYWRpczEyMyIsImEiOiJjbTJxZjFtcTYwbXZyMmtyMWxlcWRqYnFhIn0.-SswCiDuWIyLZzoFFw-omQ';
    
    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/satellite-v9', // Using a default style first to test
        projection: 'globe',
        zoom: 1,
        center: [30, 15],
        attributionControl: true,
      });

      const mapInstance = map.current;

      mapInstance.on('error', (e) => {
        console.error('Mapbox error:', e);
      });

      mapInstance.on('load', () => {
        console.log('Map loaded successfully');
      });

      mapInstance.addControl(new mapboxgl.NavigationControl());
      mapInstance.scrollZoom.disable();

      mapInstance.on('style.load', () => {
        mapInstance.setFog({});
      });

      // Globe spinning configuration
      const secondsPerRevolution = 240;
      const maxSpinZoom = 5;
      const slowSpinZoom = 3;

      function spinGlobe() {
        if (!mapInstance) return;
        
        const zoom = mapInstance.getZoom();
        if (spinEnabled.current && !userInteracting.current && zoom < maxSpinZoom) {
          let distancePerSecond = 360 / secondsPerRevolution;
          if (zoom > slowSpinZoom) {
            const zoomDif = (maxSpinZoom - zoom) / (maxSpinZoom - slowSpinZoom);
            distancePerSecond *= zoomDif;
          }
          const center = mapInstance.getCenter();
          center.lng -= distancePerSecond;
          mapInstance.easeTo({ center, duration: 1000, easing: (n) => n });
        }
      }

      mapInstance.on('mousedown', () => {
        userInteracting.current = true;
      });

      mapInstance.on('dragstart', () => {
        userInteracting.current = true;
      });

      mapInstance.on('moveend', () => {
        userInteracting.current = false;
        spinGlobe();
      });

      spinGlobe();
    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  return (
    <div className="relative w-full h-screen" style={{ minHeight: '100vh' }}>
      <div 
        ref={mapContainer} 
        className="absolute inset-0"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
} 