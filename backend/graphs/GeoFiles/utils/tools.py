"""
Tools for the GeoFiles agent workflow.
"""

from typing import Dict, List, Any, Optional, Tuple
import os
import numpy as np
from PIL import Image
import time
import subprocess
import shutil
from io import BytesIO

from processing import load_and_preprocess_tif


def load_geospatial_data(region: str, year: int, dataset: str) -> Dict[str, Any]:
    """
    Loads geospatial data for a specific region, year, and dataset.
    
    Args:
        region (str): The region to load data for (e.g., 'assaba')
        year (int): The year to load data for
        dataset (str): The dataset to load (e.g., 'Climate_Precipitation_Data')
        
    Returns:
        Dict[str, Any]: Dictionary containing the loaded data and metadata
    """
    try:
        tif_data = load_and_preprocess_tif(region, year, [dataset])
        
        # Open the data and get some basic stats
        tif_data.seek(0)
        img = Image.open(tif_data)
        arr = np.array(img)
        
        metadata = {
            "min_value": float(np.min(arr)),
            "max_value": float(np.max(arr)),
            "mean_value": float(np.mean(arr)),
            "shape": arr.shape,
        }
        
        # Reset the position for future read
        tif_data.seek(0)
        
        return {
            "data": tif_data,
            "metadata": metadata,
            "region": region,
            "year": year,
            "dataset": dataset
        }
    except Exception as e:
        return {
            "error": str(e),
            "region": region,
            "year": year,
            "dataset": dataset
        }


