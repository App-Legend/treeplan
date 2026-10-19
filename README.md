# 섞어봄 (앱 레전드 · 2조)

분야별 무작위 단어 3개에서 출발해 AI로 아이디어와 실행안까지 얻는 반응형 웹 발상 보조 시스템.
2~6주차 문서(요구사항 · 기획서 · 화면 명세 · 시스템 아키텍처)를 그대로 따라 만든 MVP입니다.

| 상자 | 기술 | 폴더 |
|---|---|---|
| 웹 클라이언트 | React 18 + TypeScript (Vite) | `frontend/` |
| API 서버 (+ 실시간 채널) | Spring Boot 3.5, Spring Security + JWT, WebSocket/STOMP | `backend/` |
| 데이터베이스 | PostgreSQL 16 | `docker-compose.yml` |
| AI 생성 서비스 | Gemini API (키가 없으면 예시 모드) | `backend/.../ai/` |

---

## 1. 실행 방법

### 준비물
- Node.js 20 이상
- Docker Desktop (PostgreSQL용)
- JDK 21 이상 — 방법 B로 API 서버까지 Docker로 띄우면 필요 없음

### 방법 A: DB만 Docker, API 서버는 직접 실행 (개발용 권장)

```bash
# 1) DB
docker compose up -d db

# 2) API 서버 (http://localhost:8080/api)
cd backend
export GEMINI_API_KEY=발급받은키        # 생략하면 예시 모드
./gradlew bootRun                        # Windows: gradlew.bat bootRun

# 3) 웹 (http://localhost:5173)
cd frontend
npm install
npm run dev
```

### 방법 B: DB + API 서버를 모두 Docker로

```bash
cp .env.example .env      # GEMINI_API_KEY, JWT_SECRET 채우기
docker compose up -d --build
cd frontend && npm install && npm run dev
```

브라우저에서 http://localhost:5173 → **새로 시작하기** → 회원가입 → 카테고리 선택 → 단어 3개 → **창조** 순서로 핵심 흐름을 확인할 수 있습니다.
팀 기능은 다른 브라우저(또는 시크릿 창)에서 다른 계정으로 가입한 뒤 화면 상단의 팀 코드로 입장하면 됩니다.

### 환경변수 (API 서버)

| 이름 | 기본값 | 설명 |
|---|---|---|
| `GEMINI_API_KEY` | (없음) | 없으면 **예시(mock) 모드**. 결과에 "예시 모드" 표시가 붙음. 시연 대비용(위험 3) |
| `GEMINI_MODEL` | `gemini-3.8-flash` | 아이디어·결과물 생성 모델. `gemini-2.5-flash`는 새 사용자에게 제공되지 않음(2026-10 확인) |
| `GEMINI_WORD_MODEL` | `gemini-3.5-flash-lite` | 단어 트리 가지 뻗기 모델. 자주 호출되므로 빠른 모델 (측정 약 1~2초) |
| `GEMINI_FALLBACK_MODEL` | `gemini-3.5-flash,gemini-3.1-flash-lite` | 기본 모델이 시간 초과·503·429·404로 실패하면 쉼표 순서대로 대신 쓰는 모델들. 비우면 사용 안 함 |
| `AI_TIMEOUT_SECONDS` / `AI_WORD_TIMEOUT_SECONDS` / `AI_FALLBACK_TIMEOUT_SECONDS` | `45` / `20` / `60` | AI 응답 대기 시간. 기본 모델은 평소 10~15초라, 45초를 넘기면 기다리지 않고 대체 모델로 넘어감 |
| `JWT_SECRET` | 개발용 값 | 32바이트 이상. 배포 시 반드시 변경 |
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | 로컬 compose 값 | |
| `CORS_ORIGINS` | `http://localhost:5173` | 쉼표로 여러 개 |
| `DB_PORT` (compose) | `5433` | 호스트에서 여는 DB 포트. 다른 PostgreSQL이 5433을 쓰면 `5434` 등으로 바꾸고 `DB_URL`도 맞출 것 |
| `PDF_FONT_PATH` | (자동 탐색) | PDF 내보내기용 한글 TTF 경로 |

### 테스트

```bash
cd backend && ./gradlew test        # 핵심 흐름 통합 테스트 (H2 + 예시 AI, DB 불필요)
cd frontend && npm run build        # 타입 검사 + 빌드
```

`CoreFlowTest`는 가입 → 세션 생성(멱등 키) → 단어 추출 20회(항상 3개·같은 분야만) → 고정/제외 → 창조 → 결과물(양식 항목·조합 이유 포함) → 수정·보완·내보내기 → 팀원 입장·권한 → 히스토리 → 삭제 → 세션 종료까지 확인합니다.

---

## 2. 문서와 코드의 대응

