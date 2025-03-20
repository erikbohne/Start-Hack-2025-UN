"""
Node functions for the CreateGIF agent workflow.
"""

import os
from typing import Dict, Any

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from .state import GraphState
from .models import QueryParameters
from .generate_response import generate_response
# tools are imported when needed in functions

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
            "query_type": params.query_type,
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
                "query_type": fallback_params.query_type,
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


def fetch_data(state: GraphState) -> Dict[str, Any]:
    """
    Fetches geospatial data based on the extracted parameters.
    
    Args:
        state (GraphState): The current state of the workflow
        
    Returns:
        Dict[str, Any]: Updated state with fetched data
    """
    # Check if we have required parameters
    if not state["region"] or not state["datasets"]:
        return {
            "error": "Missing required parameters (region or datasets)",
            "messages": state["messages"] + ["I need to know what region and datasets you're interested in."]
        }
    
    # Import tools here to avoid circular imports
    from .tools import load_geospatial_data
    
    # Check if this is a time series request
    is_time_series = state.get("start_year") is not None and state.get("end_year") is not None
    
    if is_time_series:
        # Fetch time series data
        start_year = state["start_year"]
        end_year = state["end_year"]
        
        data_series = {}
        for dataset in state["datasets"]:
            data_series[dataset] = []
            for year in range(start_year, end_year + 1):
                try:
                    result = load_geospatial_data(region=state["region"], year=year, dataset=dataset)
                    if "error" not in result:
                        data_series[dataset].append(result)
                except Exception as e:
                    print(f"Error loading data for {dataset} in {year}: {str(e)}")
        
        # Check if we got any data
        has_data = any(len(ds) > 0 for ds in data_series.values())
        if not has_data:
            return {
                "error": f"No data available for {state['region']} between {start_year} and {end_year}",
                "messages": state["messages"] + [f"I couldn't find any data for {state['region']} between {start_year} and {end_year}."]
            }
        
        return {
            "data": data_series,
            "messages": state["messages"] + [f"Found data for {state['region']} from {start_year} to {end_year}"]
        }
    
    else:
        # Fetch data for a single year
        year = state.get("year", 2023)  # Default to most recent if not specified
        
        data = {}
        for dataset in state["datasets"]:
            try:
                result = load_geospatial_data(region=state["region"], year=year, dataset=dataset)
                if "error" not in result:
                    data[dataset] = result
            except Exception as e:
                print(f"Error loading data for {dataset} in {year}: {str(e)}")
        
        # Check if we got any data
        if not data:
            return {
                "error": f"No data available for {state['region']} in {year}",
                "messages": state["messages"] + [f"I couldn't find any data for {state['region']} in {year}."]
            }
        
        return {
            "data": data,
            "year": year,
            "messages": state["messages"] + [f"Found data for {state['region']} in {year}"]
        }


