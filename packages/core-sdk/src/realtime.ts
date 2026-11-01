import {
  ServerMessageSchema,
  type ClientMessage,
  type HelloMessage,
  type ServerMessage,
} from '@cuelingo/shared';

const BUFFER_TTL_MS = 60_000;
const RECONNECT_DELAYS_MS = [500, 1_000, 2_000, 4_000, 8_000] as const;

export type RealtimeState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface RealtimeSocket {
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: (() => void) | null;
  send(data: string): void;
  close(): void;
}

export interface RealtimeClientOptions {
  url: string;
  token: string;
  sessionId: string;
  assistLevel: number;
  createSocket?: (url: string) => RealtimeSocket;
  now?: () => number;
  onMessage: (message: ServerMessage) => void;
  onState: (state: RealtimeState) => void;
  onError: (error: Error) => void;
}

export interface RealtimeClient {
  connect(): void;
  send(message: ClientMessage): void;
  close(): void;
  readonly state: RealtimeState;
}

interface BufferedMessage {
  message: ClientMessage;
  queuedAt: number;
}

export function createRealtimeClient(options: RealtimeClientOptions): RealtimeClient {
  const createSocket =
    options.createSocket ?? ((url: string) => new WebSocket(url) as unknown as RealtimeSocket);
  const now = options.now ?? Date.now;
  const hello: HelloMessage = {
    type: 'hello',
    sessionId: options.sessionId,
    token: options.token,
    sttSource: 'local',
    assistLevel: options.assistLevel,
  };

  let currentState: RealtimeState = 'idle';
  let socket: RealtimeSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempt = 0;
  let manuallyClosed = false;
  let buffer: BufferedMessage[] = [];

  function setState(next: RealtimeState) {
    if (currentState === next) return;
    currentState = next;
    options.onState(next);
  }

  function pruneBuffer() {
    const cutoff = now() - BUFFER_TTL_MS;
    buffer = buffer.filter(({ queuedAt }) => queuedAt >= cutoff);
  }

  function sendSerialized(target: RealtimeSocket, message: ClientMessage) {
    target.send(JSON.stringify(message));
  }

  function flushBuffer(target: RealtimeSocket) {
    pruneBuffer();
    const pending = buffer;
    buffer = [];

    for (let index = 0; index < pending.length; index += 1) {
      const item = pending[index];
      if (!item) continue;
      try {
        sendSerialized(target, item.message);
      } catch (error) {
        buffer = pending.slice(index);
        options.onError(error instanceof Error ? error : new Error('WebSocket send failed'));
        break;
      }
    }
  }

  function scheduleReconnect() {
    if (manuallyClosed) return;
    setState('reconnecting');
    const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      openSocket();
    }, delay);
  }

  function handleServerData(data: unknown, target: RealtimeSocket) {
    let decoded: unknown;
    try {
      if (typeof data !== 'string') throw new Error('WebSocket message must be text');
      decoded = JSON.parse(data);
    } catch (error) {
      options.onError(error instanceof Error ? error : new Error('Invalid WebSocket message'));
      return;
    }

    const parsed = ServerMessageSchema.safeParse(decoded);
    if (!parsed.success) {
      options.onError(parsed.error);
      return;
    }

    if (parsed.data.type === 'ready') {
      reconnectAttempt = 0;
      setState('open');
      flushBuffer(target);
    }
    options.onMessage(parsed.data);
  }

  function openSocket() {
    let nextSocket: RealtimeSocket;
    try {
      nextSocket = createSocket(options.url);
    } catch (error) {
      options.onError(error instanceof Error ? error : new Error('WebSocket connection failed'));
      scheduleReconnect();
      return;
    }

    socket = nextSocket;
    nextSocket.onopen = () => {
      if (socket !== nextSocket || manuallyClosed) return;
      try {
        sendSerialized(nextSocket, hello);
      } catch (error) {
        options.onError(error instanceof Error ? error : new Error('WebSocket hello failed'));
      }
    };
    nextSocket.onmessage = (event) => {
      if (socket !== nextSocket || manuallyClosed) return;
      handleServerData(event.data, nextSocket);
    };
    nextSocket.onerror = () => {
      if (socket !== nextSocket || manuallyClosed) return;
      options.onError(new Error('WebSocket error'));
    };
    nextSocket.onclose = () => {
      if (socket !== nextSocket || manuallyClosed) return;
      socket = null;
      scheduleReconnect();
    };
  }

  return {
    connect() {
      if (
        currentState === 'connecting' ||
        currentState === 'open' ||
        currentState === 'reconnecting'
      ) {
        return;
      }
      manuallyClosed = false;
      reconnectAttempt = 0;
      setState('connecting');
      openSocket();
    },
    send(message) {
      if (currentState === 'open' && socket) {
        try {
          sendSerialized(socket, message);
          return;
        } catch (error) {
          options.onError(error instanceof Error ? error : new Error('WebSocket send failed'));
        }
      }
      pruneBuffer();
      buffer.push({ message, queuedAt: now() });
    },
    close() {
      manuallyClosed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      const currentSocket = socket;
      socket = null;
      currentSocket?.close();
      setState('closed');
    },
    get state() {
      return currentState;
    },
  };
}
