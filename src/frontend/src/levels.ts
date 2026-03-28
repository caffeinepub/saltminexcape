export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LevelData {
  platforms: Platform[];
  koolaidPositions: { x: number; y: number }[];
  bearPosition: { x: number; y: number };
  exitPosition: { x: number; y: number };
}

const W = 480;
const H = 640;

const FLOOR_H = 8;
const PLATFORM_H = 8;

export function generateRandomPlatforms(levelIdx: number): Platform[] {
  // Use levelIdx as part of seed for variety but keep deterministic per level instance
  // Actually we want true random each game, so just use Math.random()
  void levelIdx;
  const plats: Platform[] = [];

  // Bottom floor - always present, full width
  plats.push({ x: 0, y: H - 40, w: W, h: FLOOR_H });

  // 6 rows above floor, spaced ~90px apart
  // Row 0 (lowest above floor) to row 5 (highest before bear platform)
  const rowYs = [H - 130, H - 220, H - 310, H - 400, H - 490];

  for (let row = 0; row < rowYs.length; row++) {
    const rowY = rowYs[row];
    const numSegs = Math.random() < 0.4 ? 2 : 3;
    generateRowPlatforms(plats, rowY, W, PLATFORM_H, numSegs);
  }

  // Top bear platform - single wide platform
  plats.push({ x: 60, y: H - 580, w: 360, h: PLATFORM_H });

  return plats;
}

function generateRowPlatforms(
  plats: Platform[],
  rowY: number,
  W: number,
  h: number,
  numSegs: number,
) {
  // Generate numSegs platforms across the width with guaranteed gaps of at least 60px
  // Total gap space: at least numSegs * 60
  // We'll place segments and gaps randomly
  const minGap = 65;
  const minSegW = 60;
  const maxTotalGap = W - numSegs * minSegW;

  if (maxTotalGap < numSegs * minGap) {
    // Fallback: 2 segments
    const seg1W = 120 + Math.floor(Math.random() * 60);
    const seg2W = 120 + Math.floor(Math.random() * 60);
    const gapW = W - seg1W - seg2W;
    const gapPos = Math.floor(gapW * 0.3 + Math.random() * gapW * 0.4);
    plats.push({ x: 0, y: rowY, w: gapPos, h });
    plats.push({
      x: gapPos + (W - seg1W - seg2W - gapPos + gapPos),
      y: rowY,
      w: seg2W,
      h,
    });
    return;
  }

  // Distribute gaps randomly
  // Build array of segment widths and gap widths alternating: [seg, gap, seg, gap, ..., seg]
  // with possible leading/trailing edge gaps
  const positions: { x: number; w: number }[] = [];
  let cursor = 0;

  // Randomly decide if there's a leading gap
  const leadGap =
    Math.random() < 0.5 ? minGap + Math.floor(Math.random() * 40) : 0;
  cursor = leadGap;

  for (let i = 0; i < numSegs; i++) {
    const remaining = W - cursor;
    const segsLeft = numSegs - i;
    const gapsLeft = segsLeft - 1;
    const trailGap =
      i === numSegs - 1
        ? Math.random() < 0.5
          ? minGap + Math.floor(Math.random() * 30)
          : 0
        : 0;
    const minNeeded = segsLeft * minSegW + gapsLeft * minGap + trailGap;
    const maxSegW = remaining - minNeeded + minSegW;
    const segW =
      minSegW + Math.floor(Math.random() * Math.max(1, maxSegW - minSegW + 20));
    const clampedW = Math.min(segW, remaining - minNeeded + minSegW, 180);
    const finalW = Math.max(minSegW, clampedW);

    if (cursor + finalW <= W) {
      positions.push({ x: cursor, w: finalW });
      cursor += finalW;

      if (i < numSegs - 1) {
        // Add gap
        const maxG =
          remaining -
          finalW -
          (segsLeft - 1) * minSegW -
          (gapsLeft - 1) * minGap;
        const gapW =
          minGap + Math.floor(Math.random() * Math.max(1, maxG - minGap));
        cursor += Math.min(gapW, 120);
      }
    }
  }

  // Ensure at least 2 segments generated
  if (positions.length < 2) {
    plats.push({ x: 0, y: rowY, w: 150, h });
    plats.push({ x: 290, y: rowY, w: 150, h });
    return;
  }

  for (const pos of positions) {
    if (pos.w > 0 && pos.x + pos.w <= W + 5) {
      plats.push({ x: pos.x, y: rowY, w: Math.min(pos.w, W - pos.x), h });
    }
  }
}

// Static platform layouts kept for compatibility, but game uses generateRandomPlatforms
export const LEVELS: LevelData[] = [
  // Level 1
  {
    platforms: [],
    koolaidPositions: [],
    bearPosition: { x: 200, y: H - 620 },
    exitPosition: { x: 220, y: H - 615 },
  },
  // Level 2
  {
    platforms: [],
    koolaidPositions: [],
    bearPosition: { x: 200, y: H - 620 },
    exitPosition: { x: 220, y: H - 615 },
  },
  // Level 3
  {
    platforms: [],
    koolaidPositions: [],
    bearPosition: { x: 200, y: H - 620 },
    exitPosition: { x: 220, y: H - 615 },
  },
  // Level 4
  {
    platforms: [],
    koolaidPositions: [],
    bearPosition: { x: 200, y: H - 620 },
    exitPosition: { x: 220, y: H - 615 },
  },
  // Level 5
  {
    platforms: [],
    koolaidPositions: [],
    bearPosition: { x: 200, y: H - 620 },
    exitPosition: { x: 220, y: H - 615 },
  },
  // Level 6
  {
    platforms: [],
    koolaidPositions: [],
    bearPosition: { x: 200, y: H - 620 },
    exitPosition: { x: 220, y: H - 615 },
  },
  // Level 7
  {
    platforms: [],
    koolaidPositions: [],
    bearPosition: { x: 200, y: H - 620 },
    exitPosition: { x: 220, y: H - 615 },
  },
  // Level 8
  {
    platforms: [],
    koolaidPositions: [],
    bearPosition: { x: 200, y: H - 620 },
    exitPosition: { x: 220, y: H - 615 },
  },
];

export const ICP_PRICES = [15, 22, 31, 45, 62, 85, 110, 150];
