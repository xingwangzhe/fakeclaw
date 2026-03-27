import '@/assets/content.css';
import type { TiebaAction, TiebaRequest, TiebaResponse } from '@/types/messages';

type ThemeMode = 'light' | 'dark';

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

function buildPayload(action: TiebaAction, root: HTMLElement): Record<string, unknown> {
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
        kz: value('fc-kz'),
        r: value('fc-r') || '0',
      };
    case 'addThread':
      return {
        title: value('fc-title'),
        content: value('fc-thread-content'),
      };
    case 'addPost':
      return {
        thread_id: value('fc-post-thread-id'),
        post_id: value('fc-post-id'),
        content: value('fc-post-content'),
      };
    case 'opAgree':
      return {
        thread_id: value('fc-agree-thread-id'),
        post_id: value('fc-agree-post-id'),
        obj_type: value('fc-obj-type') || '3',
        op_type: value('fc-op-type') || '0',
      };
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
    return '帖子详情需要填写 thread_id(kz)。';
  }

  if (action === 'opAgree' && !getString('thread_id')) {
    return '点赞需要填写 thread_id。';
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
      'fixed right-4 top-4 z-[2147483647] rounded border border-black bg-white px-3 py-1 text-xs text-black shadow hover:bg-neutral-100 dark:border-white dark:bg-black dark:text-white dark:hover:bg-neutral-900';
    toggle.textContent = 'Fakeclaw';

    const panel = document.createElement('section');
    panel.className = 'fc-panel hidden';
    panel.innerHTML = `
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-sm font-semibold">Fakeclaw 贴吧面板</h2>
        <button type="button" id="fc-close" class="fc-btn">关闭</button>
      </div>
      <p class="mb-2 text-xs text-neutral-700 dark:text-neutral-300">仅黑白双模式。支持发帖、回复、点赞和只读查询。</p>

      <div class="mb-2 rounded border border-black p-2 dark:border-white">
        <label class="fc-label" for="fc-token">TB_TOKEN（可在这里直接修改）</label>
        <textarea id="fc-token" rows="2" class="fc-input resize-none" placeholder="粘贴 TB_TOKEN"></textarea>
        <div class="mt-2 flex gap-2">
          <button type="button" id="fc-token-save" class="fc-btn-primary">保存 Token</button>
          <button type="button" id="fc-token-clear" class="fc-btn">清空 Token</button>
        </div>
        <p id="fc-token-state" class="mt-1 text-xs text-neutral-700 dark:text-neutral-300">Token 状态：未保存</p>
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
        ${createField('fc-kz', 'thread_id(kz)', '123456')}
        ${createField('fc-r', 'threadDetail r', '0:正序 1:倒序 2:热门')}
        ${createField('fc-title', '发帖标题', '最多30字符')}
        ${createTextField('fc-thread-content', '发帖内容', '纯文本，最多1000字符')}
        ${createField('fc-post-thread-id', '回复 thread_id', '可选')}
        ${createField('fc-post-id', '回复 post_id', '可选')}
        ${createTextField('fc-post-content', '回复内容', '纯文本，最多1000字符')}
        ${createField('fc-agree-thread-id', '点赞 thread_id', '必填')}
        ${createField('fc-agree-post-id', '点赞 post_id', '可选')}
        ${createField('fc-obj-type', 'obj_type', '1楼层 2楼中楼 3主帖')}
        ${createField('fc-op-type', 'op_type', '0点赞 1取消')}
      </div>

      <div class="mt-2 flex items-center justify-between">
        <p id="fc-status" class="text-xs text-neutral-700 dark:text-neutral-300">请选择动作并点击执行。</p>
        <button id="fc-run" type="button" class="fc-btn-primary">执行</button>
      </div>
      <pre id="fc-output" class="mt-2 max-h-40 overflow-auto rounded border border-black p-2 text-[11px] dark:border-white">暂无结果</pre>
    `;

    root.append(toggle, panel);
    document.documentElement.appendChild(root);

    const close = panel.querySelector<HTMLButtonElement>('#fc-close');
    const runBtn = panel.querySelector<HTMLButtonElement>('#fc-run');
    const tokenInput = panel.querySelector<HTMLTextAreaElement>('#fc-token');
    const tokenSaveBtn = panel.querySelector<HTMLButtonElement>('#fc-token-save');
    const tokenClearBtn = panel.querySelector<HTMLButtonElement>('#fc-token-clear');
    const tokenStateNode = panel.querySelector<HTMLElement>('#fc-token-state');
    const statusNode = panel.querySelector<HTMLElement>('#fc-status');
    const outputNode = panel.querySelector<HTMLElement>('#fc-output');
    const actionButtons = Array.from(panel.querySelectorAll<HTMLButtonElement>('button[data-action]'));

    let selectedAction: TiebaAction = 'addPost';

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

    toggle.addEventListener('click', () => {
      panel.classList.toggle('hidden');
    });

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
      } catch (error) {
        statusNode.textContent = error instanceof Error ? error.message : 'Token 保存失败。';
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
      } catch (error) {
        statusNode.textContent = error instanceof Error ? error.message : 'Token 清空失败。';
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

      const payload = buildPayload(selectedAction, panel);
      const error = validatePayload(selectedAction, payload);
      if (error) {
        statusNode.textContent = error;
        outputNode.textContent = '参数校验失败';
        return;
      }

      runBtn.disabled = true;
      statusNode.textContent = `执行中：${actionLabelMap[selectedAction]}...`;

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
        outputNode.textContent = JSON.stringify(response.data, null, 2);
      } catch (requestError) {
        statusNode.textContent = requestError instanceof Error ? requestError.message : '请求失败';
        outputNode.textContent = '执行失败';
      } finally {
        runBtn.disabled = false;
      }
    });

    paintSelected();
  },
});
