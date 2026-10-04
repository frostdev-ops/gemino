import { readFileSync } from 'node:fs';
import { defineManifest } from '@crxjs/vite-plugin';
import { matchPatterns } from './src/shared/match-patterns.ts';
import { WEB_ONLY_RULESET_ID } from './src/shared/web-only-rules.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};
const domains = JSON.parse(
  readFileSync(new URL('./src/shared/google-domains.json', import.meta.url), 'utf8'),
) as string[];

const matches = matchPatterns(domains);

export default defineManifest({
  manifest_version: 3,
  name: '__MSG_extName__',
  description: '__MSG_extDescription__',
  default_locale: 'en',
  version: pkg.version,
  minimum_chrome_version: '110',
  icons: {
    '16': 'icons/icon-16.png',
    '32': 'icons/icon-32.png',
    '48': 'icons/icon-48.png',
    '128': 'icons/icon-128.png',
  },
  action: {
    default_title: '__MSG_extName__',
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
    },
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  // declarativeNetRequestWithHostAccess (rather than declarativeNetRequest) avoids the broad
  // "block content on any page" install warning; redirects are limited to our host permissions.
  permissions: ['storage', 'declarativeNetRequestWithHostAccess'],
  host_permissions: matches,
  content_scripts: [
    {
      // Hides AI Overview candidates until the main script has processed the page.
      matches,
      js: ['src/content/prehide.iife.ts'],
      css: ['src/content/prehide.css'],
      run_at: 'document_start',
    },
    {
      matches,
      js: ['src/content/index.iife.ts'],
      css: ['src/content/content.css'],
      run_at: 'document_idle',
    },
  ],
  declarative_net_request: {
    rule_resources: [
      {
        id: WEB_ONLY_RULESET_ID,
        enabled: false,
        path: 'rules/web_only.json',
      },
    ],
  },
  commands: {
    'toggle-gemino': {
      suggested_key: { default: 'Alt+Shift+G' },
      description: '__MSG_cmdToggle__',
    },
  },
});
