interface ConnectionLineProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  isDragging?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
}

export function ConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  isDragging = false,
  onClick,
  isSelected = false,
}: ConnectionLineProps) {
  // Calculate control points for bezier curve
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Control point offset scales with distance
  const controlOffset = Math.min(distance * 0.4, 100);

  // Determine curve direction based on relative positions
  let cp1x: number, cp1y: number, cp2x: number, cp2y: number;

  if (Math.abs(dx) > Math.abs(dy)) {
    // More horizontal - curve out horizontally
    cp1x = fromX + controlOffset * Math.sign(dx);
    cp1y = fromY;
    cp2x = toX - controlOffset * Math.sign(dx);
    cp2y = toY;
  } else {
    // More vertical - curve out vertically
    cp1x = fromX;
    cp1y = fromY + controlOffset * Math.sign(dy);
    cp2x = toX;
    cp2y = toY - controlOffset * Math.sign(dy);
  }

  const pathD = `M ${fromX} ${fromY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toX} ${toY}`;

  // Calculate arrowhead angle at end point
  // Use the tangent at the end of the curve (derivative of bezier at t=1)
  const tangentX = 3 * (toX - cp2x);
  const tangentY = 3 * (toY - cp2y);
  const angle = Math.atan2(tangentY, tangentX);

  // Arrowhead size
  const arrowSize = 8;
  const arrowAngle = Math.PI / 6; // 30 degrees

  // Arrowhead points
  const arrow1X = toX - arrowSize * Math.cos(angle - arrowAngle);
  const arrow1Y = toY - arrowSize * Math.sin(angle - arrowAngle);
  const arrow2X = toX - arrowSize * Math.cos(angle + arrowAngle);
  const arrow2Y = toY - arrowSize * Math.sin(angle + arrowAngle);

  const arrowD = `M ${toX} ${toY} L ${arrow1X} ${arrow1Y} M ${toX} ${toY} L ${arrow2X} ${arrow2Y}`;

  return (
    <g
      className={`${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* Invisible wider path for easier clicking */}
      {onClick && (
        <path
          d={pathD}
          fill="none"
          stroke="transparent"
          strokeWidth={12}
        />
      )}

      {/* Visible connection line */}
      <path
        d={pathD}
        fill="none"
        stroke={isDragging ? '#3B82F6' : isSelected ? '#2563EB' : '#9CA3AF'}
        strokeWidth={isDragging ? 2 : isSelected ? 2.5 : 1.5}
        strokeDasharray={isDragging ? '5,5' : undefined}
        className="transition-colors"
      />

      {/* Arrowhead */}
      <path
        d={arrowD}
        fill="none"
        stroke={isDragging ? '#3B82F6' : isSelected ? '#2563EB' : '#9CA3AF'}
        strokeWidth={isDragging ? 2 : isSelected ? 2.5 : 1.5}
        strokeLinecap="round"
      />
    </g>
  );
}
