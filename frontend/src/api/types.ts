// 6주차 'API 목록'의 요청·응답 형태 (백엔드 DTO와 1:1)

export type GenerationStatus = 'GENERATING' | 'SUCCESS' | 'FAILED';
export type MemberRole = 'OWNER' | 'MEMBER';
export type SessionStatus = 'ACTIVE' | 'CLOSED' | 'EXPIRED';

export interface UserInfo {
  id: number;
  email: string;
  name: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserInfo;
}

export interface CreateSessionResponse {
  sessionId: number;
  name: string;
  teamCode: string;
}

export interface JoinResponse {
  sessionId: number;
  name: string;
}

export interface Member {
  userId: number;
  name: string;
  role: MemberRole;
  joinedAt: string;
}

export interface SessionInfo {
  sessionId: number;
  name: string;
  teamCode: string;
  status: SessionStatus;
  members: Member[];
  myRole: MemberRole;
  lastActivityAt: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface WordTree {
  categoryId: number;
  name: string;
  wordCount: number;
  groups: { id: number; text: string; children: { id: number; text: string }[] }[];
}

export interface DrawResponse {
  drawId: number;
  categoryId: number;
  words: string[];
  attemptNo: number;
}

export interface IdeaResponse {
  ideaId: number;
  drawId: number;
  sessionId: number;
  categoryId: number;
  categoryName: string;
  words: string[];
  title: string | null;
  summary: string | null;
  status: GenerationStatus;
  failureReason: string | null;
  bookmarked: boolean;
  resultId: number | null;
  aiMode: string;
}

export interface ResultItem {
  key: string;
  label: string;
  description: string;
  content: string;
}

export interface ResultResponse {
  resultId: number;
  ideaId: number;
  sessionId: number;
  title: string;
  ideaSummary: string | null;
  categoryId: number;
  categoryName: string;
  words: string[];
  items: ResultItem[];
  status: GenerationStatus;
  failureReason: string | null;
  edited: boolean;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  canDelete: boolean;
  notice: string | null;
  aiMode: string;
}

export interface HistoryItem {
  type: 'RESULT' | 'IDEA';
  id: number;
  sessionId: number;
  sessionName: string;
  teamSession: boolean;
  title: string | null;
  summary: string | null;
  words: string[];
  categoryId: number;
  categoryName: string;
  at: string;
  status: GenerationStatus;
  resultId: number | null;
  /** 결과물 삭제는 세션 방장만 가능 */
  canDelete: boolean;
}

export interface HistoryPage {
  items: HistoryItem[];
  nextCursor: string | null;
}

export interface SessionEvent {
  type: 'MEMBER_JOINED' | 'MEMBER_LEFT' | 'RESULT_CREATED' | 'SESSION_CLOSED';
  sessionId: number;
  at: string;
  data: Record<string, unknown>;
}
