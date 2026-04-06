import { useEffect, useState, useRef, useCallback } from 'react';
import type { PetNotification, PetSettings, AnimalType } from '@agentpet/protocol';
import { PetAnimator, type PetAnimationState } from './pixelCat';

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
  { type: 'lobster', emoji: '🦞', label: '龙虾' },
];

const SUPPORTED_ANIMALS = new Set<AnimalType>(ANIMALS.map(animal => animal.type));

function normalizeAnimal(animal: string | undefined): AnimalType {
  if (animal && SUPPORTED_ANIMALS.has(animal as AnimalType)) {
    return animal as AnimalType;
  }
  return 'cat';
}

function phaseToStatus(phase: string): PetPhase {
  if (phase === 'started' || phase === 'progress') return 'active';
  if (phase === 'completed') return 'completed';
  if (phase === 'failed') return 'failed';
  return 'idle';
}

function statusToPetState(status: PetPhase): PetAnimationState {
  if (status === 'active') return 'walking';
  if (status === 'completed' || status === 'failed') return 'resting';
  return 'sitting';
}

function SettingsPanel() {
  const [editAnimal, setEditAnimal] = useState<AnimalType>('cat');
  const [editName, setEditName] = useState('');
  const [copilotListenerEnabled, setCopilotListenerEnabled] = useState(true);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    window.agentpet?.getSettings?.().then(s => {
      if (s) {
        setEditAnimal(normalizeAnimal(s.animal));
        setEditName(s.name);
        setCopilotListenerEnabled(s.copilotListenerEnabled);
      }
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaveError('');
    setIsSaving(true);

    try {
      const settings: PetSettings = {
        animal: editAnimal,
        name: editName,
        copilotListenerEnabled,
      };
      await window.agentpet.saveSettings(settings);
      window.agentpet.closeSettings();
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败，请稍后重试。';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }, [copilotListenerEnabled, editAnimal, editName]);

  const handleCancel = useCallback(() => {
    window.agentpet.closeSettings();
  }, []);

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <div className="settings-hero">
          <div>
            <p className="settings-eyebrow">AgentPet</p>
            <h2>桌面宠物设置</h2>
            <p className="settings-subtitle">调整宠物外观，并控制是否将 Copilot 指令接入 VS Code 全局配置。</p>
          </div>
          <div className="settings-preview" aria-hidden="true">
            <span>{editAnimal === 'lobster' ? '🦞' : '🐱'}</span>
          </div>
        </div>

        <div className="settings-section">
          <label>选择动物</label>
          <div className="animal-grid">
          {ANIMALS.map(a => (
            <button
              key={a.type}
              type="button"
              className={`animal-btn${editAnimal === a.type ? ' selected' : ''}`}
              onClick={() => setEditAnimal(a.type)}
            >
              <span className="animal-emoji">{a.emoji}</span>
              <span className="animal-label">{a.label}</span>
            </button>
          ))}
          </div>
        </div>

        <div className="settings-toggle-row">
          <div className="settings-toggle-copy">
            <label htmlFor="copilot-listener-toggle">Copilot 全局监听</label>
            <p>在 VS Code prompts 目录建立软链接</p>
          </div>
          <button
            id="copilot-listener-toggle"
            type="button"
            className={`settings-switch${copilotListenerEnabled ? ' is-on' : ''}`}
            aria-pressed={copilotListenerEnabled}
            onClick={() => setCopilotListenerEnabled(prev => !prev)}
          >
            <span className="settings-switch-track">
              <span className="settings-switch-thumb" />
            </span>
          </button>
        </div>

        {saveError ? <div className="settings-error">{saveError}</div> : null}

        <div className="settings-actions">
          <button type="button" className="btn-cancel" onClick={handleCancel}>取消</button>
          <button type="button" className="btn-save" onClick={handleSave} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </button>
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const petRef = useRef<PetAnimator | null>(null);
  const petWidth = 180;

  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const pet = new PetAnimator(canvasRef.current, animal);
    pet.setState(statusToPetState(statusRef.current));
    pet.setFacingRight(facingRight);
    pet.start();
    petRef.current = pet;

    const handleResize = () => pet.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      pet.stop();
      petRef.current = null;
    };
  }, []);

  useEffect(() => {
    petRef.current?.setState(statusToPetState(status));
  }, [status]);

  useEffect(() => {
    petRef.current?.setFacingRight(facingRight);
  }, [facingRight]);

  useEffect(() => {
    petRef.current?.setAnimal(animal);
  }, [animal]);

  useEffect(() => {
    window.agentpet?.getSettings?.().then(s => {
      if (s) { setAnimal(normalizeAnimal(s.animal)); setPetName(s.name); }
    });
  }, []);

  useEffect(() => {
    if (!window.agentpet?.onSettingsChanged) return;
    return window.agentpet.onSettingsChanged(s => {
      setAnimal(normalizeAnimal(s.animal));
      setPetName(s.name);
    });
  }, []);

  useEffect(() => {
    const maxX = Math.max(8, window.innerWidth - petWidth);
    const speed = 0.3;

    function tick() {
      const phase = statusRef.current;
      if (phase === 'active') {
        const p = posRef.current;
        setFacingRight(p.dir < 0);
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

  useEffect(() => {
    if (!window.agentpet?.onNotify) return;
    return window.agentpet.onNotify(notification => {
      const petPhase = phaseToStatus(notification.phase);
      setStatus(petPhase);
      const text = notification.title || '';
      if (petPhase === 'active') {
        setBubbleText(text);
      } else if (petPhase === 'completed') {
        setBubbleText('✅ ' + text);
        setTimeout(() => {
          setStatus(prev => prev === 'completed' ? 'idle' : prev);
          setBubbleText('');
        }, 60000);
      } else if (petPhase === 'failed') {
        setBubbleText('❌ ' + text);
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
        className={`cat animal-${animal} cat-${status}`}
        style={{ transform: `translateX(${posX}px)` }}
      >
        <canvas
          ref={canvasRef}
          className="cat-canvas"
        />
        
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
          {bubbleText && (
            <div className={`bubble bubble-${status}`}>{bubbleText}</div>
          )}
          {!bubbleText && petName && status === 'idle' && (
            <div className="pet-name">{petName}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function App() {
  if (window.agentpet?.isSettingsWindow?.()) {
    return <SettingsPanel />;
  }
  return <PetView />;
}
