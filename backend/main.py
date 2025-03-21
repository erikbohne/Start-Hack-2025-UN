import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from graphs.GeoChatAgent.agent import stream_geo_chat
from fastapi.middleware.cors import CORSMiddleware
from enum import Enum
from typing import List, Dict, Any
from pydantic import BaseModel, Field
from functools import lru_cache


load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)


class DatasetEnum(str, Enum):
    PopDensity = "PopDensity"
    Precipitation = "Precipitation"
    LandCover = "LandCover"
    EVI = "EVI"
    NDVI = "NDVI"


class CountryEnum(str, Enum):
    Burkina_Faso = "Burkina_Faso"
    Chad = "Chad"
    Mali = "Mali"
    Mauritania = "Mauritania"
    Niger = "Niger"
    Senegal = "Senegal"
    Sudan = "Sudan"


class RegionEnum(str, Enum):
    Assaba_Hodh_El_Gharbi_Tagant = "Assaba_Hodh_El_Gharbi_Tagant"
    Sahel_Est_Centre_Est = "Sahel_Est_Centre-Est"


# Mount the static files directory.
dataset_path = os.getenv("DATASET_PATH", default="geofiles/")
app.mount("/static", StaticFiles(directory=dataset_path), name="static")


def lookup_files(
    dataset: DatasetEnum, country: CountryEnum, years: List[int]
) -> Dict[int, str]:
    """
    Constructs file URLs based on the dataset, country, and years.
    """
    files = {}

    if dataset == DatasetEnum.PopDensity:
        popdensity_codes = {
            "Burkina_Faso": "bfa",
            "Chad": "tcd",
            "Mali": "mli",
            "Mauritania": "mrt",
            "Niger": "ner",
            "Senegal": "sen",
            "Sudan": "sdn",
        }
        code = popdensity_codes.get(country.value)
        if not code:
            raise HTTPException(
                status_code=400, detail="Country not supported for PopDensity"
            )
        for year in years:
            filename = f"{code}_pd_{year}_1km_UNadj.geojson"
            file_url = f"/static/Africa/PopDensity/{country.value}/{filename}"
            files[year] = file_url
    elif dataset == DatasetEnum.Precipitation:
        for year in years:
            filename = f"Precipitation_{country.value.replace('_', ' ')}_{year}.geojson"
            file_url = f"/static/Africa/Precipitation/{country.value}/{filename}"
            files[year] = file_url
    elif dataset == DatasetEnum.EVI:
        for year in years:
            filename = f"EVI_{country.value}_{year}.geojson"
            file_url = f"/static/Africa/EVI/{country.value}/{filename}"
            files[year] = file_url
    elif dataset == DatasetEnum.NDVI:
        for year in years:
            filename = f"NDVI_{country.value}_{year}.geojson"
            file_url = f"/static/Africa/NDVI/{country.value}/{filename}"
            files[year] = file_url
    else:
        raise HTTPException(status_code=400, detail="Dataset not supported")

    return files


def lookup_region_files(
    dataset: DatasetEnum, region: RegionEnum, years: List[int]
) -> Dict[int, str]:
    """
    Constructs file URLs for region data based on the dataset, region, and years.
    """
    files = {}
    region_country_map = {
        "Assaba_Hodh_El_Gharbi_Tagant": "Mauritania",
        "Sahel_Est_Centre-Est": "Burkina_Faso",
    }

    country = region_country_map.get(region.value)
    if not country:
        raise HTTPException(
            status_code=400, detail=f"Region {region.value} not supported"
        )

    # Fix region naming pattern based on directory structure
    if dataset == DatasetEnum.PopDensity:
        for year in years:
            # Pattern for PopDensity: Country_MergedSubregions_PopDensity_YYYY.geojson
            region_filename = f"{country}_MergedSubregions_PopDensity_{year}.geojson"
            region_url = (
                f"/static/Africa/PopDensity/subregions/{region.value}/{region_filename}"
            )
            files[year] = region_url
    elif dataset == DatasetEnum.Precipitation:
        for year in years:
            # Updated pattern for Precipitation: Country_RegionName_Precip_YYYY.geojson
            region_filename = f"{country}_{region.value}_Precip_{year}.geojson"
            region_url = f"/static/Africa/Precipitation/subregions/{region.value}/{region_filename}"
            files[year] = region_url
    elif dataset == DatasetEnum.LandCover:
        for year in years:
            # Updated pattern for LandCover - using same pattern as Precipitation
            region_filename = f"{country}_{region.value}_{year}.geojson"
            region_url = (
                f"/static/Africa/LandCover/subregions/{region.value}/{region_filename}"
            )
            files[year] = region_url
    elif dataset == DatasetEnum.EVI:
        for year in years:
            # Pattern for EVI: EVI_YYYY.geojson
            region_filename = f"EVI_{year}.geojson"
            region_url = (
                f"/static/Africa/EVI/subregions/{region.value}/{region_filename}"
            )
            files[year] = region_url
    elif dataset == DatasetEnum.NDVI:
        for year in years:
            # Pattern for NDVI: NDVI_YYYY.geojson
            region_filename = f"NDVI_{year}.geojson"
            region_url = (
                f"/static/Africa/NDVI/subregions/{region.value}/{region_filename}"
            )
            files[year] = region_url
    else:
        raise HTTPException(status_code=400, detail="Dataset not supported for regions")

    return files


