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
            let instruction = null;
            
            // Check for special instruction markers
            const instructionStart = "<<INSTRUCTION>>";
            const instructionEnd = "<</INSTRUCTION>>";
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Decode the chunk
                const chunk = new TextDecoder().decode(value);
                
                // Check if this chunk contains an instruction
                if (chunk.includes(instructionStart) && chunk.includes(instructionEnd)) {
                    const instructionStartIndex = chunk.indexOf(instructionStart) + instructionStart.length;
                    const instructionEndIndex = chunk.indexOf(instructionEnd);
                    instruction = chunk.substring(instructionStartIndex, instructionEndIndex).trim();
                    
                    // Remove the instruction from the chunk
                    const cleanedChunk = chunk.replace(
                        chunk.substring(
                            chunk.indexOf(instructionStart), 
                            chunk.indexOf(instructionEnd) + instructionEnd.length
                        ), 
                        ""
                    );
                    
                    accumulatedContent += cleanedChunk;
                } else {
                    accumulatedContent += chunk;
                }

                // Update the AI message with the accumulated content
                setMessages(prev => 
                    prev.map(msg => 
                        msg.id === aiMessageId 
                            ? { ...msg, content: accumulatedContent } 
                            : msg
                    )
                );
            }
            
            // If we found an instruction, process it and add the result as a new message
            if (instruction) {
                const instructionResult = processInstruction(instruction);
                
                // Add the instruction result as a separate system message
                setMessages(prev => [...prev, {
                    id: generateMessageId(),
                    type: "instruction",
                    content: instructionResult,
                    timestamp: new Date(),
                    instructionData: { action: "processed", data: { instruction } }
                }]);
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
    const processInstruction = useCallback((instruction: string) => {
        try {
            // Try to parse as JSON
            const instructionData = JSON.parse(instruction);
            
            if (instructionData.action === 'toggle3DMode') {
                mapContext.toggle3DMode();
                return "I've switched the map to " + (mapContext.is3DMode ? "3D" : "2D") + " mode.";
            }
            
            if (instructionData.action === 'changeYear' && instructionData.year) {
                const yearIndex = mapContext.yearSequence.current.indexOf(instructionData.year);
                if (yearIndex >= 0) {
                    mapContext.handleYearSelection(yearIndex);
                    return `I've set the year to ${instructionData.year}.`;
                }
                return "I couldn't find that year in the available data.";
            }
            
            if (instructionData.action === 'toggleAnimation') {
                mapContext.toggleAnimation();
                return mapContext.animating ? "Started the animation." : "Stopped the animation.";
            }
            
            if (instructionData.action === 'changeAnimationSpeed' && instructionData.speed) {
                const speed = instructionData.speed === 'slow' ? 4000 : 
                             instructionData.speed === 'medium' ? 2000 : 
                             instructionData.speed === 'fast' ? 1000 : 2000;
                             
                mapContext.changeAnimationSpeed(speed);
                return `Animation speed set to ${instructionData.speed}.`;
            }
            
            if (instructionData.action === 'loadData' && 
                instructionData.datasets && 
                instructionData.countries && 
                instructionData.years) {
                
                mapContext.loadGeoData(
                    instructionData.datasets as DatasetType[],
                    instructionData.countries as CountryType[],
                    instructionData.years as number[]
                );
                
                return "Loading the requested data...";
            }
            
            if (instructionData.action === 'setThreshold' && 
                instructionData.dataset && 
                instructionData.value !== undefined) {
                
                mapContext.handleThresholdChange(instructionData.dataset, instructionData.value);
                return `Set threshold for ${instructionData.dataset} to ${instructionData.value}.`;
            }
            
            return "I couldn't understand that instruction.";
        } catch (e) {
            console.error("Failed to process instruction:", e);
            return "I tried to perform an action but couldn't understand the instruction format.";
        }
    }, [mapContext]);

    return (
        <div className={`flex flex-col h-full bg-white/30 backdrop-blur-sm text-black transition-all duration-300 transform ${
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
