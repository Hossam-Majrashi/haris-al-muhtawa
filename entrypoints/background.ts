import {
  getApprovedChannels,
  saveApprovedChannels,
  addApprovedChannel,
  addBlockedChannel,
  getNewUploads,
  saveNewUploads,
  recordVideoUpload,
  getSettings,
  updateBadgeCount,
  saveWhitelistFeedVideos,
} from '@/utils/storage';
import { fetchChannelUploads, resolveChannelIdFromHandle, isValidChannelAvatar } from '@/utils/youtube';
import type { ApprovedChannel, NewUploadVideo } from '@/utils/types';

const ALARM_NAME = 'haris-poll-new-uploads';
const CONTEXT_MENU_ID = 'haris-context-add-channel';
const CONTEXT_MENU_BLOCK_ID = 'haris-context-block-channel';

import { t, loadLanguageMessages } from '@/utils/i18n';

/**
 * Configure or reschedule the background polling alarm.
 */
async function setupPollAlarm(): Promise<void> {
  const settings = await getSettings();
  const periodInMinutes = Math.max(1, settings.pollIntervalMinutes || 30);

  await browser.alarms.clear(ALARM_NAME);
  browser.alarms.create(ALARM_NAME, {
    periodInMinutes,
    delayInMinutes: 1, // initial run shortly after setup
  });
  console.log(`[Haris] Alarm configured to poll every ${periodInMinutes} minutes.`);
}

/**
 * Set up context menu items (right-click shortcut on extension icon or page).
 */
async function setupContextMenu(): Promise<void> {
  try {
    const settings = await getSettings();
    const lang = settings.language || 'ar';
    await loadLanguageMessages(lang);

    browser.contextMenus.removeAll(() => {
      if (browser.runtime.lastError) {
        // ignore error if menu did not exist previously
      }
      browser.contextMenus.create({
        id: CONTEXT_MENU_ID,
        title: t('contextMenuAdd', lang),
        contexts: ['action', 'page'],
      });
      browser.contextMenus.create({
        id: CONTEXT_MENU_BLOCK_ID,
        title: t('blockCurrentChannel', lang),
        contexts: ['action', 'page'],
      });
    });
  } catch (err) {
    console.warn('[Haris] Failed to set up context menu:', err);
  }
}

/**
 * Add channel from the currently active tab when user invokes context menu or shortcut.
 */
async function addChannelFromActiveTab(tab?: Browser.tabs.Tab): Promise<void> {
  let targetTab = tab;
  if (!targetTab || !targetTab.id || !targetTab.url) {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    targetTab = tabs[0];
  }

  if (!targetTab?.id || !targetTab?.url) return;

  const url = targetTab.url;
  if (!url.includes('youtube.com')) return;

  try {
    // 1. Try querying the active tab's content script
    const info = await browser.tabs.sendMessage(targetTab.id, {
      type: 'GET_CURRENT_CHANNEL_INFO',
    });

    if (info && (info.id || info.handle)) {
      await addApprovedChannel({
        id: info.id,
        handle: info.handle,
        name: info.name,
        avatarUrl: info.avatarUrl,
      });

      // Fetch uploads immediately in background
      checkAllApprovedChannels().catch(() => {});

      // Visual confirmation on badge
      await browser.action.setBadgeText({ text: '✓' });
      await browser.action.setBadgeBackgroundColor({ color: '#16a34a' });
      setTimeout(async () => {
        await updateBadgeCount();
      }, 2500);
      return;
    }
  } catch {
    // Content script might not be injected yet on this page; fallback to URL
  }

  // 2. Fallback: URL extraction
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    let handle = '';
    let id = '';

    if (path.startsWith('/@')) {
      handle = path.split('/')[1]?.split('?')[0] || '';
    } else if (path.startsWith('/channel/')) {
      id = path.split('/')[2]?.split('?')[0] || '';
    }

    if (handle) {
      const resolved = await resolveChannelIdFromHandle(handle);
      await addApprovedChannel({
        id: resolved.id || '',
        handle,
        name: resolved.name || handle,
        avatarUrl: resolved.avatarUrl,
      });

      checkAllApprovedChannels().catch(() => {});

      await browser.action.setBadgeText({ text: '✓' });
      await browser.action.setBadgeBackgroundColor({ color: '#16a34a' });
      setTimeout(async () => {
        await updateBadgeCount();
      }, 2500);
    }
  } catch (err) {
    console.warn('[Haris] Failed to add channel from active tab:', err);
  }
}

