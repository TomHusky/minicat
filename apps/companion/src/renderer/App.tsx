import { useEffect, useState, useRef, useCallback } from 'react';
import type { PetNotification, PetSettings, AnimalType } from '@agentpet/protocol';
import { PetAnimator, type PetAnimationState } from './pixelCat';

declare global {
  interface Window {
    agentpet: {
      onNotify(listener: (notification: PetNotification) => void): () => void;
      onSettingsChanged(listener: (settings: PetSettings) => void): () => void;
      onUserActivityChanged(listener: (active: boolean) => void): () => void;
      getSettings(): Promise<PetSettings>;
      getUserActivity(): Promise<boolean>;
      saveSettings(settings: PetSettings): Promise<void>;
      closeSettings(): void;
      isSettingsWindow(): boolean;
    };
  }
}

type PetPhase = 'idle' | 'active' | 'completed' | 'failed';

function isIdleLikeStatus(status: PetPhase) {
  return status !== 'active';
}

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
  if (phase === 'idle') return 'idle';
  return 'idle';
}

function SettingsPanel() {
  const [editAnimal, setEditAnimal] = useState<AnimalType>('cat');
  const [editName, setEditName] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    window.agentpet?.getSettings?.().then(s => {
      if (s) {
        setEditAnimal(normalizeAnimal(s.animal));
        setEditName(s.name);
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
        copilotListenerEnabled: true,
      };
      await window.agentpet.saveSettings(settings);
      window.agentpet.closeSettings();
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败，请稍后重试。';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }, [editAnimal, editName]);

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
            <p className="settings-subtitle">调整宠物外观。Companion 运行期间会自动接入 Copilot 全局指令，退出应用时自动清理。</p>
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
            <label>Copilot 全局监听</label>
            <p>打开应用时自动写入用户级 Copilot instructions，退出应用时自动删除该文件。</p>
          </div>
          <div className="settings-status-pill" aria-hidden="true">运行中自动开启</div>
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
  const [petAnimationState, setPetAnimationState] = useState<PetAnimationState>('sitting');
  const [facingRight, setFacingRight] = useState(true);
  const [bubbleText, setBubbleText] = useState('');
  const [animal, setAnimal] = useState<AnimalType>('cat');
  const [petName, setPetName] = useState('');
  const [isUserActive, setIsUserActive] = useState(true);
  const statusRef = useRef<PetPhase>('idle');
  const animationStateRef = useRef<PetAnimationState>('sitting');
  const resetTimerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const petRef = useRef<PetAnimator | null>(null);

  const clearStatusResetTimer = useCallback(() => {
    if (resetTimerRef.current === null) {
      return;
    }

    window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = null;
  }, []);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { animationStateRef.current = petAnimationState; }, [petAnimationState]);

  useEffect(() => clearStatusResetTimer, [clearStatusResetTimer]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const pet = new PetAnimator(canvasRef.current, animal);
    pet.setState(animationStateRef.current);
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
    petRef.current?.setState(petAnimationState);
  }, [petAnimationState]);

  useEffect(() => {
    if (status === 'active') {
      setPetAnimationState('working');
      return;
    }

    if (!isIdleLikeStatus(status)) {
      return;
    }

    setPetAnimationState(isUserActive ? 'sitting' : 'resting');
  }, [isUserActive, status]);

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
    window.agentpet?.getUserActivity?.().then(active => {
      setIsUserActive(Boolean(active));
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
    if (!window.agentpet?.onUserActivityChanged) return;
    return window.agentpet.onUserActivityChanged(active => {
      setIsUserActive(active);
    });
  }, []);

  useEffect(() => {
    if (!window.agentpet?.onNotify) return;
    return window.agentpet.onNotify(notification => {
      clearStatusResetTimer();
      const petPhase = phaseToStatus(notification.phase);

      if (petPhase === 'idle') {
        setStatus('idle');
        setBubbleText('');
        return;
      }

      setStatus(petPhase);
      const text = notification.title || '';
      if (petPhase === 'active') {
        setBubbleText(text);
      } else if (petPhase === 'completed') {
        setBubbleText('✅ ' + text);
        resetTimerRef.current = window.setTimeout(() => {
          setStatus(prev => prev === 'completed' ? 'idle' : prev);
          setBubbleText('');
          resetTimerRef.current = null;
        }, 60000);
      } else if (petPhase === 'failed') {
        setBubbleText('❌ ' + text);
        resetTimerRef.current = window.setTimeout(() => {
          setStatus(prev => prev === 'failed' ? 'idle' : prev);
          setBubbleText('');
          resetTimerRef.current = null;
        }, 5000);
      }
    });
  }, [clearStatusResetTimer]);

  return (
    <div className="dock-strip">
      <div
        className={`cat animal-${animal} cat-${status}`}
        style={{ transform: 'translateX(60px)' }}
      >
        <canvas
          ref={canvasRef}
          className="cat-canvas"
        />
        
        <div className="cat-overlay">
          {bubbleText && (
            <div className={`bubble bubble-${status}`}>
              <span className="bubble-label">{bubbleText}</span>
            </div>
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
