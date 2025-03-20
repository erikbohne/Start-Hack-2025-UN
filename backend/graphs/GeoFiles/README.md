# GeoFiles Agent

This agent handles the creation of geospatial files in different formats (TIF, MBTiles) based on natural language queries.

## Overview

The GeoFiles agent processes requests for geospatial data and returns files in multiple formats:

1. GeoTIFF (.tif) - Standard geospatial raster format
2. MBTiles (.mbtiles) - SQLite database for storing tiled map data

The agent supports:
- Single-year requests
- Time series requests (data over multiple years)
- Multiple datasets

## Usage

Example queries:

```
"Rainfall data from assaba 2022 to 2024"
"Population density in assaba for 2020"
"Vegetation productivity data for assaba from 2015 to 2020"
```

## Response Format

The agent returns:

```json
{
  "response": "Human-readable response describing the files",
  "tif_files": ["path/to/file1.tif", "path/to/file2.tif"],
  "mbtiles_files": ["path/to/file1.mbtiles", "path/to/file2.mbtiles"],
  "error": ""
}
```

## Requirements

- GDAL must be installed for TIF to MBTiles conversion
- The agent relies on the backend's `processing.py` module for data access