from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os

from processing import load_and_preprocess_tif
from routers.graphs import router as graphs_router

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories for static files
os.makedirs("visualizations", exist_ok=True)
os.makedirs("geofiles", exist_ok=True)

# Serve static files
app.mount("/visualizations", StaticFiles(directory="visualizations"), name="visualizations")
app.mount("/geofiles", StaticFiles(directory="geofiles"), name="geofiles")

# Include routers
app.include_router(graphs_router)


@app.get("/fetch-tif")
async def fetch_tif(
    region: str,
    year: int,
    datasets: List[str] = Query(
        ...,
        description="List of dataset names. "
        "Supported values: 'Climate_Precipitation_Data', "
        "'Gridded_Population_Density_Data', "
        "'MODIS_Gross_Primary_Production_GPP', "
        "'Modis_Land_Cover_Data'",
    ),
):
    """
    Fetch a preprocessed multi-band TIF file from memory based on the region, year, and datasets.
    Only the Assaba region is supported.
    """
    try:
        tif_file = load_and_preprocess_tif(region, year, datasets)
        tif_file.seek(0)
        return StreamingResponse(tif_file, media_type="image/tiff")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {e}")


@app.get("/download/{file_type}/{file_name}")
async def download_file(file_type: str, file_name: str):
    """
    Download a generated geospatial file.
    
    Args:
        file_type: Type of file ('tif' or 'mbtiles')
        file_name: Name of the file to download
    """
    if file_type not in ["tif", "mbtiles"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Must be 'tif' or 'mbtiles'")
    
    file_dir = "geofiles"
    file_path = os.path.join(file_dir, file_name)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File {file_name} not found")
    
    content_type = "image/tiff" if file_type == "tif" else "application/octet-stream"
    return FileResponse(
        path=file_path, 
        filename=file_name,
        media_type=content_type
    )
