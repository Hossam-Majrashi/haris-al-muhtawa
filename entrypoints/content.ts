import {
  getApprovedChannels,
  addApprovedChannel,
  removeApprovedChannel,
  isChannelApproved,
  getBlockedChannels,
  removeBlockedChannel,
  isChannelBlocked,
  getSettings,
  getNewUploads,
  recordVideoUpload,
  removeNewUploadVideo,
  isVideoApproved,
  DEFAULT_SETTINGS,
} from '@/utils/storage';
import { isValidChannelAvatar } from '@/utils/youtube';
import { t, loadLanguageMessages } from '@/utils/i18n';
import type { SupportedLanguage } from '@/utils/i18n';
import type { ApprovedChannel, BlockedChannel, NewUploadVideo, AppSettings } from '@/utils/types';

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_idle',
  main() {
    console.log('[Haris] Content script initialized on YouTube.');

    let cachedApprovedChannels: ApprovedChannel[] = [];
    let cachedBlockedChannels: BlockedChannel[] = [];
    let cachedApprovedVideos: NewUploadVideo[] = [];
    let cachedSettings: AppSettings = { ...DEFAULT_SETTINGS };
    let currentLang: SupportedLanguage = 'ar';
    let isProcessing = false;
    const originalTitleCache = new Map<string, string>();
    const fetchingTitles = new Set<string>();

    function applyShortsClass() {
      if (cachedSettings.hideShorts !== false) {
        document.documentElement.classList.add('haris-hide-shorts');
      } else {
        document.documentElement.classList.remove('haris-hide-shorts');
      }
    }

    function handleShortsRedirect() {
      if (cachedSettings.hideShorts === false) return;
      const path = window.location.pathname;
      if (path.startsWith('/shorts/')) {
        const shortId = path.split('/')[2]?.split('?')[0];
        if (shortId) {
          console.log(`[Haris] Redirecting Shorts /shorts/${shortId} to standard player /watch?v=${shortId}`);
          window.location.replace(`https://www.youtube.com/watch?v=${shortId}`);
        }
      }
    }

    // Inject styles for Haris UI elements
    function injectStyles() {
      if (document.getElementById('haris-injected-styles')) return;
      const style = document.createElement('style');
      style.id = 'haris-injected-styles';
      style.textContent = `
        .haris-channel-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 36px;
          padding: 0 16px;
          margin-inline-start: 10px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          border-radius: 18px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid transparent;
          vertical-align: middle;
          user-select: none;
          z-index: 10;
        }

        .haris-channel-btn.not-added {
          background-color: rgba(255, 255, 255, 0.1);
          color: #f1f1f1;
          border-color: rgba(255, 255, 255, 0.2);
        }
        .haris-channel-btn.not-added:hover {
          background-color: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.35);
          transform: translateY(-1px);
        }

        /* Light mode fallback when YouTube is in light mode */
        html:not([dark]) .haris-channel-btn.not-added {
          background-color: rgba(0, 0, 0, 0.05);
          color: #0f0f0f;
          border-color: rgba(0, 0, 0, 0.15);
        }
        html:not([dark]) .haris-channel-btn.not-added:hover {
          background-color: rgba(0, 0, 0, 0.1);
        }

        .haris-channel-btn.is-added {
          background-color: #16a34a !important;
          color: #ffffff !important;
          border-color: #15803d !important;
          box-shadow: 0 2px 8px rgba(22, 163, 74, 0.35);
        }
        .haris-channel-btn.is-added:hover {
          background-color: #15803d !important;
          transform: translateY(-1px);
        }

        .haris-channel-btn.is-blocked {
          background-color: #dc2626 !important;
          color: #ffffff !important;
          border-color: #b91c1c !important;
          box-shadow: 0 2px 8px rgba(220, 38, 38, 0.35);
        }
        .haris-channel-btn.is-blocked:hover {
          background-color: #b91c1c !important;
          transform: translateY(-1px);
        }

        .haris-channel-btn.block-btn-not-blocked {
          background-color: rgba(239, 68, 68, 0.12);
          color: #f87171;
          border-color: rgba(239, 68, 68, 0.3);
        }
        .haris-channel-btn.block-btn-not-blocked:hover {
          background-color: rgba(239, 68, 68, 0.25);
          border-color: rgba(239, 68, 68, 0.5);
          color: #ffffff;
          transform: translateY(-1px);
        }

        html:not([dark]) .haris-channel-btn.block-btn-not-blocked {
          background-color: rgba(239, 68, 68, 0.08);
          color: #dc2626;
          border-color: rgba(239, 68, 68, 0.25);
        }
        html:not([dark]) .haris-channel-btn.block-btn-not-blocked:hover {
          background-color: rgba(239, 68, 68, 0.16);
          color: #b91c1c;
        }

        .haris-approved-badge {
          position: absolute;
          top: 8px;
          inset-inline-start: 8px;
          z-index: 15;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #16a34a;
          color: #ffffff;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.2px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
          pointer-events: none;
          backdrop-filter: blur(4px);
          animation: harisFadeIn 0.25s ease-out;
        }

        @keyframes harisFadeIn {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }

        /* Blocked video watch page overlay */
        .haris-blocked-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 1000;
          background: rgba(15, 15, 15, 0.95);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          animation: harisFadeIn 0.3s ease-out;
        }
        .haris-blocked-overlay-card {
          background: #1e1e1e;
          border: 1px solid rgba(239, 68, 68, 0.3);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
          padding: 32px 40px;
          border-radius: 16px;
          text-align: center;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }
        .haris-blocked-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .haris-blocked-overlay-card h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: #f87171;
        }
        .haris-blocked-overlay-card p {
          margin: 0;
          font-size: 14px;
          color: #a3a3a3;
          direction: ltr;
        }
        .haris-unblock-btn {
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 10px;
          padding: 10px 22px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 8px;
          transition: all 0.2s;
          font-family: inherit;
        }
        .haris-unblock-btn:hover {
          background: #dc2626;
          transform: translateY(-1px);
        }

        /* YouTube Shorts suppression */
        html.haris-hide-shorts ytd-rich-shelf-renderer[is-shorts],
        html.haris-hide-shorts ytd-reel-shelf-renderer,
        html.haris-hide-shorts ytd-shorts,
        html.haris-hide-shorts ytd-video-renderer:has(a[href*="/shorts/"]),
        html.haris-hide-shorts ytd-rich-item-renderer:has(a[href*="/shorts/"]),
        html.haris-hide-shorts ytd-grid-video-renderer:has(a[href*="/shorts/"]),
        html.haris-hide-shorts ytd-compact-video-renderer:has(a[href*="/shorts/"]),
        html.haris-hide-shorts ytd-guide-entry-renderer:has(a[title*="Shorts"], a[title*="شورت"], a[href*="/shorts"]),
        html.haris-hide-shorts ytd-mini-guide-entry-renderer:has(a[title*="Shorts"], a[title*="شورت"], a[href*="/shorts"]),
        html.haris-hide-shorts yt-tab-shape[tab-title*="Shorts"],
        html.haris-hide-shorts yt-tab-shape[tab-title*="شورت"],
        html.haris-hide-shorts yt-tab-group-shape yt-tab-shape:has(a[href*="/shorts"]),
        html.haris-hide-shorts [role="tab"]:has(a[href*="/shorts"]) {
          display: none !important;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    async function loadData() {
      cachedApprovedChannels = await getApprovedChannels();
      cachedBlockedChannels = await getBlockedChannels();
      cachedApprovedVideos = await getNewUploads();
      const settings = await getSettings();
      cachedSettings = settings;
      currentLang = settings.language || 'ar';
      applyShortsClass();
      await loadLanguageMessages(currentLang);
    }

    /**
     * Extracts channel details from the current video watch page.
     */
    function extractWatchPageChannel(): { id: string; handle: string; name: string; avatarUrl?: string } | null {
      const ownerContainer = document.querySelector(
        'ytd-watch-metadata #owner, #owner, ytd-video-owner-renderer'
      );
      if (!ownerContainer) return null;

      const channelLink = ownerContainer.querySelector<HTMLAnchorElement>(
        'ytd-channel-name a, #channel-name a, #upload-info #channel-name a, a[href*="/@"], a[href*="/channel/"]'
      );
      const nameEl = ownerContainer.querySelector(
        '#channel-name #text, ytd-channel-name #text, #text.ytd-channel-name'
      );

      const rawName = (nameEl?.textContent || channelLink?.textContent || '').trim();
      const href = channelLink?.getAttribute('href') || '';

      let handle = '';
      let id = '';

      if (href.includes('/@')) {
        const match = href.match(/\/(@[^\/?]+)/);
        if (match?.[1]) handle = match[1];
      } else if (href.includes('/channel/')) {
        const match = href.match(/\/channel\/([^\/?]+)/);
        if (match?.[1]) id = match[1];
      }

      // Check meta tag as fallback for Channel ID
      if (!id) {
        const metaId = document.querySelector('meta[itemprop="channelId"]')?.getAttribute('content');
        if (metaId) id = metaId;
      }

      if (!id && !handle) return null;

      // Clean display name so it does not start with @
      let name = rawName;
      if (!name || name.startsWith('@')) {
        name = (rawName || handle).replace(/^@/, '') || id;
      }

      // Extract real channel avatar
      const avatarSelectors = [
        '#owner yt-avatar-shape img',
        'ytd-watch-metadata #owner img',
        '#avatar img',
        'ytd-video-owner-renderer img',
        '#owner img',
        'yt-img-shadow#avatar img',
      ];
      let avatarUrl: string | undefined = undefined;
      for (const sel of avatarSelectors) {
        const img = ownerContainer.querySelector<HTMLImageElement>(sel);
        const src = img?.src || img?.getAttribute('src');
        if (src && isValidChannelAvatar(src)) {
          avatarUrl = src;
          break;
        }
      }

      return {
        id,
        handle: handle ? (handle.startsWith('@') ? handle : `@${handle}`) : '',
        name,
        avatarUrl,
      };
    }

    /**
     * Extracts channel details from a channel homepage / video list page.
     */
    function extractChannelPageChannel(): { id: string; handle: string; name: string; avatarUrl?: string } | null {
      const path = window.location.pathname;
      let handle = '';
      let id = '';

      if (path.startsWith('/@')) {
        handle = path.split('/')[1]?.split('?')[0] || '';
      } else if (path.startsWith('/channel/')) {
        id = path.split('/')[2]?.split('?')[0] || '';
      } else {
        return null;
      }

      if (handle && !handle.startsWith('@')) {
        handle = `@${handle}`;
      }

      // 1. Channel display name extraction:
      // Modern YouTube uses yt-page-header-renderer or #page-header h1
      const nameEl = document.querySelector(
        'yt-page-header-renderer h1, #page-header h1, ytd-browse[page-subtype="channels"] #channel-header h1, #channel-header h1, ytd-c4-tabbed-header-renderer #channel-name, ytd-channel-name #text, #channel-name #text, .dynamic-text-view-model-wiz__h1'
      );
      let name = nameEl?.textContent?.trim() || '';

      // Fallback: document.title without "- YouTube" and notification counts
      if (!name || name.startsWith('@')) {
        const docTitle = document.title
          .replace(/^\(\d+\)\s*/, '')
          .replace(/\s*-\s*YouTube$/i, '')
          .trim();
        if (docTitle && docTitle.toLowerCase() !== 'youtube') {
          name = docTitle;
        }
      }

      // Fallback: meta[property="og:title"]
      if (!name || name.startsWith('@')) {
        const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim();
        if (ogTitle && ogTitle.toLowerCase() !== 'youtube' && !ogTitle.startsWith('@')) {
          name = ogTitle;
        }
      }

      // If name is still empty or equal to handle, strip @ from handle for display
      if (!name || name.startsWith('@')) {
        name = (name || handle).replace(/^@/, '') || id;
      }

      // 2. Channel ID extraction:
      if (!id) {
        const metaId = document.querySelector('meta[itemprop="channelId"]')?.getAttribute('content');
        if (metaId) id = metaId;
        const ogUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content') || '';
        const ogMatch = ogUrl.match(/channel\/(UC[a-zA-Z0-9_-]+)/);
        if (ogMatch?.[1]) id = ogMatch[1];
      }

      // 3. Real channel avatar extraction (must NOT be generic YouTube logo):
      const avatarSelectors = [
        'yt-page-header-renderer yt-avatar-shape img',
        'yt-page-header-view-model yt-avatar-shape img',
        'yt-page-header-renderer img.yt-core-image',
        '#page-header yt-avatar-shape img',
        '#channel-header yt-avatar-shape img',
        '#channel-header img',
        'ytd-c4-tabbed-header-renderer yt-avatar-shape img',
        'ytd-c4-tabbed-header-renderer #avatar img',
        'yt-avatar-shape img',
        '#avatar img',
      ];
      let avatarUrl: string | undefined = undefined;
      for (const sel of avatarSelectors) {
        const img = document.querySelector<HTMLImageElement>(sel);
        const src = img?.src || img?.getAttribute('src');
        if (src && isValidChannelAvatar(src)) {
          avatarUrl = src;
          break;
        }
      }

      if (!avatarUrl) {
        const linkImage = document.querySelector('link[rel="image_src"]')?.getAttribute('href');
        if (linkImage && isValidChannelAvatar(linkImage)) {
          avatarUrl = linkImage;
        }
      }

      if (!avatarUrl) {
        const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
        if (ogImage && isValidChannelAvatar(ogImage)) {
          avatarUrl = ogImage;
        }
      }

      return {
        id,
        handle,
        name,
        avatarUrl,
      };
    }

    /**
     * Injects or updates the floating "Add to my list" button near the channel header.
     */
    async function updateChannelButton() {
      const isWatch = window.location.pathname.startsWith('/watch');
      const isChannel =
        window.location.pathname.startsWith('/@') || window.location.pathname.startsWith('/channel/');

      let channelInfo: { id: string; handle: string; name: string; avatarUrl?: string } | null = null;
      let targetContainer: Element | null = null;

      if (isWatch) {
        channelInfo = extractWatchPageChannel();
        targetContainer = document.querySelector(
          'ytd-watch-metadata #owner #subscribe-button, #owner #subscribe-button, ytd-video-owner-renderer #subscribe-button'
        );
      } else if (isChannel) {
        channelInfo = extractChannelPageChannel();
        targetContainer = document.querySelector(
          '#channel-header #buttons, ytd-c4-tabbed-header-renderer #buttons, #inner-header-container #subscribe-button'
        );
      }

      if (!channelInfo || !targetContainer) return;

      const isBlocked =
        (channelInfo.id && isChannelBlocked(channelInfo.id, cachedBlockedChannels)) ||
        (channelInfo.handle && isChannelBlocked(channelInfo.handle, cachedBlockedChannels)) ||
        (channelInfo.name && isChannelBlocked(channelInfo.name, cachedBlockedChannels));

      const isApproved =
        !isBlocked &&
        ((channelInfo.id && isChannelApproved(channelInfo.id, cachedApprovedChannels)) ||
          (channelInfo.handle && isChannelApproved(channelInfo.handle, cachedApprovedChannels)));

      let existingBtn = document.getElementById('haris-toggle-channel-btn') as HTMLButtonElement | null;

      if (!existingBtn) {
        existingBtn = document.createElement('button');
        existingBtn.id = 'haris-toggle-channel-btn';
        targetContainer.parentElement?.insertBefore(existingBtn, targetContainer.nextSibling);
      }

      const activeText = isApproved ? t('inMyList', currentLang) : t('addToList', currentLang);
      existingBtn.className = `haris-channel-btn ${isApproved ? 'is-added' : 'not-added'}`;
      existingBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          ${
            isApproved
              ? '<polyline points="20 6 9 17 4 12"></polyline>'
              : '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>'
          }
        </svg>
        <span>${activeText}</span>
      `;

      // Attach click handler (clone to clear previous listeners)
      const newBtn = existingBtn.cloneNode(true) as HTMLButtonElement;
      existingBtn.parentNode?.replaceChild(newBtn, existingBtn);

      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!channelInfo) return;

        if (isApproved) {
          // Remove from approved
          const identifier = channelInfo.id || channelInfo.handle;
          cachedApprovedChannels = await removeApprovedChannel(identifier);
        } else {
          // If channel was blocked, unblock it first
          const identifier = channelInfo.id || channelInfo.handle || channelInfo.name;
          if (identifier && (isChannelBlocked(identifier, cachedBlockedChannels) || isBlocked)) {
            cachedBlockedChannels = await removeBlockedChannel(identifier);
            const overlay = document.getElementById('haris-blocked-video-overlay');
            if (overlay) overlay.remove();
          }

          // Add: if id, avatar, or clean name is missing/invalid, resolve via background
          let finalId = channelInfo.id;
          let finalAvatar = channelInfo.avatarUrl;
          let finalName = channelInfo.name;

          if (
            (!finalId || !finalAvatar || !isValidChannelAvatar(finalAvatar) || !finalName || finalName.startsWith('@')) &&
            channelInfo.handle
          ) {
            try {
              const res = await browser.runtime.sendMessage({
                type: 'RESOLVE_CHANNEL',
                handle: channelInfo.handle,
              });
              if (res?.id && !finalId) finalId = res.id;
              if (res?.name && (!finalName || finalName.startsWith('@'))) finalName = res.name;
              if (res?.avatarUrl && isValidChannelAvatar(res.avatarUrl)) finalAvatar = res.avatarUrl;
            } catch {
              // Background might resolve later
            }
          }

          cachedApprovedChannels = await addApprovedChannel({
            id: finalId,
            handle: channelInfo.handle,
            name: finalName || channelInfo.handle || finalId,
            avatarUrl: finalAvatar,
          });
        }

        await updateChannelButton();
        await updateVideoButton();
        await updateBlockChannelButton();
        updateThumbnailBadgesAndFilter();
      });
    }

    /**
     * Injects or updates the floating "Add video" button on YouTube watch pages.
     */
    async function updateVideoButton() {
      const isWatch = window.location.pathname.startsWith('/watch');
      if (!isWatch) {
        const existing = document.getElementById('haris-toggle-video-btn');
        if (existing) existing.remove();
        return;
      }

      const videoInfo = extractCurrentVideoInfo();
      if (!videoInfo || !videoInfo.videoId) return;

      const channelBtn = document.getElementById('haris-toggle-channel-btn');
      const targetContainer =
        channelBtn ||
        document.querySelector(
          'ytd-watch-metadata #owner #subscribe-button, #owner #subscribe-button, ytd-video-owner-renderer #subscribe-button'
        );

      if (!targetContainer || !targetContainer.parentElement) return;

      const isApproved = isVideoApproved(videoInfo.videoId, cachedApprovedVideos);

      let existingBtn = document.getElementById('haris-toggle-video-btn') as HTMLButtonElement | null;

      if (!existingBtn) {
        existingBtn = document.createElement('button');
        existingBtn.id = 'haris-toggle-video-btn';
        targetContainer.parentElement.insertBefore(existingBtn, targetContainer.nextSibling);
      }

      const activeText = isApproved ? t('videoInMyList', currentLang) : t('addVideoToList', currentLang);
      existingBtn.className = `haris-channel-btn ${isApproved ? 'is-added' : 'not-added'}`;
      existingBtn.style.marginInlineStart = '8px';
      existingBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          ${
            isApproved
              ? '<polyline points="20 6 9 17 4 12"></polyline>'
              : '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>'
          }
        </svg>
        <span>${activeText}</span>
      `;

      // Attach click handler (clone to clear previous listeners)
      const newBtn = existingBtn.cloneNode(true) as HTMLButtonElement;
      existingBtn.parentNode?.replaceChild(newBtn, existingBtn);

      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isApproved) {
          cachedApprovedVideos = await removeNewUploadVideo(videoInfo.videoId);
        } else {
          cachedApprovedVideos = await recordVideoUpload(videoInfo);
        }

        await updateVideoButton();
        await updateBlockChannelButton();
      });
    }

    /**
     * Injects or updates the floating "Block channel" button on YouTube channel and watch pages.
     * Positioned beside "Add to list" and "Add video".
     */
    async function updateBlockChannelButton() {
      const isWatch = window.location.pathname.startsWith('/watch');
      const isChannel =
        window.location.pathname.startsWith('/@') || window.location.pathname.startsWith('/channel/');

      let channelInfo: { id: string; handle: string; name: string; avatarUrl?: string } | null = null;
      if (isWatch) {
        channelInfo = extractWatchPageChannel();
      } else if (isChannel) {
        channelInfo = extractChannelPageChannel();
      }

      if (!channelInfo || (!channelInfo.id && !channelInfo.handle && !channelInfo.name)) {
        const existing = document.getElementById('haris-block-channel-btn');
        if (existing) existing.remove();
        return;
      }

      const videoBtn = document.getElementById('haris-toggle-video-btn');
      const channelBtn = document.getElementById('haris-toggle-channel-btn');
      const targetContainer =
        videoBtn ||
        channelBtn ||
        (isWatch
          ? document.querySelector(
              'ytd-watch-metadata #owner #subscribe-button, #owner #subscribe-button, ytd-video-owner-renderer #subscribe-button'
            )
          : document.querySelector(
              '#channel-header #buttons, ytd-c4-tabbed-header-renderer #buttons, #inner-header-container #subscribe-button'
            ));

      if (!targetContainer || !targetContainer.parentElement) return;

      const isBlocked =
        (channelInfo.id && isChannelBlocked(channelInfo.id, cachedBlockedChannels)) ||
        (channelInfo.handle && isChannelBlocked(channelInfo.handle, cachedBlockedChannels)) ||
        (channelInfo.name && isChannelBlocked(channelInfo.name, cachedBlockedChannels));

      let existingBtn = document.getElementById('haris-block-channel-btn') as HTMLButtonElement | null;

      if (!existingBtn) {
        existingBtn = document.createElement('button');
        existingBtn.id = 'haris-block-channel-btn';
        targetContainer.parentElement.insertBefore(existingBtn, targetContainer.nextSibling);
      }

      existingBtn.style.marginInlineStart = '8px';

      if (isBlocked) {
        existingBtn.className = 'haris-channel-btn is-blocked';
        existingBtn.title = t('confirmUnblockChannel', currentLang);
        existingBtn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
          </svg>
          <span>${t('channelIsBlocked', currentLang)} (${t('btnUnblockChannel', currentLang)})</span>
        `;
      } else {
        existingBtn.className = 'haris-channel-btn block-btn-not-blocked';
        existingBtn.title = t('btnBlockChannel', currentLang);
        existingBtn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
          </svg>
          <span>${t('btnBlockChannel', currentLang)}</span>
        `;
      }

      // Attach click handler (clone to clear previous listeners)
      const newBtn = existingBtn.cloneNode(true) as HTMLButtonElement;
      existingBtn.parentNode?.replaceChild(newBtn, existingBtn);

      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!channelInfo) return;

        if (isBlocked) {
          const identifier = channelInfo.id || channelInfo.handle || channelInfo.name;
          cachedBlockedChannels = await removeBlockedChannel(identifier);
          const overlay = document.getElementById('haris-blocked-video-overlay');
          if (overlay) overlay.remove();
        } else {
          // If channel was in approved list, remove it
          const identifier = channelInfo.id || channelInfo.handle;
          if (identifier && isChannelApproved(identifier, cachedApprovedChannels)) {
            cachedApprovedChannels = await removeApprovedChannel(identifier);
          }

          let finalId = channelInfo.id;
          let finalAvatar = channelInfo.avatarUrl;
          let finalName = channelInfo.name;

          if (
            (!finalId || !finalAvatar || !isValidChannelAvatar(finalAvatar) || !finalName || finalName.startsWith('@')) &&
            channelInfo.handle
          ) {
            try {
              const res = await browser.runtime.sendMessage({
                type: 'RESOLVE_CHANNEL',
                handle: channelInfo.handle,
              });
              if (res?.id && !finalId) finalId = res.id;
              if (res?.name && (!finalName || finalName.startsWith('@'))) finalName = res.name;
              if (res?.avatarUrl && isValidChannelAvatar(res.avatarUrl)) finalAvatar = res.avatarUrl;
            } catch {}
          }

          cachedBlockedChannels = await addBlockedChannel({
            id: finalId || '',
            handle: channelInfo.handle || '',
            name: finalName || channelInfo.handle || finalId || 'Channel',
            avatarUrl: finalAvatar,
          });

          // Trigger watch page blocking
          handleWatchPageBlocked();
        }

        await updateChannelButton();
        await updateVideoButton();
        await updateBlockChannelButton();
        updateThumbnailBadgesAndFilter();
        processDOM();
      });
    }

    /**
     * If the current watch page belongs to a blocked channel, pause the video and show an overlay.
     */
    function handleWatchPageBlocked() {
      const isWatch = window.location.pathname.startsWith('/watch');
      const existingOverlay = document.getElementById('haris-blocked-video-overlay');

      if (!isWatch) {
        if (existingOverlay) existingOverlay.remove();
        return;
      }

      const channelInfo = extractWatchPageChannel();
      if (!channelInfo) return;

      const isBlocked =
        (channelInfo.id && isChannelBlocked(channelInfo.id, cachedBlockedChannels)) ||
        (channelInfo.handle && isChannelBlocked(channelInfo.handle, cachedBlockedChannels)) ||
        (channelInfo.name && isChannelBlocked(channelInfo.name, cachedBlockedChannels));

      if (isBlocked) {
        // Pause playback immediately
        const video = document.querySelector<HTMLVideoElement>('video');
        if (video && !video.paused) {
          video.pause();
        }

        const playerContainer =
          document.querySelector('#player-theater-container, #player-container, ytd-player, #movie_player') ||
          document.querySelector('#player');

        if (playerContainer && !existingOverlay) {
          (playerContainer as HTMLElement).style.position = 'relative';
          const overlay = document.createElement('div');
          overlay.id = 'haris-blocked-video-overlay';
          overlay.className = 'haris-blocked-overlay';
          overlay.innerHTML = `
            <div class="haris-blocked-overlay-card">
              <div class="haris-blocked-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                </svg>
              </div>
              <h3>${t('blockedOverlayTitle', currentLang)}</h3>
              <p>${channelInfo.name || channelInfo.handle}</p>
              <button id="haris-unblock-watch-btn" class="haris-unblock-btn">
                ${t('btnUnblockChannel', currentLang)}
              </button>
            </div>
          `;
          playerContainer.appendChild(overlay);

          const unblockBtn = overlay.querySelector('#haris-unblock-watch-btn');
          unblockBtn?.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            cachedBlockedChannels = await removeBlockedChannel(
              channelInfo.id || channelInfo.handle || channelInfo.name
            );
            overlay.remove();
            await updateChannelButton();
            processDOM();
          });
        }
      } else {
        if (existingOverlay) {
          existingOverlay.remove();
        }
      }
    }

    /**
     * Fetches original creator title via YouTube oEmbed or background service worker.
     */
    async function getOriginalTitle(videoId: string): Promise<string | null> {
      if (!videoId) return null;
      if (originalTitleCache.has(videoId)) {
        return originalTitleCache.get(videoId)!;
      }
      if (fetchingTitles.has(videoId)) {
        return null;
      }

      fetchingTitles.add(videoId);
      try {
        const resp = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
        );
        if (resp.ok) {
          const data = await resp.json();
          if (data?.title) {
            originalTitleCache.set(videoId, data.title);
            fetchingTitles.delete(videoId);
            return data.title;
          }
        }
      } catch {
        try {
          const res = await browser.runtime.sendMessage({
            type: 'FETCH_ORIGINAL_TITLE',
            videoId,
          });
          if (res?.success && res.title) {
            originalTitleCache.set(videoId, res.title);
            fetchingTitles.delete(videoId);
            return res.title;
          }
        } catch {
          // Ignored
        }
      }
      fetchingTitles.delete(videoId);
      return null;
    }

    /**
     * Restores the video's original title on watch pages and feed/search cards.
     */
    async function handleTitleUntranslation() {
      if (cachedSettings.disableTitleTranslation === false) return;

      // 1. If on watch page, restore watch page title
      const isWatch = window.location.pathname.startsWith('/watch');
      if (isWatch) {
        const videoId = new URLSearchParams(window.location.search).get('v');
        if (videoId) {
          const origTitle = await getOriginalTitle(videoId);
          if (origTitle) {
            const titleEl = document.querySelector(
              'ytd-watch-metadata #title h1 yt-formatted-string, #title h1 yt-formatted-string, ytd-watch-metadata #title h1, #title h1'
            );
            if (titleEl && titleEl.textContent?.trim() !== origTitle) {
              titleEl.textContent = origTitle;
              titleEl.setAttribute('title', origTitle);
            }
            if (!document.title.includes(origTitle)) {
              document.title = `${origTitle} - YouTube`;
            }
          }
        }
      }

      // 2. Restore titles on feed / search / recommendation cards
      const titleLinks = document.querySelectorAll<HTMLAnchorElement>(
        'a#video-title-link, a#video-title, ytd-video-renderer #video-title, ytd-rich-grid-media #video-title, ytd-compact-video-renderer #video-title'
      );

      let fetchedCount = 0;
      for (const el of titleLinks) {
        const href = el.getAttribute('href') || '';
        const match = href.match(/[?&]v=([^&]+)/) || href.match(/\/watch\/([^?&]+)/);
        const videoId = match?.[1];
        if (!videoId) continue;

        if (originalTitleCache.has(videoId)) {
          const orig = originalTitleCache.get(videoId)!;
          if (el.textContent?.trim() !== orig) {
            el.textContent = orig;
            el.setAttribute('title', orig);
          }
        } else if (fetchedCount < 8 && !fetchingTitles.has(videoId)) {
          const rect = el.getBoundingClientRect();
          if (rect.top >= -200 && rect.top <= window.innerHeight + 500) {
            fetchedCount++;
            getOriginalTitle(videoId).then((orig) => {
              if (orig && el.textContent?.trim() !== orig) {
                el.textContent = orig;
                el.setAttribute('title', orig);
              }
            });
          }
        }
      }
    }

    /**
     * Scans video cards across home, search, and recommendation feeds,
     * hides shorts, hides blocked channel videos, and attaches green check badges to approved channels.
     */
    function updateThumbnailBadgesAndFilter() {
      // 1. Hide Shorts shelves explicitly if enabled
      if (cachedSettings.hideShorts !== false) {
        const shortsShelves = document.querySelectorAll(
          'ytd-rich-shelf-renderer[is-shorts], ytd-reel-shelf-renderer, ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]), ytd-shorts'
        );
        for (const shelf of shortsShelves) {
          (shelf as HTMLElement).style.setProperty('display', 'none', 'important');
        }
      }

      const cards = document.querySelectorAll(
        'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-playlist-video-renderer, ytd-channel-renderer'
      );

      for (const card of cards) {
        const htmlCard = card as HTMLElement;

        // Check if card is a Short
        if (cachedSettings.hideShorts !== false) {
          const isShortCard =
            card.hasAttribute('is-shorts') ||
            card.querySelector('a[href*="/shorts/"]') !== null;
          if (isShortCard) {
            htmlCard.style.setProperty('display', 'none', 'important');
            continue;
          }
        }

        const channelLink = card.querySelector<HTMLAnchorElement>(
          'ytd-channel-name a, #channel-name a, a[href*="/@"], a[href*="/channel/"]'
        );
        const nameEl = card.querySelector(
          '#channel-name #text, ytd-channel-name #text, #text.ytd-channel-name'
        );
        const href = channelLink?.getAttribute('href') || '';

        let identifier = '';
        if (href.startsWith('/@')) {
          identifier = href.split('/')[1]?.split('?')[0] || '';
        } else if (href.startsWith('/channel/')) {
          identifier = href.split('/')[2]?.split('?')[0] || '';
        }

        const channelName = nameEl?.textContent?.trim() || '';

        // Check if Channel is Blocked
        const isBlocked =
          (identifier && isChannelBlocked(identifier, cachedBlockedChannels)) ||
          (channelName && isChannelBlocked(channelName, cachedBlockedChannels));

        if (isBlocked) {
          htmlCard.style.setProperty('display', 'none', 'important');
          card.querySelector('.haris-approved-badge')?.remove();
          continue;
        } else {
          // If was hidden previously due to blocked status, restore display
          if (htmlCard.style.display === 'none') {
            htmlCard.style.removeProperty('display');
          }
        }

        // Approved badge logic
        const isApproved = identifier ? isChannelApproved(identifier, cachedApprovedChannels) : false;
        const thumbContainer = card.querySelector('ytd-thumbnail, #thumbnail, a#thumbnail');

        if (!thumbContainer) continue;

        const existingBadge = thumbContainer.querySelector('.haris-approved-badge');

        if (isApproved) {
          if (!existingBadge) {
            const badge = document.createElement('div');
            badge.className = 'haris-approved-badge';
            badge.title = t('approvedBadge', currentLang);
            badge.innerHTML = `
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>${t('inMyList', currentLang).replace('✓', '').trim()}</span>
            `;
            (thumbContainer as HTMLElement).style.position = 'relative';
            thumbContainer.appendChild(badge);
          }
        } else {
          if (existingBadge) {
            existingBadge.remove();
          }
        }
      }
    }

    /**
     * Extracts details of the video currently being watched.
     */
    function extractCurrentVideoInfo(): {
      videoId: string;
      title: string;
      channelId: string;
      channelName: string;
      thumbnail: string;
      url: string;
      publishedAt: string;
    } | null {
      const isWatch = window.location.pathname.startsWith('/watch');
      if (!isWatch) return null;

      const videoId = new URLSearchParams(window.location.search).get('v');
      if (!videoId) return null;

      const titleEl = document.querySelector(
        'ytd-watch-metadata #title h1, #title h1, h1.ytd-watch-metadata, h1.title, #above-the-fold #title'
      );
      let title = titleEl?.textContent?.trim() || '';
      if (!title) {
        title = document.title
          .replace(/^\(\d+\)\s*/, '')
          .replace(/\s*-\s*YouTube$/i, '')
          .trim();
      }
      if (!title || title.toLowerCase() === 'youtube') {
        title = 'Video';
      }

      const channelInfo = extractWatchPageChannel();
      const channelName = channelInfo?.name || 'YouTube';
      const channelId = channelInfo?.id || '';

      return {
        videoId,
        title,
        channelId,
        channelName,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: new Date().toISOString(),
      };
    }

    /**
     * Unified process pass with debouncing.
     */
    function processDOM() {
      if (isProcessing) return;
      isProcessing = true;
      requestAnimationFrame(async () => {
        try {
          handleShortsRedirect();
          handleWatchPageBlocked();
          await updateChannelButton();
          await updateVideoButton();
          await updateBlockChannelButton();
          updateThumbnailBadgesAndFilter();
          await handleTitleUntranslation();
        } finally {
          isProcessing = false;
        }
      });
    }

    // Initial setup
    injectStyles();
    loadData().then(() => {
      processDOM();
    });

    // Handle YouTube's custom SPA navigation event
    window.addEventListener('yt-navigate-finish', () => {
      handleShortsRedirect();
      setTimeout(processDOM, 300);
      setTimeout(processDOM, 1000);
    });

    // Fallback popstate event
    window.addEventListener('popstate', () => {
      handleShortsRedirect();
      setTimeout(processDOM, 400);
    });

    // Observe dynamic feed additions (scrolling / lazy loading)
    const observer = new MutationObserver(() => {
      processDOM();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Sync state if channels, videos, or settings change in popup
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        if (changes.approvedChannels) {
          const newVal = changes.approvedChannels.newValue;
          cachedApprovedChannels = Array.isArray(newVal) ? (newVal as ApprovedChannel[]) : [];
          processDOM();
        }
        if (changes.blockedChannels) {
          const newVal = changes.blockedChannels.newValue;
          cachedBlockedChannels = Array.isArray(newVal) ? (newVal as BlockedChannel[]) : [];
          processDOM();
        }
        if (changes.newUploads) {
          const newVal = changes.newUploads.newValue;
          cachedApprovedVideos = Array.isArray(newVal) ? (newVal as NewUploadVideo[]) : [];
          processDOM();
        }
        if (changes.settings) {
          const newSettings = changes.settings.newValue as AppSettings;
          cachedSettings = newSettings || {};
          currentLang = newSettings?.language || 'ar';
          applyShortsClass();
          loadLanguageMessages(currentLang).then(() => processDOM());
        }
      }
    });

    // Handle query for current page's channel/video info from popup or background
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'GET_CURRENT_CHANNEL_INFO') {
        const info = extractWatchPageChannel() || extractChannelPageChannel();
        if (!info) {
          sendResponse(null);
          return true;
        }
        const isApproved =
          (info.id && isChannelApproved(info.id, cachedApprovedChannels)) ||
          (info.handle && isChannelApproved(info.handle, cachedApprovedChannels));
        const isBlocked =
          (info.id && isChannelBlocked(info.id, cachedBlockedChannels)) ||
          (info.handle && isChannelBlocked(info.handle, cachedBlockedChannels)) ||
          (info.name && isChannelBlocked(info.name, cachedBlockedChannels));
        sendResponse({ ...info, isApproved, isBlocked });
        return true;
      }

      if (message?.type === 'GET_CURRENT_PAGE_INFO') {
        const info = extractWatchPageChannel() || extractChannelPageChannel();
        const videoInfo = extractCurrentVideoInfo();
        const isApproved = info
          ? (info.id && isChannelApproved(info.id, cachedApprovedChannels)) ||
            (info.handle && isChannelApproved(info.handle, cachedApprovedChannels))
          : false;
        const isBlocked = info
          ? (info.id && isChannelBlocked(info.id, cachedBlockedChannels)) ||
            (info.handle && isChannelBlocked(info.handle, cachedBlockedChannels)) ||
            (info.name && isChannelBlocked(info.name, cachedBlockedChannels))
          : false;
        sendResponse({
          channelInfo: info ? { ...info, isApproved, isBlocked } : null,
          videoInfo,
        });
        return true;
      }
    });
  },
});
