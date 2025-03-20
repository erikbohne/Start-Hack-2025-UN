"""
Router functions for the GeoFiles agent workflow.
"""

from typing import Literal
from .state import GraphState

def determine_next_step(state: GraphState) -> Literal["process", "error"]:
    """
    Determines the next step in the workflow based on the current state.
    
    Args:
        state (GraphState): The current state of the workflow
        
    Returns:
        Literal["process", "error"]: The next step to take
    """
    # Check if there's an error already
    if state["error"]:
        return "error"
    
    # All valid queries should go to the process step
    return "process"