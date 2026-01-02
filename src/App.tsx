import React, { useState } from 'react';
import { CameraInspection } from './components/CameraInspection';
import { InspectionSummary, InspectionSummaryData } from './components/InspectionSummary';

const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
};

const App: React.FC = () => {
  const [summary, setSummary] = useState<InspectionSummaryData | null>(null);
  const isMobile = isMobileDevice();

  return (
    <div className={`app-root ${isMobile && !summary ? 'app-root-mobile' : ''}`}>
      {(!isMobile || summary) && (
        <header className="app-header">
          <h1>AI 360° Vehicle Inspection (Phase 1 Prototype)</h1>
          <p>Internal engineering prototype – video capture, guidance, and basic damage detection only.</p>
        </header>
      )}
      {!summary ? (
        <CameraInspection onInspectionComplete={setSummary} />
      ) : (
        <InspectionSummary summary={summary} onRestart={() => setSummary(null)} />
      )}
    </div>
  );
};

export default App;


