// 실시간 알림 받기 (서버 → 화면). 서버의 STOMP 채널 /api/ws 에 브라우저 기본 WebSocket으로 붙는다.
// 세션(작업방)마다 /topic/sessions/{id}/events 를 구독하고, 팀원이 한 일을 알림으로 받는다.
// 화면은 듣기만 한다(보내기는 서버가 막음). 연결이 끊기면 3초 뒤 다시 붙는다.

export type SessionEvent = {
  type: "MEMBER_JOINED" | "MEMBER_LEFT" | "TREE_EXPANDED" | "TREE_RESET" | "RESULT_CREATED" | "SESSION_CLOSED";
  sessionId: number;
  at: string;
  data: Record<string, unknown>;
};

const NUL = "\u0000";

function frame(command: string, headers: Record<string, string>) {
  return command + "\n" + Object.entries(headers).map(([k, v]) => `${k}:${v}`).join("\n") + "\n\n" + NUL;
}

/** 세션 알림 구독을 시작하고, 끝낼 때 부를 함수를 돌려준다 */
export function subscribeSession(
  sessionId: number,
  getToken: () => string | undefined,
  onEvent: (e: SessionEvent) => void,
): () => void {
  let ws: WebSocket | null = null;
  let stopped = false;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const connect = () => {
    const token = getToken();
    if (!token || stopped) return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/api/ws`);
    ws.onopen = () => {
      ws!.send(frame("CONNECT", { "accept-version": "1.2", "heart-beat": "0,0", Authorization: "Bearer " + token }));
    };
    ws.onmessage = (msg) => {
      for (const raw of String(msg.data).split(NUL)) {
        const text = raw.replace(/^\n+/, "");
        if (!text) continue;
        const command = text.slice(0, text.indexOf("\n"));
        const body = text.slice(text.indexOf("\n\n") + 2);
        if (command === "CONNECTED") {
          ws!.send(frame("SUBSCRIBE", { id: "s-" + sessionId, destination: `/topic/sessions/${sessionId}/events` }));
        } else if (command === "MESSAGE") {
          try {
            onEvent(JSON.parse(body) as SessionEvent);
          } catch {
            /* 형식이 다른 메시지는 무시 */
          }
        }
      }
    };
    ws.onclose = () => {
      if (!stopped) retry = setTimeout(connect, 3000);
    };
  };

  connect();
  return () => {
    stopped = true;
    if (retry) clearTimeout(retry);
    ws?.close();
  };
}
