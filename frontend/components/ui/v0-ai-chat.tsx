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

// Define message types
type MessageType = "human" | "ai" | "instruction";

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
                                
                                // Process the instruction JSON
                                const instructionResult = processInstruction(instructionPart);
                                
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
            // Try to parse as JSON
            const instructionData = JSON.parse(instructionJson);
            console.log("Processing instruction:", instructionData);
            
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
                    
                    // Set threshold values if included
                    if (instructionData.data.thresholds && typeof instructionData.data.thresholds === 'object') {
                        Object.entries(instructionData.data.thresholds).forEach(([dataset, value]) => {
                            if (typeof value === 'number') {
                                mapContext.handleThresholdChange(dataset, value);
                                console.log(`Set threshold for ${dataset} to ${value}`);
                            }
                        });
                    }
                    
                    // Use the MapContext loadGeoData method to load the data
                    mapContext.loadGeoData(
                        instructionData.data.datasets as DatasetType[],
                        instructionData.data.countries as CountryType[],
                        instructionData.data.years as number[]
                    );
                    
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
                    
                    mapContext.loadGeoData(
                        instructionData.data.datasets as DatasetType[],
                        instructionData.data.countries as CountryType[],
                        instructionData.data.years as number[]
                    );
                    
                    return "Loading the requested data...";
                }
                
                if (instructionData.action === 'setThreshold' && 
                    instructionData.data?.dataset && 
                    instructionData.data?.value !== undefined) {
                    
                    mapContext.handleThresholdChange(instructionData.data.dataset, instructionData.data.value);
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
        <div className={`flex flex-col h-full w-80 bg-white/30 backdrop-blur-sm text-black transition-all duration-300 transform ${
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
                            What do you want to see?
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
                                            : "bg-white/50 text-black"
                                    )}
                                >
                                    {message.content}
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
