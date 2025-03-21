"use client";

import React from 'react';

export default function ReportPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <main className="container mx-auto">
        
        <div className="flex justify-center w-full overflow-hidden">
          <div className="w-full max-w-screen-xl shadow-lg rounded-lg overflow-hidden">
            <iframe 
              style={{ 
                border: "1px solid rgba(0, 0, 0, 0.1)",
                width: "100%",
                height: "calc(100vh - 150px)",
                minHeight: "600px"
              }} 
              src="https://embed.figma.com/design/teTTEGCWFgFIySfOTyCwtc/POSTER?node-id=0-1&embed-host=share" 
              allowFullScreen
            />
          </div>
        </div>
      </main>
    </div>
  );
}
