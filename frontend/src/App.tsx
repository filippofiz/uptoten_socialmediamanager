import React, { useState } from 'react';
import { TestDashboard } from './components/TestDashboard';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-secondary">
                <span className="text-primary">Up to Ten</span> Social Manager
              </h1>
            </div>
            <div className="text-sm text-gray-600">
              Test Dashboard
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TestDashboard />
      </main>
    </div>
  );
}

export default App;