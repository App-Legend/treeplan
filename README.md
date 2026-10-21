# 🌳 TreePlan

> **단어 세 개에서 시작하는 발상.**
> 분야를 고르면 AI가 단어 트리를 뻗고, 마음에 드는 단어 3개를 고정하면 AI가 아이디어와 분야별 실행안까지 만들어 주는 반응형 웹 서비스입니다.

앱 레전드 · 2조

---

## ✨ 핵심 기능

| 기능 | 설명 |
|---|---|
| **AI 단어 트리** | 분야마다 고정 하위 카테고리 3개가 트리의 뿌리. 단어를 누르면 AI가 관련 단어를 **한 번에 3개씩, 하위 카테고리마다 최대 10번** 뻗음 |
| **노드 접기·펼치기 / 트리 초기화** | 복잡해진 가지는 접어 두고, 마음에 안 들면 초기화. "고정한 단어는 남기기"를 체크하면 고정 단어만 하위 카테고리 바로 아래로 올려 남김 |
| **아이디어 → 실행안** | 고정한 단어 3개로 AI가 아이디어를 만들고, 분야별 양식에 맞춘 실행안을 생성. 마지막 항목은 항상 **조합 이유** |
| **게스트 모드** | 로그인 없이 바로 시작. 결과를 남기려면 로그인하면 되고, 그동안 만든 작업은 계정의 히스토리로 옮겨짐 |
| **팀 코드 · 실시간 반영** | 세션(작업방)마다 6자리 팀 코드. 팀원이 들어오면 같은 트리와 결과물을 보고, 누가 트리를 바꾸면 WebSocket으로 다른 화면에 바로 반영 |
| **AI 자동 전환** | Gemini가 늦거나 혼잡하면 예비 모델로 차례로 넘어감. 키가 없으면 예시(mock) 모드로 동작 |
| **내보내기 · 히스토리** | 실행안을 PDF·TXT·MD로 내보내고, 히스토리에서 검색·분야별로 다시 보기 |

---

## 🧱 구조

```
브라우저 (React) ──/api──▶ API 서버 (Spring Boot) ──▶ PostgreSQL (Docker)
        ▲                        │
        └──── WebSocket 알림 ────┘└──▶ Gemini API (키는 서버에만)
```

| 구성 | 기술 | 폴더 |
|---|---|---|
| 웹 클라이언트 | React 19 + TypeScript (Vite) | `frontend-credit/` |
| API 서버 (+ 실시간 채널) | Spring Boot 3.5, Spring Security + JWT, WebSocket/STOMP, JPA | `backend/` |
| 데이터베이스 | PostgreSQL 16 (Docker) | `docker-compose.yml` |
| AI 생성 | Gemini API (REST `generateContent`) | `backend/.../ai/` |

- 화면은 우리 서버만 부르고, **서버가 DB와 Gemini를 대신 호출**합니다. 그래서 API 키가 브라우저로 내려가지 않고, 권한·횟수 제한 같은 규칙도 서버가 최종 판단합니다.
- 테이블은 JPA Entity로 정의하고, 서버가 켜질 때 PostgreSQL에 자동으로 만듭니다(`ddl-auto: update`).

📄 자세한 문서: [API 정리](docs/API.md) · [DB 설계](docs/DB.md) · [백엔드 정리](docs/BACKEND.md)

---

## 🚀 실행 방법

### 준비물
- Node.js 20 이상
- Docker Desktop
- JDK 21 이상 (방법 B로 API 서버까지 Docker로 띄우면 필요 없음)

### 0) 환경변수
```bash
cp .env.example .env      # GEMINI_API_KEY, JWT_SECRET 채우기 (절대 커밋 금지)
```
백엔드와 프론트 개발 서버 모두 최상위 `.env`를 자동으로 읽습니다.

### 방법 A: DB만 Docker, API 서버는 직접 실행 (개발용 권장)
```bash
# 1) DB
docker compose up -d db

# 2) API 서버 (http://localhost:8080/api, .env의 PORT로 변경 가능)
cd backend
./gradlew bootRun          # Windows: gradlew.bat bootRun

# 3) 웹 (http://127.0.0.1:5173)
cd frontend-credit
npm install
npm run dev
```

