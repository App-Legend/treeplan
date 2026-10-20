# TreePlan

Figma TreePlan UI 리디자인을 React + TypeScript로 구현한 반응형 프론트엔드입니다.

현재는 로컬 실행 전용으로 사용합니다. 배포는 진행하지 않았으며 개발 서버는 `127.0.0.1`에만 연결됩니다.

## 실행

Node.js 22.12 이상(또는 20.19 이상)이 필요합니다.

```sh
npm ci
npm run dev
```

터미널에 표시되는 주소(기본 `http://127.0.0.1:5173`)를 엽니다.

의존성이 이미 설치되어 있다면 `npm start`만 실행해도 됩니다. macOS에서는 `start-local.command`를 터미널에서 실행할 수 있습니다. 서버는 `Ctrl+C`로 종료합니다.

```sh
npm run build
npm run preview
```

`build`는 TypeScript 검사 후 `dist/`에 배포 파일을 생성합니다. `dist/`를 정적 웹 호스팅에 올리면 됩니다. 라우팅은 해시(`#`)를 사용하므로 별도 서버 라우트 설정이 필요하지 않습니다. 도메인 루트 배포를 기준으로 작성했습니다.

## 구현 범위

- Figma의 PC 24개 상태와 대응하는 M 모바일 24개 상태. `README · 수정 사항 반영표`는 제외했습니다.
- 768px 미만에서 모바일 레이아웃으로 전환합니다. 반응형 규칙 안내도 구현했습니다.
- 카테고리 선택, 단어 가지 확장, 3개 고정/해제, 다시 뽑기, 캔버스 이동/확대/축소.
- 생성 중/결과 모달, 결과물 편집·보완·복사·내보내기·삭제 확인.
- 히스토리 검색·필터, 로그인·회원가입·비밀번호 찾기 UI, 팀 코드와 참여자 UI, 401/404 화면.
- Figma 원본 SVG 에셋, 로컬 WOFF2 폰트, 키보드 포커스와 모달 포커스 제어, 인쇄 스타일.

`/#/screens`에서 모든 화면 상태로 이동할 수 있습니다. 각 링크는 같은 주소에서 PC/M 레이아웃으로 바뀝니다. `/#/responsive`에는 반응형 규칙이 있습니다. 화면별 대응표는 [docs/SCREENS.md](docs/SCREENS.md)를 참조하세요.

## 백엔드 연결

`/api` 요청은 개발 서버가 Spring Boot 백엔드로 넘깁니다. 대상 포트는 프로젝트 최상위 `.env`의 `PORT`(백엔드와 같은 값, 없으면 8080)이고, `VITE_API_TARGET`으로 직접 지정할 수도 있습니다. 백엔드를 먼저 실행하세요(`backend`에서 `gradlew bootRun`).

- 로그인하지 않으면 게스트 토큰을 자동으로 받아 핵심 흐름을 모두 쓸 수 있습니다. 실행안을 만들면 "히스토리로 남기고 싶다면 로그인해 주세요" 팝업이 뜨고, 그때 로그인·가입하면 지금까지 만든 결과가 계정 히스토리로 옮겨집니다.
- 분야를 고르면 하위 카테고리 3개에서 AI가 단어를 3개씩 자동으로 뻗고, 단어나 `+ 뻗기`를 누르면 3개씩 더 뻗습니다(가지마다 최대 10번). 트리 위치는 단어 길이와 가지 수로 계산해 겹치지 않게 배치합니다.
- 다시 뽑기는 트리에서 무작위 3개, 생성은 고정한 3개로 아이디어 → 실행안을 AI로 만듭니다. 수정·보완·PDF/MD/TXT 내보내기·삭제·히스토리·팀 코드도 서버를 씁니다.
- `/#/screens`, `/#/preview/*` 화면은 디자인 검토용으로 예전 예시 데이터(`TreeCanvasPreview.tsx`, `data.ts`)를 그대로 씁니다.

## 코드 구성

- `src/App.tsx`: 화면 전환, 모달, 폼, 결과물과 히스토리 동작
- `src/api.ts`: 백엔드 호출, 게스트 토큰·토큰 갱신
- `src/TreeCanvas.tsx`: 서버 단어 트리 배치 계산, AI 가지 뻗기, 캔버스 조작
- `src/TreeCanvasPreview.tsx`: 디자인 미리보기용 고정 좌표 트리
- `src/data.ts`: 타입, 예시 데이터와 로컬 저장
- `src/ui.tsx`: 공통 버튼·아이콘·접근성 모달
- `src/styles.css`: PC/모바일 및 인쇄 스타일
- `src/tree-layouts.json`: Figma 트리 좌표와 SVG 참조 (미리보기용)
- `public/assets`: Figma에서 내려받은 SVG
- `public/fonts`: IBM Plex Sans KR / IBM Plex Mono / Noto Serif KR와 OFL 라이선스

검증 내용과 범위는 [docs/VALIDATION.md](docs/VALIDATION.md)에 기록했습니다.
