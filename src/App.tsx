import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import Home from './pages/Home';
import Results from './pages/Results';
import Settings from './pages/Settings';
import Batch from './pages/Batch';
import BatchResult from './pages/BatchResult';
import Navigation from './components/Navigation';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/results" element={<Results />} />
          <Route path="/batch" element={<Batch />} />
          <Route path="/batch/:batchId" element={<BatchResult />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        <Toaster 
          position="top-right"
          richColors
          closeButton
          duration={4000}
        />
      </div>
    </Router>
  );
}

export default App;