def create_visualization(state: GraphState) -> Dict[str, Any]:
    """
    Creates visualizations based on the fetched data.
    
    Args:
        state (GraphState): The current state of the workflow
        
    Returns:
        Dict[str, Any]: Updated state with visualization paths
    """
    from .tools import create_single_visualization, create_time_series_gif, create_html_summary
    
    data = state["data"]
    if not data:
        return {
            "error": "No data available for visualization",
            "messages": state["messages"] + ["I don't have any data to create visualizations with."]
        }
    
    # Check if this is a time series
    is_time_series = state.get("start_year") is not None and state.get("end_year") is not None
    
    if is_time_series:
        # Create time series visualizations (GIFs)
        visualizations = []
        
        for dataset, data_series in data.items():
            if data_series:
                try:
                    gif_path = create_time_series_gif(data_series=data_series)
                    if not gif_path.startswith("Error"):
                        visualizations.append(gif_path)
                except Exception as e:
                    print(f"Error creating time series GIF for {dataset}: {str(e)}")
        
        if not visualizations:
            return {
                "error": "Failed to create any visualizations",
                "messages": state["messages"] + ["I couldn't create any visualizations from the available data."]
            }
        
        # Create an HTML summary with all visualizations
        start_year = state["start_year"]
        end_year = state["end_year"]
        title = f"Time Series Visualization for {state['region'].capitalize()} ({start_year}-{end_year})"
        description = f"This visualization shows changes in {', '.join(state['datasets'])} over time."
        
        try:
            html_path = create_html_summary(
                visualizations=visualizations, 
                title=title, 
                description=description
            )
            
            return {
                "visualization_path": html_path,
                "messages": state["messages"] + [f"Created time series visualizations for {state['region']} from {start_year} to {end_year}"]
            }
        except Exception as e:
            print(f"Error creating HTML summary: {str(e)}")
            # Just return the first visualization if HTML summary fails
            return {
                "visualization_path": visualizations[0],
                "messages": state["messages"] + [f"Created time series visualization for {state['region']} from {start_year} to {end_year}"]
            }
    
    else:
        # Create single visualizations
        year = state.get("year", 2023)
        visualizations = []
        
        for dataset, data_item in data.items():
            try:
                viz_path = create_single_visualization(data=data_item)
                if not viz_path.startswith("Error"):
                    visualizations.append(viz_path)
            except Exception as e:
                print(f"Error creating visualization for {dataset}: {str(e)}")
        
        if not visualizations:
            return {
                "error": "Failed to create any visualizations",
                "messages": state["messages"] + ["I couldn't create any visualizations from the available data."]
            }
        
        # If we have multiple visualizations, create an HTML summary
        if len(visualizations) > 1:
            title = f"Geospatial Data for {state['region'].capitalize()} ({year})"
            description = f"This visualization shows {', '.join(state['datasets'])} data for {state['region']} in {year}."
            
            try:
                html_path = create_html_summary(
                    visualizations=visualizations, 
                    title=title, 
                    description=description
                )
                
                return {
                    "visualization_path": html_path,
                    "messages": state["messages"] + [f"Created visualizations for {state['region']} in {year}"]
                }
            except Exception as e:
                print(f"Error creating HTML summary: {str(e)}")
                # Just return the first visualization if HTML summary fails
                return {
                    "visualization_path": visualizations[0],
                    "messages": state["messages"] + [f"Created visualization for {state['region']} in {year}"]
                }
        else:
            # Just return the single visualization
            return {
                "visualization_path": visualizations[0],
                "messages": state["messages"] + [f"Created visualization for {state['region']} in {year}"]
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
    
    # Generate a response based on the query type
    query_type = state["query_type"]
    region = state["region"]
    
    if query_type == "visualization":
        # Response for visualization request
        viz_path = state.get("visualization_path", "")
        
        # Check if we have a time series
        is_time_series = state.get("start_year") is not None and state.get("end_year") is not None
        
        if is_time_series:
            start_year = state["start_year"]
            end_year = state["end_year"]
            datasets = state["datasets"]
            
            if viz_path:
                response = f"I've created a time series visualization showing changes in {', '.join(datasets)} for {region} from {start_year} to {end_year}. You can view it at {viz_path}."
            else:
                response = f"I couldn't create a time series visualization for the requested data. Please check if the data is available for the years {start_year}-{end_year}."
        else:
            year = state.get("year", 2023)
            datasets = state["datasets"]
            
            if viz_path:
                response = f"I've created a visualization of the geospatial data for {region} in {year}. The visualization shows data from: {', '.join(datasets)}. You can view it at {viz_path}."
            else:
                response = f"I couldn't create a visualization for the requested data. Please check if the data is available."
    
    elif query_type == "data_only":
        # Response for data-only request
        if is_time_series:
            start_year = state["start_year"]
            end_year = state["end_year"]
            datasets = state["datasets"]
            response = f"I've retrieved the requested geospatial data for {region} from {start_year} to {end_year}. The data includes information from the following datasets: {', '.join(datasets)}."
        else:
            year = state.get("year", 2023)
            datasets = state["datasets"]
            response = f"I've retrieved the requested geospatial data for {region} in {year}. The data includes information from the following datasets: {', '.join(datasets)}."
    
    else:
        # Default response
        response = "I've processed your request, but I'm not sure what type of information you were looking for. Could you please clarify if you want to retrieve geospatial data or create a visualization?"
    
    return {
        "messages": state["messages"] + [response]
    } 