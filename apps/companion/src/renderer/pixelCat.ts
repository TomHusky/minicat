import type { AnimalType } from '@agentpet/protocol';

export type PetAnimationState = 'sitting' | 'walking' | 'resting' | 'working' | 'completed' | 'failed';

/**
 * Sprite sheet layout for ikun (192x208 per frame, 8 columns, 9 rows):
 *   Row 0: 待机 (idle) - 6 frames
 *   Row 1: 向右跑 (run right) - 8 frames
 *   Row 2: 向左跑 (run left) - 8 frames
 *   Row 3: 挥手 (wave) - 4 frames
 *   Row 4: 跳跃 (jump) - 5 frames
 *   Row 5: 失败 (fail) - 8 frames
 *   Row 6: 等待 (wait) - 6 frames
 *   Row 7: 奔跑 (sprint) - 6 frames
 *   Row 8: 审视 (stare) - 6 frames
 */

const FRAME_WIDTH = 192;
const FRAME_HEIGHT = 208;
const COLS = 8;

interface AnimationDef {
  row: number;
  frames: number;
  duration: number; // ms for full cycle
}

const ANIMATIONS: Record<string, AnimationDef> = {
  idle:      { row: 0, frames: 6, duration: 1100 },
  runRight:  { row: 1, frames: 8, duration: 1060 },
  runLeft:   { row: 2, frames: 8, duration: 1060 },
  wave:      { row: 3, frames: 4, duration: 700 },
  jump:      { row: 4, frames: 5, duration: 840 },
  fail:      { row: 5, frames: 8, duration: 1220 },
  wait:      { row: 6, frames: 6, duration: 1010 },
  sprint:    { row: 7, frames: 6, duration: 820 },
  stare:     { row: 8, frames: 6, duration: 1030 },
};

const STATE_TO_ANIM: Record<PetAnimationState, string> = {
  sitting: 'idle',
  walking: 'runRight',
  resting: 'wait',
  working: 'sprint',
  completed: 'wave',
  failed: 'fail',
};

const DISPLAY_SIZE = { width: 200, height: 90 };
const SPRITE_SIZE = 90; // actual sprite render size
const WALK_RANGE = 50; // pixels of horizontal travel each direction from center
const WALK_SPEED = 0.04; // pixels per ms (~40px/s)