/**
 * Block channel from the currently active tab when user invokes context menu.
 */
async function blockChannelFromActiveTab(tab?: Browser.tabs.Tab): Promise<void> {
  let targetTab = tab;
  if (!targetTab || !targetTab.id || !targetTab.url) {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    targetTab = tabs[0];
  }

  if (!targetTab?.id || !targetTab?.url) return;

  const url = targetTab.url;
  if (!url.includes('youtube.com')) return;

  try {
    const info = await browser.tabs.sendMessage(targetTab.id, {
      type: 'GET_CURRENT_CHANNEL_INFO',
    });

    if (info && (info.id || info.handle)) {
      await addBlockedChannel({
        id: info.id,
        handle: info.handle,
        name: info.name,
        avatarUrl: info.avatarUrl,
      });

      await browser.action.setBadgeText({ text: '⊘' });
      await browser.action.setBadgeBackgroundColor({ color: '#dc2626' });
      setTimeout(async () => {
        await updateBadgeCount();
      }, 2500);
      return;
    }
  } catch {
    // Fallback: URL extraction
  }

  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    let handle = '';
    let id = '';

    if (path.startsWith('/@')) {
      handle = path.split('/')[1]?.split('?')[0] || '';
    } else if (path.startsWith('/channel/')) {
      id = path.split('/')[2]?.split('?')[0] || '';
    }

    if (handle) {
      const resolved = await resolveChannelIdFromHandle(handle);
      await addBlockedChannel({
        id: resolved.id || '',
        handle,
        name: resolved.name || handle,
        avatarUrl: resolved.avatarUrl,
      });

      await browser.action.setBadgeText({ text: '⊘' });
      await browser.action.setBadgeBackgroundColor({ color: '#dc2626' });
      setTimeout(async () => {
        await updateBadgeCount();
      }, 2500);
    }
  } catch (err) {
    console.warn('[Haris] Failed to block channel from active tab:', err);
  }
}

/**
 * Check all approved channels for new video uploads.
 */
async function checkAllApprovedChannels(): Promise<number> {
  console.log('[Haris] Starting check for new uploads...');
  const channels = await getApprovedChannels();
  if (channels.length === 0) {
    await updateBadgeCount(0);
    await saveWhitelistFeedVideos([]);
    return 0;
  }

  const existingUploads = await getNewUploads();
  const existingVideoIds = new Set(existingUploads.map((v) => v.videoId));
  const newVideosFound: NewUploadVideo[] = [];
  const updatedChannels: ApprovedChannel[] = [];
  const allFeedVideos: NewUploadVideo[] = [];
  const feedVideoIds = new Set<string>();
  let channelsModified = false;

  for (const channel of channels) {
    let channelId = channel.id;

    // If channel ID or avatar is missing/invalid, or name starts with @, attempt to resolve from handle
    const badAvatar = !channel.avatarUrl || !isValidChannelAvatar(channel.avatarUrl);
    const badName = !channel.name || channel.name === channel.handle || channel.name.startsWith('@');
    if ((!channelId || badAvatar || badName) && channel.handle) {
      const resolved = await resolveChannelIdFromHandle(channel.handle);
      if (resolved.id && !channelId) {
        channelId = resolved.id;
        channel.id = resolved.id;
        channelsModified = true;
      }
      if (resolved.name && (badName || channel.name !== resolved.name)) {
        channel.name = resolved.name;
        channelsModified = true;
      }
      if (resolved.avatarUrl && (badAvatar || channel.avatarUrl !== resolved.avatarUrl)) {
        channel.avatarUrl = resolved.avatarUrl;
        channelsModified = true;
      }
    }

    if (!channelId) {
      updatedChannels.push(channel);
      continue;
    }

    try {
      const videos = await fetchChannelUploads(channelId);

      // Collect uploads for the dedicated Whitelist Home Feed (does not pollute the popup's approved videos list)
      for (const vid of videos) {
        if (!feedVideoIds.has(vid.videoId)) {
          feedVideoIds.add(vid.videoId);
          allFeedVideos.push({
            videoId: vid.videoId,
            title: vid.title,
            channelId,
            channelName: channel.name || channel.handle || 'Approved Channel',
            publishedAt: vid.publishedAt,
            url: vid.url,
            thumbnail: vid.thumbnail,
            isRead: true,
          });
        }
      }

      const latest = videos[0];
      if (latest) {
        if (!channel.lastKnownVideoId) {
          // First time tracking this channel: record the latest video ID so we only alert on future uploads
          channel.lastKnownVideoId = latest.videoId;
          channelsModified = true;
        } else if (channel.lastKnownVideoId !== latest.videoId) {
          // There is at least one newer video!
          for (const vid of videos) {
            if (vid.videoId === channel.lastKnownVideoId) {
              break;
            }
            if (!existingVideoIds.has(vid.videoId)) {
              newVideosFound.push({
                videoId: vid.videoId,
                title: vid.title,
                channelId,
                channelName: channel.name || channel.handle || 'Approved Channel',
                publishedAt: vid.publishedAt,
                url: vid.url,
                thumbnail: vid.thumbnail,
                isRead: false,
              });
              existingVideoIds.add(vid.videoId);
            }
          }
          channel.lastKnownVideoId = latest.videoId;
          channelsModified = true;
        }
      }
    } catch (err) {
      console.warn(`[Haris] Error checking channel ${channel.name} (${channelId}):`, err);
    }

    updatedChannels.push(channel);
  }

  if (channelsModified) {
    await saveApprovedChannels(updatedChannels);
  }

  // Save Whitelist Home Feed videos (sorted newest first)
  if (allFeedVideos.length > 0) {
    allFeedVideos.sort((a, b) => {
      const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return timeB - timeA;
    });
    await saveWhitelistFeedVideos(allFeedVideos);
  }

  if (newVideosFound.length > 0) {
    const combined = [...newVideosFound, ...existingUploads].slice(0, 150);
    await saveNewUploads(combined);
  }

  await updateBadgeCount();
  return newVideosFound.length;
}