### 화면 → 코드
| 화면 | 파일 |
|---|---|
| 1 시작·팀 입장 | `frontend/src/pages/StartPage.tsx` |
| 2 카테고리·단어 트리 (+팀 정보·실시간) | `pages/SessionPage.tsx`, `components/WordTreeView.tsx` |
| 3/4 아이디어 생성 팝업 | `components/IdeaPopup.tsx` |
| 5 결과물 | `pages/ResultPage.tsx` |
| 6 로그인 | `components/LoginModal.tsx` |
| 7 히스토리 사이드바 | `components/HistorySidebar.tsx` |

### API 24개 (모두 `/api` 아래)
| 화면 | 요청 | 컨트롤러 |
|---|---|---|
| 1 | `POST /sessions` (헤더 `Idempotency-Key`), `POST /sessions/join` | `SessionController` |
| 2 | `GET /sessions/{id}`, `DELETE /sessions/{id}/members/me`, `POST /sessions/{id}/close` | `SessionController` |
| 2 | `GET /categories`, `GET /categories/{id}/words?sessionId=` (뿌리 3개 + 세션 트리), `POST /words/{id}/expand` (AI 가지 뻗기) | `CategoryController`, `WordTreeService` |
| 2 | WS 구독 `/topic/sessions/{id}/events` (엔드포인트 `/api/ws`) | `WebSocketConfig` |
| 2, 4 | `POST /sessions/{id}/draws` | `DrawController` |
| 4 | `POST /draws/{id}/idea`, `PUT /ideas/{id}/bookmark` | `IdeaController` |
| 4~5 | `POST /ideas/{id}/result`, `GET·PATCH·DELETE /results/{id}`, `POST /results/{id}/regenerate`, `GET /results/{id}/export?format=pdf\|txt\|md` | `ResultController` |
| 6 | `POST /auth/guest` (로그인 없이 시작), `/auth/login`, `/auth/signup`, `/auth/password-reset`, `/auth/refresh` | `AuthController` |
| 7 | `GET /history?q=&categoryId=&cursor=` | `HistoryController` |

30일 무활동 만료는 API가 아니라 `SessionExpiryJob`(매일 04:00, 서울 시간)이 처리합니다.

### 데이터 덩어리 10개
User · RefreshToken · Session(`IdeaSession`) · SessionMember · Category · WordNode · ResultTemplate · Draw · Idea · Result.
처음 실행할 때 `DataSeeder`가 고정 카테고리 3개, 카테고리별 고정 하위 카테고리 3개(트리의 뿌리), 절차 템플릿(결과물 양식)을 넣습니다.
단어는 미리 넣지 않고 **세션마다 AI가 뻗습니다(뿌리당 최대 20개)**. 하위 카테고리 이름은 `category/Subcategories.java`에 있으며 팀 확정 전 임시 값입니다. 이름을 바꾸면 다음 실행 때 뿌리가 자동으로 새 구성으로 맞춰집니다(세션 단어·기록은 유지).

### 비로그인(게스트) 흐름
1. 화면이 시작할 때 토큰이 없으면 `POST /auth/guest`로 게스트 토큰을 받아 그대로 모든 API에 씁니다.
2. 결과물 응답의 `saved`가 `false`면 `loginPrompt`("히스토리로 남기고 싶다면 로그인해 주세요. 나가면 저장되지 않습니다.")로 팝업을 띄웁니다.
3. 팝업에서 로그인·가입할 때 **게스트 토큰을 `Authorization` 헤더로 함께 보내면** 게스트 작업이 계정으로 옮겨져 히스토리에 남습니다.
4. 게스트는 히스토리 조회·팀 코드 입장이 막히고(`403 LOGIN_REQUIRED`), 세션 응답의 `teamCode`가 `null`입니다(협업은 로그인 필요).

### 팀이 직접 다듬어야 할 핵심 파일
- `backend/.../ai/PromptBuilder.java` — AI 공통 지시문 (세 단어 모두 사용, 진부함 회피, 사실 단정 금지)
- `backend/.../ai/PromptBuilder.java`의 `wordsPrompt` — AI 단어 생성 지시문 (분야·하위 카테고리 범위, 중복 금지)
- `backend/.../category/Subcategories.java` — 하위 카테고리 이름(임시)과 예시 모드용 단어
- `backend/.../seed/DataSeeder.java` — 분야별 결과물 양식·지시문. 양식을 고친 뒤에는 DB의 `categories`, `result_templates`를 비우고 재실행

---

## 3. 확인해야 할 부분

