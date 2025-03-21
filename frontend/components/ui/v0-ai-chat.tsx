"use client";

import { useEffect, useRef, useCallback } from "react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
    ArrowUpIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from "lucide-react";
import { useMapContext } from "@/lib/MapContext";
import { DatasetType, CountryType } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Define message types
type MessageType = "human" | "ai" | "instruction" | "media";

// Define media content interface
interface MediaContent {
    type: string;
    data?: string;     // Base64 data (optional)
    url?: string;      // URL for fetching media (optional)
    iframe_url?: string; // URL for iframe display (optional)
    alt_text: string;
    title?: string;
    metadata?: Record<string, unknown>;
}

// Define message interface
interface Message {
    id: string;
    type: MessageType;
    content: string;
    timestamp: Date;
    // For instructions, we'll need additional data
    instructionData?: {
        action: string;
        data: Record<string, unknown>;
    };
    // For media messages
    media?: MediaContent;
}

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            if (reset) {
                textarea.style.height = `${minHeight}px`;
                return;
            }

            // Temporarily shrink to get the right scrollHeight
            textarea.style.height = `${minHeight}px`;

            // Calculate new height
            const newHeight = Math.max(
                minHeight,
                Math.min(
                    textarea.scrollHeight,
                    maxHeight ?? Number.POSITIVE_INFINITY
                )
            );

            textarea.style.height = `${newHeight}px`;
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        // Set initial height
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = `${minHeight}px`;
        }
    }, [minHeight]);

    // Adjust height on window resize
    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

