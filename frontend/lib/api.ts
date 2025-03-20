import { DatasetType, CountryType } from './types';

// Define the backend URL
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

/**
 * Fetches geospatial data from the backend
 */
export async function fetchGeoData({
  datasets,
  countries,
  years,
}: {
  datasets: DatasetType[];
  countries: CountryType[];
  years: number[];
}) {
  try {
    // Build the query parameters
    const params = new URLSearchParams();
    
    // Add each dataset parameter
    datasets.forEach(dataset => {
      params.append('datasets', dataset);
    });
    
    // Add each country parameter
    countries.forEach(country => {
      params.append('countries', country);
    });
    
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
 * Fetches a GeoJSON file from the backend
 */
export async function fetchGeoJSON(url: string) {
  try {
    // Make sure URL is absolute
    const fullUrl = url.startsWith('http') ? url : `${BACKEND_URL}${url}`;
    
    const response = await fetch(fullUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch GeoJSON: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching GeoJSON:', error);
    throw error;
  }
}