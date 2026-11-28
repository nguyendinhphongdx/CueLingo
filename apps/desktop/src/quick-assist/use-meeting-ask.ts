import { ApiError } from '@cuelingo/core-sdk';
import { MEETING_QUESTION_MAX, type MeetingAnswerSource } from '@cuelingo/shared';
import type { MeetingAnswerState } from '@cuelingo/ui/components/meeting-answer';
import { quotaExceededMessage } from '@cuelingo/ui/lib/usage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { native } from '../lib/native';
import { useTranscriptStore } from '../overlay/transcript-store';
import { meetingAssistApi, type MeetingAssistApi } from './meeting-assist-api';

export interface AskFocus {
  segmentId?: string;
  text: string;
}

export interface MeetingTurn {
  question: string;
  focus?: AskFocus;
  detail?: boolean;
  text: string;
  status: MeetingAnswerState;
  sources: MeetingAnswerSource[];
  error?: string;
}

export type Availability = 'unknown' | 'available' | 'unavailable';

export interface MeetingAskState {
  open: boolean;
  availability: Availability;
  /** Null until the server has said. */
  consent: boolean | null;
  input: string;
  turn: MeetingTurn | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FALLBACK = 'Không trả lời được lúc này. Tra từ và Nói giúp vẫn dùng được.';

/** The latest finished sentence of the meeting, for the suggestion buttons. Kept in memory only. */
export function lastSentence(): AskFocus | undefined {
  const segment = useTranscriptStore
    .getState()
    .segments.findLast((item) => !item.partial && item.text.trim());
  return segment ? { segmentId: segment.segmentId, text: segment.text } : undefined;
}

function messageOf(error: unknown): string {
  if (!(error instanceof ApiError)) return FALLBACK;
  if (error.code === 'QUOTA_EXCEEDED') return quotaExceededMessage('meeting_ask_daily');
  if (error.code === 'CONFLICT') return 'Câu trước chưa trả lời xong. Thử lại sau vài giây.';
  if (error.code === 'MEETING_ASSIST_DISABLED') return 'Trợ lý đang tắt.';
  if (error.code === 'NOT_FOUND') return 'Chưa thấy cuộc họp này trên máy chủ.';
  return FALLBACK;
}

/**
 * The assistant of the running meeting: whether the server offers it, the consent, the typed question and
 * one answer at a time. Nothing of a question or an answer is logged or kept on this machine.
 */
export function useMeetingAsk({
  listen = true,
  api = meetingAssistApi,
}: { listen?: boolean; api?: MeetingAssistApi } = {}) {
  const sessionId = useTranscriptStore((store) => store.sessionId);
  const [state, setState] = useState<MeetingAskState>({
    open: false,
    availability: 'unknown',
    consent: null,
    input: '',
    turn: null,
  });
  const [openCount, setOpenCount] = useState(0);
  const running = useRef<AbortController | null>(null);
  /** A question waiting for the person to agree. */
  const pending = useRef<{ question: string; focus?: AskFocus } | null>(null);
  const consent = useRef<boolean | null>(null);

  const know = useCallback((availability: Availability, agreed: boolean | null) => {
    consent.current = agreed;
    setState((current) => ({ ...current, availability, consent: agreed }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const status = await api.status();
      know(status.enabled ? 'available' : 'unavailable', status.consent);
    } catch (error) {
      // A server without the route does not offer it; any other failure says nothing either way.
      if (error instanceof ApiError && error.status === 404) know('unavailable', null);
    }
  }, [api, know]);

  const abort = useCallback(() => {
    running.current?.abort();
    running.current = null;
  }, []);

  useEffect(() => {
    if (listen) void refresh();
  }, [listen, refresh, sessionId]);

  // A new meeting starts clean; leaving the overlay stops the answer.
  useEffect(() => {
    abort();
    pending.current = null;
    setState((current) => ({ ...current, turn: null }));
    return abort;
  }, [sessionId, abort]);

  const send = useCallback(
    async (question: string, focus?: AskFocus, detail?: boolean) => {
      const trimmed = question.trim().slice(0, MEETING_QUESTION_MAX);
      const meeting = useTranscriptStore.getState().sessionId;
      if (!trimmed || !meeting) return;
      setOpenCount((count) => count + 1);
      if (running.current) {
        // One answer at a time: bring the one being written to the front.
        setState((current) => ({ ...current, open: true }));
        return;
      }
      // Unknown counts as agreed here: the server refuses without a consent, and that shows the card.
      if (consent.current === false) {
        pending.current = { question: trimmed, focus };
        setState((current) => ({ ...current, open: true }));
        return;
      }
      const controller = new AbortController();
      running.current = controller;
      let turn: MeetingTurn = {
        question: trimmed,
        focus,
        detail,
        text: '',
        status: 'searching',
        sources: [],
      };
      const show = (patch: Partial<MeetingTurn>) => {
        if (running.current !== controller) return;
        turn = { ...turn, ...patch };
        const next = turn;
        setState((current) => ({ ...current, turn: next }));
      };
      setState((current) => ({ ...current, open: true, turn }));
      try {
        await api.ask(
          meeting,
          {
            question: trimmed,
            ...(focus?.text.trim()
              ? {
                  focus: {
                    ...(focus.segmentId && UUID.test(focus.segmentId)
                      ? { segmentId: focus.segmentId }
                      : {}),
                    text: focus.text.slice(0, 2_000),
                  },
                }
              : {}),
            ...(detail ? { detail: true } : {}),
          },
          {
            signal: controller.signal,
            onEvent(event) {
              if (event.type === 'status') show({ status: event.status });
              else if (event.type === 'text_delta') show({ text: turn.text + event.text });
              else if (event.type === 'sources') show({ sources: event.items });
              else if (event.type === 'error') show({ status: 'error', error: FALLBACK });
              else if (event.type === 'done') {
                show({ status: event.status });
                // What was typed stays until it has been answered.
                if (event.status !== 'error') {
                  setState((current) =>
                    current.input.trim() === trimmed ? { ...current, input: '' } : current,
                  );
                }
              }
            },
          },
        );
      } catch (error) {
        if (error instanceof ApiError && error.code === 'MEETING_ASSIST_CONSENT_REQUIRED') {
          pending.current = { question: trimmed, focus };
          consent.current = false;
          setState((current) => ({ ...current, consent: false, turn: null }));
        } else {
          show({ status: 'error', error: messageOf(error) });
        }
      } finally {
        if (running.current === controller) running.current = null;
      }
    },
    [api],
  );

  const open = useCallback(() => {
    setOpenCount((count) => count + 1);
    setState((current) => ({ ...current, open: true }));
    void refresh();
  }, [refresh]);

  const available = state.availability === 'available';
  useEffect(() => {
    if (!listen || state.availability === 'unknown') return;
    // Without the key the button still works.
    void native.setAskHotkey(state.availability === 'available').catch(() => undefined);
  }, [listen, state.availability]);

  useEffect(() => {
    if (!listen || !available) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void native
      .onHotkey(({ action }) => {
        if (action === 'ask') open();
      })
      .then((stopListening) => {
        if (disposed) stopListening();
        else unlisten = stopListening;
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [listen, available, open]);

  return {
    state,
    sessionId,
    openCount,
    refresh: () => void refresh(),
    open,
    close() {
      abort();
      pending.current = null;
      setState((current) => ({
        ...current,
        open: false,
        turn:
          current.turn && ['searching', 'answering'].includes(current.turn.status)
            ? { ...current.turn, status: 'stopped' }
            : current.turn,
      }));
    },
    setInput(input: string) {
      setState((current) => ({ ...current, input }));
    },
    ask: (question: string, focus?: AskFocus) => void send(question, focus),
    stop() {
      abort();
      setState((current) =>
        current.turn ? { ...current, turn: { ...current.turn, status: 'stopped' } } : current,
      );
    },
    retry() {
      const turn = state.turn;
      if (turn) void send(turn.question, turn.focus, turn.detail);
    },
    more() {
      const turn = state.turn;
      if (turn) void send(turn.question, turn.focus, true);
    },
    /** Records the consent on the server, then sends the question that was waiting for it. */
    async agree() {
      try {
        const status = await api.setConsent(true);
        know(status.enabled ? 'available' : 'unavailable', status.consent);
      } catch {
        return false;
      }
      const waiting = pending.current;
      pending.current = null;
      if (waiting) void send(waiting.question, waiting.focus);
      return true;
    },
  };
}

export type MeetingAsk = ReturnType<typeof useMeetingAsk>;