# Use lru_cache to cache lookup results.
# Note: lists are not hashable, so we convert the years list into a sorted tuple.
@lru_cache(maxsize=128)
def lookup_files_cached(
    dataset: DatasetEnum, country: CountryEnum, years_tuple: tuple
) -> Dict[int, str]:
    years = list(years_tuple)
    return lookup_files(dataset, country, years)


@lru_cache(maxsize=128)
def lookup_region_files_cached(
    dataset: DatasetEnum, region: RegionEnum, years_tuple: tuple
) -> Dict[int, str]:
    years = list(years_tuple)
    return lookup_region_files(dataset, region, years)


@app.get("/lookup")
def get_files(
    datasets: List[DatasetEnum] = Query(
        ..., description="List of datasets for which files are needed"
    ),
    countries: List[CountryEnum] = Query(
        [], description="List of countries for which files are needed"
    ),
    regions: List[RegionEnum] = Query(
        [], description="List of regions for which files are needed"
    ),
    years: List[int] = Query(
        ..., description="List of years for which files are needed"
    ),
):
    """
    Endpoint that receives a list of datasets, a list of countries, optional regions, and a list of years,
    then returns a nested dictionary structured as:
      { year: { dataset: { country: file_url } } }.

    If regions are specified, country files are ignored and region files are returned instead:
      { year: { dataset: { region: file_url } } }.
    """
    result = {}

    # Iterate over each year first to have it as the outermost key.
    for year in sorted(years):
        result[year] = {}
        for dataset in datasets:
            result[year][dataset.value] = {}

            # If regions are specified, process regions
            if regions:
                for region in regions:
                    try:
                        # Look up files for the single year in a tuple
                        file_lookup = lookup_region_files_cached(
                            dataset, region, (year,)
                        )
                        # Retrieve the file_url for the given year
                        file_url = file_lookup.get(year)
                        result[year][dataset.value][region.value] = file_url
                    except HTTPException as e:
                        result[year][dataset.value][region.value] = f"Error: {e.detail}"

            # If no regions but countries specified, process countries
            elif countries:
                for country in countries:
                    try:
                        # Look up files for the single year in a tuple
                        file_lookup = lookup_files_cached(dataset, country, (year,))
                        # Retrieve the file_url for the given year
                        file_url = file_lookup.get(year)
                        result[year][dataset.value][country.value] = file_url
                    except HTTPException as e:
                        result[year][dataset.value][country.value] = (
                            f"Error: {e.detail}"
                        )

    return result


# Add a new endpoint specifically for regions
@app.get("/region-lookup")
def get_region_files(
    datasets: List[DatasetEnum] = Query(
        ..., description="List of datasets for which files are needed"
    ),
    regions: List[RegionEnum] = Query(
        ..., description="List of regions for which files are needed"
    ),
    years: List[int] = Query(
        ..., description="List of years for which files are needed"
    ),
):
    """
    Endpoint that receives a list of datasets, a list of regions, and a list of years,
    then returns a nested dictionary with region data.
    """
    result = {}

    # Iterate over each year
    for year in sorted(years):
        result[year] = {}
        for dataset in datasets:
            result[year][dataset.value] = {}

            for region in regions:
                try:
                    # Look up files for the single year in a tuple
                    file_lookup = lookup_region_files_cached(dataset, region, (year,))
                    # Retrieve the file_url for the given year
                    file_url = file_lookup.get(year)
                    result[year][dataset.value][region.value] = file_url
                except HTTPException as e:
                    result[year][dataset.value][region.value] = f"Error: {e.detail}"

    return result


