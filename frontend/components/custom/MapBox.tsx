"use client";

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

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

interface MapBoxProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  geoJsonData?: GeoJSON;
  width?: string;
  height?: string;
}

export default function MapBox() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

 return (
  <div>
    her kommer kartet
  </div>
  );
}