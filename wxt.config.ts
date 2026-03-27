import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'fakeclaw',
    host_permissions: ['https://tieba.baidu.com/*'],
    permissions: ['storage'],
  },
});
