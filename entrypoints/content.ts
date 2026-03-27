import '@/assets/content.css';
import type { TiebaAction, TiebaRequest, TiebaResponse } from '@/types/messages';

type ThemeMode = 'light' | 'dark';
type StorageChange = { oldValue?: unknown; newValue?: unknown };
type StorageChanges = Record<string, StorageChange>;
type StorageAreaName = 'local' | 'sync' | 'managed' | 'session';
type RuntimeContext = {
  threadId: string | null;
  postId: string | null;
  fallbackThreadId: string | null;
};
type ThreadCandidate = { id: string; title: string; author: string };

const THEME_KEY = 'fc_theme';
const TOKEN_KEY = 'fc_token';

const actionLabelMap: Record<TiebaAction, string> = {
  replyMe: '读取回复消息',
  listThreads: '读取帖子列表',
  threadDetail: '读取帖子详情',
  addThread: '发帖',
  addPost: '回复',
  opAgree: '点赞',
};

function createField(id: string, label: string, placeholder: string): string {
  return `
    <label class="fc-label" for="${id}">${label}</label>
    <input id="${id}" class="fc-input" placeholder="${placeholder}" />
  `;
}

function createTextField(id: string, label: string, placeholder: string, rows = 3): string {
  return `
    <label class="fc-label" for="${id}">${label}</label>
    <textarea id="${id}" rows="${rows}" class="fc-input resize-none" placeholder="${placeholder}"></textarea>
  `;
}

function createSelect(id: string, label: string, options: Array<{ value: string; text: string }>): string {
  const optionHtml = options
    .map((item) => `<option value="${item.value}">${item.text}</option>`)
    .join('');
  return `
    <label class="fc-label" for="${id}">${label}</label>
    <select id="${id}" class="fc-input">${optionHtml}</select>
  `;
}

function resolveThemeBySystem(): ThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

async function resolveTheme(): Promise<ThemeMode> {
  const result = await browser.storage.local.get(THEME_KEY);
  return result[THEME_KEY] === 'dark' || result[THEME_KEY] === 'light'
    ? result[THEME_KEY]
    : resolveThemeBySystem();
}

async function resolveToken(): Promise<string> {
  const result = await browser.storage.local.get(TOKEN_KEY);
  return typeof result[TOKEN_KEY] === 'string' ? result[TOKEN_KEY] : '';
}

function readCurrentThreadId(): string | null {
  const queryKz = new URL(window.location.href).searchParams.get('kz');
  if (queryKz && queryKz.trim()) {
    return queryKz.trim();
  }
  const pathMatch = window.location.pathname.match(/\/p\/(\d+)/);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }
  return null;
}

