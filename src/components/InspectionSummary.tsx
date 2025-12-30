import React from 'react';

export type PanelId =
  | 'front_bumper'
  | 'rear_bumper'
  | 'left_side'
  | 'right_side'
  | 'hood'
  | 'roof';

export interface PanelSummary {
  panelId: PanelId;
  label: string;
  damaged: boolean;
  damageType?: string;
  confidence: number;
  needsRecapture: boolean;
}

export interface InspectionSummaryData {
  vehicleImageUrl?: string;
  panels: PanelSummary[];
}

interface Props {
  summary: InspectionSummaryData;
  onRestart: () => void;
}

export const InspectionSummary: React.FC<Props> = ({ summary, onRestart }) => {
  return (
    <div className="summary-layout">
      <section className="summary-main">
        <h2>Inspection Summary</h2>
        <p>
          Prototype output – panel-wise damage status only. No pricing, claims logic, or workflow
          automation is included in this phase.
        </p>

        <div className="summary-vehicle-panel">
          {summary.vehicleImageUrl ? (
            <img
              src={summary.vehicleImageUrl}
              alt="Analyzed vehicle overview"
              className="vehicle-overview-image"
            />
          ) : (
            <div className="vehicle-overview-placeholder">
              <span>Vehicle overview image placeholder</span>
            </div>
          )}
        </div>

        <div className="panel-list">
          {summary.panels.map((panel) => (
            <PanelRow key={panel.panelId} panel={panel} />
          ))}
        </div>

        <div className="summary-actions">
          <button className="secondary-button" onClick={onRestart}>
            Run Another 360° Inspection
          </button>
        </div>
      </section>
      <aside className="summary-meta">
        <h3>Interpretation Guide</h3>
        <ul>
          <li>
            <span className="status-pill status-ok">✅ Clear – No Damage</span> – Panel appears
            intact within confidence threshold.
          </li>
          <li>
            <span className="status-pill status-damaged">⚠️ Damage Detected</span> – Scratches,
            dents, cracks, or broken parts likely present.
          </li>
          <li>
            <span className="status-pill status-recapture">❌ Needs Re-capture</span> – Panel view
            is unclear or under-sampled; another pass is recommended.
          </li>
        </ul>
      </aside>
    </div>
  );
};

const PanelRow: React.FC<{ panel: PanelSummary }> = ({ panel }) => {
  let statusLabel: string;
  let statusClass: string;

  if (panel.needsRecapture) {
    statusLabel = '❌ Needs Re-capture';
    statusClass = 'status-recapture';
  } else if (panel.damaged) {
    statusLabel = '⚠️ Damage Detected';
    statusClass = 'status-damaged';
  } else {
    statusLabel = '✅ Clear – No Damage';
    statusClass = 'status-ok';
  }

  return (
    <div className="panel-row">
      <div className="panel-main">
        <div className="panel-label">{panel.label}</div>
        <div className={`status-pill ${statusClass}`}>{statusLabel}</div>
      </div>
      <div className="panel-meta">
        <span>Confidence: {(panel.confidence * 100).toFixed(0)}%</span>
        <span>
          Damage type:{' '}
          {panel.damaged && panel.damageType ? panel.damageType : panel.needsRecapture ? 'Unclear' : 'None'}
        </span>
      </div>
    </div>
  );
};


