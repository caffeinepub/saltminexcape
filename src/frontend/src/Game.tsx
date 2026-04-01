import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LEVELS, generateRandomPlatforms } from "./levels";
import type { LevelData, Platform } from "./levels";
import { createSFX } from "./sfx";

const CANVAS_W = 480;
const CANVAS_H = 640;

type GameScreen =
  | "TITLE"
  | "INTRO"
  | "PLAYING"
  | "YEAR_COMPLETE"
  | "GAME_OVER"
  | "VICTORY";

interface Player {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: 1 | -1;
  state: "idle" | "run" | "jump" | "hit" | "victory" | "attacking" | "dying";
  hitTimer: number;
  attackTimer: number;
  attackClangPlayed: boolean;
  frame: number;
  frameTimer: number;
}

interface Hazard {
  id: number;
  type:
    | "boulder"
    | "redCandle"
    | "greenCandle"
    | "pickaxe"
    | "cart"
    | "barrel"
    | "doompost"
    | "chest"
    | "saltbag";
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  onGround: boolean;
  wasOnGround: boolean;
  rotation: number;
  frame: number;
  fallsThrough?: boolean;
  flagged?: "explode" | "fade";
  flagTimer?: number;
}

interface WaterBottle {
  x: number;
  y: number;
  collected: boolean;
}

interface MaturityBag {
  id: number;
  x: number;
  y: number;
  lifetime: number;
  maxLifetime: number;
  amount: number;
  collected: boolean;
}

interface CommunityBag {
  id: number;
  x: number;
  y: number;
  lifetime: number;
  maxLifetime: number;
  collected: boolean;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  timer: number;
  color: string;
}

interface AxePickup {
  x: number;
  y: number;
  vy: number;
  collected: boolean;
  landed: boolean;
}

interface GunPickup {
  x: number;
  y: number;
  collected: boolean;
}

interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  w: number;
  h: number;
  lifetime: number;
}

interface ExplosionProjectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
  maxLifetime: number;
}

interface SpawnerState {
  timer: number;
}

interface GameState {
  screen: GameScreen;
  introPage: number;
  level: number;
  lives: number;
  portfolioValue: number;
  saltMeter: number; // 0-100
  player: Player;
  hazards: Hazard[];
  waterBottles: WaterBottle[];
  spawnerStates: SpawnerState[];
  hasAxe: boolean;
  axeTimer: number;
  axePickups: AxePickup[];
  portfolioMultiplier: number;
  maturityBags: MaturityBag[];
  communityBags: CommunityBag[];
  floatingTexts: FloatingText[];
  maturitySpawnTimer: number;
  nextMaturityId: number;
  nextFloatTextId: number;
  debuffTimer: number;
  bearThrowTimer: number;
  nextHazardId: number;
  frameCount: number;
  currentPlatforms: Platform[];
  levelComplete: boolean;
  victoryTimer: number;
  bearArmRaise: number;
  particleTimer: number;
  steamParticles: { x: number; y: number; vy: number; alpha: number }[];
  keys: Set<string>;
  sfxQueue: string[];
  footstepTimer: number;
  bottleWarningTimer: number;
  bearThrowAnim: number;
  levelTransitionAlpha: number;
  dyingTimer: number;
  bearX: number;
  bearDir: number;
  bearWalkFrame: number;
  hasGun: boolean;
  gunTimer: number;
  gunCooldown: number;
  gunPickups: GunPickup[];
  bullets: Bullet[];
  nextBulletId: number;
  explosionProjectiles: ExplosionProjectile[];
  nextExplosionId: number;
}

const PLAYER_W = 24;
const PLAYER_H = 36;
const GRAVITY = 0.45;
const JUMP_VY = -10.5;
const BASE_WALK = 2.6;

function makePlayer(_levelIdx: number): Player {
  return {
    x: 30,
    y: CANVAS_H - 40 - PLAYER_H,
    w: PLAYER_W,
    h: PLAYER_H,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    state: "idle",
    hitTimer: 0,
    attackTimer: 0,
    attackClangPlayed: false,
    frame: 0,
    frameTimer: 0,
  };
}

function initLevel(gs: GameState, levelIdx: number) {
  gs.player = makePlayer(levelIdx);
  gs.hazards = [];
  gs.spawnerStates = [];
  gs.hasAxe = false;
  gs.axeTimer = 0;
  gs.axePickups = [];
  gs.portfolioMultiplier = 1.0;
  gs.maturityBags = [];
  gs.communityBags = [];
  gs.floatingTexts = [];
  gs.maturitySpawnTimer = 0;
  gs.debuffTimer = 0;
  gs.bearThrowTimer = 0;
  gs.nextHazardId = 1;
  gs.levelComplete = false;
  gs.victoryTimer = 0;
  gs.bearArmRaise = 0;
  gs.sfxQueue = [];
  gs.footstepTimer = 0;
  gs.bottleWarningTimer = 0;
  gs.bearThrowAnim = 0;
  gs.levelTransitionAlpha = 1.0;
  gs.dyingTimer = 0;
  gs.bearX = 200;
  gs.bearDir = 1;
  gs.bearWalkFrame = 0;
  gs.hasGun = false;
  gs.gunTimer = 0;
  gs.gunCooldown = 0;
  gs.gunPickups = [];
  gs.bullets = [];
  gs.nextBulletId = 1;
  gs.explosionProjectiles = [];
  gs.nextExplosionId = 1;

  // Generate random platforms for this level run
  gs.currentPlatforms = generateRandomPlatforms(levelIdx);

  // Place kool-aid bottles randomly on platforms
  const placementPlats = gs.currentPlatforms.filter(
    (p) => p.y < CANVAS_H - 30 && p.w > 20,
  );
  const numBottles = 2 + levelIdx; // grows from 2 (level 1) to 9 (level 8)
  gs.waterBottles = [];
  const usedPlats = new Set<number>();
  for (let i = 0; i < numBottles && i < placementPlats.length; i++) {
    let platIdx: number;
    let tries = 0;
    do {
      platIdx = Math.floor(Math.random() * placementPlats.length);
      tries++;
    } while (usedPlats.has(platIdx) && tries < 20);
    usedPlats.add(platIdx);
    const plat = placementPlats[platIdx];
    gs.waterBottles.push({
      x: plat.x + 10 + Math.random() * Math.max(0, plat.w - 20),
      y: plat.y - 18,
      collected: false,
    });
  }

  // Place axe pickups randomly on mid platforms
  const midPlats = gs.currentPlatforms.filter(
    (p) => p.y < CANVAS_H - 50 && p.y > CANVAS_H - 550,
  );
  const numAxes = 1 + Math.floor(levelIdx / 4);
  gs.axePickups = [];
  for (let i = 0; i < Math.min(numAxes, 2); i++) {
    const plat = midPlats[Math.floor(Math.random() * midPlats.length)];
    if (plat) {
      gs.axePickups.push({
        x: plat.x + 20 + Math.random() * Math.max(0, plat.w - 40),
        y: plat.y - 16,
        vy: 0,
        collected: false,
        landed: true,
      });
    }
  }

  // Spawn gun pickup on a random mid platform (different from axe)
  const gunPlats = gs.currentPlatforms.filter(
    (p) => p.y < CANVAS_H - 50 && p.y > CANVAS_H - 550,
  );
  if (gunPlats.length > 0) {
    const plat = gunPlats[Math.floor(Math.random() * gunPlats.length)];
    gs.gunPickups.push({
      x: plat.x + 20 + Math.random() * Math.max(0, plat.w - 40),
      y: plat.y - 16,
      collected: false,
    });
  }
}

function rectOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function updateGame(gs: GameState, _dt: number) {
  if (gs.screen !== "PLAYING") return;

  // Dying animation sequence
  if (gs.dyingTimer > 0) {
    gs.dyingTimer--;
    if (gs.dyingTimer === 0) {
      initLevel(gs, gs.level);
    }
    return;
  }

  // Level transition fade
  if (gs.levelTransitionAlpha > 0) {
    gs.levelTransitionAlpha = Math.max(0, gs.levelTransitionAlpha - 0.025);
  }

  // Bear throw animation countdown
  if (gs.bearThrowAnim > 0) gs.bearThrowAnim--;
  gs.frameCount++;

  // Bear walking across top platform
  const BEAR_PLATFORM_LEFT = 75;
  const BEAR_PLATFORM_RIGHT = 395;
  if (gs.bearThrowAnim === 0) {
    gs.bearX += gs.bearDir * 0.67;
    gs.bearWalkFrame++;
    if (gs.bearX <= BEAR_PLATFORM_LEFT) {
      gs.bearX = BEAR_PLATFORM_LEFT;
      gs.bearDir = 1;
    } else if (gs.bearX >= BEAR_PLATFORM_RIGHT) {
      gs.bearX = BEAR_PLATFORM_RIGHT;
      gs.bearDir = -1;
    }
  } else {
    gs.bearWalkFrame = 0;
  }
  if (gs.bottleWarningTimer > 0) gs.bottleWarningTimer--;
  const level = LEVELS[gs.level];
  const p = gs.player;

  // Salt meter decay
  gs.saltMeter = Math.max(0, gs.saltMeter - 0.3);

  // Speed modifier
  const walkSpeed =
    gs.debuffTimer > 0
      ? BASE_WALK * 0.5
      : gs.saltMeter >= 100
        ? BASE_WALK * 0.6
        : BASE_WALK;
  const effectiveJumpVy = gs.debuffTimer > 0 ? JUMP_VY * 0.65 : JUMP_VY;

  // Bear arm animation
  gs.bearArmRaise = (gs.bearArmRaise + 0.04) % (Math.PI * 2);

  // Hit timer
  if (p.hitTimer > 0) p.hitTimer--;

  // Ladder system removed - vertical movement via platform gaps only

  // Controls
  const left = gs.keys.has("ArrowLeft");
  const right = gs.keys.has("ArrowRight");
  const jumping = gs.keys.has("Space") || gs.keys.has("KeyZ");

  // AxeSmash: proactive range smash from gamepad B button
  if (gs.keys.has("AxeSmash") && gs.hasAxe && p.hitTimer === 0) {
    const smashed: number[] = [];
    for (let i = 0; i < gs.hazards.length; i++) {
      const h = gs.hazards[i];
      const dist = Math.hypot(
        h.x + h.w / 2 - (p.x + p.w / 2),
        h.y + h.h / 2 - (p.y + p.h / 2),
      );
      if (dist < 60) smashed.push(i);
    }
    // Always trigger animation on press (not held)
    if (p.attackTimer === 0) {
      gs.sfxQueue.push("axe_whoosh");
      p.attackTimer = 20;
      p.attackClangPlayed = smashed.length === 0; // skip clang if nothing to smash
    }
    if (smashed.length > 0) {
      for (let si = smashed.length - 1; si >= 0; si--) {
        const idx = smashed[si];
        const h = gs.hazards[idx];
        if (h.type === "chest") {
          gs.portfolioMultiplier = Math.min(2.5, gs.portfolioMultiplier + 0.15);
          gs.portfolioValue += 2000;
          gs.sfxQueue.push("chest_good");
        } else if (h.type !== "greenCandle" && h.type !== "redCandle") {
          gs.portfolioValue += 150;
        }
        gs.hazards.splice(idx, 1);
      }
    }
  }
  // Gun shoot when has gun (and not axe)
  if (gs.keys.has("AxeSmash") && gs.hasGun && !gs.hasAxe && p.hitTimer === 0) {
    if (gs.gunCooldown <= 0) {
      gs.sfxQueue.push("powerup");
      gs.bullets.push({
        id: gs.nextBulletId++,
        x: p.x + (p.facing === 1 ? p.w : -16),
        y: p.y + p.h / 2 - 3,
        vx: p.facing * 8,
        w: 16,
        h: 6,
        lifetime: 60,
      });
      gs.gunCooldown = 15;
    }
  }
  if (gs.gunCooldown > 0) gs.gunCooldown--;

  // Horizontal
  if (left) {
    p.vx = -walkSpeed;
    p.facing = -1;
  } else if (right) {
    p.vx = walkSpeed;
    p.facing = 1;
  } else p.vx = 0;

  // Jump
  if (jumping && p.onGround) {
    p.vy = effectiveJumpVy;
    p.onGround = false;
    gs.sfxQueue.push("jump");
  }

  // Gravity
  p.vy += GRAVITY;

  // Move player
  p.x += p.vx;
  p.y += p.vy;

  // Wall bounds
  if (p.x < 0) p.x = 0;
  if (p.x + p.w > CANVAS_W) p.x = CANVAS_W - p.w;

  // Platform collisions (one-way: can jump up through, land when falling)
  const wasAirborne = !p.onGround;
  p.onGround = false;
  for (const plat of gs.currentPlatforms) {
    if (p.x + p.w > plat.x && p.x < plat.x + plat.w) {
      const prevBottom = p.y + p.h - p.vy;
      if (p.vy >= 0 && prevBottom <= plat.y + 2 && p.y + p.h >= plat.y) {
        p.y = plat.y - p.h;
        p.vy = 0;
        p.onGround = true;
      }
    }
  }

  // Land sound
  if (wasAirborne && p.onGround) {
    gs.sfxQueue.push("land");
  }

  // Fall off screen
  if (p.y > CANVAS_H) {
    loseLife(gs);
    return;
  }

  // Decrement attack timer
  if (p.attackTimer > 0) {
    p.attackTimer--;
    if (p.attackTimer === 10 && !p.attackClangPlayed) {
      p.attackClangPlayed = true;
      gs.sfxQueue.push("axe_clang");
    }
  }

  // Player state
  if (p.hitTimer > 0) p.state = "hit";
  else if (p.attackTimer > 0) p.state = "attacking";
  else if (gs.levelComplete) p.state = "victory";
  else if (!p.onGround) p.state = "jump";
  else if (p.vx !== 0) p.state = "run";
  else p.state = "idle";

  // Footstep sound
  if (p.state === "run" && p.onGround) {
    gs.footstepTimer++;
    if (gs.footstepTimer >= 8) {
      gs.footstepTimer = 0;
      gs.sfxQueue.push("footstep");
    }
  } else {
    gs.footstepTimer = 0;
  }

  // Animate frames
  p.frameTimer++;
  if (p.frameTimer > 6) {
    p.frame = (p.frame + 1) % 4;
    p.frameTimer = 0;
  }

  // Bear throw system - all hazards thrown from bear position
  const bearThrowInterval = Math.max(30, 120 - gs.level * 12);
  gs.bearThrowTimer++;
  if (gs.bearThrowTimer >= bearThrowInterval) {
    gs.bearThrowTimer = 0;
    gs.bearThrowAnim = 35;
    gs.sfxQueue.push("bear_throw");
    const bearCx = gs.bearX + 21;
    const bearCy = level.bearPosition.y;

    const roll = Math.random();
    type HazType =
      | "boulder"
      | "redCandle"
      | "greenCandle"
      | "pickaxe"
      | "cart"
      | "barrel"
      | "doompost"
      | "chest"
      | "saltbag";
    let hType: HazType;
    if (roll < 0.15) {
      hType = "chest";
    } else if (roll < 0.3) {
      hType = "redCandle";
    } else if (roll < 0.42) {
      hType = "greenCandle";
    } else {
      const types: HazType[] = [
        "boulder",
        "cart",
        "barrel",
        "doompost",
        "saltbag",
        "boulder",
        "boulder",
      ];
      hType = types[Math.floor(Math.random() * types.length)];
    }

    const hw =
      hType === "cart"
        ? 32
        : hType === "redCandle" || hType === "greenCandle"
          ? 18
          : hType === "boulder"
            ? 20
            : hType === "chest"
              ? 22
              : hType === "pickaxe"
                ? 20
                : hType === "saltbag"
                  ? 20
                  : hType === "barrel"
                    ? 16
                    : 14;
    const hh =
      hType === "cart"
        ? 22
        : hType === "redCandle" || hType === "greenCandle"
          ? 24
          : hType === "boulder"
            ? 20
            : hType === "chest"
              ? 18
              : hType === "pickaxe"
                ? 20
                : hType === "saltbag"
                  ? 22
                  : hType === "barrel"
                    ? 18
                    : 18;

    const throwDir = Math.random() < 0.5 ? -1 : 1;
    const throwVx = throwDir * (1.5 + Math.random() * 1.0 + gs.level * 0.2);

    const fallsThrough =
      (hType === "redCandle" && Math.random() < 0.5) ||
      (hType === "greenCandle" && Math.random() < 0.3);
    gs.hazards.push({
      id: gs.nextHazardId++,
      type: hType,
      x: bearCx - hw / 2,
      y: bearCy,
      vx: throwVx,
      vy: -4,
      w: hw,
      h: hh,
      onGround: false,
      wasOnGround: false,
      rotation: 0,
      frame: 0,
      fallsThrough,
    });
  }

  // Update hazards
  const toRemove: number[] = [];
  for (let i = 0; i < gs.hazards.length; i++) {
    const h = gs.hazards[i];
    const isPickaxe = h.type === "pickaxe";

    if (!isPickaxe) {
      // Gravity for rolling hazards
      h.vy += GRAVITY * 0.7;
      h.x += h.vx;
      h.y += h.vy;
      h.rotation += h.vx * 0.08;

      // Platform collision (flat one-way)
      h.wasOnGround = h.onGround;
      h.onGround = false;
      for (const plat of gs.currentPlatforms) {
        if (h.fallsThrough) break; // Phase-through candles ignore platforms
        if (h.x + h.w > plat.x && h.x < plat.x + plat.w) {
          const prevB = h.y + h.h - h.vy;
          if (h.vy >= 0 && prevB <= plat.y + 2 && h.y + h.h >= plat.y) {
            h.y = plat.y - h.h;
            h.vy = 0;
            h.onGround = true;
            // Only randomize direction when FIRST landing on a new platform
            if (!h.wasOnGround) {
              const rollSpeed = Math.max(Math.abs(h.vx), 2.2 + gs.level * 0.3);
              h.vx = (Math.random() < 0.5 ? -1 : 1) * rollSpeed;
            }
            // Maintain rolling speed while on ground (don't let friction stop it)
            if (Math.abs(h.vx) < 1.5) {
              h.vx = (h.vx >= 0 ? 1 : -1) * (1.5 + gs.level * 0.1);
            }
          }
        }
      }

      // Bounce off walls
      if (h.x < 0) {
        h.x = 0;
        h.vx = Math.abs(h.vx);
      }
      if (h.x + h.w > CANVAS_W) {
        h.x = CANVAS_W - h.w;
        h.vx = -Math.abs(h.vx);
      }

      // Remove if off bottom
      if (h.y > CANVAS_H + 20) {
        toRemove.push(i);
        continue;
      }
    } else {
      // Pickaxe falls straight down
      h.y += h.vy;
      h.vy += GRAVITY * 0.3;
      for (const plat of gs.currentPlatforms) {
        if (h.x + h.w > plat.x && h.x < plat.x + plat.w) {
          const prevB = h.y + h.h - h.vy;
          if (prevB <= plat.y && h.y + h.h >= plat.y) {
            toRemove.push(i);
            break;
          }
        }
      }
      if (h.y > CANVAS_H) {
        toRemove.push(i);
        continue;
      }
    }

    // Near-miss salt increase
    const dist = Math.hypot(
      h.x + h.w / 2 - (p.x + p.w / 2),
      h.y + h.h / 2 - (p.y + p.h / 2),
    );
    if (
      dist < 24 &&
      p.hitTimer === 0 &&
      h.type !== "chest" &&
      h.type !== "greenCandle" &&
      h.type !== "redCandle"
    ) {
      gs.saltMeter = Math.min(100, gs.saltMeter + 0.3);
    }

    // Hit detection - skip if level already complete (portal immunity)
    if (gs.levelComplete) continue;
    if (rectOverlap(p.x + 2, p.y + 2, p.w - 4, p.h - 4, h.x, h.y, h.w, h.h)) {
      // Chest interaction
      if (h.type === "chest") {
        if (gs.hasAxe) {
          gs.portfolioMultiplier = Math.min(2.5, gs.portfolioMultiplier + 0.15);
          gs.portfolioValue += 2000;
          p.hitTimer = 10;
          gs.sfxQueue.push("axe_smash");
          gs.sfxQueue.push("chest_good");
        } else {
          gs.portfolioMultiplier = Math.max(0.3, gs.portfolioMultiplier - 0.12);
          gs.saltMeter = Math.min(100, gs.saltMeter + 25);
          gs.debuffTimer = 300;
          p.hitTimer = 40;
          gs.sfxQueue.push("chest_bad");
        }
        toRemove.push(i);
        continue;
      }

      // Green candle - boosts portfolio, no damage
      if (h.type === "greenCandle") {
        gs.portfolioMultiplier = Math.min(
          2.5,
          gs.portfolioMultiplier + 0.08 + Math.random() * 0.04,
        );
        gs.floatingTexts.push({
          id: gs.nextFloatTextId++,
          x: h.x,
          y: h.y - 10,
          text: "+Portfolio!",
          timer: 90,
          color: "#00ff88",
        });
        toRemove.push(i);
        continue;
      }
      // Red candle - hurts portfolio, no physical damage
      if (h.type === "redCandle") {
        gs.portfolioMultiplier = Math.max(
          0.3,
          gs.portfolioMultiplier - 0.06 - Math.random() * 0.04,
        );
        gs.floatingTexts.push({
          id: gs.nextFloatTextId++,
          x: h.x,
          y: h.y - 10,
          text: "-Portfolio!",
          timer: 90,
          color: "#ff4444",
        });
        toRemove.push(i);
        continue;
      }

      // Axe smashes other hazards ONLY when actively swinging
      if (gs.hasAxe && p.attackTimer > 0 && p.hitTimer === 0) {
        gs.portfolioValue += 150;
        gs.sfxQueue.push("axe_swing");
        toRemove.push(i);
        continue;
      }

      // Salt bag - big salt meter hit but no life lost
      if (h.type === "saltbag" && p.hitTimer === 0) {
        gs.saltMeter = Math.min(100, gs.saltMeter + 35);
        gs.debuffTimer = 180;
        p.hitTimer = 50;
        gs.sfxQueue.push("hit");
        toRemove.push(i);
        continue;
      }

      // Normal hit
      if (p.hitTimer === 0) {
        gs.saltMeter = Math.min(100, gs.saltMeter + 15);
        p.hitTimer = 60;
        gs.sfxQueue.push("hit");
        loseLife(gs);
        return;
      }
    }
  }
  for (let i = toRemove.length - 1; i >= 0; i--) {
    gs.hazards.splice(toRemove[i], 1);
  }

  // Kool-Aid pickups
  for (const ka of gs.waterBottles) {
    if (!ka.collected && rectOverlap(p.x, p.y, p.w, p.h, ka.x, ka.y, 12, 18)) {
      ka.collected = true;
      gs.saltMeter = Math.max(0, gs.saltMeter - 30);
      gs.portfolioValue += 500;
      gs.sfxQueue.push("powerup");
    }
  }

  // Axe pickup - fall physics and collection
  for (const ap of gs.axePickups) {
    if (ap.collected) continue;
    if (!ap.landed) {
      ap.vy += GRAVITY * 0.6;
      ap.y += ap.vy;
      for (const plat of gs.currentPlatforms) {
        if (ap.x + 16 > plat.x && ap.x < plat.x + plat.w) {
          const prevB = ap.y + 16 - ap.vy;
          if (ap.vy >= 0 && prevB <= plat.y + 2 && ap.y + 16 >= plat.y) {
            ap.y = plat.y - 16;
            ap.vy = 0;
            ap.landed = true;
            break;
          }
        }
      }
      if (ap.y > CANVAS_H + 20) {
        ap.collected = true;
      }
    }
    if (!ap.collected && rectOverlap(p.x, p.y, p.w, p.h, ap.x, ap.y, 16, 16)) {
      ap.collected = true;
      gs.hasAxe = true;
      gs.axeTimer = 600;
      gs.sfxQueue.push("powerup");
    }
  }

  // Axe countdown
  if (gs.hasAxe) {
    gs.axeTimer--;
    if (gs.axeTimer <= 0) {
      gs.hasAxe = false;
      gs.axeTimer = 0;
    }
  }

  // Debuff countdown
  if (gs.debuffTimer > 0) gs.debuffTimer--;

  // Gun pickup collection
  for (const gp of gs.gunPickups) {
    if (gp.collected) continue;
    if (rectOverlap(p.x, p.y, p.w, p.h, gp.x, gp.y, 16, 16)) {
      gp.collected = true;
      gs.hasGun = true;
      gs.gunTimer = 500;
      gs.sfxQueue.push("powerup");
    }
  }
  // Gun countdown
  if (gs.hasGun) {
    gs.gunTimer--;
    if (gs.gunTimer <= 0) {
      gs.hasGun = false;
      gs.gunTimer = 0;
    }
  }

  // Update bullets
  const bulletsToRemove: number[] = [];
  for (let bi = 0; bi < gs.bullets.length; bi++) {
    const b = gs.bullets[bi];
    b.x += b.vx;
    b.lifetime--;
    if (b.lifetime <= 0 || b.x < -20 || b.x > CANVAS_W + 20) {
      bulletsToRemove.push(bi);
      continue;
    }
    // Check bullet vs hazards
    for (let hi = gs.hazards.length - 1; hi >= 0; hi--) {
      const h2 = gs.hazards[hi];
      if (rectOverlap(b.x, b.y, b.w, b.h, h2.x, h2.y, h2.w, h2.h)) {
        gs.portfolioValue += 200;
        gs.hazards.splice(hi, 1);
        bulletsToRemove.push(bi);
        gs.sfxQueue.push("axe_clang");
        break;
      }
    }
  }
  for (let i = bulletsToRemove.length - 1; i >= 0; i--) {
    gs.bullets.splice(bulletsToRemove[i], 1);
  }

  // Bottom platform pileup - flag hazards to explode/fade
  const bottomPlatY = Math.max(...gs.currentPlatforms.map((pl) => pl.y));
  const bottomHazards = gs.hazards.filter(
    (h) => h.onGround && h.y > bottomPlatY - 30 && !h.flagged,
  );
  if (bottomHazards.length > 3) {
    for (let i = 0; i < Math.min(bottomHazards.length - 2, 3); i++) {
      const h = bottomHazards[i];
      h.flagged = Math.random() < 0.5 ? "explode" : "fade";
      h.flagTimer = 80 + Math.floor(Math.random() * 40);
    }
  }

  // Update flagged hazards
  const flaggedToRemove: number[] = [];
  for (let i = 0; i < gs.hazards.length; i++) {
    const h = gs.hazards[i];
    if (!h.flagged || h.flagTimer === undefined) continue;
    h.flagTimer--;
    if (h.flagTimer <= 0) {
      if (h.flagged === "explode") {
        const cx = h.x + h.w / 2;
        const cy = h.y + h.h / 2;
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 5) {
          const speed = 3 + Math.random() * 2;
          gs.explosionProjectiles.push({
            id: gs.nextExplosionId++,
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            lifetime: 50,
            maxLifetime: 50,
          });
        }
        gs.sfxQueue.push("hit");
      }
      flaggedToRemove.push(i);
    }
  }
  for (let i = flaggedToRemove.length - 1; i >= 0; i--) {
    gs.hazards.splice(flaggedToRemove[i], 1);
  }

  // Update explosion projectiles
  const explProjToRemove: number[] = [];
  for (let ei = 0; ei < gs.explosionProjectiles.length; ei++) {
    const ep = gs.explosionProjectiles[ei];
    ep.x += ep.vx;
    ep.y += ep.vy;
    ep.vy += GRAVITY * 0.3;
    ep.lifetime--;
    if (ep.lifetime <= 0 || ep.x < -50 || ep.x > CANVAS_W + 50) {
      explProjToRemove.push(ei);
      continue;
    }
    // Damage player if close
    const epDist = Math.hypot(ep.x - (p.x + p.w / 2), ep.y - (p.y + p.h / 2));
    if (epDist < 24 && p.hitTimer === 0 && !gs.levelComplete) {
      gs.saltMeter = Math.min(100, gs.saltMeter + 20);
      p.hitTimer = 40;
      gs.sfxQueue.push("hit");
      loseLife(gs);
      return;
    }
  }
  for (let i = explProjToRemove.length - 1; i >= 0; i--) {
    gs.explosionProjectiles.splice(explProjToRemove[i], 1);
  }

  // Maturity bags spawn
  gs.maturitySpawnTimer++;
  if (gs.maturitySpawnTimer >= 240) {
    gs.maturitySpawnTimer = 0;
    const platList = gs.currentPlatforms.filter(
      (pl) => pl.y < CANVAS_H - 50 && pl.y > CANVAS_H - 550,
    );
    if (platList.length > 0) {
      const plat = platList[Math.floor(Math.random() * platList.length)];
      const amount = Math.floor(
        gs.portfolioValue * (0.04 + Math.random() * 0.06),
      );
      gs.maturityBags.push({
        id: gs.nextMaturityId++,
        x: plat.x + 10 + Math.random() * Math.max(0, plat.w - 20),
        y: plat.y - 18,
        lifetime: 480,
        maxLifetime: 480,
        amount,
        collected: false,
      });
      if (Math.random() < 0.08) {
        gs.communityBags.push({
          id: gs.nextMaturityId++,
          x: plat.x + 20 + Math.random() * Math.max(0, plat.w - 40),
          y: plat.y - 22,
          lifetime: 600,
          maxLifetime: 600,
          collected: false,
        });
      }
    }
  }

  // Maturity bag collection
  for (let mi = gs.maturityBags.length - 1; mi >= 0; mi--) {
    const mb = gs.maturityBags[mi];
    if (mb.collected) {
      gs.maturityBags.splice(mi, 1);
      continue;
    }
    mb.lifetime--;
    if (mb.lifetime <= 0) {
      gs.maturityBags.splice(mi, 1);
      continue;
    }
    if (rectOverlap(p.x, p.y, p.w, p.h, mb.x, mb.y, 16, 20)) {
      mb.collected = true;
      gs.portfolioValue += mb.amount;
      gs.floatingTexts.push({
        id: gs.nextFloatTextId++,
        x: mb.x,
        y: mb.y - 10,
        text: `+$${mb.amount.toLocaleString()}`,
        timer: 90,
        color: "#ffd700",
      });
      gs.sfxQueue.push("powerup");
    }
  }
  for (let ci = gs.communityBags.length - 1; ci >= 0; ci--) {
    const cb = gs.communityBags[ci];
    if (cb.collected) {
      gs.communityBags.splice(ci, 1);
      continue;
    }
    cb.lifetime--;
    if (cb.lifetime <= 0) {
      gs.communityBags.splice(ci, 1);
      continue;
    }
    if (rectOverlap(p.x, p.y, p.w, p.h, cb.x, cb.y, 22, 26)) {
      cb.collected = true;
      gs.portfolioValue += 30000;
      gs.floatingTexts.push({
        id: gs.nextFloatTextId++,
        x: cb.x,
        y: cb.y - 10,
        text: "+$30,000 GRANT!",
        timer: 120,
        color: "#00ff88",
      });
      gs.sfxQueue.push("chest_good");
    }
  }

  // FloatingText update
  for (let fi = gs.floatingTexts.length - 1; fi >= 0; fi--) {
    gs.floatingTexts[fi].timer--;
    gs.floatingTexts[fi].y -= 0.5;
    if (gs.floatingTexts[fi].timer <= 0) gs.floatingTexts.splice(fi, 1);
  }

  // Steam particles
  gs.particleTimer = (gs.particleTimer || 0) + 1;
  if (gs.saltMeter > 75 && gs.particleTimer % 4 === 0) {
    gs.steamParticles.push({
      x: p.x + p.w / 2 + (Math.random() - 0.5) * 8,
      y: p.y,
      vy: -1.2,
      alpha: 0.8,
    });
  }
  gs.steamParticles = gs.steamParticles.filter((sp) => sp.alpha > 0);
  for (const sp of gs.steamParticles) {
    sp.y += sp.vy;
    sp.alpha -= 0.02;
  }

  // Exit check
  const exit = level.exitPosition;
  if (
    !gs.levelComplete &&
    rectOverlap(p.x, p.y, p.w, p.h, exit.x - 16, exit.y - 16, 36, 36)
  ) {
    const allBottlesCollected = gs.waterBottles.every((k) => k.collected);
    if (allBottlesCollected) {
      gs.levelComplete = true;
      gs.portfolioValue += 1000;
      gs.sfxQueue.push("level_complete");
    } else {
      gs.bottleWarningTimer = 180;
      loseLife(gs);
    }
  }

  if (gs.levelComplete) {
    gs.victoryTimer++;
    if (gs.victoryTimer > 90) {
      if (gs.level >= 7) {
        gs.screen = "VICTORY";
      } else {
        gs.screen = "YEAR_COMPLETE";
      }
    }
  }
}

function loseLife(gs: GameState) {
  gs.lives--;
  if (gs.lives <= 0) {
    gs.sfxQueue.push("game_over");
    gs.screen = "GAME_OVER";
  } else {
    gs.sfxQueue.push("lose_life");
    gs.dyingTimer = 80;
    gs.player.state = "dying";
  }
}

