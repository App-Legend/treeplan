# Tree-Plan API

백엔드: Spring Boot · 모든 경로는 `/api` 아래 (예: `GET /api/categories`)
사용 중인 프론트: `frontend-credit/` (호출 코드는 `frontend-credit/src/api.ts`). `frontend/`는 이전 MVP로 남겨 둠.

## 공통 규칙

| 항목 | 내용 |
|---|---|
| 인증 | `Authorization: Bearer <accessToken>`. 로그인하지 않았으면 `POST /auth/guest`로 받은 **게스트 토큰**을 똑같이 쓴다 |
| 로그인 필요 기능 | 히스토리 조회, 팀 코드 입장. 게스트가 부르면 `403 LOGIN_REQUIRED` |
| 오류 응답 | `{ "code": "ROOT_FULL", "message": "화면에 그대로 보여 줄 한국어 문장" }` |
| 토큰 만료 | 액세스 30분, 리프레시 14일. `401`이면 `POST /auth/refresh` 후 재시도 |
| AI 모델 | 아이디어·결과물 `gemini-3.8-flash`, 단어 생성 `gemini-3.5-flash-lite`. 실패(시간 초과 45초·503·429)하면 `gemini-3.5-flash` → `gemini-3.1-flash-lite` 순서로 대신 시도 (`.env`로 변경) |
| 응답 시간(실측) | 단어 뻗기 약 1~2초, 아이디어·결과물 각 약 11~13초 (혼잡하면 1분 넘은 적 있음) |

## 핵심 흐름 순서

```
POST /auth/guest              → 게스트 토큰
POST /sessions                → sessionId
GET  /categories              → 카테고리 3개
GET  /categories/{id}/words?sessionId=   → 하위 카테고리 3개(뿌리)
POST /words/{뿌리id}/expand    → AI가 단어 3개 생성 (뿌리마다 가지 뻗기 최대 20번)
POST /sessions/{id}/draws      → 단어 3개 확정(직접 고른 3개 또는 무작위)
POST /draws/{drawId}/idea      → AI 아이디어
POST /ideas/{ideaId}/result    → AI 실행안 (saved=false면 로그인 권유 팝업)
POST /auth/signup|login (게스트 토큰을 헤더로) → 게스트 작업이 계정 히스토리로 이동
```

---

## 1. 인증 `/auth` (화면 6)

| 요청 | 보내는 것 | 돌려받는 것 | 비고 |
|---|---|---|---|
| `POST /auth/guest` | 없음 | `TokenResponse` | 로그인 없이 시작. 201 |
| `POST /auth/signup` | `{email, password, name}` | `TokenResponse` | 201. **게스트 토큰을 헤더로 보내면 게스트 작업을 새 계정으로 옮김**. 비밀번호: 영문+숫자 8~64자 |
| `POST /auth/login` | `{email, password}` | `TokenResponse` | 게스트 토큰을 헤더로 보내면 작업 이전. 5회 실패 시 5분 잠금 |
| `POST /auth/refresh` | `{refreshToken}` | `TokenResponse` | 리프레시 토큰은 1회용(쓸 때마다 새로 발급) |
| `POST /auth/password-reset` | `{email}` | `{message}` | 202. 계정 존재 여부와 관계없이 같은 응답. **메일 발송은 아직 없음** |

`TokenResponse` = `{ accessToken, refreshToken, expiresIn, user: { id, email, name, guest } }` (게스트는 `email: null`, `name: "게스트"`)

## 2. 카테고리·단어 트리 (화면 2)

| 요청 | 보내는 것 | 돌려받는 것 | 서버가 확인하는 것 |
|---|---|---|---|
| `GET /categories` | 없음 (로그인 불필요) | `[{id, name, slug}]` 3개 | |
| `GET /categories/{id}/words?sessionId=` | `sessionId` 생략 시 뿌리만 | `WordTree` | sessionId가 있으면 참여자인지 |
| `POST /words/{nodeId}/expand` | `{sessionId, count?}` (기본 3, 최대 10) | `{parentId, rootId, words:[{id,text,children}], rootWordCount, expandCount, remaining, aiMode}` | 뿌리당 가지 뻗기 20번 이하, 같은 뿌리 중복 요청, 이미 나온 단어 제외, 진행 중인 세션 |

