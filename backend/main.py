import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
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
        "Sahel_Est_Centre-Est": "Burkina_Faso"
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
            region_url = f"/static/Africa/PopDensity/subregions/{region.value}/{region_filename}"
            files[year] = region_url
    elif dataset == DatasetEnum.Precipitation:
        for year in years:
            # Updated pattern for Precipitation: Country_RegionName_Precip_YYYY.geojson
            region_filename = f"{country}_{region.value}_Precip_{year}.geojson"
            region_url = f"/static/Africa/Precipitation/subregions/{region.value}/{region_filename}"
            files[year] = region_url
    elif dataset == DatasetEnum.LandCover:
        for year in years:
            # Keep the existing pattern for LandCover unless you find it's different
            region_filename = f"{country}_MergedSubregions_LandCover_{year}.tif"
            region_url = f"/static/Africa/LandCover/subregions/{region.value}/{region_filename}"
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
                        file_lookup = lookup_region_files_cached(dataset, region, (year,))
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
                        result[year][dataset.value][country.value] = f"Error: {e.detail}"
    
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
    return StreamingResponse(stream_geo_chat(request.messages, request.mapState), media_type="text/plain")


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