// --- RENDERING ---

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: Player,
  saltMeter: number,
  hasAxe: boolean,
  axeTimer = 600,
  dyingTimer = 0,
) {
  const { x, y, facing, state, hitTimer, frame } = p;
  const flipped = facing === -1;

  ctx.save();
  if (flipped) {
    ctx.translate(x + p.w, y);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(x, y);
  }

  // Dying animation
  if (state === "dying" && dyingTimer > 0) {
    const progress = (80 - dyingTimer) / 80;
    const spin = progress * Math.PI * 3;
    const fallOffset = progress * progress * 60;
    ctx.globalAlpha = 1 - progress * 0.6;
    // We're already translated to (x,y) or flipped - apply spin around center
    ctx.translate(p.w / 2, p.h / 2 + fallOffset);
    ctx.rotate(spin);
    ctx.translate(-p.w / 2, -p.h / 2);
  }

  // Hit flash
  if (hitTimer > 0 && Math.floor(hitTimer / 4) % 2 === 0) {
    ctx.globalAlpha = 0.3;
  }

  const angry = saltMeter > 75;
  const veryAngry = saltMeter >= 100;
  const skinTone = "#7B4A2D";
  const skinShade = "#5a3520";
  const shirtBase = veryAngry ? "#cc2222" : "#d8d8d8";
  const shirtShade = veryAngry ? "#991a1a" : "#b0b0b0";

  if (state === "run") {
    // ===== SIDE PROFILE (facing right) =====
    // legSwing cycles -8 to +8: positive = front leg forward
    const legSwing = Math.sin((frame * Math.PI) / 2) * 8;

    // --- BACK LEG (behind body, darker) ---
    ctx.fillStyle = "#14143a";
    ctx.fillRect(7, 20 + legSwing, 8, 12);
    // back boot
    ctx.fillStyle = "#1a100a";
    ctx.fillRect(6, 31 + legSwing, 10, 5);

    // --- BACK ARM (behind body, in shadow) ---
    ctx.fillStyle = skinShade;
    ctx.fillRect(4, 13 + legSwing * 0.9, 5, 9);

    // --- TORSO (side profile, slightly narrower) ---
    ctx.fillStyle = shirtBase;
    ctx.fillRect(5, 12, 14, 10);
    ctx.fillStyle = shirtShade;
    ctx.fillRect(5, 19, 14, 3);
    ctx.fillStyle = veryAngry ? "#ff4444" : "#f0f0f0";
    ctx.fillRect(6, 13, 6, 2); // highlight

    // --- FRONT LEG (in front of body) ---
    ctx.fillStyle = "#1e1e3c";
    ctx.fillRect(9, 20 - legSwing, 8, 12);
    // knee highlight
    ctx.fillStyle = "#2e2e5c";
    ctx.fillRect(10, 24 - legSwing, 5, 3);
    // front boot
    ctx.fillStyle = "#2a1a0e";
    ctx.fillRect(8, 31 - legSwing, 10, 5);
    // toe extends forward (right = direction of travel)
    ctx.fillRect(15, 33 - legSwing, 4, 2);
    ctx.fillStyle = "#3d2b1a";
    ctx.fillRect(9, 31 - legSwing, 7, 2);

    // --- FRONT ARM (swings forward/back counter to front leg) ---
    ctx.fillStyle = skinTone;
    ctx.fillRect(14, 13 - legSwing * 0.9, 5, 9);
    ctx.fillStyle = skinShade;
    ctx.fillRect(14, 13 - legSwing * 0.9, 2, 9);

    // --- HEAD (side profile) ---
    ctx.fillStyle = skinTone;
    ctx.fillRect(6, 2, 14, 11);
    // ear on back side
    ctx.fillRect(5, 5, 2, 5);
    // nose bump on front side
    ctx.fillStyle = skinShade;
    ctx.fillRect(19, 7, 2, 2);
    // jaw shading
    ctx.fillRect(6, 10, 14, 3);
    ctx.fillRect(6, 2, 2, 9); // back edge shadow

    // --- CAP (side profile) ---
    ctx.fillStyle = "#1a1a3e";
    ctx.fillRect(5, -1, 15, 5);
    ctx.fillStyle = "#111130";
    ctx.fillRect(5, 3, 15, 2);
    // brim extends forward (right)
    ctx.fillStyle = "#252550";
    ctx.fillRect(18, 3, 7, 2);
    ctx.fillStyle = "#2a2a5a";
    ctx.fillRect(10, -2, 4, 2);

    // --- EYE (single, on front face side) ---
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(15, 5, 3, 3);
    ctx.fillStyle = "#000000";
    if (angry) {
      ctx.fillRect(15, 6, 3, 2);
      ctx.fillStyle = "#4a2a10";
      ctx.fillRect(14, 4, 5, 1);
    } else {
      ctx.fillRect(15, 6, 2, 2);
      ctx.fillStyle = "#4a2a10";
      ctx.fillRect(14, 4, 4, 1);
    }

    // --- MOUTH (profile) ---
    if (veryAngry) {
      ctx.fillStyle = "#1a0a0a";
      ctx.fillRect(14, 10, 4, 2);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(14, 10, 1, 2);
      ctx.fillRect(16, 10, 1, 2);
    } else if (angry) {
      ctx.fillStyle = "#3a1a0a";
      ctx.fillRect(14, 10, 4, 1);
      ctx.fillRect(13, 9, 2, 2);
    } else {
      ctx.fillStyle = "#3a1a0a";
      ctx.fillRect(14, 10, 4, 1);
    }
  } else {
    // ===== FRONT-FACING (idle, jump, hit, victory) =====
    const jumpLeg = state === "jump" ? -2 : 0;

    // --- BOOTS ---
    ctx.fillStyle = "#2a1a0e";
    ctx.fillRect(1, 30, 9, 6);
    ctx.fillRect(0, 33, 10, 3);
    ctx.fillRect(13, 30, 9, 6);
    ctx.fillRect(12, 33, 10, 3);
    ctx.fillStyle = "#3d2b1a";
    ctx.fillRect(2, 30, 7, 2);
    ctx.fillRect(14, 30, 7, 2);

    // --- PANTS ---
    ctx.fillStyle = "#1e1e3c";
    ctx.fillRect(2, 20 + jumpLeg, 9, 12);
    ctx.fillRect(13, 20 + jumpLeg, 9, 12);
    ctx.fillStyle = "#2e2e5c";
    ctx.fillRect(3, 24 + jumpLeg, 6, 3);
    ctx.fillRect(14, 24 + jumpLeg, 6, 3);

    // --- T-SHIRT BODY ---
    ctx.fillStyle = shirtBase;
    ctx.fillRect(1, 12, 22, 10);
    ctx.fillStyle = shirtShade;
    ctx.fillRect(1, 19, 22, 3);
    ctx.fillRect(1, 12, 3, 10);
    ctx.fillStyle = veryAngry ? "#ff4444" : "#f0f0f0";
    ctx.fillRect(4, 13, 8, 2);

    // --- ARMS ---
    if (state === "jump") {
      ctx.fillStyle = skinTone;
      ctx.fillRect(-4, 4, 5, 10);
      ctx.fillRect(23, 4, 5, 10);
      ctx.fillStyle = skinShade;
      ctx.fillRect(-4, 4, 2, 10);
    } else if (state === "victory") {
      ctx.fillStyle = skinTone;
      ctx.fillRect(-4, 2, 5, 12);
      ctx.fillRect(23, 2, 5, 12);
    } else {
      ctx.fillStyle = skinTone;
      ctx.fillRect(-3, 13, 5, 9);
      ctx.fillRect(22, 13, 5, 9);
      ctx.fillStyle = skinShade;
      ctx.fillRect(-3, 13, 2, 9);
    }

    // --- HEAD ---
    ctx.fillStyle = skinTone;
    ctx.fillRect(3, 2, 18, 12);
    ctx.fillRect(2, 5, 2, 5);
    ctx.fillRect(20, 5, 2, 5);
    ctx.fillStyle = skinShade;
    ctx.fillRect(3, 11, 18, 3);
    ctx.fillRect(3, 2, 3, 10);

    // --- BASEBALL CAP ---
    ctx.fillStyle = "#1a1a3e";
    ctx.fillRect(2, -2, 20, 6);
    ctx.fillStyle = "#111130";
    ctx.fillRect(2, 3, 20, 2);
    ctx.fillStyle = "#252550";
    ctx.fillRect(14, 4, 9, 2);
    ctx.fillStyle = "#2a2a5a";
    ctx.fillRect(10, -3, 4, 2);

    // --- EYES ---
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(6, 6, 4, 3);
    ctx.fillRect(14, 6, 4, 3);
    ctx.fillStyle = "#000000";
    if (angry) {
      ctx.fillRect(7, 7, 3, 2);
      ctx.fillRect(15, 7, 3, 2);
      ctx.fillStyle = "#4a2a10";
      ctx.fillRect(5, 5, 5, 1);
      ctx.fillRect(14, 5, 5, 1);
      ctx.fillRect(5, 5, 1, 1);
      ctx.fillRect(18, 5, 1, 1);
    } else {
      ctx.fillRect(7, 7, 2, 2);
      ctx.fillRect(15, 7, 2, 2);
    }

    // --- MOUTH / EXPRESSION ---
    if (veryAngry) {
      ctx.fillStyle = "#1a0a0a";
      ctx.fillRect(8, 11, 8, 2);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(8, 11, 2, 2);
      ctx.fillRect(11, 11, 2, 2);
      ctx.fillRect(14, 11, 2, 2);
    } else if (angry) {
      ctx.fillStyle = "#3a1a0a";
      ctx.fillRect(8, 11, 8, 1);
      ctx.fillRect(7, 10, 2, 2);
      ctx.fillRect(15, 10, 2, 2);
    } else {
      ctx.fillStyle = "#3a1a0a";
      ctx.fillRect(8, 11, 8, 1);
    }

    // --- NOSE ---
    ctx.fillStyle = skinShade;
    ctx.fillRect(11, 9, 2, 2);
  }

  if (state === "attacking") {
    const isWindup = p.attackTimer > 10;
    ctx.save();
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 14;
    if (isWindup) {
      // Arms raised overhead
      ctx.fillStyle = "#c8a87a";
      ctx.fillRect(-4, -4, 5, 14);
      ctx.fillRect(23, -4, 5, 14);
      // Axe raised above head
      ctx.fillStyle = "#8B5E3C";
      ctx.fillRect(22, -14, 3, 14);
      ctx.fillStyle = "#aaaaaa";
      ctx.fillRect(14, -16, 14, 7);
      ctx.fillRect(22, -20, 6, 10);
      ctx.fillStyle = "#cccccc";
      ctx.fillRect(15, -15, 5, 3);
      ctx.fillStyle = "#dddddd";
      ctx.fillRect(23, -19, 2, 3);
    } else {
      // Arms slammed down
      ctx.fillStyle = "#c8a87a";
      ctx.fillRect(-4, 16, 5, 12);
      ctx.fillRect(23, 16, 5, 12);
      // Axe slammed down
      ctx.fillStyle = "#8B5E3C";
      ctx.fillRect(22, 14, 3, 14);
      ctx.fillStyle = "#aaaaaa";
      ctx.fillRect(16, 24, 14, 7);
      ctx.fillRect(22, 20, 6, 10);
      ctx.fillStyle = "#cccccc";
      ctx.fillRect(17, 25, 5, 3);
      ctx.fillStyle = "#dddddd";
      ctx.fillRect(23, 21, 2, 3);
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  } else if (hasAxe) {
    const shouldShowAxe = axeTimer > 120 || Math.floor(axeTimer / 10) % 2 === 0;
    if (!shouldShowAxe) {
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 8;
    if (state === "run") {
      ctx.fillStyle = "#8B5E3C";
      ctx.fillRect(17, 10, 3, 10);
      ctx.fillStyle = "#aaaaaa";
      ctx.fillRect(18, 3, 10, 7);
      ctx.fillRect(22, 1, 6, 10);
      ctx.fillStyle = "#cccccc";
      ctx.fillRect(19, 3, 4, 3);
    } else {
      ctx.fillStyle = "#8B5E3C";
      ctx.fillRect(22, 5, 3, 12);
      ctx.fillStyle = "#aaaaaa";
      ctx.fillRect(16, -2, 14, 8);
      ctx.fillRect(22, -5, 6, 10);
      ctx.fillStyle = "#cccccc";
      ctx.fillRect(17, -1, 5, 3);
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  ctx.restore();
}
function drawBear(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  armRaise: number,
  throwAnim = 0,
  walkFrame = 0,
) {
  ctx.save();
  ctx.translate(bx, by);

  // Drop shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(4, 46, 36, 6);

  // Body
  ctx.fillStyle = "#6B0000";
  ctx.fillRect(6, 16, 30, 28);
  // Belly lighter
  ctx.fillStyle = "#A52A2A";
  ctx.fillRect(10, 19, 22, 22);
  // Belly shading
  ctx.fillStyle = "#8b1a1a";
  ctx.fillRect(10, 36, 22, 5);

  // Fur texture on body edges
  ctx.fillStyle = "#500000";
  for (let fi = 0; fi < 5; fi++) {
    ctx.fillRect(6, 18 + fi * 5, 2, 3);
    ctx.fillRect(34, 18 + fi * 5, 2, 3);
    ctx.fillRect(9 + fi * 5, 43, 3, 2);
  }

  // Legs (animated when walking)
  if (walkFrame > 0 && throwAnim === 0) {
    const legSwing = Math.sin(walkFrame * 0.25) * 7;
    ctx.fillStyle = "#6B0000";
    ctx.fillRect(9, 40 - legSwing, 10, 8);
    ctx.fillRect(23, 40 + legSwing, 10, 8);
    ctx.fillStyle = "#8B0000";
    ctx.fillRect(8, 47 - legSwing, 12, 4);
    ctx.fillRect(22, 47 + legSwing, 12, 4);
  } else {
    ctx.fillStyle = "#6B0000";
    ctx.fillRect(9, 40, 10, 8);
    ctx.fillRect(23, 40, 10, 8);
    ctx.fillStyle = "#8B0000";
    ctx.fillRect(8, 46, 12, 4);
    ctx.fillRect(22, 46, 12, 4);
  }

  // Arms with animation
  if (throwAnim > 0) {
    // Throw pose: both arms thrust forward/upward
    const throwProgress = throwAnim / 35;
    const armExt = throwProgress * -14; // arms raised up
    // Body lean forward
    ctx.save();
    ctx.translate(2 * throwProgress, 0);
    ctx.fillStyle = "#6B0000";
    ctx.fillRect(-4, 16 + armExt, 12, 14);
    ctx.fillStyle = "#8B0000";
    ctx.fillRect(-6, 14 + armExt, 8, 8);
    ctx.fillStyle = "#6B0000";
    ctx.fillRect(34, 16 + armExt, 12, 14);
    ctx.fillStyle = "#8B0000";
    ctx.fillRect(36, 14 + armExt, 8, 8);
    ctx.restore();
    // Motion lines
    ctx.strokeStyle = "rgba(255,200,0,0.6)";
    ctx.lineWidth = 1.5;
    for (let ml = 0; ml < 3; ml++) {
      ctx.beginPath();
      ctx.moveTo(38 + ml * 4, 10 + armExt - ml * 3);
      ctx.lineTo(50 + ml * 4, 6 + armExt - ml * 3);
      ctx.stroke();
    }
  } else {
    const raiseL = Math.sin(armRaise) * 8;
    const raiseR = Math.sin(armRaise + Math.PI) * 6;
    ctx.fillStyle = "#6B0000";
    // Left arm
    ctx.fillRect(-2, 16 + raiseL, 10, 16);
    ctx.fillStyle = "#8B0000";
    ctx.fillRect(-3, 24 + raiseL, 6, 8); // fist
    // Right arm
    ctx.fillStyle = "#6B0000";
    ctx.fillRect(34, 16 + raiseR, 10, 16);
    ctx.fillStyle = "#8B0000";
    ctx.fillRect(35, 24 + raiseR, 6, 8); // fist
  }

  // Foam/spittle when arm raised
  if (Math.sin(armRaise) > 0.3) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(15, 30, 3, 2);
    ctx.fillRect(22, 31, 2, 2);
    ctx.fillRect(18, 33, 4, 2);
  }

  // Head
  ctx.fillStyle = "#8B0000";
  ctx.fillRect(8, 0, 26, 22);
  ctx.fillStyle = "#A52A2A";
  ctx.fillRect(10, 2, 22, 18);

  // Ears with inner
  ctx.fillStyle = "#6B0000";
  ctx.fillRect(5, -5, 10, 10);
  ctx.fillRect(27, -5, 10, 10);
  ctx.fillStyle = "#cc3333";
  ctx.fillRect(7, -4, 6, 7);
  ctx.fillRect(29, -4, 6, 7);

  // Glowing red eyes
  ctx.shadowColor = "#ff0000";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#ff2200";
  ctx.fillRect(11, 6, 6, 6);
  ctx.fillRect(25, 6, 6, 6);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(14, 7, 2, 2);
  ctx.fillRect(28, 7, 2, 2);
  ctx.fillStyle = "#000";
  ctx.fillRect(13, 8, 2, 2);
  ctx.fillRect(27, 8, 2, 2);

  // Snout
  ctx.fillStyle = "#cc5555";
  ctx.fillRect(14, 14, 14, 8);
  ctx.fillStyle = "#000";
  ctx.fillRect(16, 14, 3, 2); // nostrils
  ctx.fillRect(23, 14, 3, 2);

  // Mouth - angry snarl
  ctx.fillStyle = "#330000";
  ctx.fillRect(15, 18, 12, 4);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(15, 18, 3, 3); // teeth
  ctx.fillRect(20, 18, 3, 3);
  ctx.fillRect(25, 18, 2, 3);

  // $ on belly in gold
  ctx.shadowColor = "#ffd700";
  ctx.shadowBlur = 4;
  ctx.font = "bold 12px monospace";
  ctx.fillStyle = "#ffd700";
  ctx.fillText("$", 17, 35);
  ctx.shadowBlur = 0;

  ctx.restore();
}

function drawHazard(ctx: CanvasRenderingContext2D, h: Hazard) {
  ctx.save();
  ctx.translate(h.x + h.w / 2, h.y + h.h / 2);
  ctx.rotate(h.rotation);
  ctx.translate(-h.w / 2, -h.h / 2);

  switch (h.type) {
    case "boulder": {
      // Faceted dark boulder
      ctx.fillStyle = "#444444";
      ctx.fillRect(2, 0, 16, 20);
      ctx.fillRect(0, 3, 20, 14);
      // Facet shading
      ctx.fillStyle = "#555555";
      ctx.fillRect(2, 0, 8, 8);
      ctx.fillRect(0, 3, 6, 6);
      ctx.fillStyle = "#333333";
      ctx.fillRect(12, 10, 8, 8);
      ctx.fillRect(10, 14, 8, 6);
      // Top-left glint
      ctx.fillStyle = "#cccccc";
      ctx.fillRect(2, 1, 4, 2);
      ctx.fillRect(1, 2, 2, 3);
      // Salt specks
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(5, 7, 1, 1);
      ctx.fillRect(13, 3, 1, 1);
      ctx.fillRect(8, 14, 1, 1);
      ctx.fillRect(15, 11, 1, 1);
      break;
    }
    case "redCandle": {
      // Phase-through candles glow ominously
      if (h.fallsThrough) {
        ctx.shadowColor = "#ff00ff";
        ctx.shadowBlur = 12 + Math.sin(Date.now() * 0.01) * 6;
      }
      // Wax pool at base
      ctx.fillStyle = h.fallsThrough ? "#660066" : "#991100";
      ctx.fillRect(1, h.h - 4, h.w - 2, 4);
      // Wax drips on sides
      ctx.fillStyle = "#bb1a00";
      ctx.fillRect(2, 8, 3, 6);
      ctx.fillRect(h.w - 5, 12, 3, 5);
      ctx.fillRect(5, 14, 2, 4);
      // Body
      ctx.fillStyle = "#cc2200";
      ctx.fillRect(3, 4, h.w - 6, h.h - 8);
      // Body highlight
      ctx.fillStyle = "#ee3300";
      ctx.fillRect(4, 5, 4, h.h - 10);
      ctx.fillStyle = "#aa1a00";
      ctx.fillRect(h.w - 7, 5, 3, h.h - 10);
      // Wick
      ctx.fillStyle = "#222222";
      ctx.fillRect(h.w / 2 - 1, 1, 3, 5);
      // Animated flame (outer)
      const flameFlicker = Math.sin(Date.now() * 0.02) * 1.5;
      ctx.fillStyle = "#ffdd00";
      ctx.fillRect(h.w / 2 - 3, -5 + flameFlicker, 6, 7);
      // Inner flame
      ctx.fillStyle = "#ff8800";
      ctx.fillRect(h.w / 2 - 2, -4 + flameFlicker, 4, 5);
      ctx.fillStyle = "#ffeeaa";
      ctx.fillRect(h.w / 2 - 1, -3 + flameFlicker, 2, 3);
      break;
    }
    case "greenCandle": {
      if (h.fallsThrough) {
        ctx.shadowColor = "#00ff88";
        ctx.shadowBlur = 12 + Math.sin(Date.now() * 0.01) * 6;
      }
      ctx.fillStyle = h.fallsThrough ? "#004400" : "#00aa22";
      ctx.fillRect(1, h.h - 4, h.w - 2, 4);
      ctx.fillStyle = "#22cc44";
      ctx.fillRect(3, 4, h.w - 6, h.h - 8);
      ctx.fillStyle = "#44ff66";
      ctx.fillRect(4, 5, 4, h.h - 10);
      ctx.fillStyle = "#009918";
      ctx.fillRect(h.w - 7, 5, 3, h.h - 10);
      ctx.fillStyle = "#222222";
      ctx.fillRect(h.w / 2 - 1, 1, 3, 5);
      const greenFlameFlicker = Math.sin(Date.now() * 0.02) * 1.5;
      ctx.fillStyle = "#ffdd00";
      ctx.fillRect(h.w / 2 - 3, -5 + greenFlameFlicker, 6, 7);
      ctx.fillStyle = "#ffaa00";
      ctx.fillRect(h.w / 2 - 2, -4 + greenFlameFlicker, 4, 5);
      break;
    }
    case "pickaxe": {
      // Wooden handle (horizontal)
      ctx.fillStyle = "#8B5E3C";
      ctx.fillRect(0, 10, h.w, 4);
      ctx.fillStyle = "#6B4020";
      ctx.fillRect(0, 12, h.w, 2);
      // Handle grain
      ctx.fillStyle = "#9B6E4C";
      ctx.fillRect(3, 10, 1, 4);
      ctx.fillRect(10, 10, 1, 4);
      ctx.fillRect(16, 10, 1, 4);
      // Metal head
      ctx.fillStyle = "#888888";
      ctx.fillRect(0, 2, 10, 8);
      // Pick point
      ctx.fillRect(8, 0, 4, 12);
      // Axe flat side
      ctx.fillRect(0, 5, 6, 10);
      // Metal shading
      ctx.fillStyle = "#aaaaaa";
      ctx.fillRect(1, 2, 4, 3);
      ctx.fillRect(8, 0, 2, 4);
      // Glint
      ctx.fillStyle = "#dddddd";
      ctx.fillRect(9, 1, 2, 2);
      break;
    }
    case "cart": {
      // Drop shadow
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(2, h.h - 1, h.w, 3);
      // Axle bar
      ctx.fillStyle = "#333333";
      ctx.fillRect(3, h.h - 6, h.w - 6, 3);
      // Wheels (detailed with spokes)
      const wheelPositions = [5, h.w - 9];
      for (const wx of wheelPositions) {
        // Wheel outer
        ctx.fillStyle = "#222222";
        ctx.beginPath();
        ctx.arc(wx + 4, h.h - 4, 6, 0, Math.PI * 2);
        ctx.fill();
        // Wheel rim
        ctx.strokeStyle = "#555555";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(wx + 4, h.h - 4, 5, 0, Math.PI * 2);
        ctx.stroke();
        // Spokes
        ctx.strokeStyle = "#444444";
        ctx.lineWidth = 1;
        for (let sp = 0; sp < 4; sp++) {
          const angle = (sp * Math.PI) / 2;
          ctx.beginPath();
          ctx.moveTo(wx + 4, h.h - 4);
          ctx.lineTo(
            wx + 4 + Math.cos(angle) * 4,
            h.h - 4 + Math.sin(angle) * 4,
          );
          ctx.stroke();
        }
        // Hub
        ctx.fillStyle = "#666666";
        ctx.fillRect(wx + 3, h.h - 5, 2, 2);
      }
      // Cart body
      ctx.fillStyle = "#5c3a1e";
      ctx.fillRect(0, 2, h.w, h.h - 10);
      // Body shading
      ctx.fillStyle = "#3d2010";
      ctx.fillRect(0, h.h - 14, h.w, 4);
      ctx.fillStyle = "#7a4a28";
      ctx.fillRect(0, 2, h.w, 4);
      // Metal rivets
      ctx.fillStyle = "#444444";
      ctx.fillRect(3, 5, 3, 3);
      ctx.fillRect(h.w - 6, 5, 3, 3);
      ctx.fillRect(3, h.h - 14, 3, 3);
      ctx.fillRect(h.w - 6, h.h - 14, 3, 3);
      // Cargo rocks inside
      ctx.fillStyle = "#555555";
      ctx.fillRect(3, 4, 5, 4);
      ctx.fillRect(9, 3, 6, 5);
      ctx.fillRect(16, 4, 5, 4);
      ctx.fillStyle = "#666666";
      ctx.fillRect(4, 4, 2, 2);
      ctx.fillRect(11, 3, 3, 3);
      break;
    }
    case "barrel": {
      // Barrel shape
      ctx.fillStyle = "#cc6600";
      ctx.fillRect(2, 0, h.w - 4, h.h);
      ctx.fillRect(0, 3, h.w, h.h - 6);
      // Wood grain
      ctx.fillStyle = "#bb5500";
      ctx.fillRect(3, 0, 2, h.h);
      ctx.fillRect(8, 0, 2, h.h);
      ctx.fillRect(h.w - 5, 0, 2, h.h);
      // Metal bands
      ctx.fillStyle = "#333333";
      ctx.fillRect(0, 2, h.w, 2);
      ctx.fillRect(0, h.h / 2 - 1, h.w, 2);
      ctx.fillRect(0, h.h - 4, h.w, 2);
      // Band sheen
      ctx.fillStyle = "#555555";
      ctx.fillRect(0, 2, h.w, 1);
      ctx.fillRect(0, h.h / 2 - 1, h.w, 1);
      // LIQUIDATED text
      ctx.save();
      ctx.fillStyle = "#ff2200";
      ctx.font = "bold 4px monospace";
      ctx.textAlign = "center";
      ctx.fillText("LQDT", h.w / 2, h.h / 2 + 4);
      ctx.textAlign = "left";
      ctx.restore();
      break;
    }
    case "doompost": {
      // Warning diamond shape
      ctx.fillStyle = "#dd0000";
      ctx.beginPath();
      ctx.moveTo(h.w / 2, 0);
      ctx.lineTo(h.w, h.h / 2);
      ctx.lineTo(h.w / 2, h.h);
      ctx.lineTo(0, h.h / 2);
      ctx.closePath();
      ctx.fill();
      // Border
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(h.w / 2, 1);
      ctx.lineTo(h.w - 1, h.h / 2);
      ctx.lineTo(h.w / 2, h.h - 1);
      ctx.lineTo(1, h.h / 2);
      ctx.closePath();
      ctx.stroke();
      // Inner lighter diamond
      ctx.fillStyle = "#ff3333";
      ctx.beginPath();
      ctx.moveTo(h.w / 2, 3);
      ctx.lineTo(h.w - 3, h.h / 2);
      ctx.lineTo(h.w / 2, h.h - 3);
      ctx.lineTo(3, h.h / 2);
      ctx.closePath();
      ctx.fill();
      // ! mark
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("!", h.w / 2, h.h / 2 + 3);
      ctx.textAlign = "left";
      break;
    }
    case "chest": {
      ctx.fillStyle = "#5c3a1e";
      ctx.fillRect(0, h.h * 0.4, h.w, h.h * 0.6);
      ctx.fillStyle = "#7a4a28";
      ctx.fillRect(0, h.h * 0.4, h.w, 3);
      ctx.fillStyle = "#6B4020";
      ctx.fillRect(0, 0, h.w, h.h * 0.45);
      ctx.fillStyle = "#8B5a30";
      ctx.fillRect(0, 0, h.w, 3);
      ctx.fillStyle = "#888888";
      ctx.fillRect(0, h.h * 0.2, h.w, 2);
      ctx.fillStyle = "#aaaaaa";
      ctx.fillRect(0, 0, 3, 6);
      ctx.fillRect(h.w - 3, 0, 3, 6);
      ctx.fillRect(0, h.h - 6, 3, 6);
      ctx.fillRect(h.w - 3, h.h - 6, 3, 6);
      ctx.fillStyle = "#ffd700";
      ctx.fillRect(h.w / 2 - 3, h.h * 0.3, 6, 8);
      ctx.fillStyle = "#cc9900";
      ctx.fillRect(h.w / 2 - 2, h.h * 0.35, 4, 5);
      ctx.fillStyle = "#000";
      ctx.fillRect(h.w / 2 - 1, h.h * 0.37, 2, 3);
      ctx.fillStyle = "rgba(255,215,0,0.3)";
      ctx.fillRect(2, 1, h.w - 4, 4);
      break;
    }
    case "saltbag": {
      // Burlap sack body
      ctx.fillStyle = "#d4c4a0";
      ctx.fillRect(2, 4, h.w - 4, h.h - 6);
      // Rounded top
      ctx.fillStyle = "#c8b890";
      ctx.fillRect(4, 2, h.w - 8, 4);
      ctx.fillRect(2, 4, h.w - 4, 3);
      // Burlap texture lines
      ctx.fillStyle = "#b8a880";
      for (let tx = 4; tx < h.w - 4; tx += 4) {
        ctx.fillRect(tx, 5, 1, h.h - 8);
      }
      for (let ty = 6; ty < h.h - 4; ty += 5) {
        ctx.fillRect(3, ty, h.w - 6, 1);
      }
      // Tie string at top
      ctx.fillStyle = "#8B6914";
      ctx.fillRect(h.w / 2 - 3, 1, 6, 3);
      ctx.fillStyle = "#6a4e10";
      ctx.fillRect(h.w / 2 - 2, 0, 4, 2);
      // "SALT" label
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "center";
      ctx.fillText("SALT", h.w / 2, h.h / 2 + 3);
      ctx.textAlign = "left";
      // Shadow
      ctx.fillStyle = "#a09070";
      ctx.fillRect(h.w - 5, 5, 3, h.h - 8);
      ctx.fillRect(3, h.h - 6, h.w - 6, 3);
      break;
    }
  }
  ctx.restore();
}

function drawPlatform(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tint?: string,
) {
  const bodyColor = tint || "#2a1f0e";
  const topColor = tint ? `${tint}cc` : "#4a3520";
  // Drop shadow
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(x + 3, y + h + 2, w, 4);

  // Body
  ctx.fillStyle = bodyColor;
  ctx.fillRect(x, y, w, h);

  // Top surface
  ctx.fillStyle = topColor;
  ctx.fillRect(x, y, w, h - 2);

  // Plank grain lines
  ctx.strokeStyle = "#3a2a15";
  ctx.lineWidth = 1;
  const plankW = Math.max(20, Math.floor(w / 4));
  for (let px = x + 2; px < x + w - 2; px += plankW) {
    ctx.beginPath();
    ctx.moveTo(px, y + 2);
    ctx.lineTo(px, y + h - 2);
    ctx.stroke();
  }

  // Metal trim on top
  ctx.strokeStyle = "#666666";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();

  // Support struts for wide platforms
  if (w > 80) {
    ctx.fillStyle = "#1e1508";
    const strutXs = [x + 4, x + Math.floor(w / 2) - 3, x + w - 10];
    for (const sx of strutXs) {
      ctx.fillRect(sx, y + h, 6, 8);
      ctx.fillRect(sx - 2, y + h + 6, 10, 3);
    }
  }

  // Salt crystals on top
  ctx.fillStyle = "#c8e8f0";
  for (let cx = x + 12; cx < x + w - 8; cx += 25) {
    ctx.fillRect(cx + 1, y - 3, 2, 3);
    ctx.fillRect(cx, y - 2, 4, 1);
    ctx.fillRect(cx + 8, y - 4, 2, 4);
    ctx.fillRect(cx + 7, y - 3, 4, 1);
    ctx.fillStyle = "rgba(79,195,247,0.5)";
    ctx.fillRect(cx + 1, y - 2, 2, 2);
    ctx.fillRect(cx + 8, y - 3, 2, 2);
    ctx.fillStyle = "#c8e8f0";
  }
}
function drawExit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
) {
  // Green stock-market candle door portal
  const glow = 0.7 + Math.sin(frame * 0.06) * 0.28;
  ctx.save();

  // Outer glow halo
  ctx.shadowColor = "#00C853";
  ctx.shadowBlur = 28 * glow;

  // Upper wick
  ctx.strokeStyle = "#888888";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 9, y - 50);
  ctx.lineTo(x + 9, y - 64);
  ctx.stroke();

  // Flame at top of wick
  ctx.shadowColor = "#ffcc00";
  ctx.shadowBlur = 14;
  const flameY = y - 66 + Math.sin(frame * 0.15) * 2;
  ctx.fillStyle = "#ffdd00";
  ctx.fillRect(x + 6, flameY, 7, 8);
  ctx.fillStyle = "#ff8800";
  ctx.fillRect(x + 7, flameY + 1, 5, 6);
  ctx.fillStyle = "#ffffaa";
  ctx.fillRect(x + 8, flameY + 2, 3, 3);

  // Candle body (tall green rectangle - bullish!)
  ctx.shadowColor = "#00C853";
  ctx.shadowBlur = 20 * glow;
  ctx.fillStyle = "#00C853";
  ctx.fillRect(x, y - 50, 18, 50);

  // Candle body highlight (left edge lighter)
  ctx.fillStyle = "#4cff8c";
  ctx.fillRect(x + 1, y - 48, 4, 46);

  // Candle price lines (stock chart style)
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x, y - 34, 18, 2);
  ctx.fillRect(x, y - 18, 18, 2);

  // Dark edge shading
  ctx.fillStyle = "#007a32";
  ctx.fillRect(x + 14, y - 50, 4, 50);

  // Lower wick
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#888888";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 9, y);
  ctx.lineTo(x + 9, y + 10);
  ctx.stroke();

  // EXIT label below
  ctx.shadowColor = "#00C853";
  ctx.shadowBlur = 8 * glow;
  ctx.font = "bold 8px monospace";
  ctx.fillStyle = "#00ff88";
  ctx.textAlign = "center";
  ctx.fillText("EXIT", x + 9, y + 22);
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawWaterBottle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
) {
  const bob = Math.sin(frame * 0.1) * 2;
  ctx.save();
  ctx.translate(0, bob);

  // Light blue glow
  ctx.shadowColor = "#81d4fa";
  ctx.shadowBlur = 10;

  // Bottle body (clear/light blue)
  ctx.fillStyle = "#b3e5fc";
  ctx.fillRect(x + 3, y + 6, 10, 13);
  ctx.fillRect(x + 2, y + 8, 12, 9);
  // Rounded shoulders
  ctx.fillRect(x + 4, y + 4, 8, 5);

  // White label area
  ctx.fillStyle = "#ffffff";
  ctx.shadowBlur = 0;
  ctx.fillRect(x + 3, y + 9, 10, 6);

  // H2O label text
  ctx.fillStyle = "#0277bd";
  ctx.font = "bold 4px monospace";
  ctx.textAlign = "center";
  ctx.fillText("H2O", x + 8, y + 14);
  ctx.textAlign = "left";

  // Bottle highlight
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(x + 4, y + 6, 2, 10);

  // Cap
  ctx.shadowColor = "#81d4fa";
  ctx.shadowBlur = 6;
  ctx.fillStyle = "#0288d1";
  ctx.fillRect(x + 4, y, 8, 5);
  ctx.fillStyle = "#29b6f6";
  ctx.fillRect(x + 5, y, 5, 2);

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawMaturityBag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lifetime: number,
  _maxLifetime: number,
  _amount: number,
) {
  if (lifetime < 120 && Math.floor(lifetime / 10) % 2 === 0) return;
  const bob = Math.sin(Date.now() * 0.006) * 2;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.shadowColor = "#ffd700";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#8B6914";
  ctx.fillRect(1, 8, 14, 12);
  ctx.fillRect(3, 6, 10, 4);
  ctx.fillRect(5, 4, 6, 4);
  ctx.fillStyle = "#c9a227";
  ctx.fillRect(2, 9, 5, 4);
  ctx.font = "bold 8px monospace";
  ctx.fillStyle = "#ffd700";
  ctx.textAlign = "center";
  ctx.fillText("$", 8, 17);
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawCommunityBag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lifetime: number,
) {
  if (lifetime < 120 && Math.floor(lifetime / 10) % 2 === 0) return;
  const bob = Math.sin(Date.now() * 0.005) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.shadowColor = "#00ff88";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#2e7d32";
  ctx.fillRect(0, 6, 22, 20);
  ctx.fillRect(3, 3, 16, 6);
  ctx.fillRect(7, 0, 8, 5);
  ctx.fillStyle = "#43a047";
  ctx.fillRect(2, 8, 8, 6);
  ctx.font = "bold 9px monospace";
  ctx.fillStyle = "#00ff88";
  ctx.textAlign = "center";
  ctx.fillText("$$", 11, 20);
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawAxePickup(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
) {
  const bob = Math.sin(frame * 0.08) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.shadowColor = "#ffd700";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#8B5E3C";
  ctx.fillRect(4, 8, 4, 14);
  ctx.fillStyle = "#6B4020";
  ctx.fillRect(5, 8, 2, 14);
  ctx.fillStyle = "#aaaaaa";
  ctx.fillRect(0, 0, 14, 9);
  ctx.fillRect(8, -2, 6, 13);
  ctx.fillStyle = "#cccccc";
  ctx.fillRect(1, 1, 5, 3);
  ctx.fillStyle = "#dddddd";
  ctx.fillRect(9, -1, 2, 3);
  ctx.shadowBlur = 0;
  ctx.shadowColor = "#ffd700";
  ctx.shadowBlur = 6;
  ctx.font = "bold 5px monospace";
  ctx.fillStyle = "#ffd700";
  ctx.textAlign = "center";
  ctx.fillText("AXE", 8, 28);
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawGunPickup(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
) {
  const bob = Math.sin(frame * 0.09) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.shadowColor = "#00ff88";
  ctx.shadowBlur = 14;
  // Gun body - silver/gray pixel art pistol
  ctx.fillStyle = "#aaaaaa";
  ctx.fillRect(0, 6, 14, 6); // main body
  ctx.fillStyle = "#cccccc";
  ctx.fillRect(1, 6, 5, 2); // highlight
  ctx.fillStyle = "#888888";
  ctx.fillRect(0, 10, 14, 2); // shadow edge
  // Barrel
  ctx.fillStyle = "#999999";
  ctx.fillRect(14, 7, 6, 3);
  ctx.fillStyle = "#bbbbbb";
  ctx.fillRect(14, 7, 6, 1);
  // Grip
  ctx.fillStyle = "#775533";
  ctx.fillRect(2, 12, 7, 8);
  ctx.fillStyle = "#996644";
  ctx.fillRect(3, 12, 3, 3);
  // Trigger
  ctx.fillStyle = "#666666";
  ctx.fillRect(7, 10, 2, 4);
  // Muzzle flash hint
  ctx.shadowColor = "#ffff00";
  ctx.shadowBlur = 6;
  ctx.fillStyle = "#ffcc00";
  ctx.fillRect(20, 7, 2, 3);
  ctx.shadowBlur = 0;
  // Label
  ctx.shadowColor = "#00ff88";
  ctx.shadowBlur = 6;
  ctx.font = "bold 5px monospace";
  ctx.fillStyle = "#00ff88";
  ctx.textAlign = "center";
  ctx.fillText("GUN", 10, 28);
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  level: number,
  frame: number,
) {
  const palette = LEVEL_PALETTES[level % LEVEL_PALETTES.length];
  // === LAYER 1: Deep background - stone block grid ===
  ctx.fillStyle = palette.bg1;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Stone block grid
  ctx.fillStyle = palette.bg2;
  for (let gy = 0; gy < CANVAS_H; gy += 32) {
    for (let gx = 0; gx < CANVAS_W; gx += 40) {
      const offset = (Math.floor(gy / 32) % 2) * 20;
      ctx.fillRect(gx + offset, gy, 38, 30);
    }
  }
  // Mortar lines (horizontal)
  ctx.fillStyle = "#0a0a16";
  for (let gy = 32; gy < CANVAS_H; gy += 32) {
    ctx.fillRect(0, gy - 1, CANVAS_W, 2);
  }
  // Mortar lines (vertical - staggered)
  for (let gy = 0; gy < CANVAS_H; gy += 32) {
    const offset = (Math.floor(gy / 32) % 2) * 20;
    for (let gx = offset; gx < CANVAS_W; gx += 40) {
      ctx.fillRect(gx - 1, gy, 2, 32);
    }
  }

  // Embedded white salt vein flecks
  ctx.fillStyle = "rgba(232,244,248,0.07)";
  const fleckSeeds = [
    23, 87, 142, 203, 267, 318, 371, 415, 55, 99, 178, 244, 302, 358, 412, 468,
  ];
  for (let i = 0; i < fleckSeeds.length; i++) {
    const fx = (fleckSeeds[i] * 17 + i * 31) % CANVAS_W;
    const fy = (fleckSeeds[i] * 13 + i * 47) % CANVAS_H;
    ctx.fillRect(fx, fy, 3 + (i % 3), 1);
    ctx.fillRect(fx + 1, fy + 1, 1 + (i % 2), 1);
  }

  // === LAYER 2: Mine supports - beams, chains, rails ===
  const beamXPositions = [80, 200, 320, 400];
  for (const bx of beamXPositions) {
    // Vertical beam
    ctx.fillStyle = "#3d2510";
    ctx.fillRect(bx - 4, 48, 8, CANVAS_H - 48);
    // Beam highlight
    ctx.fillStyle = "#5a3820";
    ctx.fillRect(bx - 4, 48, 2, CANVAS_H - 48);
    ctx.fillStyle = "#2a1a08";
    ctx.fillRect(bx + 2, 48, 2, CANVAS_H - 48);
    // Horizontal crossbeam at top
    ctx.fillStyle = "#3d2510";
    ctx.fillRect(bx - 30, 80, 60, 6);
    ctx.fillStyle = "#5a3820";
    ctx.fillRect(bx - 30, 80, 60, 2);
    // Nail/bolt at beam junction
    ctx.fillStyle = "#666666";
    ctx.fillRect(bx - 2, 83, 4, 4);
    ctx.fillStyle = "#888888";
    ctx.fillRect(bx - 1, 83, 2, 2);

    // Hanging chains from crossbeam
    ctx.fillStyle = "#555555";
    for (let cy = 86; cy < 200; cy += 8) {
      const chainX = bx - 1;
      // Oval chain links
      ctx.fillRect(chainX, cy, 3, 3);
      ctx.fillStyle = "#777777";
      ctx.fillRect(chainX, cy, 1, 1);
      ctx.fillStyle = "#555555";
    }
  }

  // Rusted rail lines at platform-ish heights
  const railHeights = [200, 320, 440, 540];
  for (const ry of railHeights) {
    // Top rail
    ctx.fillStyle = "#5c3a1e";
    ctx.fillRect(0, ry, CANVAS_W, 3);
    ctx.fillStyle = "#7a5030";
    ctx.fillRect(0, ry, CANVAS_W, 1);
    // Tie marks
    ctx.fillStyle = "#3a2510";
    for (let tx = 10; tx < CANVAS_W; tx += 18) {
      ctx.fillRect(tx, ry - 2, 8, 7);
    }
  }

  // === LAYER 3: Wall silhouettes and salt crystals ===
  // Left wall jagged edge
  ctx.fillStyle = "#050508";
  const leftEdge = [
    0, 18, 8, 22, 5, 20, 14, 10, 18, 12, 8, 20, 6, 16, 12, 20, 8, 14, 18, 10,
  ];
  for (let i = 0; i < leftEdge.length; i++) {
    ctx.fillRect(0, i * 32, leftEdge[i], 32);
  }
  // Right wall jagged edge
  const rightEdge = [
    12, 20, 8, 18, 14, 10, 20, 8, 16, 14, 10, 18, 12, 20, 8, 14, 16, 10, 18, 12,
  ];
  for (let i = 0; i < rightEdge.length; i++) {
    ctx.fillRect(CANVAS_W - rightEdge[i], i * 32, rightEdge[i], 32);
  }

  // Salt crystal clusters on walls
  const crystalClusters = [
    { x: 14, y: 100 },
    { x: 14, y: 260 },
    { x: 14, y: 400 },
    { x: 14, y: 530 },
    { x: CANVAS_W - 22, y: 150 },
    { x: CANVAS_W - 22, y: 300 },
    { x: CANVAS_W - 22, y: 450 },
    { x: CANVAS_W - 22, y: 570 },
    { x: 240, y: 60 },
  ];

  for (const cc of crystalClusters) {
    const glowAnim = 0.4 + Math.sin(frame * 0.04 + cc.x * 0.1) * 0.2;
    // Crystal glow halo
    ctx.save();
    ctx.shadowColor = "#4fc3f7";
    ctx.shadowBlur = 8 * glowAnim;
    ctx.globalAlpha = glowAnim * 0.5;
    ctx.fillStyle = "#4fc3f7";
    ctx.fillRect(cc.x - 3, cc.y - 6, 10, 14);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Crystal diamonds (upward pointing)
    ctx.fillStyle = "#c8e8f0";
    // Large center crystal
    ctx.fillRect(cc.x + 2, cc.y - 8, 3, 10);
    ctx.fillRect(cc.x, cc.y - 6, 7, 6);
    // Left smaller crystal
    ctx.fillRect(cc.x - 1, cc.y - 5, 2, 7);
    ctx.fillRect(cc.x - 2, cc.y - 3, 4, 4);
    // Right smaller crystal
    ctx.fillRect(cc.x + 6, cc.y - 4, 2, 6);
    ctx.fillRect(cc.x + 5, cc.y - 2, 4, 3);
    // Inner glow fill
    ctx.fillStyle = "rgba(79,195,247,0.4)";
    ctx.fillRect(cc.x + 3, cc.y - 6, 1, 6);
    ctx.fillRect(cc.x, cc.y - 4, 2, 3);
    ctx.restore();
  }

  // Glowing blue energy wisps near bottom
  const wispCount = 5;
  for (let wi = 0; wi < wispCount; wi++) {
    const wx = 60 + wi * 90 + Math.sin(frame * 0.03 + wi * 1.2) * 20;
    const wy = CANVAS_H - 30 + Math.cos(frame * 0.05 + wi * 0.8) * 8;
    const wAlpha = 0.3 + Math.sin(frame * 0.06 + wi) * 0.2;
    ctx.save();
    ctx.shadowColor = "#4fc3f7";
    ctx.shadowBlur = 12;
    ctx.globalAlpha = wAlpha;
    ctx.fillStyle = "#4fc3f7";
    ctx.fillRect(wx - 2, wy - 4, 4, 8);
    ctx.fillRect(wx - 4, wy - 2, 8, 4);
    ctx.restore();
  }

  // === ATMOSPHERIC: Vignette + scanlines + ambient ===
  // Radial vignette
  const vg = ctx.createRadialGradient(
    CANVAS_W / 2,
    CANVAS_H * 0.5,
    80,
    CANVAS_W / 2,
    CANVAS_H * 0.5,
    340,
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,4,0.75)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Blue ambient light from center-bottom
  const ambientGrad = ctx.createRadialGradient(
    CANVAS_W / 2,
    CANVAS_H + 20,
    10,
    CANVAS_W / 2,
    CANVAS_H + 20,
    240,
  );
  ambientGrad.addColorStop(0, "rgba(30,80,120,0.18)");
  ambientGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ambientGrad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Scan-line texture (subtle)
  ctx.fillStyle = "rgba(0,0,0,0.04)";
  for (let sy = 0; sy < CANVAS_H; sy += 2) {
    ctx.fillRect(0, sy, CANVAS_W, 1);
  }
}

function _drawHUD(ctx: CanvasRenderingContext2D, gs: GameState) {
  const level = gs.level;
  const portfolioDisplay = Math.floor(
    gs.portfolioValue * gs.portfolioMultiplier,
  );
  const saltPct = gs.saltMeter / 100;

  // === LIVES: pixel heart shapes ===
  for (let i = 0; i < gs.lives; i++) {
    const hx = 8 + i * 16;
    const hy = 8;
    ctx.shadowColor = "#ff0000";
    ctx.shadowBlur = 4;
    ctx.fillStyle = "#ff3333";
    // Heart shape (pixel art)
    ctx.fillRect(hx + 1, hy, 3, 2);
    ctx.fillRect(hx + 6, hy, 3, 2);
    ctx.fillRect(hx, hy + 2, 10, 4);
    ctx.fillRect(hx + 1, hy + 6, 8, 2);
    ctx.fillRect(hx + 2, hy + 8, 6, 2);
    ctx.fillRect(hx + 3, hy + 10, 4, 2);
    ctx.fillRect(hx + 4, hy + 12, 2, 1);
    // Heart highlight
    ctx.fillStyle = "#ff6666";
    ctx.fillRect(hx + 2, hy, 1, 1);
    ctx.fillRect(hx + 1, hy + 2, 2, 2);
    ctx.shadowBlur = 0;
  }

  // === YEAR display: gold ===
  ctx.shadowColor = "#ffd700";
  ctx.shadowBlur = 6;
  ctx.font = "bold 14px monospace";
  ctx.fillStyle = "#ffd700";
  ctx.textAlign = "left";
  ctx.fillText(`YR ${level + 1}/8`, 62, 22);
  ctx.shadowBlur = 0;
  ctx.font = "8px monospace";
  ctx.fillStyle = "#aa9900";
  ctx.fillText("YEAR", 62, 34);

  // === Portfolio Value panel (wide) ===
  ctx.fillStyle = "#0a1a0a";
  ctx.fillRect(112, 6, 190, 38);
  ctx.strokeStyle = "#81c784";
  ctx.lineWidth = 1;
  ctx.strokeRect(112, 6, 190, 38);
  ctx.font = "7px monospace";
  ctx.fillStyle = "#81c784";
  ctx.fillText("PORTFOLIO VALUE", 116, 17);
  ctx.font = "bold 12px monospace";
  ctx.fillStyle = "#81c784";
  ctx.fillText(`$${portfolioDisplay.toLocaleString()}`, 116, 35);

  // === Salt Meter: vertical thermometer on far right ===
  const barX = 454;
  const barY = 4;
  const barW = 12;
  const barH = 42;

  // Background
  ctx.fillStyle = "#111111";
  ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

  // Gradient fill
  const saltGrad = ctx.createLinearGradient(barX, barY + barH, barX, barY);
  saltGrad.addColorStop(0, "#4caf50");
  saltGrad.addColorStop(0.5, "#ff9800");
  saltGrad.addColorStop(1, "#f44336");
  const fillH = barH * saltPct;
  ctx.fillStyle = saltGrad;
  if (fillH > 0) {
    ctx.fillRect(barX, barY + barH - fillH, barW, fillH);
  }

  // Border - glow red when critical
  if (saltPct > 0.9) {
    ctx.shadowColor = "#ff0000";
    ctx.shadowBlur = 8;
    ctx.strokeStyle = "#ff3333";
  } else {
    ctx.strokeStyle = "#555555";
  }
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);
  ctx.shadowBlur = 0;

  // Tick marks
  ctx.fillStyle = "#333333";
  ctx.fillRect(barX + barW, barY + barH * 0.25, 2, 1);
  ctx.fillRect(barX + barW, barY + barH * 0.5, 2, 1);
  ctx.fillRect(barX + barW, barY + barH * 0.75, 2, 1);

  // Skull icon when maxed
  if (saltPct >= 1.0) {
    ctx.font = "9px monospace";
    ctx.fillStyle = "#ff3333";
    ctx.textAlign = "center";
    ctx.fillText("☠", barX + barW / 2, barY - 2);
    ctx.textAlign = "left";
  }

  // SALT label below
  ctx.font = "6px monospace";
  ctx.fillStyle = saltPct > 0.9 ? "#ff3333" : "#888888";
  ctx.textAlign = "center";
  ctx.fillText("SALT", barX + barW / 2, barY + barH + 8);
  ctx.textAlign = "left";

  // Axe timer bar (when active)
  const axeBarVisible =
    gs.axeTimer > 120 || Math.floor(gs.axeTimer / 10) % 2 === 0;
  if (gs.hasAxe && axeBarVisible) {
    const axePct = gs.axeTimer / 600;
    const axeBarX = 438;
    const axeBarY = 4;
    const axeBarW = 10;
    const axeBarH = 42;
    ctx.fillStyle = "#111111";
    ctx.fillRect(axeBarX - 1, axeBarY - 1, axeBarW + 2, axeBarH + 2);
    const axeGrad = ctx.createLinearGradient(
      axeBarX,
      axeBarY + axeBarH,
      axeBarX,
      axeBarY,
    );
    axeGrad.addColorStop(0, "#ffd700");
    axeGrad.addColorStop(1, "#ff9800");
    const axeFillH = axeBarH * axePct;
    ctx.fillStyle = axeGrad;
    if (axeFillH > 0)
      ctx.fillRect(axeBarX, axeBarY + axeBarH - axeFillH, axeBarW, axeFillH);
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 1;
    ctx.strokeRect(axeBarX, axeBarY, axeBarW, axeBarH);
    ctx.font = "6px monospace";
    ctx.fillStyle = "#ffd700";
    ctx.textAlign = "center";
    ctx.fillText("AXE", axeBarX + axeBarW / 2, axeBarY + axeBarH + 8);
    ctx.textAlign = "left";
  }

  // Debuff indicator
  if (gs.debuffTimer > 0 && Math.floor(gs.frameCount / 15) % 2 === 0) {
    ctx.font = "bold 8px monospace";
    ctx.fillStyle = "#ff9800";
    ctx.textAlign = "right";
    ctx.fillText("SALTY CHEST!", 435, 44);
    ctx.textAlign = "left";
  }

  // Bottle counter with mini water bottle icon
  const remaining = gs.waterBottles.filter((k) => !k.collected).length;
  const totalBottles = gs.waterBottles.length;
  if (totalBottles > 0) {
    const bx = 310;
    const by = 8;
    // Mini water bottle icon (light blue)
    ctx.fillStyle = "#b3e5fc";
    ctx.fillRect(bx + 2, by + 4, 7, 9);
    ctx.fillRect(bx + 1, by + 6, 9, 6);
    ctx.fillRect(bx + 3, by + 2, 5, 4);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(bx + 2, by + 7, 7, 4);
    ctx.fillStyle = "#0288d1";
    ctx.fillRect(bx + 3, by, 5, 3);
    // Count
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = remaining > 0 ? "#81d4fa" : "#81c784";
    ctx.textAlign = "left";
    ctx.fillText(`x${remaining}/${totalBottles}`, bx + 13, by + 12);
  }
}

function drawTitleScreen(ctx: CanvasRenderingContext2D, frame: number) {
  ctx.fillStyle = "#050508";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Background stone grid
  ctx.fillStyle = "#0a0a14";
  for (let gy = 0; gy < CANVAS_H; gy += 32) {
    for (let gx = 0; gx < CANVAS_W; gx += 40) {
      const offset = (Math.floor(gy / 32) % 2) * 20;
      ctx.fillRect(gx + offset, gy, 38, 30);
    }
  }

  // Scan-lines
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  for (let sy = 0; sy < CANVAS_H; sy += 2) {
    ctx.fillRect(0, sy, CANVAS_W, 1);
  }

  // Dramatic stalactites (varied irregular shapes)
  const stalactites = [
    { x: -10, w: 55, h: 55 },
    { x: 42, w: 28, h: 38 },
    { x: 78, w: 44, h: 70 },
    { x: 128, w: 32, h: 42 },
    { x: 168, w: 48, h: 60 },
    { x: 224, w: 24, h: 30 },
    { x: 252, w: 40, h: 80 },
    { x: 300, w: 30, h: 50 },
    { x: 336, w: 50, h: 65 },
    { x: 392, w: 36, h: 45 },
    { x: 432, w: 28, h: 55 },
    { x: 460, w: 40, h: 40 },
  ];

  for (const st of stalactites) {
    // Main stalactite body
    ctx.fillStyle = "#0f0f1e";
    ctx.fillRect(st.x, 0, st.w, st.h);
    // Tip point
    ctx.fillStyle = "#0a0a18";
    ctx.fillRect(st.x + st.w / 2 - 4, st.h - 8, 8, 10);
    ctx.fillRect(st.x + st.w / 2 - 2, st.h, 4, 6);
    ctx.fillRect(st.x + st.w / 2 - 1, st.h + 4, 2, 4);
    // Side shading
    ctx.fillStyle = "#171730";
    ctx.fillRect(st.x, 0, 4, st.h);
    // Salt crystal tip
    const tipGlow = 0.3 + Math.sin(frame * 0.04 + st.x * 0.1) * 0.2;
    ctx.save();
    ctx.globalAlpha = tipGlow;
    ctx.fillStyle = "#c8e8f0";
    ctx.fillRect(st.x + st.w / 2 - 1, st.h + 5, 2, 5);
    ctx.restore();
  }

  // Vignette
  const vg = ctx.createRadialGradient(
    CANVAS_W / 2,
    CANVAS_H * 0.5,
    100,
    CANVAS_W / 2,
    CANVAS_H * 0.5,
    340,
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,8,0.8)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // === TITLE TEXT: SALTMINE XCAPE ===
  const glow = 0.7 + Math.sin(frame * 0.05) * 0.25;

  // Outer glow pass
  ctx.save();
  ctx.shadowColor = "#4fc3f7";
  ctx.shadowBlur = 40 * glow;
  ctx.font = "bold 42px monospace";
  ctx.fillStyle = "rgba(79,195,247,0.3)";
  ctx.textAlign = "center";
  ctx.fillText("SALTMINE", CANVAS_W / 2, 190);
  ctx.fillText("XCAPE", CANVAS_W / 2, 238);
  ctx.restore();

  // Inner glow pass
  ctx.save();
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 12 * glow;
  ctx.font = "bold 42px monospace";
  ctx.fillStyle = "#4fc3f7";
  ctx.textAlign = "center";
  ctx.fillText("SALTMINE", CANVAS_W / 2, 190);
  ctx.fillText("XCAPE", CANVAS_W / 2, 238);
  ctx.restore();

  // Tagline
  ctx.save();
  ctx.font = "italic 12px monospace";
  ctx.fillStyle = "#8899aa";
  ctx.textAlign = "center";
  ctx.fillText("A CRYPTO SURVIVAL STORY", CANVAS_W / 2, 268);
  ctx.restore();

  // ICP staking subline
  ctx.font = "10px monospace";
  ctx.fillStyle = "#445566";
  ctx.textAlign = "center";
  ctx.fillText("10,000 ICP STAKED. SURVIVE 8 YEARS.", CANVAS_W / 2, 290);

  // Blinking START prompt
  if (Math.floor(frame / 30) % 2 === 0) {
    ctx.save();
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 10;
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#ffd700";
    ctx.textAlign = "center";
    ctx.fillText("[ PRESS SPACE TO START ]", CANVAS_W / 2, 380);
    ctx.restore();
  }

  // === BEAR SILHOUETTE at bottom ===
  ctx.save();
  ctx.translate(CANVAS_W / 2 - 22, 460);

  // Bear body silhouette
  ctx.fillStyle = "#1a0000";
  ctx.fillRect(6, 16, 30, 28);
  ctx.fillRect(0, 24, 42, 18);
  // Head
  ctx.fillRect(8, 0, 26, 22);
  // Ears
  ctx.fillRect(5, -5, 10, 10);
  ctx.fillRect(27, -5, 10, 10);
  // Arms raised
  const bearSway = Math.sin(frame * 0.04) * 5;
  ctx.fillRect(-4, 12 + bearSway, 12, 18);
  ctx.fillRect(34, 12 - bearSway, 12, 18);

  // Glowing red eyes
  ctx.shadowColor = "#ff0000";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#ff2200";
  ctx.fillRect(13, 6, 5, 5);
  ctx.fillRect(24, 6, 5, 5);
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "#ff0000";
  ctx.shadowBlur = 8;
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "#cc0000";
  ctx.textAlign = "center";
  ctx.fillText("EVIL CRYPTO BEAR", CANVAS_W / 2, 560);
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.textAlign = "left";
}

const LEVEL_PALETTES = [
  {
    bg1: "#0d0d1a",
    bg2: "#1a0d2e",
    platformColor: "#4a3060",
    crystalColor: "#4fc3f7",
    flashColor: "#1a0d2e",
  },
  {
    bg1: "#0d1a0d",
    bg2: "#0d2e1a",
    platformColor: "#305040",
    crystalColor: "#4fc3f7",
    flashColor: "#0d2e1a",
  },
  {
    bg1: "#1a0d0d",
    bg2: "#2e0d0d",
    platformColor: "#603030",
    crystalColor: "#f74f4f",
    flashColor: "#2e0d0d",
  },
  {
    bg1: "#1a1a0d",
    bg2: "#2e2e0d",
    platformColor: "#605030",
    crystalColor: "#f7c84f",
    flashColor: "#2e2e0d",
  },
  {
    bg1: "#0d1a1a",
    bg2: "#0d2e2e",
    platformColor: "#305060",
    crystalColor: "#4ff7e8",
    flashColor: "#0d2e2e",
  },
  {
    bg1: "#1a0d1a",
    bg2: "#2e0d2e",
    platformColor: "#603060",
    crystalColor: "#d44ff7",
    flashColor: "#2e0d2e",
  },
  {
    bg1: "#1a1a0d",
    bg2: "#2e2e00",
    platformColor: "#606000",
    crystalColor: "#f7f74f",
    flashColor: "#2e2e00",
  },
  {
    bg1: "#0a0a0a",
    bg2: "#1a0000",
    platformColor: "#500000",
    crystalColor: "#ff4f4f",
    flashColor: "#1a0000",
  },
];

const INTRO_PAGES = [
  {
    title: "THE STORY SO FAR...",
    lines: [
      "James Salt holds a large crypto portfolio.",
      "",
      "Portfolio value: $100,000",
      "",
      "He has diamond hands.",
      "James had conviction.",
      "He has a baseball cap.",
    ],
  },
  {
    title: "THE CRASH",
    lines: [
      "THE MARKET CRASHES 90%",
      "",
      "CRYPTO: -90%",
      "",
      "Portfolio: $100,000 → $10,000",
      "",
      "THE EVIL CRYPTO BEAR APPEARS!",
    ],
  },
  {
    title: "THE BANISHMENT",
    lines: [
      '"YOUR BAGS ARE WORTHLESS!"',
      "         - Evil Crypto Bear",
      "",
      "James is banished to the",
      "SALT MINES OF CONVICTION",
      "",
      "Survive 8 years. Reach the",
      "escape portal. Recover your",
      "portfolio. Simple.",
    ],
  },
  {
    title: "SURVIVAL BRIEFING",
    lines: [
      "In the Salt Mines, dehydration",
      "is no joke. Doctors call it",
      "hypernatraemia.",
      "",
      "James calls it 'being too salty.'",
      "",
      "Collect ALL water bottles each level.",
      "Your sodium levels demand it.",
      "",
      "Miss even one?",
      "The Crypto Bear keeps your soul.",
      "(And your life. Literally.)",
    ],
  },
];

function drawIntroScreen(
  ctx: CanvasRenderingContext2D,
  page: number,
  frame: number,
) {
  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = "#1a0000";
  ctx.fillRect(20, 20, CANVAS_W - 40, CANVAS_H - 40);
  ctx.strokeStyle = "#cc0000";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, CANVAS_W - 40, CANVAS_H - 40);

  const data = INTRO_PAGES[page];
  ctx.font = "bold 16px monospace";
  ctx.fillStyle = "#ff4444";
  ctx.textAlign = "center";
  ctx.fillText(data.title, CANVAS_W / 2, 80);

  ctx.font = "11px monospace";
  ctx.fillStyle = "#ddd";
  data.lines.forEach((line, i) => {
    ctx.fillText(line, CANVAS_W / 2, 140 + i * 22);
  });

  if (Math.floor(frame / 30) % 2 === 0) {
    ctx.font = "bold 10px monospace";
    ctx.fillStyle = "#ffd700";
    ctx.fillText(
      page < INTRO_PAGES.length - 1
        ? "PRESS SPACE TO CONTINUE"
        : "PRESS SPACE TO BEGIN",
      CANVAS_W / 2,
      CANVAS_H - 60,
    );
  }

  ctx.fillStyle = "#444";
  ctx.font = "9px monospace";
  ctx.fillText(
    `${page + 1} / ${INTRO_PAGES.length}`,
    CANVAS_W / 2,
    CANVAS_H - 30,
  );

  ctx.textAlign = "left";
}

