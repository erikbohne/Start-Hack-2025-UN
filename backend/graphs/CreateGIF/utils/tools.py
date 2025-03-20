"""
Tools for the CreateGIF agent workflow.
"""

from typing import Dict, List, Any, Optional, Tuple
import os
import numpy as np
from PIL import Image
import matplotlib.pyplot as plt
from io import BytesIO
import time
import tempfile
import subprocess
import base64

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


def create_single_visualization(data: Dict[str, Any], output_dir: str = "visualizations") -> str:
    """
    Creates a static visualization for a single dataset.
    
    Args:
        data (Dict[str, Any]): Data dictionary returned from load_geospatial_data
        output_dir (str): Directory to save the visualization to
        
    Returns:
        str: Path to the created visualization
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Extract data
    tif_data = data.get("data")
    metadata = data.get("metadata", {})
    region = data.get("region", "unknown")
    year = data.get("year", 0)
    dataset = data.get("dataset", "unknown")
    
    if tif_data is None:
        return f"Error: No data provided for {dataset} in {region} ({year})"
    
    # Generate filename with timestamp for uniqueness
    timestamp = int(time.time())
    filename = f"{region}_{dataset}_{year}_{timestamp}.png"
    output_path = os.path.join(output_dir, filename)
    
    # Create the visualization
    plt.figure(figsize=(10, 8))
    
    # Reset BytesIO position and open with PIL
    tif_data.seek(0)
    img = Image.open(tif_data)
    arr = np.array(img)
    
    plt.imshow(arr, cmap='viridis')
    plt.title(f"{dataset} - {region} ({year})")
    plt.colorbar(label=dataset)
    
    # Save the visualization
    plt.savefig(output_path)
    plt.close()
    
    # Return web-accessible path
    return f"/{output_dir}/{filename}"


def create_time_series_gif(data_series: List[Dict[str, Any]], 
                          output_dir: str = "visualizations") -> str:
    """
    Creates an animated GIF from a time series of geospatial data.
    
    Args:
        data_series (List[Dict[str, Any]]): List of data dictionaries for each time point
        output_dir (str): Directory to save the GIF to
        
    Returns:
        str: Path to the created GIF
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    if not data_series:
        return "Error: No data provided for time series"
    
    # Extract some common metadata
    region = data_series[0].get("region", "unknown")
    dataset = data_series[0].get("dataset", "unknown")
    start_year = min(d.get("year", 0) for d in data_series)
    end_year = max(d.get("year", 0) for d in data_series)
    
    # Generate filename with timestamp for uniqueness
    timestamp = int(time.time())
    filename = f"{region}_{dataset}_{start_year}_to_{end_year}_{timestamp}.gif"
    output_path = os.path.join(output_dir, filename)
    
    # Create frames for the GIF
    frames = []
    for data in sorted(data_series, key=lambda x: x.get("year", 0)):
        year = data.get("year", 0)
        tif_data = data.get("data")
        
        if tif_data is None:
            continue
        
        # Create a frame for this year
        plt.figure(figsize=(10, 8))
        
        # Reset BytesIO position and open with PIL
        tif_data.seek(0)
        img = Image.open(tif_data)
        arr = np.array(img)
        
        plt.imshow(arr, cmap='viridis')
        plt.title(f"{dataset} - {region} ({year})")
        plt.colorbar(label=dataset)
        
        # Save frame to memory
        frame_buffer = BytesIO()
        plt.savefig(frame_buffer, format='png')
        plt.close()
        
        frame_buffer.seek(0)
        frame = Image.open(frame_buffer)
        frames.append(frame)
    
    # Create GIF if we have frames
    if frames:
        # Save as GIF with 1 second delay
        frames[0].save(
            output_path,
            save_all=True,
            append_images=frames[1:],
            optimize=False,
            duration=1000,
            loop=0
        )
        
        # Return web-accessible path
        return f"/{output_dir}/{filename}"
    else:
        return "Error: Could not create any frames for the GIF"
    

def create_html_summary(visualizations: List[str], 
                      title: str, 
                      description: str,
                      output_dir: str = "visualizations") -> str:
    """
    Creates an HTML summary page that combines multiple visualizations.
    
    Args:
        visualizations (List[str]): List of paths to visualizations
        title (str): Title for the summary
        description (str): Description text for the summary
        output_dir (str): Directory to save the HTML file to
        
    Returns:
        str: Path to the created HTML file
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    if not visualizations:
        return "Error: No visualizations provided for HTML summary"
    
    # Generate filename with timestamp for uniqueness
    timestamp = int(time.time())
    filename = f"summary_{timestamp}.html"
    output_path = os.path.join(output_dir, filename)
    
    # Create HTML content
    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <title>{title}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        h1 {{ color: #333; }}
        .visualization {{ margin: 20px 0; text-align: center; }}
        img {{ max-width: 100%; border: 1px solid #ddd; }}
    </style>
</head>
<body>
    <h1>{title}</h1>
    <p>{description}</p>
    
    <div class="visualizations">
"""
    
    # Add each visualization
    for viz in visualizations:
        html_content += f"""
        <div class="visualization">
            <img src="{viz}" alt="Geospatial Visualization">
        </div>
"""
    
    # Close HTML
    html_content += """
    </div>
</body>
</html>
"""
    
    # Write HTML to file
    with open(output_path, 'w') as f:
        f.write(html_content)
    
    # Return web-accessible path
    return f"/{output_dir}/{filename}"


