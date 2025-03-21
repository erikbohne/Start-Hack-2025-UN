import os
import json
import numpy as np
from typing import List, Dict, Any, Optional


class DataAnalysisTool:
    """Tools for analyzing geospatial data."""

    @staticmethod
    def get_geojson_data(
        dataset: str, country: str, year: int
    ) -> Optional[Dict[str, Any]]:
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
                "Sudan": "sdn",
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
            with open(file_path, "r") as f:
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
    def calculate_statistics(values: List[float]) -> Dict[str, float]:
        """
        Calculate basic statistics for a list of values.

        Args:
            values: List of numeric values

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
            }

        return {
            "count": len(values),
            "min": float(min(values)),
            "max": float(max(values)),
            "mean": float(np.mean(values)),
            "median": float(np.median(values)),
            "std_dev": float(np.std(values)),
        }

    @staticmethod
    def analyze_temporal_trends(
        dataset: str, country: str, years: List[int]
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

        for year in sorted(years):
            geojson = DataAnalysisTool.get_geojson_data(dataset, country, year)
            if geojson:
                values = DataAnalysisTool.extract_data_values(geojson)
                yearly_data[year] = values
                yearly_stats[year] = DataAnalysisTool.calculate_statistics(values)

        # Calculate year-to-year changes
        if len(yearly_stats) > 1:
            changes = {}
            sorted_years = sorted(yearly_stats.keys())

            for i in range(1, len(sorted_years)):
                current_year = sorted_years[i]
                prev_year = sorted_years[i - 1]

                if (
                    yearly_stats[current_year]["mean"] > 0
                    and yearly_stats[prev_year]["mean"] > 0
                ):
                    percent_change = (
                        (
                            yearly_stats[current_year]["mean"]
                            - yearly_stats[prev_year]["mean"]
                        )
                        / yearly_stats[prev_year]["mean"]
                        * 100
                    )
                    changes[f"{prev_year}-{current_year}"] = round(percent_change, 2)

            return {
                "yearly_statistics": yearly_stats,
                "percent_changes": changes,
                "trend_direction": "increasing"
                if sum(changes.values()) > 0
                else "decreasing",
                "average_yearly_change": round(sum(changes.values()) / len(changes), 2)
                if changes
                else 0,
            }

        return {"yearly_statistics": yearly_stats}

    @staticmethod
    def compare_regions(
        dataset: str, countries: List[str], year: int
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

        for country in countries:
            geojson = DataAnalysisTool.get_geojson_data(dataset, country, year)
            if geojson:
                values = DataAnalysisTool.extract_data_values(geojson)
                regional_stats[country] = DataAnalysisTool.calculate_statistics(values)

        # Create rankings
        if regional_stats:
            rankings = {
                "highest_mean": max(regional_stats.items(), key=lambda x: x[1]["mean"])[
                    0
                ],
                "lowest_mean": min(regional_stats.items(), key=lambda x: x[1]["mean"])[
                    0
                ],
                "highest_max": max(regional_stats.items(), key=lambda x: x[1]["max"])[
                    0
                ],
                "most_variable": max(
                    regional_stats.items(), key=lambda x: x[1]["std_dev"]
                )[0],
            }

            return {"regional_statistics": regional_stats, "rankings": rankings}

        return {"regional_statistics": regional_stats}

    @staticmethod
    def analyze_correlations(country: str, years: List[int]) -> Dict[str, Any]:
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
            precip_geojson = DataAnalysisTool.get_geojson_data(
                "Precipitation", country, year
            )

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
            relationship = (
                "positive"
                if avg_correlation > 0.1
                else "negative"
                if avg_correlation < -0.1
                else "neutral"
            )
            strength = (
                "strong"
                if abs(avg_correlation) > 0.7
                else "moderate"
                if abs(avg_correlation) > 0.3
                else "weak"
            )

            return {
                "yearly_correlations": correlations,
                "average_correlation": round(avg_correlation, 3),
                "relationship_type": relationship,
                "correlation_strength": strength,
            }

        return {"yearly_correlations": correlations}
