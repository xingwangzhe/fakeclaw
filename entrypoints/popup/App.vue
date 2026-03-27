<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

type ThemeMode = 'light' | 'dark';

const TOKEN_KEY = 'fc_token';
const THEME_KEY = 'fc_theme';

const tokenInput = ref('');
const currentToken = ref('');
const theme = ref<ThemeMode>('light');
const loading = ref(false);
const notice = ref('');

const hasToken = computed(() => currentToken.value.trim().length > 0);

function resolveSystemTheme(): ThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(mode: ThemeMode): void {
  theme.value = mode;
  document.documentElement.classList.toggle('dark', mode === 'dark');
}

async function loadSettings(): Promise<void> {
  loading.value = true;
  notice.value = '';
  try {
    const saved = await browser.storage.local.get([TOKEN_KEY, THEME_KEY]);
    currentToken.value = typeof saved[TOKEN_KEY] === 'string' ? saved[TOKEN_KEY] : '';
    tokenInput.value = currentToken.value;
    const savedTheme = saved[THEME_KEY] === 'dark' || saved[THEME_KEY] === 'light' ? saved[THEME_KEY] : resolveSystemTheme();
    applyTheme(savedTheme);
  } finally {
    loading.value = false;
  }
}

async function saveToken(): Promise<void> {
  const next = tokenInput.value.trim();
  if (!next) {
    notice.value = 'Token 不能为空。';
    return;
  }
  loading.value = true;
  notice.value = '';
  try {
    await browser.storage.local.set({ [TOKEN_KEY]: next });
    currentToken.value = next;
    notice.value = 'Token 已保存，可随时再次修改。';
  } catch (error) {
    notice.value = error instanceof Error ? error.message : '保存失败。';
  } finally {
    loading.value = false;
  }
}

async function clearToken(): Promise<void> {
  loading.value = true;
  notice.value = '';
  try {
    await browser.storage.local.remove(TOKEN_KEY);
    currentToken.value = '';
    tokenInput.value = '';
    notice.value = 'Token 已清空。';
  } catch (error) {
    notice.value = error instanceof Error ? error.message : '清空失败。';
  } finally {
    loading.value = false;
  }
}

async function saveTheme(mode: ThemeMode): Promise<void> {
  applyTheme(mode);
  await browser.storage.local.set({ [THEME_KEY]: mode });
}

onMounted(() => {
  void loadSettings();
});
</script>

<template>
  <main class="min-h-[420px] bg-white p-4 text-sm text-black dark:bg-black dark:text-white">
    <section class="rounded-md border border-black p-3 dark:border-white">
      <h1 class="text-base font-semibold">Fakeclaw 控制台</h1>
      <p class="mt-1 text-xs text-neutral-700 dark:text-neutral-300">仅支持贴吧，黑白极简双模式。</p>
    </section>

    <section class="mt-3 rounded-md border border-black p-3 dark:border-white">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold">主题模式</h2>
        <span class="text-xs text-neutral-700 dark:text-neutral-300">{{ theme }}</span>
      </div>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          class="rounded border px-2 py-1 transition hover:bg-neutral-100 dark:hover:bg-neutral-900"
          :class="theme === 'light' ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black' : 'border-black dark:border-white'"
          @click="saveTheme('light')"
        >
          Light
        </button>
        <button
          type="button"
          class="rounded border px-2 py-1 transition hover:bg-neutral-100 dark:hover:bg-neutral-900"
          :class="theme === 'dark' ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black' : 'border-black dark:border-white'"
          @click="saveTheme('dark')"
        >
          Dark
        </button>
      </div>
    </section>

    <section class="mt-3 rounded-md border border-black p-3 dark:border-white">
      <h2 class="text-sm font-semibold">TB_TOKEN</h2>
      <p class="mt-1 text-xs text-neutral-700 dark:text-neutral-300">支持后续随时修改、覆盖或清空。</p>

      <textarea
        v-model="tokenInput"
        rows="4"
        class="mt-2 w-full resize-none rounded border border-black bg-white p-2 text-xs text-black outline-none ring-0 placeholder:text-neutral-500 focus:border-black dark:border-white dark:bg-black dark:text-white"
        placeholder="粘贴 TB_TOKEN"
      />

      <div class="mt-2 flex gap-2">
        <button
          type="button"
          class="flex-1 rounded border border-black bg-black px-2 py-1 text-white transition hover:bg-neutral-800 disabled:opacity-50 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          :disabled="loading"
          @click="saveToken"
        >
          保存或更新
        </button>
        <button
          type="button"
          class="flex-1 rounded border border-black px-2 py-1 transition hover:bg-neutral-100 disabled:opacity-50 dark:border-white dark:hover:bg-neutral-900"
          :disabled="loading"
          @click="clearToken"
        >
          清空
        </button>
      </div>

      <p class="mt-2 text-xs" :class="hasToken ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-600 dark:text-neutral-400'">
        {{ hasToken ? '当前状态：已保存 Token。' : '当前状态：未保存 Token。' }}
      </p>
      <p v-if="notice" class="mt-1 text-xs text-neutral-700 dark:text-neutral-300">{{ notice }}</p>
    </section>
  </main>
</template>