export class PetAnimator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private frameHandle: number | null = null;
  private running = false;
  private elapsed = 0;
  private lastTimestamp = 0;
  private state: PetAnimationState = 'sitting';
  private facingRight = true;
  private sprite: HTMLImageElement | null = null;
  private spriteLoaded = false;
  private animal: AnimalType = 'cat';
  private walkOffset = 0;
  private walkDirection = 1; // 1 = right, -1 = left
  private isWandering = false;
  private wanderTimer: number | null = null;
  private wanderEndTimer: number | null = null;

  constructor(canvas: HTMLCanvasElement, animal: AnimalType = 'cat') {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is required.');
    }

    this.canvas = canvas;
    this.ctx = ctx;
    this.animal = animal;
    this.loadSprite();
    this.resize();
  }

  private loadSprite() {
    const img = new Image();
    img.onload = () => {
      this.spriteLoaded = true;
      this.draw();
    };
    img.src = './ikun-sprite.webp';
    this.sprite = img;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = 0;
    this.frameHandle = requestAnimationFrame(this.loop);
    this.scheduleWander();
  }

  stop() {
    this.running = false;
    if (this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }

  setState(nextState: PetAnimationState) {
    if (nextState !== 'walking' && this.isWandering) {
      this.isWandering = false;
    }
    this.state = nextState;
    this.scheduleWander();
  }

  private scheduleWander() {
    if (this.wanderTimer !== null) {
      clearTimeout(this.wanderTimer);
      this.wanderTimer = null;
    }
    if (this.wanderEndTimer !== null) {
      clearTimeout(this.wanderEndTimer);
      this.wanderEndTimer = null;
    }
    // Only wander during idle states
    if (this.state !== 'sitting' && this.state !== 'resting') return;
    const delay = 3000 + Math.random() * 7000; // 3-10s
    this.wanderTimer = window.setTimeout(() => {
      if (this.state !== 'sitting' && this.state !== 'resting') return;
      this.isWandering = true;
      // Walk for 2.5-5 seconds
      const duration = 2500 + Math.random() * 2500;
      this.wanderEndTimer = window.setTimeout(() => {
        this.isWandering = false;
        this.scheduleWander();
      }, duration);
    }, delay);
  }

  setFacingRight(nextFacingRight: boolean) {
    this.facingRight = nextFacingRight;
  }

  setAnimal(nextAnimal: AnimalType) {
    this.animal = nextAnimal;
    this.spriteLoaded = false;
    this.loadSprite();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(DISPLAY_SIZE.width * dpr);
    this.canvas.height = Math.round(DISPLAY_SIZE.height * dpr);
    this.canvas.style.width = `${DISPLAY_SIZE.width}px`;
    this.canvas.style.height = `${DISPLAY_SIZE.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  private loop = (timestamp: number) => {
    if (!this.running) return;

    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
    }

    const delta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.elapsed += delta;

    // Update walk position
    if (this.state === 'walking' || this.isWandering) {
      this.walkOffset += this.walkDirection * WALK_SPEED * delta;
      if (this.walkOffset > WALK_RANGE) {
        this.walkOffset = WALK_RANGE;
        this.walkDirection = -1;
        this.facingRight = false;
      } else if (this.walkOffset < -WALK_RANGE) {
        this.walkOffset = -WALK_RANGE;
        this.walkDirection = 1;
        this.facingRight = true;
      }
    } else {
      // Gradually return to center when not walking
      if (Math.abs(this.walkOffset) > 1) {
        this.walkOffset *= 0.95;
      } else {
        this.walkOffset = 0;
      }
    }

    this.draw();
    this.frameHandle = requestAnimationFrame(this.loop);
  };

  private getAnimation(): AnimationDef {
    // Wandering uses run animation
    if (this.isWandering) {
      return this.facingRight ? ANIMATIONS.runRight : ANIMATIONS.runLeft;
    }
    const animKey = STATE_TO_ANIM[this.state];
    // For walking, use direction based on current walk direction
    if (this.state === 'walking') {
      return this.facingRight ? ANIMATIONS.runRight : ANIMATIONS.runLeft;
    }
    return ANIMATIONS[animKey];
  }

  private draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, DISPLAY_SIZE.width, DISPLAY_SIZE.height);

    if (!this.spriteLoaded || !this.sprite) return;

    const anim = this.getAnimation();
    const frameIndex = Math.floor((this.elapsed % anim.duration) / (anim.duration / anim.frames)) % anim.frames;

    const sx = frameIndex * FRAME_WIDTH;
    const sy = anim.row * FRAME_HEIGHT;

    ctx.save();

    // Horizontal position: center + walkOffset
    const centerX = DISPLAY_SIZE.width / 2;
    const drawX = centerX + this.walkOffset - SPRITE_SIZE / 2;

    // Running animations (Row 1/2) already have correct direction built in
    // Only flip for non-running states
    const isRunning = this.isWandering || this.state === 'walking';
    if (!isRunning && !this.facingRight) {
      ctx.translate(drawX + SPRITE_SIZE, 0);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(drawX, 0);
    }

    // Scale sprite frame to fit SPRITE_SIZE
    const scale = Math.min(SPRITE_SIZE / FRAME_WIDTH, SPRITE_SIZE / FRAME_HEIGHT);
    const drawW = FRAME_WIDTH * scale;
    const drawH = FRAME_HEIGHT * scale;
    const offsetX = (SPRITE_SIZE - drawW) / 2;
    const offsetY = SPRITE_SIZE - drawH;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.sprite,
      sx, sy, FRAME_WIDTH, FRAME_HEIGHT,
      offsetX, offsetY, drawW, drawH
    );

    ctx.restore();
  }
}
