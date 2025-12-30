import React, { useState } from 'react';
import { CameraInspection } from './components/CameraInspection';
import { InspectionSummary, InspectionSummaryData } from './components/InspectionSummary';

const App: React.FC = () => {
  const [summary, setSummary] = useState<InspectionSummaryData | null>(null);

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>AI 360° Vehicle Inspection (Phase 1 Prototype)</h1>
        <p>Internal engineering prototype – video capture, guidance, and basic damage detection only.</p>
      </header>
      {!summary ? (
        <CameraInspection onInspectionComplete={setSummary} />
      ) : (
        <InspectionSummary summary={summary} onRestart={() => setSummary(null)} />
      )}
    </div>
  );
};

export default App;


