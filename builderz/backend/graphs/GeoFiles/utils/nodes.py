"""
Node functions for the GeoFiles agent workflow.
"""

import os
from typing import Dict, List, Any

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from .state import GraphState
from .models import QueryParameters
from .tools import process_geospatial_files, process_time_series_files

# Initialize the LLM (defined at top level as recommended)
llm = ChatGroq(
    model_name="llama3-70b-8192",
    api_key=os.getenv("GROQ_API_KEY"),
    temperature=0,
)

# Create a parser for the query parameters
parser = JsonOutputParser(pydantic_object=QueryParameters)

def parse_query(state: GraphState) -> Dict[str, Any]:
    """
    Parses the user query to extract parameters.
    
    Args:
        state (GraphState): The current state of the workflow
        
    Returns:
        Dict[str, Any]: Updated state with extracted parameters
    """
    query = state["query"]
    
    # Create the prompt for extracting parameters
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a geospatial data specialist that extracts query parameters from natural language requests.
        
        The available datasets are:
        - Climate_Precipitation_Data (rainfall data)
        - Gridded_Population_Density_Data (population density)
        - MODIS_Gross_Primary_Production_GPP (vegetation productivity)
        - Modis_Land_Cover_Data (land cover types)
        
        The only supported region is "assaba" in Mauritania.
        Years range from 2010 to 2023 (though some datasets only have data up to 2020 or 2021).
        
        Your task is to extract request parameters in a structured format.
        """),
        ("human", "{query}"),
        ("system", "Extract the parameters and return them as JSON. If a specific year is mentioned, include it. If a range of years is mentioned, include start_year and end_year.")
    ])
    
    # Chain the prompt and LLM together with the parser
    chain = prompt | llm.with_structured_output(QueryParameters)
    
    try:
        # First attempt: Try to use the LLM to parse the query
        params = chain.invoke({"query": query})
        
        # Update the state with extracted parameters
        updates = {
            "query_type": "file_download",  # Always default to file_download for this agent
            "region": params.region,
            "datasets": [ds.dataset_name for ds in params.datasets],
            "messages": state["messages"] + [f"Understood request for {params.region} data"]
        }
        
        # Handle year information
        if params.year is not None:
            updates["year"] = params.year
        
        if params.start_year is not None and params.end_year is not None:
            updates["start_year"] = params.start_year
            updates["end_year"] = params.end_year
            
        return updates
        
    except Exception as e:
        # Fallback: If LLM parsing fails, use the rule-based parser
        try:
            fallback_params = QueryParameters.from_query(query)
            
            # Update the state with extracted parameters
            updates = {
                "query_type": "file_download",  # Always default to file_download for this agent
                "region": fallback_params.region,
                "datasets": [ds.dataset_name for ds in fallback_params.datasets],
                "messages": state["messages"] + [f"Understood request for {fallback_params.region} data using fallback parser"]
            }
            
            # Handle year information
            if fallback_params.year is not None:
                updates["year"] = fallback_params.year
            
            if fallback_params.start_year is not None and fallback_params.end_year is not None:
                updates["start_year"] = fallback_params.start_year
                updates["end_year"] = fallback_params.end_year
                
            return updates
            
        except Exception as fallback_e:
            # If both parsing methods fail, return an error
            return {
                "error": f"Could not parse query: {str(e)}. Fallback also failed: {str(fallback_e)}",
                "messages": state["messages"] + ["I couldn't understand your request. Could you please rephrase it?"]
            }


def generate_files(state: GraphState) -> Dict[str, Any]:
    """
    Generates files based on the extracted parameters.
    
    Args:
        state (GraphState): The current state of the workflow
        
    Returns:
        Dict[str, Any]: Updated state with file paths
    """
    # Check if we have required parameters
    if not state["region"] or not state["datasets"]:
        return {
            "error": "Missing required parameters (region or datasets)",
            "messages": state["messages"] + ["I need to know what region and datasets you're interested in."]
        }
    
    # Check if this is a time series request
    is_time_series = state.get("start_year") is not None and state.get("end_year") is not None
    
    # Create output directory if it doesn't exist
    output_dir = "geofiles"
    os.makedirs(output_dir, exist_ok=True)
    
    tif_files = []
    mbtiles_files = []
    geojson_files = []
    message_parts = []
    
    if is_time_series:
        # Process time series data
        start_year = state["start_year"]
        end_year = state["end_year"]
        
        for dataset in state["datasets"]:
            try:
                result = process_time_series_files(
                    region=state["region"],
                    start_year=start_year,
                    end_year=end_year,
                    dataset=dataset,
                    formats=["tif", "mbtiles", "geojson"],
                    output_dir=output_dir
                )
                
                # Add the file paths to the lists
                if "tif" in result:
                    tif_files.extend(result["tif"])
                if "mbtiles" in result:
                    mbtiles_files.extend(result["mbtiles"])
                if "geojson" in result:
                    geojson_files.extend(result["geojson"])
                    
                # Note which years were processed
                if result["years"]:
                    years_str = ", ".join(str(y) for y in result["years"])
                    message_parts.append(f"Generated files for {dataset} in years {years_str}")
                
            except Exception as e:
                message_parts.append(f"Error processing {dataset}: {str(e)}")
    
    else:
        # Process data for a single year
        year = state.get("year", 2023)  # Default to most recent if not specified
        
        for dataset in state["datasets"]:
            try:
                result = process_geospatial_files(
                    region=state["region"],
                    year=year,
                    dataset=dataset,
                    formats=["tif", "geojson"],
                    output_dir=output_dir
                )
                
                # Add the file paths to the lists
                if "tif" in result:
                    tif_files.append(result["tif"])
                if "geojson" in result:
                    geojson_files.append(result["geojson"])
                    
                message_parts.append(f"Generated files for {dataset} in {year}")
                
            except Exception as e:
                message_parts.append(f"Error processing {dataset}: {str(e)}")
    
    # Check if we generated any files
    if not tif_files and not mbtiles_files and not geojson_files:
        return {
            "error": "Failed to generate any files",
            "messages": state["messages"] + ["I couldn't generate any files from the available data."]
        }
    
    # Format a response message
    if is_time_series:
        response = f"Generated files for {state['region']} from {start_year} to {end_year}."
    else:
        year = state.get("year", 2023)
        response = f"Generated files for {state['region']} in {year}."
        
    if message_parts:
        response += " " + " ".join(message_parts)
    
    return {
        "tif_files": tif_files,
        "mbtiles_files": mbtiles_files,
        "geojson_files": geojson_files,
        "messages": state["messages"] + [response]
    }


def generate_response(state: GraphState) -> Dict[str, Any]:
    """
    Generates a response based on the current state.
    
    Args:
        state (GraphState): The current state of the workflow
        
    Returns:
        Dict[str, Any]: Updated state with response message
    """
    # Check if there was an error
    if state["error"]:
        return {
            "messages": state["messages"] + [f"I encountered an error: {state['error']}"]
        }
    
    # Count the number of files
    tif_count = len(state.get("tif_files", []))
    mbtiles_count = len(state.get("mbtiles_files", []))
    geojson_count = len(state.get("geojson_files", []))
    
    # Generate a response
    if tif_count > 0 or mbtiles_count > 0 or geojson_count > 0:
        response = f"I've generated {tif_count} TIF files, {mbtiles_count} MBTiles files, and {geojson_count} GeoJSON files based on your request."
        
        # Check if we have a time series
        is_time_series = state.get("start_year") is not None and state.get("end_year") is not None
        
        if is_time_series:
            start_year = state["start_year"]
            end_year = state["end_year"]
            datasets = state["datasets"]
            
            response += f" The files contain data for {', '.join(datasets)} in {state['region']} from {start_year} to {end_year}."
        else:
            year = state.get("year", 2023)
            datasets = state["datasets"]
            
            response += f" The files contain data for {', '.join(datasets)} in {state['region']} for {year}."
        
        response += " You can use these files in GIS applications or for web mapping."
    else:
        response = "I couldn't generate any files based on your request. Please check if the data is available for the requested years and region."
    
    return {
        "messages": state["messages"] + [response]
    }