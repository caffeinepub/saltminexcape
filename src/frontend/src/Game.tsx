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
  slowTimer?: number;
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

interface SpawnedPickup {
  id: number;
  x: number;
  y: number;
  type:
    | "pickaxe"
    | "gun"
    | "dynamite"
    | "saltshaker"
    | "hardhat"
    | "bubble"
    | "speedboots"
    | "magnet"
    | "portfolioshield";
  lifetime: number;
  maxLifetime: number;
  collected: boolean;
}

interface Dynamite {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  timer: number;
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
  currentWeapon:
    | "pickaxe"
    | "gun"
    | "dynamite"
    | "saltshaker"
    | "hardhat"
    | null;
  weaponTimer: number;
  weaponSpawnTimer: number;
  spawnedPickups: SpawnedPickup[];
  nextPickupId: number;
  dynamites: Dynamite[];
  nextDynamiteId: number;
  hasBubble: boolean;
  speedBootsTimer: number;
  magnetTimer: number;
  portfolioShieldTimer: number;
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
  gunCooldown: number;
  bullets: Bullet[];
  nextBulletId: number;
  explosionProjectiles: ExplosionProjectile[];
  nextExplosionId: number;
  dustParticles: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    alpha: number;
    size: number;
  }[];
  sparkParticles: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    alpha: number;
    color: string;
  }[];
  coinParticles: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    alpha: number;
  }[];
  screenShake: number;
  portfolioTickerFlash: number;
  portfolioTickerDir: 1 | -1;
  bearTauntTimer: number;
  damageFlashTimer: number;
  portfolioFlashGreenTimer: number;
  ambientParticles: {
    type: "dust" | "drip" | "ember" | "ash";
    x: number;
    y: number;
    vx: number;
    vy: number;
    alpha: number;
    size?: number;
  }[];
  bearStunTimer: number;
  bearRageCount: number;
  convictionCombo: number;
  comboTimer: number;
  hodlerStreak: number;
  dodgeStreak: number;
  nearMissTimer: number;
  dodgeBoostTimer: number;
  levelDeaths: number;
  saltFillReduction: number;
}

const PLAYER_W = 32;
const PLAYER_H = 48;
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
  gs.currentWeapon = null;
  gs.weaponTimer = 0;
  gs.weaponSpawnTimer = 60;
  gs.spawnedPickups = [];
  gs.nextPickupId = 1;
  gs.dynamites = [];
  gs.nextDynamiteId = 1;
  gs.hasBubble = false;
  gs.speedBootsTimer = 0;
  gs.magnetTimer = 0;
  gs.portfolioShieldTimer = 0;
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
  gs.gunCooldown = 0;
  gs.bullets = [];
  gs.nextBulletId = 1;
  gs.explosionProjectiles = [];
  gs.nextExplosionId = 1;
  gs.dustParticles = [];
  gs.sparkParticles = [];
  gs.coinParticles = [];
  gs.screenShake = 0;
  gs.portfolioTickerFlash = 0;
  gs.portfolioTickerDir = 1;
  gs.bearTauntTimer = 0;
  gs.damageFlashTimer = 0;
  gs.portfolioFlashGreenTimer = 0;
  gs.ambientParticles = [];
  gs.bearStunTimer = 0;
  gs.bearRageCount = 0;
  gs.convictionCombo = 0;
  gs.comboTimer = 0;
  gs.dodgeStreak = 0;
  gs.nearMissTimer = 0;
  gs.dodgeBoostTimer = 0;
  gs.levelDeaths = 0;
  gs.saltFillReduction = 0;
  // hodlerStreak intentionally NOT reset here - persists across levels

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