export function VercelV0Chat() {
    const [value, setValue] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isChatExpanded, setIsChatExpanded] = useState<boolean>(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 60,
        maxHeight: 200,
    });
    
    // Access the map context
    const mapContext = useMapContext();

    const generateMessageId = () => {
        return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    };

    // Scroll to bottom of messages
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);
    
    // Function to add a timeline link to the chat
    const addTimelineLinkToChat = useCallback((
        country: string = "Mali", 
        dataset: string = "PopDensity", 
        startYear: number = 2015, 
        endYear: number = 2020
    ) => {
        // Create a unique timestamp for cache busting
        const timestamp = new Date().getTime();
        
        // Create a properly parameterized URL for the timeline view
        const titleParam = encodeURIComponent(`${dataset} in ${country} (${startYear}-${endYear})`);
        const timelineUrl = `http://localhost:8000/timeline-view?title=${titleParam}&country=${country}&dataset=${dataset}&start=${startYear}&end=${endYear}&t=${timestamp}`;
        
        console.log(`Generated timeline URL: ${timelineUrl}`);
        
        // Create a message with the timeline link
        const linkMsg: Message = {
            id: generateMessageId(),
            type: "ai",
            content: `I've created a timeline of ${dataset === 'PopDensity' ? 'population density' : 'precipitation'} in ${country.replace('_', ' ')} from ${startYear} to ${endYear}.\n\n**[Click here to view the timeline animation](${timelineUrl})**\n\nThe animation will open in a new window showing the changes over time.`,
            timestamp: new Date()
        };
        
        // Add the message to the chat
        setMessages(prev => [...prev, linkMsg]);
        
        console.log("Timeline link added to chat");
    }, []);

    const handleSendMessage = async () => {
        if (!value.trim()) return;

        const userMessage: Message = {
            id: generateMessageId(),
            type: "human",
            content: value,
            timestamp: new Date(),
        };

        // Add user message to chat
        setMessages((prev) => [...prev, userMessage]);
        
        // Check if the message contains keywords related to timeline or animation
        const userInput = value.toLowerCase();
        const timelineKeywords = ['timeline', 'animation', 'gif', 'animate', 'time series', 'changes over time'];
        const containsTimelineRequest = timelineKeywords.some(keyword => userInput.includes(keyword));
        
        // If user is asking for a timeline, extract parameters and add the GIF directly
        if (containsTimelineRequest) {
            // Extract parameters from the user's request
            let country = "Mali";  // Default
            let dataset = "PopDensity";  // Default
            let startYear = 2015;  // Default
            let endYear = 2020;    // Default
            
            // Check for country
            const countries = ["Mali", "Chad", "Niger", "Burkina_Faso", "Mauritania", "Senegal", "Sudan"];
            for (const c of countries) {
                if (userInput.includes(c.toLowerCase().replace("_", " "))) {
                    country = c;
                    break;
                }
            }
            
            // Check for dataset
            if (userInput.includes("precipitation") || userInput.includes("rainfall")) {
                dataset = "Precipitation";
            } else if (userInput.includes("population") || userInput.includes("density")) {
                dataset = "PopDensity";
            }
            
            // Try to extract years
            const yearPattern = /\b20[0-2][0-9]\b/g;
            const yearMatches = userInput.match(yearPattern);
            
            if (yearMatches && yearMatches.length >= 2) {
                // If we have at least 2 years, use the first and last as range
                const years = yearMatches.map(y => parseInt(y)).sort();
                startYear = years[0];
                endYear = years[years.length - 1];
            } else if (yearMatches && yearMatches.length === 1) {
                // If only one year, center a 3-year range around it
                const year = parseInt(yearMatches[0]);
                startYear = Math.max(2010, year - 1);
                endYear = Math.min(2020, year + 1);
            }
            
            // Wait a moment to make it seem like the system is processing
            setTimeout(() => {
                addTimelineLinkToChat(country, dataset, startYear, endYear);
            }, 1500);
        }
        
        // Clear input and reset height
        setValue("");
        adjustHeight(true);
        
        setIsLoading(true);

        try {
            // Format messages for the API
            const formattedMessages = messages
                .filter(msg => msg.type === "human" || msg.type === "ai")
                .map(msg => ({
                    sender: msg.type === "human" ? "human" : "ai",
                    content: msg.content
                }));

            // Add the new message
            formattedMessages.push({
                sender: "human",
                content: value
            });
            
            // Add map context to the request
            const mapState = {
                is3DMode: mapContext.is3DMode,
                displayYear: mapContext.displayYear,
                yearSequence: mapContext.yearSequence.current,
                activeDatasets: mapContext.datasetCountryCombo.current,
                thresholdValues: mapContext.thresholdValues,
                datasetRanges: mapContext.datasetRanges.current,
                animating: mapContext.animating
            };

            // Call the streaming API
            const response = await fetch("http://localhost:8000/chat/stream", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messages: formattedMessages,
                    mapState: mapState
                }),
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            // Process the streaming response
            const reader = response.body?.getReader();
            if (!reader) throw new Error("Failed to get reader from response");

            // Create a new message for the AI response
            const aiMessageId = generateMessageId();
            setMessages(prev => [...prev, {
                id: aiMessageId,
                type: "ai",
                content: "",
                timestamp: new Date()
            }]);

            // Read and process the stream
            let accumulatedContent = "";
            
            // Check for instruction marker used by the backend
            const instructionMarker = "INSTRUCTION:";
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Decode the chunk
                const chunk = new TextDecoder().decode(value);
                
                // Check if this chunk contains an instruction
                if (chunk.includes(instructionMarker)) {
                    console.log("Found instruction marker in chunk:", chunk);
                    
                    // Split the chunk at the instruction marker
                    const parts = chunk.split(instructionMarker);
                    console.log("Split parts length:", parts.length);
                    
                    // Add the first part (before instruction) to content
                    if (parts[0].trim()) {
                        accumulatedContent += parts[0];
                        
                        // Update the AI message with the accumulated content
                        setMessages(prev => 
                            prev.map(msg => 
                                msg.id === aiMessageId 
                                ? { ...msg, content: accumulatedContent } 
                                : msg
                            )
                        );
                    }
                    
                    // Process each instruction (there might be multiple parts after splitting)
                    for (let i = 1; i < parts.length; i++) {
                        const instructionPart = parts[i].trim();
                        if (instructionPart) {
                            try {
                                // Log the raw instruction data for debugging
                                console.log(`Processing instruction part ${i}:`, instructionPart);
                                
                                console.log("About to parse JSON instruction:", instructionPart);
                                
                                // Process the instruction JSON
                                const instructionResult = processInstruction(instructionPart);
                                
                                // If processInstruction returned an empty string, don't add an instruction message
                                // This happens when processInstruction has already added a message (e.g. for media)
                                if (instructionResult) {
                                    // Add the instruction result as a separate system message
                                    const instructionMessage = {
                                        id: generateMessageId(),
                                        type: "instruction",
                                        content: instructionResult,
                                        timestamp: new Date(),
                                        instructionData: { action: "processed", data: { instruction: instructionPart } }
                                    };
                                    
                                    console.log("Adding instruction message:", instructionMessage);
                                    setMessages(prev => [...prev, instructionMessage]);
                                } else {
                                    console.log("No instruction message added (empty result)");
                                }
                            } catch (error) {
                                console.error(`Error processing instruction part ${i}:`, error, "Raw data:", instructionPart);
                            }
                        }
                    }
                } else {
                    // Regular chunk with no instruction
                    accumulatedContent += chunk;
                    
                    // Update the AI message with the accumulated content
                    setMessages(prev => 
                        prev.map(msg => 
                            msg.id === aiMessageId 
                            ? { ...msg, content: accumulatedContent } 
                            : msg
                        )
                    );
                }
            }
        } catch (error) {
            console.error("Error sending message:", error);
            
            // Add an error message
            setMessages(prev => [...prev, {
                id: generateMessageId(),
                type: "ai",
                content: "Sorry, there was an error processing your request.",
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) {
                handleSendMessage();
            }
        }
    };

    // Function to process instructions from AI
    const processInstruction = useCallback((instructionJson: string) => {
        try {
            // Check if we're dealing with unparsed JSON or a string
            let instructionData;
            console.log("Raw instruction to process:", instructionJson);
            
            try {
                // Try to parse as JSON
                instructionData = JSON.parse(instructionJson);
                console.log("Successfully parsed instruction JSON:", instructionData);
            } catch (parseError) {
                console.error("Error parsing instruction JSON:", parseError);
                return `Error parsing instruction: ${parseError.message}`;
            }
            
            // Check for type property (could be from backend or our custom format)
            const action = instructionData.type === 'instruction' ? instructionData.action : instructionData.action;
            
            // Handle backend instruction format (which uses MapBoxActions enum)
            if (action === 'SET_CENTER' && instructionData.data) {
                console.log("Processing SET_CENTER instruction:", instructionData);
                if (instructionData.data.center && Array.isArray(instructionData.data.center)) {
                    // If we have a map instance, center it
                    if (mapContext.map.current) {
                        console.log("Centering map to:", instructionData.data.center, "with zoom:", instructionData.data.zoom || 5);
                        mapContext.map.current.flyTo({
                            center: instructionData.data.center,
                            zoom: instructionData.data.zoom || 5,
                            essential: true
                        });
                        
                        return `I've centered the map on the requested location.`;
                    } else {
                        console.error("Map instance not available");
                    }
                } else {
                    console.error("Invalid center coordinates:", instructionData.data);
                }
                return "I tried to center the map, but couldn't get valid coordinates.";
            }
            
            if (instructionData.action === 'SET_ZOOM' && instructionData.data) {
                // If we have a map instance, zoom it
                if (mapContext.map.current && instructionData.data.zoom) {
                    mapContext.map.current.zoomTo(instructionData.data.zoom);
                    return `I've set the zoom level to ${instructionData.data.zoom}.`;
                }
                return "I tried to set the zoom level, but couldn't get valid parameters.";
            }
            
            if (instructionData.action === 'ANALYZE_DATA') {
                console.log("Processing ANALYZE_DATA instruction");
                return "Analyzing the current map data...";
            }
            
            if (instructionData.action === 'CHAT_MESSAGE_WITH_MEDIA' && instructionData.data) {
                console.log("Processing CHAT_MESSAGE_WITH_MEDIA instruction:", instructionData.data);
                
                try {
                    // Create a media message
                    const mediaMsg: Message = {
                        id: generateMessageId(),
                        type: "media",
                        content: instructionData.data.text || "",
                        timestamp: new Date(),
                        media: {
                            type: instructionData.data.media.type,
                            data: instructionData.data.media.data,   // May be undefined
                            url: instructionData.data.media.url,     // May be undefined
                            iframe_url: instructionData.data.media.iframe_url, // May be undefined
                            alt_text: instructionData.data.media.alt_text,
                            title: instructionData.data.media.title,
                            metadata: instructionData.data.media.metadata
                        }
                    };
                    
                    // Directly add the media message to the messages state
                    setMessages(prev => [...prev, mediaMsg]);
                    
                    // Return an empty string to prevent adding a duplicate instruction message
                    return "";
                } catch (error) {
                    console.error("Error processing media message:", error);
                    return "I tried to show you a media visualization but encountered an error.";
                }
            }
            
            if (instructionData.action === 'DISPLAY_TIMELINE' && instructionData.data) {
                console.log("Processing DISPLAY_TIMELINE instruction", instructionData.data);
                
                try {
                    // Create a media message for the timeline
                    const mediaMsg: Message = {
                        id: generateMessageId(),
                        type: "media",
                        content: `Here's the timeline animation for ${instructionData.data.country.replace('_', ' ')}`,
                        timestamp: new Date(),
                        media: {
                            type: "gif",
                            data: instructionData.data.timeline_gif, // Base64 data (if provided)
                            url: instructionData.data.timeline_gif_url, // URL to fetch GIF
                            iframe_url: instructionData.data.timeline_iframe_url, // URL for iframe display
                            alt_text: `Timeline animation for ${instructionData.data.country.replace('_', ' ')}`,
                            title: instructionData.data.title || `${instructionData.data.dataset} Timeline`,
                            metadata: {
                                dataset: instructionData.data.dataset,
                                country: instructionData.data.country,
                                years: instructionData.data.years
                            }
                        }
                    };
                    
                    // Directly add the media message to the messages state
                    setMessages(prev => [...prev, mediaMsg]);
                    
                    // Return an empty string to prevent adding a duplicate instruction message
                    return "";
                } catch (error) {
                    console.error("Error processing timeline:", error);
                    return "I tried to show you a timeline animation but encountered an error.";
                }
            }
            
            if (instructionData.action === 'SET_GEOJSON' && instructionData.data) {
                console.log("Processing SET_GEOJSON instruction:", instructionData.data);
                
                // Check if we have the datasets, countries, and years parameters
                if (
                    instructionData.data.datasets && 
                    Array.isArray(instructionData.data.datasets) && 
                    instructionData.data.countries && 
                    Array.isArray(instructionData.data.countries) &&
                    instructionData.data.years && 
                    Array.isArray(instructionData.data.years)
                ) {
                    console.log("Loading data with params:", {
                        datasets: instructionData.data.datasets,
                        countries: instructionData.data.countries,
                        years: instructionData.data.years
                    });
                    
                    // Set threshold values, ensuring minimum of 1 for each dataset
                    const thresholds = instructionData.data.thresholds && typeof instructionData.data.thresholds === 'object' 
                        ? {...instructionData.data.thresholds} 
                        : {};
                        
                    // Ensure all datasets have at least threshold of 1
                    const allDatasets = instructionData.data.datasets as DatasetType[];
                    allDatasets.forEach(dataset => {
                        // If threshold is not specified or less than 1, set it to 1
                        const currentValue = thresholds[dataset];
                        if (typeof currentValue !== 'number' || currentValue < 1) {
                            thresholds[dataset] = 1;
                        }
                    });
                    
                    // Apply all thresholds
                    Object.entries(thresholds).forEach(([dataset, value]) => {
                        mapContext.handleThresholdChange(dataset, value as number);
                        console.log(`Set threshold for ${dataset} to ${value}`);
                    });
                    
                    // Set up the datasets and params in the context
                    mapContext.loadGeoData(
                        instructionData.data.datasets as DatasetType[],
                        instructionData.data.countries as CountryType[],
                        instructionData.data.years as number[]
                    );
                    
                    // Find and click the Apply Filters button to apply all changes
                    setTimeout(() => {
                        // Look for the Apply Filters button by text content
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const applyButton = buttons.find(btn => 
                            btn.textContent?.includes('Apply Filters')
                        );
                        
                        if (applyButton) {
                            console.log("Found Apply Filters button, clicking it");
                            applyButton.click();
                        } else {
                            console.error("Could not find Apply Filters button");
                        }
                    }, 100); // Short delay to ensure state updates have propagated
                    
                    // Construct a response message
                    const datasets = instructionData.data.datasets.join(', ');
                    const countries = instructionData.data.countries.map(c => c.replace('_', ' ')).join(', ');
                    const years = instructionData.data.years.join(', ');
                    
                    return `I've loaded ${datasets} data for ${countries} (${years}).`;
                }
                // Fallback to the old GeoJSON handling for backward compatibility
                else if (instructionData.data.geojson) {
                    // Handle direct GeoJSON data
                    if (mapContext.map.current) {
                        const id = `geojson-${Date.now()}`;
                        
                        // Check if the source already exists
                        if (!mapContext.map.current.getSource(id)) {
                            mapContext.map.current.addSource(id, {
                                type: 'geojson',
                                data: instructionData.data.geojson
                            });
                            
                            // Add a layer
                            mapContext.map.current.addLayer({
                                id: id,
                                type: 'fill',
                                source: id,
                                paint: {
                                    'fill-color': instructionData.data.fillColor || '#088',
                                    'fill-opacity': instructionData.data.fillOpacity || 0.8
                                }
                            });
                            
                            return "I've added the requested data to the map.";
                        }
                    }
                }
                return "I tried to load the data, but couldn't get valid parameters.";
            }
            
            // Also handle our custom actions
            if (instructionData.type === 'instruction') {
                if (instructionData.action === 'toggle3DMode') {
                    mapContext.toggle3DMode();
                    return "I've switched the map to " + (mapContext.is3DMode ? "3D" : "2D") + " mode.";
                }
                
                if (instructionData.action === 'changeYear' && instructionData.data?.year) {
                    const yearIndex = mapContext.yearSequence.current.indexOf(instructionData.data.year);
                    if (yearIndex >= 0) {
                        mapContext.handleYearSelection(yearIndex);
                        return `I've set the year to ${instructionData.data.year}.`;
                    }
                    return "I couldn't find that year in the available data.";
                }
                
                if (instructionData.action === 'toggleAnimation') {
                    mapContext.toggleAnimation();
                    return mapContext.animating ? "Started the animation." : "Stopped the animation.";
                }
                
                if (instructionData.action === 'changeAnimationSpeed' && instructionData.data?.speed) {
                    const speed = instructionData.data.speed === 'slow' ? 4000 : 
                                instructionData.data.speed === 'medium' ? 2000 : 
                                instructionData.data.speed === 'fast' ? 1000 : 2000;
                                
                    mapContext.changeAnimationSpeed(speed);
                    return `Animation speed set to ${instructionData.data.speed}.`;
                }
                
                if (instructionData.action === 'loadData' && 
                    instructionData.data?.datasets && 
                    instructionData.data?.countries && 
                    instructionData.data?.years) {
                    
                    // Set threshold values, ensuring minimum of 1 for each dataset
                    const thresholds = instructionData.data.thresholds && typeof instructionData.data.thresholds === 'object' 
                        ? {...instructionData.data.thresholds} 
                        : {};
                        
                    // Ensure all datasets have at least threshold of 1
                    const allDatasets = instructionData.data.datasets as DatasetType[];
                    allDatasets.forEach(dataset => {
                        // If threshold is not specified or less than 1, set it to 1
                        const currentValue = thresholds[dataset];
                        if (typeof currentValue !== 'number' || currentValue < 1) {
                            thresholds[dataset] = 1;
                        }
                    });
                    
                    // Apply all thresholds
                    Object.entries(thresholds).forEach(([dataset, value]) => {
                        mapContext.handleThresholdChange(dataset, value as number);
                        console.log(`Set threshold for ${dataset} to ${value}`);
                    });
                    
                    // Set up the data in the map context
                    mapContext.loadGeoData(
                        instructionData.data.datasets as DatasetType[],
                        instructionData.data.countries as CountryType[],
                        instructionData.data.years as number[]
                    );
                    
                    // Find and click the Apply Filters button to apply all changes
                    setTimeout(() => {
                        // Look for the Apply Filters button by text content
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const applyButton = buttons.find(btn => 
                            btn.textContent?.includes('Apply Filters')
                        );
                        
                        if (applyButton) {
                            console.log("Found Apply Filters button, clicking it");
                            applyButton.click();
                        } else {
                            console.error("Could not find Apply Filters button");
                        }
                    }, 100); // Short delay to ensure state updates have propagated
                    
                    return "Loading the requested data...";
                }
                
                if (instructionData.action === 'setThreshold' && 
                    instructionData.data?.dataset && 
                    instructionData.data?.value !== undefined) {
                    
                    // Get the threshold value, ensuring it's at least 1
                    let thresholdValue = instructionData.data.value;
                    if (thresholdValue < 1) {
                        thresholdValue = 1;
                        console.log(`Adjusted threshold value to minimum of 1`);
                    }
                    
                    // Set the threshold
                    mapContext.handleThresholdChange(instructionData.data.dataset, thresholdValue);
                    
                    // Find and click the Apply Filters button
                    setTimeout(() => {
                        // Look for the Apply Filters button by text content
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const applyButton = buttons.find(btn => 
                            btn.textContent?.includes('Apply Filters')
                        );
                        
                        if (applyButton) {
                            console.log("Found Apply Filters button, clicking it");
                            applyButton.click();
                        } else {
                            console.error("Could not find Apply Filters button");
                        }
                    }, 100); // Short delay to ensure state updates have propagated
                    
                    return `Set threshold for ${instructionData.data.dataset} to ${instructionData.data.value}.`;
                }
            }
            
            return "I processed your request, but couldn't perform a specific map action.";
        } catch (e) {
            console.error("Failed to process instruction:", e, "Raw instruction:", instructionJson);
            return "I tried to perform an action but couldn't understand the instruction format.";
        }
    }, [mapContext]);

    return (
        <div className={`flex flex-col h-full w-[500px] bg-white/30 backdrop-blur-sm text-black transition-all duration-300 transform ${
            isChatExpanded ? 'translate-x-0' : 'translate-x-[calc(100%-40px)]'
        }`}>
            <button
                onClick={() => setIsChatExpanded(!isChatExpanded)}
                className="absolute left-2 top-2 bg-gray-200/70 backdrop-blur-sm text-black rounded-full w-8 h-8 flex items-center justify-center z-30 shadow-md"
            >
                {isChatExpanded ? (
                    <ChevronRightIcon className="h-5 w-5" />
                ) : (
                    <ChevronLeftIcon className="h-5 w-5" />
                )}
            </button>

            {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full w-full p-4">
                    <div className="max-w-4xl w-full space-y-8">
                        <h1 className="text-4xl font-bold text-black text-center backdrop-blur-sm bg-white/30 rounded-lg p-4">
                            What do you want to visualize today? 🌍
                        </h1>

                        <div className="w-full">
                            <div className="relative bg-white/50 backdrop-blur-md rounded-xl border border-gray-200/50">
                                <div className="overflow-y-auto">
                                    <Textarea
                                        ref={textareaRef}
                                        value={value}
                                        onChange={(e) => {
                                            setValue(e.target.value);
                                            adjustHeight();
                                        }}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Ask v0 a question..."
                                        className={cn(
                                            "w-full px-4 py-3",
                                            "resize-none",
                                            "bg-transparent",
                                            "border-none",
                                            "text-black text-sm",
                                            "focus:outline-none",
                                            "focus-visible:ring-0 focus-visible:ring-offset-0",
                                            "placeholder:text-gray-700 placeholder:text-sm",
                                            "min-h-[60px]"
                                        )}
                                        style={{
                                            overflow: "hidden",
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex-1 overflow-y-auto p-4">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={cn(
                                    "mb-4 flex",
                                    message.type === "human"
                                        ? "justify-end"
                                        : "justify-start"
                                )}
                            >
                                <div
                                    className={cn(
                                        "rounded-lg px-4 py-2 max-w-[80%] backdrop-blur-sm",
                                        message.type === "human"
                                            ? "bg-gray-200/70 text-black"
                                            : message.type === "instruction"
                                            ? "bg-blue-100/70 text-blue-800 border border-blue-200"
                                            : "bg-gray-100/0 text-black"
                                    )}
                                >
                                    {message.type === "media" ? (
                                        <div className="media-message">
                                            {/* Show the message content text */}
                                            {message.content && (
                                                <div className="media-message-text mb-2">
                                                    {message.content}
                                                </div>
                                            )}
                                            
                                            {/* Render the media content */}
                                            {message.media && (
                                                <div className="media-container rounded-lg overflow-hidden border border-gray-200">
                                                    {/* Media title */}
                                                    {message.media.title && (
                                                        <div className="media-title bg-gray-100 px-3 py-2 text-sm font-medium">
                                                            {message.media.title}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Render based on media type */}
                                                    {message.media.type === 'gif' && (
                                                        <div className="media-content p-1">
                                                            {/* Use iframe with proper parameters */}
                                                            <iframe
                                                                src={message.media.iframe_url || 
                                                                    `http://localhost:8000/timeline-view?${
                                                                        new URLSearchParams({
                                                                            country: (message.media.metadata?.country as string) || 'Mali',
                                                                            dataset: (message.media.metadata?.dataset as string) || 'PopDensity',
                                                                            start: String((message.media.metadata?.years as number[])?.[0] || 2015),
                                                                            end: String((message.media.metadata?.years as number[])?.[
                                                                                (message.media.metadata?.years as number[])?.length - 1 || 0
                                                                            ] || 2020),
                                                                            t: String(new Date().getTime())
                                                                        }).toString()
                                                                    }`
                                                                }
                                                                title={message.media.title || "Timeline Animation"}
                                                                width="100%"
                                                                height="400px"
                                                                style={{ border: 'none', borderRadius: '4px' }}
                                                                sandbox="allow-scripts"
                                                                loading="lazy"
                                                                onLoad={() => console.log("iframe loaded successfully")}
                                                                onError={() => console.error("iframe failed to load")}
                                                            ></iframe>
                                                            
                                                            {/* Direct link as a fallback */}
                                                            <div className="text-center mt-2 text-xs">
                                                                <a 
                                                                    href="http://localhost:8000/timeline-view" 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="text-blue-500 hover:text-blue-600"
                                                                >
                                                                    Open timeline in new window
                                                                </a>
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Show years if available in metadata */}
                                                    {message.media.metadata?.years && Array.isArray(message.media.metadata.years) && (
                                                        <div className="timeline-years bg-gray-100 px-3 py-1 text-xs text-gray-600 text-center">
                                                            Years: {message.media.metadata.years.join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : message.type === "ai" ? (
                                        <div className="chat-markdown">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    table: (props) => (
                                                    <table
                                                        className="table-auto border-collapse border border-gray-300"
                                                        {...props}
                                                    />
                                                    ),
                                                    th: (props) => (
                                                    <th
                                                        className="border border-gray-300 px-4 py-2 bg-gray-100"
                                                        {...props}
                                                    />
                                                    ),
                                                    td: (props) => (
                                                    <td
                                                        className="border border-gray-300 px-4 py-2"
                                                        {...props}
                                                    />
                                                    ),
                                                    a: (props) => (
                                                    <a
                                                        className="text-blue-500 hover:underline"
                                                        {...props}
                                                    />
                                                    ),
                                                }}
                                                >
                                                {message.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        message.content
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-4 border-t border-gray-200/30">
                        <div className="relative bg-white/50 backdrop-blur-md rounded-xl">
                            <div className="overflow-y-auto">
                                <Textarea
                                    ref={textareaRef}
                                    value={value}
                                    onChange={(e) => {
                                        setValue(e.target.value);
                                        adjustHeight();
                                    }}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type a message..."
                                    className={cn(
                                        "w-full px-4 py-3",
                                        "resize-none",
                                        "bg-transparent",
                                        "border-none",
                                        "text-black text-sm",
                                        "focus:outline-none",
                                        "focus-visible:ring-0 focus-visible:ring-offset-0",
                                        "placeholder:text-gray-700 placeholder:text-sm",
                                        "min-h-[60px]"
                                    )}
                                    style={{
                                        overflow: "hidden",
                                    }}
                                />
                            </div>
                            <button
                                onClick={handleSendMessage}
                                disabled={!value.trim() || isLoading}
                                className={cn(
                                    "absolute bottom-2 right-2",
                                    "p-2 rounded-lg",
                                    "bg-gray-200/70 hover:bg-gray-300/70 backdrop-blur-sm",
                                    "text-black",
                                    "transition-colors",
                                    "disabled:opacity-50"
                                )}
                            >
                                <ArrowUpIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
