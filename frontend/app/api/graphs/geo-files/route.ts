import { NextRequest, NextResponse } from 'next/server';

// Define the backend API endpoint
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'; 

export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();
    
    // Forward the request to the backend
    const response = await fetch(`${BACKEND_URL}/graphs/geo-files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    // Get the response from the backend
    const data = await response.json();
    
    // Return the response to the client
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in geo-files API route:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}