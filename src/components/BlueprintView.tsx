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
  // Show all damages in red only
  const hasDamage = (color: DamageColor | undefined): boolean => {
    return color === 'yellow' || color === 'orange' || color === 'red';
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
              fill={hasDamage(blueprint.exterior.frontBumper) ? '#f44336' : '#e0e0e0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Hood */}
            <rect 
              x="50" y="80" width="300" height="40" rx="5" 
              fill={hasDamage(blueprint.exterior.hood) ? '#f44336' : '#f0f0f0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Roof */}
            <rect 
              x="80" y="120" width="240" height="30" rx="5" 
              fill={hasDamage(blueprint.exterior.roof) ? '#f44336' : '#f0f0f0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Left side */}
            <rect 
              x="50" y="120" width="30" height="80" rx="5" 
              fill={hasDamage(blueprint.exterior.leftSide) ? '#f44336' : '#f0f0f0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Right side */}
            <rect 
              x="320" y="120" width="30" height="80" rx="5" 
              fill={hasDamage(blueprint.exterior.rightSide) ? '#f44336' : '#f0f0f0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Left fender */}
            <rect 
              x="20" y="100" width="30" height="60" rx="5" 
              fill={hasDamage(blueprint.exterior.leftFender) ? '#f44336' : '#e0e0e0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Right fender */}
            <rect 
              x="350" y="100" width="30" height="60" rx="5" 
              fill={hasDamage(blueprint.exterior.rightFender) ? '#f44336' : '#e0e0e0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Rear bumper */}
            <rect 
              x="50" y="60" width="300" height="20" rx="5" 
              fill={hasDamage(blueprint.exterior.rearBumper) ? '#f44336' : '#e0e0e0'}
              stroke="#333" 
              strokeWidth="1" 
            />
            
            {/* Trunk */}
            <rect 
              x="50" y="60" width="300" height="20" rx="5" 
              fill={hasDamage(blueprint.exterior.trunk) ? '#f44336' : '#f0f0f0'}
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

      </div>
    </div>
  );
};

