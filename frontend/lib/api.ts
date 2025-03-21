import { DatasetType, CountryType, RegionType } from './types';

// Define the backend URL
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

/**
 * Fetches geospatial data from the backend
 */
export async function fetchGeoData({
  datasets,
  countries,
  regions,
  years,
}: {
  datasets: DatasetType[];
  countries: CountryType[];
  regions: RegionType[];
  years: number[];
}) {
  try {
    // Build the query parameters
    const params = new URLSearchParams();
    
    // Add each dataset parameter
    datasets.forEach(dataset => {
      params.append('datasets', dataset);
    });
    
    // If regions are specified, use regions and ignore countries
    if (regions && regions.length > 0) {
      // Add each region parameter
      regions.forEach(region => {
        params.append('regions', region);
      });
    } else {
      // Add each country parameter
      countries.forEach(country => {
        params.append('countries', country);
      });
    }
    
    // Add each year parameter
    years.forEach(year => {
      params.append('years', year.toString());
    });
    
    // Make the API call
    const response = await fetch(`${BACKEND_URL}/lookup?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching geospatial data:', error);
    throw error;
  }
}

/**
 * Exports currently viewed data as JSON
 */
export async function exportDataAsJSON({
  datasets,
  countries,
  regions,
  years,
}: {
  datasets: DatasetType[];
  countries: CountryType[];
  regions: RegionType[];
  years: number[];
}) {
  try {
    // First fetch the metadata
    const metaData = await fetchGeoData({ datasets, countries, regions, years });
    
    // Initialize result object
    const exportData: { [year: string]: { [dataset: string]: { [location: string]: any } } } = {};
    
    // Fetch actual GeoJSON data for each combination
    for (const year of Object.keys(metaData)) {
      exportData[year] = {};
      
      for (const dataset of Object.keys(metaData[parseInt(year)])) {
        exportData[year][dataset] = {};
        
        const locations = metaData[parseInt(year)][dataset];
        for (const location of Object.keys(locations)) {
          const url = locations[location];
          const geoJSON = await fetchGeoJSON(url);
          exportData[year][dataset][location] = geoJSON;
        }
      }
    }
    
    // Return the exported data
    return exportData;
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}

/**
 * Fetches a GeoJSON file from the backend
 */
export async function fetchGeoJSON(url: string) {
  try {
    // Make sure URL is absolute
    const fullUrl = url.startsWith('http') ? url : `${BACKEND_URL}${url}`;
    
    console.log(`Fetching GeoJSON from: ${fullUrl}`);
    const response = await fetch(fullUrl);
    
    if (!response.ok) {
      console.error(`Failed to fetch GeoJSON: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch GeoJSON: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`Successfully fetched GeoJSON with ${data.features?.length || 0} features`);
    return data;
  } catch (error) {
    console.error('Error fetching GeoJSON:', error);
    throw error;
  }
}