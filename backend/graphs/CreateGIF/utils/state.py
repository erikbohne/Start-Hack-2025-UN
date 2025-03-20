"""
State definitions for the CreateGIF agent.
"""

from typing import TypedDict, List, Optional, Dict, Any


class GraphState(TypedDict):
    """
    State for the CreateGIF agent workflow.
    """
    # Input query
    query: str
    
    # Extracted parameters
    query_type: str  # 'visualization', 'data_only', 'unknown'
    region: str
    year: Optional[int]
    start_year: Optional[int]
    end_year: Optional[int]
    datasets: List[str]
    
    # Data storage
    data: Optional[Dict[str, Any]]
    
    # Output
    visualization_path: str
    tif_data: Optional[List[Dict[str, Any]]]  # List of TIF data objects
    mbtiles_data: Optional[List[Dict[str, Any]]]  # List of MBTiles data objects
    mbtiles_errors: Optional[List[str]]  # Errors from MBTiles conversion
    error: str
    messages: List[str] 