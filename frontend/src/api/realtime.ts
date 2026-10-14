import { Client } from '@stomp/stompjs';
import { useEffect, useRef, useState } from 'react';
import { API_BASE, accessToken } from './client';
import type { SessionEvent } from './types';

function wsUrl(): string {
  if (/^https?:\/\//.test(API_BASE)) return API_BASE.replace(/^http/, 'ws') + '/ws';
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}${API_BASE}/ws`;
}

export type ChannelState = 'connecting' | 'live' | 'offline';

/**
 * 실시간 채널(화살표 ⑨) 구독. 서버가 먼저 보내는 참여자 입장·퇴장, 새 결과물, 세션 종료 알림을 받는다.
 * 연결이 끊겨도 화면의 다른 기능은 그대로 동작하고, 5초마다 다시 연결을 시도한다.
 */
export function useSessionEvents(sessionId: number | null, onEvent: (e: SessionEvent) => void): ChannelState {
  const [state, setState] = useState<ChannelState>('connecting');
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (sessionId == null) return;
    const client = new Client({
      brokerURL: wsUrl(),
      reconnectDelay: 5000,
      heartbeatIncoming: 20000,
      heartbeatOutgoing: 20000,
      beforeConnect: async () => {
        // 재연결할 때마다 최신 액세스 토큰을 싣는다.
        client.connectHeaders = { Authorization: `Bearer ${accessToken() ?? ''}` };
      },
      onConnect: () => {
        setState('live');
        client.subscribe(`/topic/sessions/${sessionId}/events`, (msg) => {
          try {
            handler.current(JSON.parse(msg.body) as SessionEvent);
          } catch {
            /* 형식이 다른 메시지는 무시 */
          }
        });
      },
      onWebSocketClose: () => setState('offline'),
      onStompError: () => setState('offline'),
    });
    setState('connecting');
    client.activate();
    return () => {
      void client.deactivate();
    };
  }, [sessionId]);

  return state;
}