class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    mapState: Dict[str, Any] = Field(default_factory=dict)


@app.post("/chat/stream")
async def stream_chat(request: ChatRequest):
    """
    Endpoint that streams a chat response with possible map instructions.
    """
    return StreamingResponse(
        stream_geo_chat(request.messages, request.mapState), media_type="text/plain"
    )

@app.get("/timeline-gif")
async def get_timeline_gif(
    country: str = "Mali", 
    dataset: str = "PopDensity", 
    start: int = 2015, 
    end: int = 2020
):
    """
    Endpoint that serves the timeline GIF with parameters.
    If a GIF with these parameters doesn't exist, it will fall back to the default timeline.gif.
    """
    # Check if the parameters are valid (sanitize them to prevent injections)
    valid_countries = ["Mali", "Chad", "Niger", "Burkina_Faso", "Mauritania", "Senegal", "Sudan"]
    valid_datasets = ["PopDensity", "Precipitation"]
    
    if country not in valid_countries:
        country = "Mali"
    if dataset not in valid_datasets:
        dataset = "PopDensity"
    
    # Ensure years are in the valid range
    start = max(2010, min(2020, start))
    end = max(2010, min(2020, end))
    
    # Determine the filename
    # First try a specific filename based on parameters
    param_filename = f"{dataset}_{country}_{start}_{end}.gif"
    param_path = os.path.join(os.getcwd(), param_filename)
    
    # Default fallback path
    default_path = os.path.join(os.getcwd(), "timeline.gif")
    
    print(f"Looking for GIF at: {param_path} or {default_path}")
    
    try:
        # First check if the parameterized file exists
        if os.path.exists(param_path):
            print(f"Parameterized GIF found, size: {os.path.getsize(param_path)} bytes")
            headers = {
                "Content-Disposition": f"inline; filename={param_filename}",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache, no-store, must-revalidate"
            }
            return FileResponse(param_path, media_type="image/gif", headers=headers)
        
        # Fall back to the default timeline.gif
        elif os.path.exists(default_path):
            print(f"Default GIF found, size: {os.path.getsize(default_path)} bytes")
            headers = {
                "Content-Disposition": "inline; filename=timeline.gif",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache, no-store, must-revalidate"
            }
            return FileResponse(default_path, media_type="image/gif", headers=headers)
        else:
            print(f"GIF files not found")
            raise HTTPException(status_code=404, detail="Timeline GIF not found")
    except Exception as e:
        print(f"Error serving GIF: {e}")
        raise HTTPException(status_code=500, detail=f"Error serving GIF: {str(e)}")

@app.get("/timeline-view")
async def get_timeline_html(title: str = None):
    """
    Endpoint that serves an HTML page displaying the timeline GIF.
    """
    html_path = os.path.join(os.getcwd(), "timeline_display.html")
    print(f"Looking for HTML at: {html_path}")
    
    try:
        if os.path.exists(html_path):
            headers = {
                "Access-Control-Allow-Origin": "*"  # Add CORS header explicitly
            }
            return FileResponse(html_path, media_type="text/html", headers=headers)
        else:
            print(f"HTML file not found at: {html_path}")
            raise HTTPException(status_code=404, detail=f"Timeline HTML not found at {html_path}")
    except Exception as e:
        print(f"Error serving HTML: {e}")
        raise HTTPException(status_code=500, detail=f"Error serving HTML: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    import sys
    import os

    file_path = os.path.abspath(__file__)
    dir_path = os.path.dirname(file_path)
    file_name = os.path.basename(file_path)
    module_name = os.path.splitext(file_name)[0]

    if dir_path not in sys.path:
        sys.path.append(dir_path)

    # Run the server
    uvicorn.run(f"{module_name}:app", host="0.0.0.0", port=8000, reload=True)
