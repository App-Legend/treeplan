export const categories = [
  "음식 개발",
  "프로그램 개발",
  "공모전 기획",
] as const;
export type Category = (typeof categories)[number];
export type Plan = {
  id: string;
  title: string;
  category: Category;
  words: string[];
  summary: string;
  sections: { title: string; body: string }[];
  created: string;
  refined?: string;
};
export type Session = {
  category: Category | null;
  words: string[];
  expanded: boolean;
  reroll: number;
  team: boolean;
  code: string;
  created: string;
};
export const initialSession = (): Session => ({
  category: null,
  words: [],
  expanded: false,
  reroll: 0,
  team: false,
  code: "GTV6YV",
  created: new Date().toISOString(),
});
export const wordSets: Record<Category, string[][]> = {
  "음식 개발": [
    [
      "흑임자",
      "표고버섯",
      "버터",
      "튀김",
      "발효",
      "숙성",
      "장마",
      "첫눈",
      "무더위",
      "쑥",
      "고구마",
    ],
    [
      "들깨",
      "두부",
      "단호박",
      "굽기",
      "찜",
      "절임",
      "봄비",
      "바람",
      "새벽",
      "밤",
      "연근",
    ],
  ],
  "프로그램 개발": [
    [
      "알림",
      "루틴",
      "지도",
      "공유",
      "기록",
      "추천",
      "아침",
      "출퇴근",
      "산책",
      "위젯",
      "캘린더",
    ],
    [
      "예약",
      "검색",
      "공간",
      "연결",
      "분석",
      "자동화",
      "동네",
      "소상공인",
      "여행",
      "일정",
      "메모",
    ],
  ],
  "공모전 기획": [
    [
      "재활용",
      "청소년",
      "전시",
      "체험",
      "참여",
      "협업",
      "지역",
      "환경",
      "미래",
      "폐현수막",
      "업사이클",
    ],
    [
      "지도",
      "공간",
      "대학생",
      "조사",
      "제안",
      "캠페인",
      "캠퍼스",
      "문화",
      "도시",
      "강의실",
      "공유",
    ],
  ],
};
export const branchNames: Record<Category, string[]> = {
  "음식 개발": ["재료", "조리법", "날씨"],
  "프로그램 개발": ["기능", "방식", "일상"],
  "공모전 기획": ["주제", "방식", "대상"],
};
export function makePlan(
  category: Category,
  words: string[],
  id: string = crypto.randomUUID(),
): Plan {
  const [a, b, c] = words;
  const food = category === "음식 개발",
    program = category === "프로그램 개발";
  const title = food
    ? `${c}에 어울리는 ${a} ${b} 한입`
    : program
      ? `${a} · ${b}을 연결하는 ${c} 서비스`
      : `${a} · ${b}로 만드는 ${c} 공모안`;
  const summary = food
    ? `[예시 모드] '${a}'의 맛을 중심에 두고 '${b}'의 향으로 대비를 준 뒤, '${c}'를 식감과 단맛의 바탕으로 깐 한입 메뉴예요. 세 단어가 각각 다른 역할을 맡도록 구성했어요.`
    : `[예시 모드] '${a}', '${b}', '${c}'를 연결한 ${program ? "서비스" : "기획"} 아이디어예요. 작은 실험부터 시작해 사용자 피드백으로 구체화해요.`;
  const sections = food
    ? [
        {
          title: "콘셉트",
          body: `[예시] 구운 ${c} 위에 ${a} 페이스트와 ${b} 반죽을 올려 한 손으로 집어 먹는 한입 간식`,
        },
        {
          title: "재료와 분량",
          body: `- ${a} 2큰술 (주재료)\n- ${b}가루 1큰술 또는 데친 ${b} 1컵\n- ${c} 중간 크기 2개\n- 꿀 1큰술`,
        },
        {
          title: "만드는 순서",
          body: `1. ${a}를 볶아 꿀과 함께 곱게 간다.\n2. ${b}을 데쳐 찹쌀 반죽에 섞는다.\n3. ${c}를 한입 크기로 썰어 30분간 굽는다.\n4. ${c} 위에 ${b} 반죽, ${a} 페이스트 순으로 올린다.`,
        },
        {
          title: "예상 결과와 주의점",
          body: `- 예상 결과: 쌉싸름한 향 뒤로 고소한 단맛이 이어지는 간식\n- 주의: ${b}이 반죽의 10%를 넘으면 쓴맛이 강해져요.`,
        },
        {
          title: "조합 이유",
          body: `'${a}'는 맛의 중심, '${b}'은 향의 대비, '${c}'는 식감과 단맛의 바탕으로 연결했어요. 세 단어가 각각 맛 · 향 · 식감을 맡도록 조합했어요.`,
        },
      ]
    : [
        {
          title: "콘셉트",
          body: `${a}와 ${b}을 ${c}에 연결해 일상에서 쉽게 경험할 수 있는 ${program ? "서비스" : "참여형 기획"}을 만들어요.`,
        },
        {
          title: program ? "핵심 기능" : "기획 구성",
          body: `- ${a}: 사용자가 처음 만나는 핵심 경험\n- ${b}: 참여와 기록을 이어 주는 장치\n- ${c}: 결과를 확인하고 공유하는 공간`,
        },
        {
          title: "실행 순서",
          body: `1. 대상 사용자를 인터뷰하고 문제를 정의한다.\n2. ${a} 중심의 작은 시제품을 만든다.\n3. ${b}와 ${c}를 연결해 시험 운영한다.\n4. 피드백을 반영해 개선한다.`,
        },
        {
          title: "예상 결과와 주의점",
          body: "- 예상 결과: 새로운 연결에서 발견하는 실용적인 아이디어\n- 주의: 실제 사용자 검증과 자원 확인이 필요해요.",
        },
        {
          title: "조합 이유",
          body: `'${a}'는 출발점, '${b}'는 연결 방식, '${c}'는 활용 맥락으로 삼았어요.`,
        },
      ];
  return {
    id,
    title,
    category,
    words: [...words],
    summary,
    sections,
    created: new Date().toISOString(),
  };
}
export const samplePlan = makePlan(
  "음식 개발",
  ["흑임자", "쑥", "고구마"],
  "sample-food",
);
const examples: [Category, string[], string, string][] = [
  [
    "프로그램 개발",
    ["알림", "루틴", "지도"],
    "출퇴근 루틴 공유 위젯",
    "sample-widget",
  ],
  [
    "공모전 기획",
    ["재활용", "청소년", "전시"],
    "폐현수막 업사이클 공모안",
    "sample-recycle",
  ],
  [
    "음식 개발",
    ["장마", "국물", "떡"],
    "비 오는 날 국물 떡볶이 키트",
    "sample-food2",
  ],
  [
    "프로그램 개발",
    ["예약", "알림", "소상공인"],
    "동네 가게 예약 알림 봇",
    "sample-bot",
  ],
  [
    "공모전 기획",
    ["지도", "공간", "대학생"],
    "캠퍼스 빈 강의실 지도 공모안",
    "sample-map",
  ],
];
export const sampleHistory: Plan[] = [
  samplePlan,
  ...examples.map(([c, w, t, id], i) => ({
    ...makePlan(c, w, id),
    title: t,
    created: new Date(
      Date.now() - (i < 2 ? 1 : 7 + i) * 86400000,
    ).toISOString(),
  })),
];
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem("treeplan." + key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem("treeplan." + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export const screenList = [
  ["01", "시작화면"],
  ["02", "로그인창"],
  ["03", "비밀번호 찾기"],
  ["04", "회원가입"],
  ["05", "시작화면 (로그인 후)"],
  ["06", "세션 · 카테고리 선택 전"],
  ["07", "카테고리 선택 · 단어 트리"],
  ["08", "단어 트리 · 가지 뻗기"],
  ["09", "단어 3개 고정"],
  ["10", "아이디어 · 생성 중"],
  ["11", "아이디어 · 결과"],
  ["13", "결과물 화면"],
  ["14", "결과물 · 직접 수정"],
  ["15", "결과물 · 세부안 보완"],
  ["16", "결과물 · 보완 완료"],
  ["17", "결과물 · 내보내기"],
  ["18", "결과물 · 삭제 확인"],
  ["19", "히스토리"],
  ["20", "팀 코드 입력"],
  ["21", "팀원 · 세션 입장"],
  ["22", "방장 · 팀원 입장 알림"],
  ["22-1", "참여자 목록"],
  ["25", "없는 화면"],
  ["26", "로그인 필요 화면"],
];