export default defineBackground(() => {
  console.log('[Haris] Background service worker initialized.');

  // Set up alarm and context menu on installation or startup
  browser.runtime.onInstalled.addListener(async () => {
    await setupPollAlarm();
    setupContextMenu();
    await updateBadgeCount();
  });

  browser.runtime.onStartup.addListener(async () => {
    await setupPollAlarm();
    setupContextMenu();
    await updateBadgeCount();
  });

  // Handle scheduled alarm
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === ALARM_NAME) {
      await checkAllApprovedChannels();
    }
  });

  // Handle right-click context menu
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_ID) {
      await addChannelFromActiveTab(tab);
    } else if (info.menuItemId === CONTEXT_MENU_BLOCK_ID) {
      await blockChannelFromActiveTab(tab);
    }
  });

  // Handle messages from popup or content script
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'RECORD_WATCHED_VIDEO' && message.video) {
      (async () => {
        try {
          await recordVideoUpload(message.video);
          sendResponse({ success: true });
        } catch (err) {
          sendResponse({ success: false, error: String(err) });
        }
      })();
      return true;
    }

    if (message?.type === 'POLL_FEEDS_NOW') {
      (async () => {
        try {
          const newCount = await checkAllApprovedChannels();
          sendResponse({ success: true, newCount });
        } catch (err) {
          sendResponse({ success: false, error: String(err) });
        }
      })();
      return true; // Keep channel open for async response
    }

    if (message?.type === 'RESET_ALARM') {
      (async () => {
        await setupPollAlarm();
        await setupContextMenu();
        sendResponse({ success: true });
      })();
      return true;
    }

    if (message?.type === 'RESOLVE_CHANNEL') {
      (async () => {
        const result = await resolveChannelIdFromHandle(message.handle);
        sendResponse(result);
      })();
      return true;
    }

    if (message?.type === 'FETCH_ORIGINAL_TITLE' && message.videoId) {
      (async () => {
        try {
          const resp = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${message.videoId}&format=json`
          );
          if (resp.ok) {
            const data = await resp.json();
            sendResponse({ success: true, title: data.title });
            return;
          }
          sendResponse({ success: false });
        } catch (err) {
          sendResponse({ success: false, error: String(err) });
        }
      })();
      return true;
    }
  });
});
