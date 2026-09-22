import React from 'react';
import { WORK_STYLE_DIMENSIONS } from '../data/questions';

interface RadarChartProps {
  scores: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', number>;
  size?: number;
}

export const RadarChart: React.FC<RadarChartProps> = ({ scores, size = 340 }) => {
  const center = size / 2;
  const radius = (size / 2) - 45;
  const dimensions: ('A' | 'B' | 'C' | 'D' | 'E' | 'F')[] = ['A', 'B', 'C', 'D', 'E', 'F'];
  const total = dimensions.length;

  // Calculate coordinates for a given dimension index and value (0-100)
  const getCoordinates = (index: number, value: number) => {
    const angle = (Math.PI * 2 / total) * index - Math.PI / 2;
    const distance = (value / 100) * radius;
    const x = center + distance * Math.cos(angle);
    const y = center + distance * Math.sin(angle);
    return { x, y };
  };

  // Concentric polygon grid points
  const gridLevels = [20, 40, 60, 80, 100];

  // Polygon points for the data
  const dataPoints = dimensions.map((dim, i) => {
    const val = Math.max(0, Math.min(100, scores[dim] ?? 50));
    return getCoordinates(i, val);
  });
  const dataPointsString = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="overflow-visible">
        {/* Background Grids */}
        {gridLevels.map((level) => {
          const points = dimensions.map((_, i) => {
            const p = getCoordinates(i, level);
            return `${p.x},${p.y}`;
          }).join(' ');
          return (
            <polygon
              key={level}
              points={points}
              fill={level === 100 ? '#0f172a' : 'none'}
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray={level < 100 ? '2,2' : undefined}
              opacity={0.7}
            />
          );
        })}

        {/* Axes lines from center */}
        {dimensions.map((_, i) => {
          const edge = getCoordinates(i, 100);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={edge.x}
              y2={edge.y}
              stroke="#334155"
              strokeWidth="1"
            />
          );
        })}

        {/* Data area polygon */}
        <polygon
          points={dataPointsString}
          fill="rgba(59, 130, 246, 0.35)"
          stroke="#3b82f6"
          strokeWidth="2.5"
        />

        {/* Data points dots & score values */}
        {dataPoints.map((p, i) => {
          const dim = dimensions[i];
          const val = scores[dim] ?? 0;
          return (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r="4.5"
                fill="#60a5fa"
                stroke="#1e293b"
                strokeWidth="2"
              />
              <text
                x={p.x}
                y={p.y - 8}
                fill="#93c5fd"
                fontSize="11"
                fontWeight="700"
                textAnchor="middle"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Labels at outer perimeter */}
        {dimensions.map((dim, i) => {
          const angle = (Math.PI * 2 / total) * i - Math.PI / 2;
          const labelDistance = radius + 24;
          const x = center + labelDistance * Math.cos(angle);
          const y = center + labelDistance * Math.sin(angle);
          const shortName = WORK_STYLE_DIMENSIONS[dim].shortName;

          let textAnchor = 'middle';
          if (Math.cos(angle) > 0.3) textAnchor = 'start';
          else if (Math.cos(angle) < -0.3) textAnchor = 'end';

          return (
            <text
              key={dim}
              x={x}
              y={y + 4}
              fill="#cbd5e1"
              fontSize="11"
              fontWeight="600"
              textAnchor={textAnchor}
              className="select-none"
            >
              {shortName}
            </text>
          );
        })}
      </svg>
    </div>
  );
};
