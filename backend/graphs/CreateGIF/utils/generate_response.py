"""
Generate response functions for the CreateGIF agent.
"""

from typing import Dict, Any
from .state import GraphState

def generate_response(state: GraphState) -> Dict[str, Any]:
    """
    Generates a response based on the state.
    
    Args:
        state (GraphState): The current state of the workflow
        
    Returns:
        Dict[str, Any]: Updated state with response
    """
    # Check if there's an error
    if state["error"]:
        return {
            "response": f"Sorry, I encountered an error: {state['error']}",
            "error": state["error"]
        }
    
    # Build response based on messages
    response_text = " ".join(state.get("messages", []))
    
    # Create result
    result = {
        "response": response_text,
    }
    
    # Add visualization path if available
    if "visualization_path" in state and state["visualization_path"]:
        result["visualization_path"] = state["visualization_path"]
    
    # Add TIF sequence if available
    if state.get("tif_data"):
        # Create a TifSequenceResponse
        is_time_series = state.get("start_year") is not None and state.get("end_year") is not None
        
        if is_time_series and state["datasets"]:
            # Get the first dataset name (most likely just one)
            dataset = state["datasets"][0]
            
            # Create the TifSequenceResponse
            result["tif_sequence"] = {
                "tif_data": state["tif_data"],
                "region": state["region"],
                "dataset": dataset,
                "start_year": state["start_year"],
                "end_year": state["end_year"],
                "metadata": {
                    "dataset_count": len(state["datasets"]),
                    "tif_count": len(state["tif_data"]),
                    "datasets": state["datasets"]
                }
            }
    
    # Add MBTiles sequence if available
    if state.get("mbtiles_data"):
        # Create a MBTilesSequenceResponse
        is_time_series = state.get("start_year") is not None and state.get("end_year") is not None
        
        if is_time_series and state["datasets"]:
            # Get the first dataset name (most likely just one)
            dataset = state["datasets"][0]
            
            # Create the MBTilesSequenceResponse
            result["mbtiles_sequence"] = {
                "mbtiles_data": state["mbtiles_data"],
                "region": state["region"],
                "dataset": dataset,
                "start_year": state["start_year"],
                "end_year": state["end_year"],
                "metadata": {
                    "dataset_count": len(state["datasets"]),
                    "mbtiles_count": len(state["mbtiles_data"]),
                    "datasets": state["datasets"]
                }
            }
    # Add MBTiles errors if available (instead of empty sequence)
    elif state.get("mbtiles_errors"):
        result["mbtiles_sequence"] = {
            "errors": state["mbtiles_errors"],
            "region": state["region"],
            "dataset": state["datasets"][0] if state["datasets"] else "",
            "metadata": {
                "error_count": len(state["mbtiles_errors"]),
                "datasets": state["datasets"]
            }
        }
    
    return result 