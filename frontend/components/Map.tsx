'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function Map() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userInteracting = useRef<boolean>(false);
  const spinEnabled = useRef<boolean>(true);

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