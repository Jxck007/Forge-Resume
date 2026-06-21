import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { buildAiPrompt } from '../ai/promptBuilder';
import { AI_PROVIDER_ADAPTERS, AI_PROVIDER_OPTIONS, AI_SAFE_ERROR_MESSAGE } from '../ai/providers';
import { AiGenerateInput, AiGenerateResult, AiMode, AiProviderId, AiSessionState, FreeAiStatusReason } from '../ai/types';
import { getAuthInstance } from '../config/firebase';
import { getOrCreateForgeDeviceId } from '../utils/storageKeys';

interface AiSessionContextValue {
  state: AiSessionState;
  apiKey: string;
  modelOptions: string[];
  isGenerating: boolean;
  setMode: (mode: AiMode) => void;
  setProvider: (provider: AiProviderId | null) => void;
  setApiKey: (apiKey: string) => void;
  setSelectedModel: (model: string | null) => void;
  setCustomModelId: (model: string) => void;
  testConnection: () => Promise<void>;
  refreshFreeStatus: () => Promise<void>;
  forgetKey: () => void;
  generate: (input: Omit<AiGenerateInput, 'apiKey' | 'provider' | 'model'>) => Promise<AiGenerateResult>;
  clearSession: () => void;
}

const initialState: AiSessionState = {
  mode: 'local',
  provider: null,
  selectedModel: null,
  customModelId: '',
  isConnected: false,
  isTesting: false,
  lastError: null,
  freeActionsRemaining: null,
  freeProvider: null,
  freeBetaAvailable: null,
  freeStatusReason: null,
  freeStatusLoading: false,
  freeResetAt: null,
};

const FREE_AI_ERRORS: Record<string, string> = {
  AUTH_REQUIRED: 'Sign in to use Forge Free Beta AI.',
  FREE_BETA_DISABLED: 'Forge Free AI is unavailable. Use BYOK or continue manually.',
  EMPTY_INPUT: 'Add some text before using AI help.',
  INPUT_TOO_LONG: 'This text is too long for one AI action.',
  COOLDOWN: 'Please wait before trying again.',
  DEVICE_LIMIT: 'Free AI limit reached for this device. Use BYOK or try again after reset.',
  IP_LIMIT: 'Free AI limit reached for this network. Use BYOK or try again after reset.',
  IMPORT_LIMIT: 'Free pasted-text import limit reached. Use BYOK or try again after reset.',
  GLOBAL_LIMIT: 'Forge Free AI is busy right now. Try BYOK or continue manually.',
  PROVIDERS_BUSY: 'Forge Free AI is busy right now. Try BYOK or continue manually.',
  MISSING_PROVIDER_KEYS: 'Forge Free AI provider setup is incomplete. Use BYOK or continue manually.',
  QUOTA_STORE_MISSING: 'Free AI quota store is not configured.',
  QUOTA_STORE_UNAVAILABLE: 'Free AI quota store is not configured.',
  SERVER_ERROR: 'Server AI is not configured correctly.',
  REPEATED_SPAM: 'Please wait before trying again.',
};

const AiSessionContext = createContext<AiSessionContextValue | null>(null);
let clearAiSessionController: (() => void) | null = null;

export function clearAiSessionMemory() {
  clearAiSessionController?.();
}