def convert_tif_to_mbtiles_in_memory(tif_data: bytes) -> Tuple[bytes, str]:
    """
    Converts TIF data to MBTiles format in memory.
    
    Args:
        tif_data (bytes): Raw TIF data
        
    Returns:
        Tuple[bytes, str]: MBTiles data and error message if any
    """
    try:
        # Create a temporary file with the TIF data
        with tempfile.NamedTemporaryFile(suffix='.tif', delete=False) as tmp_tif:
            tmp_tif_path = tmp_tif.name
            tmp_tif.write(tif_data)
        
        # Create a temporary file for the output MBTiles
        with tempfile.NamedTemporaryFile(suffix='.mbtiles', delete=False) as tmp_mbtiles:
            tmp_mbtiles_path = tmp_mbtiles.name
        
        try:
            # Convert directly to MBTiles using rio mbtiles
            # Use a single direct command without any preprocessing steps
            cmd = [
                'rio', 'mbtiles', tmp_tif_path, tmp_mbtiles_path,
                '--zoom-levels', '0..8',
                '--format', 'png'
            ]
            
            # Run the command
            proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
            
            # Check for errors
            if proc.returncode != 0:
                print(f"rio mbtiles error: {proc.stderr}")
                return b"", f"Error in rio mbtiles: {proc.stderr}"
            
            # Read MBTiles data
            with open(tmp_mbtiles_path, 'rb') as f:
                mbtiles_data = f.read()
            
            return mbtiles_data, ""
                
        finally:
            # Clean up temporary files
            if os.path.exists(tmp_tif_path):
                os.remove(tmp_tif_path)
            if os.path.exists(tmp_mbtiles_path):
                os.remove(tmp_mbtiles_path)
    
    except Exception as e:
        error_msg = f"Error converting TIF to MBTiles: {str(e)}"
        print(error_msg)
        return b"", error_msg


def create_time_series_mbtiles(data_series: List[Dict[str, Any]], 
                              in_memory: bool = True) -> List[Dict[str, Any]]:
    """
    Creates a sequence of MBTiles files from a time series of geospatial data.
    
    Args:
        data_series (List[Dict[str, Any]]): List of data dictionaries for each time point
        in_memory (bool): If True, returns the data in memory instead of saving to disk
        
    Returns:
        List[Dict[str, Any]]: List of dictionaries with year and mbtiles data
    """
    if not data_series:
        return []
    
    # Extract some common metadata
    region = data_series[0].get("region", "unknown")
    dataset = data_series[0].get("dataset", "unknown")
    
    # Generate timestamp for uniqueness
    timestamp = int(time.time())
    
    # Store results
    result_data = []
    
    # Process each time point
    for data in sorted(data_series, key=lambda x: x.get("year", 0)):
        year = data.get("year", 0)
        tif_data = data.get("data")
        
        if tif_data is None:
            continue
        
        # Generate filename for this year (for reference)
        filename = f"{region}_{dataset}_{year}_{timestamp}.mbtiles"
        
        # Reset BytesIO position and get the raw bytes
        tif_data.seek(0)
        raw_tif_bytes = tif_data.read()
        
        # Convert TIF to MBTiles in memory
        mbtiles_bytes, error = convert_tif_to_mbtiles_in_memory(raw_tif_bytes)
        
        # Add to result list - include error message if there was one
        result_item = {
            "year": year,
            "filename": filename,
            "region": region,
            "dataset": dataset
        }
        
        if error:
            result_item["error"] = error
            print(f"Error converting TIF to MBTiles for {year}: {error}")
        else:
            # Only encode as base64 if no error
            result_item["data"] = base64.b64encode(mbtiles_bytes).decode('utf-8')
        
        result_data.append(result_item)
        
        # Reset position for potential future use
        tif_data.seek(0)
    
    return result_data


# Define tool collections
data_tools = [load_geospatial_data]
visualization_tools = [create_single_visualization, create_time_series_gif, create_html_summary]
all_tools = data_tools + visualization_tools