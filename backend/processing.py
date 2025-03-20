import io
import os
import glob
import re
import numpy as np
from PIL import Image
from rasterio.io import MemoryFile

# Global cache for loaded TIF data
TIF_CACHE = {
    "Climate_Precipitation_Data": {},
    "Gridded_Population_Density_Data": {},
    "MODIS_Gross_Primary_Production_GPP": {},
    "Modis_Land_Cover_Data": {},
}


def load_all_tifs():
    """
    Preload all supported TIF files from the parent directory '../data' into memory.
    The function uses glob and regex to find files and loads each as a grayscale numpy array.
    """
    base_path = os.path.join("..", "data")

    # Load Climate_Precipitation_Data (files like "2010R.tif")
    cp_folder = os.path.join(base_path, "Climate_Precipitation_Data")
    cp_files = glob.glob(os.path.join(cp_folder, "*R.tif"))
    for file in cp_files:
        m = re.search(r"(\d{4})R\.tif$", file)
        if m:
            year = int(m.group(1))
            try:
                with Image.open(file) as img:
                    if img.mode != "L":
                        img = img.convert("L")
                    TIF_CACHE["Climate_Precipitation_Data"][year] = np.array(img)
            except Exception as e:
                print(f"Error loading {file}: {e}")

    # Load Gridded_Population_Density_Data (files like "Assaba_Pop_2010.tif")
    pop_folder = os.path.join(base_path, "Gridded_Population_Density_Data")
    pop_files = glob.glob(os.path.join(pop_folder, "Assaba_Pop_*.tif"))
    for file in pop_files:
        m = re.search(r"Assaba_Pop_(\d{4})\.tif$", file)
        if m:
            year = int(m.group(1))
            try:
                with Image.open(file) as img:
                    if img.mode != "L":
                        img = img.convert("L")
                    TIF_CACHE["Gridded_Population_Density_Data"][year] = np.array(img)
            except Exception as e:
                print(f"Error loading {file}: {e}")

    # Load MODIS_Gross_Primary_Production_GPP (files like "2010_GP.tif")
    modis_gp_folder = os.path.join(base_path, "MODIS_Gross_Primary_Production_GPP")
    modis_gp_files = glob.glob(os.path.join(modis_gp_folder, "*_GP.tif"))
    for file in modis_gp_files:
        m = re.search(r"(\d{4})_GP\.tif$", file)
        if m:
            year = int(m.group(1))
            try:
                with Image.open(file) as img:
                    if img.mode != "L":
                        img = img.convert("L")
                    TIF_CACHE["MODIS_Gross_Primary_Production_GPP"][year] = np.array(
                        img
                    )
            except Exception as e:
                print(f"Error loading {file}: {e}")

    # Load Modis_Land_Cover_Data (files like "2010LCT.tif")
    modis_lct_folder = os.path.join(base_path, "Modis_Land_Cover_Data")
    modis_lct_files = glob.glob(os.path.join(modis_lct_folder, "*LCT.tif"))
    for file in modis_lct_files:
        m = re.search(r"(\d{4})LCT\.tif$", file)
        if m:
            year = int(m.group(1))
            try:
                with Image.open(file) as img:
                    if img.mode != "L":
                        img = img.convert("L")
                    TIF_CACHE["Modis_Land_Cover_Data"][year] = np.array(img)
            except Exception as e:
                print(f"Error loading {file}: {e}")


# Preload data into memory when the module is imported.
load_all_tifs()


def load_and_preprocess_tif(region: str, year: int, datasets: list) -> io.BytesIO:
    """
    Retrieve preloaded TIF data for the specified region, year, and datasets.
    Instead of cropping, this function upscales images to the largest width and height
    among the selected datasets so that they can be stacked as separate bands.

    Supported datasets and their expected file patterns:
      - Climate_Precipitation_Data: {year}R.tif
      - Gridded_Population_Density_Data: Assaba_Pop_{year}.tif
      - MODIS_Gross_Primary_Production_GPP: {year}_GP.tif
      - Modis_Land_Cover_Data: {year}LCT.tif

    Parameters:
      - region: Must be "assaba" (case-insensitive).
      - year: Year of the data.
      - datasets: List of dataset names.

    Returns:
      An in-memory BytesIO object containing the combined multi-band TIF.
    """
    if region.lower() != "assaba":
        raise ValueError("Currently only the Assaba region is supported.")

    arrays = []
    for ds in datasets:
        if ds not in TIF_CACHE:
            raise ValueError(f"Unsupported dataset: {ds}")
        if year not in TIF_CACHE[ds]:
            raise ValueError(f"Data for year {year} not found for dataset {ds}")
        arrays.append(TIF_CACHE[ds][year])

    if not arrays:
        raise ValueError("No datasets loaded.")

    # Determine the maximum dimensions among all arrays.
    max_height = max(arr.shape[0] for arr in arrays)
    max_width = max(arr.shape[1] for arr in arrays)

    # Upscale each array to the largest dimensions if necessary.
    upscaled_arrays = []
    for arr in arrays:
        if arr.shape[0] != max_height or arr.shape[1] != max_width:
            # Convert array to PIL image, resize, then back to numpy array.
            im = Image.fromarray(arr)
            im_resized = im.resize((max_width, max_height), resample=Image.BILINEAR)
            arr = np.array(im_resized)
        upscaled_arrays.append(arr)

    # Stack arrays as separate bands.
    if len(upscaled_arrays) == 1:
        stacked = upscaled_arrays[0][:, :, None]
        num_bands = 1
    else:
        stacked = np.stack(upscaled_arrays, axis=-1)
        num_bands = stacked.shape[-1]

    height, width = max_height, max_width

    # Write the stacked array into an in-memory GeoTIFF using rasterio.
    with MemoryFile() as memfile:
        with memfile.open(
            driver="GTiff",
            height=height,
            width=width,
            count=num_bands,
            dtype=stacked.dtype,
        ) as dataset:
            for i in range(num_bands):
                dataset.write(stacked[:, :, i], i + 1)
        tif_bytes = memfile.read()

    return io.BytesIO(tif_bytes)
