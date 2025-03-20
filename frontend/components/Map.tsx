"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchGeoData, fetchGeoJSON } from "@/lib/api";
import { DatasetType, CountryType, GeoDataResponse } from "@/lib/types";
import DataControls from "./DataControls";

export default function Map() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [is3DMode, setIs3DMode] = useState<boolean>(false); // Toggle for 2D/3D mode
  const [dataControlsExpanded, setDataControlsExpanded] =
    useState<boolean>(true); // Control panel expansion state

  // Animation state
  const [animating, setAnimating] = useState<boolean>(false);
  const [displayYear, setDisplayYear] = useState<number | null>(null);
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationSpeed = useRef<number>(2000); // 2 seconds per year by default

  // Data management
  const cachedGeojsonData = useRef<{ [key: string]: any }>({});
  const yearSequence = useRef<number[]>([]);
  const currentYearIndexRef = useRef<number>(0);
  const datasetCountryCombo = useRef<{ dataset: string; country: string }[]>(
    []
  );
  const activeLayers = useRef<string[]>([]);
  const mapIsReady = useRef<boolean>(false);

  // Data filters
  const [thresholdValues, setThresholdValues] = useState<{
    [dataset: string]: number;
  }>({
    PopDensity: 0,
    Precipitation: 0,
  });

  // Range information for datasets
  const datasetRanges = useRef<{
    [dataset: string]: { min: number; max: number };
  }>({
    PopDensity: { min: 0, max: 100 },
    Precipitation: { min: 0, max: 1000 },
  });

  // Handle toggling between 2D and 3D mode
  const toggle3DMode = useCallback(() => {
    setIs3DMode((prev) => !prev);

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
          maxZoom: 10,
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
            loadGeoData(
              datasetCountryCombo.current
                .map((item) => item.dataset)
                .filter((v, i, a) => a.indexOf(v) === i) as DatasetType[],
              datasetCountryCombo.current
                .map((item) => item.country)
                .filter((v, i, a) => a.indexOf(v) === i) as CountryType[],
              yearSequence.current
            );
          }
        });

        mapInstance.addControl(new mapboxgl.NavigationControl());
        mapInstance.scrollZoom.enable();
      }, 100);
    }
  }, [is3DMode]);

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
  }, [is3DMode]);

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
      setDisplayYear(yearToShow);

      requestAnimationFrame(() => {
        // Get the year datasets we want to show
        const yearDatasetMap = (window as unknown).yearDatasetMap as Record<
          number,
          string[]
        >;
        const datasetsToShow = yearDatasetMap?.[yearToShow] || [];

        // Batch operations to minimize render cycles
        const hideOps: (() => void)[] = [];
        const showOps: (() => void)[] = [];
        const filterOps: (() => void)[] = [];

        // Process all active layers
        activeLayers.current.forEach((layerId) => {
          // Extract year from layerId (format: dataset-country-year)
          const parts = layerId.split("-");
          const layerYear =
            parts.length > 2 ? parseInt(parts[parts.length - 1]) : -1;

          if (!map.current?.getLayer(layerId)) return;

          if (layerYear === yearToShow) {
            const visibility = map.current.getLayoutProperty(
              layerId,
              "visibility"
            );
            const datasetCountryKey = parts
              .slice(0, parts.length - 1)
              .join("-");
            const shouldBeVisible = datasetsToShow.includes(datasetCountryKey);

            if (visibility === "none" && shouldBeVisible) {
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
    [thresholdValues]
  );

  // Optimized animation step function using requestAnimationFrame
  const animateStep = useCallback(() => {
    if (yearSequence.current.length <= 1) {
      setAnimating(false);
      return;
    }

    const nextIndex =
      (currentYearIndexRef.current + 1) % yearSequence.current.length;
    currentYearIndexRef.current = nextIndex;
    const nextYear = yearSequence.current[nextIndex];

    updateVisibleYear(nextYear);

    if (animating) {
      animationTimerRef.current = setTimeout(() => {
        requestAnimationFrame(animateStep);
      }, animationSpeed.current);
    }
  }, [animating, updateVisibleYear]);

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
    setAnimating((prev) => !prev);
  }, []);

  // Change animation speed
  const changeAnimationSpeed = useCallback(
    (speedMs: number) => {
      animationSpeed.current = speedMs;
      if (animating && animationTimerRef.current !== null) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = setTimeout(animateStep, speedMs);
      }
    },
    [animating, animateStep]
  );

  // Change threshold value for a dataset
  const handleThresholdChange = useCallback(
    (dataset: string, value: number) => {
      setThresholdValues((prev) => ({
        ...prev,
        [dataset]: value,
      }));
    },
    []
  );

  // Function to load geospatial data from the backend
  const loadGeoData = async (
    datasets: DatasetType[],
    countries: CountryType[],
    years: number[]
  ) => {
    if (
      !map.current ||
      !mapIsReady.current ||
      !datasets.length ||
      !countries.length ||
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
      datasets.forEach((dataset) => {
        countries.forEach((country) => {
          datasetCountryCombo.current.push({
            dataset: dataset,
            country: country,
          });
        });
      });

      const geoDataResponse: GeoDataResponse = await fetchGeoData({
        datasets,
        countries,
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
          for (const country of Object.keys(geoDataResponse[year][dataset])) {
            const fileUrl = geoDataResponse[year][dataset][country];
            if (fileUrl && !fileUrl.startsWith("Error:")) {
              const layerId = `${dataset}-${country}-${year}`;
              layersToKeep.add(layerId);
              yearDatasets[year].push(`${dataset}-${country}`);
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
          for (const country of Object.keys(geoDataResponse[year][dataset])) {
            const fileUrl = geoDataResponse[year][dataset][country];
            if (fileUrl && !fileUrl.startsWith("Error:")) {
              const layerId = `${dataset}-${country}-${year}`;
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
                  const useExistingRange =
                    datasetRanges.current[dataset].min > 0 ||
                    datasetRanges.current[dataset].max > 0;

                  let minDN = useExistingRange
                    ? datasetRanges.current[dataset].min
                    : Infinity;
                  let maxDN = useExistingRange
                    ? datasetRanges.current[dataset].max
                    : 0;

                  if (
                    !useExistingRange &&
                    geojson.features &&
                    geojson.features.length > 0
                  ) {
                    for (let i = 0; i < geojson.features.length; i++) {
                      const feature = geojson.features[i];
                      const dn = feature.properties?.DN;
                      if (dn && dn > 0) {
                        minDN = Math.min(minDN, dn);
                        maxDN = Math.max(maxDN, dn);
                      }
                    }

                    if (minDN === Infinity) minDN = 1;
                    if (maxDN === 0) maxDN = 100;

                    datasetRanges.current[dataset] = {
                      min: minDN,
                      max: maxDN,
                    };
                  }

                  if (!map.current?.getSource(layerId)) {
                    map.current?.addSource(layerId, {
                      type: "geojson",
                      data: geojson as unknown,
                    });
                  }

                  if (dataset === "PopDensity") {
                    map.current?.addLayer({
                      id: layerId,
                      type: "fill",
                      source: layerId,
                      maxzoom: 12,
                      paint: {
                        "fill-color": [
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
                        ],
                        "fill-outline-color": "rgba(0, 0, 0, 0.1)",
                      },
                      layout: {
                        visibility: "none",
                      },
                      filter: [">=", ["get", "DN"], thresholdValues[dataset]],
                    });
                  } else {
                    map.current?.addLayer({
                      id: layerId,
                      type: "fill",
                      source: layerId,
                      maxzoom: 12,
                      paint: {
                        "fill-color": [
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
                        ],
                        "fill-outline-color": "rgba(0, 0, 0, 0.1)",
                      },
                      layout: {
                        visibility: "none",
                      },
                      filter: [">=", ["get", "DN"], thresholdValues[dataset]],
                    });
                  }

                  if (!activeLayers.current.includes(layerId)) {
                    activeLayers.current.push(layerId);
                  }

                  map.current?.once("click", layerId, (e) => {
                    if (!e.features || e.features.length === 0) return;

                    const feature = e.features[0];
                    const dn = feature.properties?.DN || "N/A";

                    const content = `<div style="font-size:12px">
                      <strong>${dataset} (${year})</strong><br/>
                      Country: ${country.replace("_", " ")}<br/>
                      Value: ${dn}
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
                    `Error loading GeoJSON for ${dataset} ${country} ${year}:`,
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

      (window as unknown).yearDatasetMap = yearDatasets;

      if (activeLayers.current.length === 0) {
        setError("No valid data found for the selected filters");
      } else {
        if (yearSequence.current.length > 0) {
          const firstYear = yearSequence.current[0];
          updateVisibleYear(firstYear);
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
    years: number[];
    thresholds?: {
      [dataset: string]: number;
    };
  }) => {
    if (filters.thresholds) {
      setThresholdValues(filters.thresholds);
    }

    loadGeoData(filters.datasets, filters.countries, filters.years);
  };

  // Handle year selection via the slider
  const handleYearSelection = (index: number) => {
    if (animating) {
      setAnimating(false);
    }
    currentYearIndexRef.current = index;
    updateVisibleYear(yearSequence.current[index]);
  };

  return (
    <div className="relative w-full h-screen" style={{ minHeight: "100vh" }}>
      {/* Map container */}
      <div
        ref={mapContainer}
        className="absolute inset-0"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
        }}
      />

      {/* 3D Mode Toggle */}
      <div className="absolute top-4 right-4 z-30">
        <button
          onClick={toggle3DMode}
          className="bg-white text-gray-800 px-3 py-2 rounded-md shadow-lg flex items-center space-x-2 text-sm font-medium hover:bg-gray-100"
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
        className={`absolute top-4 left-0 z-20 transition-all duration-300 transform ${
          dataControlsExpanded
            ? "translate-x-0"
            : "-translate-x-[calc(100%-40px)]"
        }`}
      >
        <button
          onClick={() => setDataControlsExpanded(!dataControlsExpanded)}
          className="absolute right-2 top-2 bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center z-30 shadow-md"
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
        <div className="bg-white p-4 rounded-r-lg shadow-lg">
          <DataControls
            onApplyFilters={handleApplyFilters}
            datasetRanges={datasetRanges.current}
            thresholdValues={thresholdValues}
            onThresholdChange={handleThresholdChange}
          />
        </div>
      </div>

      {/* Legend */}
      {displayYear && (
        <div className="absolute top-16 right-4 bg-white p-3 rounded-lg shadow-lg z-20">
          <h3 className="text-sm font-bold mb-2">Legend</h3>
          {datasetCountryCombo.current.some(
            ({ dataset }) => dataset === "PopDensity"
          ) && (
            <div className="mb-2">
              <div className="flex justify-between items-center">
                <div className="text-xs font-semibold">Population Density</div>
                {thresholdValues.PopDensity > 0 && (
                  <div className="text-xs">
                    (min: {thresholdValues.PopDensity})
                  </div>
                )}
              </div>
              <div className="flex items-center">
                <div className="w-full h-4 bg-gradient-to-r from-[rgb(255,245,235)] to-[rgb(165,15,21)] rounded-sm"></div>
                <div className="flex justify-between w-full px-1 text-xs mt-1">
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
                <div className="text-xs font-semibold">Precipitation</div>
                {thresholdValues.Precipitation > 0 && (
                  <div className="text-xs">
                    (min: {thresholdValues.Precipitation})
                  </div>
                )}
              </div>
              <div className="flex items-center">
                <div className="w-full h-4 bg-gradient-to-r from-[rgb(240,249,255)] to-[rgb(8,48,107)] rounded-sm"></div>
                <div className="flex justify-between w-full px-1 text-xs mt-1">
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
            <span className="text-xs">{Math.min(...yearSequence.current)}</span>
            <span className="text-sm font-semibold">Year Timeline</span>
            <span className="text-xs">{Math.max(...yearSequence.current)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={yearSequence.current.length - 1}
            value={currentYearIndexRef.current}
            onChange={(e) => handleYearSelection(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between mt-1">
            {yearSequence.current.map((year, index) => (
              <button
                key={year}
                onClick={() => handleYearSelection(index)}
                className={`text-xs px-1 py-0.5 rounded ${
                  currentYearIndexRef.current === index
                    ? "bg-blue-500 text-white font-bold"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Animation controls */}
      {yearSequence.current.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-3 rounded-lg shadow-lg z-20 flex items-center space-x-4">
          <button
            onClick={toggleAnimation}
            className={`px-4 py-2 rounded-md font-medium ${
              animating ? "bg-red-500 text-white" : "bg-green-500 text-white"
            }`}
          >
            {animating ? "Pause" : "Play"}
          </button>

          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Speed:</span>
            <button
              onClick={() => changeAnimationSpeed(4000)}
              className={`px-2 py-1 rounded-md text-xs ${
                animationSpeed.current === 4000
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200"
              }`}
            >
              Slow
            </button>
            <button
              onClick={() => changeAnimationSpeed(2000)}
              className={`px-2 py-1 rounded-md text-xs ${
                animationSpeed.current === 2000
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200"
              }`}
            >
              Medium
            </button>
            <button
              onClick={() => changeAnimationSpeed(1000)}
              className={`px-2 py-1 rounded-md text-xs ${
                animationSpeed.current === 1000
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200"
              }`}
            >
              Fast
            </button>
          </div>

          {displayYear && (
            <div className="text-lg font-bold">Year: {displayYear}</div>
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
            <span>Loading data...</span>
          </div>
        </div>
      )}

      {/* Debug information */}
      <div className="absolute top-4 left-4 bg-white p-2 rounded-lg shadow-lg z-20 text-xs">
        <div>Layers: {activeLayers.current.length}</div>
        <div>Active year: {displayYear}</div>
        <div>Years: {yearSequence.current.join(", ")}</div>
        <div>Animation: {animating ? "On" : "Off"}</div>
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
