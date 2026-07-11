const NODE_COUNT = 55;
const RADIUS = 16;
const CENTER = 16;
const GOLDEN_ANGLE = Math.PI * 2 * (1 - 2 / (1 + Math.sqrt(5)));

interface MarkPoint {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  depth: number;
}

function buildPoints(): MarkPoint[] {
  const tilt = 0.42;
  const spin = -0.55;
  const light = [-0.55, 0.5, 0.67];
  const points: MarkPoint[] = [];

  for (let index = 0; index < NODE_COUNT; index += 1) {
    const y = 1 - ((index + 0.5) / NODE_COUNT) * 2;
    const radial = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = GOLDEN_ANGLE * index;
    const x = Math.cos(angle) * radial;
    const z = Math.sin(angle) * radial;
    const spunX = x * Math.cos(spin) + z * Math.sin(spin);
    const spunZ = z * Math.cos(spin) - x * Math.sin(spin);
    const tiltedY = y * Math.cos(tilt) - spunZ * Math.sin(tilt);
    const depth = y * Math.sin(tilt) + spunZ * Math.cos(tilt);
    const illumination = spunX * light[0] + tiltedY * light[1] + depth * light[2];
    const lit = (illumination + 1) / 2;
    const smoothLight = 0.25 + 0.75 * (lit * lit * (3 - 2 * lit));
    const front = depth >= 0 ? 1 : 0.42;

    points.push({
      x: CENTER + RADIUS * spunX,
      y: CENTER - RADIUS * tiltedY,
      radius: Math.max(0.55, (0.55 + 0.85 * ((depth + 1) / 2)) * (RADIUS * 0.03)),
      opacity: Math.max(0.12, smoothLight * front),
      depth,
    });
  }

  return points.sort((a, b) => a.depth - b.depth);
}

const POINTS = buildPoints();

export function brandMarkDataUri(color = '#afa0ff'): string {
  const circles = POINTS.map(
    (point) =>
      `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${point.radius.toFixed(2)}" opacity="${point.opacity.toFixed(3)}"/>`,
  ).join('');
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="${color}">${circles}</g></svg>`,
  )}`;
}

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      {POINTS.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={point.radius}
          fill="var(--acc)"
          fillOpacity={point.opacity}
        />
      ))}
    </svg>
  );
}
