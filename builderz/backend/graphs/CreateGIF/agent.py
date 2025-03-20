"""
CreateGIF Agent
This agent handles the creation of GIF visualizations based on geospatial data.
"""

from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

from langgraph.graph import END, StateGraph

from .utils.state import GraphState
from .utils.nodes import parse_query, fetch_data
from .utils.create_visualization import create_visualization
from .utils.generate_response import generate_response
from .utils.routers import determine_next_step


def create_gif_workflow() -> StateGraph:
    """
    Creates and returns the workflow for the CreateGIF agent.
    
    This workflow handles:
    1. Parsing the query to extract parameters
    2. Fetching the geospatial data
    3. Creating visualizations
    4. Generating a response
    
    Returns:
        StateGraph: The compiled workflow
    """
    # Create the graph
    graph = StateGraph(GraphState)
    
    # Add nodes
    graph.add_node("parse_query", parse_query)
    graph.add_node("fetch_data", fetch_data)
    graph.add_node("create_visualization", create_visualization)
    graph.add_node("generate_response", generate_response)
    
    # Add edges
    graph.add_edge("parse_query", "fetch_data")
    
    # Add conditional edges based on query type
    graph.add_conditional_edges(
        "fetch_data",
        determine_next_step,
        {
            "visualization": "create_visualization",
            "data_only": "generate_response",
            "error": END
        }
    )
    
    graph.add_edge("create_visualization", "generate_response")
    graph.add_edge("generate_response", END)
    
    # Set entry point
    graph.set_entry_point("parse_query")
    
    # Compile the graph
    return graph.compile()


# Create a singleton instance of the workflow
create_gif_agent = create_gif_workflow()


class RequestInput(BaseModel):
    """
    Input model for the agent request.
    """
    query: str = Field(..., description="The natural language query for data visualization")


class AgentResponse(BaseModel):
    """
    Response model for the agent output.
    """
    response: str = Field(..., description="Text response from the agent")
    visualization_path: Optional[str] = Field(None, description="Path to the visualization if created")
    tif_sequence: Optional[Dict[str, Any]] = Field(None, description="Sequence of TIF files with data")
    mbtiles_sequence: Optional[Dict[str, Any]] = Field(None, description="Sequence of MBTiles files with data")
    error: Optional[str] = Field("", description="Error message if any")


def process_visualization_request(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a natural language request to create a GIF visualization.
    
    Args:
        input_data: Dict containing the query or a RequestInput instance
        
    Returns:
        Dict[str, Any]: The result containing the response and any visualization data
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
            "error": "Empty query"
        }
    
    try:
        # Initialize state
        initial_state = GraphState(
            query=query,
            query_type="unknown",
            region="",
            year=None,
            start_year=None,
            end_year=None,
            datasets=[],
            data=None,
            visualization_path="",
            tif_data=None,
            mbtiles_data=None,
            error="",
            messages=[]
        )
        
        # Run the workflow
        result = create_gif_agent.invoke(initial_state)
        
        # Format and return the result
        response = {
            "response": result.get("messages", [])[-1] if result.get("messages") else "",
            "error": result.get("error", "")
        }
        
        # Add visualization path if available (for backward compatibility)
        if result.get("visualization_path"):
            response["visualization_path"] = result.get("visualization_path", "")
        
        # Add TIF sequence if available
        if result.get("tif_sequence"):
            response["tif_sequence"] = result["tif_sequence"]
            
        # Add MBTiles sequence if available
        if result.get("mbtiles_sequence"):
            response["mbtiles_sequence"] = result["mbtiles_sequence"]
            
        return response
    except Exception as e:
        # Handle exceptions gracefully
        import traceback
        error_details = traceback.format_exc()
        
        return {
            "response": f"An error occurred while processing your request: {str(e)}",
            "error": error_details
        }


def process_query(query: str) -> Dict[str, Any]:
    """
    Simplified entry point for processing a query string directly.
    
    Args:
        query (str): The natural language query
        
    Returns:
        Dict[str, Any]: The response containing text and visualization paths
    """
    return process_visualization_request({"query": query})