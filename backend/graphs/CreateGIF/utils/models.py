"""
Pydantic models for the CreateGIF agent.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class DatasetParameters(BaseModel):
    """Parameters for a specific dataset."""
    
    dataset_name: str = Field(
        description="Name of the dataset to visualize (e.g., 'Climate_Precipitation_Data', 'Modis_Land_Cover_Data')"
    )
    
    visualization_type: str = Field(
        default="map",
        description="Type of visualization to create (e.g., 'map', 'time_series')"
    )
    
    color_scheme: Optional[str] = Field(
        default="viridis", 
        description="Color scheme to use for the visualization"
    )


class QueryParameters(BaseModel):
    """Parameters extracted from the user query."""
    
    query_type: str = Field(
        default="visualization",
        description="Type of query: 'visualization' (wants to visualize data), 'data_only' (just wants the data)"
    )
    
    region: str = Field(
        default="assaba",
        description="Geographic region of interest (e.g., 'assaba')"
    )
    
    year: Optional[int] = Field(
        default=None,
        description="Specific year for single-point-in-time data"
    )
    
    start_year: Optional[int] = Field(
        default=None,
        description="Start year for time series data"
    )
    
    end_year: Optional[int] = Field(
        default=None,
        description="End year for time series data"
    )
    
    datasets: List[DatasetParameters] = Field(
        default_factory=list,
        description="List of datasets to query and parameters for each"
    )
    
    time_series: bool = Field(
        default=False,
        description="Whether this is a time series visualization (showing change over time)"
    )
    
    @classmethod
    def from_query(cls, query: str) -> "QueryParameters":
        """
        Alternative constructor from a raw query string.
        Used for simple parsing without LLM.
        
        Args:
            query (str): Raw query string
            
        Returns:
            QueryParameters: Instance with basic fields populated
        """
        # Default to visualization query type
        query_type = "visualization"
        if "data only" in query.lower() or "just the data" in query.lower():
            query_type = "data_only"
            
        # Default region is assaba
        region = "assaba"
            
        # Extract years
        import re
        
        # Check for year range (e.g., "2020 to 2022", "2020-2022")
        range_pattern = r'(?:from\s+)?(\d{4})(?:\s*(?:to|-)\s*)(\d{4})'
        range_match = re.search(range_pattern, query)
        
        year = None
        start_year = None
        end_year = None
        time_series = False
        
        if range_match:
            start_year = int(range_match.group(1))
            end_year = int(range_match.group(2))
            time_series = True
        else:
            # Check for single year
            year_pattern = r'\b(20\d{2})\b'
            year_matches = re.findall(year_pattern, query)
            if year_matches:
                year = int(year_matches[0])
                
        # Determine datasets based on keywords
        datasets = []
        
        # Rainfall/precipitation data
        if any(term in query.lower() for term in ["rain", "rainfall", "precipitation"]):
            datasets.append(DatasetParameters(
                dataset_name="Climate_Precipitation_Data",
                visualization_type="map" if not time_series else "time_series"
            ))
            
        # Population data
        if any(term in query.lower() for term in ["population", "people", "density"]):
            datasets.append(DatasetParameters(
                dataset_name="Gridded_Population_Density_Data",
                visualization_type="map" if not time_series else "time_series"
            ))
            
        # Vegetation data
        if any(term in query.lower() for term in ["vegetation", "plant", "green", "growth", "production", "gpp"]):
            datasets.append(DatasetParameters(
                dataset_name="MODIS_Gross_Primary_Production_GPP",
                visualization_type="map" if not time_series else "time_series"
            ))
            
        # Land cover data
        if any(term in query.lower() for term in ["land", "cover", "land cover", "land use", "landscape"]):
            datasets.append(DatasetParameters(
                dataset_name="Modis_Land_Cover_Data",
                visualization_type="map" if not time_series else "time_series"
            ))
            
        # If no datasets detected, default to precipitation
        if not datasets:
            datasets.append(DatasetParameters(
                dataset_name="Climate_Precipitation_Data",
                visualization_type="map" if not time_series else "time_series"
            ))
            
        return cls(
            query_type=query_type,
            region=region,
            year=year,
            start_year=start_year,
            end_year=end_year,
            datasets=datasets,
            time_series=time_series
        )


class VisualizationResult(BaseModel):
    """Result of creating a visualization."""
    
    path: str = Field(
        description="Path to the visualization file"
    )
    
    type: str = Field(
        description="Type of visualization (e.g., 'image', 'gif', 'html')"
    )
    
    datasets: List[str] = Field(
        description="List of datasets used in the visualization"
    )
    
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata about the visualization"
    )