function triggerBearStun(gs: GameState) {
  gs.bearStunTimer = 120; // 2 seconds at 60fps
  gs.bearRageCount++;
  gs.floatingTexts.push({
    id: gs.nextFloatTextId++,
    x: gs.bearX - 20,
    y: 30,
    text: "BEAR STUNNED!",
    timer: 100,
    color: "#ffffff",
  });
  if (gs.bearRageCount > 1) {
    gs.floatingTexts.push({
      id: gs.nextFloatTextId++,
      x: gs.bearX - 30,
      y: 15,
      text: "BEAR IS ENRAGED!",
      timer: 120,
      color: "#ff4444",
    });
  }
  // Drop a pickup at bear position
  const dropX = gs.bearX + 10 + Math.random() * 20;
  const dropY = 62;
  if (Math.random() < 0.7) {
    const amount = Math.floor(
      gs.portfolioValue * (0.04 + Math.random() * 0.04),
    );
    gs.maturityBags.push({
      id: gs.nextMaturityId++,
      x: dropX,
      y: dropY,
      lifetime: 600,
      maxLifetime: 600,
      amount,
      collected: false,
    });
  } else {
    gs.waterBottles.push({
      x: dropX,
      y: dropY,
      collected: false,
    });
  }
  gs.sfxQueue.push("hit");
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
  if (gs.portfolioTickerFlash > 0) gs.portfolioTickerFlash--;
  // Combo timer countdown
  if (gs.comboTimer > 0) {
    gs.comboTimer--;
    if (gs.comboTimer === 0) {
      gs.convictionCombo = 0;
    }
  }
  if (gs.bearTauntTimer > 0) gs.bearTauntTimer--;
  if (gs.damageFlashTimer > 0) gs.damageFlashTimer--;
  if (gs.portfolioFlashGreenTimer > 0) gs.portfolioFlashGreenTimer--;

  // Bear walking across top platform
  const BEAR_PLATFORM_LEFT = 75;
  const BEAR_PLATFORM_RIGHT = 395;
  // Bear stun countdown
  if (gs.bearStunTimer > 0) {
    gs.bearStunTimer--;
  }
  if (gs.bearStunTimer === 0) {
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
  }
  if (gs.bottleWarningTimer > 0) gs.bottleWarningTimer--;
  const level = LEVELS[gs.level];
  const p = gs.player;

  // Salt meter passive fill (acts as a pressure timer - faster in later levels)
  const saltFillRate = Math.max(
    0,
    0.064 + (gs.level - 1) * 0.015 - gs.saltFillReduction,
  );
  gs.saltMeter = Math.min(100, gs.saltMeter + saltFillRate);

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

  // B button weapon actions
  if (gs.keys.has("AxeSmash") && p.hitTimer === 0) {
    if (gs.currentWeapon === "pickaxe") {
      const smashed: number[] = [];
      for (let i = 0; i < gs.hazards.length; i++) {
        const h = gs.hazards[i];
        const dist = Math.hypot(
          h.x + h.w / 2 - (p.x + p.w / 2),
          h.y + h.h / 2 - (p.y + p.h / 2),
        );
        if (dist < 60) smashed.push(i);
      }
      if (p.attackTimer === 0) {
        gs.sfxQueue.push("axe_whoosh");
        p.attackTimer = 20;
        p.attackClangPlayed = smashed.length === 0;
      }
      if (smashed.length > 0) {
        for (let si = smashed.length - 1; si >= 0; si--) {
          const idx = smashed[si];
          const h = gs.hazards[idx];
          if (h.type === "chest") {
            gs.portfolioMultiplier = Math.min(
              2.5,
              gs.portfolioMultiplier + 0.15,
            );
            gs.portfolioValue += 2000;
            gs.portfolioTickerFlash = 40;
            gs.portfolioTickerDir = 1;
            gs.sfxQueue.push("chest_good");
          } else if (h.type !== "greenCandle" && h.type !== "redCandle") {
            gs.portfolioValue += 150;
          }
          gs.hazards.splice(idx, 1);
        }
      }
      if (p.attackTimer > 0 && gs.bearStunTimer === 0) {
        const bearDist = Math.hypot(
          gs.bearX + 21 - (p.x + p.w / 2),
          62 - (p.y + p.h / 2),
        );
        if (bearDist < 80) triggerBearStun(gs);
      }
    } else if (gs.currentWeapon === "gun") {
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
      // Gun also stuns bear if close
      if (gs.gunCooldown <= 0 && gs.bearStunTimer === 0) {
        const bearDist = Math.hypot(
          gs.bearX + 21 - (p.x + p.w / 2),
          62 - (p.y + p.h / 2),
        );
        if (bearDist < 100) triggerBearStun(gs);
      }
    } else if (gs.currentWeapon === "dynamite") {
      // Throw dynamite forward in arc - one-use
      gs.dynamites.push({
        id: gs.nextDynamiteId++,
        x: p.x + p.w / 2,
        y: p.y + p.h / 2,
        vx: p.facing * 5,
        vy: -6,
        timer: 90,
      });
      gs.currentWeapon = null;
      gs.weaponTimer = 0;
      gs.sfxQueue.push("axe_whoosh");
      gs.floatingTexts.push({
        id: gs.nextFloatTextId++,
        x: p.x,
        y: p.y - 20,
        text: "FIRE IN THE HOLE!",
        timer: 80,
        color: "#ff6600",
      });
    } else if (gs.currentWeapon === "saltshaker") {
      // Slow all on-screen hazards
      for (const h of gs.hazards) {
        h.slowTimer = 300;
      }
      gs.currentWeapon = null;
      gs.weaponTimer = 0;
      gs.sfxQueue.push("powerup");
      gs.floatingTexts.push({
        id: gs.nextFloatTextId++,
        x: p.x,
        y: p.y - 20,
        text: "SALT SHOWER!",
        timer: 80,
        color: "#88ddff",
      });
    }
  }
  if (gs.gunCooldown > 0) gs.gunCooldown--;

  // Horizontal
  // Salt-based speed penalty (high salt = slower, but jump unaffected)
  const saltSpeedMult =
    gs.saltMeter > 85 ? 0.25 : gs.saltMeter > 70 ? 0.55 : 1.0;
  const dodgeSpeedBonus = gs.dodgeBoostTimer > 0 ? 1.3 : 1.0;
  const speedBootsBonus = gs.speedBootsTimer > 0 ? 1.4 : 1.0;
  if (left) {
    p.vx = -walkSpeed * saltSpeedMult * dodgeSpeedBonus * speedBootsBonus;
    p.facing = -1;
  } else if (right) {
    p.vx = walkSpeed * saltSpeedMult * dodgeSpeedBonus * speedBootsBonus;
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

  // Land sound + dust particles
  if (wasAirborne && p.onGround) {
    gs.sfxQueue.push("land");
    // Emit dust particles on landing
    for (let dp = 0; dp < 5; dp++) {
      gs.dustParticles.push({
        x: p.x + p.w / 2 + (Math.random() - 0.5) * 16,
        y: p.y + p.h,
        vx: (Math.random() - 0.5) * 2.5,
        vy: -Math.random() * 1.5 - 0.5,
        alpha: 0.7 + Math.random() * 0.3,
        size: 2 + Math.random() * 3,
      });
    }
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
      // Spark burst on axe hit
      for (let sp = 0; sp < 8; sp++) {
        const angle = (sp / 8) * Math.PI * 2;
        gs.sparkParticles.push({
          x: p.x + (p.facing === 1 ? p.w + 5 : -5),
          y: p.y + 15,
          vx: Math.cos(angle) * (1.5 + Math.random() * 2.5),
          vy: Math.sin(angle) * (1.5 + Math.random() * 2.5),
          alpha: 1,
          color: Math.random() > 0.5 ? "#ffd700" : "#ffffff",
        });
      }
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
  const bearThrowInterval = Math.max(
    20,
    120 - gs.level * 12 - gs.bearRageCount * 8,
  );
  if (gs.bearStunTimer === 0) gs.bearThrowTimer++;
  if (gs.bearStunTimer === 0 && gs.bearThrowTimer >= bearThrowInterval) {
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

      // Apply slow effect
      if (h.slowTimer && h.slowTimer > 0) {
        h.slowTimer--;
        h.vx *= 0.85;
        h.vy *= 0.85;
      }
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
              const baseSpeed = Math.max(Math.abs(h.vx), 2.2 + gs.level * 0.3);
              const slowMult = h.slowTimer && h.slowTimer > 0 ? 0.3 : 1.0;
              h.vx = (Math.random() < 0.5 ? -1 : 1) * baseSpeed * slowMult;
            }
            // Maintain rolling speed while on ground (don't let friction stop it)
            if (Math.abs(h.vx) < 1.5 && !(h.slowTimer && h.slowTimer > 0)) {
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

    // Near-miss and dodge streak tracking
    if (
      dist < 40 &&
      dist > 18 &&
      p.hitTimer === 0 &&
      h.type !== "greenCandle" &&
      h.type !== "redCandle"
    ) {
      if (!h.onGround) {
        gs.dodgeStreak++;
        if (gs.dodgeStreak % 5 === 0) {
          gs.dodgeBoostTimer = 90;
          gs.floatingTexts.push({
            id: gs.nextFloatTextId++,
            x: p.x - 10,
            y: p.y - 20,
            text: "CONVICTION!",
            timer: 80,
            color: "#ffffff",
          });
        }
      }
      // Near-miss feedback (rate limited)
      if (gs.nearMissTimer === 0 && dist < 35) {
        gs.nearMissTimer = 15;
        gs.floatingTexts.push({
          id: gs.nextFloatTextId++,
          x: p.x + (Math.random() - 0.5) * 30,
          y: p.y - 15,
          text: "CLOSE!",
          timer: 50,
          color: "#ff4444",
        });
      }
    }

    // Hit detection - skip if level already complete (portal immunity)
    if (gs.levelComplete) continue;
    if (rectOverlap(p.x + 2, p.y + 2, p.w - 4, p.h - 4, h.x, h.y, h.w, h.h)) {
      // Chest interaction
      if (h.type === "chest") {
        if (gs.currentWeapon === "pickaxe") {
          gs.portfolioMultiplier = Math.min(2.5, gs.portfolioMultiplier + 0.15);
          gs.portfolioValue += 2000;
          p.hitTimer = 10;
          gs.sfxQueue.push("axe_smash");
          gs.sfxQueue.push("chest_good");
        } else {
          gs.portfolioMultiplier = Math.max(0.3, gs.portfolioMultiplier - 0.12);
          gs.portfolioTickerFlash = 40;
          gs.portfolioTickerDir = -1;
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
        gs.portfolioFlashGreenTimer = 12;
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
        if (gs.portfolioShieldTimer > 0) {
          gs.floatingTexts.push({
            id: gs.nextFloatTextId++,
            x: h.x,
            y: h.y - 10,
            text: "SHIELD BLOCKED!",
            timer: 90,
            color: "#ffd700",
          });
        } else {
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
        }
        toRemove.push(i);
        continue;
      }

      // Axe smashes other hazards ONLY when actively swinging
      if (
        gs.currentWeapon === "pickaxe" &&
        p.attackTimer > 0 &&
        p.hitTimer === 0
      ) {
        gs.portfolioValue += 150;
        gs.sfxQueue.push("axe_swing");
        toRemove.push(i);
        continue;
      }

      // Salt bag - big salt meter hit but no life lost
      if (h.type === "saltbag" && p.hitTimer === 0) {
        gs.damageFlashTimer = 10;
        gs.saltMeter = Math.min(100, gs.saltMeter + 35);
        gs.debuffTimer = 180;
        p.hitTimer = 50;
        gs.sfxQueue.push("hit");
        toRemove.push(i);
        continue;
      }

      // Normal hit
      if (p.hitTimer === 0) {
        // Hard hat absorbs hit
        if (gs.currentWeapon === "hardhat") {
          gs.currentWeapon = null;
          gs.weaponTimer = 0;
          gs.sfxQueue.push("axe_clang");
          gs.floatingTexts.push({
            id: gs.nextFloatTextId++,
            x: p.x,
            y: p.y - 20,
            text: "HARD HAT SAVED YOU!",
            timer: 100,
            color: "#ffd700",
          });
          gs.screenShake = 4;
          p.hitTimer = 30;
          toRemove.push(i);
          continue;
        }
        // Bubble absorbs hit with dramatic pop
        if (gs.hasBubble) {
          gs.hasBubble = false;
          gs.sfxQueue.push("hit");
          gs.screenShake = 12;
          gs.damageFlashTimer = 8;
          gs.floatingTexts.push({
            id: gs.nextFloatTextId++,
            x: p.x,
            y: p.y - 20,
            text: "BUBBLE POPPED!",
            timer: 100,
            color: "#88ddff",
          });
          // Big pop particle burst
          for (let sp = 0; sp < 18; sp++) {
            const angle = (sp / 18) * Math.PI * 2;
            gs.sparkParticles.push({
              x: p.x + p.w / 2,
              y: p.y + p.h / 2,
              vx: Math.cos(angle) * (3 + Math.random() * 4),
              vy: Math.sin(angle) * (3 + Math.random() * 4),
              alpha: 1,
              color:
                sp % 3 === 0 ? "#ffffff" : sp % 3 === 1 ? "#88ddff" : "#aaffff",
            });
          }
          p.hitTimer = 30;
          toRemove.push(i);
          continue;
        }
        gs.damageFlashTimer = 10;
        gs.saltMeter = Math.min(100, gs.saltMeter + 15);
        p.hitTimer = 60;
        gs.sfxQueue.push("hit");
        gs.screenShake = 8;
        // Emit spark particles on hit
        for (let sp = 0; sp < 7; sp++) {
          const angle = (sp / 7) * Math.PI * 2;
          gs.sparkParticles.push({
            x: p.x + p.w / 2,
            y: p.y + p.h / 2,
            vx: Math.cos(angle) * (2 + Math.random() * 2),
            vy: Math.sin(angle) * (2 + Math.random() * 2),
            alpha: 1,
            color: "#ff4400",
          });
        }
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
      // Permanently reduce passive fill rate for this level
      const totalBottlesForLevel = gs.waterBottles.length;
      if (totalBottlesForLevel > 0) {
        gs.saltFillReduction +=
          (0.064 + (gs.level - 1) * 0.015) / totalBottlesForLevel;
      }
      // Combo tracking
      gs.comboTimer = 90;
      gs.convictionCombo++;
      if (gs.convictionCombo >= 2) {
        gs.floatingTexts.push({
          id: gs.nextFloatTextId++,
          x: ka.x,
          y: ka.y - 25,
          text: `CONVICTION x${gs.convictionCombo}!`,
          timer: 80,
          color: "#ffd700",
        });
      }
    }
  }

  // Weapon spawn timer
  gs.weaponSpawnTimer--;
  if (gs.weaponSpawnTimer <= 0) {
    const midPlats = gs.currentPlatforms.filter(
      (pl) => pl.y < CANVAS_H - 50 && pl.y > CANVAS_H - 550,
    );
    if (midPlats.length > 0) {
      const plat = midPlats[Math.floor(Math.random() * midPlats.length)];
      const allTypes: SpawnedPickup["type"][] = [
        "pickaxe",
        "gun",
        "dynamite",
        "saltshaker",
        "hardhat",
        "bubble",
        "speedboots",
        "magnet",
        "portfolioshield",
      ];
      const pickedType = allTypes[Math.floor(Math.random() * allTypes.length)];
      gs.spawnedPickups.push({
        id: gs.nextPickupId++,
        x: plat.x + 10 + Math.random() * Math.max(0, plat.w - 20),
        y: plat.y - 20,
        type: pickedType,
        lifetime: 600,
        maxLifetime: 600,
        collected: false,
      });
    }
    gs.weaponSpawnTimer = 1200 + Math.random() * 600;
  }

  // Spawned pickup update (lifetime, magnet pull, collection)
  for (let spi = gs.spawnedPickups.length - 1; spi >= 0; spi--) {
    const sp2 = gs.spawnedPickups[spi];
    if (sp2.collected) {
      gs.spawnedPickups.splice(spi, 1);
      continue;
    }
    sp2.lifetime--;
    if (sp2.lifetime <= 0) {
      gs.spawnedPickups.splice(spi, 1);
      continue;
    }
    // Magnet pull toward uncollected pickups
    if (gs.magnetTimer > 0) {
      const dx = p.x + p.w / 2 - (sp2.x + 8);
      const dy = p.y + p.h / 2 - (sp2.y + 8);
      const dist2 = Math.sqrt(dx * dx + dy * dy);
      if (dist2 < 90 && dist2 > 0) {
        sp2.x += (dx / dist2) * 4;
        sp2.y += (dy / dist2) * 4;
      }
    }
    if (rectOverlap(p.x, p.y, p.w, p.h, sp2.x, sp2.y, 18, 18)) {
      sp2.collected = true;
      gs.sfxQueue.push("powerup");
      const isWeapon = [
        "pickaxe",
        "gun",
        "dynamite",
        "saltshaker",
        "hardhat",
      ].includes(sp2.type);
      if (isWeapon) {
        gs.currentWeapon = sp2.type as
          | "pickaxe"
          | "gun"
          | "dynamite"
          | "saltshaker"
          | "hardhat";
        // weapon timers: dynamite/hardhat are use-based (we still give a timer for display)
        gs.weaponTimer =
          sp2.type === "dynamite" || sp2.type === "hardhat" ? 9999 : 600;
        const labels: Record<string, string> = {
          pickaxe: "PICKAXE!",
          gun: "GUN!",
          dynamite: "DYNAMITE!",
          saltshaker: "SALT SHAKER!",
          hardhat: "HARD HAT!",
        };
        const colors: Record<string, string> = {
          pickaxe: "#ffd700",
          gun: "#00ff88",
          dynamite: "#ff6600",
          saltshaker: "#88ddff",
          hardhat: "#ffee00",
        };
        gs.floatingTexts.push({
          id: gs.nextFloatTextId++,
          x: sp2.x,
          y: sp2.y - 10,
          text: labels[sp2.type] || "WEAPON!",
          timer: 80,
          color: colors[sp2.type] || "#ffffff",
        });
      } else {
        // Power-up
        if (sp2.type === "bubble") {
          gs.hasBubble = true;
          gs.floatingTexts.push({
            id: gs.nextFloatTextId++,
            x: sp2.x,
            y: sp2.y - 10,
            text: "BUBBLE SHIELD!",
            timer: 80,
            color: "#88ddff",
          });
        } else if (sp2.type === "speedboots") {
          gs.speedBootsTimer = 480;
          gs.floatingTexts.push({
            id: gs.nextFloatTextId++,
            x: sp2.x,
            y: sp2.y - 10,
            text: "SPEED BOOST!",
            timer: 80,
            color: "#ff9900",
          });
        } else if (sp2.type === "magnet") {
          gs.magnetTimer = 480;
          gs.floatingTexts.push({
            id: gs.nextFloatTextId++,
            x: sp2.x,
            y: sp2.y - 10,
            text: "MAGNET!",
            timer: 80,
            color: "#cc44ff",
          });
        } else if (sp2.type === "portfolioshield") {
          gs.portfolioShieldTimer = 480;
          gs.floatingTexts.push({
            id: gs.nextFloatTextId++,
            x: sp2.x,
            y: sp2.y - 10,
            text: "PORTFOLIO SHIELD!",
            timer: 80,
            color: "#ffd700",
          });
        }
      }
    }
  }

  // Magnet also pulls water bottles, maturity bags
  if (gs.magnetTimer > 0) {
    for (const wb of gs.waterBottles) {
      if (wb.collected) continue;
      const dx = p.x + p.w / 2 - (wb.x + 6);
      const dy = p.y + p.h / 2 - (wb.y + 9);
      const dist2 = Math.sqrt(dx * dx + dy * dy);
      if (dist2 < 90 && dist2 > 0) {
        wb.x += (dx / dist2) * 4;
        wb.y += (dy / dist2) * 4;
      }
    }
    for (const mb of gs.maturityBags) {
      if (mb.collected) continue;
      const dx = p.x + p.w / 2 - (mb.x + 8);
      const dy = p.y + p.h / 2 - (mb.y + 10);
      const dist2 = Math.sqrt(dx * dx + dy * dy);
      if (dist2 < 90 && dist2 > 0) {
        mb.x += (dx / dist2) * 4;
        mb.y += (dy / dist2) * 4;
      }
    }
  }

  // Weapon countdown (non use-based weapons)
  if (
    gs.currentWeapon &&
    gs.currentWeapon !== "dynamite" &&
    gs.currentWeapon !== "hardhat"
  ) {
    gs.weaponTimer--;
    if (gs.weaponTimer <= 0) {
      gs.currentWeapon = null;
      gs.weaponTimer = 0;
    }
  }

  // Power-up countdowns
  if (gs.speedBootsTimer > 0) gs.speedBootsTimer--;
  if (gs.magnetTimer > 0) gs.magnetTimer--;
  if (gs.portfolioShieldTimer > 0) gs.portfolioShieldTimer--;

  // Debuff countdown
  if (gs.debuffTimer > 0) gs.debuffTimer--;

  // Dynamite physics and explosion
  for (let di = gs.dynamites.length - 1; di >= 0; di--) {
    const dyn = gs.dynamites[di];
    dyn.x += dyn.vx;
    dyn.y += dyn.vy;
    dyn.vy += GRAVITY * 0.8;
    // Bounce on platforms
    for (const plat of gs.currentPlatforms) {
      if (dyn.x + 6 > plat.x && dyn.x - 6 < plat.x + plat.w) {
        const prevB = dyn.y - dyn.vy;
        if (dyn.vy >= 0 && prevB <= plat.y + 2 && dyn.y >= plat.y) {
          dyn.y = plat.y;
          dyn.vy = -Math.abs(dyn.vy) * 0.4;
        }
      }
    }
    dyn.timer--;
    if (dyn.timer <= 0) {
      // EXPLODE - destroy all hazards within 80px
      gs.sfxQueue.push("axe_clang");
      gs.screenShake = 14;
      gs.damageFlashTimer = 12;
      for (let hi2 = gs.hazards.length - 1; hi2 >= 0; hi2--) {
        const h2 = gs.hazards[hi2];
        const dist3 = Math.hypot(
          h2.x + h2.w / 2 - dyn.x,
          h2.y + h2.h / 2 - dyn.y,
        );
        if (dist3 < 80) {
          gs.hazards.splice(hi2, 1);
          gs.portfolioValue += 100;
        }
      }
      // Blast particles
      for (let ep2 = 0; ep2 < 20; ep2++) {
        const angle = (ep2 / 20) * Math.PI * 2;
        const spd = 3 + Math.random() * 5;
        gs.explosionProjectiles.push({
          id: gs.nextExplosionId++,
          x: dyn.x,
          y: dyn.y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          lifetime: 30,
          maxLifetime: 30,
        });
      }
      gs.floatingTexts.push({
        id: gs.nextFloatTextId++,
        x: dyn.x,
        y: dyn.y - 20,
        text: "💥 BOOM!",
        timer: 90,
        color: "#ff6600",
      });
      gs.dynamites.splice(di, 1);
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
    // Bullet hits bear
    const bearHitX = gs.bearX;
    const bearHitY = 58;
    if (rectOverlap(b.x, b.y, b.w, b.h, bearHitX - 10, bearHitY - 42, 52, 52)) {
      if (gs.bearStunTimer === 0) {
        triggerBearStun(gs);
      }
      bulletsToRemove.push(bi);
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
      gs.portfolioFlashGreenTimer = 12;
      gs.portfolioTickerFlash = 40;
      gs.portfolioTickerDir = 1;
      gs.floatingTexts.push({
        id: gs.nextFloatTextId++,
        x: mb.x,
        y: mb.y - 10,
        text: `+$${mb.amount.toLocaleString()}`,
        timer: 90,
        color: "#ffd700",
      });
      gs.sfxQueue.push("powerup");
      // Combo tracking
      gs.comboTimer = 90;
      gs.convictionCombo++;
      if (gs.convictionCombo >= 2) {
        gs.floatingTexts.push({
          id: gs.nextFloatTextId++,
          x: mb.x,
          y: mb.y - 25,
          text: `CONVICTION x${gs.convictionCombo}!`,
          timer: 80,
          color: "#ffd700",
        });
      }
      // Coin burst particles
      for (let cp = 0; cp < 5; cp++) {
        const angle = (cp / 5) * Math.PI * 2;
        gs.coinParticles.push({
          x: mb.x + 8,
          y: mb.y + 10,
          vx: Math.cos(angle) * (1.5 + Math.random() * 2),
          vy: Math.sin(angle) * (1.5 + Math.random() * 2) - 2,
          alpha: 1,
        });
      }
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
      gs.portfolioFlashGreenTimer = 12;
      gs.portfolioTickerFlash = 40;
      gs.portfolioTickerDir = 1;
      gs.floatingTexts.push({
        id: gs.nextFloatTextId++,
        x: cb.x,
        y: cb.y - 10,
        text: "+$30,000 GRANT!",
        timer: 120,
        color: "#00ff88",
      });
      gs.sfxQueue.push("chest_good");
      // Combo tracking
      gs.comboTimer = 90;
      gs.convictionCombo++;
      if (gs.convictionCombo >= 2) {
        gs.floatingTexts.push({
          id: gs.nextFloatTextId++,
          x: cb.x,
          y: cb.y - 25,
          text: `CONVICTION x${gs.convictionCombo}!`,
          timer: 80,
          color: "#ffd700",
        });
      }
    }
  }

  // Update and cull dust particles
  gs.dustParticles = gs.dustParticles.filter((dp) => dp.alpha > 0);
  for (const dp of gs.dustParticles) {
    dp.x += dp.vx;
    dp.y += dp.vy;
    dp.vy += 0.08;
    dp.alpha -= 0.04;
  }
  // Update and cull spark particles
  gs.sparkParticles = gs.sparkParticles.filter((sp2) => sp2.alpha > 0);
  for (const sp2 of gs.sparkParticles) {
    sp2.x += sp2.vx;
    sp2.y += sp2.vy;
    sp2.vx *= 0.92;
    sp2.vy *= 0.92;
    sp2.alpha -= 0.06;
  }
  // Update and cull coin particles
  gs.coinParticles = gs.coinParticles.filter((cp) => cp.alpha > 0);
  for (const cp of gs.coinParticles) {
    cp.x += cp.vx;
    cp.y += cp.vy;
    cp.vy += 0.15;
    cp.alpha -= 0.04;
  }
  // Screen shake countdown
  if (gs.screenShake > 0) gs.screenShake--;

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

  // Ambient atmosphere particles based on level year
  {
    const levelYear = gs.level; // 0-7
    if (levelYear <= 1) {
      // Dust motes
      if (gs.particleTimer % 8 === 0) {
        gs.ambientParticles.push({
          type: "dust",
          x: Math.random() * 480,
          y: -10,
          vx: (Math.random() - 0.5) * 0.4,
          vy: 0.3 + Math.random() * 0.3,
          alpha: 0.4 + Math.random() * 0.3,
          size: 1 + Math.random() * 2,
        });
      }
    } else if (levelYear <= 3) {
      // Water drips
      if (gs.particleTimer % 20 === 0) {
        gs.ambientParticles.push({
          type: "drip",
          x: Math.random() * 480,
          y: -5,
          vx: 0,
          vy: 1.5 + Math.random() * 1.5,
          alpha: 0.7,
          size: 2,
        });
      }
    } else if (levelYear <= 5) {
      // Embers rising
      if (gs.particleTimer % 6 === 0) {
        gs.ambientParticles.push({
          type: "ember",
          x: Math.random() * 480,
          y: 650,
          vx: (Math.random() - 0.5) * 1.2,
          vy: -(1 + Math.random() * 2),
          alpha: 0.8 + Math.random() * 0.2,
          size: 1 + Math.random() * 2,
        });
      }
    } else {
      // Ash/embers hellscape
      if (gs.particleTimer % 4 === 0) {
        gs.ambientParticles.push({
          type: "ash",
          x: Math.random() * 480,
          y: -10,
          vx: (Math.random() - 0.5) * 0.8,
          vy: 0.4 + Math.random() * 0.8,
          alpha: 0.5 + Math.random() * 0.3,
          size: 1 + Math.random() * 3,
        });
      }
    }
    // Update ambient particles
    gs.ambientParticles = gs.ambientParticles.filter(
      (ap) =>
        ap.alpha > 0 && ap.y > -20 && ap.y < 680 && ap.x > -10 && ap.x < 500,
    );
    for (const ap of gs.ambientParticles) {
      ap.x += ap.vx;
      ap.y += ap.vy;
      if (ap.type === "dust" || ap.type === "ash") ap.alpha -= 0.003;
      else if (ap.type === "drip") ap.alpha -= 0.008;
      else ap.alpha -= 0.005;
    }
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
      // Close call bonus
      if (gs.saltMeter >= 80) {
        const closeCallBonus = Math.floor(500 + gs.saltMeter * 50);
        gs.portfolioValue += closeCallBonus;
        gs.floatingTexts.push({
          id: gs.nextFloatTextId++,
          x: p.x,
          y: p.y - 30,
          text: `SALTY SURVIVOR! +$${closeCallBonus.toLocaleString()}`,
          timer: 120,
          color: "#ffd700",
        });
      }
      // Health bonus (lower salt = more bonus)
      const healthBonus = Math.floor((100 - gs.saltMeter) * 100);
      if (healthBonus > 0) {
        gs.portfolioValue += healthBonus;
        gs.floatingTexts.push({
          id: gs.nextFloatTextId++,
          x: p.x - 20,
          y: p.y - 50,
          text: `HEALTH BONUS! +$${healthBonus.toLocaleString()}`,
          timer: 120,
          color: "#ffd700",
        });
      }
      // HODLer streak bonus
      if (gs.levelDeaths === 0) {
        gs.hodlerStreak++;
        const hodlerBonus = gs.hodlerStreak * 500;
        gs.portfolioValue += hodlerBonus;
        gs.floatingTexts.push({
          id: gs.nextFloatTextId++,
          x: p.x - 30,
          y: p.y - 70,
          text: `HODLER BONUS! +$${hodlerBonus.toLocaleString()}`,
          timer: 140,
          color: "#ffd700",
        });
      }
    } else {
      gs.bottleWarningTimer = 180;
      // Don't kill James - just block the portal and show message
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
  gs.bearTauntTimer = 60;
  gs.levelDeaths++;
  gs.hodlerStreak = 0;
  gs.dodgeStreak = 0;
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
  currentWeapon:
    | "pickaxe"
    | "gun"
    | "dynamite"
    | "saltshaker"
    | "hardhat"
    | null,
  weaponTimer = 600,
  dyingTimer = 0,
  hasBubble = false,
  speedBootsTimer = 0,
  magnetTimer = 0,
  portfolioShieldTimer = 0,
  liteMode = false,
) {
  const hasAxe = currentWeapon === "pickaxe";
  const axeTimer = hasAxe ? weaponTimer : 600;
  const hasGun = currentWeapon === "gun";
  const gunTimer = hasGun ? weaponTimer : 600;
  const { x, y, facing, state, hitTimer, frame } = p;
  const flipped = facing === -1;

  // Colors
  const skinBase = "#7B4A2D";
  const skinShad = "#5C3318";
  const skinHi = "#9B6040";
  const shirtBase = "#d4d4d4";
  const shirtShad = "#a8a8a8";
  const shirtHi = "#efefef";
  const pantsBase = "#1a1a3a";
  const pantsHi = "#2a2a5a";
  const capBody = "#1a1a4a";
  const capBrimSh = "#0d0d30";
  const capHi = "#2a2a6a";
  const bootBase = "#2a1a0e";
  const bootHi = "#3d2b1a";
  const bootSole = "#0a0a0a";
  const darkPants = "#14143a";
  const frontPants = "#1e1e3c";

  const angry = saltMeter > 75;
  const veryAngry = saltMeter >= 100;

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
    const fallOffset = progress * progress * 70;
    ctx.globalAlpha = 1 - progress * 0.6;
    ctx.translate(p.w / 2, p.h / 2 + fallOffset);
    ctx.rotate(spin);
    const shrink = 1 - progress * 0.45;
    ctx.scale(shrink, shrink);
    ctx.translate(-p.w / 2, -p.h / 2);
    // "!!" exclamation marks when first dying
    if (dyingTimer > 60) {
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px monospace";
      ctx.fillText("!!", -8, -4);
      ctx.restore();
    }
  }

  // Hit flash
  if (hitTimer > 0 && Math.floor(hitTimer / 4) % 2 === 0) {
    ctx.globalAlpha = 0.3;
  }

  // ============================================================
  if (state === "run") {
    // ===== SIDE PROFILE (facing right) =====
    const bodyBob = Math.abs(Math.sin((frame * Math.PI) / 2)) * -2;
    const legSwing = Math.sin((frame * Math.PI) / 2) * 15;
    const armSwing = -legSwing * 0.9;

    // --- BACK LEG (darker) ---
    ctx.fillStyle = darkPants;
    ctx.fillRect(9, 26 + legSwing + bodyBob, 10, 15);
    ctx.fillStyle = bootBase;
    ctx.fillRect(8, 40 + legSwing + bodyBob, 12, 6);
    ctx.fillStyle = bootSole;
    ctx.fillRect(8, 46 + legSwing + bodyBob, 12, 1);

    // --- BACK ARM ---
    ctx.fillStyle = skinShad;
    ctx.fillRect(6, 17 + armSwing + bodyBob, 6, 11);

    // --- MOTION TRAIL ---
    if (!liteMode) {
      const trailDir = facing === -1 ? 3 : -3;
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = shirtBase;
      ctx.fillRect(6 + trailDir, 15 + bodyBob, 18, 13);
      ctx.globalAlpha =
        hitTimer > 0 && Math.floor(hitTimer / 4) % 2 === 0 ? 0.3 : 1;
    }

    // --- TORSO ---
    ctx.fillStyle = shirtBase;
    ctx.fillRect(6, 15 + bodyBob, 18, 13);
    ctx.fillStyle = shirtShad;
    ctx.fillRect(6, 24 + bodyBob, 18, 4);
    ctx.fillStyle = shirtHi;
    ctx.fillRect(8, 16 + bodyBob, 8, 3);

    // --- FRONT LEG ---
    ctx.fillStyle = frontPants;
    ctx.fillRect(11, 26 - legSwing + bodyBob, 10, 15);
    ctx.fillStyle = pantsHi;
    ctx.fillRect(12, 30 - legSwing + bodyBob, 7, 4);
    ctx.fillStyle = bootBase;
    ctx.fillRect(10, 40 - legSwing + bodyBob, 14, 6);
    ctx.fillRect(18, 43 - legSwing + bodyBob, 4, 2);
    ctx.fillStyle = bootHi;
    ctx.fillRect(11, 40 - legSwing + bodyBob, 9, 3);
    ctx.fillStyle = bootSole;
    ctx.fillRect(10, 46 - legSwing + bodyBob, 13, 1);

    // --- FRONT ARM ---
    ctx.fillStyle = skinBase;
    ctx.fillRect(18, 17 + armSwing + bodyBob, 6, 11);
    ctx.fillStyle = skinShad;
    ctx.fillRect(18, 17 + armSwing + bodyBob, 2, 11);

    // --- HEAD (side profile, 14w x 12h) ---
    ctx.fillStyle = skinBase;
    ctx.fillRect(8, 2, 16, 13);
    // ear
    ctx.fillRect(7, 6, 2, 6);
    // nose bump
    ctx.fillStyle = skinShad;
    ctx.fillRect(23, 9, 2, 3);
    // jaw shading
    ctx.fillRect(8, 12, 16, 3);
    ctx.fillRect(8, 2, 2, 10);
    // highlight on forehead
    ctx.fillStyle = skinHi;
    ctx.fillRect(10, 3, 5, 3);

    // --- EYE (single, front side) ---
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(18, 6, 4, 3);
    ctx.fillStyle = "#000000";
    ctx.fillRect(19, 7, 2, 2);
    // Brow (determined furrowed: 1px dark bar above eye, inner brow 1px lower)
    ctx.fillStyle = "#3a2010";
    ctx.fillRect(17, 5, 5, 1);
    ctx.fillRect(17, 4, 2, 1); // extra furrowed pixel

    // --- MOUTH (firm set line) ---
    if (veryAngry) {
      ctx.fillStyle = "#1a0a0a";
      ctx.fillRect(17, 12, 5, 2);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(17, 12, 1, 2);
      ctx.fillRect(19, 12, 1, 2);
    } else {
      ctx.fillStyle = "#3a1a0a";
      ctx.fillRect(17, 12, 5, 1);
    }

    // --- CAP (tilted sideways: brim extends RIGHT) ---
    ctx.fillStyle = capBody;
    ctx.fillRect(6, 0, 16, 6);
    ctx.fillStyle = capBrimSh;
    ctx.fillRect(6, 4, 16, 2);
    // Brim extends forward-right
    ctx.fillStyle = capBody;
    ctx.fillRect(20, 3, 10, 3);
    ctx.fillStyle = capBrimSh;
    ctx.fillRect(20, 5, 10, 1);
    // Cap highlight
    ctx.fillStyle = capHi;
    ctx.fillRect(9, 0, 5, 2);
    ctx.fillStyle = capHi;
    ctx.fillRect(12, -1, 2, 1);

    // --- SWEAT DROPS ---
    if (saltMeter > 40) {
      const sweatAlpha = Math.min(1, (saltMeter - 40) / 60);
      ctx.globalAlpha = sweatAlpha * (0.5 + Math.sin(Date.now() * 0.008) * 0.3);
      ctx.fillStyle = "#66ddff";
      ctx.beginPath();
      ctx.ellipse(25, 4, 2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = sweatAlpha * 0.6;
      ctx.beginPath();
      ctx.ellipse(24, 10, 1.5, 2.5, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha =
        hitTimer > 0 && Math.floor(hitTimer / 4) % 2 === 0 ? 0.3 : 1;
    }
  } else if (state === "attacking") {
    // ============================================================
    // ATTACKING STATE
    // ============================================================
    const isWindup = p.attackTimer > 10;

    // --- BOOTS ---
    ctx.fillStyle = bootBase;
    ctx.fillRect(2, 40, 12, 7);
    ctx.fillRect(0, 43, 13, 4);
    ctx.fillRect(17, 40, 12, 7);
    ctx.fillRect(16, 43, 13, 4);
    ctx.fillStyle = bootHi;
    ctx.fillRect(3, 40, 9, 3);
    ctx.fillRect(18, 40, 9, 3);
    ctx.fillStyle = bootSole;
    ctx.fillRect(0, 47, 14, 1);
    ctx.fillRect(16, 47, 14, 1);

    // --- PANTS ---
    ctx.fillStyle = pantsBase;
    ctx.fillRect(3, 27, 11, 15);
    ctx.fillRect(17, 27, 11, 15);
    ctx.fillStyle = pantsHi;
    ctx.fillRect(4, 31, 7, 5);
    ctx.fillRect(18, 31, 7, 5);

    // --- TORSO ---
    if (isWindup) {
      ctx.fillStyle = shirtBase;
      ctx.fillRect(2, 14, 22, 14);
      ctx.fillStyle = shirtShad;
      ctx.fillRect(2, 24, 22, 4);
      ctx.fillStyle = shirtHi;
      ctx.fillRect(5, 15, 9, 3);
    } else {
      ctx.fillStyle = shirtBase;
      ctx.fillRect(4, 15, 22, 14);
      ctx.fillStyle = shirtShad;
      ctx.fillRect(4, 25, 22, 4);
      ctx.fillStyle = shirtHi;
      ctx.fillRect(7, 16, 9, 3);
    }

    // --- HEAD (front-facing) ---
    ctx.fillStyle = skinBase;
    ctx.fillRect(7, 2, 18, 13);
    ctx.fillRect(5, 5, 2, 7);
    ctx.fillRect(25, 5, 2, 7);
    ctx.fillStyle = skinShad;
    ctx.fillRect(7, 12, 18, 3);
    ctx.fillStyle = skinHi;
    ctx.fillRect(9, 3, 7, 3);

    // CAP front-facing tilted
    ctx.fillStyle = capBody;
    ctx.fillRect(4, -2, 19, 6);
    ctx.fillStyle = capBrimSh;
    ctx.fillRect(4, 3, 19, 2);
    ctx.fillStyle = capBody;
    ctx.fillRect(18, 4, 10, 2);
    ctx.fillStyle = capBrimSh;
    ctx.fillRect(18, 5, 10, 1);
    ctx.fillStyle = capHi;
    ctx.fillRect(7, -2, 6, 2);

    // EYES front-facing determined
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(9, 6, 4, 3);
    ctx.fillRect(19, 6, 4, 3);
    ctx.fillStyle = "#000000";
    ctx.fillRect(10, 7, 2, 2);
    ctx.fillRect(20, 7, 2, 2);
    // Furrowed determined brows
    ctx.fillStyle = "#3a2010";
    ctx.fillRect(8, 5, 6, 1);
    ctx.fillRect(18, 5, 6, 1);
    ctx.fillRect(12, 6, 3, 1);
    ctx.fillRect(18, 6, 3, 1);

    // MOUTH gritted during attack
    ctx.fillStyle = "#1a0a0a";
    ctx.fillRect(10, 12, 12, 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(10, 12, 2, 2);
    ctx.fillRect(14, 12, 2, 2);
    ctx.fillRect(18, 12, 2, 2);

    // NOSE
    ctx.fillStyle = skinShad;
    ctx.fillRect(15, 10, 2, 2);

    // ARMS & AXE ATTACK
    ctx.save();
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = liteMode ? 0 : 16;
    if (isWindup) {
      // Arms raised overhead - scrappy determined windup
      ctx.fillStyle = skinBase;
      ctx.fillRect(-4, -6, 6, 16);
      ctx.fillRect(30, -6, 6, 16);
      ctx.fillStyle = skinShad;
      ctx.fillRect(-4, -6, 2, 16);
      // Axe overhead
      ctx.fillStyle = "#8B5E3C";
      ctx.fillRect(28, -18, 4, 18);
      ctx.fillStyle = "#aaaaaa";
      ctx.fillRect(18, -22, 18, 8);
      ctx.fillRect(28, -26, 8, 12);
      ctx.fillStyle = "#cccccc";
      ctx.fillRect(19, -21, 6, 3);
      ctx.fillStyle = "#dddddd";
      ctx.fillRect(29, -25, 3, 4);
    } else {
      // Arms slammed down-forward
      ctx.fillStyle = skinBase;
      ctx.fillRect(-4, 22, 6, 14);
      ctx.fillRect(30, 22, 6, 14);
      ctx.fillStyle = skinShad;
      ctx.fillRect(-4, 22, 2, 14);
      // Axe slammed down
      ctx.fillStyle = "#8B5E3C";
      ctx.fillRect(28, 20, 4, 18);
      ctx.fillStyle = "#aaaaaa";
      ctx.fillRect(20, 32, 18, 8);
      ctx.fillRect(28, 28, 8, 12);
      ctx.fillStyle = "#cccccc";
      ctx.fillRect(21, 33, 6, 3);
      ctx.fillStyle = "#dddddd";
      ctx.fillRect(29, 29, 3, 4);
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  } else {
    // ============================================================
    // FRONT-FACING (idle, jump, hit, victory, dying)
    // ============================================================
    const idleBob = state === "idle" ? Math.sin(Date.now() * 0.002) * 1.2 : 0;
    const jumpLeg = state === "jump" ? -8 : 0;

    // Wind lines when airborne
    if (state === "jump") {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#334466";
      ctx.fillRect(-16, 10, 10, 1);
      ctx.fillRect(-14, 15, 12, 1);
      ctx.fillRect(-12, 20, 8, 1);
      ctx.restore();
    }

    // --- BOOTS ---
    ctx.fillStyle = bootBase;
    ctx.fillRect(2, 40, 12, 7);
    ctx.fillRect(0, 43, 13, 4);
    ctx.fillRect(18, 40, 12, 7);
    ctx.fillRect(16, 43, 13, 4);
    ctx.fillStyle = bootHi;
    ctx.fillRect(3, 40, 9, 3);
    ctx.fillRect(19, 40, 9, 3);
    ctx.fillStyle = bootSole;
    ctx.fillRect(0, 47, 14, 1);
    ctx.fillRect(16, 47, 14, 1);

    // --- PANTS ---
    ctx.fillStyle = pantsBase;
    ctx.fillRect(3, 27 + jumpLeg, 11, 15);
    ctx.fillRect(17, 27 + jumpLeg, 11, 15);
    ctx.fillStyle = pantsHi;
    ctx.fillRect(4, 31 + jumpLeg, 7, 4);
    ctx.fillRect(18, 31 + jumpLeg, 7, 4);

    // --- T-SHIRT BODY ---
    ctx.fillStyle = shirtBase;
    ctx.fillRect(2, 14, 28, 14);
    ctx.fillStyle = shirtShad;
    ctx.fillRect(2, 24, 28, 4);
    ctx.fillRect(2, 14, 3, 14);
    ctx.fillStyle = shirtHi;
    ctx.fillRect(5, 15, 10, 3);

    // --- ARMS ---
    if (state === "jump") {
      ctx.fillStyle = skinBase;
      ctx.fillRect(-6, 0, 7, 14);
      ctx.fillRect(31, 0, 7, 14);
      ctx.fillStyle = skinShad;
      ctx.fillRect(-6, 0, 2, 14);
      ctx.fillStyle = shirtBase;
      ctx.fillRect(-6, 0, 7, 4);
      ctx.fillRect(31, 0, 7, 4);
    } else if (state === "victory") {
      ctx.fillStyle = skinBase;
      ctx.fillRect(-5, 2, 6, 14);
      ctx.fillRect(31, 2, 6, 14);
      ctx.fillStyle = skinShad;
      ctx.fillRect(-5, 2, 2, 14);
    } else {
      ctx.fillStyle = skinBase;
      ctx.fillRect(-4, 15, 6, 11);
      ctx.fillRect(30, 15, 6, 11);
      ctx.fillStyle = skinShad;
      ctx.fillRect(-4, 15, 2, 11);
    }

    // --- HEAD (front-facing, 18w x 13h) ---
    ctx.fillStyle = skinBase;
    ctx.fillRect(7, 2 + idleBob, 18, 13);
    ctx.fillRect(5, 5 + idleBob, 2, 7);
    ctx.fillRect(25, 5 + idleBob, 2, 7);
    ctx.fillStyle = skinShad;
    ctx.fillRect(7, 12 + idleBob, 18, 3);
    ctx.fillRect(7, 2 + idleBob, 3, 11);
    ctx.fillStyle = skinHi;
    ctx.fillRect(10, 3 + idleBob, 7, 3);

    // --- CAP (front-facing, tilted: brim offset right of center) ---
    ctx.fillStyle = capBody;
    ctx.fillRect(5, -2 + idleBob, 19, 6);
    ctx.fillStyle = capBrimSh;
    ctx.fillRect(5, 3 + idleBob, 19, 2);
    ctx.fillStyle = capBody;
    ctx.fillRect(18, 4 + idleBob, 10, 2);
    ctx.fillStyle = capBrimSh;
    ctx.fillRect(18, 5 + idleBob, 10, 1);
    ctx.fillStyle = capHi;
    ctx.fillRect(8, -2 + idleBob, 6, 2);
    ctx.fillStyle = capHi;
    ctx.fillRect(14, -3 + idleBob, 2, 1);

    // --- EYES ---
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(9, 6 + idleBob, 4, 3);
    ctx.fillRect(19, 6 + idleBob, 4, 3);
    ctx.fillStyle = "#000000";
    if (angry) {
      ctx.fillRect(10, 7 + idleBob, 3, 2);
      ctx.fillRect(20, 7 + idleBob, 3, 2);
    } else {
      ctx.fillRect(10, 7 + idleBob, 2, 2);
      ctx.fillRect(20, 7 + idleBob, 2, 2);
    }

    // --- DETERMINED FURROWED BROW ---
    ctx.fillStyle = "#3a2010";
    ctx.fillRect(8, 5 + idleBob, 6, 1);
    ctx.fillRect(18, 5 + idleBob, 6, 1);
    ctx.fillRect(12, 6 + idleBob, 3, 1);
    ctx.fillRect(18, 6 + idleBob, 3, 1);
    if (angry) {
      ctx.fillRect(12, 7 + idleBob, 2, 1);
      ctx.fillRect(18, 7 + idleBob, 2, 1);
    }

    // --- X EYES during dying ---
    if (state === "dying" && dyingTimer > 0) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(9, 6 + idleBob, 4, 3);
      ctx.fillRect(19, 6 + idleBob, 4, 3);
      ctx.fillStyle = "#ff2200";
      ctx.fillRect(9, 6, 1, 1);
      ctx.fillRect(12, 6, 1, 1);
      ctx.fillRect(10, 7, 2, 1);
      ctx.fillRect(9, 8, 1, 1);
      ctx.fillRect(12, 8, 1, 1);
      ctx.fillRect(19, 6, 1, 1);
      ctx.fillRect(22, 6, 1, 1);
      ctx.fillRect(20, 7, 2, 1);
      ctx.fillRect(19, 8, 1, 1);
      ctx.fillRect(22, 8, 1, 1);
    }

    // --- MOUTH / EXPRESSION ---
    if (veryAngry) {
      ctx.fillStyle = "#1a0a0a";
      ctx.fillRect(10, 12 + idleBob, 12, 2);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(10, 12 + idleBob, 2, 2);
      ctx.fillRect(14, 12 + idleBob, 2, 2);
      ctx.fillRect(18, 12 + idleBob, 2, 2);
    } else if (angry) {
      ctx.fillStyle = "#3a1a0a";
      ctx.fillRect(10, 12 + idleBob, 12, 1);
      ctx.fillRect(9, 11 + idleBob, 3, 2);
      ctx.fillRect(20, 11 + idleBob, 3, 2);
    } else {
      ctx.fillStyle = "#3a1a0a";
      ctx.fillRect(10, 12 + idleBob, 12, 1);
    }

    // --- NOSE ---
    ctx.fillStyle = skinShad;
    ctx.fillRect(15, 10 + idleBob, 2, 2);

    // --- SWEAT DROPS (front-facing) ---
    if (saltMeter > 50) {
      const sweatAlpha = Math.min(1, (saltMeter - 50) / 50);
      ctx.globalAlpha = sweatAlpha * (0.6 + Math.sin(Date.now() * 0.006) * 0.3);
      ctx.fillStyle = "#55ddff";
      ctx.beginPath();
      ctx.ellipse(10, 5 + idleBob, 1.5, 2.5, 0.2, 0, Math.PI * 2);
      ctx.fill();
      if (saltMeter > 70) {
        ctx.globalAlpha = sweatAlpha * 0.7;
        ctx.beginPath();
        ctx.ellipse(22, 4 + idleBob, 1.5, 2.5, -0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha =
        hitTimer > 0 && Math.floor(hitTimer / 4) % 2 === 0 ? 0.3 : 1;
    }
  }

  // ============================================================
  // WEAPON OVERLAYS
  // ============================================================

  // --- PICKAXE (when held, not attacking) ---
  if (hasAxe && state !== "attacking") {
    const shouldShowAxe = axeTimer > 120 || Math.floor(axeTimer / 10) % 2 === 0;
    if (shouldShowAxe) {
      ctx.save();
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = liteMode ? 0 : 8;
      if (state === "run") {
        ctx.fillStyle = "#8B5E3C";
        ctx.fillRect(22, 12, 3, 14);
        ctx.fillStyle = "#aaaaaa";
        ctx.fillRect(22, 3, 12, 8);
        ctx.fillRect(26, 0, 8, 12);
        ctx.fillStyle = "#cccccc";
        ctx.fillRect(23, 3, 5, 3);
      } else {
        ctx.fillStyle = "#8B5E3C";
        ctx.fillRect(26, 6, 3, 14);
        ctx.fillStyle = "#aaaaaa";
        ctx.fillRect(18, -2, 16, 9);
        ctx.fillRect(26, -6, 8, 12);
        ctx.fillStyle = "#cccccc";
        ctx.fillRect(19, -1, 6, 3);
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // --- GUN in hand ---
  if (hasGun && p.state !== "dying" && p.state !== "attacking") {
    const gunFlash = gunTimer < 120 && Math.floor(gunTimer / 8) % 2 === 0;
    if (!gunFlash) {
      const shouldShowGun =
        gunTimer > 120 || Math.floor(gunTimer / 10) % 2 === 0;
      if (shouldShowGun) {
        ctx.save();
        ctx.shadowColor = "#00aaff";
        ctx.shadowBlur = liteMode ? 0 : gunTimer < 120 ? 10 : 5;
        const gx = p.state === "run" ? 20 : 26;
        const gy = p.state === "run" ? 24 : 20;
        ctx.fillStyle = "#888888";
        ctx.fillRect(gx, gy, 16, 7);
        ctx.fillStyle = "#555555";
        ctx.fillRect(gx + 12, gy + 1, 10, 5);
        ctx.fillStyle = "#666666";
        ctx.fillRect(gx + 5, gy + 6, 3, 5);
        ctx.fillStyle = "#6B3A1F";
        ctx.fillRect(gx + 2, gy + 6, 8, 7);
        ctx.fillStyle = "#8B4513";
        ctx.fillRect(gx + 3, gy + 6, 4, 3);
        ctx.fillStyle = "#cccccc";
        ctx.fillRect(gx + 19, gy + 2, 3, 3);
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }
  }

  // --- HARD HAT ---
  if (currentWeapon === "hardhat" && p.state !== "dying") {
    ctx.save();
    ctx.shadowColor = "#ffee00";
    ctx.shadowBlur = liteMode ? 0 : 6;
    ctx.fillStyle = "#ffdd00";
    ctx.fillRect(-1, -7, p.w + 2, 3);
    ctx.fillStyle = "#ffcc00";
    ctx.fillRect(3, -14, p.w - 6, 9);
    ctx.fillStyle = "#ffe44a";
    ctx.fillRect(5, -13, p.w - 12, 4);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // --- DYNAMITE ---
  if (currentWeapon === "dynamite" && p.state !== "dying") {
    ctx.save();
    ctx.shadowColor = "#ff4400";
    ctx.shadowBlur = liteMode ? 0 : 6;
    ctx.fillStyle = "#cc2200";
    ctx.fillRect(22, 18, 8, 16);
    ctx.fillStyle = "#ff4400";
    ctx.fillRect(23, 19, 6, 14);
    ctx.strokeStyle = "#888800";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(26, 18);
    ctx.lineTo(28, 12);
    ctx.lineTo(30, 10);
    ctx.stroke();
    ctx.shadowColor = "#ffff00";
    ctx.shadowBlur = liteMode ? 0 : 8;
    ctx.fillStyle = "#ffff00";
    ctx.fillRect(29, 9, 3, 3);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // --- SALT SHAKER ---
  if (currentWeapon === "saltshaker" && p.state !== "dying") {
    ctx.save();
    ctx.shadowColor = "#88ddff";
    ctx.shadowBlur = liteMode ? 0 : 6;
    ctx.fillStyle = "#dddddd";
    ctx.fillRect(20, 16, 9, 15);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(21, 17, 6, 13);
    ctx.fillStyle = "#aaaaaa";
    ctx.fillRect(20, 14, 9, 3);
    ctx.fillStyle = "#888888";
    ctx.fillRect(22, 18, 1, 1);
    ctx.fillRect(24, 18, 1, 1);
    ctx.fillRect(26, 18, 1, 1);
    ctx.fillRect(23, 21, 1, 1);
    ctx.fillRect(25, 21, 1, 1);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // --- SPEED BOOTS foot trails ---
  if (speedBootsTimer > 0 && p.state === "run") {
    const bootFlash =
      speedBootsTimer < 120 && Math.floor(speedBootsTimer / 8) % 2 === 0;
    if (!bootFlash) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = "#ff9900";
      for (let li = 0; li < 3; li++) {
        const lineX = -(li + 1) * 6;
        ctx.fillRect(lineX + 5, p.h - 5, 8 - li, 2);
        ctx.fillRect(lineX + 17, p.h - 5, 8 - li, 2);
      }
      ctx.restore();
    }
  }

  // --- MAGNET aura ---
  if (magnetTimer > 0 && p.state !== "dying") {
    const magFlash = magnetTimer < 120 && Math.floor(magnetTimer / 8) % 2 === 0;
    if (!magFlash) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.shadowColor = "#cc44ff";
      ctx.shadowBlur = liteMode ? 0 : 14;
      ctx.strokeStyle = "#cc44ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.w / 2, p.h / 2, p.w, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // --- PORTFOLIO SHIELD gold outline ---
  if (portfolioShieldTimer > 0 && p.state !== "dying") {
    const shieldFlash =
      portfolioShieldTimer < 120 &&
      Math.floor(portfolioShieldTimer / 8) % 2 === 0;
    if (!shieldFlash) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = "#ffd700";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = liteMode ? 0 : 8;
      ctx.strokeRect(-2, -2, p.w + 4, p.h + 4);
      ctx.restore();
    }
  }

  ctx.restore();

  // --- BUBBLE (drawn after outer restore so it's in canvas coords) ---
  if (hasBubble && p.state !== "dying") {
    const bubbleAlpha = 0.25 + Math.sin(Date.now() * 0.006) * 0.1;
    ctx.save();
    ctx.globalAlpha = bubbleAlpha;
    ctx.shadowColor = "#88ddff";
    ctx.shadowBlur = liteMode ? 0 : 16;
    ctx.strokeStyle = "#aaeeff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = bubbleAlpha * 0.3;
    ctx.fillStyle = "#88ddff";
    ctx.fill();
    ctx.restore();
  }
}
function drawBear(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  armRaise: number,
  throwAnim = 0,
  walkFrame = 0,
  tauntTimer = 0,
  stunTimer = 0,
) {
  ctx.save();
  ctx.translate(bx, by);

  // Taunt animation when James dies
  if (tauntTimer > 0) {
    const tp = 1 - tauntTimer / 60;
    const jumpOffset = -Math.abs(Math.sin(tp * Math.PI)) * 20;
    const waveL = Math.sin(tp * Math.PI * 4) * 25;
    const waveR = Math.sin(tp * Math.PI * 4 + Math.PI) * 25;
    ctx.translate(0, jumpOffset);
    // Body
    ctx.fillStyle = "#6B0000";
    ctx.fillRect(6, 16, 30, 28);
    ctx.fillStyle = "#A52A2A";
    ctx.fillRect(10, 19, 22, 22);
    // Arms waving
    ctx.fillStyle = "#6B0000";
    ctx.fillRect(-6, 2 + waveL, 12, 18);
    ctx.fillRect(36, 2 + waveR, 12, 18);
    ctx.fillStyle = "#8B0000";
    ctx.fillRect(-7, waveL, 8, 8);
    ctx.fillRect(41, waveR, 8, 8);
    // Head
    ctx.fillStyle = "#8B0000";
    ctx.fillRect(8, 0, 26, 22);
    ctx.fillStyle = "#A52A2A";
    ctx.fillRect(10, 2, 22, 18);
    // Laughing mouth
    ctx.fillStyle = "#330000";
    ctx.fillRect(13, 16, 16, 5);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(13, 16, 4, 4);
    ctx.fillRect(19, 16, 4, 4);
    ctx.fillRect(25, 16, 3, 4);
    // Gleeful eyes
    ctx.fillStyle = "#ff6600";
    ctx.fillRect(11, 6, 7, 5);
    ctx.fillRect(24, 6, 7, 5);
    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 10px monospace";
    ctx.fillText("HA", 6, -8);
    ctx.font = "bold 10px monospace";
    ctx.fillText("HA!", 26, -12);
    ctx.restore();
    return; // Don't draw normal bear during taunt
  }

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
  // Claw marks on belly
  ctx.strokeStyle = "#500000";
  ctx.lineWidth = 1;
  for (let ci = 0; ci < 3; ci++) {
    ctx.beginPath();
    ctx.moveTo(14 + ci * 5, 22);
    ctx.lineTo(17 + ci * 5, 32);
    ctx.stroke();
  }

  // Fur texture on body edges
  ctx.fillStyle = "#500000";
  for (let fi = 0; fi < 5; fi++) {
    ctx.fillRect(6, 18 + fi * 5, 2, 3);
    ctx.fillRect(34, 18 + fi * 5, 2, 3);
    ctx.fillRect(9 + fi * 5, 43, 3, 2);
  }

  // Idle breathing bob
  const breathBob =
    throwAnim === 0 && walkFrame < 2 ? Math.sin(Date.now() * 0.003) * 1.5 : 0;

  // 3-frame walk sway based on walkFrame % 45
  const walkPhase = walkFrame % 45;
  const bodySwayX = walkPhase < 15 ? -1 : walkPhase < 30 ? 0 : 1;

  // Legs (animated when walking with bigger stride)
  if (walkFrame > 0 && throwAnim === 0) {
    const legSwing = Math.sin(walkFrame * 0.25) * 10;
    // Body lean in walk direction using 3-frame sway
    const leanX = bodySwayX;
    ctx.save();
    ctx.translate(leanX, breathBob);
    ctx.fillStyle = "#6B0000";
    ctx.fillRect(9, 40 - legSwing, 10, 8);
    ctx.fillRect(23, 40 + legSwing, 10, 8);
    ctx.fillStyle = "#8B0000";
    ctx.fillRect(8, 47 - legSwing, 12, 4);
    ctx.fillRect(22, 47 + legSwing, 12, 4);
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(0, breathBob);
    ctx.fillStyle = "#6B0000";
    ctx.fillRect(9, 40, 10, 8);
    ctx.fillRect(23, 40, 10, 8);
    ctx.fillStyle = "#8B0000";
    ctx.fillRect(8, 46, 12, 4);
    ctx.fillRect(22, 46, 12, 4);
    ctx.restore();
  }

  // Arms with animation
  if (throwAnim > 0) {
    // Rage glow around bear when throwing
    ctx.save();
    ctx.shadowColor = "#ff2200";
    ctx.shadowBlur = 20 + Math.sin(Date.now() * 0.02) * 8;
    ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.02) * 0.1;
    ctx.fillStyle = "#ff2200";
    ctx.fillRect(0, 0, 42, 52);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.restore();
    // Throw pose: wind-up (throwAnim > 17) then thrust (throwAnim <= 17)
    const throwProgress = throwAnim / 35;
    const isWindup = throwAnim > 17;
    const armExt = isWindup ? (1 - throwProgress) * -18 : throwProgress * -18;
    const thrustFwd = isWindup ? 0 : (1 - throwProgress) * 8;
    // Body lean: wind-up leans back, release lurches forward
    ctx.save();
    const throwLeanX = isWindup ? -3 : 5;
    ctx.translate(thrustFwd * 0.3 + throwLeanX * (throwAnim / 35), breathBob);
    ctx.fillStyle = "#6B0000";
    ctx.fillRect(-4 - thrustFwd, 16 + armExt, 12, 14);
    ctx.fillStyle = "#8B0000";
    ctx.fillRect(-6 - thrustFwd, 14 + armExt, 8, 8);
    ctx.fillStyle = "#6B0000";
    ctx.fillRect(34 + thrustFwd, 16 + armExt, 12, 14);
    ctx.fillStyle = "#8B0000";
    ctx.fillRect(36 + thrustFwd, 14 + armExt, 8, 8);
    ctx.restore();
    // Roar expression on throw (mouth wide open, eyes narrowed)
    {
      ctx.save();
      ctx.shadowColor = "#ff4400";
      ctx.shadowBlur = isWindup ? 6 : 12;
      // Anger lines radiating from face - more intense on throw release
      ctx.strokeStyle = isWindup ? "#ff8800" : "#ff3300";
      ctx.lineWidth = isWindup ? 1 : 1.5;
      const lineCount = isWindup ? 3 : 5;
      for (let ri = 0; ri < lineCount; ri++) {
        const angle = (ri / lineCount) * Math.PI - Math.PI * 0.15;
        const bx2 = 18 + Math.cos(angle) * 4;
        const by2 = 8 + Math.sin(angle) * 4;
        ctx.beginPath();
        ctx.moveTo(bx2, by2);
        ctx.lineTo(
          bx2 + Math.cos(angle) * (isWindup ? 6 : 10),
          by2 + Math.sin(angle) * (isWindup ? 5 : 9),
        );
        ctx.stroke();
      }
      ctx.restore();
    }
    // Visible fist circle on throwing arm
    ctx.save();
    ctx.shadowColor = "#cc0000";
    ctx.shadowBlur = 8;
    const fistX = isWindup ? -6 - thrustFwd : 46 + thrustFwd;
    const fistY = isWindup ? 14 + armExt : 18 + armExt;
    ctx.fillStyle = "#8B0000";
    ctx.beginPath();
    ctx.arc(fistX, fistY, 5, 0, Math.PI * 2);
    ctx.fill();
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
    // Apply bodySway to idle arms too
    ctx.save();
    ctx.translate(bodySwayX, breathBob);
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
    ctx.restore();
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
  // Dollar sign ear tag on right ear
  ctx.save();
  ctx.shadowColor = "#ffd700";
  ctx.shadowBlur = 4;
  ctx.fillStyle = "#ffd700";
  ctx.font = "bold 5px monospace";
  ctx.textAlign = "center";
  ctx.fillText("$", 32, -1);
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;
  ctx.restore();

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
  // Snout shiny highlight
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.6;
  ctx.fillRect(15, 14, 3, 2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000";
  ctx.fillRect(16, 14, 3, 2); // nostrils
  ctx.fillRect(23, 14, 3, 2);

  // Mouth - smug when walking, snarl during throw
  if (throwAnim > 0) {
    ctx.fillStyle = "#330000";
    ctx.fillRect(15, 18, 12, 4);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(15, 18, 3, 3); // teeth
    ctx.fillRect(20, 18, 3, 3);
    ctx.fillRect(25, 18, 2, 3);
  } else {
    // Smug/neutral mouth - slight upward curve at corners
    ctx.fillStyle = "#330000";
    ctx.fillRect(16, 20, 10, 2); // main horizontal line
    ctx.fillRect(14, 19, 2, 2); // left corner turned up
    ctx.fillRect(26, 19, 2, 2); // right corner turned up
  }

  // $ on belly in gold
  ctx.shadowColor = "#ffd700";
  ctx.shadowBlur = 4;
  ctx.font = "bold 12px monospace";
  ctx.fillStyle = "#ffd700";
  ctx.fillText("$", 17, 35);
  ctx.shadowBlur = 0;

  // Stun flash overlay
  if (stunTimer > 0 && Math.floor(stunTimer / 4) % 2 === 0) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-5, -42, 52, 52);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  ctx.restore();
}

function drawHazard(ctx: CanvasRenderingContext2D, h: Hazard) {
  // Frost tint for slowed hazards
  const isSlowed = h.slowTimer && h.slowTimer > 0;

  ctx.save();
  ctx.translate(h.x + h.w / 2, h.y + h.h / 2);
  ctx.rotate(h.rotation);
  ctx.translate(-h.w / 2, -h.h / 2);

  // Hazard-type glow
  if (
    h.type === "boulder" ||
    h.type === "cart" ||
    h.type === "saltbag" ||
    h.type === "barrel"
  ) {
    ctx.shadowColor = "#ff8800";
    ctx.shadowBlur = 8;
  } else if (h.type === "greenCandle") {
    ctx.shadowColor = "#00ff44";
    ctx.shadowBlur = 14;
  } else if (h.type === "redCandle") {
    ctx.shadowColor = "#ff2200";
    ctx.shadowBlur = 14;
  }

  switch (h.type) {
    case "boulder": {
      // Drop shadow - deeper
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(-1, h.h + 2, h.w + 2, 5);
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
      // Rotation marker (bright stripe so spin is visible)
      ctx.fillStyle = "#e0e0ff";
      ctx.fillRect(h.w / 2 - 1, 1, 2, h.h / 2 - 2);
      ctx.fillStyle = "#aaaacc";
      ctx.fillRect(1, h.h / 2 - 1, h.w / 2 - 2, 2);
      // Crack lines
      ctx.strokeStyle = "#222222";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(4, 5);
      ctx.lineTo(12, 13);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(14, 3);
      ctx.lineTo(8, 15);
      ctx.stroke();
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
      // Animated flame (outer) - more dramatic flicker
      const flameFlicker =
        Math.sin(Date.now() * 0.02) * 2 + Math.sin(Date.now() * 0.051) * 1;
      ctx.shadowColor = "#ff4400";
      ctx.shadowBlur = 10 + Math.abs(flameFlicker) * 3;
      // Pointed flame - 3 stacked rects wide to narrow
      ctx.fillStyle = "#ffdd00";
      ctx.fillRect(h.w / 2 - 3, -4 + flameFlicker, 6, 5); // wide base
      ctx.fillStyle = "#ff8800";
      ctx.fillRect(h.w / 2 - 2, -7 + flameFlicker, 4, 4); // mid
      ctx.fillStyle = "#ffeeaa";
      ctx.fillRect(h.w / 2 - 1, -10 + flameFlicker, 2, 4); // narrow tip
      // White highlight
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.7;
      ctx.fillRect(h.w / 2 - 2, -7 + flameFlicker, 2, 2);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      if (!h.fallsThrough) {
        ctx.shadowColor = "#ff2200";
        ctx.shadowBlur = 8 + Math.abs(flameFlicker) * 2;
      }
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
      const greenFlameFlicker =
        Math.sin(Date.now() * 0.02) * 2 + Math.sin(Date.now() * 0.047) * 1;
      ctx.shadowColor = "#00ff66";
      ctx.shadowBlur = 12 + Math.abs(greenFlameFlicker) * 3;
      // Pointed flame - 3 stacked rects wide to narrow
      ctx.fillStyle = "#ffdd00";
      ctx.fillRect(h.w / 2 - 3, -4 + greenFlameFlicker, 6, 5); // wide base
      ctx.fillStyle = "#ffaa00";
      ctx.fillRect(h.w / 2 - 2, -7 + greenFlameFlicker, 4, 4); // mid
      ctx.fillStyle = "#aaffcc";
      ctx.fillRect(h.w / 2 - 1, -10 + greenFlameFlicker, 2, 4); // narrow tip
      // White highlight
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.7;
      ctx.fillRect(h.w / 2 - 2, -7 + greenFlameFlicker, 2, 2);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      if (!h.fallsThrough) {
        ctx.shadowColor = "#00cc44";
        ctx.shadowBlur = 8 + Math.abs(greenFlameFlicker) * 2;
      }
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
        // Spokes (spin based on hazard rotation)
        ctx.strokeStyle = "#444444";
        ctx.lineWidth = 1;
        for (let sp = 0; sp < 4; sp++) {
          const angle = (sp * Math.PI) / 2 + h.rotation;
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
      // Wooden plank pattern (3 horizontal dark lines across body)
      ctx.fillStyle = "#4a2e15";
      ctx.fillRect(0, 6, h.w, 1);
      ctx.fillRect(0, 10, h.w, 1);
      ctx.fillRect(0, 14, h.w, 1);
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
      ctx.fillRect(0, Math.round(h.h * 0.25), h.w, 2);
      ctx.fillRect(0, h.h / 2 - 1, h.w, 2);
      ctx.fillRect(0, Math.round(h.h * 0.75), h.w, 2);
      // Band sheen
      ctx.fillStyle = "#555555";
      ctx.fillRect(0, Math.round(h.h * 0.25), h.w, 1);
      ctx.fillRect(0, h.h / 2 - 1, h.w, 1);
      // Bung hole at center
      ctx.fillStyle = "#222222";
      ctx.fillRect(h.w / 2 - 1, h.h / 2 - 1, 3, 3);
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
      // Extra wobble on doompost
      ctx.save();
      ctx.translate(h.w / 2, h.h / 2);
      ctx.rotate(Math.sin(Date.now() * 0.015) * 0.15);
      ctx.translate(-h.w / 2, -h.h / 2);
      ctx.restore();
      // Glowing outline
      ctx.save();
      ctx.shadowColor = "#ff4400";
      ctx.shadowBlur = 6;
      // Warning stripes on post
      for (let si = 0; si < 4; si++) {
        ctx.fillStyle = si % 2 === 0 ? "#ff2200" : "#ffcc00";
        ctx.fillRect(h.w / 2 - 2, si * 4, 4, 4);
      }
      ctx.shadowBlur = 0;
      ctx.restore();
      // Warning diamond shape
      ctx.save();
      ctx.shadowColor = "#ff4400";
      ctx.shadowBlur = 6;
      ctx.fillStyle = "#dd0000";
      ctx.beginPath();
      ctx.moveTo(h.w / 2, 0);
      ctx.lineTo(h.w, h.h / 2);
      ctx.lineTo(h.w / 2, h.h);
      ctx.lineTo(0, h.h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
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
      // Crack visual when flagged
      if (h.flagged) {
        const flashOn = Math.floor((h.flagTimer || 0) / 5) % 2 === 0;
        if (flashOn) {
          ctx.strokeStyle = "#ffd700";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(4, 4);
          ctx.lineTo(10, 12);
          ctx.moveTo(12, 6);
          ctx.lineTo(8, 14);
          ctx.stroke();
        }
      }
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
      // Salt spray when flagged
      if (h.flagged) {
        const t = h.flagTimer || 0;
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        for (let si = 0; si < 6; si++) {
          const angle = (si / 6) * Math.PI * 2 + t * 0.1;
          const r = 8 + Math.sin(t * 0.2) * 3;
          ctx.fillRect(
            h.w / 2 + Math.cos(angle) * r - 1,
            h.h / 2 + Math.sin(angle) * r - 1,
            2,
            2,
          );
        }
      }
      break;
    }
  }
  // Frost overlay when slowed
  if (isSlowed) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#aaddff";
    ctx.fillRect(h.x, h.y, h.w, h.h);
    ctx.globalAlpha = 1;
    ctx.restore();
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
  level = 0,
) {
  const bodyColor = tint || "#2a1f0e";
  // Drop shadow (wider, softer)
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(x - 2, y + h + 1, w + 4, 6);

  // Body
  ctx.fillStyle = bodyColor;
  ctx.fillRect(x, y, w, h);

  // Darker bottom edge (shadow) - strong underside for depth
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x, y + h - 4, w, 4);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x - 1, y + h, w + 2, 3);

  // Lighter top edge (highlight) - bright ridge for 3D depth
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(x, y + 1, w, 2);

  // Wood grain lines (horizontal streaks across surface)
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 1;
  for (let gy = y + 3; gy < y + h - 3; gy += 3) {
    ctx.beginPath();
    ctx.moveTo(x + 2, gy);
    ctx.lineTo(x + w - 2, gy);
    ctx.stroke();
  }

  // Plank dividers
  ctx.strokeStyle = "rgba(0,0,0,0.30)";
  ctx.lineWidth = 1;
  const plankW = Math.max(20, Math.floor(w / 4));
  for (let px = x + plankW; px < x + w - 4; px += plankW) {
    ctx.beginPath();
    ctx.moveTo(px, y + 1);
    ctx.lineTo(px, y + h - 1);
    ctx.stroke();
  }

  // Nail dots (2-3 small circles)
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  const nailSpacing = Math.max(30, Math.floor(w / 3));
  for (let nx = x + 10; nx < x + w - 10; nx += nailSpacing) {
    ctx.fillRect(nx, y + 2, 2, 2);
    ctx.fillRect(nx, y + h - 4, 2, 2);
  }

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

  // === LEVEL-BASED PLATFORM TEXTURE ===
  if (level >= 0 && level <= 2) {
    // WOOD PLANKS: vertical dark lines + light top edge highlight
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    const plankCount = Math.max(2, Math.floor(w / 16));
    const plankSpacing = w / plankCount;
    for (let pi = 1; pi < plankCount; pi++) {
      ctx.fillRect(x + pi * plankSpacing, y + 1, 1, h - 1);
    }
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x, y, w, 1);
  } else if (level >= 3 && level <= 4) {
    // STONE BRICK: mortar lines
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(x, y + Math.floor(h / 2), w, 1); // horizontal mortar
    const brickW = Math.max(20, Math.floor(w / 4));
    for (let bi = 0; bi <= Math.floor(w / brickW); bi++) {
      const boff = bi % 2 === 0 ? 0 : Math.floor(brickW / 2);
      ctx.fillRect(x + bi * brickW + boff, y, 1, Math.floor(h / 2));
      ctx.fillRect(
        x + bi * brickW,
        y + Math.floor(h / 2),
        1,
        h - Math.floor(h / 2),
      );
    }
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x, y, w, 1);
  } else if (level >= 5) {
    // CRYSTAL/GLOWING: cyan glow + white speckles
    ctx.save();
    ctx.shadowColor = "#00ffff";
    ctx.shadowBlur = 6;
    ctx.strokeStyle = "rgba(0,220,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
    // White speckle rects along top edge
    ctx.fillStyle = "rgba(200,255,255,0.8)";
    for (let si = x + 6; si < x + w - 4; si += 10) {
      ctx.fillRect(si, y, 2, 2);
    }
    // Blue tint overlay
    ctx.fillStyle = "rgba(0,100,200,0.08)";
    ctx.fillRect(x, y, w, h);
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

  // Outer glow halo - stronger, pulsing
  ctx.shadowColor = "#00C853";
  ctx.shadowBlur = (20 + Math.sin(frame * 0.06) * 8) * glow;

  // Light rays fanning out from flame tip
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = "#00ff88";
  ctx.lineWidth = 1;
  const rayOriginX = x + 9;
  const rayOriginY = y - 74;
  for (let ri = 0; ri < 5; ri++) {
    const rayAngle = -Math.PI / 2 + (ri - 2) * 0.3;
    ctx.beginPath();
    ctx.moveTo(rayOriginX, rayOriginY);
    ctx.lineTo(
      rayOriginX + Math.cos(rayAngle) * 28,
      rayOriginY + Math.sin(rayAngle) * 28,
    );
    ctx.stroke();
  }
  ctx.restore();

  // Upper wick
  ctx.strokeStyle = "#888888";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 9, y - 50);
  ctx.lineTo(x + 9, y - 64);
  ctx.stroke();

  // Flame at top of wick - taller (8px taller)
  ctx.shadowColor = "#ffcc00";
  ctx.shadowBlur = 14;
  const flameY = y - 74 + Math.sin(frame * 0.15) * 2;
  // Pointed flame stacked rects
  ctx.fillStyle = "#ffdd00";
  ctx.fillRect(x + 5, flameY + 10, 9, 6); // wide base
  ctx.fillStyle = "#ff8800";
  ctx.fillRect(x + 6, flameY + 5, 7, 6); // mid
  ctx.fillStyle = "#ffffaa";
  ctx.fillRect(x + 7, flameY, 5, 6); // narrow tip
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.6;
  ctx.fillRect(x + 7, flameY + 2, 2, 3); // white highlight
  ctx.globalAlpha = 1;

  // Floating ember particles above portal - 5 embers
  for (let fp = 0; fp < 5; fp++) {
    const fpMaxH = 40;
    const fpOffset = (fp * 8 + frame * 0.7 * (fp + 1)) % fpMaxH;
    const fpX = x + 2 + Math.sin(frame * 0.1 + fp * 1.5) * 8;
    const fpY = flameY - fpOffset;
    const fpAlpha = Math.max(0, 1 - fpOffset / fpMaxH);
    ctx.save();
    ctx.globalAlpha = fpAlpha * 0.9;
    ctx.shadowColor = "#00ff88";
    ctx.shadowBlur = 6;
    ctx.fillStyle = fp % 2 === 0 ? "#00ff88" : "#ffdd00";
    ctx.fillRect(fpX, fpY, 2, 2);
    ctx.restore();
  }

  // Candle body (tall green rectangle - bullish!)
  ctx.shadowColor = "#00C853";
  ctx.shadowBlur = 20 + Math.sin(frame * 0.06) * 8;
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

  // Light blue shimmer glow - enhanced so it pops on dark backgrounds
  ctx.shadowColor = "#4fc3f7";
  ctx.shadowBlur = 14 + Math.sin(frame * 0.12) * 4;

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

  // Blue label stripe
  ctx.fillStyle = "#1565c0";
  ctx.fillRect(x + 3, y + 10, 10, 4);

  // H2O label text
  ctx.fillStyle = "#e3f2fd";
  ctx.font = "bold 4px monospace";
  ctx.textAlign = "center";
  ctx.fillText("H2O", x + 8, y + 14);
  ctx.textAlign = "left";

  // Bottle highlight
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(x + 4, y + 6, 2, 10);

  // Shine highlight (upper-left of bottle)
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillRect(x + 4, y + 6, 2, 5);

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
  const mbFrame = Math.floor(Date.now() / 50) % 20;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.shadowColor = "#ffd700";
  ctx.shadowBlur = 4 + mbFrame * 0.2;
  ctx.fillStyle = "#8B6914";
  ctx.fillRect(1, 8, 14, 12);
  ctx.fillRect(3, 6, 10, 4);
  ctx.fillRect(5, 4, 6, 4);
  ctx.fillStyle = "#c9a227";
  ctx.fillRect(2, 9, 5, 4);
  // Shimmer diagonal stripe
  if (mbFrame < 6) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(3, 8, 1, 12);
    ctx.fillRect(5, 8, 1, 10);
    ctx.restore();
  }
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
  const cbFrame = Math.floor(Date.now() / 50) % 20;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.shadowColor = "#00ff88";
  ctx.shadowBlur = 14 + cbFrame * 0.3;
  ctx.fillStyle = "#2e7d32";
  ctx.fillRect(0, 6, 22, 20);
  ctx.fillRect(3, 3, 16, 6);
  ctx.fillRect(7, 0, 8, 5);
  ctx.fillStyle = "#43a047";
  ctx.fillRect(2, 8, 8, 6);
  // Intense shimmer diagonal stripe
  if (cbFrame < 8) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(4, 6, 2, 20);
    ctx.fillRect(8, 6, 2, 18);
    ctx.restore();
  }
  ctx.font = "bold 9px monospace";
  ctx.fillStyle = "#00ff88";
  ctx.textAlign = "center";
  ctx.fillText("$$", 11, 20);
  // Glowing $$$ label above bag
  ctx.save();
  ctx.shadowColor = "#00ff88";
  ctx.shadowBlur = 8;
  ctx.font = "bold 7px monospace";
  ctx.fillStyle = "#00ff88";
  ctx.fillText("$$$", 11, -2);
  ctx.restore();
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

function drawDynamitePickup(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
) {
  const bob = Math.sin(frame * 0.08) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.shadowColor = "#ff4400";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#cc2200";
  ctx.fillRect(4, 2, 8, 16);
  ctx.fillStyle = "#ff4400";
  ctx.fillRect(5, 3, 6, 14);
  // Fuse
  ctx.strokeStyle = "#888800";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8, 2);
  ctx.lineTo(10, -3);
  ctx.lineTo(13, -6);
  ctx.stroke();
  // Fuse spark
  ctx.shadowColor = "#ffff00";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#ffff00";
  ctx.fillRect(12, -7, 2, 2);
  ctx.shadowBlur = 6;
  ctx.font = "bold 5px monospace";
  ctx.fillStyle = "#ff6600";
  ctx.textAlign = "center";
  ctx.fillText("BOOM", 8, 24);
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawSaltShakerPickup(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
) {
  const bob = Math.sin(frame * 0.09) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.shadowColor = "#88ddff";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#dddddd";
  ctx.fillRect(3, 4, 10, 16);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(4, 5, 7, 14);
  // Cap
  ctx.fillStyle = "#aaaaaa";
  ctx.fillRect(3, 2, 10, 4);
  // Holes
  ctx.fillStyle = "#888888";
  ctx.fillRect(5, 7, 2, 2);
  ctx.fillRect(9, 7, 2, 2);
  ctx.fillRect(7, 10, 2, 2);
  ctx.fillRect(5, 13, 2, 2);
  ctx.fillRect(9, 13, 2, 2);
  ctx.shadowBlur = 6;
  ctx.font = "bold 5px monospace";
  ctx.fillStyle = "#88ddff";
  ctx.textAlign = "center";
  ctx.fillText("SALT", 8, 26);
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawHardHatPickup(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
) {
  const bob = Math.sin(frame * 0.07) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.shadowColor = "#ffdd00";
  ctx.shadowBlur = 12;
  // Brim
  ctx.fillStyle = "#ffcc00";
  ctx.fillRect(0, 10, 18, 4);
  // Dome
  ctx.fillStyle = "#ffdd00";
  ctx.fillRect(2, 2, 14, 10);
  ctx.fillRect(3, 0, 12, 4);
  ctx.fillStyle = "#ffe44a";
  ctx.fillRect(3, 2, 8, 4);
  // Stripe
  ctx.fillStyle = "#cc9900";
  ctx.fillRect(7, 2, 2, 10);
  ctx.shadowBlur = 6;
  ctx.font = "bold 5px monospace";
  ctx.fillStyle = "#ffdd00";
  ctx.textAlign = "center";
  ctx.fillText("SAFE", 9, 22);
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawBubblePickup(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
) {
  const bob = Math.sin(frame * 0.1) * 3;
  const pulse = 1 + Math.sin(frame * 0.15) * 0.1;
  ctx.save();
  ctx.translate(x + 9, y + 9 + bob);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = "#88ddff";
  ctx.shadowBlur = 14;
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = "#aaeeff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = "#88ddff";
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.restore();
  ctx.save();
  ctx.shadowColor = "#88ddff";
  ctx.shadowBlur = 6;
  ctx.font = "bold 5px monospace";
  ctx.fillStyle = "#88ddff";
  ctx.textAlign = "center";
  ctx.fillText("SHIELD", x + 9, y + 24);
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawSpeedBootsPickup(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
) {
  const bob = Math.sin(frame * 0.1) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.shadowColor = "#ff9900";
  ctx.shadowBlur = 12;
  // Boot shape (left)
  ctx.fillStyle = "#ff6600";
  ctx.fillRect(1, 6, 8, 10);
  ctx.fillStyle = "#ff8800";
  ctx.fillRect(2, 7, 6, 8);
  // Sole
  ctx.fillStyle = "#cc4400";
  ctx.fillRect(0, 14, 10, 3);
  ctx.fillRect(7, 12, 4, 2);
  // Motion lines
  ctx.fillStyle = "#ffcc00";
  for (let li = 0; li < 3; li++) {
    ctx.fillRect(11 + li * 2, 9 + li, 4 - li, 2);
  }
  ctx.shadowBlur = 6;
  ctx.font = "bold 5px monospace";
  ctx.fillStyle = "#ff9900";
  ctx.textAlign = "center";
  ctx.fillText("FAST", 9, 24);
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawMagnetPickup(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
) {
  const bob = Math.sin(frame * 0.08) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.shadowColor = "#cc44ff";
  ctx.shadowBlur = 12;
  // Horseshoe shape
  ctx.strokeStyle = "#cc44ff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(9, 8, 7, Math.PI, 0, false);
  ctx.stroke();
  // Tips
  ctx.fillStyle = "#ff4444";
  ctx.fillRect(2, 8, 4, 6);
  ctx.fillStyle = "#4444ff";
  ctx.fillRect(12, 8, 4, 6);
  ctx.fillStyle = "#cc44ff";
  ctx.fillRect(3, 9, 2, 4);
  ctx.fillRect(13, 9, 2, 4);
  ctx.shadowBlur = 6;
  ctx.font = "bold 5px monospace";
  ctx.fillStyle = "#cc44ff";
  ctx.textAlign = "center";
  ctx.fillText("PULL", 9, 22);
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawPortfolioShieldPickup(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
) {
  const bob = Math.sin(frame * 0.09) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.shadowColor = "#ffd700";
  ctx.shadowBlur = 14;
  // Shield shape
  ctx.fillStyle = "#ffd700";
  ctx.fillRect(2, 0, 14, 12);
  ctx.fillRect(0, 2, 18, 8);
  // Bottom triangle
  ctx.beginPath();
  ctx.moveTo(2, 10);
  ctx.lineTo(16, 10);
  ctx.lineTo(9, 18);
  ctx.closePath();
  ctx.fill();
  // Inner highlight
  ctx.fillStyle = "#fffaaa";
  ctx.fillRect(5, 3, 8, 5);
  // Dollar sign
  ctx.fillStyle = "#cc9900";
  ctx.font = "bold 8px monospace";
  ctx.textAlign = "center";
  ctx.fillText("$", 9, 12);
  ctx.textAlign = "left";
  ctx.shadowBlur = 6;
  ctx.font = "bold 4px monospace";
  ctx.fillStyle = "#ffd700";
  ctx.textAlign = "center";
  ctx.fillText("SHIELD", 9, 24);
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawSpawnedPickup(
  ctx: CanvasRenderingContext2D,
  sp: SpawnedPickup,
  frame: number,
) {
  const flash = sp.lifetime < 120 && Math.floor(sp.lifetime / 8) % 2 === 0;
  if (flash) return;
  switch (sp.type) {
    case "pickaxe":
      drawAxePickup(ctx, sp.x, sp.y, frame);
      break;
    case "gun":
      drawGunPickup(ctx, sp.x, sp.y, frame);
      break;
    case "dynamite":
      drawDynamitePickup(ctx, sp.x, sp.y, frame);
      break;
    case "saltshaker":
      drawSaltShakerPickup(ctx, sp.x, sp.y, frame);
      break;
    case "hardhat":
      drawHardHatPickup(ctx, sp.x, sp.y, frame);
      break;
    case "bubble":
      drawBubblePickup(ctx, sp.x, sp.y, frame);
      break;
    case "speedboots":
      drawSpeedBootsPickup(ctx, sp.x, sp.y, frame);
      break;
    case "magnet":
      drawMagnetPickup(ctx, sp.x, sp.y, frame);
      break;
    case "portfolioshield":
      drawPortfolioShieldPickup(ctx, sp.x, sp.y, frame);
      break;
  }
}

function drawDynamiteInFlight(
  ctx: CanvasRenderingContext2D,
  dyn: Dynamite,
  frame: number,
) {
  ctx.save();
  ctx.translate(dyn.x, dyn.y);
  const spin = (frame * 0.2) % (Math.PI * 2);
  ctx.rotate(spin);
  ctx.shadowColor = "#ff4400";
  ctx.shadowBlur = 10;
  // Blink when about to explode
  if (dyn.timer < 30 && Math.floor(dyn.timer / 4) % 2 === 0) {
    ctx.fillStyle = "#ffff00";
  } else {
    ctx.fillStyle = "#cc2200";
  }
  ctx.fillRect(-4, -8, 8, 16);
  ctx.fillStyle = dyn.timer < 30 ? "#ff8800" : "#ff4400";
  ctx.fillRect(-3, -7, 6, 14);
  // Fuse
  ctx.strokeStyle = "#888800";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(2, -12);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  level: number,
  frame: number,
  liteMode = false,
) {
  const palette = LEVEL_PALETTES[level % LEVEL_PALETTES.length];
  // === LAYER 1: Deep background - stone block grid ===
  ctx.fillStyle = palette.bg1;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // === FAR-BACK SCAFFOLDING SILHOUETTE (parallax 0.1) ===
  {
    const scaffoldOffX = (frame * 0.1) % 100;
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#3a2010";
    // Draw a few H-shaped scaffolding structures
    const scaffoldPositions = [30, 160, 290, 400];
    for (const sx of scaffoldPositions) {
      const ox = ((sx + scaffoldOffX) % (CANVAS_W + 40)) - 20;
      // Left post
      ctx.fillRect(ox, 60, 5, CANVAS_H - 60);
      // Right post
      ctx.fillRect(ox + 30, 60, 5, CANVAS_H - 60);
      // Cross beams
      ctx.fillRect(ox - 3, 120, 41, 5);
      ctx.fillRect(ox - 3, 240, 41, 5);
      ctx.fillRect(ox - 3, 360, 41, 5);
    }
    ctx.restore();
  }

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

  // === STALACTITES: downward-pointing cave formations at top ===
  const stalactiteData = [
    { x: 40, h: 28, w: 14 },
    { x: 85, h: 20, w: 10 },
    { x: 140, h: 35, w: 16 },
    { x: 190, h: 18, w: 9 },
    { x: 260, h: 30, w: 13 },
    { x: 320, h: 22, w: 11 },
    { x: 390, h: 40, w: 18 },
    { x: 450, h: 25, w: 12 },
  ];
  for (const st of stalactiteData) {
    const drip = Math.sin(frame * 0.02 + st.x * 0.1) * 1.5;
    ctx.fillStyle = "#1a1428";
    ctx.beginPath();
    ctx.moveTo(st.x, 0);
    ctx.lineTo(st.x + st.w, 0);
    ctx.lineTo(st.x + st.w / 2, st.h + drip);
    ctx.closePath();
    ctx.fill();
    // Highlight edge
    ctx.fillStyle = "#2a2040";
    ctx.beginPath();
    ctx.moveTo(st.x, 0);
    ctx.lineTo(st.x + 3, 0);
    ctx.lineTo(st.x + st.w / 2, st.h + drip);
    ctx.closePath();
    ctx.fill();
    // Drip drop
    if (st.h > 25) {
      ctx.fillStyle = "rgba(100,180,255,0.5)";
      ctx.fillRect(st.x + st.w / 2 - 1, st.h + drip, 2, 3);
    }
  }

  // === ANIMATED STALACTITE DRIPS (deterministic via frameCount) ===
  if (!liteMode) {
    stalactiteData.forEach((st, idx) => {
      const dripPhase = (frame + idx * 37) % 180;
      if (dripPhase < 20) {
        const dripY = st.h + dripPhase * 0.8;
        ctx.save();
        ctx.globalAlpha = 0.7 * (1 - dripPhase / 20);
        ctx.fillStyle = "#5090c0";
        ctx.fillRect(st.x + st.w / 2 - 1, dripY, 2, 3);
        ctx.restore();
      }
    });
  }

  // === ORE VEINS: glowing diagonal streaks ===
  if (!liteMode) {
    const oreVeins = [
      { x: 20, y: 150, len: 60, color: "#00ff88", angle: 0.7 },
      { x: 430, y: 200, len: 50, color: "#4fc3f7", angle: -0.6 },
      { x: 100, y: 380, len: 45, color: "#ffd700", angle: 0.5 },
      { x: 360, y: 420, len: 55, color: "#00ff88", angle: -0.8 },
      { x: 60, y: 550, len: 40, color: "#ff88ff", angle: 0.6 },
      { x: 400, y: 560, len: 48, color: "#4fc3f7", angle: -0.5 },
    ];
    for (const vein of oreVeins) {
      const glowPulse = 0.4 + Math.sin(frame * 0.035 + vein.x * 0.1) * 0.25;
      ctx.save();
      ctx.shadowColor = vein.color;
      ctx.shadowBlur = (4 + Math.sin(frame * 0.05) * 3) * glowPulse;
      ctx.strokeStyle = vein.color;
      ctx.globalAlpha = glowPulse;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(vein.x, vein.y);
      ctx.lineTo(
        vein.x + Math.cos(vein.angle) * vein.len,
        vein.y + Math.sin(vein.angle) * vein.len,
      );
      ctx.stroke();
      // Thinner bright inner line
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#ffffff";
      ctx.globalAlpha = glowPulse * 0.4;
      ctx.beginPath();
      ctx.moveTo(vein.x, vein.y);
      ctx.lineTo(
        vein.x + Math.cos(vein.angle) * vein.len * 0.6,
        vein.y + Math.sin(vein.angle) * vein.len * 0.6,
      );
      ctx.stroke();
      ctx.restore();
    }
  } // end !liteMode ore veins

  // === TORCHLIGHT: flickering orange glow at 2 wall positions ===
  if (!liteMode) {
    const torchPositions = [
      { x: 28, y: 180 },
      { x: 452, y: 350 },
    ];
    for (const torch of torchPositions) {
      const flicker = 0.7 + Math.sin(Date.now() * 0.008 + torch.x) * 0.3;
      const flickerFast = Math.sin(Date.now() * 0.022 + torch.x * 2) * 0.15;
      const totalFlicker = flicker + flickerFast;
      // Torch glow
      ctx.save();
      ctx.shadowColor = "#ff8800";
      ctx.shadowBlur = 22 * totalFlicker;
      ctx.fillStyle = `rgba(255,140,0,${0.12 * totalFlicker})`;
      ctx.beginPath();
      ctx.arc(torch.x, torch.y, 30 * totalFlicker, 0, Math.PI * 2);
      ctx.fill();
      // Torch bracket
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#555";
      ctx.fillRect(torch.x - 3, torch.y - 5, 6, 14);
      // Flame
      ctx.shadowColor = "#ffdd00";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#ffdd00";
      ctx.fillRect(
        torch.x - 3,
        torch.y - 10 - totalFlicker * 3,
        6,
        6 + totalFlicker * 2,
      );
      ctx.fillStyle = "#ff6600";
      ctx.fillRect(torch.x - 2, torch.y - 8 - totalFlicker * 2, 4, 4);
      ctx.restore();
    }
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

  if (!liteMode) {
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
  } // end !liteMode crystal clusters

  // Glowing blue energy wisps near bottom (liteMode skip)
  if (!liteMode) {
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

  // Per-year lava/hellscape atmosphere
  const levelIdx = level;
  if (levelIdx >= 4 && levelIdx <= 5) {
    // Lava glow on cave walls
    const lavaAlpha = 0.15 + Math.sin(frame * 0.03) * 0.05;
    ctx.fillStyle = `rgba(255,80,0,${lavaAlpha})`;
    ctx.fillRect(0, 0, 30, CANVAS_H);
    ctx.fillRect(450, 0, 30, CANVAS_H);
    // Lava veins
    ctx.strokeStyle = `rgba(255,120,0,${lavaAlpha * 2})`;
    ctx.lineWidth = 2;
    for (let lv = 0; lv < 3; lv++) {
      ctx.beginPath();
      ctx.moveTo(0, 100 + lv * 150);
      ctx.bezierCurveTo(
        20,
        120 + lv * 150,
        10,
        140 + lv * 150,
        25,
        160 + lv * 150,
      );
      ctx.stroke();
    }
  }
  if (levelIdx >= 6) {
    // Deep red ambient
    ctx.fillStyle = "rgba(60,0,0,0.2)";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    // Red crystal formations on floor
    ctx.fillStyle = "#4a0000";
    for (let rc = 0; rc < 5; rc++) {
      const rx = rc * 90 + 20;
      ctx.beginPath();
      ctx.moveTo(rx, CANVAS_H);
      ctx.lineTo(rx + 8, CANVAS_H - 40);
      ctx.lineTo(rx + 16, CANVAS_H);
      ctx.fill();
      ctx.fillStyle = "#660000";
      ctx.fillRect(rx + 2, CANVAS_H - 35, 4, 30);
      ctx.fillStyle = "#4a0000";
    }
  }
}

function _drawHUD(ctx: CanvasRenderingContext2D, gs: GameState) {
  const level = gs.level;
  const portfolioDisplay = Math.floor(
    gs.portfolioValue * gs.portfolioMultiplier,
  );
  const saltPct = gs.saltMeter / 100;

  // === PIXEL-ART RETRO BORDER for HUD ===
  // Outer dark frame
  ctx.fillStyle = "#050510";
  ctx.fillRect(0, 0, CANVAS_W, 50);
  // Inner bright line (2px)
  ctx.strokeStyle = "#3a3a6a";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, CANVAS_W - 2, 48);
  // Outer bright line (1px)
  ctx.strokeStyle = "#1a1a3a";
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, CANVAS_W, 50);
  // Corner pixel accents
  ctx.fillStyle = "#5555aa";
  ctx.fillRect(0, 0, 4, 4);
  ctx.fillRect(CANVAS_W - 4, 0, 4, 4);
  ctx.fillRect(0, 46, 4, 4);
  ctx.fillRect(CANVAS_W - 4, 46, 4, 4);

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
  // Portfolio ticker flash effect
  if (gs.portfolioTickerFlash > 0) {
    ctx.fillStyle = gs.portfolioTickerDir === 1 ? "#00ff88" : "#ff4444";
    ctx.shadowColor = gs.portfolioTickerDir === 1 ? "#00ff44" : "#ff0000";
    ctx.shadowBlur = 10;
  } else if (portfolioDisplay < 10000) {
    ctx.fillStyle = "#ff4444";
    ctx.shadowColor = "#ff0000";
    ctx.shadowBlur = 6;
  } else if (portfolioDisplay < 50000) {
    ctx.fillStyle = "#ffd700";
    ctx.shadowColor = "#ffaa00";
    ctx.shadowBlur = 5;
  } else {
    ctx.fillStyle = "#81c784";
    ctx.shadowColor = "#00ff44";
    ctx.shadowBlur = 5;
  }
  ctx.fillText(`$${portfolioDisplay.toLocaleString()}`, 116, 35);
  ctx.shadowBlur = 0;

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

  // Border - glow red when critical with pulse
  if (saltPct > 0.8) {
    ctx.shadowColor = "#ff0000";
    ctx.shadowBlur = 4 + Math.sin(gs.frameCount * 0.2) * 3;
    ctx.strokeStyle = "#ff4400";
    ctx.lineWidth = 2;
  } else {
    ctx.strokeStyle = "#555555";
    ctx.lineWidth = 1;
  }
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

  // Unified weapon timer bar
  if (
    gs.currentWeapon &&
    gs.currentWeapon !== "dynamite" &&
    gs.currentWeapon !== "hardhat"
  ) {
    const wTimerMax = 600;
    const wPct = Math.min(1, gs.weaponTimer / wTimerMax);
    const wBarX = 430;
    const wBarY = 4;
    const wBarW = 12;
    const wBarH = 42;
    const wNearExp = gs.weaponTimer < 120;
    const wVisible =
      gs.weaponTimer > 120 || Math.floor(gs.weaponTimer / 10) % 2 === 0;
    if (wVisible) {
      ctx.fillStyle = "#111111";
      ctx.fillRect(wBarX - 1, wBarY - 1, wBarW + 2, wBarH + 2);
      const wColors: Record<string, [string, string]> = {
        pickaxe: ["#ffd700", "#ff9800"],
        gun: ["#00ff88", "#00ccff"],
        saltshaker: ["#88ddff", "#aaeeff"],
      };
      const [c1, c2] = wColors[gs.currentWeapon] || ["#ffffff", "#aaaaaa"];
      const wGrad = ctx.createLinearGradient(
        wBarX,
        wBarY + wBarH,
        wBarX,
        wBarY,
      );
      wGrad.addColorStop(0, c1);
      wGrad.addColorStop(1, c2);
      const wFillH = wBarH * wPct;
      ctx.fillStyle = wGrad;
      if (wFillH > 0)
        ctx.fillRect(wBarX, wBarY + wBarH - wFillH, wBarW, wFillH);
      if (wNearExp) {
        ctx.shadowColor = "#ff2200";
        ctx.shadowBlur = 3 + Math.sin(gs.frameCount * 0.3) * 2;
        ctx.strokeStyle = "#ff4400";
      } else {
        ctx.strokeStyle = c1;
      }
      ctx.lineWidth = 1;
      ctx.strokeRect(wBarX, wBarY, wBarW, wBarH);
      ctx.shadowBlur = 0;
      const wLabels: Record<string, string> = {
        pickaxe: "AXE",
        gun: "GUN",
        saltshaker: "SALT",
      };
      ctx.font = "5px monospace";
      ctx.fillStyle = c1;
      ctx.textAlign = "center";
      ctx.fillText(
        wLabels[gs.currentWeapon] || "WPN",
        wBarX + wBarW / 2,
        wBarY + wBarH + 8,
      );
      ctx.textAlign = "left";
    }
  }
  // Hard hat / dynamite icons (use-based weapons)
  if (gs.currentWeapon === "hardhat") {
    ctx.save();
    ctx.shadowColor = "#ffdd00";
    ctx.shadowBlur = 8;
    ctx.font = "bold 8px monospace";
    ctx.fillStyle = "#ffdd00";
    ctx.textAlign = "right";
    ctx.fillText("🪖 HAT", 470, 20);
    ctx.textAlign = "left";
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  if (gs.currentWeapon === "dynamite") {
    ctx.save();
    ctx.shadowColor = "#ff4400";
    ctx.shadowBlur = 8;
    ctx.font = "bold 8px monospace";
    ctx.fillStyle = "#ff6600";
    ctx.textAlign = "right";
    ctx.fillText("💣 TNT", 470, 20);
    ctx.textAlign = "left";
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  // Power-up icon row
  let puX = 380;
  const puY = 4;
  if (gs.hasBubble) {
    ctx.save();
    ctx.shadowColor = "#88ddff";
    ctx.shadowBlur = 6;
    ctx.font = "bold 7px monospace";
    ctx.fillStyle = "#88ddff";
    ctx.fillText("🫧", puX, puY + 12);
    ctx.shadowBlur = 0;
    ctx.restore();
    puX -= 18;
  }
  if (gs.speedBootsTimer > 0) {
    const sbFlash =
      gs.speedBootsTimer < 120 && Math.floor(gs.speedBootsTimer / 8) % 2 === 0;
    if (!sbFlash) {
      ctx.save();
      ctx.shadowColor = "#ff9900";
      ctx.shadowBlur = 6;
      ctx.font = "bold 7px monospace";
      ctx.fillStyle = "#ff9900";
      ctx.fillText("⚡", puX, puY + 12);
      ctx.shadowBlur = 0;
      ctx.restore();
      puX -= 18;
    }
  }
  if (gs.magnetTimer > 0) {
    const magFlash =
      gs.magnetTimer < 120 && Math.floor(gs.magnetTimer / 8) % 2 === 0;
    if (!magFlash) {
      ctx.save();
      ctx.shadowColor = "#cc44ff";
      ctx.shadowBlur = 6;
      ctx.font = "bold 7px monospace";
      ctx.fillStyle = "#cc44ff";
      ctx.fillText("🧲", puX, puY + 12);
      ctx.shadowBlur = 0;
      ctx.restore();
      puX -= 18;
    }
  }
  if (gs.portfolioShieldTimer > 0) {
    const psFlash =
      gs.portfolioShieldTimer < 120 &&
      Math.floor(gs.portfolioShieldTimer / 8) % 2 === 0;
    if (!psFlash) {
      ctx.save();
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = 6;
      ctx.font = "bold 7px monospace";
      ctx.fillStyle = "#ffd700";
      ctx.fillText("🛡", puX, puY + 12);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
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

function renderGame(
  ctx: CanvasRenderingContext2D,
  gs: GameState,
  liteMode = false,
) {
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

  // Screen shake - ALWAYS save to keep stack balanced
  ctx.save();
  if (gs.screenShake > 0) {
    const shakeAmt = gs.screenShake * 0.8;
    ctx.translate(
      (Math.random() - 0.5) * shakeAmt,
      (Math.random() - 0.5) * shakeAmt,
    );
  }

  drawBackground(ctx, gs.level, gs.frameCount, liteMode);

  // Draw ambient atmosphere particles
  for (const ap of gs.ambientParticles) {
    ctx.globalAlpha = ap.alpha;
    if (ap.type === "dust") {
      ctx.fillStyle = "#ccbbaa";
      ctx.fillRect(ap.x, ap.y, ap.size || 2, ap.size || 2);
    } else if (ap.type === "drip") {
      ctx.fillStyle = "#6699ff";
      ctx.fillRect(ap.x, ap.y, 2, ap.size || 4);
    } else if (ap.type === "ember") {
      ctx.fillStyle = `hsl(${20 + Math.random() * 40}, 100%, 60%)`;
      ctx.beginPath();
      ctx.arc(ap.x, ap.y, ap.size || 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (ap.type === "ash") {
      ctx.fillStyle = "#aaaaaa";
      ctx.fillRect(ap.x, ap.y, ap.size || 2, 1);
    }
    ctx.globalAlpha = 1;
  }

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
      gs.level,
    );
  }

  // Exit portal
  const exit = level.exitPosition;
  drawExit(ctx, exit.x, exit.y, gs.frameCount);

  // Water Bottles
  for (const wb of gs.waterBottles) {
    if (!wb.collected) {
      ctx.save();
      ctx.shadowColor = "#66ddff";
      ctx.shadowBlur = 10 + Math.sin(Date.now() * 0.005) * 4;
      drawWaterBottle(ctx, wb.x, wb.y, gs.frameCount);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
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
    if (!mb.collected) {
      ctx.save();
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = 6 + Math.sin(Date.now() * 0.008 + mb.id) * 4;
      drawMaturityBag(ctx, mb.x, mb.y, mb.lifetime, mb.maxLifetime, mb.amount);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }
  // Community bags
  for (const cb of gs.communityBags) {
    if (!cb.collected) {
      ctx.save();
      // Gold pulsing aura
      const pulseR = 14 + Math.sin(Date.now() * 0.005) * 4;
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(cb.x + 11, cb.y + 13, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,215,0,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
      drawCommunityBag(ctx, cb.x, cb.y, cb.lifetime);
    }
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
    const alpha = ft.timer < 30 ? ft.timer / 30 : 1;
    const scale =
      ft.timer > 75 ? 1.5 - ((1 - ft.timer / 90) * 0.5) / (15 / 90) : 1.0;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = ft.color;
    ctx.shadowBlur =
      ft.color === "#ffd700"
        ? 10
        : ft.color === "#ff4444"
          ? 8
          : ft.color === "#00ff88"
            ? 10
            : 6;
    const fontSize = ft.text.length > 20 ? 8 : 10;
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillStyle = ft.color;
    ctx.textAlign = "center";
    ctx.save();
    ctx.translate(ft.x, ft.y);
    ctx.scale(scale, scale);
    ctx.fillText(ft.text, 0, 0);
    ctx.restore();
    ctx.textAlign = "left";
    ctx.restore();
  }

  // Spawned pickups
  for (const sp2 of gs.spawnedPickups) {
    if (!sp2.collected) drawSpawnedPickup(ctx, sp2, gs.frameCount);
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
    gs.bearTauntTimer,
    gs.bearStunTimer,
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

  // Dust particles
  for (const dp of gs.dustParticles) {
    ctx.save();
    ctx.globalAlpha = dp.alpha * 0.75;
    ctx.fillStyle = "#c8b090";
    ctx.fillRect(dp.x - dp.size / 2, dp.y - dp.size / 2, dp.size, dp.size);
    ctx.restore();
  }
  // Spark particles
  for (const sp2 of gs.sparkParticles) {
    ctx.save();
    ctx.globalAlpha = sp2.alpha;
    ctx.shadowColor = sp2.color;
    ctx.shadowBlur = 5;
    ctx.fillStyle = sp2.color;
    ctx.fillRect(sp2.x - 2, sp2.y - 2, 4, 4);
    ctx.restore();
  }
  // Coin particles
  for (const cp of gs.coinParticles) {
    ctx.save();
    ctx.globalAlpha = cp.alpha;
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 5;
    ctx.fillStyle = "#ffd700";
    ctx.fillRect(cp.x - 2, cp.y - 2, 5, 5);
    ctx.fillStyle = "#ffee88";
    ctx.fillRect(cp.x - 1, cp.y - 1, 2, 2);
    ctx.restore();
  }

  // Dynamites in flight
  for (const dyn of gs.dynamites) {
    drawDynamiteInFlight(ctx, dyn, gs.frameCount);
  }

  // Player
  drawPlayer(
    ctx,
    gs.player,
    gs.saltMeter,
    gs.currentWeapon,
    gs.weaponTimer,
    gs.dyingTimer,
    gs.hasBubble,
    gs.speedBootsTimer,
    gs.magnetTimer,
    gs.portfolioShieldTimer,
    liteMode,
  );

  // Level transition - dramatic wipe with scanline bars
  if (gs.levelTransitionAlpha > 0) {
    const palette = LEVEL_PALETTES[gs.level % LEVEL_PALETTES.length];
    ctx.save();
    const barCount = 6;
    const barH = CANVAS_H / barCount;
    for (let bi = 0; bi < barCount; bi++) {
      // Stagger each bar's alpha slightly
      const barAlpha = Math.min(
        1,
        gs.levelTransitionAlpha * (1 + (bi % 3) * 0.15),
      );
      ctx.globalAlpha = barAlpha;
      ctx.fillStyle = palette.flashColor;
      ctx.fillRect(0, bi * barH, CANVAS_W, barH);
      // Bright scan line at leading edge
      if (barAlpha > 0.3) {
        ctx.globalAlpha = barAlpha * 0.8;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, bi * barH, CANVAS_W, 2);
      }
    }
    ctx.restore();
  }

  // Vignette when salt meter critical
  if (gs.saltMeter >= 80) {
    const vigAlpha = ((gs.saltMeter - 80) / 20) * 0.5;
    const grad = ctx.createRadialGradient(240, 320, 100, 240, 320, 340);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(60,0,0,${vigAlpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 480, 640);
  }

  // Red damage flash
  if (gs.damageFlashTimer > 0) {
    ctx.globalAlpha = (gs.damageFlashTimer / 10) * 0.4;
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(0, 0, 480, 640);
    ctx.globalAlpha = 1;
  }

  // Green portfolio boost flash
  if (gs.portfolioFlashGreenTimer > 0) {
    ctx.globalAlpha = (gs.portfolioFlashGreenTimer / 12) * 0.25;
    ctx.fillStyle = "#00ff88";
    ctx.fillRect(0, 0, 480, 640);
    ctx.globalAlpha = 1;
  }

  // End screen shake transform - ALWAYS restore to match unconditional save above
  ctx.restore();

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
  currentWeapon:
    | "pickaxe"
    | "gun"
    | "dynamite"
    | "saltshaker"
    | "hardhat"
    | null;
  weaponTimer: number;
  hasBubble: boolean;
  speedBootsTimer: number;
  magnetTimer: number;
  portfolioShieldTimer: number;
  bottlesLeft: number;
  totalBottles: number;
  portfolioMultiplier: number;
}

export default function Game() {
  const liteModeRef = useRef(
    /Tesla|QtWebEngine|CrMo/.test(navigator.userAgent),
  );
  const liteMode = liteModeRef.current;
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
    currentWeapon: null,
    weaponTimer: 0,
    weaponSpawnTimer: 60,
    spawnedPickups: [],
    nextPickupId: 1,
    dynamites: [],
    nextDynamiteId: 1,
    hasBubble: false,
    speedBootsTimer: 0,
    magnetTimer: 0,
    portfolioShieldTimer: 0,
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
    gunCooldown: 0,
    bullets: [],
    nextBulletId: 1,
    explosionProjectiles: [],
    nextExplosionId: 1,
    dustParticles: [],
    sparkParticles: [],
    coinParticles: [],
    screenShake: 0,
    portfolioTickerFlash: 0,
    portfolioTickerDir: 1 as 1 | -1,
    bearTauntTimer: 0,
    damageFlashTimer: 0,
    portfolioFlashGreenTimer: 0,
    ambientParticles: [],
    bearStunTimer: 0,
    bearRageCount: 0,
    convictionCombo: 0,
    comboTimer: 0,
    hodlerStreak: 0,
    dodgeStreak: 0,
    nearMissTimer: 0,
    dodgeBoostTimer: 0,
    levelDeaths: 0,
    saltFillReduction: 0,
  });
  const rafRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
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
    currentWeapon: null,
    weaponTimer: 0,
    hasBubble: false,
    speedBootsTimer: 0,
    magnetTimer: 0,
    portfolioShieldTimer: 0,
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
    gs.currentWeapon = null;
    gs.weaponTimer = 0;
    gs.weaponSpawnTimer = 60;
    gs.spawnedPickups = [];
    gs.nextPickupId = 1;
    gs.dynamites = [];
    gs.nextDynamiteId = 1;
    gs.hasBubble = false;
    gs.speedBootsTimer = 0;
    gs.magnetTimer = 0;
    gs.portfolioShieldTimer = 0;
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
    gs.bearTauntTimer = 0;
    gs.damageFlashTimer = 0;
    gs.portfolioFlashGreenTimer = 0;
    gs.ambientParticles = [];
    gs.bearStunTimer = 0;
    gs.bearRageCount = 0;
    gs.convictionCombo = 0;
    gs.comboTimer = 0;
    gs.hodlerStreak = 0;
    gs.dodgeStreak = 0;
    gs.nearMissTimer = 0;
    gs.dodgeBoostTimer = 0;
    gs.levelDeaths = 0;
    gs.saltFillReduction = 0;
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
      if (liteModeRef.current) {
        const now = performance.now();
        if (now - lastFrameTimeRef.current < 33) {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        lastFrameTimeRef.current = now;
      }
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
      renderGame(ctx, gs, liteModeRef.current);
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
      const hasWeapon = gs.currentWeapon !== null;
      if (hasWeapon !== hasAxeDisplayRef.current) {
        hasAxeDisplayRef.current = hasWeapon;
        setHasAxeDisplay(hasWeapon);
      }
      const isGun = gs.currentWeapon === "gun";
      if (isGun !== hasGunDisplayRef.current) {
        hasGunDisplayRef.current = isGun;
        setHasGunDisplay(isGun);
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
          currentWeapon: gs.currentWeapon,
          weaponTimer: gs.weaponTimer,
          hasBubble: gs.hasBubble,
          speedBootsTimer: gs.speedBootsTimer,
          magnetTimer: gs.magnetTimer,
          portfolioShieldTimer: gs.portfolioShieldTimer,
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

        {/* Weapon timer bar */}
        {hudData.currentWeapon &&
          hudData.currentWeapon !== "dynamite" &&
          hudData.currentWeapon !== "hardhat" && (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 9 }}>
                {hudData.currentWeapon === "pickaxe"
                  ? "⛏"
                  : hudData.currentWeapon === "gun"
                    ? "🔫"
                    : hudData.currentWeapon === "saltshaker"
                      ? "🧂"
                      : "🔧"}
              </span>
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
                    width: `${Math.min(100, (hudData.weaponTimer / 600) * 100)}%`,
                    height: "100%",
                    background:
                      hudData.weaponTimer < 120
                        ? Math.floor(Date.now() / 200) % 2 === 0
                          ? "#ffd700"
                          : "#ff4444"
                        : hudData.currentWeapon === "gun"
                          ? "#00ff88"
                          : hudData.currentWeapon === "saltshaker"
                            ? "#88ddff"
                            : "#ffd700",
                  }}
                />
              </div>
            </div>
          )}
        {/* Use-based weapon icons */}
        {hudData.currentWeapon === "dynamite" && (
          <span style={{ fontSize: 9, color: "#ff6600" }}>💣 TNT</span>
        )}
        {hudData.currentWeapon === "hardhat" && (
          <span style={{ fontSize: 9, color: "#ffdd00" }}>🪖 HAT</span>
        )}
        {/* Power-up icons */}
        {hudData.hasBubble && <span style={{ fontSize: 9 }}>🫧</span>}
        {hudData.speedBootsTimer > 0 && (
          <span
            style={{
              fontSize: 9,
              color: "#ff9900",
              opacity: hudData.speedBootsTimer < 120 ? 0.5 : 1,
            }}
          >
            ⚡
          </span>
        )}
        {hudData.magnetTimer > 0 && (
          <span
            style={{
              fontSize: 9,
              color: "#cc44ff",
              opacity: hudData.magnetTimer < 120 ? 0.5 : 1,
            }}
          >
            🧲
          </span>
        )}
        {hudData.portfolioShieldTimer > 0 && (
          <span
            style={{
              fontSize: 9,
              color: "#ffd700",
              opacity: hudData.portfolioShieldTimer < 120 ? 0.5 : 1,
            }}
          >
            🛡
          </span>
        )}

        {liteMode && (
          <div
            style={{
              color: "#888",
              fontSize: 9,
              marginLeft: "auto",
              marginRight: 4,
            }}
          >
            LITE
          </div>
        )}
        {/* SFX controls (right-aligned) */}
        <div
          style={{
            marginLeft: liteMode ? undefined : "auto",
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
                {hasGunDisplay ? "🔫" : hasAxeDisplay ? "⛏" : "B"}
              </span>
              <span aria-hidden>
                {hasAxeDisplay || hasGunDisplay ? "B" : ""}
              </span>
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
