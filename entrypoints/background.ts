import type { TiebaAction, TiebaRequest, TiebaResponse } from '@/types/messages';

const BASE_URL = 'https://tieba.baidu.com';
const TOKEN_KEY = 'fc_token';

function isTiebaUrl(url: string): boolean {
  return url.startsWith(BASE_URL);
}

async function getToken(): Promise<string> {
  const result = await browser.storage.local.get(TOKEN_KEY);
  const token = result[TOKEN_KEY];
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('未找到 TB_TOKEN，请先在插件 popup 中保存。');
  }
  return token.trim();
}

async function tiebaGet(path: string, params: Record<string, string>): Promise<unknown> {
  const token = await getToken();
  const query = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${path}?${query}`;
  if (!isTiebaUrl(url)) {
    throw new Error('安全校验失败：仅允许请求 tieba.baidu.com。');
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: token,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
  });

  if (!response.ok) {
    throw new Error(`网络请求失败: ${response.status}`);
  }

  const json = await response.json();
  if (typeof json?.errno === 'number' && json.errno !== 0) {
    throw new Error(typeof json?.errmsg === 'string' ? json.errmsg : `接口异常: errno=${json.errno}`);
  }
  return json?.data ?? json;
}

async function tiebaPost(path: string, body: Record<string, unknown>): Promise<unknown> {
  const token = await getToken();
  const url = `${BASE_URL}${path}`;
  if (!isTiebaUrl(url)) {
    throw new Error('安全校验失败：仅允许请求 tieba.baidu.com。');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`网络请求失败: ${response.status}`);
  }

  const json = await response.json();
  if (typeof json?.errno === 'number' && json.errno !== 0) {
    throw new Error(typeof json?.errmsg === 'string' ? json.errmsg : `接口异常: errno=${json.errno}`);
  }
  return json?.data ?? json;
}

async function runAction(action: TiebaAction, payload: Record<string, unknown>): Promise<unknown> {
  switch (action) {
    case 'replyMe': {
      const pn = String(payload.pn ?? '1');
      return tiebaGet('/mo/q/claw/replyme', { pn });
    }
    case 'listThreads': {
      const sortType = String(payload.sort_type ?? '0');
      return tiebaGet('/c/f/frs/page_claw', { sort_type: sortType });
    }
    case 'threadDetail': {
      const pn = String(payload.pn ?? '1');
      const kz = String(payload.kz ?? '');
      const r = String(payload.r ?? '0');
      if (!kz) {
        throw new Error('thread_id(kz) 必填。');
      }
      return tiebaGet('/c/f/pb/page_claw', { pn, kz, r });
    }
    case 'addThread': {
      const title = String(payload.title ?? '').trim();
      const content = String(payload.content ?? '').trim();
      if (!title) {
        throw new Error('标题必填。');
      }
      if (!content) {
        throw new Error('内容必填。');
      }
      if (content.length > 1000) {
        throw new Error('内容不能超过 1000 字符。');
      }
      const data = (await tiebaPost('/c/c/claw/addThread', {
        title,
        content: [{ type: 'text', content }],
      })) as { thread_id?: number; post_id?: number };

      if (data?.thread_id) {
        return {
          ...data,
          thread_url: `https://tieba.baidu.com/p/${data.thread_id}`,
        };
      }
      return data;
    }
    case 'addPost': {
      const content = String(payload.content ?? '').trim();
      const threadId = String(payload.thread_id ?? '').trim();
      const postId = String(payload.post_id ?? '').trim();
      if (!content) {
        throw new Error('回复内容必填。');
      }
      if (content.length > 1000) {
        throw new Error('回复内容不能超过 1000 字符。');
      }
      if (!threadId && !postId) {
        throw new Error('thread_id 或 post_id 至少填写一个。');
      }
      const body: Record<string, unknown> = { content };
      if (threadId) body.thread_id = Number(threadId);
      if (postId) body.post_id = Number(postId);
      return tiebaPost('/c/c/claw/addPost', body);
    }
    case 'opAgree': {
      const threadId = String(payload.thread_id ?? '').trim();
      const objType = Number(payload.obj_type ?? 3);
      const opType = Number(payload.op_type ?? 0);
      const postId = String(payload.post_id ?? '').trim();
      if (!threadId) {
        throw new Error('thread_id 必填。');
      }
      const body: Record<string, unknown> = {
        thread_id: Number(threadId),
        obj_type: objType,
        op_type: opType,
      };
      if (postId) body.post_id = Number(postId);
      return tiebaPost('/c/c/claw/opAgree', body);
    }
    default:
      throw new Error('未知动作。');
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(async (message: TiebaRequest): Promise<TiebaResponse | undefined> => {
    if (!message || message.type !== 'tieba:request') {
      return undefined;
    }

    try {
      const data = await runAction(message.action, message.payload ?? {});
      return { ok: true, data };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : '请求失败。',
      };
    }
  });
});