- `nodeId`는 뿌리(하위 카테고리) 또는 단어 ID. 단어에서 뻗으면 그 아래로 깊어진다.
- 단어 트리는 **세션마다 따로** 자란다. 팀원이 뻗으면 실시간 알림 `TREE_EXPANDED`.

`WordTree` = `{ categoryId, name, wordCount, maxExpandsPerRoot: 20, groups: [{ id, text, wordCount, expandCount, remaining, children: [{ id, text, children: [...] }] }] }`

현재 하위 카테고리 (**임시 이름, 팀 확정 필요** → `backend/.../category/Subcategories.java`)

| 카테고리 | 하위 카테고리 3개 |
|---|---|
| 음식 개발 | 재료 · 조리법 · 먹는 상황 |
| 프로그램 개발 | 사용자 · 문제 · 기술 |
| 공모전 기획 | 주제 · 대상 · 실행 방식 |

## 3. 세션·팀 코드 (화면 1, 2)

| 요청 | 보내는 것 | 돌려받는 것 | 비고 |
|---|---|---|---|
| `POST /sessions` | `{name?}`, 헤더 `Idempotency-Key`(선택) | `{sessionId, name, teamCode}` | 201. 같은 키로 다시 보내면 같은 세션. **게스트는 `teamCode: null`** |
| `POST /sessions/join` | `{teamCode}` | `{sessionId, name}` | **로그인 필요**. 실패: `NOT_FOUND`, `CLOSED`, `EXPIRED`(30일 무활동) |
| `GET /sessions/{id}` | 없음 | `{sessionId, name, teamCode, status, members:[{userId,name,role,joinedAt}], myRole, lastActivityAt}` | 참여자만 |
| `DELETE /sessions/{id}/members/me` | 없음 | `{success}` | 방장은 나갈 수 없음(`OWNER_CANNOT_LEAVE`) |
| `POST /sessions/{id}/close` | 없음 | `{closedAt}` | 방장만. 참여자에게 `SESSION_CLOSED` 알림 |

## 4. 단어 조합·아이디어 (화면 2, 4)

| 요청 | 보내는 것 | 돌려받는 것 | 비고 |
|---|---|---|---|
| `POST /sessions/{id}/draws` | `{categoryIds:[하나], fixedWords?:[], excludedWords?:[]}` | `{drawId, categoryId, words(3), attemptNo}` | 201. 트리에서 뽑음. `fixedWords` 3개면 그 조합 그대로. 트리 단어 3개 미만이면 `TREE_TOO_SMALL` |
| `POST /draws/{drawId}/idea` | 없음 | `Idea` | AI 호출. 실패해도 200 + `status: FAILED`, `failureReason` |
| `PUT /ideas/{id}/bookmark` | `{bookmarked: true/false}` | `{ideaId, bookmarked, bookmarkedAt}` | 보관한 아이디어는 히스토리에 표시 |

`Idea` = `{ ideaId, drawId, sessionId, categoryId, categoryName, words, title, summary, status: GENERATING|SUCCESS|FAILED, failureReason, bookmarked, resultId, aiMode }`

## 5. 결과물 (화면 4, 5)

| 요청 | 보내는 것 | 돌려받는 것 | 비고 |
|---|---|---|---|
| `POST /ideas/{ideaId}/result` | 없음 | `Result` | AI 호출. 이미 만든 아이디어면 기존 결과물 반환 |
| `GET /results/{id}` | 없음 | `Result` | 같은 세션 참여자 모두 열람(협업) |
| `PATCH /results/{id}` | `{items: {key: "내용"}}` | `Result` | 양식에 있는 항목만. 한 항목 5000자 이하 |
| `POST /results/{id}/regenerate` | `{feedback?}` (300자 이하) | `Result` | AI 보완. 실패하면 기존 내용 유지 + `notice` |
| `GET /results/{id}/export?format=pdf\|txt\|md` | 없음 | 파일 | PDF는 서버에 한글 폰트 필요 |
| `DELETE /results/{id}` | 없음 | `{success}` | 세션 방장만 |

