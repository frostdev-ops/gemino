import { assertDomains } from './match-patterns.ts';

export const WEB_ONLY_RULESET_ID = 'web_only';
export const WEB_ONLY_UDM = '14';

/** Subset of chrome.declarativeNetRequest.Rule that we generate (plain JSON, no enums). */
export interface DnrRule {
  id: number;
  priority: number;
  action:
    | { type: 'allow' }
    | {
        type: 'redirect';
        redirect: {
          transform: {
            queryTransform: { addOrReplaceParams: { key: string; value: string }[] };
          };
        };
      };
  condition: {
    urlFilter: string;
    requestDomains: string[];
    resourceTypes: ['main_frame'];
  };
}

/**
 * Builds the "Web only" ruleset.
 *
 *  1. (priority 1) /search? main-frame navigations get `udm=14` added or replaced.
 *  2. (priority 2) `allow` when the URL already carries `udm=` or `tbm=`, so Images, News,
 *     Videos, AI Mode links etc. are left alone and the redirect cannot loop (the redirected URL
 *     contains `udm=`, so it matches an allow rule on the next evaluation).
 *
 * requestDomains lists the `www.` hosts only, so e.g. news.google.com is never touched.
 */
export function buildWebOnlyRules(domains: readonly string[]): DnrRule[] {
  assertDomains(domains);
  const requestDomains = domains.map((d) => `www.${d}`);
  const base = { requestDomains, resourceTypes: ['main_frame'] as ['main_frame'] };
  return [
    {
      id: 1,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          transform: {
            queryTransform: { addOrReplaceParams: [{ key: 'udm', value: WEB_ONLY_UDM }] },
          },
        },
      },
      condition: { urlFilter: '/search?', ...base },
    },
    {
      id: 2,
      priority: 2,
      action: { type: 'allow' },
      condition: { urlFilter: 'udm=', ...base },
    },
    {
      id: 3,
      priority: 2,
      action: { type: 'allow' },
      condition: { urlFilter: 'tbm=', ...base },
    },
  ];
}
