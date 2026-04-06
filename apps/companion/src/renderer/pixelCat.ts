import type { AnimalType } from '@agentpet/protocol';

export type PetAnimationState = 'sitting' | 'walking' | 'resting';

interface Colors {
  body: string;
  dark: string;
  light: string;
  line: string;
  accent: string;
  shadow: string;
}

const SIZE = {
  width: 180,
  height: 140,
};

const PALETTES: Record<AnimalType, Colors> = {
  cat: {
    body: '#0f0f0f',
    dark: '#000000',
    light: '#2a2a2a',
    line: '#e6e6e6',
    accent: '#d32f2f',
    shadow: 'rgba(0, 0, 0, 0.15)',
  },
  lobster: {
    body: '#f0633c',
    dark: '#c84828',
    light: '#ffb37d',
    line: '#822c1f',
    accent: '#ffd1b6',
    shadow: 'rgba(120, 48, 34, 0.18)',
  },
};

export class PetAnimator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private frameHandle: number | null = null;
  private running = false;
  private elapsed = 0;
  private lastTimestamp = 0;
  private state: PetAnimationState = 'sitting';
  private facingRight = true;
  private animal: AnimalType = 'cat';

  constructor(canvas: HTMLCanvasElement, animal: AnimalType = 'cat') {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is required.');
    }

    this.canvas = canvas;
    this.ctx = ctx;
    this.animal = animal;
    this.resize();
    this.draw();
  }

  start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.lastTimestamp = 0;
    this.frameHandle = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }

  setState(nextState: PetAnimationState) {
    this.state = nextState;
  }

  setFacingRight(nextFacingRight: boolean) {
    this.facingRight = nextFacingRight;
  }

  setAnimal(nextAnimal: AnimalType) {
    this.animal = nextAnimal;
    this.draw();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(SIZE.width * dpr);
    this.canvas.height = Math.round(SIZE.height * dpr);
    this.canvas.style.width = `${SIZE.width}px`;
    this.canvas.style.height = `${SIZE.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  private get colors() {
    return PALETTES[this.animal];
  }

  private loop = (timestamp: number) => {
    if (!this.running) {
      return;
    }

    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
    }

    const delta = Math.min((timestamp - this.lastTimestamp) / 1000, 0.05);
    this.lastTimestamp = timestamp;
    this.elapsed += delta;

    this.draw();
    this.frameHandle = requestAnimationFrame(this.loop);
  };

  private draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SIZE.width, SIZE.height);
    ctx.save();

    if (!this.facingRight) {
      ctx.translate(SIZE.width, 0);
      ctx.scale(-1, 1);
    }

    if (this.animal === 'lobster') {
      ctx.translate(95, 118);
      ctx.scale(0.88, 0.88);
      ctx.translate(-95, -118);
    } else {
      ctx.translate(90, 118);
      ctx.scale(0.9, 0.9);
      ctx.translate(-90, -118);
    }

    if (this.animal === 'lobster') {
      this.drawLobster();
    } else {
      this.drawCat();
    }

    ctx.restore();
  }

  private drawCat() {
    if (this.state === 'walking') {
      this.drawCatWalking();
    } else if (this.state === 'resting') {
      this.drawCatResting();
    } else {
      this.drawCatSitting();
    }
  }

  private drawLobster() {
    if (this.state === 'walking') {
      this.drawLobsterWalking();
    } else if (this.state === 'resting') {
      this.drawLobsterResting();
    } else {
      this.drawLobsterSitting();
    }
  }

  private drawCatSitting() {
    const ctx = this.ctx;
    const sway = Math.sin(this.elapsed * 1.6) * 5;
    const blinkPhase = this.elapsed % 5;
    const blink = blinkPhase > 4.68;

    this.drawShadow(90, 120, 36, 8);
    this.drawCatCurlyTail(105, 114, sway);

    ctx.save();
    ctx.translate(0, Math.sin(this.elapsed * 1.4) * 1.5);
    this.drawCatTallBody(90, 86, 26, 45);
    this.drawCatSittingPaws(80, 118, 20);
    this.drawCatCollar(90, 50, 0);
    this.drawCatHead(90, 34, { eyesClosed: blink, smile: false });
    ctx.restore();
  }

  private drawCatWalking() {
    const ctx = this.ctx;
    const pace = this.elapsed * 6.5;
    const bob = Math.sin(pace) * 3;
    const diagonalA = Math.sin(pace) * 10;
    const diagonalB = Math.sin(pace + Math.PI) * 10;
    const tailJitter = Math.sin(this.elapsed * 16) * 3;

    this.drawShadow(98, 118, 37, 8);
    this.drawTail(125, 86 + bob, 10, -40, tailJitter, 0.28, this.colors.body, this.colors.body, 10);

    ctx.save();
    ctx.translate(0, bob);
    this.drawCatWalkingLeg(74, 90, diagonalA);
    this.drawCatWalkingLeg(92, 90, diagonalB);
    this.drawCatWalkingLeg(108, 90, diagonalA);
    this.drawCatWalkingLeg(124, 90, diagonalB);
    this.drawCatHorizontalBody(101, 80, 34, 24);
    this.drawCatCollar(70, 70, Math.sin(pace) * 0.05 + 0.5);
    this.drawCatHead(64, 56, { eyesClosed: false, smile: false, tilt: Math.sin(pace) * 0.05 });
    ctx.restore();
  }

  private drawCatResting() {
    const ctx = this.ctx;
    const breathe = 1 + Math.sin(this.elapsed * 1.8) * 0.04;
    const headLift = Math.sin(this.elapsed * 1.8) * 1.5;

    this.drawShadow(90, 118, 39, 9);

    ctx.save();
    ctx.translate(0, 2);
    this.drawCurledTail(116, 95, 20, 16, this.colors.body, this.colors.body);
    this.drawCatRestingBody(92, 98, 40, 18, breathe);
    this.drawCatHead(64, 88 - headLift, { eyesClosed: true, smile: false, sleepy: true, tilt: -0.08 });
    ctx.restore();
  }

  private drawCatSleepingPaws(x: number, y: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    ctx.roundRect(x - 4, y - 2, 18, 10, 5);
    ctx.roundRect(x + 10, y, 18, 10, 5);
    ctx.fill();
    ctx.restore();
  }

  private drawLobsterSitting() {
    const wiggle = Math.sin(this.elapsed * 1.5) * 2;
    const claw = Math.sin(this.elapsed * 1.7) * 0.1;

    this.drawShadow(94, 119, 28, 8);
    this.drawLobsterClaw(64, 86, -0.25 + claw, false);
    this.drawLobsterClaw(108, 86, 0.25 - claw, true);
    this.drawLobsterBody(92, 88, 1);
    this.drawLobsterHead(92, 68, false);
    this.drawLobsterTail(92, 107, wiggle, 0.03);
    this.drawLobsterLegs(92, 105, 1, false);
    this.drawLobsterAntennae(92, 52, wiggle, false);
  }

  private drawLobsterWalking() {
    const pace = this.elapsed * 7;
    const bob = Math.sin(pace) * 2;
    const claw = Math.sin(pace) * 0.14;

    this.drawShadow(94, 119, 30, 8);
    this.drawLobsterClaw(64, 86 + bob, -0.35 + claw, false);
    this.drawLobsterClaw(108, 86 + bob, 0.35 - claw, true);
    this.drawLobsterBody(92, 88 + bob, 0.98);
    this.drawLobsterHead(92, 68 + bob, false);
    this.drawLobsterTail(92, 107 + bob, Math.sin(pace) * 2, 0.08);
    this.drawLobsterLegs(92, 105 + bob, Math.sin(pace) * 4, true);
    this.drawLobsterAntennae(92, 52 + bob, Math.sin(this.elapsed * 10) * 3, false);
  }

  private drawLobsterResting() {
    const breathe = 1 + Math.sin(this.elapsed * 1.6) * 0.03;
    const antennaDrop = Math.sin(this.elapsed * 1.6) * 1.2;

    this.drawShadow(94, 119, 29, 8);
    this.drawLobsterClaw(66, 91, -0.12, false);
    this.drawLobsterClaw(106, 91, 0.12, true);
    this.drawLobsterBody(92, 90, breathe);
    this.drawLobsterHead(92, 71, true);
    this.drawLobsterTail(92, 108, 0, 0.02);
    this.drawLobsterLegs(92, 107, 1, false);
    this.drawLobsterAntennae(92, 55, antennaDrop, true);
  }

  private drawShadow(x: number, y: number, rx: number, ry: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = this.colors.shadow;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawEllipseFill(x: number, y: number, rx: number, ry: number, color: string, rotation = 0) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawRoundedRect(x: number, y: number, width: number, height: number, radius: number, color: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
    ctx.restore();
  }

  private drawTail(
    baseX: number,
    baseY: number,
    riseX: number,
    riseY: number,
    sway: number,
    curl: number,
    mainColor: string,
    stripeColor: string,
    width = 13,
  ) {
    const ctx = this.ctx;
    const tipX = baseX + riseX + sway;
    const tipY = baseY + riseY;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.bezierCurveTo(baseX + 14, baseY - 8, baseX + riseX * 0.55, baseY + riseY * 0.55, tipX, tipY);
    ctx.stroke();

    ctx.strokeStyle = stripeColor;
    ctx.lineWidth = Math.max(4, width * 0.38);
    ctx.beginPath();
    ctx.moveTo(baseX + 6, baseY - 3);
    ctx.bezierCurveTo(baseX + 16, baseY - 8, baseX + riseX * 0.6, baseY + riseY * 0.58, tipX + curl * 18, tipY + 3);
    ctx.stroke();
    ctx.restore();
  }

  private drawCurledTail(x: number, y: number, rx: number, ry: number, mainColor: string, stripeColor: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 22, y - 10, x + 20, y + 20, x - 2, y + 18);
    ctx.stroke();

    ctx.strokeStyle = stripeColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(x + 4, y + 8, rx, ry, 0.35, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.restore();
  }

  private drawRestBody(
    x: number,
    y: number,
    width: number,
    height: number,
    breathe: number,
    bodyColor: string,
    darkColor: string,
    lightColor: string,
  ) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(x, y, width * breathe, height, 0.02, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.ellipse(x + 20, y - 4, 16, 10, 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = lightColor;
    ctx.beginPath();
    ctx.ellipse(x - 6, y + 4, width * 0.42 * breathe, height * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawCatBody(x: number, y: number, width: number, height: number, bellyScale: number) {
    // Left empty since it's not used directly anymore, replaced by drawCatTallBody, drawCatHorizontalBody, etc.
  }

  private drawCatTallBody(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    // Slim, tall body curves
    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    ctx.moveTo(-w, h);
    ctx.quadraticCurveTo(-w * 1.5, 0, -w * 0.4, -h); 
    ctx.lineTo(w * 0.4, -h);
    ctx.quadraticCurveTo(w * 1.5, 0, w, h); 
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private drawCatHorizontalBody(x: number, y: number, w: number, h: number) {
    this.drawEllipseFill(x, y, w, h, this.colors.body, 0);
  }

  private drawCatRestingBody(x: number, y: number, w: number, h: number, breathe: number) {
    const scaledH = h * breathe;
    const offset = h - scaledH;
    this.drawEllipseFill(x, y + offset, w, scaledH, this.colors.body, 0);
  }

  private drawCatCollar(x: number, y: number, rotation: number = 0) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Ribbon center
    ctx.fillStyle = this.colors.accent;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bow ties
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-8, 8);
    ctx.lineTo(-12, -2);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(8, 8);
    ctx.lineTo(12, -2);
    ctx.closePath();
    ctx.fill();

    // Center knot
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawCatHead(
    x: number,
    y: number,
    options: { eyesClosed: boolean; smile: boolean; sleepy?: boolean; tilt?: number },
  ) {
    const ctx = this.ctx;
    const tilt = options.tilt ?? 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    // Head base (more elegant, less round)
    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    ctx.moveTo(0, -22); 
    ctx.quadraticCurveTo(18, -22, 22, -4);
    ctx.quadraticCurveTo(24, 14, 0, 22);
    ctx.quadraticCurveTo(-24, 14, -22, -4);
    ctx.quadraticCurveTo(-18, -22, 0, -22);
    ctx.fill();

    // Ears (Pointed and tall)
    ctx.beginPath();
    ctx.moveTo(-16, -12);
    ctx.lineTo(-24, -36);
    ctx.lineTo(-4, -20);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(16, -12);
    ctx.lineTo(24, -36);
    ctx.lineTo(4, -20);
    ctx.closePath();
    ctx.fill();

    // Ear insides
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(-14, -14);
    ctx.lineTo(-20, -30);
    ctx.lineTo(-6, -18);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -14);
    ctx.lineTo(20, -30);
    ctx.lineTo(6, -18);
    ctx.closePath();
    ctx.fill();

    // Eyes
    if (options.eyesClosed) {
      ctx.strokeStyle = this.colors.line;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.quadraticCurveTo(-12, 3, -8, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.quadraticCurveTo(12, 3, 8, 0);
      ctx.stroke();
    } else {
      // Large circular eyes with white outlines
      ctx.fillStyle = '#000000'; // Pupil
      ctx.strokeStyle = '#ffffff'; // White rim
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(-12, 0, 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(12, 0, 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Highlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-13, -1.6, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(11, -1.6, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tiny pink nose
    ctx.fillStyle = '#e59fa2';
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(-2, 5);
    ctx.lineTo(2, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private drawCatSittingPaws(x: number, y: number, spread: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    ctx.roundRect(x - spread / 2 - 6, y - 4, 12, 20, 6);
    ctx.roundRect(x + spread / 2 - 6, y - 4, 12, 20, 6);
    ctx.fill();
    ctx.restore();
  }

  private drawCatSittingLegs(x: number, y: number, gap: number) {
    // left empty, using drawCatSittingPaws instead
  }

  private drawCatWalkingLeg(x: number, y: number, swing: number, front: boolean = true) {
    const ctx = this.ctx;
    const footY = y + 28 - Math.max(swing, 0) * 0.2;

    ctx.save();
    ctx.strokeStyle = this.colors.body;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + swing * 0.32, y + 13, x + swing, footY);
    ctx.stroke();

    ctx.fillStyle = this.colors.light;
    ctx.beginPath();
    ctx.roundRect(x + swing - 6, footY - 1, 12, 8, 4);
    ctx.fill();
    ctx.restore();
  }

  private drawCatCurlyTail(x: number, y: number, sway: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sway * 0.05);

    ctx.strokeStyle = this.colors.body;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(20, -10, 30, -60, 5, -50);
    ctx.bezierCurveTo(-15, -45, -5, -20, 10, -25);
    ctx.stroke();

    ctx.restore();
  }

  private drawLobsterTail(x: number, y: number, wag: number, spread: number) {  
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spread);
    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(-4, 8 + wag * 0.2);
    ctx.lineTo(0, 0);
    ctx.lineTo(4, 8 + wag * 0.2);
    ctx.lineTo(10, 0);
    ctx.lineTo(0, 14 + wag * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawLobsterBody(x: number, y: number, breathe: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    ctx.ellipse(x, y, 24 * breathe, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.colors.light;
    ctx.beginPath();
    ctx.ellipse(x, y + 5, 10 * breathe, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.colors.dark;
    ctx.beginPath();
    ctx.roundRect(x - 2, y + 16, 4, 10, 2);
    ctx.fill();
    ctx.restore();
  }

  private drawLobsterHead(x: number, y: number, eyesClosed: boolean) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = this.colors.line;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    if (eyesClosed) {
      ctx.beginPath();
      ctx.moveTo(-8, -2);
      ctx.lineTo(-3, -2);
      ctx.moveTo(3, -2);
      ctx.lineTo(8, -2);
      ctx.stroke();
    } else {
      this.drawDotLocal(-6, -2, 2.5, this.colors.line);
      this.drawDotLocal(6, -2, 2.5, this.colors.line);
    }

    ctx.restore();
  }

  private drawLobsterClaw(x: number, y: number, rotation: number, front: boolean) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    ctx.strokeStyle = this.colors.body;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(16, 0);
    ctx.stroke();

    ctx.fillStyle = front ? this.colors.dark : this.colors.body;
    ctx.beginPath();
    ctx.arc(22, -4, 8, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    ctx.moveTo(18, -2);
    ctx.lineTo(31, -12);
    ctx.lineTo(34, -4);
    ctx.lineTo(24, -1);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(18, 2);
    ctx.lineTo(31, 12);
    ctx.lineTo(34, 4);
    ctx.lineTo(24, 1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawLobsterLegs(x: number, y: number, swing: number, walking: boolean) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = this.colors.dark;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    for (let index = 0; index < 2; index += 1) {
      const offset = index === 0 ? -8 : 8;
      const phase = walking ? (index % 2 === 0 ? swing : -swing) : index === 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x + offset, y - 1);
      ctx.quadraticCurveTo(x + offset - 4, y + 6, x + offset - 8, y + 12 + phase * 0.15);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + offset, y - 1);
      ctx.quadraticCurveTo(x + offset + 4, y + 6, x + offset + 8, y + 12 - phase * 0.15);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawLobsterAntennae(x: number, y: number, sway: number, resting: boolean) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = this.colors.dark;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    const lift = resting ? 8 : 12;
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.quadraticCurveTo(x - 10, y - lift, x - 16 + sway * 0.4, y - lift - 4);
    ctx.moveTo(x + 6, y);
    ctx.quadraticCurveTo(x + 10, y - lift, x + 16 + sway * 0.4, y - lift - 4);
    ctx.stroke();
    ctx.restore();
  }

  private drawOpenEyeLocal(x: number, y: number, radius: number, pupilColor: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#fffdf9';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pupilColor;
    ctx.beginPath();
    ctx.arc(0, 1, radius * 0.56, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-1.4, -1.1, Math.max(1.2, radius * 0.24), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawWhiskersLocal(color: string) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-7, 8);
    ctx.lineTo(-20, 5);
    ctx.moveTo(-7, 11);
    ctx.lineTo(-21, 12);
    ctx.moveTo(7, 8);
    ctx.lineTo(20, 5);
    ctx.moveTo(7, 11);
    ctx.lineTo(21, 12);
    ctx.stroke();
  }

  private drawEllipseFillLocal(x: number, y: number, rx: number, ry: number, color: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawDotLocal(x: number, y: number, radius: number, color: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