### 방법 B: DB + API 서버를 모두 Docker로
```bash
docker compose up -d --build
cd frontend-credit && npm install && npm run dev
```

### 써 보기
1. http://127.0.0.1:5173 → **새로 시작하기** (로그인 없이)
2. 분야 선택 → AI가 뻗은 트리에서 단어 3개 고정 → **생성**
3. 아이디어 → 실행안 → 로그인하면 히스토리에 저장
4. 팀 기능: 다른 브라우저(또는 시크릿 창)에서 다른 계정으로 가입한 뒤, 화면 상단의 팀 코드로 입장

### 환경변수 (API 서버)

| 이름 | 기본값 | 설명 |
|---|---|---|
| `GEMINI_API_KEY` | (없음) | 없으면 **예시(mock) 모드**. 결과에 "예시 모드" 표시 |
| `GEMINI_MODEL` | `gemini-3.8-flash` | 아이디어·실행안 생성 모델 |
| `GEMINI_WORD_MODEL` | `gemini-3.5-flash-lite` | 단어 트리 가지 뻗기 모델 (자주 호출되므로 빠른 모델, 약 1~2초) |
| `GEMINI_FALLBACK_MODEL` | `gemini-3.5-flash,gemini-3.1-flash-lite` | 기본 모델이 시간 초과·503·429·404로 실패하면 쉼표 순서대로 대신 쓰는 모델 |
| `AI_TIMEOUT_SECONDS` / `AI_WORD_TIMEOUT_SECONDS` / `AI_FALLBACK_TIMEOUT_SECONDS` | `45` / `20` / `60` | AI 응답 대기 시간. 넘기면 대체 모델로 넘어감 |
| `JWT_SECRET` | 개발용 값 | 32바이트 이상. 배포 시 반드시 변경 |
| `PORT` | `8080` | API 서버 포트. 8080이 사용 중이면 `8081` 등으로 (프론트 프록시도 이 값을 따라감) |
| `DB_PORT` (compose) | `5433` | 호스트에서 여는 DB 포트. 사용 중이면 `5434` 등으로 바꾸고 `DB_URL`도 맞출 것 |
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | 로컬 compose 값 | |
| `CORS_ORIGINS` | `http://localhost:5173` | 쉼표로 여러 개 |
| `PDF_FONT_PATH` | (자동 탐색) | PDF 내보내기용 한글 TTF 경로 |

### 테스트
```bash
cd backend && ./gradlew test        # 통합 테스트 3개 (H2 + 예시 AI, DB 불필요)
cd frontend-credit && npm run build # 타입 검사 + 빌드
```
`CoreFlowTest`는 **전체 흐름**(세션 → 가지 뻗기 10번·11번째 거절 → 고정 → 아이디어 → 실행안 → 수정·내보내기 → 팀원 입장·권한 → 히스토리 → 트리 초기화 → 세션 종료), **게스트 흐름**(게스트 작업이 가입 후 계정으로 이전), **로그인 규칙**을 확인합니다.

---

## 🗺️ 문서와 코드의 대응

### 화면 → 코드 (`frontend-credit/src`)
| 화면 | 파일 |
|---|---|
| 시작·팀 입장, 아이디어 팝업, 결과물, 로그인, 히스토리 | `App.tsx` |
| 카테고리·단어 트리 (접기·초기화) | `TreeCanvas.tsx` |
| 실시간 알림 받기 | `realtime.ts` |
| 서버 호출 | `api.ts` |