def save_tif_file(data: Dict[str, Any], output_dir: str = "geofiles") -> str:
    """
    Saves BytesIO data as a GeoTIFF file.
    
    Args:
        data (Dict[str, Any]): Data dictionary returned from load_geospatial_data
        output_dir (str): Directory to save the TIF file to
        
    Returns:
        str: Path to the saved TIF file
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Extract data
    tif_data = data.get("data")
    region = data.get("region", "unknown")
    year = data.get("year", 0)
    dataset = data.get("dataset", "unknown")
    
    if tif_data is None:
        return f"Error: No data provided for {dataset} in {region} ({year})"
    
    # Generate filename with timestamp for uniqueness
    timestamp = int(time.time())
    filename = f"{region}_{dataset}_{year}_{timestamp}.tif"
    output_path = os.path.join(output_dir, filename)
    
    # Save the TIF file
    tif_data.seek(0)
    with open(output_path, 'wb') as f:
        f.write(tif_data.read())
    
    # Return the file path
    return output_path


def convert_tif_to_mbtiles(tif_path: str, output_dir: str = "geofiles") -> str:
    """
    Converts a GeoTIFF file to MBTiles format using rio-mbtiles.
    
    Args:
        tif_path (str): Path to the TIF file to convert
        output_dir (str): Directory to save the MBTiles file to
        
    Returns:
        str: Path to the generated MBTiles file
    """
    if not os.path.exists(tif_path):
        return f"Error: TIF file {tif_path} not found"
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate output filename
    base_name = os.path.basename(tif_path)
    mbtiles_name = os.path.splitext(base_name)[0] + ".mbtiles"
    mbtiles_path = os.path.join(output_dir, mbtiles_name)
    
    try:
        # Use rio-mbtiles directly to convert the TIF file
        cmd = f"rio mbtiles {tif_path} {mbtiles_path} --format PNG"
        
        # Execute command
        result = subprocess.run(
            cmd, 
            shell=True, 
            check=True, 
            stderr=subprocess.PIPE,
            stdout=subprocess.PIPE
        )
        
        if os.path.exists(mbtiles_path):
            return mbtiles_path
        else:
            err_msg = result.stderr.decode()
            return f"Error: MBTiles file was not created: {err_msg}"
        
    except subprocess.CalledProcessError as e:
        err_msg = e.stderr.decode()
        return f"Error converting TIF to MBTiles: Command failed with code {e.returncode}. {err_msg}"
    except Exception as e:
        return f"Error converting TIF to MBTiles: {str(e)}"


def convert_tif_to_geojson(tif_path: str, output_dir: str = "geofiles",
                          simplify_tolerance: float = 0.001) -> str:
    """
    Converts a GeoTIFF file to GeoJSON format using gdal_polygonize.py.
    
    Args:
        tif_path (str): Path to the TIF file to convert
        output_dir (str): Directory to save the GeoJSON file to
        simplify_tolerance (float): Tolerance for polygon simplification
        
    Returns:
        str: Path to the generated GeoJSON file
    """
    if not os.path.exists(tif_path):
        return f"Error: TIF file {tif_path} not found"
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate output filename
    base_name = os.path.basename(tif_path)
    geojson_name = os.path.splitext(base_name)[0] + ".geojson"
    temp_geojson = os.path.join(output_dir, "temp_" + geojson_name)
    geojson_path = os.path.join(output_dir, geojson_name)
    
    try:
        # Use gdal_polygonize.py with mask to filter no-data values
        cmd = (f"gdal_polygonize.py -mask {tif_path} -f GeoJSON {tif_path} "
               f"{temp_geojson} DN")
        
        # Execute command
        result = subprocess.run(cmd,
                               shell=True,
                               check=True,
                               stderr=subprocess.PIPE,
                               stdout=subprocess.PIPE)
        
        if os.path.exists(temp_geojson):
            # Simplify the polygons using ogr2ogr to reduce file size
            simplify_cmd = (f"ogr2ogr -f GeoJSON -simplify {simplify_tolerance} "
                           f"{geojson_path} {temp_geojson}")
            
            subprocess.run(simplify_cmd,
                          shell=True,
                          check=True,
                          stderr=subprocess.PIPE,
                          stdout=subprocess.PIPE)
            
            # Remove temporary file
            if os.path.exists(temp_geojson):
                os.remove(temp_geojson)
            
            if os.path.exists(geojson_path):
                return geojson_path
            else:
                err_msg = result.stderr.decode()
                return f"Error: Final GeoJSON file was not created: {err_msg}"
        else:
            err_msg = result.stderr.decode()
            return f"Error: Temporary GeoJSON file was not created: {err_msg}"
        
    except subprocess.CalledProcessError as e:
        err_msg = e.stderr.decode()
        return (f"Error converting TIF to GeoJSON: Command failed with code "
                f"{e.returncode}. {err_msg}")
    except Exception as e:
        return f"Error converting TIF to GeoJSON: {str(e)}"


def process_geospatial_files(
    region: str, 
    year: int, 
    dataset: str,
    formats: List[str] = ["tif", "mbtiles", "geojson"],
    output_dir: str = "geofiles"
) -> Dict[str, str]:
    """
    Processes a geospatial dataset into requested file formats.
    
    Args:
        region (str): The region to load data for
        year (int): The year to load data for
        dataset (str): The dataset to load
        formats (List[str]): The formats to generate
        output_dir (str): Directory to save the files to
        
    Returns:
        Dict[str, str]: Dictionary of format -> file path
    """
    # Make sure the output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Load the data
    data = load_geospatial_data(region, year, dataset)
    if "error" in data:
        return {"error": data["error"]}
    
    result = {}
    
    # Process each requested format
    for fmt in formats:
        if fmt.lower() == "tif":
            tif_path = save_tif_file(data, output_dir)
            result["tif"] = tif_path
            
        elif fmt.lower() == "mbtiles":
            # First make sure we have a TIF file
            if "tif" not in result:
                tif_path = save_tif_file(data, output_dir)
                result["tif"] = tif_path
            else:
                tif_path = result["tif"]
            
            # Convert to MBTiles
            mbtiles_path = convert_tif_to_mbtiles(tif_path, output_dir)
            result["mbtiles"] = mbtiles_path
            
        elif fmt.lower() == "geojson":
            # First make sure we have a TIF file
            if "tif" not in result:
                tif_path = save_tif_file(data, output_dir)
                result["tif"] = tif_path
            else:
                tif_path = result["tif"]
            
            # Convert to GeoJSON
            geojson_path = convert_tif_to_geojson(tif_path, output_dir)
            result["geojson"] = geojson_path
    
    return result


def process_time_series_files(
    region: str,
    start_year: int,
    end_year: int,
    dataset: str,
    formats: List[str] = ["tif", "mbtiles", "geojson"],
    output_dir: str = "geofiles"
) -> Dict[str, List[str]]:
    """
    Processes a time series of geospatial data into requested file formats.
    
    Args:
        region (str): The region to load data for
        start_year (int): The start year for the time series
        end_year (int): The end year for the time series
        dataset (str): The dataset to load
        formats (List[str]): The formats to generate
        output_dir (str): Directory to save the files to
        
    Returns:
        Dict[str, List[str]]: Dictionary of format -> list of file paths
    """
    # Make sure the output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    result = {fmt: [] for fmt in formats}
    result["years"] = []
    
    # Process each year in the time series
    for year in range(start_year, end_year + 1):
        try:
            year_files = process_geospatial_files(region, year, dataset, formats, output_dir)
            
            if "error" in year_files:
                continue
                
            # Add the file paths to the result
            for fmt in formats:
                if fmt in year_files:
                    result[fmt].append(year_files[fmt])
                    
            result["years"].append(year)
            
        except Exception as e:
            print(f"Error processing data for {year}: {str(e)}")
    
    return result


# Define tool collections
data_tools = [load_geospatial_data]
file_tools = [
    save_tif_file, 
    convert_tif_to_mbtiles, 
    convert_tif_to_geojson,
    process_geospatial_files, 
    process_time_series_files
]
all_tools = data_tools + file_tools