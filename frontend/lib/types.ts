/**
 * Dataset types matching the backend DatasetEnum
 */
export type DatasetType = 'PopDensity' | 'Precipitation' | 'LandCover' | 'EVI' | 'NDVI';

/**
 * Country types matching the backend CountryEnum
 */
export type CountryType = 'Burkina_Faso' | 'Chad' | 'Mali' | 'Mauritania' | 'Niger' | 'Senegal' | 'Sudan';

/**
 * Region types for subregions
 */
export type RegionType = 'Assaba_Hodh_El_Gharbi_Tagant' | 'Sahel_Est_Centre-Est';

/**
 * Mapping of countries to their available regions
 */
export const countryToRegions: Record<CountryType, RegionType[]> = {
  'Burkina_Faso': ['Sahel_Est_Centre-Est'],
  'Mauritania': ['Assaba_Hodh_El_Gharbi_Tagant'],
  'Chad': [],
  'Mali': [],
  'Niger': [],
  'Senegal': [],
  'Sudan': []
};

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
 * Interface for the region data response
 */
export interface RegionDataResponse {
  [year: number]: {
    [dataset: string]: {
      [region: string]: string; // URL to the region GeoJSON file
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