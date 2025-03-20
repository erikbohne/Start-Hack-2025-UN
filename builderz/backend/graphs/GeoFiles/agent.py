"""
GeoFiles Agent
This agent handles the creation of geospatial files in different formats (TIF, MBTiles).
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from langgraph.graph import END, StateGraph
from langchain_groq import ChatGroq
import os

from .utils.state import GraphState
from .utils.nodes import parse_query, generate_files, generate_response
from .utils.routers import determine_next_step


def create_geofiles_workflow() -> StateGraph:
    """
    Creates and returns the workflow for the GeoFiles agent.
    
    This workflow handles:
    1. Parsing the query to extract parameters
    2. Generating geospatial files in various formats
    3. Generating a response
    
    Returns:
        StateGraph: The compiled workflow
    """
    # Create the graph
    graph = StateGraph(GraphState)
    
    # Add nodes
    graph.add_node("parse_query", parse_query)
    graph.add_node("generate_files", generate_files)
    graph.add_node("generate_response", generate_response)
    
    # Add edges
    graph.add_conditional_edges(
        "parse_query",
        determine_next_step,
        {
            "process": "generate_files",
            "error": "generate_response"
        }
    )
    
    graph.add_edge("generate_files", "generate_response")
    graph.add_edge("generate_response", END)
    
    # Set entry point
    graph.set_entry_point("parse_query")
    
    # Compile the graph
    return graph.compile()


# Create a singleton instance of the workflow
geofiles_agent = create_geofiles_workflow()


class RequestInput(BaseModel):
    """
    Input model for the agent request.
    """
    query: str = Field(..., description="The natural language query for geospatial files")


class GeoFileResult(BaseModel):
    """
    Result for an individual geospatial file.
    """
    file_path: str
    format: str
    dataset: str
    year: Optional[int] = None
    region: str


class AgentResponse(BaseModel):
    """
    Response model for the agent output.
    """
    response: str = Field(..., description="Text response from the agent")
    tif_files: List[str] = Field(default_factory=list, description="List of TIF file paths")
    mbtiles_files: List[str] = Field(default_factory=list, description="List of MBTiles file paths")
    geojson_files: List[str] = Field(default_factory=list, description="List of GeoJSON file paths")
    error: str = Field("", description="Error message if any")


def process_geofiles_request(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a natural language request to create geospatial files.
    
    Args:
        input_data: Dict containing the query or a RequestInput instance
        
    Returns:
        Dict[str, Any]: The result containing the response and file paths
    """
    # Handle different input types
    if isinstance(input_data, dict):
        query = input_data.get("query", "")
    elif isinstance(input_data, str):
        query = input_data
    else:
        query = str(input_data)
    
    # Validate input
    if not query:
        return {
            "response": "No query provided. Please provide a natural language query.",
            "tif_files": [],
            "mbtiles_files": [],
            "geojson_files": [],
            "error": "Empty query"
        }
    
    try:
        # Initialize state
        initial_state = GraphState(
            query=query,
            query_type="file_download",
            region="",
            year=None,
            start_year=None,
            end_year=None,
            datasets=[],
            data=None,
            tif_files=[],
            mbtiles_files=[],
            geojson_files=[],
            error="",
            messages=[]
        )
        
        # Run the workflow
        result = geofiles_agent.invoke(initial_state)
        
        # Format and return the result
        return {
            "response": result.get("messages", [])[-1] if result.get("messages") else "",
            "tif_files": result.get("tif_files", []),
            "mbtiles_files": result.get("mbtiles_files", []),
            "geojson_files": result.get("geojson_files", []),
            "error": result.get("error", "")
        }
    except Exception as e:
        # Handle exceptions gracefully
        import traceback
        error_details = traceback.format_exc()
        
        return {
            "response": f"An error occurred while processing your request: {str(e)}",
            "tif_files": [],
            "mbtiles_files": [],
            "geojson_files": [],
            "error": error_details
        }


def process_query(query: str) -> Dict[str, Any]:
    """
    Simplified entry point for processing a query string directly.
    
    Args:
        query (str): The natural language query
        
    Returns:
        Dict[str, Any]: The response containing text and file paths
    """
    return process_geofiles_request({"query": query})