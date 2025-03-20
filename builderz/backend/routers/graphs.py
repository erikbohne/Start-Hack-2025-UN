"""
FastAPI router for accessing LangGraph agents.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, Any, Optional, List

# Import agents
from graphs.CreateGIF.agent import process_visualization_request, RequestInput as GIFRequestInput, AgentResponse as GIFResponse
from graphs.GeoFiles.agent import process_geofiles_request, RequestInput as GeoFilesRequestInput, AgentResponse as GeoFilesResponse

router = APIRouter(prefix="/graphs", tags=["graphs"])

@router.post("/create-gif", response_model=GIFResponse)
async def create_gif(request: GIFRequestInput) -> Dict[str, Any]:
    """
    Create a GIF visualization based on a natural language query.
    
    Example queries:
    - "Show me rainfall data for Assaba in 2020"
    - "Visualize changes in vegetation productivity in Assaba from 2015 to 2020"
    - "Create a map of land cover types in Assaba for 2018"
    """
    try:
        # Process the request using the CreateGIF agent
        result = process_visualization_request({"query": request.query})
        return result
    except Exception as e:
        # Handle any errors
        raise HTTPException(status_code=500, detail=f"Error processing visualization request: {str(e)}")

@router.post("/geo-files", response_model=GeoFilesResponse)
async def create_geo_files(request: GeoFilesRequestInput) -> Dict[str, Any]:
    """
    Create geospatial files (TIF, MBTiles) based on a natural language query.
    
    Example queries:
    - "Rainfall data from assaba 2022 to 2024"
    - "Population density in assaba for 2020"
    - "Vegetation productivity data for assaba from 2015 to 2020"
    """
    try:
        # Process the request using the GeoFiles agent
        result = process_geofiles_request({"query": request.query})
        return result
    except Exception as e:
        # Handle any errors
        raise HTTPException(status_code=500, detail=f"Error processing geospatial files request: {str(e)}")

@router.post("/query")
async def process_query(request: Request) -> Dict[str, Any]:
    """
    Process a query from any format (flexible endpoint).
    
    Accepts either:
    - {"query": "your natural language query", "agent": "gif|geo-files"}
    - Raw text query (defaults to gif agent)
    """
    try:
        # Parse the request body based on content type
        if request.headers.get("content-type") == "application/json":
            # JSON request
            data = await request.json()
            if isinstance(data, dict) and "query" in data:
                query_data = data
                agent_type = data.get("agent", "gif").lower()
            else:
                query_data = {"query": str(data)}
                agent_type = "gif"
        else:
            # Assume plain text query
            text = await request.body()
            query_data = {"query": text.decode()}
            agent_type = "gif"

        # Process the request using the appropriate agent
        if agent_type == "geo-files":
            result = process_geofiles_request(query_data)
        else:
            # Default to GIF agent
            result = process_visualization_request(query_data)
            
        return result
    except Exception as e:
        # Handle any errors
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")