export function AiSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AiSessionState>(() => ({
    ...initialState,
    mode: getAuthInstance().currentUser ? 'free' : 'local',
    isConnected: false,
  }));
  const [apiKey, setApiKeyState] = useState('');
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastRequestAt, setLastRequestAt] = useState(0);
  const sessionRevisionRef = useRef(0);
  const activeRequestRef = useRef(0);
  const requestLockRef = useRef(false);

  const clearSession = useCallback(() => {
    sessionRevisionRef.current += 1;
    activeRequestRef.current += 1;
    requestLockRef.current = false;
    const isUserSignedIn = !!getAuthInstance().currentUser;
    const defaultMode = isUserSignedIn ? 'free' : 'local';
    setState({
      ...initialState,
      mode: defaultMode,
      isConnected: false,
    });
    setApiKeyState('');
    setModelOptions([]);
    setIsGenerating(false);
    setLastRequestAt(0);
  }, []);

  useEffect(() => {
    clearAiSessionController = clearSession;
    return () => {
      if (clearAiSessionController === clearSession) clearAiSessionController = null;
    };
  }, [clearSession]);

  const setMode = useCallback((mode: AiMode) => {
    sessionRevisionRef.current += 1;
    activeRequestRef.current += 1;
    requestLockRef.current = false;
    setIsGenerating(false);
    const isUserSignedIn = !!getAuthInstance().currentUser;
    setState(current => ({
      ...current,
      mode,
      isConnected: false,
      isTesting: false,
      lastError: null,
      freeBetaAvailable: mode === 'free' ? null : current.freeBetaAvailable,
      freeStatusReason: mode === 'free' && !isUserSignedIn ? 'guest' : null,
      freeStatusLoading: mode === 'free' && isUserSignedIn,
    }));
    if (mode !== 'byok') {
      setApiKeyState('');
      setModelOptions([]);
    }
  }, []);

  const refreshFreeStatus = useCallback(async () => {
    const currentUser = getAuthInstance().currentUser;
    if (!currentUser) {
      setState(current => ({
        ...current,
        isConnected: false,
        freeBetaAvailable: false,
        freeStatusReason: 'guest',
        freeStatusLoading: false,
        freeActionsRemaining: 0,
        freeResetAt: null,
      }));
      return;
    }

    const uid = currentUser.uid;
    setState(current => ({ ...current, isConnected: false, freeStatusLoading: true, lastError: null }));
    try {
      const response = await fetch('/api/ai/status', {
        method: 'GET',
        headers: {
          'X-Forge-Device': getOrCreateForgeDeviceId(),
        },
      });
      const payload = await response.json().catch(() => null) as null | {
        ok?: boolean;
        freeBetaAvailable?: boolean;
        reason?: FreeAiStatusReason;
        actionsRemaining?: number;
        resetAt?: string;
      };
      if (getAuthInstance().currentUser?.uid !== uid) return;
      const available = response.ok && payload?.ok === true && payload.freeBetaAvailable === true;
      setState(current => ({
        ...current,
        isConnected: current.mode === 'free' && available,
        freeBetaAvailable: available,
        freeStatusReason: available ? null : payload?.reason || 'server_error',
        freeStatusLoading: false,
        freeActionsRemaining: typeof payload?.actionsRemaining === 'number' ? payload.actionsRemaining : null,
        freeResetAt: typeof payload?.resetAt === 'string' ? payload.resetAt : null,
      }));
    } catch {
      if (getAuthInstance().currentUser?.uid !== uid) return;
      setState(current => ({
        ...current,
        isConnected: false,
        freeBetaAvailable: false,
        freeStatusReason: 'server_error',
        freeStatusLoading: false,
      }));
    }
  }, []);

  useEffect(() => {
    if (state.mode === 'free') void refreshFreeStatus();
  }, [refreshFreeStatus, state.mode]);

  useEffect(() => {
    const auth = getAuthInstance();
    const unsub = onAuthStateChanged(auth, user => {
      if (user) {
        if (state.mode === 'local' && state.freeActionsRemaining === null) {
          setMode('free');
        }
      } else if (state.mode === 'free') {
        setMode('local');
      }
    });
    return unsub;
  }, [setMode, state.freeActionsRemaining, state.mode]);

  const forgetKey = useCallback(() => {
    sessionRevisionRef.current += 1;
    activeRequestRef.current += 1;
    requestLockRef.current = false;
    setApiKeyState('');
    setModelOptions([]);
    setState(current => ({
      ...current,
      isConnected: false,
      isTesting: false,
      lastError: null,
      selectedModel: null,
      customModelId: '',
    }));
  }, []);

  const setProvider = useCallback((provider: AiProviderId | null) => {
    sessionRevisionRef.current += 1;
    activeRequestRef.current += 1;
    requestLockRef.current = false;
    setIsGenerating(false);
    setApiKeyState('');
    setState(current => ({
      ...current,
      provider,
      selectedModel: null,
      customModelId: '',
      isConnected: false,
      isTesting: false,
      lastError: null,
    }));
    setModelOptions(provider ? [...AI_PROVIDER_ADAPTERS[provider].defaultModels] : []);
  }, []);

  const setApiKey = useCallback((nextApiKey: string) => {
    sessionRevisionRef.current += 1;
    setApiKeyState(nextApiKey);
    setState(current => ({ ...current, isConnected: false, lastError: null }));
  }, []);

  const setSelectedModel = useCallback((model: string | null) => {
    sessionRevisionRef.current += 1;
    setState(current => ({ ...current, selectedModel: model, isConnected: false, lastError: null }));
  }, []);

  const setCustomModelId = useCallback((model: string) => {
    sessionRevisionRef.current += 1;
    setState(current => ({ ...current, customModelId: model, isConnected: false, lastError: null }));
  }, []);

  const resolveModel = useCallback(() => {
    if (!state.provider) return null;
    return state.customModelId.trim() || state.selectedModel || modelOptions[0] || AI_PROVIDER_ADAPTERS[state.provider].defaultModels[0] || null;
  }, [modelOptions, state.customModelId, state.provider, state.selectedModel]);

  const testConnection = useCallback(async () => {
    if (requestLockRef.current) {
      throw new Error('An AI request is already running.');
    }
    if (state.mode !== 'byok' || !state.provider || !apiKey.trim()) {
      setState(current => ({ ...current, lastError: AI_SAFE_ERROR_MESSAGE }));
      throw new Error(AI_SAFE_ERROR_MESSAGE);
    }

    const adapter = AI_PROVIDER_ADAPTERS[state.provider];
    const model = resolveModel() || adapter.defaultModels[0];
    const sessionRevision = sessionRevisionRef.current;

    requestLockRef.current = true;
    setState(current => ({ ...current, isTesting: true, lastError: null }));
    try {
      const result = await adapter.testConnection({ apiKey: apiKey.trim(), model });
      if (sessionRevisionRef.current !== sessionRevision) throw new Error(AI_SAFE_ERROR_MESSAGE);
      if (!result.ok) throw new Error(result.message || AI_SAFE_ERROR_MESSAGE);
      const nextModels = Array.from(new Set([
        model,
        ...(result.models?.length ? result.models : adapter.defaultModels),
      ]));
      setModelOptions(nextModels);
      setState(current => ({
        ...current,
        selectedModel: current.customModelId.trim() ? current.selectedModel : model,
        isConnected: true,
        isTesting: false,
        lastError: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : AI_SAFE_ERROR_MESSAGE;
      setState(current => ({ ...current, isConnected: false, isTesting: false, lastError: message }));
      throw new Error(message);
    } finally {
      requestLockRef.current = false;
    }
  }, [apiKey, resolveModel, state.mode, state.provider]);

  const generate = useCallback(async (input: Omit<AiGenerateInput, 'apiKey' | 'provider' | 'model'>) => {
    if (requestLockRef.current) {
      throw new Error('An AI request is already running.');
    }
    const usingFreeAi = state.mode === 'free';
    const usingByok = state.mode === 'byok';
    if (usingFreeAi && state.freeBetaAvailable !== true) {
      throw new Error('Forge Free AI is unavailable. Use BYOK or continue manually.');
    }
    if (!usingFreeAi && (!usingByok || !state.provider || !state.isConnected || !apiKey.trim())) {
      throw new Error('AI is disconnected. Reconnect your key to continue.');
    }
    const normalizedInput = input.input.trim();
    if (!normalizedInput) {
      throw new Error('Add some text before running AI help.');
    }
    if (normalizedInput.length > 12000) {
      throw new Error('This text is too long for one AI action. Shorten it and try again.');
    }
    const now = Date.now();
    const cooldownMs = usingFreeAi ? 10000 : 5000;
    if (lastRequestAt && now - lastRequestAt < cooldownMs) {
      throw new Error('Please wait a few seconds before sending another AI request.');
    }

    const adapter = state.provider ? AI_PROVIDER_ADAPTERS[state.provider] : null;
    const model = usingByok ? resolveModel() : null;
    if (usingByok && (!adapter || !model)) {
      throw new Error('AI is disconnected. Reconnect your key to continue.');
    }

    const sessionRevision = sessionRevisionRef.current;
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    requestLockRef.current = true;
    setIsGenerating(true);
    setState(current => ({ ...current, lastError: null }));
    setLastRequestAt(now);
    try {
      if (usingFreeAi) {
        const currentUser = getAuthInstance().currentUser;
        if (!currentUser) throw new Error(FREE_AI_ERRORS.AUTH_REQUIRED);
        const forgeDeviceId = getOrCreateForgeDeviceId();
        const response = await fetch('/api/ai/action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forge-Device': forgeDeviceId,
          },
          body: JSON.stringify({
            task: input.task,
            input: normalizedInput,
            tone: input.tone,
            rewriteStyle: input.rewriteStyle,
            maxOutputTokens: Math.min(input.maxOutputTokens || 1200, 1200),
          }),
        });
        const payload = await response.json().catch(() => null) as null | {
          ok?: boolean;
          text?: string;
          actionsRemaining?: number;
          provider?: 'groq' | 'cerebras' | 'gemini';
          code?: string;
        };
        if (sessionRevisionRef.current !== sessionRevision || activeRequestRef.current !== requestId) {
          throw new Error('AI session changed. Run the action again if needed.');
        }
        if (!response.ok || !payload?.ok || typeof payload.text !== 'string') {
          const unavailableReason: FreeAiStatusReason | null = payload?.code === 'MISSING_PROVIDER_KEYS'
            ? 'missing_provider_keys'
            : payload?.code === 'QUOTA_STORE_MISSING' || payload?.code === 'QUOTA_STORE_UNAVAILABLE'
              ? 'quota_store_missing'
            : payload?.code === 'FREE_BETA_DISABLED'
              ? 'env_disabled'
              : payload?.code === 'SERVER_ERROR'
                ? 'server_error'
                : payload?.code === 'AUTH_REQUIRED'
                  ? 'guest'
                  : null;
          if (unavailableReason) {
            setState(current => ({
              ...current,
              isConnected: false,
              freeBetaAvailable: false,
              freeStatusReason: unavailableReason,
              freeStatusLoading: false,
            }));
          }
          throw new Error(FREE_AI_ERRORS[payload?.code || ''] || 'Forge Free AI is unavailable. Use BYOK or continue manually.');
        }
        const text = payload.text
          .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
          .trim()
          .slice(0, 12000);
        if (!text) throw new Error('Forge Free AI is unavailable. Use BYOK or continue manually.');
        setState(current => ({
          ...current,
          freeActionsRemaining: typeof payload.actionsRemaining === 'number' ? payload.actionsRemaining : current.freeActionsRemaining,
          freeProvider: payload.provider || null,
          freeBetaAvailable: true,
          freeStatusReason: null,
          isConnected: true,
          lastError: null,
        }));
        return { text, actionsRemaining: payload.actionsRemaining, provider: payload.provider };
      }

      const prompt = buildAiPrompt({ task: input.task, input: normalizedInput, tone: input.tone, rewriteStyle: input.rewriteStyle });
      const result = await adapter!.generate({
        ...input,
        input: normalizedInput,
        apiKey: apiKey.trim(),
        provider: state.provider!,
        model: model!,
        maxOutputTokens: Math.min(input.maxOutputTokens || 1200, 1200),
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
      });
      if (sessionRevisionRef.current !== sessionRevision || activeRequestRef.current !== requestId) {
        throw new Error('AI session changed. Run the action again if needed.');
      }
      const text = result.text
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim()
        .slice(0, 12000);
      if (!text) throw new Error(AI_SAFE_ERROR_MESSAGE);
      return { text };
    } catch (error) {
      const message = error instanceof Error ? error.message : AI_SAFE_ERROR_MESSAGE;
      setState(current => ({ ...current, lastError: message }));
      throw new Error(message);
    } finally {
      if (activeRequestRef.current === requestId) {
        requestLockRef.current = false;
        setIsGenerating(false);
      }
    }
  }, [apiKey, lastRequestAt, resolveModel, state.freeBetaAvailable, state.isConnected, state.mode, state.provider]);

  const value = useMemo<AiSessionContextValue>(() => ({
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
    refreshFreeStatus,
    forgetKey,
    generate,
    clearSession,
  }), [apiKey, clearSession, forgetKey, generate, isGenerating, modelOptions, refreshFreeStatus, setApiKey, setCustomModelId, setMode, setProvider, setSelectedModel, state, testConnection]);

  return <AiSessionContext.Provider value={value}>{children}</AiSessionContext.Provider>;
}

export function useAiSession() {
  const context = useContext(AiSessionContext);
  if (!context) throw new Error('useAiSession must be used within AiSessionProvider');
  return context;
}

export const AI_PROVIDER_CHOICES = AI_PROVIDER_OPTIONS;