function drawYearCompleteScreen(
  ctx: CanvasRenderingContext2D,
  level: number,
  score: number,
  frame: number,
) {
  ctx.fillStyle = "#0a0f0a";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = "#0a2a0a";
  ctx.fillRect(40, 80, CANVAS_W - 80, CANVAS_H - 160);
  ctx.strokeStyle = "#4fc3f7";
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 80, CANVAS_W - 80, CANVAS_H - 160);

  const glow = 0.7 + Math.sin(frame * 0.08) * 0.25;
  ctx.save();
  ctx.shadowColor = "#4fc3f7";
  ctx.shadowBlur = 15 * glow;
  ctx.font = "bold 20px monospace";
  ctx.fillStyle = "#4fc3f7";
  ctx.textAlign = "center";
  ctx.fillText(`YEAR ${level + 1} SURVIVED!`, CANVAS_W / 2, 150);
  ctx.restore();

  ctx.font = "13px monospace";
  ctx.fillStyle = "#81c784";
  ctx.textAlign = "center";
  ctx.fillText(
    `PORTFOLIO VALUE: $${score.toLocaleString()}`,
    CANVAS_W / 2,
    210,
  );
  ctx.fillText("Keep stacking. The mine won't hold you.", CANVAS_W / 2, 240);

  if (level < 6) {
    ctx.fillStyle = "#aaa";
    ctx.font = "10px monospace";
    ctx.fillText(`${7 - level} years remaining...`, CANVAS_W / 2, 330);
  } else {
    ctx.fillStyle = "#ff9800";
    ctx.font = "bold 11px monospace";
    ctx.fillText("FINAL YEAR! ESCAPE THE MINE!", CANVAS_W / 2, 330);
  }

  if (Math.floor(frame / 30) % 2 === 0) {
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = "#ffd700";
    ctx.fillText("PRESS SPACE TO CONTINUE", CANVAS_W / 2, 420);
  }

  ctx.textAlign = "left";
}

