import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'ar',
    permissions: ['storage', 'alarms', 'contextMenus', 'tabs'],
    host_permissions: ['*://*.youtube.com/*'],
    action: {
      default_title: '__MSG_extName__',
    },
    browser_specific_settings: {
      gecko: {
        id: 'haris-al-muhtawa@extension',
        strict_min_version: '142.0',
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
  },
});
