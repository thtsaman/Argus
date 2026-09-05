import React from "react";
import { createDeterministicPrng } from "@/lib/integrity/hash";

export interface IntegrityFingerprintProps {
  integrityId: string;
  fingerprintSeed?: string;
  size?: number;
  animated?: boolean;
  variant?: "default" | "verified" | "mismatch";
  progress?: number; // 0 to 100 progressive reconstruction percentage
  scanLine?: boolean; // Show forensic scanning line
  className?: string;
}

export function IntegrityFingerprint({
  integrityId,
  fingerprintSeed,
  size = 180,
  animated = false,
  variant = "default",
  progress = 100,
  scanLine = false,
  className = "",
}: IntegrityFingerprintProps) {
  const seed = fingerprintSeed || integrityId || "ARGUS-INTEGRITY-SEED";
  const prng = createDeterministicPrng(seed);

  // Generate deterministic parameters
  const ringCount = 18 + Math.floor(prng() * 8); // 18-25 concentric rings
  const colorStroke =
    variant === "mismatch"
      ? "#991b1b"
      : variant === "verified"
      ? "#065f46"
      : "#92400e";

  const colorAccent =
    variant === "mismatch"
      ? "#dc2626"
      : variant === "verified"
      ? "#059669"
      : "#d97706";

  const paths: { d: string; strokeWidth: number; opacity: number; visible: boolean }[] = [];

  const center = size / 2;
  const maxRadius = size * 0.44;
  const visibleRingLimit = Math.ceil((ringCount * Math.min(100, Math.max(0, progress))) / 100);

  for (let i = 1; i <= ringCount; i++) {
    const radius = (i / ringCount) * maxRadius;
    const points: { x: number; y: number }[] = [];
    const numPoints = 12 + (i % 4) * 4;
    const distortionFactor = (prng() - 0.5) * 8 * (i / ringCount);

    for (let p = 0; p < numPoints; p++) {
      const angle = (p / numPoints) * Math.PI * 2;
      const r = radius + Math.sin(angle * (3 + (i % 3))) * distortionFactor;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      points.push({ x, y });
    }

    // Build smooth cubic SVG path
    let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let p = 0; p < points.length; p++) {
      const curr = points[p];
      const next = points[(p + 1) % points.length];
      const mx = (curr.x + next.x) / 2;
      const my = (curr.y + next.y) / 2;
      d += ` Q ${curr.x.toFixed(2)} ${curr.y.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
    }
    d += " Z";

    const strokeWidth = 0.8 + (i % 3) * 0.4;
    const opacity = 0.35 + (i / ringCount) * 0.55;
    const visible = i <= visibleRingLimit;
    paths.push({ d, strokeWidth, opacity, visible });
  }

  // Microtext ring details
  const microtext = `ARGUS · INTEGRITY · ${integrityId.slice(0, 16)} · SEALED`;

  // Calculate scan line Y coordinate based on progress
  const scanLineY = scanLine && progress < 100 ? (progress / 100) * size : -20;

  return (
    <div
      className={`relative flex flex-col items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Deterministic visual representation of Integrity ID ${integrityId}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={`overflow-visible ${animated ? "transition-all duration-700" : ""}`}
      >
        {/* Outer Guilloche Security Frame Ring */}
        <circle
          cx={center}
          cy={center}
          r={maxRadius + 4}
          fill="none"
          stroke={colorStroke}
          strokeWidth={0.8}
          strokeDasharray="3 3"
          opacity={progress >= 20 ? 0.4 : 0.1}
          className="transition-opacity duration-300"
        />
        <circle
          cx={center}
          cy={center}
          r={maxRadius + 8}
          fill="none"
          stroke={colorAccent}
          strokeWidth={0.5}
          opacity={progress >= 10 ? 0.25 : 0.05}
          className="transition-opacity duration-300"
        />

        {/* Microtext Path Circle */}
        <path
          id={`microtext-path-${integrityId.replace(/[^a-zA-Z0-9]/g, "")}`}
          d={`M ${center - maxRadius - 2}, ${center} a ${maxRadius + 2},${maxRadius + 2} 0 1,1 ${
            (maxRadius + 2) * 2
          },0 a ${maxRadius + 2},${maxRadius + 2} 0 1,1 -${(maxRadius + 2) * 2},0`}
          fill="none"
        />
        <text
          fontSize={Math.max(6, size * 0.035)}
          fill={colorStroke}
          opacity={progress >= 80 ? 0.5 : 0.1}
          className="font-mono uppercase font-bold tracking-widest transition-opacity duration-500"
        >
          <textPath href={`#microtext-path-${integrityId.replace(/[^a-zA-Z0-9]/g, "")}`}>
            {microtext}
          </textPath>
        </text>

        {/* Concentric Forensic Fingerprint Geometry */}
        {paths.map((p, idx) => (
          <path
            key={idx}
            d={p.d}
            fill="none"
            stroke={idx % 4 === 0 ? colorAccent : colorStroke}
            strokeWidth={p.strokeWidth}
            opacity={p.visible ? p.opacity : 0}
            strokeDasharray={p.visible ? "none" : "1 8"}
            className="transition-opacity duration-300"
          />
        ))}

        {/* Core Identity Geometry */}
        {progress >= 70 && (
          <>
            <circle cx={center} cy={center} r={4} fill={colorAccent} opacity={0.9} />
            <circle cx={center} cy={center} r={9} fill="none" stroke={colorStroke} strokeWidth={1} />
          </>
        )}

        {/* Forensic Scan Line */}
        {scanLine && progress > 0 && progress < 100 && (
          <g className="pointer-events-none">
            <line
              x1={0}
              y1={scanLineY}
              x2={size}
              y2={scanLineY}
              stroke={colorAccent}
              strokeWidth={1}
              strokeDasharray="4 2"
              opacity={0.7}
            />
            <line
              x1={center - 20}
              y1={scanLineY}
              x2={center + 20}
              y2={scanLineY}
              stroke={colorAccent}
              strokeWidth={2}
              opacity={0.9}
            />
          </g>
        )}
      </svg>
    </div>
  );
}
