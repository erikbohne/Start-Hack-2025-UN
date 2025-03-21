import os
import json
import numpy as np
from typing import List, Dict, Any, Optional, Tuple

class DataAnalysisTool:
    """Tools for analyzing geospatial data."""
    
    @staticmethod
    def get_geojson_data(dataset: str, country: str, year: int) -> Optional[Dict[str, Any]]:
        """
        Retrieve GeoJSON data for a specific dataset, country, and year.
        
        Args:
            dataset: Dataset name (PopDensity or Precipitation)
            country: Country name
            year: Year of the data
            
        Returns:
            GeoJSON data as a dictionary, or None if not found
        """
        dataset_path = os.getenv("DATASET_PATH", default="geofiles/")
        
        if dataset == "PopDensity":
            country_codes = {
                "Burkina_Faso": "bfa",
                "Chad": "tcd",
                "Mali": "mli",
                "Mauritania": "mrt",
                "Niger": "ner",
                "Senegal": "sen",
                "Sudan": "sdn"
            }
            
            code = country_codes.get(country)
            if not code:
                return None
                
            filename = f"{code}_pd_{year}_1km_UNadj.geojson"
            file_path = f"{dataset_path}/Africa/PopDensity/{country}/{filename}"
            
        elif dataset == "Precipitation":
            filename = f"Precipitation_{country.replace('_', ' ')}_{year}.geojson"
            file_path = f"{dataset_path}/Africa/Precipitation/{country}/{filename}"
        else:
            return None
            
        try:
            with open(file_path, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return None
    
    @staticmethod
    def extract_data_values(geojson: Dict[str, Any]) -> List[float]:
        """
        Extract numeric values from GeoJSON features.
        
        Args:
            geojson: GeoJSON data as a dictionary
            
        Returns:
            List of numeric values extracted from features
        """
        values = []
        
        if not geojson or "features" not in geojson:
            return values
            
        for feature in geojson["features"]:
            if feature.get("properties") and "DN" in feature["properties"]:
                dn_value = feature["properties"]["DN"]
                if isinstance(dn_value, (int, float)) and dn_value > 0:
                    values.append(float(dn_value))
                    
        return values
        
    @staticmethod
    def extract_data_with_coordinates(geojson: Dict[str, Any]) -> List[Tuple[float, float, float]]:
        """
        Extract numeric values and coordinates from GeoJSON features.
        
        Args:
            geojson: GeoJSON data as a dictionary
            
        Returns:
            List of tuples containing (longitude, latitude, value)
        """
        points = []
        
        if not geojson or "features" not in geojson:
            return points
            
        for feature in geojson["features"]:
            if feature.get("properties") and "DN" in feature["properties"]:
                dn_value = feature["properties"]["DN"]
                if isinstance(dn_value, (int, float)) and dn_value > 0:
                    # Extract coordinates from geometry
                    if feature.get("geometry") and feature["geometry"].get("type") == "Point":
                        coords = feature["geometry"]["coordinates"]
                        points.append((coords[0], coords[1], float(dn_value)))
                    elif feature.get("geometry") and feature["geometry"].get("coordinates"):
                        # For polygon or other geometries, use the centroid of first coordinate set
                        coords = feature["geometry"]["coordinates"]
                        if coords and isinstance(coords[0], list):
                            if isinstance(coords[0][0], list):  # Polygon
                                # Simple centroid calculation for first ring
                                lon_sum = sum(p[0] for p in coords[0])
                                lat_sum = sum(p[1] for p in coords[0])
                                count = len(coords[0])
                                if count > 0:
                                    points.append((lon_sum/count, lat_sum/count, float(dn_value)))
                            else:  # LineString
                                lon_sum = sum(p[0] for p in coords)
                                lat_sum = sum(p[1] for p in coords)
                                count = len(coords)
                                if count > 0:
                                    points.append((lon_sum/count, lat_sum/count, float(dn_value)))
                    
        return points
    
    @staticmethod
    def calculate_center_of_mass(points: List[Tuple[float, float, float]]) -> Tuple[float, float]:
        """
        Calculate the weighted center of mass of geographic data points.
        
        Args:
            points: List of tuples containing (longitude, latitude, value)
            
        Returns:
            Tuple containing (longitude, latitude) of the center of mass
        """
        if not points:
            return (0.0, 0.0)
            
        total_weight = sum(p[2] for p in points)
        if total_weight == 0:
            return (0.0, 0.0)
            
        weighted_lon_sum = sum(p[0] * p[2] for p in points)
        weighted_lat_sum = sum(p[1] * p[2] for p in points)
        
        return (weighted_lon_sum / total_weight, weighted_lat_sum / total_weight)
    
    @staticmethod
    def calculate_statistics(values: List[float], geojson: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Calculate basic statistics for a list of values and optionally geographic center of mass.
        
        Args:
            values: List of numeric values
            geojson: Optional GeoJSON data to calculate center of mass
            
        Returns:
            Dictionary of statistics
        """
        if not values:
            return {
                "count": 0,
                "min": 0,
                "max": 0,
                "mean": 0,
                "median": 0,
                "std_dev": 0,
                "center_of_mass": {"longitude": 0, "latitude": 0}
            }
        
        stats = {
            "count": len(values),
            "min": float(min(values)),
            "max": float(max(values)),
            "mean": float(np.mean(values)),
            "median": float(np.median(values)),
            "std_dev": float(np.std(values)),
        }
        
        # Calculate geographic center of mass if geojson is provided
        if geojson:
            points = DataAnalysisTool.extract_data_with_coordinates(geojson)
            if points:
                center = DataAnalysisTool.calculate_center_of_mass(points)
                stats["center_of_mass"] = {"longitude": float(center[0]), "latitude": float(center[1])}
            else:
                stats["center_of_mass"] = {"longitude": 0, "latitude": 0}
        else:
            stats["center_of_mass"] = {"longitude": 0, "latitude": 0}
            
        return stats
    
    @staticmethod
    def analyze_temporal_trends(
        dataset: str, 
        country: str, 
        years: List[int]
    ) -> Dict[str, Any]:
        """
        Analyze trends over time for a specific dataset and country.
        
        Args:
            dataset: Dataset name
            country: Country name
            years: List of years to analyze
            
        Returns:
            Dictionary with temporal analysis
        """
        yearly_data = {}
        yearly_stats = {}
        center_of_mass_shifts = {}
        
        for year in sorted(years):
            geojson = DataAnalysisTool.get_geojson_data(dataset, country, year)
            if geojson:
                values = DataAnalysisTool.extract_data_values(geojson)
                yearly_data[year] = values
                # Pass geojson to calculate center of mass
                yearly_stats[year] = DataAnalysisTool.calculate_statistics(values, geojson)
                
        # Calculate year-to-year changes
        if len(yearly_stats) > 1:
            changes = {}
            sorted_years = sorted(yearly_stats.keys())
            
            for i in range(1, len(sorted_years)):
                current_year = sorted_years[i]
                prev_year = sorted_years[i-1]
                
                if yearly_stats[current_year]["mean"] > 0 and yearly_stats[prev_year]["mean"] > 0:
                    percent_change = (
                        (yearly_stats[current_year]["mean"] - yearly_stats[prev_year]["mean"]) / 
                        yearly_stats[prev_year]["mean"] * 100
                    )
                    changes[f"{prev_year}-{current_year}"] = round(percent_change, 2)
                    
                # Calculate center of mass shift between years
                if (yearly_stats[current_year]["center_of_mass"]["longitude"] != 0 and 
                    yearly_stats[prev_year]["center_of_mass"]["longitude"] != 0):
                    # Calculate distance between centers of mass
                    prev_coords = (yearly_stats[prev_year]["center_of_mass"]["longitude"], 
                                  yearly_stats[prev_year]["center_of_mass"]["latitude"])
                    curr_coords = (yearly_stats[current_year]["center_of_mass"]["longitude"], 
                                  yearly_stats[current_year]["center_of_mass"]["latitude"])
                    
                    # Simple distance calculation (could be enhanced with haversine for proper geo distance)
                    lon_diff = curr_coords[0] - prev_coords[0]
                    lat_diff = curr_coords[1] - prev_coords[1]
                    
                    # Direction of shift (cardinal directions)
                    direction = ""
                    if lat_diff > 0.001:
                        direction += "North"
                    elif lat_diff < -0.001:
                        direction += "South"
                        
                    if lon_diff > 0.001:
                        direction += "East"
                    elif lon_diff < -0.001:
                        direction += "West"
                        
                    if not direction:
                        direction = "No significant shift"
                    
                    center_of_mass_shifts[f"{prev_year}-{current_year}"] = {
                        "direction": direction,
                        "longitude_shift": round(lon_diff, 6),
                        "latitude_shift": round(lat_diff, 6)
                    }
            
            # Calculate total change over the entire period
            first_year = sorted_years[0]
            last_year = sorted_years[-1]
            if yearly_stats[first_year]["mean"] > 0 and yearly_stats[last_year]["mean"] > 0:
                total_percent_change = (
                    (yearly_stats[last_year]["mean"] - yearly_stats[first_year]["mean"]) / 
                    yearly_stats[first_year]["mean"] * 100
                )
                
                # Calculate annualized rate of change
                years_diff = last_year - first_year
                if years_diff > 0:
                    annualized_change = ((yearly_stats[last_year]["mean"] / yearly_stats[first_year]["mean"]) ** (1 / years_diff) - 1) * 100
                else:
                    annualized_change = 0
                
                return {
                    "yearly_statistics": yearly_stats,
                    "percent_changes": changes,
                    "center_of_mass_shifts": center_of_mass_shifts,
                    "trend_direction": "increasing" if sum(changes.values()) > 0 else "decreasing",
                    "average_yearly_change": round(sum(changes.values()) / len(changes), 2) if changes else 0,
                    "total_change": {
                        "time_period": f"{first_year}-{last_year}",
                        "percent_change": round(total_percent_change, 2),
                        "annualized_rate": round(annualized_change, 2)
                    }
                }
        
        return {"yearly_statistics": yearly_stats}
    
    @staticmethod
    def compare_regions(
        dataset: str,
        countries: List[str],
        year: int
    ) -> Dict[str, Any]:
        """
        Compare data across multiple regions for a specific dataset and year.
        
        Args:
            dataset: Dataset name
            countries: List of country names
            year: Year of the data
            
        Returns:
            Dictionary with regional comparisons
        """
        regional_stats = {}
        centers_of_mass = {}
        
        for country in countries:
            geojson = DataAnalysisTool.get_geojson_data(dataset, country, year)
            if geojson:
                values = DataAnalysisTool.extract_data_values(geojson)
                # Pass geojson to get center of mass calculations
                regional_stats[country] = DataAnalysisTool.calculate_statistics(values, geojson)
                centers_of_mass[country] = regional_stats[country]["center_of_mass"]
                
        # Create rankings
        if regional_stats:
            rankings = {
                "highest_mean": max(regional_stats.items(), key=lambda x: x[1]["mean"])[0],
                "lowest_mean": min(regional_stats.items(), key=lambda x: x[1]["mean"])[0],
                "highest_max": max(regional_stats.items(), key=lambda x: x[1]["max"])[0],
                "most_variable": max(regional_stats.items(), key=lambda x: x[1]["std_dev"])[0],
                "highest_median": max(regional_stats.items(), key=lambda x: x[1]["median"])[0],
                "lowest_median": min(regional_stats.items(), key=lambda x: x[1]["median"])[0]
            }
            
            # Compare centers of mass between countries
            if len(centers_of_mass) > 1:
                # Find northernmost and southernmost centers
                northernmost = max(centers_of_mass.items(), key=lambda x: x[1]["latitude"])[0]
                southernmost = min(centers_of_mass.items(), key=lambda x: x[1]["latitude"])[0]
                
                # Find easternmost and westernmost centers
                easternmost = max(centers_of_mass.items(), key=lambda x: x[1]["longitude"])[0]
                westernmost = min(centers_of_mass.items(), key=lambda x: x[1]["longitude"])[0]
                
                # Add to rankings
                rankings.update({
                    "northernmost_center": northernmost,
                    "southernmost_center": southernmost,
                    "easternmost_center": easternmost,
                    "westernmost_center": westernmost
                })
            
            return {
                "regional_statistics": regional_stats,
                "centers_of_mass": centers_of_mass,
                "rankings": rankings
            }
            
        return {"regional_statistics": regional_stats}
    
    @staticmethod
    def analyze_correlations(
        country: str,
        years: List[int]
    ) -> Dict[str, Any]:
        """
        Analyze correlations between population density and precipitation.
        
        Args:
            country: Country name
            years: List of years to analyze
            
        Returns:
            Dictionary with correlation analysis
        """
        correlations = {}
        
        for year in years:
            pop_geojson = DataAnalysisTool.get_geojson_data("PopDensity", country, year)
            precip_geojson = DataAnalysisTool.get_geojson_data("Precipitation", country, year)
            
            if not pop_geojson or not precip_geojson:
                continue
                
            pop_values = DataAnalysisTool.extract_data_values(pop_geojson)
            precip_values = DataAnalysisTool.extract_data_values(precip_geojson)
            
            # Need equal length arrays for correlation
            min_length = min(len(pop_values), len(precip_values))
            if min_length < 10:  # Need reasonable sample size
                continue
                
            pop_values = pop_values[:min_length]
            precip_values = precip_values[:min_length]
            
            correlation = float(np.corrcoef(pop_values, precip_values)[0, 1])
            correlations[year] = round(correlation, 3)
            
        if correlations:
            avg_correlation = sum(correlations.values()) / len(correlations)
            relationship = "positive" if avg_correlation > 0.1 else "negative" if avg_correlation < -0.1 else "neutral"
            strength = "strong" if abs(avg_correlation) > 0.7 else "moderate" if abs(avg_correlation) > 0.3 else "weak"
            
            return {
                "yearly_correlations": correlations,
                "average_correlation": round(avg_correlation, 3),
                "relationship_type": relationship,
                "correlation_strength": strength
            }
            
        return {"yearly_correlations": correlations}