function readCurrentPostId(): string | null {
  const url = new URL(window.location.href);
  const queryPid = url.searchParams.get('pid') || url.searchParams.get('post_id');
  if (queryPid && queryPid.trim()) {
    return queryPid.trim();
  }
  return null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getStringField(obj: Record<string, unknown> | null, keys: string[]): string {
  if (!obj) {
    return '';
  }
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return '';
}

function findThreadCandidates(data: unknown): ThreadCandidate[] {
  const root = asObject(data);
  const candidates = [
    asArray(root?.thread_list),
    asArray(root?.list),
    asArray(root?.data_list),
    asArray(root?.frs_list),
  ].find((item) => item.length > 0) || (Array.isArray(data) ? data : []);

  return candidates
    .map((item) => {
      const obj = asObject(item);
      const id = getStringField(obj, ['thread_id', 'id', 'kz']);
      const title = getStringField(obj, ['title', 'thread_title', 'content']) || '未命名帖子';
      const author = getStringField(obj, ['author_name', 'author', 'user_name']) || '未知作者';
      return { id, title, author };
    })
    .filter((item) => item.id);
}

function summarizeReplyMessages(data: unknown): string {
  const root = asObject(data);
  const list = asArray(root?.reply_list);
  if (list.length === 0) {
    return '未读取到回复消息。';
  }

  const lines = list.slice(0, 8).map((item, index) => {
    const obj = asObject(item);
    const content = getStringField(obj, ['content']) || '无内容';
    const quote = getStringField(obj, ['quote_content']);
    const unread = Number(obj?.unread ?? 0) === 1 ? '未读' : '已读';
    return `${index + 1}. [${unread}] ${content}${quote ? `（引用：${quote}）` : ''}`;
  });
  return `最近回复消息：\n${lines.join('\n')}`;
}

function summarizeThreadDetail(data: unknown): string {
  const root = asObject(data);
  const threadObj = asObject(root?.thread ?? root?.thread_info);
  const title = getStringField(threadObj, ['title', 'thread_title']) || '当前帖子';
  const postList =
    asArray(root?.post_list).length > 0
      ? asArray(root?.post_list)
      : asArray(root?.list).length > 0
        ? asArray(root?.list)
        : [];
  const preview = postList.slice(0, 5).map((item, index) => {
    const obj = asObject(item);
    const author = getStringField(obj, ['author_name', 'author', 'user_name']) || '吧友';
    const content = getStringField(obj, ['content', 'text']) || '无内容';
    return `${index + 1}. ${author}：${content}`;
  });

  const header = `帖子详情已获取：${title}`;
  if (preview.length === 0) {
    return `${header}\n当前暂无可预览楼层。`;
  }
  return `${header}\n楼层预览：\n${preview.join('\n')}`;
}

function summarizeResult(action: TiebaAction, data: unknown, context: RuntimeContext): string {
  if (action === 'replyMe') {
    return summarizeReplyMessages(data);
  }

  if (action === 'listThreads') {
    const items = findThreadCandidates(data);
    if (items.length === 0) {
      return '已获取帖子列表，但暂时没有可展示内容。';
    }
    context.fallbackThreadId = items[0].id;
    const lines = items.slice(0, 10).map((item, index) => `${index + 1}. ${item.title}（作者：${item.author}）`);
    return `帖子列表（已自动选择第一条作为后续默认目标）：\n${lines.join('\n')}`;
  }

  if (action === 'threadDetail') {
    return summarizeThreadDetail(data);
  }

  if (action === 'addThread') {
    const obj = asObject(data);
    const threadUrl = getStringField(obj, ['thread_url']);
    return threadUrl ? `发帖成功。\n帖子链接：${threadUrl}` : '发帖成功。';
  }

  if (action === 'addPost') {
    return '回复已发送。';
  }

  if (action === 'opAgree') {
    return '点赞操作已提交。';
  }

  return '操作已完成。';
}

function buildPayload(action: TiebaAction, root: HTMLElement, context: RuntimeContext): Record<string, unknown> {
  const value = (id: string): string => {
    const node = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`);
    return node?.value.trim() ?? '';
  };

  switch (action) {
    case 'replyMe':
      return { pn: value('fc-pn') || '1' };
    case 'listThreads':
      return { sort_type: value('fc-sort-type') || '0' };
    case 'threadDetail':
      return {
        pn: value('fc-detail-pn') || '1',
        kz: context.threadId || context.fallbackThreadId || '',
        r: value('fc-r') || '0',
      };
    case 'addThread':
      return {
        title: value('fc-title'),
        content: value('fc-thread-content'),
      };
    case 'addPost':
      {
        const target = value('fc-reply-target') || 'thread';
        const content = value('fc-post-content');
        if (target === 'post' && context.postId) {
          return { post_id: context.postId, content };
        }
        return {
          thread_id: context.threadId || context.fallbackThreadId || '',
          content,
        };
      }
    case 'opAgree':
      {
        const target = value('fc-like-target') || 'thread';
        const base = {
          thread_id: context.threadId || context.fallbackThreadId || '',
          op_type: value('fc-op-type') || '0',
        };
        if (target === 'post' && context.postId) {
          return {
            ...base,
            post_id: context.postId,
            obj_type: '1',
          };
        }
        return {
          ...base,
          obj_type: '3',
        };
      }
    default:
      return {};
  }
}

function validatePayload(action: TiebaAction, payload: Record<string, unknown>): string | null {
  const getString = (key: string): string => String(payload[key] ?? '').trim();

  if (action === 'addThread') {
    if (!getString('title')) return '标题必填。';
    const content = getString('content');
    if (!content) return '发帖内容必填。';
    if (content.length > 1000) return '发帖内容不能超过 1000 字符。';
  }

  if (action === 'addPost') {
    const content = getString('content');
    if (!content) return '回复内容必填。';
    if (content.length > 1000) return '回复内容不能超过 1000 字符。';
    if (!getString('thread_id') && !getString('post_id')) {
      return 'thread_id 或 post_id 至少填写一个。';
    }
  }

  if (action === 'threadDetail' && !getString('kz')) {
    return '无法识别帖子上下文。请先打开具体帖子页面，或先执行“读取帖子列表”。';
  }

  if (action === 'opAgree' && !getString('thread_id')) {
    return '无法识别可点赞的帖子。请先打开具体帖子页面，或先执行“读取帖子列表”。';
  }

  return null;
}

export default defineContentScript({
  matches: ['https://tieba.baidu.com/*'],
  async main() {
    const mode = await resolveTheme();
    const root = document.createElement('div');
    root.id = 'fakeclaw-root';
    if (mode === 'dark') {
      root.classList.add('dark');
    }

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className =
      'fixed z-[2147483647] cursor-move select-none rounded border border-black bg-white px-3 py-1 text-xs text-black shadow hover:bg-neutral-100 dark:border-white dark:bg-black dark:text-white dark:hover:bg-neutral-900';
    toggle.textContent = 'Fakeclaw';

    const panel = document.createElement('section');
    panel.className = 'fc-panel hidden';
    panel.innerHTML = `
      <div id="fc-drag-handle" class="mb-2 flex cursor-move items-center justify-between select-none">
        <h2 class="text-sm font-semibold">Fakeclaw 贴吧面板</h2>
        <button type="button" id="fc-close" class="fc-btn">关闭</button>
      </div>
      <p class="mb-2 text-xs text-neutral-700 dark:text-neutral-300">仅黑白双模式。支持发帖、回复、点赞和只读查询。</p>
      <p id="fc-feedback" class="mb-2 rounded border border-black px-2 py-1 text-xs dark:border-white">最近状态：待命</p>

      <div class="fc-scroll">

      <div class="mb-2 rounded border border-black p-2 dark:border-white">
        <label class="fc-label" for="fc-token">TB_TOKEN（可在这里直接修改）</label>
        <textarea id="fc-token" rows="2" class="fc-input resize-none" placeholder="粘贴 TB_TOKEN"></textarea>
        <div class="mt-2 flex gap-2">
          <button type="button" id="fc-token-save" class="fc-btn-primary">保存 Token</button>
          <button type="button" id="fc-token-clear" class="fc-btn">清空 Token</button>
        </div>
        <p id="fc-token-state" class="mt-1 text-xs text-neutral-700 dark:text-neutral-300">Token 状态：未保存</p>
      </div>

      <div class="mb-2 rounded border border-black p-2 dark:border-white">
        <p id="fc-context" class="text-xs text-neutral-700 dark:text-neutral-300">正在识别当前页面上下文...</p>
      </div>

      <div class="mb-2 grid grid-cols-2 gap-2">
        <button type="button" data-action="replyMe" class="fc-btn">读取回复消息</button>
        <button type="button" data-action="listThreads" class="fc-btn">读取帖子列表</button>
        <button type="button" data-action="threadDetail" class="fc-btn">读取帖子详情</button>
        <button type="button" data-action="opAgree" class="fc-btn">点赞</button>
        <button type="button" data-action="addThread" class="fc-btn">发帖</button>
        <button type="button" data-action="addPost" class="fc-btn">回复</button>
      </div>

      <div class="space-y-2 rounded border border-black p-2 dark:border-white">
        ${createField('fc-pn', 'replyMe 页码 pn', '1')}
        ${createField('fc-sort-type', 'listThreads sort_type', '0:时间 3:热门')}
        ${createField('fc-detail-pn', 'threadDetail 页码 pn', '1')}
        ${createField('fc-r', 'threadDetail r', '0:正序 1:倒序 2:热门')}
        ${createField('fc-title', '发帖标题', '最多30字符')}
        ${createTextField('fc-thread-content', '发帖内容', '纯文本，最多1000字符')}
        ${createSelect('fc-reply-target', '回复目标', [
          { value: 'thread', text: '回复当前帖子' },
          { value: 'post', text: '优先回复当前楼层（识别到时）' },
        ])}
        ${createTextField('fc-post-content', '回复内容', '纯文本，最多1000字符')}
        ${createSelect('fc-like-target', '点赞目标', [
          { value: 'thread', text: '当前主帖' },
          { value: 'post', text: '当前楼层（识别到时）' },
        ])}
        ${createSelect('fc-op-type', '点赞动作', [
          { value: '0', text: '点赞' },
          { value: '1', text: '取消点赞' },
        ])}
      </div>
      </div>

      <div class="mt-2 flex items-center justify-between">
        <p id="fc-status" class="text-xs text-neutral-700 dark:text-neutral-300">请选择动作并点击执行。</p>
        <button id="fc-run" type="button" class="fc-btn-primary">执行</button>
      </div>
      <div id="fc-output" class="mt-2 max-h-40 overflow-auto rounded border border-black p-2 text-xs leading-5 dark:border-white">暂无结果</div>
    `;

    root.append(toggle, panel);
    document.documentElement.appendChild(root);

    const close = panel.querySelector<HTMLButtonElement>('#fc-close');
    const dragHandle = panel.querySelector<HTMLElement>('#fc-drag-handle');
    const runBtn = panel.querySelector<HTMLButtonElement>('#fc-run');
    const tokenInput = panel.querySelector<HTMLTextAreaElement>('#fc-token');
    const tokenSaveBtn = panel.querySelector<HTMLButtonElement>('#fc-token-save');
    const tokenClearBtn = panel.querySelector<HTMLButtonElement>('#fc-token-clear');
    const tokenStateNode = panel.querySelector<HTMLElement>('#fc-token-state');
    const contextNode = panel.querySelector<HTMLElement>('#fc-context');
    const feedbackNode = panel.querySelector<HTMLElement>('#fc-feedback');
    const statusNode = panel.querySelector<HTMLElement>('#fc-status');
    const outputNode = panel.querySelector<HTMLElement>('#fc-output');
    const actionButtons = Array.from(panel.querySelectorAll<HTMLButtonElement>('button[data-action]'));

    let selectedAction: TiebaAction = 'addPost';
    const runtimeContext: RuntimeContext = {
      threadId: readCurrentThreadId(),
      postId: readCurrentPostId(),
      fallbackThreadId: null,
    };

    if (contextNode) {
      const threadDetected = runtimeContext.threadId ? '已识别当前帖子' : '未识别当前帖子';
      const postDetected = runtimeContext.postId ? '已识别当前楼层' : '未识别当前楼层';
      contextNode.textContent = `页面上下文：${threadDetected}，${postDetected}。`;
    }

    const panelWidth = 360;
    const safePadding = 8;
    const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
    const placeToggle = (left: number, top: number): void => {
      const width = toggle.offsetWidth || 80;
      const height = toggle.offsetHeight || 30;
      const maxLeft = Math.max(safePadding, window.innerWidth - width - safePadding);
      const maxTop = Math.max(safePadding, window.innerHeight - height - safePadding);
      toggle.style.left = `${clamp(left, safePadding, maxLeft)}px`;
      toggle.style.top = `${clamp(top, safePadding, maxTop)}px`;
      toggle.style.right = 'auto';
      toggle.style.bottom = 'auto';
    };

    const placePanel = (left: number, top: number): void => {
      const maxLeft = Math.max(safePadding, window.innerWidth - panel.offsetWidth - safePadding);
      const maxTop = Math.max(safePadding, window.innerHeight - panel.offsetHeight - safePadding);
      panel.style.left = `${clamp(left, safePadding, maxLeft)}px`;
      panel.style.top = `${clamp(top, safePadding, maxTop)}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    };

    placeToggle(window.innerWidth - 96, 16);
    placePanel(window.innerWidth - panelWidth - 16, 64);

    let dragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let toggleDragging = false;
    let toggleMoved = false;
    let toggleOffsetX = 0;
    let toggleOffsetY = 0;

    const setFeedback = (message: string): void => {
      if (feedbackNode) {
        feedbackNode.textContent = `最近状态：${message}`;
      }
    };

    toggle.addEventListener('pointerdown', (event) => {
      toggleDragging = true;
      toggleMoved = false;
      const rect = toggle.getBoundingClientRect();
      toggleOffsetX = event.clientX - rect.left;
      toggleOffsetY = event.clientY - rect.top;
      toggle.setPointerCapture(event.pointerId);
    });

    toggle.addEventListener('pointermove', (event) => {
      if (!toggleDragging) {
        return;
      }
      const nextLeft = event.clientX - toggleOffsetX;
      const nextTop = event.clientY - toggleOffsetY;
      const currentLeft = parseFloat(toggle.style.left || '0');
      const currentTop = parseFloat(toggle.style.top || '0');
      if (Math.abs(nextLeft - currentLeft) > 2 || Math.abs(nextTop - currentTop) > 2) {
        toggleMoved = true;
      }
      placeToggle(nextLeft, nextTop);
    });

    toggle.addEventListener('pointerup', (event) => {
      if (toggle.hasPointerCapture(event.pointerId)) {
        toggle.releasePointerCapture(event.pointerId);
      }
      const wasDragging = toggleDragging;
      toggleDragging = false;
      if (wasDragging && !toggleMoved) {
        panel.classList.toggle('hidden');
      }
    });

    toggle.addEventListener('pointercancel', (event) => {
      toggleDragging = false;
      if (toggle.hasPointerCapture(event.pointerId)) {
        toggle.releasePointerCapture(event.pointerId);
      }
    });

    dragHandle?.addEventListener('pointerdown', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('#fc-close')) {
        return;
      }

      const rect = panel.getBoundingClientRect();
      dragging = true;
      dragOffsetX = event.clientX - rect.left;
      dragOffsetY = event.clientY - rect.top;
      dragHandle.setPointerCapture(event.pointerId);
    });

    dragHandle?.addEventListener('pointermove', (event) => {
      if (!dragging) {
        return;
      }
      placePanel(event.clientX - dragOffsetX, event.clientY - dragOffsetY);
    });

    const stopDragging = (event: PointerEvent): void => {
      if (!dragging) {
        return;
      }
      dragging = false;
      if (dragHandle?.hasPointerCapture(event.pointerId)) {
        dragHandle.releasePointerCapture(event.pointerId);
      }
    };

    dragHandle?.addEventListener('pointerup', stopDragging);
    dragHandle?.addEventListener('pointercancel', stopDragging);

    window.addEventListener('resize', () => {
      const rect = panel.getBoundingClientRect();
      placePanel(rect.left, rect.top);
      const toggleRect = toggle.getBoundingClientRect();
      placeToggle(toggleRect.left, toggleRect.top);
    });

    function paintSelected(): void {
      for (const button of actionButtons) {
        if (button.dataset.action === selectedAction) {
          button.classList.add('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');
        } else {
          button.classList.remove('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');
        }
      }
      if (statusNode) {
        statusNode.textContent = `已选择动作：${actionLabelMap[selectedAction]}`;
      }
    }

    close?.addEventListener('click', () => {
      panel.classList.add('hidden');
    });

    const initialToken = await resolveToken();
    if (tokenInput) {
      tokenInput.value = initialToken;
    }
    if (tokenStateNode) {
      tokenStateNode.textContent = initialToken.trim().length > 0 ? 'Token 状态：已保存' : 'Token 状态：未保存';
    }

    const handleStorageChange = (
      changes: StorageChanges,
      areaName: StorageAreaName,
    ): void => {
      if (areaName !== 'local') {
        return;
      }

      if (changes[TOKEN_KEY]) {
        const nextToken = typeof changes[TOKEN_KEY].newValue === 'string' ? changes[TOKEN_KEY].newValue : '';
        if (tokenInput) {
          tokenInput.value = nextToken;
        }
        if (tokenStateNode) {
          tokenStateNode.textContent = nextToken.trim().length > 0 ? 'Token 状态：已保存' : 'Token 状态：未保存';
        }
      }

      if (changes[THEME_KEY]) {
        const nextTheme = changes[THEME_KEY].newValue;
        if (nextTheme === 'dark') {
          root.classList.add('dark');
        }
        if (nextTheme === 'light') {
          root.classList.remove('dark');
        }
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    window.addEventListener('beforeunload', () => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    });

    tokenSaveBtn?.addEventListener('click', async () => {
      if (!tokenInput || !tokenStateNode || !statusNode) {
        return;
      }
      const token = tokenInput.value.trim();
      if (!token) {
        statusNode.textContent = 'Token 不能为空。';
        return;
      }

      tokenSaveBtn.disabled = true;
      if (tokenClearBtn) {
        tokenClearBtn.disabled = true;
      }

      try {
        await browser.storage.local.set({ [TOKEN_KEY]: token });
        tokenStateNode.textContent = 'Token 状态：已保存';
        statusNode.textContent = 'Token 已保存，可随时再次修改。';
        setFeedback('Token 保存成功');
      } catch (error) {
        statusNode.textContent = error instanceof Error ? error.message : 'Token 保存失败。';
        setFeedback('Token 保存失败');
      } finally {
        tokenSaveBtn.disabled = false;
        if (tokenClearBtn) {
          tokenClearBtn.disabled = false;
        }
      }
    });

    tokenClearBtn?.addEventListener('click', async () => {
      if (!tokenInput || !tokenStateNode || !statusNode) {
        return;
      }

      tokenClearBtn.disabled = true;
      if (tokenSaveBtn) {
        tokenSaveBtn.disabled = true;
      }

      try {
        await browser.storage.local.remove(TOKEN_KEY);
        tokenInput.value = '';
        tokenStateNode.textContent = 'Token 状态：未保存';
        statusNode.textContent = 'Token 已清空。';
        setFeedback('Token 已清空');
      } catch (error) {
        statusNode.textContent = error instanceof Error ? error.message : 'Token 清空失败。';
        setFeedback('Token 清空失败');
      } finally {
        tokenClearBtn.disabled = false;
        if (tokenSaveBtn) {
          tokenSaveBtn.disabled = false;
        }
      }
    });

    for (const button of actionButtons) {
      button.addEventListener('click', () => {
        const action = button.dataset.action as TiebaAction | undefined;
        if (!action) return;
        selectedAction = action;
        paintSelected();
      });
    }

    runBtn?.addEventListener('click', async () => {
      if (!runBtn || !statusNode || !outputNode) {
        return;
      }

      const payload = buildPayload(selectedAction, panel, runtimeContext);
      const error = validatePayload(selectedAction, payload);
      if (error) {
        statusNode.textContent = error;
        outputNode.textContent = '参数校验失败';
        setFeedback('参数校验失败');
        return;
      }

      runBtn.disabled = true;
      statusNode.textContent = `执行中：${actionLabelMap[selectedAction]}...`;
      setFeedback(`执行中：${actionLabelMap[selectedAction]}`);

      try {
        const message: TiebaRequest = {
          type: 'tieba:request',
          action: selectedAction,
          payload,
        };
        const response = (await browser.runtime.sendMessage(message)) as TiebaResponse;
        if (!response?.ok) {
          throw new Error(response?.error || '请求失败');
        }
        statusNode.textContent = `执行成功：${actionLabelMap[selectedAction]}`;
        outputNode.textContent = summarizeResult(selectedAction, response.data, runtimeContext);
        setFeedback(`执行成功：${actionLabelMap[selectedAction]}`);
      } catch (requestError) {
        statusNode.textContent = requestError instanceof Error ? requestError.message : '请求失败';
        outputNode.textContent = '执行失败';
        setFeedback(`执行失败：${actionLabelMap[selectedAction]}`);
      } finally {
        runBtn.disabled = false;
      }
    });

    paintSelected();
  },
});