### 3-1. 먼저 꼭 확인할 것
1. **백엔드는 아직 한 번도 컴파일·실행되지 않았습니다.** 작업 환경에서 Maven Central 접속이 막혀 의존성을 받을 수 없었기 때문입니다. 받는 즉시 `./gradlew test`를 돌려 주세요. 컴파일 오류나 테스트 실패가 나면 그 메시지를 알려 주면 고치겠습니다.
2. **프론트엔드는 검증했습니다.** 타입 검사·빌드를 통과했고, API 계약대로 응답하는 임시 서버를 붙여 헤드리스 브라우저에서 가입 → 카테고리 → 고정 후 다시 뽑기 → 창조 → 보관 → 결과물 → 수정 → 보완 → MD 내보내기 → 히스토리, 그리고 390px 모바일 화면(가로 스크롤 없음)까지 확인했습니다. 실제 Spring 서버와 연결한 상태의 확인은 아직입니다.
3. **Gemini 모델 이름과 무료 사용량**: 기본값 `gemini-2.5-flash`가 지금 팀 키로 쓸 수 있는지 Google AI Studio에서 확인하고, 다르면 `GEMINI_MODEL`만 바꾸면 됩니다. 응답은 JSON 모드로 받습니다.

### 3-2. 문서끼리 어긋나거나 비어 있어 제가 정한 것 (팀 회의에서 확정 필요)
| 항목 | 문서 상황 | 이렇게 구현함 |
|---|---|---|
| 추출 카테고리 수 | 6주차 API는 "카테고리 1개 이상(목록)", 3주차 데이터 요구사항은 "다른 분야와 섞지 않음" | 요구사항을 우선해 **1개만 허용** (여러 개 보내면 400) |
| 로그인 필수 여부 | 기획 변경: 로그인 없이 작업, 결과 양식 생성 시 로그인 권유 | **게스트 토큰**으로 핵심 흐름 전체 사용. 로그인하면 게스트 작업을 계정으로 이전 |
| 팀 코드 (3주차 ⚠️) | 협업인지 공유인지 미정 → 6주차에서 "참여자 모두 열람" 결정 | 6주차 결정대로. 공동 편집은 없고 입장·퇴장·새 결과물·종료 **알림만** 실시간 (기획서 Won't "실시간 다중 사용자 협업"과의 경계) |
| 종료·만료 세션 | 진행 여부 확인 범위가 불명확 | 결과물 **열람·내보내기는 허용**, 생성·수정은 차단 |
| 로그인 연속 실패 | "연속 실패 횟수 확인"만 명시 | 5회 실패 시 5분 잠금 (User에 필드 2개 추가) |
| 조회용 중복 저장 | 6주차가 선택 사항으로 둠 | 결과물에 단어 3개·카테고리명·제목 복사, 아이디어에 세션·카테고리 ID 저장 |
| 실시간 채널 경로 | `WS /sessions/{id}/events` | STOMP 엔드포인트 `/api/ws` + 구독 주소 `/topic/sessions/{id}/events` |
| 조합 이유 위치 | 결과에 함께 보여야 함 (요구사항 5) | 모든 양식의 마지막 항목 `조합 이유`로 생성 |

### 3-3. 아직 없는 것
- **사용자 정의 카테고리·단어 추가** (유저 스토리 8, Should, 11주차 일정) — 미구현
- **비밀번호 재설정 메일 발송** — 아키텍처에 메일 서비스가 없어 요청 접수 응답만 줌 (계정 존재 여부는 드러내지 않음)
- **DB 마이그레이션 도구 없음** — `ddl-auto: update`로 스키마 자동 생성. 운영 전에 Flyway 도입 권장

### 3-4. 비기능 요구사항 확인 방법 (문서의 '확인 방법' 그대로)
| 요구사항 | 확인 방법 |
|---|---|
| 성능: 3분 안에 완료, 진행 상태 표시, 실패 시 조합 유지 후 재시도 | 처음 쓰는 참가자 5명 시간 측정. 실패 강제: `GEMINI_API_KEY`를 일부러 틀린 값으로 넣고 실행 → 팝업에 실패 이유와 "같은 조합으로 다시 시도"가 나오는지 |
| 보안: API 키 브라우저 미노출 | 개발자 도구 → 소스·네트워크에서 키 검색 (키는 서버의 `x-goog-api-key` 헤더로만 나감) |
| 데이터: 분야 혼합 없음, 3개 미만 생성 불가, 근거 단어·조합 이유 포함 | `CoreFlowTest`가 자동 확인 |

### 3-5. 알아 둘 점
- 로그인 토큰은 브라우저 `localStorage`에 저장합니다(수업 MVP 수준). XSS가 생기면 토큰이 노출될 수 있어 운영 단계에서는 HttpOnly 쿠키로 바꾸는 것이 안전합니다.
- PDF 내보내기는 서버에 한글 폰트가 필요합니다. Docker 실행은 나눔고딕을 설치하고, 직접 실행하면 Windows 맑은 고딕·macOS AppleGothic을 자동으로 찾습니다. 못 찾으면 안내 메시지와 함께 TXT/MD를 쓰도록 합니다.
- 화면 글꼴은 Pretendard(CDN)를 쓰고, 연결이 안 되면 시스템 한글 글꼴로 대체됩니다.
