import { useEffect, useState, useRef, useCallback } from 'react';
import type { PetNotification, PetSettings, AnimalType } from '@agentpet/protocol';

declare global {
  interface Window {
    agentpet: {
      onNotify(listener: (notification: PetNotification) => void): () => void;
      onSettingsChanged(listener: (settings: PetSettings) => void): () => void;
      getSettings(): Promise<PetSettings>;
      saveSettings(settings: PetSettings): Promise<void>;
      closeSettings(): void;
      isSettingsWindow(): boolean;
    };
  }
}

type PetPhase = 'idle' | 'active' | 'completed' | 'failed';

const ANIMALS: { type: AnimalType; emoji: string; label: string }[] = [
  { type: 'cat', emoji: '🐱', label: '猫咪' },
  { type: 'dog', emoji: '🐶', label: '狗狗' },
  { type: 'lobster', emoji: '🦞', label: '龙虾' },
  { type: 'penguin', emoji: '🐧', label: '企鹅' },
  { type: 'panda', emoji: '🐼', label: '熊猫' },
];

function phaseToStatus(phase: string): PetPhase {
  if (phase === 'started' || phase === 'progress') return 'active';
  if (phase === 'completed') return 'completed';
  if (phase === 'failed') return 'failed';
  return 'idle';
}

// ── Settings Panel (separate window) ─────────────────────────────────────
function SettingsPanel() {
  const [editAnimal, setEditAnimal] = useState<AnimalType>('cat');
  const [editName, setEditName] = useState('');

  useEffect(() => {
    window.agentpet?.getSettings?.().then(s => {
      if (s) { setEditAnimal(s.animal); setEditName(s.name); }
    });
  }, []);

  const handleSave = useCallback(async () => {
    const settings: PetSettings = { animal: editAnimal, name: editName };
    await window.agentpet.saveSettings(settings);
    window.agentpet.closeSettings();
  }, [editAnimal, editName]);

  const handleCancel = useCallback(() => {
    window.agentpet.closeSettings();
  }, []);

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
          <h2>⚙️ 设置</h2>
        <div className="settings-section">
          <label>宠物名称</label>
          <input
            type="text"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            placeholder="给宠物取个名字..."
            maxLength={20}
          />
        </div>
        <div className="settings-section">
          <label>选择动物</label>
          <div className="animal-grid">
            {ANIMALS.map(a => (
              <button
                key={a.type}
                className={`animal-btn${editAnimal === a.type ? ' selected' : ''}`}
                onClick={() => setEditAnimal(a.type)}
              >
                <span className="animal-emoji">{a.emoji}</span>
                <span className="animal-label">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="settings-actions">
          <button className="btn-cancel" onClick={handleCancel}>取消</button>
          <button className="btn-save" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
}

function PetView() {
  const [status, setStatus] = useState<PetPhase>('idle');
  const [facingRight, setFacingRight] = useState(true);
  const [posX, setPosX] = useState(60);
  const [bubbleText, setBubbleText] = useState('');
  const [animal, setAnimal] = useState<AnimalType>('cat');
  const [petName, setPetName] = useState('');
  const animRef = useRef<number>(0);
  const statusRef = useRef<PetPhase>('idle');
  const posRef = useRef({ x: 60, dir: 1 });
  const petWidth = 72;

  useEffect(() => { statusRef.current = status; }, [status]);

  // Load settings on mount
  useEffect(() => {
    window.agentpet?.getSettings?.().then(s => {
      if (s) { setAnimal(s.animal); setPetName(s.name); }
    });
  }, []);

  // Listen for settings changed from settings window
  useEffect(() => {
    if (!window.agentpet?.onSettingsChanged) return;
    return window.agentpet.onSettingsChanged(s => {
      setAnimal(s.animal);
      setPetName(s.name);
    });
  }, []);

  // Animation loop
  useEffect(() => {
    const maxX = Math.max(8, window.innerWidth - petWidth);
    const speed = 0.3;

    function tick() {
      const phase = statusRef.current;
      if (phase === 'active') {
        const p = posRef.current;
        if (p.x > maxX) {
          p.x = maxX;
          setPosX(maxX);
        }
        p.x += speed * p.dir;
        if (p.x >= maxX) { p.dir = -1; setFacingRight(false); }
        if (p.x <= 8) { p.dir = 1; setFacingRight(true); }
        setPosX(p.x);
      }
      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [petWidth]);

  // MCP notifications
  useEffect(() => {
    if (!window.agentpet?.onNotify) return;
    return window.agentpet.onNotify(notification => {
      const petPhase = phaseToStatus(notification.phase);
      setStatus(petPhase);
      const text = notification.title || '';
      if (petPhase === 'active') {
        setBubbleText(text);
      } else if (petPhase === 'completed') {
        setBubbleText('✓ ' + text);
        setTimeout(() => {
          setStatus(prev => prev === 'completed' ? 'idle' : prev);
          setBubbleText('');
        }, 60000);
      } else if (petPhase === 'failed') {
        setBubbleText('✗ ' + text);
        setTimeout(() => {
          setStatus(prev => prev === 'failed' ? 'idle' : prev);
          setBubbleText('');
        }, 5000);
      }
    });
  }, []);

  return (
    <div className="dock-strip">
      <div
        className={`cat animal-${animal} cat-${status}${facingRight ? '' : ' cat-flip'}`}
        style={{ transform: `translateX(${posX}px)` }}
      >
        <div className="cat-sprite">
          <>
            <div className="cat-ear cat-ear-l" />
            <div className="cat-ear cat-ear-r" />
            <div className="cat-head">
              <div className="cat-eye cat-eye-l" />
              <div className="cat-eye cat-eye-r" />
              <div className="cat-nose" />
            </div>
            <div className="cat-torso" />
            <div className="cat-leg cat-leg-fl" />
            <div className="cat-leg cat-leg-fr" />
            <div className="cat-leg cat-leg-bl" />
            <div className="cat-leg cat-leg-br" />
            <div className="cat-tail" />
          </>
          <div className="cat-coffee" />
          <div className="cat-chair" />
          <div className="zzz">
            <span className="z z1">z</span>
            <span className="z z2">z</span>
            <span className="z z3">Z</span>
          </div>
        </div>
        {bubbleText && (
          <div className={`bubble bubble-${status}`}>{bubbleText}</div>
        )}
        {!bubbleText && petName && status === 'idle' && (
          <div className="pet-name">{petName}</div>
        )}
      </div>
    </div>
  );
}

// ── Root: route by window type ───────────────────────────────────────
export function App() {
  if (window.agentpet?.isSettingsWindow?.()) {
    return <SettingsPanel />;
  }
  return <PetView />;
}