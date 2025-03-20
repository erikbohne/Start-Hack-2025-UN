"use client";

import { useEffect, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchGeoData, fetchGeoJSON } from "@/lib/api";
import { DatasetType, CountryType, RegionType, GeoDataResponse } from "@/lib/types";
import DataControls from "./DataControls";
import { useMapContext } from "@/lib/MapContext";

export default function Map() {
  // Get all values and functions from context
  const {
    mapContainer,
    map,
    mapIsReady,
    isLoading,
    setIsLoading,
    error,
    setError,
    is3DMode,
    dataControlsExpanded,
    setDataControlsExpanded,
    animating,
    setAnimating,
    displayYear,
    setDisplayYear,
    animationTimerRef,
    animationSpeed,
    cachedGeojsonData,
    yearSequence,
    currentYearIndexRef,
    datasetCountryCombo,
    activeLayers,
    thresholdValues,
    datasetRanges,
    toggle3DMode: contextToggle3DMode,
    updateVisibleYear: contextUpdateVisibleYear,
    toggleAnimation: contextToggleAnimation,
    changeAnimationSpeed: contextChangeAnimationSpeed,
    handleThresholdChange,
    handleYearSelection,
  } = useMapContext();

  // Handle toggling between 2D and 3D mode
  const toggle3DMode = useCallback(() => {
    contextToggle3DMode();

    // Need to recreate the map when changing projections
    if (map.current) {
      // Store current state
      const center = map.current.getCenter();
      const zoom = map.current.getZoom();

      // Remove existing map
      map.current.remove();
      map.current = null;

      // Will be recreated on next render with new projection
      setTimeout(() => {
        if (!mapContainer.current) return;

        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: "mapbox://styles/adis123/cm2trla51000q01qw78sv431j",
          projection: !is3DMode ? "globe" : "mercator", // Toggle to opposite of current state
          zoom: zoom,
          center: center,
          attributionControl: true,
          maxZoom: 50,
          renderWorldCopies: false,
        }); 

        const mapInstance = map.current;

        mapInstance.on("load", () => {
          console.log("Map recreated successfully");
          // Add fog if switching to 3D mode
          if (!is3DMode) {
            // Using !is3DMode because state hasn't updated yet
            mapInstance.setFog({});
          }
          mapIsReady.current = true;

          // Reload current layers if any
          if (
            yearSequence.current.length > 0 &&
            datasetCountryCombo.current.length > 0
          ) {
            // Use existing filter settings
            // Extract unique datasets
            const uniqueDatasets = datasetCountryCombo.current
              .map((item) => item.dataset)
              .filter((v, i, a) => a.indexOf(v) === i) as DatasetType[];
            
            // Determine if we're in region mode by checking the first item
            const isRegionMode = datasetCountryCombo.current.length > 0 && 'region' in datasetCountryCombo.current[0];
            
            if (isRegionMode) {
              // Extract unique regions
              const uniqueRegions = datasetCountryCombo.current
                .map((item) => item.region)
                .filter((v): v is RegionType => v !== undefined);
              
              loadGeoData(
                uniqueDatasets,
                [], // Empty countries array
                yearSequence.current,
                uniqueRegions
              );
            } else {
              // Extract unique countries
              const uniqueCountries = datasetCountryCombo.current
                .map((item) => item.country)
                .filter((v): v is CountryType => v !== undefined);
              
              loadGeoData(
                uniqueDatasets,
                uniqueCountries,
                yearSequence.current
              );
            }
          }
        });

        mapInstance.addControl(new mapboxgl.NavigationControl());
        mapInstance.scrollZoom.enable();
      }, 100);
    }
  }, [is3DMode, contextToggle3DMode]);

  // Initialize the map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    mapboxgl.accessToken =
      "pk.eyJ1IjoiYWRpczEyMyIsImEiOiJjbTJxZjFtcTYwbXZyMmtyMWxlcWRqYnFhIn0.-SswCiDuWIyLZzoFFw-omQ";

    try {
      // Initialize with current 3D mode setting
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/light-v11", // Light style with less detail for better performance
        projection: is3DMode ? "globe" : "mercator", // Dynamic projection based on mode
        zoom: 1.5,
        center: [10, 15], // Centered on Africa
        attributionControl: true,
        maxZoom: 10, // Limit max zoom for better performance
        renderWorldCopies: false, // Disable world copies for better performance
      });

      const mapInstance = map.current;

      mapInstance.on("error", (e) => {
        console.error("Mapbox error:", e);
      });

      mapInstance.on("load", () => {
        console.log("Map loaded successfully");
        // Add fog if in 3D mode
        if (is3DMode) {
          mapInstance.setFog({});
        }
        mapIsReady.current = true;
      });

      mapInstance.addControl(new mapboxgl.NavigationControl());
      mapInstance.scrollZoom.enable(); // Enable scroll zoom for better usability
    } catch (error) {
      console.error("Error initializing map:", error);
      setError("Failed to initialize map");
    }

    return () => {
      if (map.current) {
        map.current.remove();
      }
      // Clean up animation if it's running
      if (animationTimerRef.current !== null) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
    };
  }, [is3DMode, setError]);

  // Apply threshold filter to layers with debouncing for better performance
  const applyThresholdFilter = useCallback(() => {
    if (!map.current || !displayYear) return;

    // Use requestAnimationFrame to align with browser's render cycle
    requestAnimationFrame(() => {
      // Apply filters in batch for better performance
      const operations = datasetCountryCombo.current
        .map(({ dataset, country }) => {
          const layerId = `${dataset}-${country}-${displayYear}`;
          if (map.current?.getLayer(layerId)) {
            return () =>
              map.current?.setFilter(layerId, [
                ">=",
                ["get", "DN"],
                thresholdValues[dataset],
              ]);
          }
          return null;
        })
        .filter(Boolean);

      // Execute all filter operations
      operations.forEach((op) => op && op());
    });
  }, [displayYear, thresholdValues]);

  // Threshold changes are batched with debounce for better performance
  useEffect(() => {
    const handler = setTimeout(() => {
      applyThresholdFilter();
    }, 50); // 50ms debounce delay

    return () => clearTimeout(handler);
  }, [thresholdValues, applyThresholdFilter]);

  // Optimized function to update which year's data is visible
  const updateVisibleYear = useCallback(
    (yearToShow: number) => {
      if (!map.current || !mapIsReady.current) return;

      // Set state for UI display
      contextUpdateVisibleYear(yearToShow);

      requestAnimationFrame(() => {
        // Get the year datasets we want to show
        const yearDatasetMap = (window as unknown).yearDatasetMap as Record<
          number,
          string[]
        >;
        const datasetsToShow = yearDatasetMap?.[yearToShow] || [];
        
        // Debug what datasets should be shown for this year
        console.log(`For year ${yearToShow}, should show datasets:`, datasetsToShow);

        // Batch operations to minimize render cycles
        const hideOps: (() => void)[] = [];
        const showOps: (() => void)[] = [];
        const filterOps: (() => void)[] = [];

        // Process all active layers
        activeLayers.current.forEach((layerId) => {
          // Extract year from layerId (format: dataset-country-year or dataset-region-region-year)
          const parts = layerId.split("-");
          const layerYear =
            parts.length > 2 ? parseInt(parts[parts.length - 1]) : -1;

          if (!map.current?.getLayer(layerId)) return;

          if (layerYear === yearToShow) {
            const visibility = map.current.getLayoutProperty(
              layerId,
              "visibility"
            );
            // Reconstruct the key exactly as it was stored in yearDatasetMap
            const datasetCountryKey = parts
              .slice(0, parts.length - 1)
              .join("-");
            const shouldBeVisible = datasetsToShow.includes(datasetCountryKey);
            
            // Debug visibility determination
            console.log(`Layer ${layerId} for year ${yearToShow}:`, { 
              visibility, 
              datasetCountryKey,
              shouldBeVisible,
              datasetsInYear: datasetsToShow
            });

            if (visibility === "none" && shouldBeVisible) {
              console.log(`Making layer ${layerId} visible`);
              showOps.push(() =>
                map.current?.setLayoutProperty(layerId, "visibility", "visible")
              );
              const dataset = layerId.split("-")[0];
              filterOps.push(() =>
                map.current?.setFilter(layerId, [
                  ">=",
                  ["get", "DN"],
                  thresholdValues[dataset],
                ])
              );
            }
          } else {
            const visibility = map.current.getLayoutProperty(
              layerId,
              "visibility"
            );
            if (visibility !== "none") {
              hideOps.push(() =>
                map.current?.setLayoutProperty(layerId, "visibility", "none")
              );
            }
          }
        });

        hideOps.forEach((op) => op());
        showOps.forEach((op) => op());
        filterOps.forEach((op) => op());
      });
    },
    [thresholdValues, contextUpdateVisibleYear]
  );

  // Optimized animation step function using requestAnimationFrame
  const animateStep = useCallback(() => {
    if (yearSequence.current.length <= 1) {
      setAnimating(false);
      return;
    }

    // Get the year dataset map to check which years have data
    const yearDatasetMap = (window as unknown).yearDatasetMap as Record<number, string[]>;
    
    // Find the next valid year with data
    let nextIndex = (currentYearIndexRef.current + 1) % yearSequence.current.length;
    let nextYear = yearSequence.current[nextIndex];
    let attempts = 0;
    const maxAttempts = yearSequence.current.length; // Avoid infinite loop
    
    // Keep incrementing until we find a year with data or we've checked all years
    while (
      (!yearDatasetMap[nextYear] || yearDatasetMap[nextYear].length === 0) && 
      attempts < maxAttempts
    ) {
      console.log(`Year ${nextYear} has no data, skipping...`);
      nextIndex = (nextIndex + 1) % yearSequence.current.length;
      nextYear = yearSequence.current[nextIndex];
      attempts++;
    }
    
    // If we've checked all years and none have data, stop animation
    if (attempts >= maxAttempts) {
      console.warn("No years have data. Stopping animation.");
      setAnimating(false);
      return;
    }
    
    // Update the current index and display the next year
    currentYearIndexRef.current = nextIndex;
    console.log(`Animating to year ${nextYear} (index ${nextIndex})`);
    updateVisibleYear(nextYear);

    if (animating) {
      animationTimerRef.current = setTimeout(() => {
        requestAnimationFrame(animateStep);
      }, animationSpeed.current);
    }
  }, [animating, updateVisibleYear, setAnimating]);

  // Handle animation start/stop with performance optimizations
  useEffect(() => {
    if (animating && yearSequence.current.length > 1) {
      requestAnimationFrame(animateStep);
    } else if (!animating && animationTimerRef.current !== null) {
      clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }

    return () => {
      if (animationTimerRef.current !== null) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
    };
  }, [animating, animateStep]);

  // Toggle animation
  const toggleAnimation = useCallback(() => {
    if (yearSequence.current.length <= 1) {
      setError("Select multiple years to animate");
      return;
    }
    
    // Check how many years have data
    const yearDatasetMap = (window as unknown).yearDatasetMap as Record<number, string[]>;
    const yearsWithData = yearSequence.current.filter(
      year => yearDatasetMap && yearDatasetMap[year] && yearDatasetMap[year].length > 0
    );
    
    if (yearsWithData.length <= 1) {
      setError("Not enough years with data to animate. Please select different years or datasets.");
      return;
    }
    
    // Start from a year with data if current year doesn't have data
    const currentYear = yearSequence.current[currentYearIndexRef.current];
    const currentYearHasData = yearDatasetMap && 
                              yearDatasetMap[currentYear] && 
                              yearDatasetMap[currentYear].length > 0;
    
    if (!currentYearHasData && yearsWithData.length > 0) {
      // Find the index of the first year with data
      const firstYearWithDataIndex = yearSequence.current.findIndex(
        year => yearsWithData.includes(year)
      );
      
      if (firstYearWithDataIndex >= 0) {
        currentYearIndexRef.current = firstYearWithDataIndex;
        updateVisibleYear(yearSequence.current[firstYearWithDataIndex]);
      }
    }
    
    contextToggleAnimation();
  }, [contextToggleAnimation, setError, updateVisibleYear]);

  // Change animation speed
  const changeAnimationSpeed = useCallback(
    (speedMs: number) => {
      contextChangeAnimationSpeed(speedMs);
      if (animating && animationTimerRef.current !== null) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = setTimeout(animateStep, speedMs);
      }
    },
    [animating, animateStep, contextChangeAnimationSpeed]
  );

  // Function to load geospatial data from the backend
  const loadGeoData = async (
    datasets: DatasetType[],
    countries: CountryType[],
    years: number[],
    regions: RegionType[] = []
  ) => {
    if (
      !map.current ||
      !mapIsReady.current ||
      !datasets.length ||
      (!countries.length && !regions.length) ||
      !years.length
    ) {
      console.error("Map not ready or invalid parameters");
      return;
    }

    try {
      setAnimating(false);
      if (animationTimerRef.current !== null) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }

      setIsLoading(true);
      setError(null);

      yearSequence.current = [...years].sort((a, b) => a - b);
      currentYearIndexRef.current = 0;

      datasetCountryCombo.current = [];
      
      // Handle either countries or regions based on what's provided
      if (regions && regions.length > 0) {
        datasets.forEach((dataset) => {
          regions.forEach((region) => {
            datasetCountryCombo.current.push({
              dataset: dataset,
              region: region,
            });
          });
        });
      } else {
        datasets.forEach((dataset) => {
          countries.forEach((country) => {
            datasetCountryCombo.current.push({
              dataset: dataset,
              country: country,
            });
          });
        });
      }

      const geoDataResponse: GeoDataResponse = await fetchGeoData({
        datasets,
        countries,
        regions: regions || [],
        years,
      });

      const layersToKeep = new Set<string>();
      const fetchPromises: Promise<unknown>[] = [];
      const layerPromises: Promise<void>[] = [];
      const yearDatasets: Record<number, string[]> = {};

      for (const year of Object.keys(geoDataResponse).map(Number)) {
        if (!yearDatasets[year]) {
          yearDatasets[year] = [];
        }

        for (const dataset of Object.keys(geoDataResponse[year])) {
          for (const entityKey of Object.keys(geoDataResponse[year][dataset])) {
            // entityKey is either a country or a region name depending on what was requested
            const fileUrl = geoDataResponse[year][dataset][entityKey];
            
            if (fileUrl && !fileUrl.startsWith("Error:")) {
              // Create a layer ID. For regions, include 'region' in the ID to differentiate
              const isRegion = regions && regions.length > 0;
              const layerId = isRegion 
                ? `${dataset}-region-${entityKey}-${year}` 
                : `${dataset}-${entityKey}-${year}`;
              
              layersToKeep.add(layerId);
              // Store with the correct prefix format to match the layer ID structure
              const datasetKey = isRegion ? `${dataset}-region-${entityKey}` : `${dataset}-${entityKey}`;
              yearDatasets[year].push(datasetKey);
              
              if (!cachedGeojsonData.current[fileUrl]) {
                const fetchPromise = (async () => {
                  try {
                    const geojson = await fetchGeoJSON(fileUrl);
                    cachedGeojsonData.current[fileUrl] = geojson;
                    return { fileUrl, geojson };
                  } catch (error) {
                    console.error(
                      `Failed to fetch GeoJSON from ${fileUrl}:`,
                      error
                    );
                    return { fileUrl, error };
                  }
                })();
                fetchPromises.push(fetchPromise);
              }
            }
          }
        }
      }

      await Promise.all(fetchPromises);

      const layersToRemove = activeLayers.current.filter(
        (id) => !layersToKeep.has(id)
      );

      for (const layerId of layersToRemove) {
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current?.getSource(layerId)) {
          map.current.removeSource(layerId);
        }
      }

      activeLayers.current = activeLayers.current.filter(
        (id) => !layersToRemove.includes(id)
      );

      for (const year of Object.keys(geoDataResponse).map(Number)) {
        for (const dataset of Object.keys(geoDataResponse[year])) {
          for (const entityKey of Object.keys(geoDataResponse[year][dataset])) {
            // entityKey is either a country or a region name depending on what was requested
            const fileUrl = geoDataResponse[year][dataset][entityKey];
            
            if (fileUrl && !fileUrl.startsWith("Error:")) {
              // Create a layer ID. For regions, include 'region' in the ID to differentiate
              const isRegion = regions && regions.length > 0;
              const layerId = isRegion 
                ? `${dataset}-region-${entityKey}-${year}` 
                : `${dataset}-${entityKey}-${year}`;
              
              if (map.current?.getLayer(layerId)) {
                continue;
              }

              const layerPromise = (async () => {
                try {
                  const geojson = cachedGeojsonData.current[fileUrl];
                  if (!geojson) {
                    return;
                  }

                  // Analyze data for range values (only once per dataset)
                  // For region data, we want to recalculate the range to get better color differentiation
                  const isRegion = layerId.includes('-region-');
                  const useExistingRange = !isRegion && (
                    datasetRanges.current[dataset].min > 0 ||
                    datasetRanges.current[dataset].max > 0
                  );

                  let minDN = useExistingRange
                    ? datasetRanges.current[dataset].min
                    : Infinity;
                  let maxDN = useExistingRange
                    ? datasetRanges.current[dataset].max
                    : 0;

                  // Always analyze data for regions to get better color differentiation
                  if (
                    (!useExistingRange || isRegion) &&
                    geojson.features &&
                    geojson.features.length > 0
                  ) {
                    // For regions, calculate min/max based only on valid values
                    const validDNValues = geojson.features
                      .map(f => f.properties?.DN)
                      .filter(dn => typeof dn === 'number' && dn > 0);
                    
                    if (validDNValues.length > 0) {
                      minDN = Math.min(...validDNValues);
                      maxDN = Math.max(...validDNValues);
                      
                      // For better color distribution, try to remove outliers
                      if (validDNValues.length > 5) {
                        // Sort values
                        validDNValues.sort((a, b) => a - b);
                        
                        // Calculate Q1 and Q3 (quartiles)
                        const q1Index = Math.floor(validDNValues.length * 0.25);
                        const q3Index = Math.floor(validDNValues.length * 0.75);
                        const q1 = validDNValues[q1Index];
                        const q3 = validDNValues[q3Index];
                        
                        // Calculate IQR and adjust min/max to remove extreme outliers
                        const iqr = q3 - q1;
                        minDN = Math.max(minDN, q1 - iqr * 1.5);
                        maxDN = Math.min(maxDN, q3 + iqr * 1.5);
                      }
                      
                      console.log(`${layerId} calculated range: min=${minDN}, max=${maxDN}`);
                    } else {
                      // Fallback if no valid values
                      if (minDN === Infinity) minDN = 1;
                      if (maxDN === 0) maxDN = 100;
                    }

                    // Store range differently for regions vs countries
                    if (isRegion) {
                      // Just use for this specific layer
                      console.log(`Using region-specific range for ${layerId}: min=${minDN}, max=${maxDN}`);
                    } else {
                      // Store for dataset generally
                      datasetRanges.current[dataset] = {
                        min: minDN,
                        max: maxDN,
                      };
                    }
                  }

                  if (!map.current?.getSource(layerId)) {
                    console.log(`Adding source for ${layerId}, features: ${geojson?.features?.length || 0}`);
                    try {
                      map.current?.addSource(layerId, {
                        type: "geojson",
                        data: geojson as unknown,
                      });
                      console.log(`Successfully added source for ${layerId}`);
                    } catch (err) {
                      console.error(`Error adding source for ${layerId}:`, err);
                    }
                  }

                  if (dataset === "PopDensity") {
                    map.current?.addLayer({
                      id: layerId,
                      type: "fill",
                      source: layerId,
                      maxzoom: 12,
                      paint: {
                        "fill-color": [
                          "case",
                          // Check if DN is not a number or null/undefined
                          ["any", 
                            ["==", ["typeof", ["get", "DN"]], "string"],
                            ["==", ["get", "DN"], null]
                          ],
                          "rgba(0, 0, 0, 0)", // Transparent for N/A values
                          [
                            "interpolate",
                            ["linear"],
                            ["get", "DN"],
                            minDN,
                            "rgba(255, 245, 235, 0.9)",
                            minDN + (maxDN - minDN) * 0.25,
                            "rgba(254, 225, 210, 0.9)",
                            minDN + (maxDN - minDN) * 0.5,
                            "rgba(252, 146, 114, 0.9)",
                            minDN + (maxDN - minDN) * 0.75,
                            "rgba(251, 106, 74, 0.9)",
                            maxDN,
                            "rgba(165, 15, 21, 0.9)",
                          ]
                        ],
                        "fill-outline-color": [
                          "case",
                          ["any", 
                            ["==", ["typeof", ["get", "DN"]], "string"],
                            ["==", ["get", "DN"], null]
                          ],
                          "rgba(0, 0, 0, 0)", // Transparent for N/A values
                          "rgba(0, 0, 0, 0.4)" // Darker outline for valid values
                        ],
                        "fill-opacity": [
                          "case",
                          ["<=", ["get", "DN"], 0], 
                          0, // Make zero or negative values transparent
                          0.9 // Normal opacity for positive values
                        ]
                      },
                      layout: {
                        visibility: "none",
                      },
                      // Enhanced filter for valid values
                      filter: [
                        "all", 
                        ["has", "DN"], // Make sure DN property exists
                        [">=", ["to-number", ["get", "DN"], -1], thresholdValues[dataset]],
                        [">", ["to-number", ["get", "DN"], -1], 0] // Only show positive values
                      ],
                    });
                  } else {
                    map.current?.addLayer({
                      id: layerId,
                      type: "fill",
                      source: layerId,
                      maxzoom: 12,
                      paint: {
                        "fill-color": [
                          "case",
                          // Check if DN is not a number or null/undefined
                          ["any", 
                            ["==", ["typeof", ["get", "DN"]], "string"],
                            ["==", ["get", "DN"], null]
                          ],
                          "rgba(0, 0, 0, 0)", // Transparent for N/A values
                          [
                            "interpolate",
                            ["linear"],
                            ["get", "DN"],
                            minDN,
                            "rgba(240, 249, 255, 0.9)",
                            minDN + (maxDN - minDN) * 0.25,
                            "rgba(204, 236, 255, 0.9)",
                            minDN + (maxDN - minDN) * 0.5,
                            "rgba(102, 194, 255, 0.9)",
                            minDN + (maxDN - minDN) * 0.75,
                            "rgba(50, 136, 189, 0.9)",
                            maxDN,
                            "rgba(8, 48, 107, 0.9)",
                          ]
                        ],
                        "fill-outline-color": [
                          "case",
                          ["any", 
                            ["==", ["typeof", ["get", "DN"]], "string"],
                            ["==", ["get", "DN"], null]
                          ],
                          "rgba(0, 0, 0, 0)", // Transparent for N/A values
                          "rgba(0, 0, 0, 0.4)" // Darker outline for valid values
                        ],
                        "fill-opacity": [
                          "case",
                          ["<=", ["get", "DN"], 0], 
                          0, // Make zero or negative values transparent
                          0.9 // Normal opacity for positive values
                        ]
                      },
                      layout: {
                        visibility: "none",
                      },
                      // Enhanced filter for valid values
                      filter: [
                        "all", 
                        ["has", "DN"], // Make sure DN property exists
                        [">=", ["to-number", ["get", "DN"], -1], thresholdValues[dataset]],
                        [">", ["to-number", ["get", "DN"], -1], 0] // Only show positive values
                      ],
                    });
                  }

                  if (!activeLayers.current.includes(layerId)) {
                    activeLayers.current.push(layerId);
                  }

                  map.current?.once("click", layerId, (e) => {
                    if (!e.features || e.features.length === 0) return;

                    const feature = e.features[0];
                    const dn = feature.properties?.DN;
                    
                    // Format the value with better display
                    let dnDisplay = "N/A";
                    if (typeof dn === 'number') {
                      dnDisplay = dn.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2
                      });
                    }
                    
                    // Determine if this is a region layer
                    const isRegionLayer = layerId.includes('-region-');
                    
                    // Build better content
                    const title = dataset === "PopDensity" ? "Population Density" : dataset;
                    const locationPrefix = isRegionLayer ? "Region" : "Country";
                    const locationDisplay = entityKey.replace(/_/g, " ");
                    const valueLabel = dataset === "PopDensity" ? "Density" : "Value";
                    const units = dataset === "PopDensity" ? "people/km²" : 
                                  dataset === "Precipitation" ? "mm" : "";
                    
                    const content = `<div style="font-size:12px">
                      <strong>${title} (${year})</strong><br/>
                      ${locationPrefix}: ${locationDisplay}<br/>
                      ${valueLabel}: ${dnDisplay} ${units}
                    </div>`;

                    new mapboxgl.Popup({
                      closeButton: false,
                      closeOnClick: true,
                      maxWidth: "200px",
                    })
                      .setLngLat(e.lngLat)
                      .setHTML(content)
                      .addTo(map.current!);
                  });

                  map.current?.once("mouseenter", layerId, () => {
                    map.current!.getCanvas().style.cursor = "pointer";
                  });
                } catch (error) {
                  console.error(
                    `Error loading GeoJSON for ${dataset} ${entityKey} ${year}:`,
                    error
                  );
                }
              })();
              layerPromises.push(layerPromise);
            }
          }
        }
      }

      await Promise.all(layerPromises);

      // Create a more accurate dataset map that tracks which years actually have valid geojson data
      const yearsWithValidData: Record<number, string[]> = {};
      
      for (const year of Object.keys(yearDatasets).map(Number)) {
        // Only include years where we successfully loaded geojson data
        const validDatasets = yearDatasets[year].filter(datasetKey => {
          // For each dataset-entity combination, check if we have any geojson features
          // Find the corresponding file URL
          const datasetEntityParts = datasetKey.split('-');
          const dataset = datasetEntityParts[0];
          let entityKey: string;
          
          // Handle region vs country format
          if (datasetKey.includes('-region-')) {
            // For region: dataset-region-regionname
            entityKey = datasetEntityParts.slice(2).join('-');
          } else {
            // For country: dataset-countryname
            entityKey = datasetEntityParts.slice(1).join('-');
          }
          
          // Look up the file URL
          const fileUrl = geoDataResponse[year][dataset]?.[entityKey];
          
          if (!fileUrl || fileUrl.startsWith("Error:")) {
            console.log(`No valid file URL for ${datasetKey} in year ${year}`);
            return false;
          }
          
          // Check if we have valid geojson data for this URL
          const geojson = cachedGeojsonData.current[fileUrl];
          
          if (!geojson || !geojson.features || geojson.features.length === 0) {
            console.log(`No valid GeoJSON features for ${datasetKey} in year ${year}`);
            return false;
          }
          
          // Check if the geojson has any valid DN values
          const hasValidDNValues = geojson.features.some(f => 
            typeof f.properties?.DN === 'number' && f.properties.DN > 0
          );
          
          if (!hasValidDNValues) {
            console.log(`No valid DN values for ${datasetKey} in year ${year}`);
            return false;
          }
          
          return true;
        });
        
        if (validDatasets.length > 0) {
          yearsWithValidData[year] = validDatasets;
        }
      }
      
      // Store and log the refined year dataset map for debugging
      (window as unknown).yearDatasetMap = yearsWithValidData;
      console.log('Refined year dataset map with valid data only:', yearsWithValidData);

      if (activeLayers.current.length === 0) {
        setError("No valid data found for the selected filters");
      } else {
        if (yearSequence.current.length > 0) {
          // Find the first year that has valid data
          const yearDatasetMap = (window as unknown).yearDatasetMap as Record<number, string[]>;
          const yearsWithData = yearSequence.current.filter(
            year => yearDatasetMap && yearDatasetMap[year] && yearDatasetMap[year].length > 0
          );
          
          if (yearsWithData.length > 0) {
            const firstValidYear = yearsWithData[0];
            const firstValidYearIndex = yearSequence.current.indexOf(firstValidYear);
            currentYearIndexRef.current = firstValidYearIndex;
            
            console.log(`Setting initial year to ${firstValidYear} (index ${firstValidYearIndex}). Active layers:`, activeLayers.current);
            updateVisibleYear(firstValidYear);
          } else {
            // Fallback to first year even if it has no data
            const firstYear = yearSequence.current[0];
            console.log(`No years have valid data. Defaulting to ${firstYear}.`);
            updateVisibleYear(firstYear);
          }
        }
      }
    } catch (error) {
      console.error("Error loading geospatial data:", error);
      setError("Failed to load geospatial data");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle filter changes from DataControls
  const handleApplyFilters = (filters: {
    datasets: DatasetType[];
    countries: CountryType[];
    regions: RegionType[];
    years: number[];
    thresholds?: {
      [dataset: string]: number;
    };
  }) => {
    if (filters.thresholds) {
      handleThresholdChange(
        Object.keys(filters.thresholds)[0],
        Object.values(filters.thresholds)[0]
      );
    }

    loadGeoData(filters.datasets, filters.countries, filters.years, filters.regions);
  };

  return (
    <div className="relative w-full h-screen" style={{ minHeight: "100vh" }}>
      {/* Map container */}
      <div
        ref={mapContainer}
        className="absolute inset-0"
        style={{
          width: "100%",
          height: "100%",
        }}
      />

      {/* 3D Mode Toggle */}
      <div className="absolute top-4 right-4 z-30">
        <button
          onClick={toggle3DMode}
          className="bg-blue-500 text-white px-3 py-2 rounded-md shadow-lg flex items-center space-x-2 text-sm font-medium hover:bg-blue-600 transition-colors duration-200"
        >
          <span>{is3DMode ? "2D Mode" : "3D Mode"}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Data controls with collapse/expand functionality */}
      <div
        className={`absolute top-4 left-0 z-20 transition-all duration-300 transform shadow-xl ${
          dataControlsExpanded
            ? "translate-x-0"
            : "-translate-x-[calc(100%-40px)]"
        }`}
      >
        <button
          onClick={() => setDataControlsExpanded(!dataControlsExpanded)}
          className="absolute right-2 top-2 bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center z-30 shadow-md hover:bg-blue-600 transition-colors duration-200"
        >
          {dataControlsExpanded ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
        <div className="rounded-r-lg overflow-hidden bg-white shadow-lg">
          <DataControls
            onApplyFilters={handleApplyFilters}
            datasetRanges={datasetRanges.current}
            thresholdValues={thresholdValues}
            onThresholdChange={handleThresholdChange}
            activeDatasets={datasetCountryCombo.current
              .map(item => item.dataset)
              .filter((v, i, a) => a.indexOf(v) === i) as DatasetType[]}
            activeCountries={datasetCountryCombo.current
              .map(item => item.country)
              .filter((v, i, a) => a.indexOf(v) === i) as CountryType[]}
            activeYears={yearSequence.current}
          />
        </div>
      </div>

      {/* Legend */}
      {displayYear && (
        <div className="absolute top-16 right-4 bg-white p-3 rounded-lg shadow-lg z-20">
          <h3 className="text-sm font-bold mb-2 text-gray-800">Legend</h3>
          {datasetCountryCombo.current.some(
            ({ dataset }) => dataset === "PopDensity"
          ) && (
            <div className="mb-2">
              <div className="flex justify-between items-center">
                <div className="text-xs font-semibold text-gray-700">Population Density</div>
                {thresholdValues.PopDensity > 0 && (
                  <div className="text-xs text-gray-600">
                    (min: {thresholdValues.PopDensity})
                  </div>
                )}
              </div>
              <div className="flex items-center">
                <div className="w-full h-4 bg-gradient-to-r from-[rgb(255,245,235)] to-[rgb(165,15,21)] rounded-sm"></div>
                <div className="flex justify-between w-full px-1 text-xs mt-1 text-gray-600">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            </div>
          )}
          {datasetCountryCombo.current.some(
            ({ dataset }) => dataset === "Precipitation"
          ) && (
            <div>
              <div className="flex justify-between items-center">
                <div className="text-xs font-semibold text-gray-700">Precipitation</div>
                {thresholdValues.Precipitation > 0 && (
                  <div className="text-xs text-gray-600">
                    (min: {thresholdValues.Precipitation})
                  </div>
                )}
              </div>
              <div className="flex items-center">
                <div className="w-full h-4 bg-gradient-to-r from-[rgb(240,249,255)] to-[rgb(8,48,107)] rounded-sm"></div>
                <div className="flex justify-between w-full px-1 text-xs mt-1 text-gray-600">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Year slider */}
      {yearSequence.current.length > 1 && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-white p-3 rounded-lg shadow-lg z-20 w-[80%] max-w-xl">
          <div className="flex justify-between mb-1">
            <span className="text-xs text-gray-600">{Math.min(...yearSequence.current)}</span>
            <span className="text-sm font-semibold text-gray-800">Year Timeline</span>
            <span className="text-xs text-gray-600">{Math.max(...yearSequence.current)}</span>
          </div>
          
          {/* Warning about missing years */}
          {(() => {
            const yearDatasetMap = (window as unknown).yearDatasetMap as Record<number, string[]>;
            const yearsWithData = yearSequence.current.filter(
              year => yearDatasetMap && yearDatasetMap[year] && yearDatasetMap[year].length > 0
            );
            
            if (yearsWithData.length < yearSequence.current.length) {
              const missingCount = yearSequence.current.length - yearsWithData.length;
              const missingYears = yearSequence.current.filter(
                year => !yearDatasetMap || !yearDatasetMap[year] || yearDatasetMap[year].length === 0
              ).join(', ');
              
              return (
                <div className="mb-2 text-xs bg-yellow-50 p-1.5 rounded border border-yellow-200 text-yellow-700">
                  <strong>Note:</strong> {missingCount} year{missingCount > 1 ? 's' : ''} without data ({missingYears}) will be skipped during animation.
                </div>
              );
            }
            return null;
          })()}
          <input
            type="range"
            min={0}
            max={yearSequence.current.length - 1}
            value={currentYearIndexRef.current}
            onChange={(e) => {
              const index = parseInt(e.target.value);
              // Get the year for this index
              const year = yearSequence.current[index];
              // Check if this year has data
              const yearDatasetMap = (window as unknown).yearDatasetMap as Record<number, string[]>;
              const hasData = yearDatasetMap && yearDatasetMap[year] && yearDatasetMap[year].length > 0;
              
              if (hasData) {
                handleYearSelection(index);
              } else {
                // Find closest year with data
                console.log(`Year ${year} has no data, finding closest year with data...`);
                
                // Check which years have data
                const yearsWithDataIndices = yearSequence.current.map((yr, idx) => {
                  return {
                    year: yr,
                    index: idx,
                    hasData: yearDatasetMap && yearDatasetMap[yr] && yearDatasetMap[yr].length > 0
                  };
                }).filter(item => item.hasData);
                
                if (yearsWithDataIndices.length > 0) {
                  // Find the closest year with data (by index distance)
                  let closestIndex = yearsWithDataIndices[0].index;
                  let minDistance = Math.abs(index - closestIndex);
                  
                  yearsWithDataIndices.forEach(item => {
                    const distance = Math.abs(index - item.index);
                    if (distance < minDistance) {
                      minDistance = distance;
                      closestIndex = item.index;
                    }
                  });
                  
                  console.log(`Found closest year with data: ${yearSequence.current[closestIndex]}`);
                  handleYearSelection(closestIndex);
                }
              }
            }}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between mt-1">
            {yearSequence.current.map((year, index) => {
              // Check if this year has data
              const yearDatasetMap = (window as unknown).yearDatasetMap as Record<number, string[]>;
              const hasData = yearDatasetMap && yearDatasetMap[year] && yearDatasetMap[year].length > 0;
              
              return (
                <button
                  key={year}
                  onClick={() => handleYearSelection(index)}
                  className={`text-xs px-1 py-0.5 rounded transition-colors duration-200 ${
                    currentYearIndexRef.current === index
                      ? "bg-blue-500 text-white font-bold"
                      : hasData
                        ? "bg-gray-100 hover:bg-gray-200 text-gray-700" 
                        : "bg-gray-100 text-gray-400 opacity-50 cursor-not-allowed"
                  }`}
                  title={hasData ? `Show data for ${year}` : `No data available for ${year}`}
                  disabled={!hasData}
                >
                  {year}
                  {!hasData && (
                    <span className="ml-1 text-xs">✗</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Animation controls */}
      {yearSequence.current.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-3 rounded-lg shadow-lg z-20 flex items-center space-x-4">
          <button
            onClick={toggleAnimation}
            className={`px-4 py-2 rounded-md font-medium transition-colors duration-200 ${
              animating ? "bg-red-500 hover:bg-red-600 text-white" : "bg-green-500 hover:bg-green-600 text-white"
            }`}
          >
            {animating ? "Pause" : "Play"}
          </button>

          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Speed:</span>
            <button
              onClick={() => changeAnimationSpeed(4000)}
              className={`px-2 py-1 rounded-md text-xs transition-colors duration-200 ${
                animationSpeed.current === 4000
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Slow
            </button>
            <button
              onClick={() => changeAnimationSpeed(2000)}
              className={`px-2 py-1 rounded-md text-xs transition-colors duration-200 ${
                animationSpeed.current === 2000
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Medium
            </button>
            <button
              onClick={() => changeAnimationSpeed(1000)}
              className={`px-2 py-1 rounded-md text-xs transition-colors duration-200 ${
                animationSpeed.current === 1000
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Fast
            </button>
          </div>

          {displayYear && (
            <div className="text-lg font-bold text-gray-800">Year: {displayYear}</div>
          )}
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-36 right-4 bg-white p-3 rounded-lg shadow-lg z-20">
          <div className="flex items-center">
            <svg
              className="animate-spin h-5 w-5 mr-2 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="text-gray-700">Loading data...</span>
          </div>
        </div>
      )}

      {/* Debug information */}
      <div className="absolute bottom-24 right-4 bg-white p-2 rounded-lg shadow-lg z-20 text-xs">
        <div className="text-gray-700">Layers: {activeLayers.current.length}</div>
        <div className="text-gray-700">Active year: {displayYear}</div>
        <div className="text-gray-700">Years: {yearSequence.current.join(", ")}</div>
        <div className="text-gray-700">Animation: {animating ? "On" : "Off"}</div>
        <div className="text-gray-700">Mode: {datasetCountryCombo.current.some(item => item.region) ? 'Region' : 'Country'}</div>
        <details>
          <summary className="text-gray-700 cursor-pointer">Active layers</summary>
          <div className="text-gray-700 max-h-40 overflow-y-auto text-xs">
            {activeLayers.current.slice(0, 5).map((layer, i) => (
              <div key={i}>{layer}</div>
            ))}
            {activeLayers.current.length > 5 && <div>...and {activeLayers.current.length - 5} more</div>}
          </div>
        </details>
      </div>

      {/* Error message */}
      {error && (
        <div className="absolute top-36 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg z-20">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}
    </div>
  );
}