`Result` = `{ resultId, ideaId, sessionId, title, ideaSummary, categoryId, categoryName, words, items: [{key, label, description, content}], status, failureReason, edited, createdAt, updatedAt, authorName, canDelete, notice, aiMode, saved, loginPrompt }`
- `saved: false`(게스트가 만든 결과) → `loginPrompt` = "히스토리로 남기고 싶다면 로그인해 주세요. 나가면 저장되지 않습니다."
- `items`는 분야별 양식 순서. 마지막 항목은 항상 `reason`(조합 이유)

| 분야 | 양식 항목 key |
|---|---|
| 음식 개발 | concept · ingredients · steps · result_caution · reason |
| 프로그램 개발 | user_problem · hypothesis · features · flow · mvp · reason |
| 공모전 기획 | interpretation · target_problem · concept · differentiation · execution · reason |

## 6. 히스토리 (화면 7)

| 요청 | 보내는 것 | 돌려받는 것 | 비고 |
|---|---|---|---|
| `GET /history?q=&categoryId=&cursor=` | 검색어·카테고리·다음 페이지 | `{items:[{type: RESULT\|IDEA, id, sessionId, sessionName, teamSession, title, summary, words, categoryId, categoryName, at, resultId, canDelete}], nextCursor}` | **로그인 필요**. 20개씩. 내가 참여한 세션의 결과물 + 보관 아이디어 |

## 7. 실시간 채널 (WebSocket, 협업)

- 접속: STOMP `/api/ws` (연결 헤더 `Authorization: Bearer <token>`)
- 구독: `/topic/sessions/{sessionId}/events`
- 메시지: `{ type, sessionId, at, data }`

| type | data |
|---|---|
| `MEMBER_JOINED` / `MEMBER_LEFT` | `{userId, name}` |
| `TREE_EXPANDED` | `{categoryId, rootId, parentId, words, byUserId}` |
| `RESULT_CREATED` | `{resultId, title, authorId, authorName}` |
| `SESSION_CLOSED` | `{closedAt}` |

⚠️ 서버는 보내고 있지만 **`frontend-credit` 화면은 아직 구독하지 않음** (10주차 실시간 협업 작업)

## 8. 기타

| 요청 | 설명 |
|---|---|
| `GET /actuator/health` | 서버 상태 `{"status":"UP"}` |
| (예약 작업) | 매일 04:00 30일 무활동 세션을 만료 처리 (API 아님) |

## 오류 코드

| 코드 | 상태 | 뜻 |
|---|---|---|
| `UNAUTHORIZED` · `INVALID_REFRESH` | 401 | 토큰 없음·만료 |
| `INVALID_CREDENTIALS` | 401 | 이메일·비밀번호 불일치 (어느 쪽인지 구분 안 함) |
| `TOO_MANY_ATTEMPTS` | 429 | 로그인 5회 실패, 5분 잠금 |
| `LOGIN_REQUIRED` | 403 | 게스트가 히스토리·팀 코드 입장 시도 |
| `NOT_MEMBER` · `NOT_OWNER` | 403 | 세션 참여자·방장 아님 |
| `ROOT_FULL` | 409 | 하위 카테고리에서 가지 뻗기 20번을 다 씀 |
| `ALREADY_EXPANDING` · `ALREADY_GENERATING` | 409 | 같은 요청이 진행 중 |
| `TREE_TOO_SMALL` · `POOL_TOO_SMALL` | 422 | 트리 단어가 3개 미만 |
| `AI_FAILED` | 503 | AI 단어 생성 실패 (재시도 안내) |
| `SESSION_CLOSED` · `SESSION_EXPIRED` | 409·410 | 종료·만료된 세션에 쓰기 |
| `EMAIL_TAKEN` · `WEAK_PASSWORD` · `VALIDATION` | 409·400 | 가입 입력 오류 |
| `*_NOT_FOUND` | 404 | 대상 없음 (`SESSION`, `WORD`, `DRAW`, `IDEA`, `RESULT`, `CATEGORY`) |
