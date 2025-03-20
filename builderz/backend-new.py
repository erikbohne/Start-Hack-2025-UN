import os
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from enum import Enum
from typing import List, Dict
from functools import lru_cache

app = FastAPI()


class DatasetEnum(str, Enum):
    PopDensity = "PopDensity"
    Precipitation = "Precipitation"


class CountryEnum(str, Enum):
    Burkina_Faso = "Burkina_Faso"
    Chad = "Chad"
    Mali = "Mali"
    Mauritania = "Mauritania"
    Niger = "Niger"
    Senegal = "Senegal"
    Sudan = "Sudan"


# Mount the static files directory.
dataset_path = os.getenv("DATASET_PATH", default="../STARTHACK/vectorized/")
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


# Use lru_cache to cache lookup results.
# Note: lists are not hashable, so we convert the years list into a sorted tuple.
@lru_cache(maxsize=128)
def lookup_files_cached(
    dataset: DatasetEnum, country: CountryEnum, years_tuple: tuple
) -> Dict[int, str]:
    years = list(years_tuple)
    return lookup_files(dataset, country, years)


@app.get("/lookup")
def get_files(
    datasets: List[DatasetEnum] = Query(
        ..., description="List of datasets for which files are needed"
    ),
    countries: List[CountryEnum] = Query(
        ..., description="List of countries for which files are needed"
    ),
    years: List[int] = Query(
        ..., description="List of years for which files are needed"
    ),
):
    """
    Endpoint that receives a list of datasets, a list of countries, and a list of years,
    then returns a nested dictionary structured as:
      { year: { dataset: { country: file_url } } }.
    """
    result = {}
    # Iterate over each year first to have it as the outermost key.
    for year in sorted(years):
        result[year] = {}
        for dataset in datasets:
            result[year][dataset.value] = {}
            for country in countries:
                try:
                    # Look up files for the single year in a tuple.
                    file_lookup = lookup_files_cached(dataset, country, (year,))
                    # Retrieve the file_url for the given year.
                    file_url = file_lookup.get(year)
                    result[year][dataset.value][country.value] = file_url
                except HTTPException as e:
                    result[year][dataset.value][country.value] = f"Error: {e.detail}"
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
