/**
 * Dataset types matching the backend DatasetEnum
 */
export type DatasetType = 'PopDensity' | 'Precipitation';

/**
 * Country types matching the backend CountryEnum
 */
export type CountryType = 'Burkina_Faso' | 'Chad' | 'Mali' | 'Mauritania' | 'Niger' | 'Senegal' | 'Sudan';

/**
 * Interface for the backend lookup response
 */
export interface GeoDataResponse {
  [year: number]: {
    [dataset: string]: {
      [country: string]: string; // URL to the GeoJSON file
    };
  };
}

/**
 * GeoJSON feature properties
 */
export interface GeoJSONProperties {
  DN: number;
  id?: number;
  [key: string]: unknown;
}

/**
 * GeoJSON feature geometry
 */
export interface GeoJSONGeometry {
  type: string;
  coordinates: number[] | number[][] | number[][][] | number[][][][];
}

/**
 * GeoJSON feature
 */
export interface GeoJSONFeature {
  type: 'Feature';
  properties: GeoJSONProperties;
  geometry: GeoJSONGeometry;
}

/**
 * GeoJSON object
 */
export interface GeoJSON {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}