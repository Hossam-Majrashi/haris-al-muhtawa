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
  getWhitelistFeedVideos,
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
    let cachedWhitelistFeedVideos: NewUploadVideo[] = [];
    let cachedSettings: AppSettings = { ...DEFAULT_SETTINGS };
    let currentLang: SupportedLanguage = 'ar';
    let isProcessing = false;
    const originalTitleCache = new Map<string, string>();
    const fetchingTitles = new Set<string>();

    function updatePageTypeClasses(targetUrl?: string) {
      const url = targetUrl || window.location.href;
      let path = window.location.pathname;
      try {
        const parsed = new URL(url, window.location.origin);
        path = parsed.pathname;
      } catch {
        // fallback
      }

      const isHome = path === '/' || path === '';
      const isSearch = path.startsWith('/results');
      const isWatch = path.startsWith('/watch');

      document.documentElement.classList.toggle('haris-page-home', isHome);
      document.documentElement.classList.toggle('haris-page-search', isSearch);
      document.documentElement.classList.toggle('haris-page-watch', isWatch);
    }

    function applyShortsClass() {
      if (cachedSettings.hideShorts !== false) {
        document.documentElement.classList.add('haris-hide-shorts');
      } else {
        document.documentElement.classList.remove('haris-hide-shorts');
      }
    }

    function applyWhitelistClass() {
      const isWhitelist = cachedSettings.whitelistOnlyMode === true;
      document.documentElement.classList.toggle('haris-whitelist-mode', isWhitelist);
      updatePageTypeClasses();
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
        .haris-whitelist-card {
          border-color: rgba(34, 197, 94, 0.35) !important;
        }
        .haris-whitelist-card h3 {
          color: #4ade80 !important;
        }
        .haris-whitelist-icon {
          background: rgba(34, 197, 94, 0.15) !important;
          color: #22c55e !important;
        }
        .haris-whitelist-add-btn {
          background: #22c55e !important;
        }
        .haris-whitelist-add-btn:hover {
          background: #16a34a !important;
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

        /* Whitelist mode instant CSS suppression of homepage clutter and sections */
        html.haris-whitelist-mode.haris-page-home ytd-rich-section-renderer,
        html.haris-whitelist-mode.haris-page-home ytd-feed-filter-chip-bar-renderer,
        html.haris-whitelist-mode.haris-page-home #chips-wrapper,
        html.haris-whitelist-mode.haris-page-home ytd-post-renderer,
        html.haris-whitelist-mode.haris-page-home ytd-shared-post-renderer,
        html.haris-whitelist-mode.haris-page-home ytd-statement-banner-renderer,
        html.haris-whitelist-mode ytd-browse[page-subtype="home"] ytd-rich-section-renderer,
        html.haris-whitelist-mode ytd-browse[page-subtype="home"] ytd-feed-filter-chip-bar-renderer,
        html.haris-whitelist-mode ytd-browse[page-subtype="home"] #chips-wrapper,
        html.haris-whitelist-mode ytd-browse[page-subtype="home"] ytd-post-renderer,
        html.haris-whitelist-mode ytd-browse[page-subtype="home"] ytd-shared-post-renderer,
        html.haris-whitelist-mode ytd-browse[page-subtype="home"] ytd-statement-banner-renderer,
        html.haris-whitelist-mode.haris-page-search ytd-reel-shelf-renderer,
        html.haris-whitelist-mode ytd-search ytd-reel-shelf-renderer,

        /* In whitelist mode, kill native YouTube search results (videos, playlists, mixes, shelves, continuation loader) completely */
        html.haris-whitelist-mode ytd-search ytd-video-renderer,
        html.haris-whitelist-mode ytd-search ytd-playlist-renderer,
        html.haris-whitelist-mode ytd-search ytd-radio-renderer,
        html.haris-whitelist-mode ytd-search ytd-shelf-renderer,
        html.haris-whitelist-mode ytd-search ytd-reel-shelf-renderer,
        html.haris-whitelist-mode ytd-search ytd-continuation-item-renderer,
        html.haris-whitelist-mode ytd-search tp-yt-paper-spinner,
        html.haris-whitelist-mode ytd-search #spinner,
        html.haris-whitelist-mode ytd-search yt-lockup-view-model,
        html.haris-whitelist-mode ytd-search ytd-lockup-view-model,
        html.haris-whitelist-mode ytd-search ytd-search-pyv-renderer,
        html.haris-whitelist-mode ytd-search ytd-exploratory-results-renderer,
        html.haris-whitelist-mode ytd-search ytd-horizontal-card-list-renderer,
        html.haris-whitelist-mode.haris-page-search ytd-video-renderer,
        html.haris-whitelist-mode.haris-page-search ytd-playlist-renderer,
        html.haris-whitelist-mode.haris-page-search ytd-radio-renderer,
        html.haris-whitelist-mode.haris-page-search ytd-shelf-renderer,
        html.haris-whitelist-mode.haris-page-search ytd-reel-shelf-renderer,
        html.haris-whitelist-mode.haris-page-search ytd-continuation-item-renderer,
        html.haris-whitelist-mode.haris-page-search tp-yt-paper-spinner,
        html.haris-whitelist-mode.haris-page-search #spinner,
        html.haris-whitelist-mode.haris-page-home ytd-continuation-item-renderer,

        /* In whitelist mode, hide Mixes immediately across search and recommendations */
        html.haris-whitelist-mode ytd-radio-renderer,
        html.haris-whitelist-mode ytd-compact-radio-renderer,
        html.haris-whitelist-mode ytd-grid-radio-renderer,
        html.haris-whitelist-mode yt-lockup-view-model:has(a[href*="list=RD"]),
        html.haris-whitelist-mode ytd-lockup-view-model:has(a[href*="list=RD"]),
        html.haris-whitelist-mode [role="listitem"]:has(a[href*="list=RD"]),
        html.haris-whitelist-mode ytd-video-renderer:has(a[href*="list=RD"]),

        /* In whitelist mode on watch page, hide chip filter bar and endscreen clutter */
        html.haris-whitelist-mode.haris-page-watch #related ytd-feed-filter-chip-bar-renderer,
        html.haris-whitelist-mode.haris-page-watch #secondary ytd-feed-filter-chip-bar-renderer,
        html.haris-whitelist-mode.haris-page-watch .ytp-endscreen-content,
        html.haris-whitelist-mode.haris-page-watch .ytp-ce-element {
          display: none !important;
        }

        /* Haris Whitelist Feeds (Home, Search, Recommendations) */
        .haris-feed-container {
          width: 100%;
          margin: 0 0 24px 0;
          padding: 16px 20px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-sizing: border-box;
        }
        html:not([dark]) .haris-feed-container {
          background: rgba(0, 0, 0, 0.02);
          border-color: rgba(0, 0, 0, 0.08);
        }
        .haris-feed-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          gap: 12px;
          flex-wrap: wrap;
        }
        .haris-feed-title-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .haris-feed-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--yt-spec-text-primary, #f1f1f1);
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        html:not([dark]) .haris-feed-title {
          color: #0f0f0f;
        }
        .haris-feed-badge {
          background: #16a34a;
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 10px;
        }
        .haris-channels-chips-row {
          display: flex;
          align-items: center;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 8px;
          margin-bottom: 16px;
          scrollbar-width: thin;
        }
        .haris-channel-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 20px;
          padding: 4px 12px 4px 4px;
          color: inherit;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s ease;
          white-space: nowrap;
          flex-shrink: 0;
        }
        html:not([dark]) .haris-channel-chip {
          background: rgba(0, 0, 0, 0.05);
          border-color: rgba(0, 0, 0, 0.1);
        }
        .haris-channel-chip:hover {
          background: rgba(22, 163, 74, 0.2);
          border-color: #16a34a;
          transform: translateY(-1px);
        }
        .haris-channel-chip-avatar {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          object-fit: cover;
          background: #333;
        }
        .haris-video-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 18px;
        }
        .haris-video-card {
          display: flex;
          flex-direction: column;
          gap: 10px;
          background: transparent;
          text-decoration: none;
          color: inherit;
          border-radius: 12px;
          overflow: hidden;
          transition: transform 0.2s ease;
          position: relative;
        }
        .haris-video-card:hover {
          transform: translateY(-3px);
        }
        .haris-video-thumb-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 12px;
          overflow: hidden;
          background: #1e1e1e;
        }
        .haris-video-thumb {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .haris-video-meta {
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }
        .haris-video-channel-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          background: #333;
        }
        .haris-video-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
          flex: 1;
        }
        .haris-video-title {
          font-size: 14px;
          font-weight: 600;
          line-height: 1.35;
          margin: 0;
          color: var(--yt-spec-text-primary, #f1f1f1);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        html:not([dark]) .haris-video-title {
          color: #0f0f0f;
        }
        .haris-video-channel-name {
          font-size: 12px;
          color: #a3a3a3;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .haris-empty-state {
          padding: 32px 20px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          color: #a3a3a3;
        }
        .haris-empty-state h4 {
          margin: 0;
          font-size: 16px;
          color: var(--yt-spec-text-primary, #f1f1f1);
        }
        html:not([dark]) .haris-empty-state h4 {
          color: #0f0f0f;
        }
        .haris-empty-state p {
          margin: 0;
          font-size: 13px;
          max-width: 440px;
        }
        .haris-related-block {
          margin-bottom: 20px;
          padding: 12px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        html:not([dark]) .haris-related-block {
          background: rgba(0, 0, 0, 0.02);
          border-color: rgba(0, 0, 0, 0.08);
        }
        .haris-related-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 10px;
        }
        .haris-related-card {
          display: flex;
          gap: 10px;
          text-decoration: none;
          color: inherit;
          border-radius: 8px;
          overflow: hidden;
          transition: transform 0.2s;
        }
        .haris-related-card:hover {
          transform: translateX(-2px);
        }
        .haris-related-thumb-wrap {
          position: relative;
          width: 140px;
          min-width: 140px;
          aspect-ratio: 16 / 9;
          border-radius: 8px;
          overflow: hidden;
          background: #1e1e1e;
        }
        .haris-related-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
          flex: 1;
        }
        .haris-related-title {
          font-size: 13px;
          font-weight: 600;
          line-height: 1.3;
          margin: 0;
          color: var(--yt-spec-text-primary, #f1f1f1);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        html:not([dark]) .haris-related-title {
          color: #0f0f0f;
        }
        .haris-related-channel {
          font-size: 11px;
          color: #a3a3a3;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    async function loadData() {
      cachedApprovedChannels = await getApprovedChannels();
      cachedBlockedChannels = await getBlockedChannels();
      cachedApprovedVideos = await getNewUploads();
      cachedWhitelistFeedVideos = await getWhitelistFeedVideos();
      const settings = await getSettings();
      cachedSettings = settings;
      currentLang = settings.language || 'ar';
      applyShortsClass();
      applyWhitelistClass();
      await loadLanguageMessages(currentLang);

      if (cachedWhitelistFeedVideos.length === 0 && cachedApprovedChannels.length > 0) {
        browser.runtime.sendMessage({ type: 'POLL_FEEDS_NOW' }).catch(() => {});
      }
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
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '15');
      svg.setAttribute('height', '15');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2.5');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      if (isApproved) {
        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', '20 6 9 17 4 12');
        svg.appendChild(polyline);
      } else {
        const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line1.setAttribute('x1', '12');
        line1.setAttribute('y1', '5');
        line1.setAttribute('x2', '12');
        line1.setAttribute('y2', '19');
        const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line2.setAttribute('x1', '5');
        line2.setAttribute('y1', '12');
        line2.setAttribute('x2', '19');
        line2.setAttribute('y2', '12');
        svg.appendChild(line1);
        svg.appendChild(line2);
      }
      const span = document.createElement('span');
      span.textContent = activeText;
      existingBtn.replaceChildren(svg, span);

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
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '15');
      svg.setAttribute('height', '15');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2.5');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      if (isApproved) {
        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', '20 6 9 17 4 12');
        svg.appendChild(polyline);
      } else {
        const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line1.setAttribute('x1', '12');
        line1.setAttribute('y1', '5');
        line1.setAttribute('x2', '12');
        line1.setAttribute('y2', '19');
        const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line2.setAttribute('x1', '5');
        line2.setAttribute('y1', '12');
        line2.setAttribute('x2', '19');
        line2.setAttribute('y2', '12');
        svg.appendChild(line1);
        svg.appendChild(line2);
      }
      const span = document.createElement('span');
      span.textContent = activeText;
      existingBtn.replaceChildren(svg, span);

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

      const blockSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      blockSvg.setAttribute('width', '15');
      blockSvg.setAttribute('height', '15');
      blockSvg.setAttribute('viewBox', '0 0 24 24');
      blockSvg.setAttribute('fill', 'none');
      blockSvg.setAttribute('stroke', 'currentColor');
      blockSvg.setAttribute('stroke-width', '2.5');
      blockSvg.setAttribute('stroke-linecap', 'round');
      blockSvg.setAttribute('stroke-linejoin', 'round');
      const blockCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      blockCircle.setAttribute('cx', '12');
      blockCircle.setAttribute('cy', '12');
      blockCircle.setAttribute('r', '10');
      const blockLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      blockLine.setAttribute('x1', '4.93');
      blockLine.setAttribute('y1', '4.93');
      blockLine.setAttribute('x2', '19.07');
      blockLine.setAttribute('y2', '19.07');
      blockSvg.appendChild(blockCircle);
      blockSvg.appendChild(blockLine);

      const blockSpan = document.createElement('span');

      if (isBlocked) {
        existingBtn.className = 'haris-channel-btn is-blocked';
        existingBtn.title = t('confirmUnblockChannel', currentLang);
        blockSpan.textContent = `${t('channelIsBlocked', currentLang)} (${t('btnUnblockChannel', currentLang)})`;
      } else {
        existingBtn.className = 'haris-channel-btn block-btn-not-blocked';
        existingBtn.title = t('btnBlockChannel', currentLang);
        blockSpan.textContent = t('btnBlockChannel', currentLang);
      }

      existingBtn.replaceChildren(blockSvg, blockSpan);

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

      const isApproved =
        (channelInfo.id && isChannelApproved(channelInfo.id, cachedApprovedChannels)) ||
        (channelInfo.handle && isChannelApproved(channelInfo.handle, cachedApprovedChannels)) ||
        (channelInfo.name && isChannelApproved(channelInfo.name, cachedApprovedChannels));

      const currentVideoId = new URLSearchParams(window.location.search).get('v');
      const isVideoApprovedDirectly = currentVideoId
        ? isVideoApproved(currentVideoId, cachedApprovedVideos)
        : false;

      const isWhitelisted = isApproved || isVideoApprovedDirectly;
      const isWhitelistBlocked = cachedSettings.whitelistOnlyMode === true && !isWhitelisted;

      if (isBlocked || isWhitelistBlocked) {
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

          const card = document.createElement('div');
          card.className = isBlocked
            ? 'haris-blocked-overlay-card'
            : 'haris-blocked-overlay-card haris-whitelist-card';

          const iconDiv = document.createElement('div');
          iconDiv.className = isBlocked
            ? 'haris-blocked-icon'
            : 'haris-blocked-icon haris-whitelist-icon';

          const overlaySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          overlaySvg.setAttribute('width', '40');
          overlaySvg.setAttribute('height', '40');
          overlaySvg.setAttribute('viewBox', '0 0 24 24');
          overlaySvg.setAttribute('fill', 'none');
          overlaySvg.setAttribute('stroke', 'currentColor');
          overlaySvg.setAttribute('stroke-width', '2.5');
          overlaySvg.setAttribute('stroke-linecap', 'round');
          overlaySvg.setAttribute('stroke-linejoin', 'round');

          if (isBlocked) {
            const overlayCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            overlayCircle.setAttribute('cx', '12');
            overlayCircle.setAttribute('cy', '12');
            overlayCircle.setAttribute('r', '10');
            const overlayLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            overlayLine.setAttribute('x1', '4.93');
            overlayLine.setAttribute('y1', '4.93');
            overlayLine.setAttribute('x2', '19.07');
            overlayLine.setAttribute('y2', '19.07');
            overlaySvg.appendChild(overlayCircle);
            overlaySvg.appendChild(overlayLine);
          } else {
            const overlayShield = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            overlayShield.setAttribute('d', 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z');
            const overlayCheck = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            overlayCheck.setAttribute('points', '9 12 11 14 15 10');
            overlaySvg.appendChild(overlayShield);
            overlaySvg.appendChild(overlayCheck);
          }
          iconDiv.appendChild(overlaySvg);

          const h3 = document.createElement('h3');
          h3.textContent = isBlocked
            ? t('blockedOverlayTitle', currentLang)
            : t('unapprovedOverlayTitle', currentLang);

          const p = document.createElement('p');
          p.textContent = isBlocked
            ? (channelInfo.name || channelInfo.handle)
            : `${channelInfo.name || channelInfo.handle} - ${t('unapprovedOverlayDesc', currentLang)}`;

          const actionBtn = document.createElement('button');
          actionBtn.id = 'haris-unblock-watch-btn';
          actionBtn.className = isBlocked
            ? 'haris-unblock-btn'
            : 'haris-unblock-btn haris-whitelist-add-btn';
          actionBtn.textContent = isBlocked
            ? t('btnUnblockChannel', currentLang)
            : t('btnAddToWhitelist', currentLang);

          card.appendChild(iconDiv);
          card.appendChild(h3);
          card.appendChild(p);
          card.appendChild(actionBtn);
          overlay.appendChild(card);
          playerContainer.appendChild(overlay);

          actionBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isBlocked) {
              cachedBlockedChannels = await removeBlockedChannel(
                channelInfo.id || channelInfo.handle || channelInfo.name
              );
            } else {
              cachedApprovedChannels = await addApprovedChannel({
                id: channelInfo.id || '',
                name: channelInfo.name || channelInfo.handle,
                handle: channelInfo.handle || channelInfo.name,
                avatarUrl: channelInfo.avatarUrl,
              });
            }
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
     * Creates a SVG shield icon element.
     */
    function createShieldSvg(): SVGElement {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '18');
      svg.setAttribute('height', '18');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', '#22c55e');
      svg.setAttribute('stroke-width', '2.5');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z');
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      poly.setAttribute('points', '9 12 11 14 15 10');
      svg.appendChild(path);
      svg.appendChild(poly);
      return svg;
    }

    /**
     * Renders a dedicated Whitelist Feed on YouTube's Home page in Whitelist mode.
     */
    function renderWhitelistHomeFeed(isHomePage: boolean) {
      const existing = document.getElementById('haris-whitelist-home-feed');
      if (cachedSettings.whitelistOnlyMode !== true || !isHomePage) {
        if (existing) existing.remove();
        return;
      }

      const container = document.querySelector(
        'ytd-browse[page-subtype="home"] #primary, ytd-browse[page-subtype="home"] #contents, ytd-rich-grid-renderer #contents'
      );
      if (!container) return;

      const channelsCount = cachedApprovedChannels.length;

      // Deduplicate whitelist feed videos and manually approved videos
      const videoMap = new Map<string, NewUploadVideo>();
      for (const vid of cachedWhitelistFeedVideos) {
        if (vid.videoId) videoMap.set(vid.videoId, vid);
      }
      for (const vid of cachedApprovedVideos) {
        if (vid.videoId && !videoMap.has(vid.videoId)) videoMap.set(vid.videoId, vid);
      }
      const homeVideos = Array.from(videoMap.values());
      const videosCount = homeVideos.length;

      if (videosCount === 0 && channelsCount > 0) {
        browser.runtime.sendMessage({ type: 'POLL_FEEDS_NOW' }).catch(() => {});
      }

      const currentHash = `${channelsCount}_${videosCount}_${currentLang}`;
      if (existing && existing.dataset.renderHash === currentHash) {
        return;
      }

      const feedEl = existing || document.createElement('div');
      feedEl.id = 'haris-whitelist-home-feed';
      feedEl.className = 'haris-feed-container';
      feedEl.dataset.renderHash = currentHash;
      feedEl.replaceChildren();

      // Header
      const header = document.createElement('div');
      header.className = 'haris-feed-header';
      const titleWrap = document.createElement('div');
      titleWrap.className = 'haris-feed-title-wrap';
      titleWrap.appendChild(createShieldSvg());
      const titleH3 = document.createElement('h3');
      titleH3.className = 'haris-feed-title';
      titleH3.textContent = t('whitelistHomeFeedTitle', currentLang);
      const badge = document.createElement('span');
      badge.className = 'haris-feed-badge';
      badge.textContent = `${channelsCount} ${t('tabChannels', currentLang)}`;
      titleWrap.appendChild(titleH3);
      titleWrap.appendChild(badge);
      header.appendChild(titleWrap);
      feedEl.appendChild(header);

      // Approved Channels Chips Row
      if (channelsCount > 0) {
        const chipsRow = document.createElement('div');
        chipsRow.className = 'haris-channels-chips-row';
        for (const ch of cachedApprovedChannels) {
          const chip = document.createElement('a');
          chip.className = 'haris-channel-chip';
          const href = ch.handle
            ? `https://www.youtube.com/${ch.handle.startsWith('@') ? ch.handle : `@${ch.handle}`}`
            : (ch.id ? `https://www.youtube.com/channel/${ch.id}` : '#');
          chip.href = href;
          if (ch.avatarUrl) {
            const av = document.createElement('img');
            av.className = 'haris-channel-chip-avatar';
            av.src = ch.avatarUrl;
            av.alt = ch.name;
            chip.appendChild(av);
          }
          const span = document.createElement('span');
          span.textContent = ch.name;
          chip.appendChild(span);
          chipsRow.appendChild(chip);
        }
        feedEl.appendChild(chipsRow);
      }

      // Approved Videos Grid
      if (videosCount > 0) {
        const grid = document.createElement('div');
        grid.className = 'haris-video-grid';
        const displayVideos = homeVideos.slice(0, 48);

        for (const vid of displayVideos) {
          const card = document.createElement('a');
          card.className = 'haris-video-card';
          card.href = vid.url || `https://www.youtube.com/watch?v=${vid.videoId}`;

          const thumbWrap = document.createElement('div');
          thumbWrap.className = 'haris-video-thumb-wrap';
          const img = document.createElement('img');
          img.className = 'haris-video-thumb';
          img.src = vid.thumbnail || `https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`;
          img.loading = 'lazy';
          img.alt = vid.title;
          thumbWrap.appendChild(img);

          const meta = document.createElement('div');
          meta.className = 'haris-video-meta';

          const matchingCh = cachedApprovedChannels.find(
            (c) => c.id === vid.channelId || c.name === vid.channelName
          );
          if (matchingCh?.avatarUrl) {
            const av = document.createElement('img');
            av.className = 'haris-video-channel-avatar';
            av.src = matchingCh.avatarUrl;
            av.alt = vid.channelName;
            meta.appendChild(av);
          }

          const details = document.createElement('div');
          details.className = 'haris-video-details';
          const title = document.createElement('h4');
          title.className = 'haris-video-title';
          title.textContent = vid.title;
          const chName = document.createElement('div');
          chName.className = 'haris-video-channel-name';
          chName.textContent = vid.channelName;

          details.appendChild(title);
          details.appendChild(chName);
          meta.appendChild(details);

          card.appendChild(thumbWrap);
          card.appendChild(meta);
          grid.appendChild(card);
        }
        feedEl.appendChild(grid);
      } else {
        const empty = document.createElement('div');
        empty.className = 'haris-empty-state';
        const emptyH4 = document.createElement('h4');
        emptyH4.textContent = channelsCount > 0
          ? t('whitelistHomeFeedTitle', currentLang)
          : t('emptyWhitelistTitle', currentLang);
        const emptyP = document.createElement('p');
        emptyP.textContent = channelsCount > 0
          ? (t('channelsSyncedDesc', currentLang) || 'قنواتك المعتمدة جاهزة. انقر على أي قناة أعلاه لتصفح مقاطعها.')
          : t('emptyWhitelistDesc', currentLang);
        empty.appendChild(emptyH4);
        empty.appendChild(emptyP);
        feedEl.appendChild(empty);
      }

      if (!existing) {
        container.prepend(feedEl);
      }
    }

    /**
     * Renders search results filtered strictly to approved channels and videos in Whitelist mode.
     */
    function renderWhitelistSearchResults(isSearchPage: boolean) {
      const existing = document.getElementById('haris-whitelist-search-results');
      if (cachedSettings.whitelistOnlyMode !== true || !isSearchPage) {
        if (existing) existing.remove();
        return;
      }

      const searchContainer = document.querySelector(
        'ytd-search #primary, ytd-two-column-search-results-renderer #primary, ytd-search #contents, #contents.ytd-section-list-renderer, ytd-item-section-renderer #contents, ytd-search'
      );
      if (!searchContainer) return;

      const query = (new URLSearchParams(window.location.search).get('search_query') || '').trim();
      const q = query.toLowerCase();
      const currentHash = `${q}_${cachedApprovedChannels.length}_${cachedApprovedVideos.length}_${currentLang}`;

      if (existing && existing.dataset.renderHash === currentHash) {
        return;
      }

      const resultsEl = existing || document.createElement('div');
      resultsEl.id = 'haris-whitelist-search-results';
      resultsEl.className = 'haris-feed-container';
      resultsEl.dataset.renderHash = currentHash;
      resultsEl.replaceChildren();

      const header = document.createElement('div');
      header.className = 'haris-feed-header';
      const titleWrap = document.createElement('div');
      titleWrap.className = 'haris-feed-title-wrap';
      titleWrap.appendChild(createShieldSvg());
      const titleH3 = document.createElement('h3');
      titleH3.className = 'haris-feed-title';
      titleH3.textContent = t('whitelistSearchResultsTitle', currentLang);
      titleWrap.appendChild(titleH3);
      header.appendChild(titleWrap);
      resultsEl.appendChild(header);

      // Filter approved channels that match query
      const matchingChannels = q
        ? cachedApprovedChannels.filter(
            (ch) =>
              ch.name.toLowerCase().includes(q) ||
              (ch.handle && ch.handle.toLowerCase().includes(q))
          )
        : cachedApprovedChannels;

      // Filter approved videos that match query
      const allSearchVideosMap = new Map<string, NewUploadVideo>();
      for (const vid of cachedWhitelistFeedVideos) {
        if (vid.videoId) allSearchVideosMap.set(vid.videoId, vid);
      }
      for (const vid of cachedApprovedVideos) {
        if (vid.videoId && !allSearchVideosMap.has(vid.videoId)) allSearchVideosMap.set(vid.videoId, vid);
      }
      const allSearchVideos = Array.from(allSearchVideosMap.values());

      const matchingVideos = q
        ? allSearchVideos.filter(
            (v) =>
              v.title.toLowerCase().includes(q) ||
              v.channelName.toLowerCase().includes(q)
          )
        : allSearchVideos;

      if (matchingChannels.length > 0) {
        const chipsRow = document.createElement('div');
        chipsRow.className = 'haris-channels-chips-row';
        for (const ch of matchingChannels) {
          const chip = document.createElement('a');
          chip.className = 'haris-channel-chip';
          chip.href = ch.handle
            ? `https://www.youtube.com/${ch.handle.startsWith('@') ? ch.handle : `@${ch.handle}`}`
            : (ch.id ? `https://www.youtube.com/channel/${ch.id}` : '#');
          if (ch.avatarUrl) {
            const av = document.createElement('img');
            av.className = 'haris-channel-chip-avatar';
            av.src = ch.avatarUrl;
            chip.appendChild(av);
          }
          const span = document.createElement('span');
          span.textContent = ch.name;
          chip.appendChild(span);
          chipsRow.appendChild(chip);
        }
        resultsEl.appendChild(chipsRow);
      }

      if (matchingVideos.length > 0) {
        const grid = document.createElement('div');
        grid.className = 'haris-video-grid';
        for (const vid of matchingVideos.slice(0, 30)) {
          const card = document.createElement('a');
          card.className = 'haris-video-card';
          card.href = vid.url || `https://www.youtube.com/watch?v=${vid.videoId}`;

          const thumbWrap = document.createElement('div');
          thumbWrap.className = 'haris-video-thumb-wrap';
          const img = document.createElement('img');
          img.className = 'haris-video-thumb';
          img.src = vid.thumbnail || `https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`;
          img.loading = 'lazy';
          img.alt = vid.title;
          thumbWrap.appendChild(img);

          const meta = document.createElement('div');
          meta.className = 'haris-video-meta';
          const matchingCh = cachedApprovedChannels.find(
            (c) => c.id === vid.channelId || c.name === vid.channelName
          );
          if (matchingCh?.avatarUrl) {
            const av = document.createElement('img');
            av.className = 'haris-video-channel-avatar';
            av.src = matchingCh.avatarUrl;
            meta.appendChild(av);
          }
          const details = document.createElement('div');
          details.className = 'haris-video-details';
          const title = document.createElement('h4');
          title.className = 'haris-video-title';
          title.textContent = vid.title;
          const chName = document.createElement('div');
          chName.className = 'haris-video-channel-name';
          chName.textContent = vid.channelName;
          details.appendChild(title);
          details.appendChild(chName);
          meta.appendChild(details);

          card.appendChild(thumbWrap);
          card.appendChild(meta);
          grid.appendChild(card);
        }
        resultsEl.appendChild(grid);
      } else if (matchingChannels.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'haris-empty-state';
        const emptyH4 = document.createElement('h4');
        emptyH4.textContent = t('whitelistSearchNoResults', currentLang);
        const emptyP = document.createElement('p');
        emptyP.textContent = query ? `«${query}»` : '';
        empty.appendChild(emptyH4);
        if (query) empty.appendChild(emptyP);
        resultsEl.appendChild(empty);
      }

      if (!existing) {
        searchContainer.prepend(resultsEl);
      }
    }

    /**
     * Renders approved channel recommendations in watch page sidebar in Whitelist mode.
     */
    function renderWhitelistRecommendations(isWatchPage: boolean) {
      const existing = document.getElementById('haris-whitelist-related');
      if (cachedSettings.whitelistOnlyMode !== true || !isWatchPage) {
        if (existing) existing.remove();
        return;
      }

      const relatedContainer = document.querySelector(
        '#related #items, ytd-watch-next-secondary-results-renderer #items, #secondary #items'
      );
      if (!relatedContainer) return;

      const currentVideoId = new URLSearchParams(window.location.search).get('v') || '';
      const allRecVideosMap = new Map<string, NewUploadVideo>();
      for (const vid of cachedWhitelistFeedVideos) {
        if (vid.videoId) allRecVideosMap.set(vid.videoId, vid);
      }
      for (const vid of cachedApprovedVideos) {
        if (vid.videoId && !allRecVideosMap.has(vid.videoId)) allRecVideosMap.set(vid.videoId, vid);
      }
      const recommendedVideos = Array.from(allRecVideosMap.values()).filter((v) => v.videoId !== currentVideoId);

      if (recommendedVideos.length === 0) {
        if (existing) existing.remove();
        return;
      }

      const currentHash = `${currentVideoId}_${recommendedVideos.length}_${currentLang}`;
      if (existing && existing.dataset.renderHash === currentHash) {
        return;
      }

      const block = existing || document.createElement('div');
      block.id = 'haris-whitelist-related';
      block.className = 'haris-related-block';
      block.dataset.renderHash = currentHash;
      block.replaceChildren();

      const header = document.createElement('div');
      header.className = 'haris-feed-title';
      header.style.fontSize = '14px';
      header.style.marginBottom = '8px';
      header.appendChild(createShieldSvg());
      const span = document.createElement('span');
      span.textContent = t('whitelistRelatedTitle', currentLang);
      header.appendChild(span);
      block.appendChild(header);

      const list = document.createElement('div');
      list.className = 'haris-related-list';

      for (const vid of recommendedVideos.slice(0, 15)) {
        const card = document.createElement('a');
        card.className = 'haris-related-card';
        card.href = vid.url || `https://www.youtube.com/watch?v=${vid.videoId}`;

        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'haris-related-thumb-wrap';
        const img = document.createElement('img');
        img.className = 'haris-video-thumb';
        img.src = vid.thumbnail || `https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`;
        img.loading = 'lazy';
        img.alt = vid.title;
        thumbWrap.appendChild(img);

        const info = document.createElement('div');
        info.className = 'haris-related-info';
        const title = document.createElement('h4');
        title.className = 'haris-related-title';
        title.textContent = vid.title;
        const ch = document.createElement('div');
        ch.className = 'haris-related-channel';
        ch.textContent = vid.channelName;

        info.appendChild(title);
        info.appendChild(ch);
        card.appendChild(thumbWrap);
        card.appendChild(info);
        list.appendChild(card);
      }

      block.appendChild(list);

      if (!existing) {
        relatedContainer.prepend(block);
      }
    }

    /**
     * Scans video cards across home, search, and recommendation feeds,
     * hides shorts, hides blocked channel videos, and attaches green check badges to approved channels.
     */
    function updateThumbnailBadgesAndFilter() {
      const path = window.location.pathname;
      const isHomePage = path === '/' || path === '';
      const isSearchPage = path.startsWith('/results');
      const isWatchPage = path.startsWith('/watch');

      renderWhitelistHomeFeed(isHomePage);
      renderWhitelistSearchResults(isSearchPage);
      renderWhitelistRecommendations(isWatchPage);

      // 0. Kill YouTube search continuation loaders and spinners in Whitelist Mode to eliminate 10s wait and black screen
      if (cachedSettings.whitelistOnlyMode === true && isSearchPage) {
        const continuations = document.querySelectorAll(
          'ytd-search ytd-continuation-item-renderer, ytd-search tp-yt-paper-spinner, ytd-search #spinner, ytd-search ytd-search-pyv-renderer, ytd-continuation-item-renderer'
        );
        for (const el of continuations) {
          el.remove();
        }
      }

      // 1. Hide homepage clutter (posts shelves, topic chips, explore topics) in Whitelist Mode
      if (cachedSettings.whitelistOnlyMode === true && isHomePage) {
        const homeClutter = document.querySelectorAll(
          'ytd-browse[page-subtype="home"] ytd-rich-section-renderer, ytd-browse[page-subtype="home"] ytd-feed-filter-chip-bar-renderer, ytd-browse[page-subtype="home"] #chips-wrapper, ytd-rich-section-renderer, ytd-feed-filter-chip-bar-renderer, #chips-wrapper, ytd-post-renderer, ytd-shared-post-renderer'
        );
        for (const el of homeClutter) {
          (el as HTMLElement).style.setProperty('display', 'none', 'important');
        }
      } else if (cachedSettings.whitelistOnlyMode !== true && isHomePage) {
        const homeClutter = document.querySelectorAll(
          'ytd-browse[page-subtype="home"] ytd-rich-section-renderer, ytd-browse[page-subtype="home"] ytd-feed-filter-chip-bar-renderer, ytd-browse[page-subtype="home"] #chips-wrapper, ytd-rich-section-renderer, ytd-feed-filter-chip-bar-renderer, #chips-wrapper, ytd-post-renderer, ytd-shared-post-renderer'
        );
        for (const el of homeClutter) {
          const htmlEl = el as HTMLElement;
          if (cachedSettings.hideShorts !== false && (el.hasAttribute('is-shorts') || el.querySelector('a[href*="/shorts/"]'))) {
            continue;
          }
          if (htmlEl.style.display === 'none') {
            htmlEl.style.removeProperty('display');
          }
        }
      }

      // 2. Hide watch page recommendation chip bar in Whitelist Mode
      if (cachedSettings.whitelistOnlyMode === true && isWatchPage) {
        const watchClutter = document.querySelectorAll(
          '#related ytd-feed-filter-chip-bar-renderer, #secondary ytd-feed-filter-chip-bar-renderer, ytd-watch-next-secondary-results-renderer ytd-feed-filter-chip-bar-renderer'
        );
        for (const el of watchClutter) {
          (el as HTMLElement).style.setProperty('display', 'none', 'important');
        }
      }

      // 3. Hide Shorts shelves explicitly if enabled
      if (cachedSettings.hideShorts !== false) {
        const shortsShelves = document.querySelectorAll(
          'ytd-rich-shelf-renderer[is-shorts], ytd-reel-shelf-renderer, ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]), ytd-shorts'
        );
        for (const shelf of shortsShelves) {
          (shelf as HTMLElement).style.setProperty('display', 'none', 'important');
        }
      }

      // 4. Query all video, playlist, mix, and channel cards across Home, Search, Watch page, and feeds
      const cardSelectors = [
        'ytd-rich-item-renderer',
        'ytd-video-renderer',
        'ytd-compact-video-renderer',
        'ytd-grid-video-renderer',
        'ytd-playlist-video-renderer',
        'ytd-playlist-renderer',
        'ytd-radio-renderer',
        'ytd-compact-playlist-renderer',
        'ytd-compact-radio-renderer',
        'ytd-grid-playlist-renderer',
        'ytd-grid-radio-renderer',
        'ytd-playlist-panel-video-renderer',
        'ytd-channel-renderer',
        'yt-lockup-view-model',
        'ytd-lockup-view-model',
        'lockup-view-model',
        'ytd-item-section-renderer #contents > ytd-playlist-renderer',
        'ytd-item-section-renderer #contents > ytd-radio-renderer',
        'ytd-item-section-renderer #contents > yt-lockup-view-model',
        '#related #items > *',
        'ytd-watch-next-secondary-results-renderer #items > *',
        '#secondary #items > *',
      ];
      const cards = document.querySelectorAll(cardSelectors.join(', '));

      for (const card of cards) {
        const htmlCard = card as HTMLElement;

        // Skip elements without links or purely layout wrappers
        if (!card.querySelector('a[href]')) {
          continue;
        }

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

        // Detect if card is a Mix (algorithmic mix of multiple channels)
        const isMix =
          card.tagName.toLowerCase().includes('radio') ||
          card.querySelector('a[href*="list=RD"]') !== null ||
          card.querySelector('[overlay-style="MIX"], yt-badge-view-model:has([aria-label*="Mix"]), yt-badge-shape[aria-label*="Mix"]') !== null ||
          card.textContent?.includes(' • Mix') === true;

        // In Whitelist mode, hide Mixes completely
        if (cachedSettings.whitelistOnlyMode === true && isMix) {
          htmlCard.style.setProperty('display', 'none', 'important');
          card.querySelector('.haris-approved-badge')?.remove();
          continue;
        }

        // Select channel link - strictly match elements linking to channels/handles, NOT video watch links
        let channelLink = card.querySelector<HTMLAnchorElement>(
          'ytd-channel-name a, #channel-name a, .yt-lockup-metadata-view-model a[href*="/@"], .yt-lockup-metadata-view-model a[href*="/channel/"], a[href*="/@"], a[href*="/channel/"], a[href*="/user/"], a#avatar-section[href*="/@"], a#avatar-section[href*="/channel/"], a#channel-thumbnail[href*="/@"], a#channel-thumbnail[href*="/channel/"]'
        );
        if (!channelLink && card.matches('ytd-channel-renderer')) {
          channelLink = card.querySelector<HTMLAnchorElement>('a#main-link, a#avatar-section, a[href]');
        }
        const nameEl = card.querySelector(
          'ytd-channel-name #text, #channel-name #text, #text.ytd-channel-name, #channel-title #text, #channel-title, .yt-lockup-metadata-view-model__byline, #byline, yt-formatted-string.ytd-channel-name'
        );
        const href = channelLink?.getAttribute('href') || channelLink?.href || '';

        let identifier = '';
        if (href.includes('/@')) {
          const match = href.match(/\/(@[^\/?#]+)/);
          if (match?.[1]) identifier = match[1];
        } else if (href.includes('/channel/')) {
          const match = href.match(/\/channel\/([^\/?#]+)/);
          if (match?.[1]) identifier = match[1];
        } else if (href.includes('/user/')) {
          const match = href.match(/\/user\/([^\/?#]+)/);
          if (match?.[1]) identifier = match[1];
        }

        let channelName = '';
        if (nameEl) {
          const clone = nameEl.cloneNode(true) as Element;
          clone.querySelectorAll('svg, badge, .badge, [aria-label*="Verified"], [aria-label*="متحقق"]').forEach((b) => b.remove());
          channelName = (clone.textContent || '').replace(/\s+/g, ' ').trim();
        }
        if (!channelName && channelLink) {
          channelName = (channelLink.getAttribute('title') || channelLink.getAttribute('aria-label') || channelLink.textContent || '').replace(/\s+/g, ' ').trim();
        }

        // Strip playlist/mix tags from channel name if present (e.g. "Sooada 1000 • Playlist")
        if (channelName.includes('•')) {
          const parts = channelName.split('•').map((p) => p.trim());
          if (parts[0] && !parts[0].toLowerCase().includes('playlist') && !parts[0].toLowerCase().includes('mix') && !parts[0].toLowerCase().includes('قائمة')) {
            channelName = parts[0];
          }
        }

        if (!identifier) {
          const metaText = card.querySelector('#sub-menu, #metadata, #channel-title-container, .yt-lockup-metadata-view-model')?.textContent || '';
          const handleMatch = metaText.match(/(@[\w\.\-]+)/);
          if (handleMatch?.[1]) identifier = handleMatch[1];
        }

        if (channelName.startsWith('@') && !identifier) {
          identifier = channelName;
        }

        // Check if Channel is Blocked
        const isBlocked =
          (identifier && isChannelBlocked(identifier, cachedBlockedChannels)) ||
          (channelName && isChannelBlocked(channelName, cachedBlockedChannels));

        if (isBlocked) {
          htmlCard.style.setProperty('display', 'none', 'important');
          card.querySelector('.haris-approved-badge')?.remove();
          continue;
        }

        // Approved badge and whitelist check
        const isApproved =
          (identifier ? isChannelApproved(identifier, cachedApprovedChannels) : false) ||
          (channelName ? isChannelApproved(channelName, cachedApprovedChannels) : false);

        let isVideoInApprovedList = false;
        const videoLink = card.querySelector<HTMLAnchorElement>('a#thumbnail[href*="v="], a[href*="/watch?v="]');
        const videoIdMatch = videoLink?.getAttribute('href')?.match(/[?&]v=([^&]+)/);
        const cardVideoId = videoIdMatch?.[1];
        if (cardVideoId) {
          if (cachedApprovedVideos.length > 0 && isVideoApproved(cardVideoId, cachedApprovedVideos)) {
            isVideoInApprovedList = true;
          } else if (cachedWhitelistFeedVideos.length > 0 && isVideoApproved(cardVideoId, cachedWhitelistFeedVideos)) {
            isVideoInApprovedList = true;
          }
        }

        const isWhitelisted = isApproved || isVideoInApprovedList;

        // Strict Whitelist Mode: hide everything unapproved on homepage, recommendations, watch page, and search results
        if (cachedSettings.whitelistOnlyMode === true) {
          const isRecommendations =
            isWatchPage ||
            card.closest(
              '#related, ytd-watch-next-secondary-results-renderer, #secondary, #below, ytd-compact-video-renderer, ytd-compact-playlist-renderer, ytd-compact-radio-renderer'
            ) !== null;

          if (isHomePage || isRecommendations || isSearchPage || isWatchPage) {
            if (!isWhitelisted) {
              htmlCard.style.setProperty('display', 'none', 'important');
              card.querySelector('.haris-approved-badge')?.remove();
              continue;
            }
          }
        }

        // If not hidden by blocked or whitelist filter, restore display
        if (htmlCard.style.display === 'none') {
          htmlCard.style.removeProperty('display');
        }
        const thumbContainer = card.querySelector('ytd-thumbnail, #thumbnail, a#thumbnail, #avatar-section, yt-thumbnail-view-model');

        if (!thumbContainer) continue;

        const existingBadge = thumbContainer.querySelector('.haris-approved-badge');

        if (isApproved) {
          if (!existingBadge) {
            const badge = document.createElement('div');
            badge.className = 'haris-approved-badge';
            badge.title = t('approvedBadge', currentLang);

            const badgeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            badgeSvg.setAttribute('width', '12');
            badgeSvg.setAttribute('height', '12');
            badgeSvg.setAttribute('viewBox', '0 0 24 24');
            badgeSvg.setAttribute('fill', 'none');
            badgeSvg.setAttribute('stroke', 'currentColor');
            badgeSvg.setAttribute('stroke-width', '3');
            badgeSvg.setAttribute('stroke-linecap', 'round');
            badgeSvg.setAttribute('stroke-linejoin', 'round');
            const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            polyline.setAttribute('points', '20 6 9 17 4 12');
            badgeSvg.appendChild(polyline);

            const span = document.createElement('span');
            span.textContent = t('inMyList', currentLang).replace('✓', '').trim();

            badge.appendChild(badgeSvg);
            badge.appendChild(span);
            (thumbContainer as HTMLElement).style.position = 'relative';
            thumbContainer.appendChild(badge);
          }
        } else {
          if (existingBadge) {
            existingBadge.remove();
          }
        }
      }

      // Hide search shelves (recommendations/mixes) if no approved items inside in whitelist mode
      const searchShelves = document.querySelectorAll('ytd-shelf-renderer, ytd-horizontal-card-list-renderer');
      for (const shelf of searchShelves) {
        const htmlShelf = shelf as HTMLElement;
        if (cachedSettings.whitelistOnlyMode === true && isSearchPage) {
          const items = shelf.querySelectorAll('ytd-video-renderer, ytd-channel-renderer, ytd-compact-video-renderer, yt-lockup-view-model');
          let hasVisibleItem = false;
          for (const item of items) {
            if ((item as HTMLElement).style.display !== 'none') {
              hasVisibleItem = true;
              break;
            }
          }
          if (!hasVisibleItem) {
            htmlShelf.style.setProperty('display', 'none', 'important');
          } else {
            if (htmlShelf.style.display === 'none') {
              htmlShelf.style.removeProperty('display');
            }
          }
        } else if (cachedSettings.whitelistOnlyMode !== true && isSearchPage) {
          if (htmlShelf.style.display === 'none') {
            htmlShelf.style.removeProperty('display');
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
          updatePageTypeClasses();
          updateThumbnailBadgesAndFilter();
          handleWatchPageBlocked();
          await updateChannelButton();
          await updateVideoButton();
          await updateBlockChannelButton();
          await handleTitleUntranslation();
        } finally {
          isProcessing = false;
        }
      });
    }

    // Initial setup
    injectStyles();
    loadData().then(() => {
      updatePageTypeClasses();
      updateThumbnailBadgesAndFilter();
      processDOM();
    });

    // Handle YouTube's custom SPA navigation events for instant response
    window.addEventListener('yt-navigate-start', (e: any) => {
      const targetUrl = e?.detail?.url;
      handleShortsRedirect();
      updatePageTypeClasses(targetUrl);
      updateThumbnailBadgesAndFilter();
    });

    window.addEventListener('yt-navigate-finish', () => {
      handleShortsRedirect();
      updatePageTypeClasses();
      updateThumbnailBadgesAndFilter();
      setTimeout(processDOM, 100);
      setTimeout(processDOM, 500);
    });

    // Immediate reaction to search submissions or search button clicks
    document.addEventListener(
      'submit',
      (e) => {
        const form = e.target as HTMLElement;
        if (form?.id === 'search-form' || form?.closest('#search-form')) {
          updatePageTypeClasses('/results');
          updateThumbnailBadgesAndFilter();
        }
      },
      true
    );

    document.addEventListener(
      'click',
      (e) => {
        const target = e.target as HTMLElement;
        if (target?.closest('#search-icon-legacy, #search-button, button#search-button, #voice-search-button')) {
          updatePageTypeClasses('/results');
          updateThumbnailBadgesAndFilter();
        }
      },
      true
    );

    // Fallback popstate event
    window.addEventListener('popstate', () => {
      handleShortsRedirect();
      updatePageTypeClasses();
      updateThumbnailBadgesAndFilter();
      setTimeout(processDOM, 200);
    });

    // Observe dynamic feed additions (scrolling / lazy loading)
    const observer = new MutationObserver(() => {
      // Synchronous filtering immediately before browser paint prevents flickering
      updateThumbnailBadgesAndFilter();
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
          updateThumbnailBadgesAndFilter();
          processDOM();
        }
        if (changes.blockedChannels) {
          const newVal = changes.blockedChannels.newValue;
          cachedBlockedChannels = Array.isArray(newVal) ? (newVal as BlockedChannel[]) : [];
          updateThumbnailBadgesAndFilter();
          processDOM();
        }
        if (changes.newUploads) {
          const newVal = changes.newUploads.newValue;
          cachedApprovedVideos = Array.isArray(newVal) ? (newVal as NewUploadVideo[]) : [];
          updateThumbnailBadgesAndFilter();
          processDOM();
        }
        if (changes.whitelistFeedVideos) {
          const newVal = changes.whitelistFeedVideos.newValue;
          cachedWhitelistFeedVideos = Array.isArray(newVal) ? (newVal as NewUploadVideo[]) : [];
          updateThumbnailBadgesAndFilter();
          processDOM();
        }
        if (changes.settings) {
          const newSettings = changes.settings.newValue as AppSettings;
          cachedSettings = newSettings || {};
          currentLang = newSettings?.language || 'ar';
          applyShortsClass();
          applyWhitelistClass();
          updateThumbnailBadgesAndFilter();
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
