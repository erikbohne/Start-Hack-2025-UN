"""
Router functions for the CreateGIF agent workflow.
"""

from typing import Literal
from .state import GraphState

def determine_next_step(state: GraphState) -> Literal["visualization", "data_only", "error"]:
    """
    Determines the next step in the workflow based on the current state.
    
    Args:
        state (GraphState): The current state of the workflow
        
    Returns:
        Literal["visualization", "data_only", "error"]: The next step to take
    """
    # Check if there's an error already
    if state["error"]:
        return "error"
    
    # Check what type of query this is
    if state["query_type"] == "visualization":
        # Make sure we have data to visualize
        if state["data"] is None:
            state["error"] = "No data available to visualize"
            return "error"
        return "visualization"
    
    elif state["query_type"] == "data_only":
        # Make sure we have data
        if state["data"] is None:
            state["error"] = "No data available"
            return "error"
        return "data_only"
    
    else:
        # Unknown query type
        state["error"] = "Unknown query type"
        return "error" 