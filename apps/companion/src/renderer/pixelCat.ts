import type { AnimalType } from '@agentpet/protocol';

export type PetAnimationState = 'sitting' | 'walking' | 'resting' | 'working';

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

const FRAME_INTERVAL_MS = 1000 / 30;

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
    accent: '#ffe1cb',
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

    if (timestamp - this.lastTimestamp < FRAME_INTERVAL_MS) {
      this.frameHandle = requestAnimationFrame(this.loop);
      return;
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
    } else if (this.state === 'working') {
      this.drawCatWorking();
    } else if (this.state === 'resting') {
      this.drawCatResting();
    } else {
      this.drawCatSitting();
    }
  }

  private drawLobster() {
    if (this.state === 'walking') {
      this.drawLobsterWalking();
    } else if (this.state === 'working') {
      this.drawLobsterWorking();
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
    const pace = this.elapsed * 7.2;
    const strideFront = Math.sin(pace) * 12;
    const strideBack = Math.sin(pace + Math.PI) * 10;
    const liftFront = Math.max(0, Math.sin(pace + Math.PI / 2)) * 8;
    const liftBack = Math.max(0, Math.sin(pace + Math.PI / 2 + Math.PI)) * 7;
    const bob = Math.sin(pace * 2) * 1.8;
    const bodyTilt = Math.sin(pace) * 0.04;
    const bodyStretch = 1 + Math.sin(pace) * 0.04;
    const headNod = Math.sin(pace + 0.45) * 1.2;
    const tailSway = Math.sin(pace * 0.9 + 0.8) * 6;

    this.drawShadow(103, 118, 42, 8);
    this.drawTail(138, 82 + bob, 6, -42, tailSway, 0.26, this.colors.body, null, 8);

    ctx.save();
    ctx.translate(0, bob);
    this.drawCatWalkingLeg(87, 84, strideBack, liftBack, false);
    this.drawCatWalkingLeg(111, 85, strideFront, liftFront, true);
    this.drawCatWalkingLeg(129, 86, -strideBack * 0.9, Math.max(0, liftBack - 1.2), false);
    this.drawCatWalkingLeg(149, 87, -strideFront * 0.9, Math.max(0, liftFront - 1.2), true);
    this.drawCatWalkingBody(116, 79, 40 * bodyStretch, 20, bodyTilt);
    this.drawCatCollar(79, 68 + headNod * 0.16, bodyTilt + 0.28);
    this.drawCatWalkingHead(68, 58 + headNod, bodyTilt + 0.02);
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

  private drawCatWorking() {
    const ctx = this.ctx;
    const breathe = Math.sin(this.elapsed * 2.1) * 0.8;
    const typing = Math.sin(this.elapsed * 10.5);
    const pawLiftLeft = Math.max(0, typing) * 2.2;
    const pawLiftRight = Math.max(0, -typing) * 2.2;
    const headDip = Math.sin(this.elapsed * 2.8) * 0.9;
    const tailSway = Math.sin(this.elapsed * 2) * 3.4;

    this.drawShadow(92, 120, 46, 8);
    this.drawLaptop(92, 88, 92, 48, 0, '#6c7a89', '#18212c', '#8fe3ff');
    this.drawTail(58, 110, -8, -24, tailSway, 0.24, this.colors.body, this.colors.body, 7);

    ctx.save();
    ctx.translate(0, breathe * 0.45);
    this.drawCatWorkingBody(90, 95, 28, 32);
    this.drawCatWorkingBackHead(90, 66 + headDip);
    this.drawCatTypingPaw(106, 98 - pawLiftLeft, 11, 6, -0.1);
    this.drawCatTypingPaw(119, 99 - pawLiftRight, 11, 6, 0.08);
    this.drawCatTypingPaw(78, 115, 11, 7, 0.14);
    this.drawCatTypingPaw(95, 115, 11, 7, -0.06);
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
    const clawSwing = Math.sin(this.elapsed * 1.7) * 0.08;
    const eyeOpen = this.getLobsterBlinkOpen();
    const cx = 92;

    this.drawShadow(cx, 120, 30, 7);
    this.drawLobsterTailFan(cx, 124, wiggle);
    this.drawLobsterSegmentedBody(cx, 72, 1, true);
    this.drawLobsterSmallLegs(cx, 82, 0);
    this.drawLobsterArm(cx, 72, -1, clawSwing);
    this.drawLobsterArm(cx, 72, 1, -clawSwing);
    this.drawLobsterHead(cx, 56, eyeOpen);
    this.drawLobsterAntennae(cx, 42, wiggle, false);
  }

  private drawLobsterWalking() {
    const pace = this.elapsed * 7;
    const bob = Math.sin(pace) * 2;
    const clawSwing = Math.sin(pace) * 0.12;
    const eyeOpen = this.getLobsterBlinkOpen();
    const cx = 92;

    this.drawShadow(cx, 120, 32, 7);
    this.drawLobsterTailFan(cx, 124 + bob, Math.sin(pace) * 3);
    this.drawLobsterSegmentedBody(cx, 72 + bob, 0.98, true);
    this.drawLobsterSmallLegs(cx, 82 + bob, pace);
    this.drawLobsterArm(cx, 72 + bob, -1, clawSwing);
    this.drawLobsterArm(cx, 72 + bob, 1, -clawSwing);
    this.drawLobsterHead(cx, 56 + bob, eyeOpen);
    this.drawLobsterAntennae(cx, 42 + bob, Math.sin(this.elapsed * 10) * 3, false);
  }

  private drawLobsterResting() {
    const breathe = 1 + Math.sin(this.elapsed * 1.6) * 0.03;
    const antennaDrop = Math.sin(this.elapsed * 1.6) * 1.2;
    const cx = 92;

    this.drawShadow(cx, 120, 30, 7);
    this.drawLobsterTailFan(cx, 126, 0);
    this.drawLobsterSegmentedBody(cx, 72, breathe, true);
    this.drawLobsterSmallLegs(cx, 82, 0);
    this.drawLobsterArm(cx, 72, -1, 0);
    this.drawLobsterArm(cx, 72, 1, 0);
    this.drawLobsterHead(cx, 56, 0);
    this.drawLobsterAntennae(cx, 42, antennaDrop, true);
  }

  private drawLobsterWorking() {
    const typing = Math.sin(this.elapsed * 10);
    const clawLiftL = Math.max(0, typing) * 5;
    const clawLiftR = Math.max(0, -typing) * 5;
    const headDip = Math.sin(this.elapsed * 2.6) * 1;
    const breathe = Math.sin(this.elapsed * 2.2) * 0.4;
    const antennaSway = Math.sin(this.elapsed * 5) * 1.5;
    const cx = 92;

    this.drawShadow(cx, 120, 38, 7);
    // 加大电脑屏幕，宽高加倍
    this.drawLaptop(cx, 86, 110, 68, 0, '#7b8899', '#17202b', '#8fe3ff');
    
    // 钳子和手臂需要画在身体的底层（笔记本的上层），这样从背面看就被身体挡住了肩膀，而钳子落在屏幕前方
    this.drawLobsterTypingArm(cx - 14, 75 + breathe, clawLiftL, false);
    this.drawLobsterTypingArm(cx + 14, 75 + breathe, clawLiftR, true);

    this.drawLobsterTailFan(cx, 126 + breathe, Math.sin(this.elapsed * 4) * 1);
    this.drawLobsterSegmentedBody(cx, 72 + breathe, 0.9, false);
    this.drawLobsterSmallLegs(cx, 82 + breathe, 0);
    this.drawLobsterBackHead(cx, 56 + headDip);
    this.drawLobsterAntennae(cx, 50 + headDip, antennaSway, false);
  }

  /** 龙虾分节身体：一节一节堆叠的圆环，从上到下越来越窄，带电路纹路 */
  private drawLobsterSegmentedBody(x: number, y: number, breathe: number, showBellyPlate: boolean) {
    const ctx = this.ctx;
    ctx.save();
    const segments = [
      { cy: y,      rx: 22 * breathe, ry: 11.7 },
      { cy: y + 13, rx: 20 * breathe, ry: 9.1 },
      { cy: y + 25, rx: 18 * breathe, ry: 8.5 },
      { cy: y + 35, rx: 15 * breathe, ry: 7.8 },
      { cy: y + 44, rx: 12 * breathe, ry: 7.2 },
    ];
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      ctx.fillStyle = this.colors.body;
      ctx.beginPath();
      ctx.ellipse(x, seg.cy, seg.rx, seg.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = this.colors.dark;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.ellipse(x, seg.cy, seg.rx, seg.ry, 0, 0.05 * Math.PI, 0.95 * Math.PI);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 每节的电路纹路
      ctx.save();
      ctx.strokeStyle = this.colors.light;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.55;
      ctx.lineCap = 'round';
      // 左侧短线
      ctx.beginPath();
      ctx.moveTo(x - seg.rx * 0.3, seg.cy - seg.ry * 0.15);
      ctx.lineTo(x - seg.rx * 0.55, seg.cy + seg.ry * 0.1);
      ctx.stroke();
      // 右侧短线
      ctx.beginPath();
      ctx.moveTo(x + seg.rx * 0.25, seg.cy - seg.ry * 0.2);
      ctx.lineTo(x + seg.rx * 0.5, seg.cy + seg.ry * 0.15);
      ctx.stroke();
      // 节点小圆点
      ctx.fillStyle = this.colors.light;
      ctx.beginPath();
      ctx.arc(x - seg.rx * 0.55, seg.cy + seg.ry * 0.1, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + seg.rx * 0.5, seg.cy + seg.ry * 0.15, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    if (showBellyPlate) {
      const bellyCenterY = y + 22;
      const bellyRadiusX = 9 * breathe;
      const bellyRadiusY = 22;

      // 浅色腹部
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = this.colors.accent;
      ctx.beginPath();
      ctx.ellipse(x, bellyCenterY, bellyRadiusX, bellyRadiusY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 腹部中线电路
      ctx.save();
      ctx.strokeStyle = this.colors.light;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.45;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y + 4);
      ctx.lineTo(x, y + 38);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + 12);
      ctx.lineTo(x + 5, y + 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + 22);
      ctx.lineTo(x - 4, y + 24);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + 30);
      ctx.lineTo(x + 4, y + 32);
      ctx.stroke();
      ctx.fillStyle = this.colors.light;
      for (const dy of [12, 22, 30]) {
        ctx.beginPath();
        ctx.arc(x, y + dy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    ctx.restore();
  }

  /** 龙虾尾扇：3 个大的扇形叶片 */
  private drawLobsterTailFan(x: number, y: number, wag: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    const fans = [
      { angle: -0.28 + wag * 0.01, ox: -10, w: 13, h: 9 },
      { angle: 0 + wag * 0.005, ox: 0, w: 14, h: 10 },
      { angle: 0.28 - wag * 0.01, ox: 10, w: 13, h: 9 },
    ];
    for (const fan of fans) {
      ctx.save();
      ctx.translate(fan.ox, 0);
      ctx.rotate(fan.angle);
      ctx.fillStyle = this.colors.body;
      ctx.beginPath();
      ctx.ellipse(0, 6, fan.w, fan.h, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = this.colors.dark;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.ellipse(0, 6, fan.w, fan.h, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(0, 14);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    ctx.restore();
  }

  /** 龙虾小腿：3 对短腿，下方两对更靠近身体 */
  private drawLobsterSmallLegs(x: number, y: number, pace: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = this.colors.dark;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    
    // 3 对腿：[rootY相对偏移, 腿根X偏移, 末端X扩展量]
    const legs = [
      { dy: 6,  rootX: 17, spreadX: 28 },
      { dy: 15, rootX: 14, spreadX: 22 },
      { dy: 24, rootX: 11, spreadX: 20 },
    ];
    
    for (let i = 0; i < legs.length; i++) {
        const { dy, rootX, spreadX } = legs[i];
        const startY = y + dy;
        const swing = pace !== 0 ? Math.sin(pace + i * 1.5) * 2 : 0;
        
        ctx.beginPath();
        ctx.moveTo(x - rootX, startY);
        ctx.quadraticCurveTo(x - spreadX * 0.8, startY + 4, x - spreadX + swing, startY + 13);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(x + rootX, startY);
        ctx.quadraticCurveTo(x + spreadX * 0.8, startY + 4, x + spreadX - swing, startY + 13);
        ctx.stroke();
    }
    ctx.restore();
  }

  /** 龙虾手臂 + 大钳子（坐/走/休息状态用） */
  private drawLobsterArm(x: number, bodyY: number, side: number, rotation: number) {
    const ctx = this.ctx;
    const shoulderX = x + side * 18;
    const shoulderY = bodyY + 4;
    // 35° 角：缩短手臂
    const elbowX = shoulderX + side * 10;
    const elbowY = shoulderY - 7;
    const clawX = elbowX + side * 6;
    const clawY = elbowY - 4;

    ctx.save();
    ctx.strokeStyle = this.colors.body;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(elbowX, elbowY);
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(elbowX, elbowY);
    ctx.lineTo(clawX, clawY);
    ctx.stroke();

    // 钳子方向与小臂（elbow -> claw）保持一致
    const armAngle = Math.atan2(clawY - elbowY, clawX - elbowX);

    ctx.save();
    ctx.translate(clawX, clawY);
    ctx.rotate(armAngle + rotation);
    this.drawLobsterClaw(ctx, 1.85, side);
    ctx.restore();

    ctx.restore();
  }

  /** 龙虾钳子：参考赛博龙虾造型，有电路纹路 */
  private drawLobsterClaw(ctx: CanvasRenderingContext2D, scale: number, side: number) {
    ctx.save();
    ctx.scale(scale, -scale * side);

    ctx.fillStyle = this.colors.body;
    ctx.strokeStyle = this.colors.dark;
    ctx.lineWidth = 1.5 / scale;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 腕节
    ctx.beginPath();
    ctx.ellipse(-0.5, 0.4, 3.4, 4.8, 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 掌部
    ctx.beginPath();
    ctx.moveTo(-1.5, -4.2);
    ctx.bezierCurveTo(4.5, -9.8, 12.5, -8.2, 13.8, -1.8);
    ctx.bezierCurveTo(14.8, 4.4, 9.4, 8.3, 2.8, 7.2);
    ctx.bezierCurveTo(-2.4, 6.3, -4.8, 1.3, -1.5, -4.2);
    ctx.fill();
    ctx.stroke();

    // 上钳
    ctx.beginPath();
    ctx.moveTo(5.2, -1.6);
    ctx.bezierCurveTo(10.8, -11.6, 22.6, -12.4, 26.8, -5.1);
    ctx.quadraticCurveTo(24.6, -1.2, 18.4, -0.6);
    ctx.quadraticCurveTo(11.4, -0.1, 6.8, 0.2);
    ctx.quadraticCurveTo(4.2, -0.2, 5.2, -1.6);
    ctx.fill();
    ctx.stroke();

    // 下钳
    ctx.beginPath();
    ctx.moveTo(4.6, 1.8);
    ctx.bezierCurveTo(9.2, 6.8, 18.3, 7.9, 22.1, 4.5);
    ctx.quadraticCurveTo(19.4, 1.4, 14.1, 1.2);
    ctx.quadraticCurveTo(8.8, 1.1, 5.8, 0.4);
    ctx.quadraticCurveTo(4.1, 0.4, 4.6, 1.8);
    ctx.fill();
    ctx.stroke();

    // 虎口齿纹
    ctx.beginPath();
    ctx.moveTo(14.4, -0.7);
    ctx.lineTo(18.1, -2.1);
    ctx.moveTo(13.7, 0.8);
    ctx.lineTo(17.4, 1.8);
    ctx.stroke();

    // 钳子电路纹路
    ctx.save();
    ctx.strokeStyle = this.colors.light;
    ctx.lineWidth = 0.7 / scale;
    ctx.globalAlpha = 0.6;
    ctx.lineCap = 'round';
    // 上钳电路
    ctx.beginPath();
    ctx.moveTo(8, -5);
    ctx.lineTo(12, -7.5);
    ctx.lineTo(18, -6.5);
    ctx.stroke();
    // 掌部电路
    ctx.beginPath();
    ctx.moveTo(3, -1);
    ctx.lineTo(7, -3.5);
    ctx.lineTo(10, -1.5);
    ctx.stroke();
    // 节点小圆点
    ctx.fillStyle = this.colors.light;
    ctx.beginPath();
    ctx.arc(12, -7.5, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(7, -3.5, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, -1.5, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // 高光
    ctx.beginPath();
    ctx.strokeStyle = this.colors.light;
    ctx.lineWidth = 1.5 / scale;
    ctx.moveTo(8.6, -6.5);
    ctx.quadraticCurveTo(13.8, -9.2, 18.2, -7.1);
    ctx.stroke();

    ctx.strokeStyle = this.colors.dark;
    ctx.lineWidth = 1.5 / scale;
    ctx.beginPath();
    ctx.moveTo(-1.3, 1.5);
    ctx.quadraticCurveTo(0.4, -0.3, 0.3, -2.4);
    ctx.stroke();

    ctx.restore();
  }

  /** 龙虾敲键盘的手臂（工作状态，直臂35°伸向键盘，末端大钳子） */
  private drawLobsterTypingArm(
    shoulderX: number, shoulderY: number,
    lift: number,
    isRight: boolean,
  ) {
    const ctx = this.ctx;
    const dir = isRight ? 1 : -1;
    // 背身打字时改为向内侧前伸敲击。
    const clawX = shoulderX - dir * 19;
    const clawY = shoulderY + 2 - lift * 0.55;
    const elbowX = shoulderX - dir * 10;
    const elbowY = shoulderY - 1 - lift * 0.25;

    ctx.save();
    ctx.strokeStyle = this.colors.body;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.quadraticCurveTo(elbowX, elbowY, clawX, clawY);
    ctx.stroke();

    // 左右钳子都朝身体中线方向，保持横向敲击感。
    ctx.save();
    ctx.translate(clawX, clawY);
    ctx.rotate(isRight ? Math.PI - 0.18 : 0.18);
    this.drawLobsterClaw(ctx, 1.35, dir);
    ctx.restore();

    ctx.restore();
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

  private drawLaptop(
    x: number,
    y: number,
    width: number,
    height: number,
    tilt: number,
    baseColor: string,
    screenColor: string,
    glowColor: string,
  ) {
    const ctx = this.ctx;
    const scanlineY = -height + 12 + ((Math.sin(this.elapsed * 2.6) + 1) / 2) * (height - 28);
    const screenX = -width * 0.31;
    const screenY = -height + 6;
    const screenWidth = width * 0.62;
    const screenHeight = height - 12;

    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.roundRect(-width * 0.48, 10, width * 0.96, 9, 4);
    ctx.fill();

    ctx.fillStyle = '#55616f';
    ctx.beginPath();
    ctx.roundRect(-width * 0.44, 19, width * 0.88, 6, 3);
    ctx.fill();

    ctx.fillStyle = '#8b97a5';
    ctx.beginPath();
    ctx.roundRect(-width * 0.12, 21, width * 0.24, 2, 1);
    ctx.fill();

    ctx.save();
    ctx.translate(0, 10);
    ctx.rotate(-tilt);
    ctx.fillStyle = '#27303b';
    ctx.beginPath();
    ctx.roundRect(-width * 0.38, -height, width * 0.76, height, 6);
    ctx.fill();

    ctx.fillStyle = screenColor;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.roundRect(screenX, screenY, screenWidth, screenHeight, 4);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(screenX, screenY, screenWidth, screenHeight, 4);
    ctx.clip();

    ctx.fillStyle = '#0b141d';
    ctx.globalAlpha = 0.22;
    ctx.fillRect(screenX, screenY, screenWidth, screenHeight);

    const lineGap = 6;
    const scrollOffset = (this.elapsed * 18) % lineGap;
    const terminalWidths = [0.78, 0.56, 0.84, 0.62, 0.72, 0.48, 0.88, 0.58];
    const commandColor = '#8ff7ff';
    const dimCommandColor = '#59c7d4';

    for (let index = -1; index < 8; index += 1) {
      const lineY = screenY + 8 + index * lineGap - scrollOffset;
      if (lineY < screenY + 2 || lineY > screenY + screenHeight - 4) {
        continue;
      }

      const widthFactor = terminalWidths[((Math.floor(this.elapsed * 3) + index) % terminalWidths.length + terminalWidths.length) % terminalWidths.length];
      const promptWidth = 4;
      const commandWidth = Math.max(10, (screenWidth - 16) * widthFactor);

      ctx.fillStyle = commandColor;
      ctx.globalAlpha = 0.75 - Math.max(0, index) * 0.05;
      ctx.fillRect(screenX + 6, lineY, promptWidth, 2);

      ctx.fillStyle = dimCommandColor;
      ctx.globalAlpha = 0.7 - Math.max(0, index) * 0.05;
      ctx.fillRect(screenX + 13, lineY, commandWidth, 2);

      if (index % 3 === 1) {
        ctx.globalAlpha = 0.5 - Math.max(0, index) * 0.04;
        ctx.fillRect(screenX + 18, lineY + 3, commandWidth * 0.42, 1.5);
      }
    }

    ctx.fillStyle = '#d6ffff';
    ctx.globalAlpha = 0.62;
    ctx.fillRect(screenX + screenWidth - 11, screenY + screenHeight - 9, 6, 2.5);

    ctx.restore();

    ctx.fillStyle = glowColor;
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.roundRect(-width * 0.28, -height + 10, width * 0.56, 6, 3);
    ctx.fill();

    ctx.fillStyle = '#d8fbff';
    ctx.globalAlpha = 0.1;
    ctx.beginPath();
    ctx.roundRect(-width * 0.27, scanlineY, width * 0.54, 3, 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();

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
    stripeColor: string | null,
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

    if (stripeColor) {
      ctx.strokeStyle = stripeColor;
      ctx.lineWidth = Math.max(4, width * 0.38);
      ctx.beginPath();
      ctx.moveTo(baseX + 6, baseY - 3);
      ctx.bezierCurveTo(baseX + 16, baseY - 8, baseX + riseX * 0.6, baseY + riseY * 0.58, tipX + curl * 18, tipY + 3);
      ctx.stroke();
    }
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

  private drawCatWalkingBody(x: number, y: number, w: number, h: number, tilt: number) {
    const ctx = this.ctx;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    ctx.moveTo(-w, 2);
    ctx.quadraticCurveTo(-w * 0.98, -h * 0.95, -w * 0.28, -h * 1.04);
    ctx.quadraticCurveTo(w * 0.4, -h * 1.02, w * 0.98, -h * 0.4);
    ctx.quadraticCurveTo(w * 1.12, h * 0.08, w * 0.92, h * 0.6);
    ctx.quadraticCurveTo(w * 0.26, h * 1.02, -w * 0.56, h * 0.88);
    ctx.quadraticCurveTo(-w * 1.02, h * 0.66, -w, 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = this.colors.light;
    ctx.beginPath();
    ctx.ellipse(-w * 0.08, h * 0.24, w * 0.4, h * 0.42, -0.04, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawCatWalkingHead(x: number, y: number, tilt: number) {
    const ctx = this.ctx;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    ctx.moveTo(18, -10);
    ctx.quadraticCurveTo(10, -23, -2, -20);
    ctx.quadraticCurveTo(-12, -17, -19, -11);
    ctx.quadraticCurveTo(-29, -3, -28, 4);
    ctx.quadraticCurveTo(-27, 11, -18, 14);
    ctx.quadraticCurveTo(-6, 18, 10, 16);
    ctx.quadraticCurveTo(19, 11, 20, 1);
    ctx.quadraticCurveTo(20, -5, 18, -10);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(10, -12);
    ctx.lineTo(15, -34);
    ctx.lineTo(2, -18);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-1, -14);
    ctx.lineTo(2, -31);
    ctx.lineTo(-8, -18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(9, -14);
    ctx.lineTo(12, -28);
    ctx.lineTo(4, -18);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(1, -25);
    ctx.lineTo(-5, -18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = this.colors.light;
    ctx.beginPath();
    ctx.moveTo(-8, 1);
    ctx.quadraticCurveTo(-18, 0, -24, 5);
    ctx.quadraticCurveTo(-20, 13, -11, 14);
    ctx.quadraticCurveTo(-2, 14, 4, 9);
    ctx.quadraticCurveTo(0, 2, -8, 1);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-6, -2, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-7, -3, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e59fa2';
    ctx.beginPath();
    ctx.moveTo(-20, 7);
    ctx.lineTo(-15, 5);
    ctx.lineTo(-15, 9);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = this.colors.line;
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-16, 8);
    ctx.lineTo(-12, 10);
    ctx.lineTo(-10, 12);
    ctx.moveTo(-15, 7);
    ctx.lineTo(-27, 4);
    ctx.moveTo(-15, 9);
    ctx.lineTo(-29, 10);
    ctx.moveTo(-14, 11);
    ctx.lineTo(-25, 16);
    ctx.stroke();

    ctx.restore();
  }

  private drawCatWorkingBody(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;

    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    ctx.moveTo(-w * 0.9, h * 0.95);
    ctx.quadraticCurveTo(-w * 1.18, h * 0.18, -w * 0.62, -h * 0.78);
    ctx.quadraticCurveTo(0, -h * 1.18, w * 0.62, -h * 0.78);
    ctx.quadraticCurveTo(w * 1.18, h * 0.18, w * 0.9, h * 0.95);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = this.colors.light;
    ctx.beginPath();
    ctx.ellipse(0, -1, w * 0.34, h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.colors.accent;
    ctx.beginPath();
    ctx.roundRect(-w * 0.4, -h * 0.72, w * 0.8, 5, 3);
    ctx.fill();

    ctx.restore();
  }

  private drawCatWorkingBackHead(x: number, y: number) {
    const ctx = this.ctx;

    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.quadraticCurveTo(16, -21, 20, -6);
    ctx.quadraticCurveTo(21, 10, 0, 17);
    ctx.quadraticCurveTo(-21, 10, -20, -6);
    ctx.quadraticCurveTo(-16, -21, 0, -21);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-13, -10);
    ctx.lineTo(-21, -33);
    ctx.lineTo(-3, -18);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(13, -10);
    ctx.lineTo(21, -33);
    ctx.lineTo(3, -18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(-12, -13);
    ctx.lineTo(-18, -28);
    ctx.lineTo(-6, -18);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(12, -13);
    ctx.lineTo(18, -28);
    ctx.lineTo(6, -18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = this.colors.light;
    ctx.beginPath();
    ctx.ellipse(0, 2, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
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

  private drawCatTypingPaw(x: number, y: number, width: number, height: number, rotation: number) {
    const ctx = this.ctx;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, 4);
    ctx.fill();
    ctx.restore();
  }

  private drawCatWalkingLeg(x: number, y: number, swing: number, lift: number, front: boolean = true) {
    const ctx = this.ctx;
    const kneeX = x + swing * (front ? 0.24 : 0.18);
    const kneeY = y + 13 - lift * 0.45;
    const footX = x + swing * (front ? 0.66 : 0.58);
    const footY = y + 29 - lift;
    const legWidth = front ? 8 : 7;

    ctx.save();
    ctx.strokeStyle = this.colors.body;
    ctx.lineWidth = legWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(kneeX, kneeY, footX, footY);
    ctx.stroke();

    ctx.fillStyle = this.colors.light;
    ctx.beginPath();
    ctx.roundRect(footX - 6, footY - 1, 12, 7, 4);
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

  private getLobsterBlinkOpen() {
    const blinkDuration = 0.24;
    const blinkStart = 3.56;
    const phase = this.elapsed % 3.8;

    if (phase < blinkStart) {
      return 1;
    }

    const t = Math.min(1, (phase - blinkStart) / blinkDuration);
    return Math.abs(t * 2 - 1);
  }

  private drawLobsterHead(x: number, y: number, eyeOpen: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    // 大圆头
    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // 甲壳高光
    ctx.fillStyle = this.colors.light;
    ctx.globalAlpha = 0.32;
    ctx.beginPath();
    ctx.ellipse(-5, -5, 10, 8, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 头部电路纹路
    this.drawCircuitLines(ctx, 0, 1, 16, 14);

    // 大眼睛（蓝色）
    const eyeR = 6.8;
    const lidH = Math.max(1.2, eyeR * eyeOpen);
    for (const side of [-1, 1]) {
      const ex = side * 9;
      const ey = -3;

      if (eyeOpen <= 0.16) {
        // 闭眼
        ctx.strokeStyle = this.colors.dark;
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex - 5, ey);
        ctx.quadraticCurveTo(ex, ey + 2.2, ex + 5, ey);
        ctx.stroke();
      } else {
        // 白色眼白
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(ex, ey, eyeR, lidH, 0, 0, Math.PI * 2);
        ctx.fill();
        // 眼白描边
        ctx.strokeStyle = this.colors.dark;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(ex, ey, eyeR, lidH, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 蓝色虹膜
        const irisR = Math.min(eyeR * 0.65, lidH * 0.82);
        ctx.fillStyle = '#4a90d9';
        ctx.beginPath();
        ctx.arc(ex, ey + 0.8, irisR, 0, Math.PI * 2);
        ctx.fill();

        // 黑色瞳孔
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(ex, ey + 0.8, irisR * 0.52, 0, Math.PI * 2);
        ctx.fill();

        // 高光
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - 1.8, ey - Math.max(1.6, lidH * 0.32), 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + 1.4, ey + 1.2, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 开心大嘴
    ctx.strokeStyle = this.colors.dark;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, 8);
    ctx.quadraticCurveTo(0, 15, 6, 8);
    ctx.stroke();

    ctx.restore();
  }

  /** 龙虾工作态背影头：只画后脑壳，不露眼睛 */
  private drawLobsterBackHead(x: number, y: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    // 后脑壳椭圆（与正面头部相同大小）
    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // 甲壳顶部高光
    ctx.fillStyle = this.colors.light;
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.ellipse(3, -5, 10, 7, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 背面电路纹路
    this.drawCircuitLines(ctx, 0, -1, 16, 14);

    ctx.restore();
  }

  private drawLobsterAntennae(x: number, y: number, sway: number, resting: boolean) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = this.colors.dark;
    ctx.lineCap = 'round';

    const lift = resting ? 14 : 22;
    for (const side of [-1, 1]) {
      const sx = x + side * 6;
      const sy = y;
      
      // 让大半段保持挺拔向上的斜线，仅尾部末端略微弯曲下垂
      const cp1X = sx + side * 12;
      const cp1Y = sy - lift * 0.7;
      const cp2X = sx + side * 24;
      const cp2Y = sy - lift * 1.4;
      const tipX = sx + side * 32 + sway * 0.6;
      const tipY = sy - lift * 1.1 - sway * 0.2;

      let prevX = sx;
      let prevY = sy;
      const segments = 16; // 增加段数让长曲线更平滑

      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        const t2 = t * t;
        const t3 = t2 * t;

        const curX = mt3 * sx + 3 * mt2 * t * cp1X + 3 * mt * t2 * cp2X + t3 * tipX;
        const curY = mt3 * sy + 3 * mt2 * t * cp1Y + 3 * mt * t2 * cp2Y + t3 * tipY;

        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(curX, curY);
        // 线条逐渐变细：从宽 3.0 缩小到 0.6
        ctx.lineWidth = 3.0 * (1 - t * 0.8);
        ctx.stroke();

        prevX = curX;
        prevY = curY;
      }
    }
    ctx.restore();
  }

  /** 在给定区域画简化的电路纹路 */
  private drawCircuitLines(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) {
    ctx.save();
    ctx.strokeStyle = this.colors.light;
    ctx.fillStyle = this.colors.light;
    ctx.lineWidth = 0.7;
    ctx.globalAlpha = 0.5;
    ctx.lineCap = 'round';

    // 竖主线
    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 0.35);
    ctx.lineTo(cx, cy + h * 0.35);
    ctx.stroke();

    // 左分支
    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 0.12);
    ctx.lineTo(cx - w * 0.28, cy - h * 0.06);
    ctx.lineTo(cx - w * 0.28, cy + h * 0.12);
    ctx.stroke();

    // 右分支
    ctx.beginPath();
    ctx.moveTo(cx, cy + h * 0.08);
    ctx.lineTo(cx + w * 0.24, cy + h * 0.14);
    ctx.lineTo(cx + w * 0.24, cy + h * 0.28);
    ctx.stroke();

    // 节点圆点
    for (const [px, py] of [
      [cx, cy - h * 0.12],
      [cx - w * 0.28, cy + h * 0.12],
      [cx + w * 0.24, cy + h * 0.14],
      [cx, cy + h * 0.35],
    ]) {
      ctx.beginPath();
      ctx.arc(px, py, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
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