function drawGameOverScreen(
  ctx: CanvasRenderingContext2D,
  score: number,
  frame: number,
) {
  ctx.fillStyle = "#0f0000";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const shake = Math.sin(frame * 0.3) * 2;
  ctx.save();
  ctx.translate(shake, 0);
  ctx.font = "bold 52px monospace";
  ctx.fillStyle = "#cc0000";
  ctx.textAlign = "center";
  ctx.shadowColor = "#ff0000";
  ctx.shadowBlur = 20;
  ctx.fillText("REKT", CANVAS_W / 2, 200);
  ctx.restore();

  ctx.font = "bold 14px monospace";
  ctx.fillStyle = "#ff6666";
  ctx.textAlign = "center";
  ctx.fillText("YOUR PORTFOLIO IS DUST", CANVAS_W / 2, 280);

  ctx.font = "11px monospace";
  ctx.fillStyle = "#aaa";
  ctx.fillText(
    `FINAL PORTFOLIO: $${score.toLocaleString()}`,
    CANVAS_W / 2,
    330,
  );
  ctx.fillText("THE BEAR WAS RIGHT.", CANVAS_W / 2, 360);
  ctx.fillText("(this time)", CANVAS_W / 2, 382);

  if (Math.floor(frame / 30) % 2 === 0) {
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = "#ffd700";
    ctx.fillText("PRESS SPACE TO RETRY", CANVAS_W / 2, 450);
  }
  ctx.textAlign = "left";
}

