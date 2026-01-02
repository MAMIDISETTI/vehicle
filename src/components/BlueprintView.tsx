import React from 'react';

export type DamageColor = 'none' | 'yellow' | 'orange' | 'red';

interface BlueprintData {
  exterior: {
    frontBumper?: DamageColor;
    rearBumper?: DamageColor;
    hood?: DamageColor;
    roof?: DamageColor;
    leftSide?: DamageColor;
    rightSide?: DamageColor;
    leftFender?: DamageColor;
    rightFender?: DamageColor;
    trunk?: DamageColor;
  };
  interior: {
    frontSeats?: DamageColor;
    rearSeats?: DamageColor;
    dashboard?: DamageColor;
    doors?: DamageColor;
  };
}

interface Props {
  blueprint: BlueprintData;
}

export const BlueprintView: React.FC<Props> = ({ blueprint }) => {
  const getColorClass = (color: DamageColor | undefined): string => {
    switch (color) {
      case 'yellow':
        return 'damage-yellow';
      case 'orange':
        return 'damage-orange';
      case 'red':
        return 'damage-red';
      default:
        return '';
    }
  };

  return (
    <div className="blueprint-container">
      <div className="blueprint-diagrams">
        {/* Exterior View */}
        <div className="blueprint-diagram">
          <h3>Exterior View</h3>
          <svg viewBox="0 0 400 300" className="blueprint-svg">
            {/* Car body outline */}
            <rect x="50" y="80" width="300" height="140" rx="10" fill="#f0f0f0" stroke="#333" strokeWidth="2" />
            
            {/* Front bumper */}
            <rect 
              x="50" y="200" width="300" height="20" rx="5" 
              className={getColorClass(blueprint.exterior.frontBumper)}
              fill={blueprint.exterior.frontBumper === 'yellow' ? '#ffeb3b' : 
                    blueprint.exterior.frontBumper === 'orange' ? '#ff9800' : 
                    blueprint.exterior.frontBumper === 'red' ? '#f44336' : '#e0e0e0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Hood */}
            <rect 
              x="50" y="80" width="300" height="40" rx="5" 
              className={getColorClass(blueprint.exterior.hood)}
              fill={blueprint.exterior.hood === 'yellow' ? '#ffeb3b' : 
                    blueprint.exterior.hood === 'orange' ? '#ff9800' : 
                    blueprint.exterior.hood === 'red' ? '#f44336' : '#f0f0f0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Roof */}
            <rect 
              x="80" y="120" width="240" height="30" rx="5" 
              className={getColorClass(blueprint.exterior.roof)}
              fill={blueprint.exterior.roof === 'yellow' ? '#ffeb3b' : 
                    blueprint.exterior.roof === 'orange' ? '#ff9800' : 
                    blueprint.exterior.roof === 'red' ? '#f44336' : '#f0f0f0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Left side */}
            <rect 
              x="50" y="120" width="30" height="80" rx="5" 
              className={getColorClass(blueprint.exterior.leftSide)}
              fill={blueprint.exterior.leftSide === 'yellow' ? '#ffeb3b' : 
                    blueprint.exterior.leftSide === 'orange' ? '#ff9800' : 
                    blueprint.exterior.leftSide === 'red' ? '#f44336' : '#f0f0f0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Right side */}
            <rect 
              x="320" y="120" width="30" height="80" rx="5" 
              className={getColorClass(blueprint.exterior.rightSide)}
              fill={blueprint.exterior.rightSide === 'yellow' ? '#ffeb3b' : 
                    blueprint.exterior.rightSide === 'orange' ? '#ff9800' : 
                    blueprint.exterior.rightSide === 'red' ? '#f44336' : '#f0f0f0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Left fender */}
            <rect 
              x="20" y="100" width="30" height="60" rx="5" 
              className={getColorClass(blueprint.exterior.leftFender)}
              fill={blueprint.exterior.leftFender === 'yellow' ? '#ffeb3b' : 
                    blueprint.exterior.leftFender === 'orange' ? '#ff9800' : 
                    blueprint.exterior.leftFender === 'red' ? '#f44336' : '#e0e0e0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Right fender */}
            <rect 
              x="350" y="100" width="30" height="60" rx="5" 
              className={getColorClass(blueprint.exterior.rightFender)}
              fill={blueprint.exterior.rightFender === 'yellow' ? '#ffeb3b' : 
                    blueprint.exterior.rightFender === 'orange' ? '#ff9800' : 
                    blueprint.exterior.rightFender === 'red' ? '#f44336' : '#e0e0e0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Rear bumper */}
            <rect 
              x="50" y="60" width="300" height="20" rx="5" 
              className={getColorClass(blueprint.exterior.rearBumper)}
              fill={blueprint.exterior.rearBumper === 'yellow' ? '#ffeb3b' : 
                    blueprint.exterior.rearBumper === 'orange' ? '#ff9800' : 
                    blueprint.exterior.rearBumper === 'red' ? '#f44336' : '#e0e0e0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Trunk */}
            <rect 
              x="50" y="60" width="300" height="20" rx="5" 
              className={getColorClass(blueprint.exterior.trunk)}
              fill={blueprint.exterior.trunk === 'yellow' ? '#ffeb3b' : 
                    blueprint.exterior.trunk === 'orange' ? '#ff9800' : 
                    blueprint.exterior.trunk === 'red' ? '#f44336' : '#f0f0f0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Wheels */}
            <circle cx="100" cy="220" r="15" fill="#333" />
            <circle cx="300" cy="220" r="15" fill="#333" />
            <circle cx="100" cy="40" r="15" fill="#333" />
            <circle cx="300" cy="40" r="15" fill="#333" />
          </svg>
        </div>

        {/* Interior View */}
        <div className="blueprint-diagram">
          <h3>Interior View</h3>
          <svg viewBox="0 0 400 300" className="blueprint-svg">
            {/* Car body outline */}
            <rect x="50" y="50" width="300" height="200" rx="10" fill="#f0f0f0" stroke="#333" strokeWidth="2" />
            
            {/* Front seats */}
            <rect 
              x="100" y="100" width="200" height="60" rx="5" 
              className={getColorClass(blueprint.interior.frontSeats)}
              fill={blueprint.interior.frontSeats === 'yellow' ? '#ffeb3b' : 
                    blueprint.interior.frontSeats === 'orange' ? '#ff9800' : 
                    blueprint.interior.frontSeats === 'red' ? '#f44336' : '#e0e0e0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Rear seats */}
            <rect 
              x="100" y="180" width="200" height="50" rx="5" 
              className={getColorClass(blueprint.interior.rearSeats)}
              fill={blueprint.interior.rearSeats === 'yellow' ? '#ffeb3b' : 
                    blueprint.interior.rearSeats === 'orange' ? '#ff9800' : 
                    blueprint.interior.rearSeats === 'red' ? '#f44336' : '#e0e0e0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Dashboard */}
            <rect 
              x="80" y="70" width="240" height="20" rx="5" 
              className={getColorClass(blueprint.interior.dashboard)}
              fill={blueprint.interior.dashboard === 'yellow' ? '#ffeb3b' : 
                    blueprint.interior.dashboard === 'orange' ? '#ff9800' : 
                    blueprint.interior.dashboard === 'red' ? '#f44336' : '#e0e0e0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Doors (open) */}
            <rect 
              x="30" y="100" width="20" height="100" rx="3" 
              className={getColorClass(blueprint.interior.doors)}
              fill={blueprint.interior.doors === 'yellow' ? '#ffeb3b' : 
                    blueprint.interior.doors === 'orange' ? '#ff9800' : 
                    blueprint.interior.doors === 'red' ? '#f44336' : '#e0e0e0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            <rect 
              x="350" y="100" width="20" height="100" rx="3" 
              className={getColorClass(blueprint.interior.doors)}
              fill={blueprint.interior.doors === 'yellow' ? '#ffeb3b' : 
                    blueprint.interior.doors === 'orange' ? '#ff9800' : 
                    blueprint.interior.doors === 'red' ? '#f44336' : '#e0e0e0'}
              stroke="#333" 
              strokeWidth="1" 
            />
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="blueprint-legend">
        <div className="legend-item">
          <div className="legend-circle legend-yellow"></div>
          <span>PAINT / WORN</span>
        </div>
        <div className="legend-item">
          <div className="legend-circle legend-orange"></div>
          <span>DEFORM / EXCESS</span>
        </div>
        <div className="legend-item">
          <div className="legend-circle legend-red"></div>
          <span>REPLACE</span>
        </div>
      </div>
    </div>
  );
};

