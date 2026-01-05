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


export interface VehicleInfo {
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  vin?: string;
}


export interface InspectionSummaryData {
  id?: string;
  videoUrl?: string;
  vehicleImageUrl?: string;
  vehicleInfo?: VehicleInfo;
  summary?: {
    totalDamages?: number;
    estimatedRepairCost?: number;
    conditionRating?: number;
    adjustedValue?: number;
  };
  panels?: PanelSummary[];
}

interface Props {
  summary: InspectionSummaryData;
  onRestart: () => void;
}

export const InspectionSummary: React.FC<Props> = ({ summary, onRestart }) => {
  const vehicleInfo = summary.vehicleInfo || {};
  const summaryData = summary.summary || {};

  return (
    <div className="summary-layout-new">
      {/* Header with Vehicle Info */}
      <div className="summary-header">
        <div className="vehicle-visual">
          {summary.vehicleImageUrl ? (
            <img
              src={summary.vehicleImageUrl}
              alt="Vehicle overview"
              className="vehicle-overview-image"
            />
          ) : (
            <div className="vehicle-overview-placeholder">
              <span>360°</span>
            </div>
          )}
        </div>
        <div className="vehicle-info">
          <h1>
            {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
          </h1>
          <div className="vehicle-details">
            {vehicleInfo.mileage && <div>Mileage: {vehicleInfo.mileage.toLocaleString()} miles</div>}
            {vehicleInfo.vin && (
              <div className="vin">
                VIN: {vehicleInfo.vin}
                <button className="copy-btn" onClick={() => navigator.clipboard.writeText(vehicleInfo.vin || '')}>
                  📋
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="summary-actions">
        <button className="secondary-button" onClick={onRestart}>
          Run Another 360° Inspection
        </button>
      </div>
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


