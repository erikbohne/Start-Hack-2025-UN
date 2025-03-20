"""
Visualization creation functions for the CreateGIF agent.
"""

from typing import Dict, Any


from .state import GraphState


def create_visualization(state: GraphState) -> Dict[str, Any]:
    """
    Creates visualizations based on the fetched data.
    
    Args:
        state (GraphState): The current state of the workflow
        
    Returns:
        Dict[str, Any]: Updated state with visualization data
    """
    from .tools import (
        create_time_series_gif, 
        create_time_series_tifs
    )
    
    # Try to import create_time_series_mbtiles, but don't fail if it's not available
    try:
        from .tools import create_time_series_mbtiles
        mbtiles_available = True
    except (ImportError, ModuleNotFoundError, AttributeError):
        mbtiles_available = False
    
    data = state["data"]
    if not data:
        return {
            "messages": state["messages"] + ["I don't have any data to create visualizations with."]
        }
    
    # Check if this is a time series
    is_time_series = (state.get("start_year") is not None and 
                     state.get("end_year") is not None)
    
    if is_time_series:
        # Create time series visualizations
        visualizations = []
        tif_data_list = []
        mbtiles_data_list = []
        mbtiles_errors = []
        
        for dataset, data_series in data.items():
            if data_series:
                try:
                    # Create GIF for visual display (browser compatibility)
                    gif_path = create_time_series_gif(data_series=data_series)
                    if not gif_path.startswith("Error"):
                        visualizations.append(gif_path)
                    
                    # Create sequence of TIF files (in memory)
                    tif_result = create_time_series_tifs(data_series=data_series)
                    if tif_result:
                        tif_data_list.extend(tif_result)
                    
                    # Create sequence of MBTiles files if available
                    if mbtiles_available:
                        try:
                            mbtiles_result = create_time_series_mbtiles(
                                data_series=data_series
                            )
                            if mbtiles_result:
                                mbtiles_data_list.extend(mbtiles_result)
                        except Exception as mbtiles_error:
                            error_msg = f"Error creating MBTiles: {str(mbtiles_error)}"
                            mbtiles_errors.append(error_msg)
                            print(error_msg)
                except Exception as e:
                    print(f"Error creating visualization for {dataset}: {str(e)}")
        
        # Prepare update state
        updated_state = {}
        
        # Store data in state
        if tif_data_list:
            updated_state["tif_data"] = tif_data_list
        
        if mbtiles_data_list:
            updated_state["mbtiles_data"] = mbtiles_data_list
        
        # Always include mbtiles_errors if there are any
        if mbtiles_errors:
            updated_state["mbtiles_errors"] = mbtiles_errors
        elif not mbtiles_available:
            updated_state["mbtiles_errors"] = [
                "MBTiles conversion is not available. Please install rio-mbtiles."
            ]
        
        # Check if we created any visualizations
        if not visualizations and not tif_data_list and not mbtiles_data_list:
            return {
                "error": "Failed to create any visualizations",
                "messages": state["messages"] + [
                    "I couldn't create any visualizations from the available data."
                ]
            }
        
        # Add GIF visualization path if available
        if visualizations:
            # Use the first visualization path
            updated_state["visualization_path"] = visualizations[0]
        
        # Add success message
        start_year = state["start_year"]
        end_year = state["end_year"]
        message = (
            f"Created visualizations for {state['region']} from {start_year} "
            f"to {end_year}. Generated {len(tif_data_list)} TIF files"
        )
        
        if mbtiles_data_list:
            message += f" and {len(mbtiles_data_list)} MBTiles files."
        elif mbtiles_errors:
            message += ". MBTiles conversion failed."
        else:
            message += "."
            
        updated_state["messages"] = state["messages"] + [message]
        
        return updated_state
    
    else:
        # Single year visualizations (not needed for this task)
        return {
            "error": "Only time series visualizations are supported for this request",
            "messages": state["messages"] + [
                "I can only generate sequences of .tif and .mbtiles files for time series data."
            ]
        } 