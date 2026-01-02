import React from 'react';
import { BlueprintView } from './BlueprintView';

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

export interface Damage {
  panelId: string;
  panelName: string;
  damageType: string;
  severity: string;
  location?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  imageUrl?: string;
  description: string;
  estimatedCost: number;
}

export interface VehicleInfo {
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  vin?: string;
}

export interface BlueprintData {
  exterior: {
    frontBumper?: string;
    rearBumper?: string;
    hood?: string;
    roof?: string;
    leftSide?: string;
    rightSide?: string;
    leftFender?: string;
    rightFender?: string;
    trunk?: string;
  };
  interior: {
    frontSeats?: string;
    rearSeats?: string;
    dashboard?: string;
    doors?: string;
  };
}

export interface InspectionSummaryData {
  id?: string;
  videoUrl?: string;
  vehicleImageUrl?: string;
  vehicleInfo?: VehicleInfo;
  damages?: Damage[];
  blueprint?: BlueprintData;
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
  const damages = summary.damages || [];
  const blueprint = summary.blueprint || { exterior: {}, interior: {} };
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
            {summaryData.conditionRating && (
              <div className="condition-rating">
                Condition Rating (CR): <span className="rating-badge">{summaryData.conditionRating.toFixed(1)}</span>
              </div>
            )}
            {vehicleInfo.vin && (
              <div className="vin">
                VIN: {vehicleInfo.vin}
                <button className="copy-btn" onClick={() => navigator.clipboard.writeText(vehicleInfo.vin || '')}>
                  📋
                </button>
              </div>
            )}
            {summaryData.adjustedValue && (
              <div className="adjusted-value">Adjusted Value: ${summaryData.adjustedValue.toLocaleString()}</div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="summary-content">
        {/* Damages Section */}
        <div className="damages-section">
          <h2>Detected Damages</h2>
          {damages.length > 0 ? (
            <div className="damages-list">
              {damages.map((damage, index) => (
                <div key={index} className="damage-item">
                  {damage.imageUrl && (
                    <img src={damage.imageUrl} alt={damage.panelName} className="damage-image" />
                  )}
                  <div className="damage-info">
                    <h3>{damage.panelName}</h3>
                    <div className="damage-meta">
                      <span className={`severity-badge severity-${damage.severity}`}>
                        {damage.severity}
                      </span>
                      <span className="damage-type">{damage.damageType}</span>
                    </div>
                    <p className="damage-description">{damage.description}</p>
                    {damage.estimatedCost > 0 && (
                      <div className="damage-cost">Est. Cost: ${damage.estimatedCost.toLocaleString()}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-damages">No damages detected.</p>
          )}
        </div>

        {/* Blueprint Section */}
        {blueprint && (blueprint.exterior || blueprint.interior) && (
          <div className="blueprint-section">
            <h2>Damage Blueprint</h2>
            <BlueprintView blueprint={blueprint as any} />
          </div>
        )}

        {/* Issue Summary */}
        <div className="issue-summary">
          <h2>Issue Summary</h2>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Exterior:</span>
              <span className={`summary-value ${summaryData.totalDamages && summaryData.totalDamages > 0 ? 'has-issues' : 'no-issues'}`}>
                {summaryData.totalDamages || 0} issue(s)
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Interior:</span>
              <span className="summary-value no-issues">No data</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Wheels:</span>
              <span className="summary-value no-issues">No issues</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Tires condition:</span>
              <span className="summary-value no-issues">No issues</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Mechanical / OBD:</span>
              <span className="summary-value no-issues">No data</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">History report:</span>
              <span className="summary-value no-issues">No data</span>
            </div>
          </div>
        </div>

        {/* Estimate Totals */}
        {summaryData.estimatedRepairCost !== undefined && summaryData.estimatedRepairCost > 0 && (
          <div className="estimate-totals">
            <button className="estimate-button">
              Estimate Totals: ${summaryData.estimatedRepairCost.toLocaleString()}
            </button>
          </div>
        )}
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


