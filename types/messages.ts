export type TiebaAction =
  | 'replyMe'
  | 'listThreads'
  | 'threadDetail'
  | 'addThread'
  | 'addPost'
  | 'opAgree';

export interface TiebaRequest {
  type: 'tieba:request';
  action: TiebaAction;
  payload: Record<string, unknown>;
}

export interface TiebaResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
}
