"""
State definitions for the GeoFiles agent.
"""

from typing import TypedDict, List, Optional, Dict, Any

class GraphState(TypedDict):
    """
    State for the GeoFiles agent workflow.
    """
    # Input query
    query: str
    
    # Extracted parameters
    query_type: str  # 'file_download', 'visualization', 'data_only'
    region: str
    year: Optional[int]
    start_year: Optional[int]
    end_year: Optional[int]
    datasets: List[str]
    
    # Data storage
    data: Optional[Dict[str, Any]]
    
    # Output
    tif_files: List[str]  # List of generated TIF file paths
    mbtiles_files: List[str]  # List of generated MBTiles file paths
    geojson_files: List[str]  # List of generated GeoJSON file paths
    error: str
    messages: List[str]