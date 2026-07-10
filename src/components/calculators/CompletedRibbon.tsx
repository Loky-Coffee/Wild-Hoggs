import { NODE_WIDTH, NODE_HEIGHT } from '../../utils/treeNodeConfig';

// Diagonale „Fertig"-Schleife oben rechts für abgeschlossene (max) Knoten (Research + Tank).
// Wird innerhalb der Node-SVG-Gruppe gerendert (Node ist um (0,0) zentriert).
export default function CompletedRibbon({ label }: { readonly label: string }) {
  const R = NODE_WIDTH / 2;    // rechte Kante
  const T = -NODE_HEIGHT / 2;  // obere Kante
  // Diagonaler Streifen quer über die obere rechte Ecke
  const band = `${R - 60},${T} ${R - 25},${T} ${R},${T + 25} ${R},${T + 60}`;
  const cx = R - 22.5;
  const cy = T + 22.5;
  return (
    <g data-node-element="true" style={{ pointerEvents: 'none' }}>
      <polygon points={band} fill="#27ae60" opacity={0.95} data-node-element="true" />
      <text
        x={cx}
        y={cy}
        transform={`rotate(45 ${cx} ${cy})`}
        textAnchor="middle"
        dominant-baseline="central"
        fontSize="10"
        fontWeight="700"
        fill="#ffffff"
        data-node-element="true"
      >
        {label}
      </text>
    </g>
  );
}