function drawVictoryScreen(
  ctx: CanvasRenderingContext2D,
  score: number,
  lives: number,
  frame: number,
) {
  ctx.fillStyle = "#000a0a";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Sparkle effects
  for (let i = 0; i < 20; i++) {
    const sx = (i * 67 + frame * 2) % CANVAS_W;
    const sy = (i * 43 + frame * 3) % CANVAS_H;
    const alpha = 0.3 + Math.sin(frame * 0.1 + i) * 0.25;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#4fc3f7";
    ctx.fillRect(sx, sy, 2, 2);
    ctx.restore();
  }

  const glow = 0.8 + Math.sin(frame * 0.07) * 0.2;
  ctx.save();
  ctx.shadowColor = "#4fc3f7";
  ctx.shadowBlur = 30 * glow;
  ctx.font = "bold 18px monospace";
  ctx.fillStyle = "#4fc3f7";
  ctx.textAlign = "center";
  ctx.fillText("PORTFOLIO RECOVERED!", CANVAS_W / 2, 120);
  ctx.restore();

  ctx.font = "bold 13px monospace";
  ctx.fillStyle = "#ffd700";
  ctx.textAlign = "center";
  ctx.fillText("James Salt escapes the Salt Mines!", CANVAS_W / 2, 170);

  const bonus = 1 + (lives - 1) * 0.15;
  const finalValue = Math.floor(score * bonus);
  ctx.fillStyle = "#4fc3f7";
  ctx.font = "bold 14px monospace";
  ctx.fillText(
    `FINAL PORTFOLIO: $${finalValue.toLocaleString()}`,
    CANVAS_W / 2,
    220,
  );

  ctx.fillStyle = "#aaa";
  ctx.font = "10px monospace";
  ctx.fillText(`LIVES REMAINING: ${lives}`, CANVAS_W / 2, 260);
  ctx.fillText(`PERFORMANCE BONUS: x${bonus.toFixed(2)}`, CANVAS_W / 2, 280);

  ctx.font = "12px monospace";
  ctx.fillStyle = "#ff9800";
  ctx.fillText(
    '"Never sold. Never doubted. Never showered."',
    CANVAS_W / 2,
    340,
  );
  ctx.fillStyle = "#888";
  ctx.font = "10px monospace";
  ctx.fillText("      - James Salt", CANVAS_W / 2, 362);

  if (Math.floor(frame / 30) % 2 === 0) {
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = "#ffd700";
    ctx.fillText("PRESS SPACE TO PLAY AGAIN", CANVAS_W / 2, 490);
  }
  ctx.textAlign = "left";
}

