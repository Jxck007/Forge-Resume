import React, { useState } from 'react';
import { Bot, Eye, EyeOff, KeyRound, Loader2, Sparkles, Unplug } from 'lucide-react';
import { getAuthInstance } from '../../config/firebase';
import { AI_PROVIDER_CHOICES, useAiSession } from '../../contexts/AiSessionContext';

interface AiAssistPanelProps {
  showToasts: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function AiAssistPanel({ showToasts }: AiAssistPanelProps) {
  const [showKey, setShowKey] = useState(false);
  const {
    state,
    apiKey,
    modelOptions,
    isGenerating,
    setMode,
    setProvider,
    setApiKey,
    setSelectedModel,
    setCustomModelId,
    testConnection,
    forgetKey,
  } = useAiSession();

  const activeProvider = state.provider ? AI_PROVIDER_CHOICES.find(option => option.id === state.provider) : null;
  const canTest = state.mode === 'byok' && !!state.provider && !!apiKey.trim() && !state.isTesting && !isGenerating;

  const handleTest = async () => {
    try {
      await testConnection();
      showToasts('Connected for this session. Forge will forget this key when you refresh, close the tab, or log out.', 'success');
    } catch (error) {
      showToasts(error instanceof Error ? error.message : 'AI request failed. Check your key, provider, or model and try again.', 'error');
    }
  };

  const signedIn = !!getAuthInstance().currentUser;
  const introTitle = signedIn ? 'AI Assist unlocked' : 'Sign in to unlock limited free AI';
  const introMessage = signedIn
    ? 'You get limited free AI actions each day. Review suggestions before applying. Do not include sensitive secrets.'
    : 'Sign in to unlock limited free AI or use BYOK if enabled later.';

  return (
    <div className="space-y-4">
      <div className="max-w-4xl rounded-2xl border border-[#2A2E37] bg-[#0F1115] p-4 sm:p-5 text-sm text-zinc-300">
        <p className="font-semibold text-white">{introTitle}</p>
        <p className="mt-2">{introMessage}</p>
      </div>
      <div className="max-w-4xl rounded-2xl border border-[#2A2E37] bg-[#171A21] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#2A2E37] bg-[#0F1115] text-emerald-300">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">AI Assist Beta</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Choose limited Forge Free AI or connect your own session-only provider key. Every suggestion still requires review.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="forge-field md:col-span-2">
            <span>Mode</span>
            <select value={state.mode} onChange={event => setMode(event.target.value as 'local' | 'free' | 'byok')} disabled={state.isTesting || isGenerating}>
              <option value="local">Local Only</option>
              <option value="free" disabled={!signedIn}>Forge Free Beta AI</option>
              <option value="byok">BYOK Advanced</option>
            </select>
            <small>{signedIn
              ? 'Free Beta uses Forge’s limited server quota. BYOK uses your key only for this browser session.'
              : 'Sign in to unlock Forge Free Beta AI. BYOK remains available for this session.'}</small>
          </label>

          {state.mode === 'free' && (
            <div className="md:col-span-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-zinc-300">
              <strong className="text-white">Forge Free Beta AI</strong>
              <p className="mt-1 text-zinc-400">Up to 25 writing actions per day and 3 pasted-text imports. Availability is shared and may pause during high demand.</p>
              <p className="mt-2 text-xs font-semibold text-emerald-300">
                {state.freeActionsRemaining === null ? 'Remaining actions appear after your first request.' : `${state.freeActionsRemaining} free actions remaining today.`}
              </p>
            </div>
          )}

          {state.mode === 'byok' && <>
          <label className="forge-field">
            <span>Provider</span>
            <select value={state.provider || ''} onChange={event => setProvider((event.target.value || null) as typeof state.provider)} disabled={state.mode !== 'byok' || state.isTesting || isGenerating}>
              <option value="">Choose provider</option>
              {AI_PROVIDER_CHOICES.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <small>Gemini, Groq, Cerebras, and OpenRouter are supported.</small>
          </label>

          <label className="forge-field md:col-span-2">
            <span>API key</span>
            <div className="grid max-w-3xl gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={event => setApiKey(event.target.value)}
                disabled={state.mode !== 'byok' || state.isTesting || isGenerating}
                autoComplete="off"
                spellCheck={false}
                className="min-h-11 w-full rounded-xl border border-emerald-500/30 bg-[#090D12] px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/10"
                placeholder={state.mode === 'byok' ? 'Paste your API key for this session only' : 'Switch to BYOK to connect a key'}
              />
              <button type="button" onClick={() => setShowKey(value => !value)} disabled={!apiKey || state.isTesting || isGenerating} className="forge-secondary-button shrink-0" aria-label={showKey ? 'Hide API key' : 'Show API key'}>
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showKey ? 'Hide' : 'Show'}
              </button>
              <button type="button" onClick={forgetKey} disabled={state.isTesting || isGenerating || (!apiKey && !state.isConnected)} className="forge-secondary-button shrink-0">
                <Unplug className="h-4 w-4" />
                Forget key
              </button>
            </div>
            <small>Forge never saves this key to Firestore, localStorage, sessionStorage, or URLs.</small>
          </label>

          <label className="forge-field">
            <span>Model</span>
            <select value={state.selectedModel || ''} onChange={event => setSelectedModel(event.target.value || null)} disabled={state.mode !== 'byok' || !state.provider || state.isTesting || isGenerating}>
              <option value="">Use provider default</option>
              {(modelOptions.length ? modelOptions : activeProvider?.defaultModels || []).map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
            <small>Model listing falls back to safe defaults if discovery fails.</small>
          </label>

          <label className="forge-field">
            <span>Custom model ID</span>
            <input
              type="text"
              value={state.customModelId}
              onChange={event => setCustomModelId(event.target.value)}
              disabled={state.mode !== 'byok' || !state.provider || state.isTesting || isGenerating}
              placeholder="Optional override"
              autoComplete="off"
              spellCheck={false}
            />
            <small>Optional. Use this if your provider account exposes another exact model ID.</small>
          </label>
          </>}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {state.mode === 'byok' && <button type="button" onClick={handleTest} disabled={!canTest} className="forge-primary-button min-w-36">
            {state.isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Test connection
          </button>}
          {state.mode === 'local' && (
            <span className="rounded-full border border-[#2A2E37] bg-[#0F1115] px-3 py-1 text-xs font-semibold text-zinc-400">Local Only</span>
          )}
          {state.mode === 'byok' && !state.isConnected && !state.isTesting && (
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">BYOK not connected</span>
          )}
          {state.mode === 'byok' && state.isConnected && (
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">Connected for this session</span>
          )}
          {state.mode === 'free' && (
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">Free Beta selected</span>
          )}
          {isGenerating && (
            <span className="rounded-full border border-[#2A2E37] bg-[#0F1115] px-3 py-1 text-xs font-semibold text-zinc-300">AI request running</span>
          )}
        </div>

        <div className="mt-4 space-y-2 text-sm text-zinc-400">
          {state.mode === 'free' ? (
            <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-200">
              Free AI is ready for signed-in use. Daily and global limits are enforced by the server.
            </p>
          ) : state.mode === 'byok' && state.isConnected ? (
            <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-200">
              Connected for this session. Forge will forget this key when you refresh, close the tab, or log out.
            </p>
          ) : state.mode === 'byok' ? (
            <p className="rounded-xl border border-[#2A2E37] bg-[#0F1115] p-3 text-zinc-300">
              Connect a BYOK provider to enable summary improvement, bullet rewrites, grammar fixes, and paste-text import beta.
            </p>
          ) : (
            <p className="rounded-xl border border-[#2A2E37] bg-[#0F1115] p-3 text-zinc-300">
              Select Forge Free Beta AI, connect BYOK, or continue without AI.
            </p>
          )}
          {state.lastError && (
            <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-rose-200">{state.lastError}</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-[#2A2E37] bg-[#0F1115] p-4 text-sm text-zinc-400">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 text-zinc-500" />
          <div>
            <p className="font-semibold text-white">Privacy boundary</p>
            <p className="mt-1">Free Beta sends only the selected text to Forge&apos;s server route. BYOK keys remain browser-memory only and are never sent to Forge.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
