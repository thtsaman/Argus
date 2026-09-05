/**
 * Splits string into multi-line text lines with a given max character width limit per line.
 */
export function wrapLabelText(text: string, maxCharsPerLine = 16): string[] {
  if (!text) return [""];
  if (text.length <= maxCharsPerLine) return [text];

  const words = text.split(" ");
  if (words.length <= 1) return [text];

  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    if ((currentLine + " " + word).length <= maxCharsPerLine) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Dynamic node collision radius solver taking node shape + label dimensions + padding into account.
 */
export function getDynamicNodeCollisionRadius(node: any, isBridge = false): number {
  const label = node.label || node.name || "";
  const lines = wrapLabelText(label, 16);
  const maxLineLength = Math.max(...lines.map((l) => l.length));

  // Estimate label bounding width based on average character width (~7px at 11-12px font)
  const approxLabelWidth = maxLineLength * 7;
  const approxLabelHeight = lines.length * 14;

  const nodeRadius = isBridge ? 12 : 6;
  const labelHalfWidth = approxLabelWidth / 2;

  // Hypotenuse/bounding box radius for collision space
  const labelCollisionRadius = Math.sqrt(labelHalfWidth * labelHalfWidth + approxLabelHeight * approxLabelHeight);

  // Dynamic collision footprint with 16px safety padding
  return Math.max(nodeRadius + 16, labelCollisionRadius + 14);
}

/**
 * Configure graph forces on react-force-graph instance with tighter edge lengths.
 */
export function setupSpaciousGraphForces(fgInstance: any) {
  if (!fgInstance) return;

  // Charge repulsion force (reduced for tighter clusters)
  const chargeForce = fgInstance.d3Force("charge");
  if (chargeForce) {
    chargeForce.strength(-220).distanceMax(300);
  }

  // Link distance force (reduced for shorter edges)
  const linkForce = fgInstance.d3Force("link");
  if (linkForce) {
    linkForce.distance(65).strength(0.9);
  }
}

/**
 * Render node shape and soft-pill label background to prevent edge/label clipping & overlap.
 */
export function renderGroundedNodeAndLabel(
  node: any,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  options: {
    isSelected: boolean;
    inPath: boolean;
    isBridge: boolean;
    isBankOrUpi?: boolean;
    isExchange?: boolean;
    nodeColor?: string;
    opacity?: number;
  }
) {
  const { isSelected, inPath, isBridge, isBankOrUpi, isExchange, nodeColor = "#6b5344", opacity = 1 } = options;
  const label = node.label || node.name || "";
  ctx.globalAlpha = opacity;

  const radius = isBridge ? 12 : isSelected || inPath ? 8 : 6;

  // 1. Render Node Shape
  if (isBankOrUpi) {
    const dSize = radius * 1.25;
    ctx.beginPath();
    ctx.moveTo(node.x, node.y - dSize);
    ctx.lineTo(node.x + dSize, node.y);
    ctx.lineTo(node.x, node.y + dSize);
    ctx.lineTo(node.x - dSize, node.y);
    ctx.closePath();
    ctx.fillStyle = nodeColor;
    ctx.fill();
  } else if (isExchange) {
    const hSize = radius * 1.35;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const x = node.x + hSize * Math.cos(angle);
      const y = node.y + hSize * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = nodeColor;
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = isBridge ? "#d97706" : nodeColor;
    ctx.fill();
  }

  // 2. Render Node Outlines
  if (isBridge) {
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 3 / globalScale;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(node.x, node.y, radius + 4 / globalScale, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(217, 119, 6, 0.45)";
    ctx.lineWidth = 2 / globalScale;
    ctx.stroke();
  } else if (isSelected || inPath) {
    ctx.strokeStyle = "#2c2416";
    ctx.lineWidth = 2 / globalScale;
    ctx.stroke();
  }

  // 3. Render Wrapped Label with Soft Protective Background Halo
  const fontSize = Math.max(10 / globalScale, 3.5);
  ctx.font = `${isBridge ? "bold " : "600 "}${isBridge ? fontSize * 1.1 : fontSize}px Source Sans 3, sans-serif`;

  const lines = wrapLabelText(label, 16);
  const lineHeight = fontSize * 1.25;

  let maxLineWidth = 0;
  lines.forEach((line) => {
    const w = ctx.measureText(line).width;
    if (w > maxLineWidth) maxLineWidth = w;
  });

  const padX = 5 / globalScale;
  const padY = 2 / globalScale;
  const totalBoxHeight = lines.length * lineHeight;
  const labelStartY = node.y + radius + 4 / globalScale;

  // Background Halo Pill for maximum legibility over edges/other nodes
  ctx.fillStyle = "rgba(252, 251, 249, 0.88)";
  ctx.fillRect(
    node.x - maxLineWidth / 2 - padX,
    labelStartY - padY,
    maxLineWidth + padX * 2,
    totalBoxHeight + padY * 2
  );
  ctx.strokeStyle = "rgba(229, 228, 223, 0.8)";
  ctx.lineWidth = 0.8 / globalScale;
  ctx.strokeRect(
    node.x - maxLineWidth / 2 - padX,
    labelStartY - padY,
    maxLineWidth + padX * 2,
    totalBoxHeight + padY * 2
  );

  // Render Label Text
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = isBridge ? "#92400e" : "#1c1917";

  lines.forEach((line, idx) => {
    ctx.fillText(line, node.x, labelStartY + idx * lineHeight);
  });

  ctx.globalAlpha = 1;
}