function renderGame(ctx: CanvasRenderingContext2D, gs: GameState) {
  ctx.save();
  ctx.scale(320 / 480, 480 / 640);
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  if (gs.screen === "TITLE") {
    drawTitleScreen(ctx, gs.frameCount);
    ctx.restore();
    return;
  }
  if (gs.screen === "INTRO") {
    drawIntroScreen(ctx, gs.introPage, gs.frameCount);
    ctx.restore();
    return;
  }
  if (gs.screen === "YEAR_COMPLETE") {
    drawYearCompleteScreen(
      ctx,
      gs.level,
      Math.floor(gs.portfolioValue * gs.portfolioMultiplier),
      gs.frameCount,
    );
    ctx.restore();
    return;
  }
  if (gs.screen === "GAME_OVER") {
    drawGameOverScreen(
      ctx,
      Math.floor(gs.portfolioValue * gs.portfolioMultiplier),
      gs.frameCount,
    );
    ctx.restore();
    return;
  }
  if (gs.screen === "VICTORY") {
    drawVictoryScreen(
      ctx,
      Math.floor(gs.portfolioValue * gs.portfolioMultiplier),
      gs.lives,
      gs.frameCount,
    );
    ctx.restore();
    return;
  }

  // --- PLAYING ---
  const level = LEVELS[gs.level];

  drawBackground(ctx, gs.level, gs.frameCount);

  // Platforms (randomly generated each level)
  const levelPalette = LEVEL_PALETTES[gs.level % LEVEL_PALETTES.length];
  for (const plat of gs.currentPlatforms) {
    drawPlatform(
      ctx,
      plat.x,
      plat.y,
      plat.w,
      plat.h,
      levelPalette.platformColor,
    );
  }

  // Exit portal
  const exit = level.exitPosition;
  drawExit(ctx, exit.x, exit.y, gs.frameCount);

  // Water Bottles
  for (const wb of gs.waterBottles) {
    if (!wb.collected) drawWaterBottle(ctx, wb.x, wb.y, gs.frameCount);
  }

  // Hazards
  for (const h of gs.hazards) {
    drawHazard(ctx, h);
    // Flagged hazard warning overlay
    if (h.flagged && h.flagTimer !== undefined) {
      const flashRate = h.flagTimer < 40 ? 4 : 12;
      if (Math.floor(h.flagTimer / flashRate) % 2 === 0) {
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = h.flagged === "explode" ? "#ff3300" : "#cccccc";
        ctx.fillRect(h.x, h.y, h.w, h.h);
        ctx.globalAlpha = 1;
        if (h.flagged === "explode") {
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "center";
          ctx.fillText("💥", h.x + h.w / 2, h.y + h.h / 2 + 3);
        }
        ctx.restore();
      }
    }
  }

  // Maturity bags
  for (const mb of gs.maturityBags) {
    if (!mb.collected)
      drawMaturityBag(ctx, mb.x, mb.y, mb.lifetime, mb.maxLifetime, mb.amount);
  }
  // Community bags
  for (const cb of gs.communityBags) {
    if (!cb.collected) drawCommunityBag(ctx, cb.x, cb.y, cb.lifetime);
  }

  // Bullets
  for (const b of gs.bullets) {
    ctx.save();
    ctx.shadowColor = "#ffcc00";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#ffee00";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(b.x, b.y + 1, 4, b.h - 2);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Explosion projectiles
  for (const ep of gs.explosionProjectiles) {
    const alpha = ep.lifetime / ep.maxLifetime;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "#ff6600";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ff4400";
    ctx.fillRect(ep.x - 4, ep.y - 4, 8, 8);
    ctx.fillStyle = "#ffcc00";
    ctx.fillRect(ep.x - 2, ep.y - 2, 4, 4);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Floating texts
  for (const ft of gs.floatingTexts) {
    const alpha = Math.min(1, ft.timer / 30);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = ft.color;
    ctx.shadowBlur = 8;
    ctx.font = "bold 10px monospace";
    ctx.fillStyle = ft.color;
    ctx.textAlign = "center";
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.textAlign = "left";
    ctx.restore();
  }

  // Gun pickups
  for (const gp of gs.gunPickups) {
    if (!gp.collected) drawGunPickup(ctx, gp.x, gp.y, gs.frameCount);
  }

  // Bear
  const bear = level.bearPosition;
  drawBear(
    ctx,
    gs.bearX - 10,
    bear.y - 10,
    gs.bearArmRaise,
    gs.bearThrowAnim,
    gs.bearWalkFrame,
  );

  // Steam particles
  for (const sp of gs.steamParticles) {
    ctx.save();
    ctx.globalAlpha = sp.alpha;
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 4;
    ctx.fillStyle = "#ccddff";
    ctx.fillRect(sp.x, sp.y, 3, 3);
    ctx.restore();
  }

  // Axe pickups
  for (const ap of gs.axePickups) {
    if (!ap.collected) drawAxePickup(ctx, ap.x, ap.y, gs.frameCount);
  }

  // Player
  drawPlayer(
    ctx,
    gs.player,
    gs.saltMeter,
    gs.hasAxe,
    gs.axeTimer,
    gs.dyingTimer,
  );

  // Level transition flash
  if (gs.levelTransitionAlpha > 0) {
    const palette = LEVEL_PALETTES[gs.level % LEVEL_PALETTES.length];
    ctx.save();
    ctx.globalAlpha = gs.levelTransitionAlpha;
    ctx.fillStyle = palette.flashColor;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();
  }

  // Bottle warning overlay
  if (gs.bottleWarningTimer > 0) {
    const alpha = Math.min(1, gs.bottleWarningTimer / 30);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 60, CANVAS_W, 60);
    ctx.font = "bold 18px monospace";
    ctx.fillStyle = "#ff4444";
    ctx.textAlign = "center";
    ctx.fillText("COLLECT ALL WATER BOTTLES FIRST!", CANVAS_W / 2, 95);
    ctx.restore();
  }

  // Level complete flash
  if (gs.levelComplete) {
    const alpha = Math.min(0.5, (gs.victoryTimer / 90) * 0.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#4fc3f7";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();
  }
  // End scale transform
  ctx.restore();
}

// ---- REACT COMPONENT ----

interface HudData {
  lives: number;
  level: number;
  portfolioValue: number;
  saltMeter: number;
  hasAxe: boolean;
  axeTimer: number;
  hasGun: boolean;
  gunTimer: number;
  bottlesLeft: number;
  totalBottles: number;
  portfolioMultiplier: number;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GameState>({
    screen: "TITLE",
    introPage: 0,
    level: 0,
    lives: 3,
    portfolioValue: 10000,
    saltMeter: 0,
    player: makePlayer(0),
    hazards: [],
    waterBottles: [],
    spawnerStates: [],
    hasAxe: false,
    axeTimer: 0,
    axePickups: [],
    portfolioMultiplier: 1.0,
    maturityBags: [],
    communityBags: [],
    floatingTexts: [],
    maturitySpawnTimer: 0,
    nextMaturityId: 1,
    nextFloatTextId: 1,
    debuffTimer: 0,
    bearThrowTimer: 0,
    nextHazardId: 1,
    frameCount: 0,
    currentPlatforms: [],
    levelComplete: false,
    victoryTimer: 0,
    bearArmRaise: 0,
    particleTimer: 0,
    steamParticles: [],
    keys: new Set(),
    sfxQueue: [],
    footstepTimer: 0,
    bottleWarningTimer: 0,
    bearThrowAnim: 0,
    levelTransitionAlpha: 0,
    dyingTimer: 0,
    bearX: 200,
    bearDir: 1,
    bearWalkFrame: 0,
    hasGun: false,
    gunTimer: 0,
    gunCooldown: 0,
    gunPickups: [],
    bullets: [],
    nextBulletId: 1,
    explosionProjectiles: [],
    nextExplosionId: 1,
  });
  const rafRef = useRef<number>(0);
  const prevScreenRef = useRef<GameScreen>("TITLE");
  const [leaderboard, setLeaderboard] = useState<
    { name: string; score: number }[]
  >(() => {
    try {
      return JSON.parse(localStorage.getItem("saltmine_leaderboard") || "[]");
    } catch {
      return [];
    }
  });
  const [showNameEntry, setShowNameEntry] = useState(false);
  const [pendingScore, setPendingScore] = useState(0);
  const [nameInput, setNameInput] = useState("");
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const gamepadIndexRef = useRef<number>(-1);
  const [hasAxeDisplay, setHasAxeDisplay] = useState(false);
  const hasAxeDisplayRef = useRef(false);
  const [hasGunDisplay, setHasGunDisplay] = useState(false);
  const hasGunDisplayRef = useRef(false);
  const prevBtnARef = useRef(false);
  const sfxRef = useRef<{ play: (e: string) => void } | null>(null);
  const sfxAudioCtxRef = useRef<AudioContext | null>(null);
  const [sfxMuted, setSfxMuted] = useState(false);
  const [sfxVolume, setSfxVolume] = useState(0.5);
  const sfxVolumeRef = useRef(0.5);
  const sfxMutedRef = useRef(false);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const musicStartedRef = useRef(false);
  const [_musicMuted, _setMusicMuted] = useState(false);
  const musicMutedRef = useRef(false);
  const [hudData, setHudData] = useState<HudData>({
    lives: 3,
    level: 0,
    portfolioValue: 10000,
    saltMeter: 0,
    hasAxe: false,
    axeTimer: 600,
    hasGun: false,
    gunTimer: 0,
    bottlesLeft: 0,
    totalBottles: 0,
    portfolioMultiplier: 1.0,
  });

  // toggleMusicMute kept for future use
  const _toggleMusicMute = useCallback(() => {
    _setMusicMuted((prev) => {
      const next = !prev;
      musicMutedRef.current = next;
      if (musicRef.current) musicRef.current.muted = next;
      return next;
    });
  }, []);

  useEffect(() => {
    const audio = new Audio(
      "/assets/uploads/neon-in-my-veins-019d32fe-e0e6-746b-8a8c-ba6c4cb124f1-1.mp3",
    );
    audio.loop = true;
    audio.volume = 0.4;
    audio.muted = false;
    audio.preload = "none";
    audio.play().catch(() => {});
    musicRef.current = audio;
    const unlock = () => {
      if (musicStartedRef.current) return;
      musicStartedRef.current = true;
      audio.play().catch(() => {});
      document.removeEventListener("touchstart", unlock, true);
      document.removeEventListener("click", unlock, true);
      document.removeEventListener("keydown", unlock, true);
    };
    document.addEventListener("touchstart", unlock, true);
    document.addEventListener("click", unlock, true);
    document.addEventListener("keydown", unlock, true);
    return () => {
      document.removeEventListener("touchstart", unlock, true);
      document.removeEventListener("click", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      audio.pause();
      musicRef.current = null;
    };
  }, []);

  const startMusic = useCallback(() => {
    const audio = musicRef.current;
    if (!audio || musicStartedRef.current) return;
    musicStartedRef.current = true;
    audio.muted = false;
    musicMutedRef.current = false;
    _setMusicMuted(false);
    audio.play().catch(() => {});
  }, []);

  const toggleSfxMute = useCallback(() => {
    setSfxMuted((prev) => {
      const next = !prev;
      sfxMutedRef.current = next;
      return next;
    });
  }, []);

  const handleSfxVolume = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number.parseFloat(e.target.value);
      setSfxVolume(v);
      sfxVolumeRef.current = v;
    },
    [],
  );

  const submitScore = useCallback(() => {
    if (!nameInput.trim()) return;
    const newEntry = { name: nameInput.trim(), score: pendingScore };
    const updated = [...leaderboard, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    setLeaderboard(updated);
    localStorage.setItem("saltmine_leaderboard", JSON.stringify(updated));
    setShowNameEntry(false);
    setNameInput("");
  }, [nameInput, pendingScore, leaderboard]);

  const resetGame = useCallback(() => {
    const gs = gsRef.current;
    gs.screen = "TITLE";
    gs.introPage = 0;
    gs.level = 0;
    gs.lives = 3;
    gs.portfolioValue = 0;
    gs.saltMeter = 0;
    gs.hazards = [];
    gs.waterBottles = [];
    gs.spawnerStates = [];
    gs.hasAxe = false;
    gs.axeTimer = 0;
    gs.axePickups = [];
    gs.portfolioMultiplier = 1.0;
    gs.maturityBags = [];
    gs.communityBags = [];
    gs.floatingTexts = [];
    gs.maturitySpawnTimer = 0;
    gs.debuffTimer = 0;
    gs.bearThrowTimer = 0;
    gs.currentPlatforms = [];
    gs.frameCount = 0;
    gs.steamParticles = [];
    gs.keys = new Set();
    gs.sfxQueue = [];
    gs.footstepTimer = 0;
    gs.bearThrowAnim = 0;
    gs.levelTransitionAlpha = 0;
    gs.dyingTimer = 0;
    gs.bearX = 200;
    gs.bearDir = 1;
    gs.bearWalkFrame = 0;
  }, []);

  const handleSpace = useCallback(() => {
    const gs = gsRef.current;
    if (gs.screen === "TITLE") {
      gs.screen = "INTRO";
      gs.introPage = 0;
      gs.frameCount = 0;
    } else if (gs.screen === "INTRO") {
      gs.introPage++;
      if (gs.introPage >= INTRO_PAGES.length) {
        gs.screen = "PLAYING";
        initLevel(gs, 0);
      }
      gs.frameCount = 0;
    } else if (gs.screen === "YEAR_COMPLETE") {
      gs.level++;
      gs.screen = "PLAYING";
      initLevel(gs, gs.level);
    } else if (gs.screen === "GAME_OVER") {
      resetGame();
    } else if (gs.screen === "VICTORY") {
      resetGame();
    }
  }, [resetGame]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!sfxAudioCtxRef.current) {
        try {
          sfxAudioCtxRef.current = new AudioContext();
          sfxRef.current = createSFX(sfxAudioCtxRef.current, () =>
            sfxMutedRef.current ? 0 : sfxVolumeRef.current,
          );
        } catch (_e) {}
      }
      startMusic();
      gsRef.current.keys.add(e.code);
      if (e.code === "Space" || e.code === "KeyZ") {
        if (
          ["TITLE", "INTRO", "YEAR_COMPLETE", "GAME_OVER", "VICTORY"].includes(
            gsRef.current.screen,
          )
        ) {
          handleSpace();
        }
        e.preventDefault();
      }
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.code)
      ) {
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      gsRef.current.keys.delete(e.code);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [handleSpace, startMusic]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let last = 0;
    function loop(ts: number) {
      const dt = Math.min((ts - last) / 16.67, 2);
      last = ts;
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp =
        gamepadIndexRef.current >= 0 ? gamepads[gamepadIndexRef.current] : null;
      if (gp) {
        const gs = gsRef.current;
        const axisX = gp.axes[0] ?? 0;
        const axisY = gp.axes[1] ?? 0;
        const dLeft = gp.buttons[14]?.pressed || axisX < -0.5;
        const dRight = gp.buttons[15]?.pressed || axisX > 0.5;
        const dUp = gp.buttons[12]?.pressed || axisY < -0.5;
        const dDown = gp.buttons[13]?.pressed || axisY > 0.5;
        const btnA = gp.buttons[0]?.pressed ?? false;
        const btnB = gp.buttons[1]?.pressed ?? false;
        if (dLeft) gs.keys.add("ArrowLeft");
        else gs.keys.delete("ArrowLeft");
        if (dRight) gs.keys.add("ArrowRight");
        else gs.keys.delete("ArrowRight");
        if (dUp) gs.keys.add("ArrowUp");
        else gs.keys.delete("ArrowUp");
        if (dDown) gs.keys.add("ArrowDown");
        else gs.keys.delete("ArrowDown");
        if (btnA) gs.keys.add("Space");
        else gs.keys.delete("Space");
        if (btnB) gs.keys.add("AxeSmash");
        else gs.keys.delete("AxeSmash");
        if (btnA && !prevBtnARef.current) {
          if (
            [
              "TITLE",
              "INTRO",
              "YEAR_COMPLETE",
              "GAME_OVER",
              "VICTORY",
            ].includes(gs.screen)
          ) {
            handleSpace();
          }
        }
        prevBtnARef.current = btnA;
      }
      updateGame(gsRef.current, dt);
      const gs = gsRef.current;
      if (gs.sfxQueue.length > 0) {
        if (!sfxAudioCtxRef.current) {
          try {
            sfxAudioCtxRef.current = new AudioContext();
            sfxRef.current = createSFX(sfxAudioCtxRef.current, () =>
              sfxMutedRef.current ? 0 : sfxVolumeRef.current,
            );
          } catch (_e) {}
        }
        if (sfxRef.current) {
          for (const e of gs.sfxQueue) sfxRef.current!.play(e);
        }
        gs.sfxQueue = [];
      }
      renderGame(ctx, gs);
      if (gs.screen !== prevScreenRef.current) {
        prevScreenRef.current = gs.screen;
        if (gs.screen === "GAME_OVER" || gs.screen === "VICTORY") {
          setPendingScore(
            Math.floor(gs.portfolioValue * gs.portfolioMultiplier),
          );
          setShowNameEntry(true);
          setNameInput("");
        }
      }
      if (gs.hasAxe !== hasAxeDisplayRef.current) {
        hasAxeDisplayRef.current = gs.hasAxe;
        setHasAxeDisplay(gs.hasAxe);
      }
      if (gs.hasGun !== hasGunDisplayRef.current) {
        hasGunDisplayRef.current = gs.hasGun;
        setHasGunDisplay(gs.hasGun);
      }
      // Update HUD data every frame (React batches these efficiently)
      if (gs.frameCount % 3 === 0) {
        const bottlesLeft = gs.waterBottles.filter((k) => !k.collected).length;
        const totalBottles = gs.waterBottles.length;
        setHudData({
          lives: gs.lives,
          level: gs.level,
          portfolioValue: gs.portfolioValue,
          saltMeter: gs.saltMeter,
          hasAxe: gs.hasAxe,
          axeTimer: gs.axeTimer,
          hasGun: gs.hasGun,
          gunTimer: gs.gunTimer,
          bottlesLeft,
          totalBottles,
          portfolioMultiplier: gs.portfolioMultiplier,
        });
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [handleSpace]);

  useEffect(() => {
    const onConnect = (e: GamepadEvent) => {
      setGamepadConnected(true);
      gamepadIndexRef.current = e.gamepad.index;
    };
    const onDisconnect = () => {
      setGamepadConnected(false);
      gamepadIndexRef.current = -1;
      const gs = gsRef.current;
      gs.keys.delete("ArrowLeft");
      gs.keys.delete("ArrowRight");
      gs.keys.delete("ArrowUp");
      gs.keys.delete("ArrowDown");
      gs.keys.delete("Space");
      gs.keys.delete("AxeSmash");
    };
    window.addEventListener("gamepadconnected", onConnect);
    window.addEventListener("gamepaddisconnected", onDisconnect);
    return () => {
      window.removeEventListener("gamepadconnected", onConnect);
      window.removeEventListener("gamepaddisconnected", onDisconnect);
    };
  }, []);

  const onTouchBtn = useCallback(
    (key: string, active: boolean) => {
      const gs = gsRef.current;
      if (active) {
        gs.keys.add(key);
        if (key === "Space") {
          if (
            [
              "TITLE",
              "INTRO",
              "YEAR_COMPLETE",
              "GAME_OVER",
              "VICTORY",
            ].includes(gs.screen)
          ) {
            handleSpace();
          }
        }
      } else {
        gs.keys.delete(key);
      }
    },
    [handleSpace],
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "#000",
        minHeight: "100dvh",
        overflow: "hidden",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* ── HTML HUD STRIP ── */}
      <div
        style={{
          width: 320,
          maxWidth: "100vw",
          background: "#050510",
          borderBottom: "2px solid #4fc3f7",
          padding: "4px 8px",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "4px 6px",
          fontFamily: "monospace",
        }}
      >
        {/* Lives */}
        <div
          style={{ display: "flex", gap: 2 }}
          aria-label={`${hudData.lives} lives`}
        >
          {[1, 2, 3].map((n) => (
            <svg
              key={n}
              aria-hidden="true"
              width="13"
              height="13"
              viewBox="0 0 13 13"
              style={{ opacity: n <= hudData.lives ? 1 : 0.15 }}
            >
              <rect x="2" y="1" width="3" height="2" fill="#ff3333" />
              <rect x="7" y="1" width="3" height="2" fill="#ff3333" />
              <rect x="1" y="3" width="10" height="4" fill="#ff3333" />
              <rect x="2" y="7" width="8" height="2" fill="#ff3333" />
              <rect x="3" y="9" width="6" height="2" fill="#ff3333" />
              <rect x="4" y="11" width="4" height="1" fill="#ff3333" />
              <rect x="5" y="12" width="2" height="1" fill="#ff3333" />
            </svg>
          ))}
        </div>

        {/* Year */}
        <div
          style={{
            color: "#ffd700",
            fontSize: 11,
            fontWeight: "bold",
            minWidth: 44,
          }}
        >
          YR {hudData.level + 1}/8
        </div>

        {/* Portfolio Value */}
        <div
          style={{
            color: "#81c784",
            fontSize: 10,
            minWidth: 100,
            fontWeight: "bold",
          }}
        >
          $
          {Math.floor(
            hudData.portfolioValue * hudData.portfolioMultiplier,
          ).toLocaleString()}
        </div>

        {/* Bottles - using teal bottle icon */}
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <svg aria-hidden="true" width="10" height="18" viewBox="0 0 16 22">
            {/* Cap */}
            <rect x="4" y="0" width="8" height="5" fill="#0288d1" />
            {/* Bottle body */}
            <rect x="3" y="6" width="10" height="13" fill="#b3e5fc" />
            <rect x="2" y="8" width="12" height="9" fill="#b3e5fc" />
            <rect x="4" y="4" width="8" height="5" fill="#b3e5fc" />
            {/* Label */}
            <rect x="3" y="9" width="10" height="6" fill="#ffffff" />
            {/* Highlight */}
            <rect
              x="4"
              y="6"
              width="2"
              height="10"
              fill="rgba(255,255,255,0.5)"
            />
          </svg>
          <span style={{ color: "#81d4fa", fontSize: 10 }}>
            {hudData.totalBottles - hudData.bottlesLeft}/{hudData.totalBottles}
          </span>
        </div>

        {/* Salt Meter */}
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <span style={{ color: "#aaa", fontSize: 9 }}>☠</span>
          <div
            style={{
              width: 36,
              height: 8,
              background: "#1a1a1a",
              border: "1px solid #555",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${hudData.saltMeter}%`,
                height: "100%",
                background:
                  hudData.saltMeter > 75
                    ? "#f44336"
                    : hudData.saltMeter > 40
                      ? "#ff9800"
                      : "#4caf50",
                transition: "width 0.1s",
              }}
            />
          </div>
        </div>

        {/* Axe timer bar (only when holding axe) */}
        {hudData.hasAxe && (
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ color: "#ffd700", fontSize: 9 }}>⛏</span>
            <div
              style={{
                width: 30,
                height: 8,
                background: "#1a1a1a",
                border: "1px solid #666",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, (hudData.axeTimer / 600) * 100)}%`,
                  height: "100%",
                  background:
                    hudData.axeTimer < 120
                      ? Math.floor(Date.now() / 200) % 2 === 0
                        ? "#ffd700"
                        : "#ff4444"
                      : "#ffd700",
                }}
              />
            </div>
          </div>
        )}

        {/* Gun timer bar (only when holding gun) */}
        {hudData.hasGun && (
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ color: "#00ff88", fontSize: 9 }}>🔫</span>
            <div
              style={{
                width: 30,
                height: 8,
                background: "#1a1a1a",
                border: "1px solid #666",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, (hudData.gunTimer / 500) * 100)}%`,
                  height: "100%",
                  background:
                    hudData.gunTimer < 100
                      ? Math.floor(Date.now() / 200) % 2 === 0
                        ? "#00ff88"
                        : "#ff4444"
                      : "#00ff88",
                }}
              />
            </div>
          </div>
        )}

        {/* SFX controls (right-aligned) */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 4,
            alignItems: "center",
          }}
        >
          {!sfxMuted && (
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={sfxVolume}
              onChange={handleSfxVolume}
              data-ocid="sfx.select"
              title="SFX volume"
              style={{
                width: 44,
                height: 4,
                accentColor: "#4fc3f7",
                cursor: "pointer",
              }}
            />
          )}
          <button
            type="button"
            data-ocid="sfx.toggle"
            onClick={() => {
              if (!sfxAudioCtxRef.current) {
                try {
                  sfxAudioCtxRef.current = new AudioContext();
                  sfxRef.current = createSFX(sfxAudioCtxRef.current, () =>
                    sfxMutedRef.current ? 0 : sfxVolumeRef.current,
                  );
                } catch (_e) {}
              }
              toggleSfxMute();
            }}
            title={sfxMuted ? "Unmute SFX" : "Mute SFX"}
            style={{
              width: 28,
              height: 28,
              background: "rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 22 22"
              fill="none"
            >
              {sfxMuted ? (
                <>
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                    stroke="rgba(255,255,255,0.5)"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M8 8L14 14M14 8L8 14"
                    stroke="rgba(255,255,255,0.5)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </>
              ) : (
                <>
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                    stroke="white"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M9 8V14M11 7V15M13 9V13"
                    stroke="white"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* ── GAME CANVAS ── */}
      <div style={{ position: "relative", lineHeight: 0 }}>
        <canvas
          ref={canvasRef}
          width={320}
          height={480}
          data-ocid="game.canvas_target"
          style={{
            imageRendering: "pixelated",
            display: "block",
            maxWidth: "100vw",
          }}
        />
      </div>

      {/* ── TOUCH CONTROLS STRIP ── */}
      {!gamepadConnected && (
        <div
          style={{
            width: 320,
            maxWidth: "100vw",
            height: 110,
            background: "#080814",
            borderTop: "2px solid #1a1a3a",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            boxSizing: "border-box",
            flexShrink: 0,
          }}
        >
          {/* Left: D-pad (left / right only) */}
          <div style={{ display: "flex", gap: 10 }}>
            {/* LEFT button */}
            <button
              type="button"
              data-ocid="controls.left_button"
              onTouchStart={(e) => {
                e.preventDefault();
                startMusic();
                onTouchBtn("ArrowLeft", true);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                onTouchBtn("ArrowLeft", false);
              }}
              onMouseDown={() => onTouchBtn("ArrowLeft", true)}
              onMouseUp={() => onTouchBtn("ArrowLeft", false)}
              onMouseLeave={() => onTouchBtn("ArrowLeft", false)}
              aria-label="Left"
              style={{
                width: 60,
                height: 60,
                background: "rgba(255,255,255,0.12)",
                border: "2px solid rgba(255,255,255,0.25)",
                borderRadius: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                touchAction: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
              }}
            >
              <svg
                aria-hidden="true"
                focusable="false"
                width="22"
                height="22"
                viewBox="0 0 16 16"
              >
                <path d="M14,2 L2,8 L14,14 Z" fill="rgba(255,255,255,0.9)" />
              </svg>
            </button>

            {/* RIGHT button */}
            <button
              type="button"
              data-ocid="controls.right_button"
              onTouchStart={(e) => {
                e.preventDefault();
                startMusic();
                onTouchBtn("ArrowRight", true);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                onTouchBtn("ArrowRight", false);
              }}
              onMouseDown={() => onTouchBtn("ArrowRight", true)}
              onMouseUp={() => onTouchBtn("ArrowRight", false)}
              onMouseLeave={() => onTouchBtn("ArrowRight", false)}
              aria-label="Right"
              style={{
                width: 60,
                height: 60,
                background: "rgba(255,255,255,0.12)",
                border: "2px solid rgba(255,255,255,0.25)",
                borderRadius: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                touchAction: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
              }}
            >
              <svg
                aria-hidden="true"
                focusable="false"
                width="22"
                height="22"
                viewBox="0 0 16 16"
              >
                <path d="M2,2 L14,8 L2,14 Z" fill="rgba(255,255,255,0.9)" />
              </svg>
            </button>
          </div>

          {/* Right: Action buttons B (axe) + A (jump) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* B / Axe button */}
            <button
              type="button"
              data-ocid="controls.axe_button"
              onTouchStart={(e) => {
                e.preventDefault();
                startMusic();
                onTouchBtn("AxeSmash", true);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                onTouchBtn("AxeSmash", false);
              }}
              onMouseDown={() => onTouchBtn("AxeSmash", true)}
              onMouseUp={() => onTouchBtn("AxeSmash", false)}
              onMouseLeave={() => onTouchBtn("AxeSmash", false)}
              aria-label="Axe Smash B"
              style={{
                width: 60,
                height: 44,
                background: hasAxeDisplay
                  ? "rgba(255,200,50,0.25)"
                  : hasGunDisplay
                    ? "rgba(0,255,136,0.15)"
                    : "rgba(255,255,255,0.1)",
                border: `2px solid ${hasAxeDisplay ? "rgba(255,200,50,0.6)" : hasGunDisplay ? "rgba(0,255,136,0.6)" : "rgba(255,255,255,0.2)"}`,
                borderRadius: 10,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                color: hasAxeDisplay
                  ? "#ffc832"
                  : hasGunDisplay
                    ? "#00ff88"
                    : "rgba(255,255,255,0.4)",
                fontFamily: "monospace",
                fontSize: 12,
                fontWeight: "bold",
                touchAction: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
              }}
            >
              <span aria-hidden>
                {hasGunDisplay && !hasAxeDisplay ? "🔫" : "⛏"}
              </span>
              <span aria-hidden>B</span>
            </button>

            {/* A / Jump button */}
            <button
              type="button"
              data-ocid="controls.jump_button"
              onTouchStart={(e) => {
                e.preventDefault();
                startMusic();
                onTouchBtn("Space", true);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                onTouchBtn("Space", false);
              }}
              onMouseDown={() => onTouchBtn("Space", true)}
              onMouseUp={() => onTouchBtn("Space", false)}
              onMouseLeave={() => onTouchBtn("Space", false)}
              aria-label="Jump A"
              style={{
                width: 60,
                height: 44,
                background: "rgba(79,195,247,0.2)",
                border: "2px solid rgba(79,195,247,0.5)",
                borderRadius: 10,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                color: "#4fc3f7",
                fontFamily: "monospace",
                fontSize: 12,
                fontWeight: "bold",
                touchAction: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
              }}
            >
              <span aria-hidden style={{ fontSize: 14 }}>
                ▲
              </span>
              <span aria-hidden>A</span>
            </button>
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <div
        style={{
          color: "#333",
          fontFamily: "monospace",
          fontSize: 9,
          padding: "4px 0 2px",
          textAlign: "center",
        }}
      >
        © {new Date().getFullYear()}.{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noreferrer"
          style={{ color: "#444", textDecoration: "none" }}
        >
          Built with ♥ using caffeine.ai
        </a>
      </div>

      {/* ── LEADERBOARD MODAL (fixed, centered over everything) ── */}
      {showNameEntry && (
        <div
          data-ocid="leaderboard.modal"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.92)",
            zIndex: 200,
            fontFamily: "monospace",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#080818",
              border: "2px solid #ffd700",
              borderRadius: 8,
              padding: "24px 20px",
              maxWidth: 300,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: "bold",
                color: "#ffd700",
                letterSpacing: 3,
              }}
            >
              {gsRef.current.screen === "VICTORY"
                ? "YOU ESCAPED!"
                : "GAME OVER"}
            </div>
            <div style={{ fontSize: 12, color: "#aaa" }}>
              PORTFOLIO: ${pendingScore.toLocaleString()}
            </div>

            <div style={{ fontSize: 13, color: "#ffd700", marginTop: 8 }}>
              ⛏ ENTER YOUR NAME
            </div>
            <input
              maxLength={12}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitScore();
              }}
              data-ocid="leaderboard.input"
              placeholder="YOUR NAME"
              style={{
                background: "#1a1a2e",
                color: "#ffd700",
                border: "2px solid #ffd700",
                fontFamily: "monospace",
                fontSize: 16,
                padding: "6px 12px",
                textAlign: "center",
                width: "100%",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={submitScore}
              data-ocid="leaderboard.submit_button"
              style={{
                background: "#ffd700",
                color: "#000",
                fontFamily: "monospace",
                fontWeight: "bold",
                padding: "8px 28px",
                cursor: "pointer",
                border: "none",
                fontSize: 14,
                letterSpacing: 2,
                borderRadius: 4,
                width: "100%",
              }}
            >
              SUBMIT
            </button>

            <div
              style={{
                fontSize: 12,
                color: "#ffd700",
                letterSpacing: 2,
                marginTop: 8,
              }}
            >
              — TOP SCORES —
            </div>
            {leaderboard.length === 0 && (
              <div style={{ fontSize: 11, color: "#555" }}>
                No scores yet. Be the first!
              </div>
            )}
            {leaderboard.slice(0, 10).map((entry, i) => (
              <div
                key={`${entry.name}-${i}`}
                data-ocid={`leaderboard.item.${i + 1}`}
                style={{
                  fontSize: 11,
                  color: i === 0 ? "#ffd700" : "#aaa",
                  fontFamily: "monospace",
                }}
              >
                {String(i + 1).padStart(2, " ")}. {entry.name.padEnd(12, " ")} $
                {entry.score.toLocaleString()}
              </div>
            ))}
            <div style={{ fontSize: 10, color: "#555", marginTop: 8 }}>
              PRESS SPACE TO PLAY AGAIN
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