### API 25개 (모두 `/api` 아래)
| 화면 | 요청 | 컨트롤러 |
|---|---|---|
| 시작 | `POST /sessions` (헤더 `Idempotency-Key`), `POST /sessions/join` | `SessionController` |
| 세션 | `GET /sessions/{id}`, `DELETE /sessions/{id}/members/me`, `POST /sessions/{id}/close` | `SessionController` |
| 트리 | `GET /categories`, `GET /categories/{id}/words?sessionId=`, `POST /words/{id}/expand`, `DELETE /sessions/{id}/categories/{cid}/words?keep=` | `CategoryController` |
| 실시간 | WS 구독 `/topic/sessions/{id}/events` (엔드포인트 `/api/ws`) | `WebSocketConfig` |
| 생성 | `POST /sessions/{id}/draws` | `DrawController` |
| 아이디어 | `POST /draws/{id}/idea`, `PUT /ideas/{id}/bookmark` | `IdeaController` |
| 실행안 | `POST /ideas/{id}/result`, `GET·PATCH·DELETE /results/{id}`, `POST /results/{id}/regenerate`, `GET /results/{id}/export?format=pdf\|txt\|md` | `ResultController` |
| 로그인 | `POST /auth/guest`, `/auth/login`, `/auth/signup`, `/auth/password-reset`, `/auth/refresh` | `AuthController` |
| 히스토리 | `GET /history?q=&categoryId=&cursor=` | `HistoryController` |

30일 무활동 세션 만료는 API가 아니라 `SessionExpiryJob`(매일 04:00, 서울 시간)이 처리합니다.

### 테이블 10개
`users` · `refresh_tokens` · `sessions` · `session_members` · `categories` · `word_nodes` · `result_templates` · `draws` · `ideas` · `results`

처음 실행할 때 `DataSeeder`가 고정 분야 3개, 분야별 하위 카테고리 3개(트리의 뿌리), 실행안 양식을 넣습니다. 단어는 미리 넣지 않고 **세션마다 AI가 뻗습니다.**

### 게스트 흐름
1. 토큰이 없으면 `POST /auth/guest`로 게스트 토큰을 받아 모든 API에 씁니다.
2. 실행안 응답의 `saved`가 `false`면 "히스토리로 남기고 싶다면 로그인해 주세요. 나가면 저장되지 않습니다." 팝업을 띄웁니다.
3. 로그인·가입할 때 게스트 토큰을 함께 보내면, 게스트 작업이 계정으로 옮겨져 히스토리에 남습니다.
4. 게스트는 히스토리·팀 코드 입장이 막히고(`403 LOGIN_REQUIRED`), 팀 코드를 받지 않습니다.

### 팀이 다듬을 핵심 파일
- `backend/.../ai/PromptBuilder.java` — AI 지시문 (아이디어·실행안, `wordsPrompt` 단어 생성)
- `backend/.../category/Subcategories.java` — 하위 카테고리 이름(임시)과 예시 모드용 단어
- `backend/.../seed/DataSeeder.java` — 분야별 실행안 양식. 고친 뒤에는 DB의 `categories`, `result_templates`를 비우고 재실행

---

## 📌 남은 과제

| 항목 | 상태 |
|---|---|
| 실시간 동시 편집 | 트리 변화·알림은 실시간 반영됨. 결과물을 여러 명이 동시에 고치는 기능은 기말 과제 |
| 사용자 정의 카테고리·단어 추가 | 미구현 |
| 비밀번호 재설정 메일 | 메일 서비스가 없어 요청 접수 응답만 줌 (계정 존재 여부는 드러내지 않음) |
| DB 마이그레이션 | `ddl-auto: update`로 자동 생성 중. 배포 전에 Flyway 도입 예정 |
| 배포 | 아직 로컬 실행만 |

### 알아 둘 점
- 로그인 토큰은 브라우저 `localStorage`에 저장합니다(수업 MVP 수준). 운영 단계에서는 HttpOnly 쿠키로 바꾸는 것이 안전합니다.
- PDF 내보내기는 서버에 한글 폰트가 필요합니다. Docker 실행은 나눔고딕을 설치하고, 직접 실행하면 Windows 맑은 고딕·macOS AppleGothic을 자동으로 찾습니다.
- 화면 글꼴은 Pretendard(CDN)를 쓰고, 연결이 안 되면 시스템 한글 글꼴로 대체됩니다.
