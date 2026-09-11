import './style.css';
import {
  getApprovedChannels,
  saveApprovedChannels,
  addApprovedChannel,
  removeApprovedChannel,
  isChannelApproved,
  getNewUploads,
  markAllUploadsAsRead,
  getSettings,
  saveSettings,
  exportApprovedChannelsJSON,
  importApprovedChannelsJSON,
  saveNewUploads,
  recordVideoUpload,
  updateBadgeCount,
  removeNewUploadVideo,
  isVideoApproved,
  addApprovedVideo,
  getVideoFolders,
  saveVideoFolders,
  createVideoFolder,
  deleteVideoFolder,
  moveVideoToFolder,
  getBlockedChannels,
  saveBlockedChannels,
  addBlockedChannel,
  removeBlockedChannel,
  isChannelBlocked,
} from '@/utils/storage';
import { isValidChannelAvatar, resolveChannelIdFromHandle } from '@/utils/youtube';
import { t, supportedLanguages, isRtlLanguage, loadLanguageMessages } from '@/utils/i18n';
import type { SupportedLanguage } from '@/utils/i18n';
import type { ApprovedChannel, NewUploadVideo, AppSettings, VideoFolder, BlockedChannel } from '@/utils/types';

// State variables
let currentTab: 'channels' | 'uploads' | 'blocked' | 'settings' = 'channels';
let approvedChannels: ApprovedChannel[] = [];
let blockedChannels: BlockedChannel[] = [];
let newUploads: NewUploadVideo[] = [];
let videoFolders: VideoFolder[] = [];
let currentFolderId: string = 'all'; // 'all' | 'uncategorized' | folderId
let selectedVideoIds = new Set<string>();
let currentSettings: AppSettings;
let searchQuery = '';
let videoSearchQuery = '';
let blockedSearchQuery = '';

// DOM Elements
const txtAppTitle = document.getElementById('txt-app-title')!;
const txtAppSubtitle = document.getElementById('txt-app-subtitle')!;
const txtTabChannels = document.getElementById('txt-tab-channels')!;
const txtTabUploads = document.getElementById('txt-tab-uploads')!;
const txtTabBlocked = document.getElementById('txt-tab-blocked');
const txtTabSettings = document.getElementById('txt-tab-settings')!;
const badgeChannelCount = document.getElementById('badge-channel-count')!;
const badgeBlockedCount = document.getElementById('badge-blocked-count') as HTMLElement | null;
const badgeUnreadCount = document.getElementById('badge-unread-count')!;

const tabBtnChannels = document.getElementById('tab-btn-channels')!;
const tabBtnUploads = document.getElementById('tab-btn-uploads')!;
const tabBtnBlocked = document.getElementById('tab-btn-blocked') as HTMLElement | null;
const tabBtnSettings = document.getElementById('tab-btn-settings')!;

const panelChannels = document.getElementById('panel-channels')!;
const panelUploads = document.getElementById('panel-uploads')!;
const panelBlocked = document.getElementById('panel-blocked') as HTMLElement | null;
const panelSettings = document.getElementById('panel-settings')!;

const currentChannelCard = document.getElementById('current-channel-card')!;
const inputSearch = document.getElementById('input-channel-search') as HTMLInputElement;
const btnClearSearch = document.getElementById('btn-clear-search')!;
const channelsListEl = document.getElementById('channels-list')!;
const channelsEmptyEl = document.getElementById('channels-empty')!;

const currentVideoCard = document.getElementById('current-video-card');
const inputVideoSearch = document.getElementById('input-video-search') as HTMLInputElement | null;
const btnClearVideoSearch = document.getElementById('btn-clear-video-search') as HTMLElement | null;
const uploadsListEl = document.getElementById('uploads-list')!;
const uploadsEmptyEl = document.getElementById('uploads-empty')!;
const btnRefreshFeed = document.getElementById('btn-refresh-feed');
const txtBtnRefresh = document.getElementById('txt-btn-refresh');
const btnMarkAllRead = document.getElementById('btn-mark-all-read');
const txtBtnMarkRead = document.getElementById('txt-btn-mark-read');

// Blocked Channels Elements
const currentBlockedChannelCard = document.getElementById('current-blocked-channel-card') as HTMLElement | null;
const inputBlockedChannel = document.getElementById('input-blocked-channel') as HTMLInputElement | null;
const btnAddBlockedChannel = document.getElementById('btn-add-blocked-channel') as HTMLButtonElement | null;
const txtBtnAddBlocked = document.getElementById('txt-btn-add-blocked');
const inputBlockedSearch = document.getElementById('input-blocked-search') as HTMLInputElement | null;
const btnClearBlockedSearch = document.getElementById('btn-clear-blocked-search') as HTMLElement | null;
const blockedChannelsListEl = document.getElementById('blocked-channels-list') as HTMLElement | null;
const blockedChannelsEmptyEl = document.getElementById('blocked-channels-empty') as HTMLElement | null;

// Settings Toggles Elements
const chkHideShorts = document.getElementById('chk-hide-shorts') as HTMLInputElement | null;
const txtLabelHideShorts = document.getElementById('txt-label-hide-shorts');
const txtDescHideShorts = document.getElementById('txt-desc-hide-shorts');
const chkDisableTranslation = document.getElementById('chk-disable-translation') as HTMLInputElement | null;
const txtLabelDisableTranslation = document.getElementById('txt-label-disable-translation');
const txtDescDisableTranslation = document.getElementById('txt-desc-disable-translation');

// Folder Navigation Elements
const folderChipsList = document.getElementById('folder-chips-list');
const btnFolderScrollRight = document.getElementById('btn-folder-scroll-right') as HTMLButtonElement | null;
const btnFolderScrollLeft = document.getElementById('btn-folder-scroll-left') as HTMLButtonElement | null;
const btnToggleAddFolder = document.getElementById('btn-toggle-add-folder');
const txtBtnNewFolder = document.getElementById('txt-btn-new-folder');
const folderAddBox = document.getElementById('folder-add-box');
const inputNewFolderName = document.getElementById('input-new-folder-name') as HTMLInputElement | null;
const btnConfirmAddFolder = document.getElementById('btn-confirm-add-folder');
const txtBtnCreateFolder = document.getElementById('txt-btn-create-folder');
const btnCancelAddFolder = document.getElementById('btn-cancel-add-folder');

// Video Multi-Selection & Bulk Elements
const chkSelectAllVideos = document.getElementById('chk-select-all-videos') as HTMLInputElement | null;
const txtSelectAll = document.getElementById('txt-select-all');
const badgeSelectedVideos = document.getElementById('badge-selected-videos');
const btnOpenSelectedVideos = document.getElementById('btn-open-selected-videos') as HTMLButtonElement | null;
const txtBtnOpenSelected = document.getElementById('txt-btn-open-selected');

// Settings Elements
const selectLanguage = document.getElementById('select-language') as HTMLSelectElement;
const selectPollInterval = document.getElementById('select-poll-interval') as HTMLSelectElement;
const txtSettingsGeneral = document.getElementById('txt-settings-general')!;
const txtLabelLanguage = document.getElementById('txt-label-language')!;
const txtLabelInterval = document.getElementById('txt-label-interval')!;
const txtSettingsBackup = document.getElementById('txt-settings-backup')!;
const btnExportChannels = document.getElementById('btn-export-channels')!;
const txtBtnExport = document.getElementById('txt-btn-export')!;
const btnImportTab = document.getElementById('btn-import-tab') as HTMLButtonElement | null;
const btnQuickPasteImport = document.getElementById('btn-quick-paste-import') as HTMLButtonElement | null;
const txtBtnPasteImport = document.getElementById('txt-btn-paste-import');
const inputImportFile = document.getElementById('input-import-file') as HTMLInputElement;
const txtBtnImport = document.getElementById('txt-btn-import')!;
const importPanel = document.getElementById('import-panel') as HTMLElement | null;
const btnCloseImport = document.getElementById('btn-close-import') as HTMLButtonElement | null;
const importDropZone = document.getElementById('import-drop-zone') as HTMLElement | null;
const txtDropzoneLabel = document.getElementById('txt-dropzone-label');
const txtImportPanelTitle = document.getElementById('txt-import-panel-title');
const txtPastePrompt = document.getElementById('txt-paste-prompt');
const btnPasteClipboard = document.getElementById('btn-paste-clipboard') as HTMLButtonElement | null;
const txtBtnPasteClip = document.getElementById('txt-btn-paste-clip');
const textareaImportJson = document.getElementById('textarea-import-json') as HTMLTextAreaElement | null;
const btnConfirmImportText = document.getElementById('btn-confirm-import-text') as HTMLButtonElement | null;
const txtBtnConfirmImport = document.getElementById('txt-btn-confirm-import');
const statusToast = document.getElementById('status-toast')!;

// Developer Section Elements
const txtDeveloperTitle = document.getElementById('txt-developer-title');
const txtDeveloperName = document.getElementById('txt-developer-name');
const txtDevEmailLabel = document.getElementById('txt-dev-email-label');
const txtDevWebsiteLabel = document.getElementById('txt-dev-website-label');
const linkDevEmail = document.getElementById('link-dev-email');
const linkDevWebsite = document.getElementById('link-dev-website');

// Onboarding Elements
const onboardingOverlay = document.getElementById('onboarding-overlay') as HTMLElement | null;
const txtOnboardingTitle = document.getElementById('txt-onboarding-title');
const txtOnboardingSubtitle = document.getElementById('txt-onboarding-subtitle');
const onboardingSelectLanguage = document.getElementById('onboarding-select-language') as HTMLSelectElement | null;
const txtOnboardingLangText = document.getElementById('txt-onboarding-lang-text');
const txtOnboardingMsgBadge = document.getElementById('txt-onboarding-msg-badge');
const txtOnboardingDesc = document.getElementById('txt-onboarding-desc');
const btnOnboardingUnderstand = document.getElementById('btn-onboarding-understand') as HTMLButtonElement | null;
const txtBtnOnboardingUnderstand = document.getElementById('txt-btn-onboarding-understand');

let activeTabChannelInfo: {
  id?: string;
  handle?: string;
  name?: string;
  avatarUrl?: string;
} | null = null;

let activeTabVideoInfo: NewUploadVideo | null = null;

/**
 * Detect if running in a standalone browser tab (page) vs extension popup.
 */
function isTabMode(): boolean {
  return (
    window.location.search.includes('tab=') ||
    window.location.search.includes('mode=tab') ||
    window.location.search.includes('openFile=') ||
    window.innerWidth > 500
  );
}

/**
 * Show a temporary status toast in settings.
 */
function showToast(message: string, type: 'success' | 'error' = 'success') {
  statusToast.textContent = message;
  statusToast.className = `status-toast ${type}`;
  statusToast.style.display = 'block';
  setTimeout(() => {
    statusToast.style.display = 'none';
  }, 3500);
}

/**
 * Custom in-popup confirmation modal that completely avoids the native window.confirm() dialog.
 * Prevents Brave/Chromium's "Prevent this page from creating additional dialogs" and broken layout.
 */
interface CustomConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

function showCustomConfirm(options: CustomConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-confirm-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const messageEl = document.getElementById('confirm-modal-message');
    const btnConfirm = document.getElementById('btn-modal-confirm') as HTMLButtonElement | null;
    const btnCancel = document.getElementById('btn-modal-cancel') as HTMLButtonElement | null;
    const txtConfirm = document.getElementById('txt-btn-modal-confirm');
    const txtCancel = document.getElementById('txt-btn-modal-cancel');
    const iconWrap = document.getElementById('confirm-modal-icon-wrap');

    if (!modal || !btnConfirm || !btnCancel) {
      resolve(true);
      return;
    }

    const lang = currentSettings?.language || 'ar';
    if (titleEl) titleEl.textContent = options.title || t('confirmModalTitle', lang);
    if (messageEl) messageEl.textContent = options.message;
    if (txtConfirm) txtConfirm.textContent = options.confirmText || t('confirmModalDelete', lang);
    if (txtCancel) txtCancel.textContent = options.cancelText || t('confirmModalCancel', lang);

    if (options.isDanger !== false) {
      btnConfirm.className = 'action-btn danger-btn modal-btn';
      if (iconWrap) {
        iconWrap.style.background = 'var(--danger-light)';
        iconWrap.style.color = 'var(--danger)';
      }
    } else {
      btnConfirm.className = 'action-btn modal-btn';
      if (iconWrap) {
        iconWrap.style.background = 'var(--accent-light)';
        iconWrap.style.color = 'var(--accent)';
      }
    }

    modal.style.display = 'flex';

    const cleanup = () => {
      modal.style.display = 'none';
      btnConfirm.removeEventListener('click', onConfirm);
      btnCancel.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      window.removeEventListener('keydown', onKey);
    };

    const onConfirm = (e: MouseEvent) => {
      e.stopPropagation();
      cleanup();
      resolve(true);
    };

    const onCancel = (e: MouseEvent) => {
      e.stopPropagation();
      cleanup();
      resolve(false);
    };

    const onBackdrop = (e: MouseEvent) => {
      if (e.target === modal) {
        cleanup();
        resolve(false);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup();
        resolve(false);
      }
    };

    btnConfirm.addEventListener('click', onConfirm);
    btnCancel.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
    window.addEventListener('keydown', onKey);
  });
}

/**
 * Format timestamp into relative or localized date string.
 */
function formatDate(dateString: string, lang: SupportedLanguage): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const now = Date.now();
    const diffHours = Math.floor((now - d.getTime()) / (1000 * 60 * 60));

    if (diffHours < 1) {
      return t('timeJustNow', lang);
    }
    if (diffHours < 24) {
      return t('timeHoursAgo', lang, { count: diffHours });
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
      return t('timeDaysAgo', lang, { count: diffDays });
    }
    return d.toLocaleDateString(lang, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * Apply localized strings across the entire UI and set RTL/LTR direction.
 */
async function applyLocalization(lang: SupportedLanguage) {
  await loadLanguageMessages(lang);
  const isRtl = isRtlLanguage(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr';

  txtAppTitle.textContent = t('extName', lang);
  txtAppSubtitle.textContent = t('appSubtitle', lang);
  txtTabChannels.textContent = t('tabChannels', lang);
  txtTabUploads.textContent = t('tabNewUploads', lang);
  if (txtTabBlocked) txtTabBlocked.textContent = t('tabBlocked', lang);
  txtTabSettings.textContent = t('tabSettings', lang);

  inputSearch.placeholder = t('searchPlaceholder', lang);
  if (inputVideoSearch) {
    inputVideoSearch.placeholder = t('searchVideosPlaceholder', lang);
  }
  if (inputBlockedSearch) {
    inputBlockedSearch.placeholder = t('searchBlockedPlaceholder', lang);
  }
  if (inputBlockedChannel) {
    inputBlockedChannel.placeholder = t('inputBlockedPlaceholder', lang);
  }
  if (txtBtnAddBlocked) {
    txtBtnAddBlocked.textContent = t('btnBlockChannel', lang);
  }
  if (txtLabelHideShorts) txtLabelHideShorts.textContent = t('settingHideShorts', lang);
  if (txtDescHideShorts) txtDescHideShorts.textContent = t('settingHideShortsDesc', lang);
  if (txtLabelDisableTranslation) txtLabelDisableTranslation.textContent = t('settingDisableTranslation', lang);
  if (txtDescDisableTranslation) txtDescDisableTranslation.textContent = t('settingDisableTranslationDesc', lang);

  if (txtBtnRefresh) txtBtnRefresh.textContent = t('refreshNow', lang);
  if (txtBtnMarkRead) txtBtnMarkRead.textContent = t('markAllAsRead', lang);

  txtSettingsGeneral.textContent = t('generalPreferences', lang);
  txtLabelLanguage.textContent = t('languageLabel', lang);
  txtLabelInterval.textContent = t('pollIntervalLabel', lang);
  txtSettingsBackup.textContent = t('backupSettings', lang);
  txtBtnExport.textContent = t('btnExport', lang);
  txtBtnImport.textContent = isTabMode() ? t('btnRestoreList', lang) : t('btnRestoreListPopup', lang);
  if (txtBtnPasteImport) txtBtnPasteImport.textContent = t('quickPasteImport', lang);
  if (txtImportPanelTitle) txtImportPanelTitle.textContent = t('importPanelTitle', lang);
  if (txtDropzoneLabel) txtDropzoneLabel.textContent = t('dropzoneLabel', lang);
  if (txtPastePrompt) txtPastePrompt.textContent = t('pastePrompt', lang);
  if (txtBtnPasteClip) txtBtnPasteClip.textContent = t('btnPasteClip', lang);
  if (txtBtnConfirmImport) txtBtnConfirmImport.textContent = t('btnConfirmImport', lang);

  // Folders localized elements
  if (txtBtnNewFolder) txtBtnNewFolder.textContent = t('btnNewFolder', lang);
  if (txtBtnCreateFolder) txtBtnCreateFolder.textContent = t('createFolder', lang);
  if (inputNewFolderName) inputNewFolderName.placeholder = t('folderNamePlaceholder', lang);

  // Selection & Bulk localized elements
  updateSelectionBarUI();

  // Developer localized elements
  if (txtDeveloperTitle) txtDeveloperTitle.textContent = t('developerTitle', lang);
  if (txtDeveloperName) txtDeveloperName.textContent = t('developerName', lang);
  if (txtDevEmailLabel) txtDevEmailLabel.textContent = t('developerEmailLabel', lang);
  if (txtDevWebsiteLabel) txtDevWebsiteLabel.textContent = t('developerWebsiteLabel', lang);

  // Onboarding localized elements
  if (txtOnboardingTitle) txtOnboardingTitle.textContent = t('onboardingTitle', lang);
  if (txtOnboardingSubtitle) txtOnboardingSubtitle.textContent = t('onboardingSubtitle', lang);
  if (txtOnboardingLangText) txtOnboardingLangText.textContent = t('onboardingLangLabel', lang);
  if (txtOnboardingMsgBadge) txtOnboardingMsgBadge.textContent = t('onboardingBadge', lang);
  if (txtOnboardingDesc) txtOnboardingDesc.textContent = t('onboardingDesc', lang);
  if (txtBtnOnboardingUnderstand) txtBtnOnboardingUnderstand.textContent = t('onboardingBtnUnderstand', lang);
  if (onboardingSelectLanguage) onboardingSelectLanguage.value = lang;

  selectLanguage.value = lang;
}

/**
 * Detect channel on currently active tab and display quick-action banner.
 */
async function checkActiveTabChannel() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    if (!activeTab?.id || !activeTab?.url) {
      currentChannelCard.style.display = 'none';
      if (currentVideoCard) currentVideoCard.style.display = 'none';
      return;
    }

    if (!activeTab.url.includes('youtube.com')) {
      currentChannelCard.style.display = 'none';
      if (currentVideoCard) currentVideoCard.style.display = 'none';
      return;
    }

    let pageInfo: {
      channelInfo?: { id?: string; handle?: string; name?: string; avatarUrl?: string } | null;
      videoInfo?: NewUploadVideo | null;
    } | null = null;

    try {
      pageInfo = await browser.tabs.sendMessage(activeTab.id, {
        type: 'GET_CURRENT_PAGE_INFO',
      });
    } catch {
      try {
        const ch = await browser.tabs.sendMessage(activeTab.id, {
          type: 'GET_CURRENT_CHANNEL_INFO',
        });
        pageInfo = { channelInfo: ch };
      } catch {
        // Content script may not have loaded or replied
      }
    }

    // If on a video page, store activeTabVideoInfo and render current video card (NO auto-add!)
    if (pageInfo?.videoInfo) {
      activeTabVideoInfo = pageInfo.videoInfo;
      renderCurrentVideoCard();
    } else {
      activeTabVideoInfo = null;
      renderCurrentVideoCard();
    }

    let channelInfo = pageInfo?.channelInfo || null;

    if (!channelInfo) {
      // Fallback: parse URL
      const parsed = new URL(activeTab.url);
      const path = parsed.pathname;
      let handle = '';
      let id = '';
      if (path.startsWith('/@')) {
        handle = path.split('/')[1]?.split('?')[0] || '';
      } else if (path.startsWith('/channel/')) {
        id = path.split('/')[2]?.split('?')[0] || '';
      }

      if (handle || id) {
        channelInfo = {
          id,
          handle,
          name: handle.replace(/^@/, '') || id,
        };
      }
    }

    if (!channelInfo || (!channelInfo.id && !channelInfo.handle)) {
      currentChannelCard.style.display = 'none';
      if (currentBlockedChannelCard) currentBlockedChannelCard.style.display = 'none';
      return;
    }

    activeTabChannelInfo = channelInfo;
    renderCurrentChannelCard();
    renderCurrentBlockedChannelCard();

    // If avatar is missing or invalid (e.g. yt_1200.png) or name starts with @, resolve via background
    const badAvatar = !channelInfo.avatarUrl || !isValidChannelAvatar(channelInfo.avatarUrl);
    const badName = !channelInfo.name || channelInfo.name.startsWith('@');
    if ((badAvatar || badName) && channelInfo.handle) {
      browser.runtime
        .sendMessage({
          type: 'RESOLVE_CHANNEL',
          handle: channelInfo.handle,
        })
        .then((res) => {
          if (!activeTabChannelInfo) return;
          let changed = false;
          if (res?.name && badName) {
            activeTabChannelInfo.name = res.name;
            changed = true;
          }
          if (res?.avatarUrl && isValidChannelAvatar(res.avatarUrl) && badAvatar) {
            activeTabChannelInfo.avatarUrl = res.avatarUrl;
            changed = true;
          }
          if (res?.id && !activeTabChannelInfo.id) {
            activeTabChannelInfo.id = res.id;
            changed = true;
          }
          if (changed) {
            renderCurrentChannelCard();
          }
        })
        .catch(() => {});
    }
  } catch (err) {
    console.warn('[Haris] Failed to check active tab channel:', err);
    currentChannelCard.style.display = 'none';
  }
}

/**
 * Render the current YouTube channel card at the top of the channels tab.
 */
function renderCurrentChannelCard() {
  if (!activeTabChannelInfo) {
    currentChannelCard.style.display = 'none';
    return;
  }

  const lang = currentSettings.language;
  const info = activeTabChannelInfo;
  const isApproved =
    (info.id && isChannelApproved(info.id, approvedChannels)) ||
    (info.handle && isChannelApproved(info.handle, approvedChannels));

  const channelUrl = info.handle
    ? `https://www.youtube.com/${info.handle.startsWith('@') ? info.handle : '@' + info.handle}`
    : `https://www.youtube.com/channel/${info.id}`;

  // 1. Channel display name: guaranteed not to start with @
  const rawName = info.name?.trim() || '';
  const displayName = (rawName && !rawName.startsWith('@'))
    ? rawName
    : (rawName.replace(/^@/, '') || info.handle?.replace(/^@/, '') || info.id || 'Channel');

  // 2. Channel handle: guaranteed to start with @
  const displayHandle = info.handle
    ? (info.handle.startsWith('@') ? info.handle : `@${info.handle}`)
    : (info.id || '');

  const initial = displayName.charAt(0).toUpperCase();

  currentChannelCard.style.display = 'block';
  currentChannelCard.innerHTML = `
    <div class="current-channel-header">
      <span class="current-channel-title">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <polygon points="10 8 16 12 10 16 10 8"></polygon>
        </svg>
        ${t('currentChannelTitle', lang)}
      </span>
    </div>
    <div class="current-channel-body">
      <a href="${channelUrl}" target="_blank" rel="noopener" class="current-channel-main" title="${displayName}">
        <div class="channel-avatar-wrapper">
          ${
            info.avatarUrl && isValidChannelAvatar(info.avatarUrl)
              ? `<img src="${info.avatarUrl}" alt="${displayName}" class="channel-avatar-img" referrerpolicy="no-referrer" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';" /><div class="channel-avatar-pill current-pill" style="display: none;">${initial}</div>`
              : `<div class="channel-avatar-pill current-pill">${initial}</div>`
          }
        </div>
        <div class="channel-meta">
          <div class="channel-name" title="${displayName}">${displayName}</div>
          <div class="channel-handle">${displayHandle}</div>
        </div>
      </a>
      <div class="current-channel-action">
        ${
          isApproved
            ? `<span class="approved-tag">✓ ${t('alreadyApproved', lang)}</span>`
            : `<button type="button" id="btn-add-current" class="action-btn small-btn add-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>${t('addThisChannel', lang)}</span>
              </button>`
        }
      </div>
    </div>
  `;

  if (!isApproved) {
    const btnAdd = document.getElementById('btn-add-current');
    btnAdd?.addEventListener('click', async (e) => {
      e.stopPropagation();
      let finalId = info.id || '';
      let finalAvatar = info.avatarUrl;
      let finalName = displayName;

      if (
        (!finalId || !finalAvatar || !isValidChannelAvatar(finalAvatar) || !info.name || info.name.startsWith('@')) &&
        info.handle
      ) {
        try {
          const res = await browser.runtime.sendMessage({
            type: 'RESOLVE_CHANNEL',
            handle: info.handle,
          });
          if (res?.id && !finalId) finalId = res.id;
          if (res?.name) finalName = res.name;
          if (res?.avatarUrl && isValidChannelAvatar(res.avatarUrl)) finalAvatar = res.avatarUrl;
        } catch {
          // Background might resolve later
        }
      }

      approvedChannels = await addApprovedChannel({
        id: finalId,
        handle: info.handle || '',
        name: finalName || displayName,
        avatarUrl: finalAvatar && isValidChannelAvatar(finalAvatar) ? finalAvatar : undefined,
      });

      activeTabChannelInfo = { ...info, id: finalId, name: finalName, avatarUrl: finalAvatar };
      renderChannels();
      renderCurrentChannelCard();
      showToast(t('channelAddedSuccess', lang, { name: finalName }), 'success');
      browser.runtime.sendMessage({ type: 'POLL_FEEDS_NOW' });
    });
  }
}

/**
 * Render the current YouTube video card at the top of the approved videos tab.
 */
function renderCurrentVideoCard() {
  if (!currentVideoCard) return;
  if (!activeTabVideoInfo) {
    currentVideoCard.style.display = 'none';
    return;
  }

  const lang = currentSettings.language;
  const info = activeTabVideoInfo;
  const isApproved = isVideoApproved(info.videoId, newUploads);

  currentVideoCard.style.display = 'block';
  currentVideoCard.innerHTML = `
    <div class="current-channel-header">
      <span class="current-channel-title">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polygon points="23 7 16 12 23 17 23 7"></polygon>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>
        ${t('currentVideoTitle', lang)}
      </span>
    </div>
    <div class="current-channel-body">
      <a href="${info.url}" target="_blank" rel="noopener" class="current-channel-main" title="${info.title}">
        <div class="video-thumb-wrap" style="width: 60px; height: 36px; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0;">
          <img src="${info.thumbnail}" alt="${info.title}" class="video-thumb" />
        </div>
        <div class="channel-meta" style="min-width: 0; flex: 1;">
          <div class="channel-name" title="${info.title}">${info.title}</div>
          <div class="channel-handle">${info.channelName}</div>
        </div>
      </a>
      <div class="current-channel-action">
        ${
          isApproved
            ? `<span class="approved-tag">✓ ${t('alreadyApprovedVideo', lang)}</span>`
            : `<button type="button" id="btn-add-current-video" class="action-btn small-btn add-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>${t('addThisVideo', lang)}</span>
              </button>`
        }
      </div>
    </div>
  `;

  if (!isApproved) {
    const btnAdd = document.getElementById('btn-add-current-video');
    btnAdd?.addEventListener('click', async (e) => {
      e.stopPropagation();
      newUploads = await addApprovedVideo(info);
      renderUploads();
      renderCurrentVideoCard();
      showToast(t('videoAddedSuccess', lang), 'success');
    });
  }
}

/**
 * Render the list of approved channels.
 */
function renderChannels() {
  const lang = currentSettings.language;
  const filtered = approvedChannels.filter((ch) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      ch.name.toLowerCase().includes(q) ||
      ch.handle.toLowerCase().includes(q) ||
      ch.id.toLowerCase().includes(q)
    );
  });

  badgeChannelCount.textContent = String(approvedChannels.length);

  if (approvedChannels.length === 0) {
    channelsListEl.innerHTML = '';
    channelsEmptyEl.style.display = 'block';
    channelsEmptyEl.innerHTML = `
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <h3 class="empty-title">${t('emptyChannelsTitle', lang)}</h3>
      <p class="empty-desc">${t('emptyChannelsDesc', lang)}</p>
    `;
    return;
  }

  if (filtered.length === 0) {
    channelsListEl.innerHTML = '';
    channelsEmptyEl.style.display = 'block';
    channelsEmptyEl.innerHTML = `
      <div class="empty-icon">🔍</div>
      <h3 class="empty-title">${t('noChannelsFound', lang)}</h3>
    `;
    return;
  }

  channelsEmptyEl.style.display = 'none';

  channelsListEl.innerHTML = filtered
    .map((ch) => {
      const rawName = ch.name?.trim() || '';
      const displayName = (rawName && !rawName.startsWith('@'))
        ? rawName
        : (rawName.replace(/^@/, '') || ch.handle?.replace(/^@/, '') || ch.id || 'Channel');

      const displayHandle = ch.handle
        ? (ch.handle.startsWith('@') ? ch.handle : `@${ch.handle}`)
        : (ch.id || '');

      const initial = displayName.charAt(0).toUpperCase();
      const channelUrl = ch.handle
        ? `https://www.youtube.com/${ch.handle.startsWith('@') ? ch.handle : '@' + ch.handle}`
        : `https://www.youtube.com/channel/${ch.id}`;
      const videosUrl = `${channelUrl}/videos`;

      return `
        <div class="channel-card" data-id="${ch.id}" data-handle="${ch.handle}">
          <a href="${channelUrl}" target="_blank" rel="noopener" class="channel-info" title="${displayName}">
            <div class="channel-avatar-wrapper">
              ${
                ch.avatarUrl && isValidChannelAvatar(ch.avatarUrl)
                  ? `<img src="${ch.avatarUrl}" alt="${displayName}" class="channel-avatar-img" referrerpolicy="no-referrer" loading="lazy" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';" /><div class="channel-avatar-pill" style="display: none;">${initial}</div>`
                  : `<div class="channel-avatar-pill">${initial}</div>`
              }
            </div>
            <div class="channel-meta">
              <div class="channel-name" title="${displayName}">${displayName}</div>
              <div class="channel-handle">${displayHandle}</div>
            </div>
          </a>
          <div class="channel-actions">
            <a href="${videosUrl}" target="_blank" rel="noopener" class="channel-action-btn view-btn" title="${t('openVideos', lang)}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>${t('openVideos', lang)}</span>
            </a>
            <button type="button" class="channel-action-btn delete-btn btn-remove-channel" data-identifier="${ch.id || ch.handle}" title="${t('removeChannel', lang)}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  // Attach delete handlers
  channelsListEl.querySelectorAll('.btn-remove-channel').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const identifier = btn.getAttribute('data-identifier');
      if (!identifier) return;

      const confirmed = await showCustomConfirm({
        message: t('confirmRemove', lang),
        confirmText: t('removeChannel', lang),
        isDanger: true,
      });

      if (confirmed) {
        approvedChannels = await removeApprovedChannel(identifier);
        renderChannels();
        renderCurrentChannelCard();
      }
    });
  });
}

/**
 * Helper to get currently visible videos based on search and selected folder.
 */
function getVisibleVideos(): NewUploadVideo[] {
  let filtered = newUploads;
  if (currentFolderId === 'uncategorized') {
    filtered = filtered.filter((v) => !v.folderId);
  } else if (currentFolderId !== 'all') {
    filtered = filtered.filter((v) => v.folderId === currentFolderId);
  }
  if (videoSearchQuery) {
    const q = videoSearchQuery.toLowerCase();
    filtered = filtered.filter(
      (v) => v.title.toLowerCase().includes(q) || v.channelName.toLowerCase().includes(q)
    );
  }
  return filtered;
}

/**
 * Update the bulk selection bar UI (checkbox, count badge, open button).
 */
function updateSelectionBarUI(visibleVideos: NewUploadVideo[] = getVisibleVideos()) {
  const lang = currentSettings?.language || 'ar';
  const selCount = selectedVideoIds.size;
  const visibleCount = visibleVideos.length;

  if (badgeSelectedVideos) {
    if (selCount > 0) {
      badgeSelectedVideos.textContent = String(selCount);
      badgeSelectedVideos.style.display = 'inline-block';
    } else {
      badgeSelectedVideos.style.display = 'none';
    }
  }

  const allSelected = visibleCount > 0 && visibleVideos.every((v) => selectedVideoIds.has(v.videoId));
  const someSelected = visibleVideos.some((v) => selectedVideoIds.has(v.videoId));

  if (txtSelectAll) {
    txtSelectAll.textContent = allSelected ? t('deselectAll', lang) : t('selectAll', lang);
  }

  if (chkSelectAllVideos) {
    chkSelectAllVideos.checked = allSelected;
    chkSelectAllVideos.indeterminate = !allSelected && someSelected;
  }

  if (txtBtnOpenSelected) {
    if (selCount > 0) {
      txtBtnOpenSelected.textContent = t('openSelectedInBrowser', lang, { count: selCount });
    } else {
      txtBtnOpenSelected.textContent = t('openInBrowser', lang);
    }
  }
}

let isFolderMouseDown = false;
let isFolderDragging = false;
let folderStartX = 0;
let folderStartScrollLeft = 0;

/**
 * Update visibility of folder scroll arrows based on overflow and current scroll position.
 */
function updateFolderScrollArrows() {
  if (!folderChipsList || !btnFolderScrollLeft || !btnFolderScrollRight) return;
  const { scrollLeft, scrollWidth, clientWidth } = folderChipsList;
  const maxScroll = scrollWidth - clientWidth;

  if (maxScroll <= 4) {
    btnFolderScrollLeft.style.display = 'none';
    btnFolderScrollRight.style.display = 'none';
    return;
  }

  const isRtl = document.documentElement.dir === 'rtl' || document.body.dir === 'rtl';

  if (isRtl) {
    // In RTL (Chrome/Firefox): start is right (scrollLeft ~ 0), end is left (scrollLeft ~ -maxScroll)
    const absScroll = Math.abs(scrollLeft);
    const canScrollLeft = absScroll < maxScroll - 4;
    const canScrollRight = absScroll > 4;
    btnFolderScrollLeft.style.display = canScrollLeft ? 'inline-flex' : 'none';
    btnFolderScrollRight.style.display = canScrollRight ? 'inline-flex' : 'none';
  } else {
    const canScrollLeft = scrollLeft > 4;
    const canScrollRight = scrollLeft < maxScroll - 4;
    btnFolderScrollLeft.style.display = canScrollLeft ? 'inline-flex' : 'none';
    btnFolderScrollRight.style.display = canScrollRight ? 'inline-flex' : 'none';
  }
}

/**
 * Render the folder navigation chips.
 */
function renderFolderNav() {
  if (!folderChipsList) return;
  const lang = currentSettings?.language || 'ar';
  const totalCount = newUploads.length;
  const uncategorizedCount = newUploads.filter((v) => !v.folderId).length;

  const chips: string[] = [];

  // All chip
  chips.push(`
    <button type="button" class="folder-chip ${currentFolderId === 'all' ? 'active' : ''}" data-folder-id="all">
      <span>${t('foldersAll', lang)}</span>
      <span class="folder-count">${totalCount}</span>
    </button>
  `);

  // Uncategorized chip
  chips.push(`
    <button type="button" class="folder-chip ${currentFolderId === 'uncategorized' ? 'active' : ''}" data-folder-id="uncategorized">
      <span>${t('foldersUncategorized', lang)}</span>
      <span class="folder-count">${uncategorizedCount}</span>
    </button>
  `);

  // Custom user folders
  for (const f of videoFolders) {
    const count = newUploads.filter((v) => v.folderId === f.id).length;
    const isActive = currentFolderId === f.id;
    chips.push(`
      <div class="folder-chip-group ${isActive ? 'active' : ''}">
        <button type="button" class="folder-chip ${isActive ? 'active' : ''}" data-folder-id="${f.id}" title="${f.name}">
          <span class="folder-name-text">${f.name}</span>
          <span class="folder-count">${count}</span>
        </button>
        <button type="button" class="folder-delete-btn" data-delete-folder-id="${f.id}" title="${t('deleteFolder', lang)}">
          ✕
        </button>
      </div>
    `);
  }

  folderChipsList.innerHTML = chips.join('');

  // Attach click listener for chips
  folderChipsList.querySelectorAll<HTMLButtonElement>('.folder-chip').forEach((chip) => {
    chip.addEventListener('click', (e) => {
      if (isFolderDragging) {
        e.preventDefault();
        return;
      }
      const fid = chip.getAttribute('data-folder-id');
      if (fid) {
        currentFolderId = fid;
        renderFolderNav();
        renderUploads();
        chip.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      }
    });
  });

  // Attach delete folder listener
  folderChipsList.querySelectorAll<HTMLButtonElement>('.folder-delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const fid = btn.getAttribute('data-delete-folder-id');
      if (!fid) return;

      const confirmed = await showCustomConfirm({
        message: t('confirmDeleteFolder', lang),
        confirmText: t('confirmModalDelete', lang),
        isDanger: true,
      });

      if (confirmed) {
        videoFolders = await deleteVideoFolder(fid);
        newUploads = await getNewUploads();
        if (currentFolderId === fid) {
          currentFolderId = 'all';
        }
        renderFolderNav();
        renderUploads();
      }
    });
  });

  requestAnimationFrame(() => {
    updateFolderScrollArrows();
  });
}

/**
 * Render the list of new video uploads.
 */
function renderUploads() {
  const lang = currentSettings.language;

  badgeUnreadCount.textContent = String(newUploads.length);
  badgeUnreadCount.style.display = 'inline-block';

  // Clean up selectedVideoIds if any were deleted
  const currentVideoIdSet = new Set(newUploads.map((v) => v.videoId));
  for (const id of Array.from(selectedVideoIds)) {
    if (!currentVideoIdSet.has(id)) {
      selectedVideoIds.delete(id);
    }
  }

  const filteredVideos = getVisibleVideos();
  updateSelectionBarUI(filteredVideos);

  if (newUploads.length === 0) {
    uploadsListEl.innerHTML = '';
    uploadsEmptyEl.style.display = 'block';
    uploadsEmptyEl.innerHTML = `
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polygon points="23 7 16 12 23 17 23 7"></polygon>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>
      </div>
      <h3 class="empty-title">${t('emptyUploadsTitle', lang)}</h3>
      <p class="empty-desc">${t('emptyUploadsDesc', lang)}</p>
    `;
    return;
  }

  if (filteredVideos.length === 0) {
    uploadsListEl.innerHTML = '';
    uploadsEmptyEl.style.display = 'block';
    uploadsEmptyEl.innerHTML = `
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>
      <h3 class="empty-title">${t('noVideosFound', lang)}</h3>
    `;
    return;
  }

  uploadsEmptyEl.style.display = 'none';

  uploadsListEl.innerHTML = filteredVideos
    .map((vid) => {
      const formattedDate = formatDate(vid.publishedAt, lang);
      const isChecked = selectedVideoIds.has(vid.videoId);

      const folderOptions = [
        `<option value="" ${!vid.folderId ? 'selected' : ''}>📁 ${t('foldersUncategorized', lang)}</option>`,
        ...videoFolders.map(
          (f) => `<option value="${f.id}" ${vid.folderId === f.id ? 'selected' : ''}>📁 ${f.name}</option>`
        ),
      ].join('');

      return `
        <div class="video-card ${isChecked ? 'selected' : ''}">
          <div class="video-select-cell">
            <label class="checkbox-wrapper">
              <input type="checkbox" class="chk-video-item" data-video-id="${vid.videoId}" ${isChecked ? 'checked' : ''} />
              <span class="custom-checkbox"></span>
            </label>
          </div>
          <a href="${vid.url}" target="_blank" rel="noopener" class="video-main-link" data-video-id="${vid.videoId}">
            <div class="video-thumb-wrap">
              <img src="${vid.thumbnail}" alt="${vid.title}" class="video-thumb" loading="lazy" />
            </div>
            <div class="video-info">
              <div class="video-title" title="${vid.title}">${vid.title}</div>
              <div class="video-subinfo">
                <span class="video-channel">${vid.channelName}</span>
                <span class="video-date">${formattedDate}</span>
              </div>
            </div>
          </a>
          <div class="video-actions">
            <div class="video-folder-select-wrap">
              <select class="styled-select-xs select-video-folder" data-video-id="${vid.videoId}" title="${t('moveToFolder', lang)}">
                ${folderOptions}
              </select>
            </div>
            <button type="button" class="channel-action-btn delete-btn btn-remove-video" data-video-id="${vid.videoId}" title="${t('removeVideo', lang)}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  // Item checkboxes
  uploadsListEl.querySelectorAll<HTMLInputElement>('.chk-video-item').forEach((chk) => {
    chk.addEventListener('change', (e) => {
      e.stopPropagation();
      const vidId = chk.getAttribute('data-video-id');
      if (!vidId) return;
      if (chk.checked) {
        selectedVideoIds.add(vidId);
      } else {
        selectedVideoIds.delete(vidId);
      }
      const card = chk.closest('.video-card');
      if (card) card.classList.toggle('selected', chk.checked);
      updateSelectionBarUI(filteredVideos);
    });
  });

  // Folder assignment
  uploadsListEl.querySelectorAll<HTMLSelectElement>('.select-video-folder').forEach((sel) => {
    sel.addEventListener('change', async (e) => {
      e.stopPropagation();
      const vidId = sel.getAttribute('data-video-id');
      if (!vidId) return;
      const newFolderId = sel.value || undefined;
      newUploads = await moveVideoToFolder(vidId, newFolderId);
      renderFolderNav();
      renderUploads();
      showToast(t('videoMoved', lang), 'success');
    });
  });

  // Main link click
  uploadsListEl.querySelectorAll<HTMLAnchorElement>('.video-main-link').forEach((link) => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const targetUrl = link.getAttribute('href');
      if (targetUrl) {
        await browser.tabs.create({ url: targetUrl });
      }
    });
  });

  // Remove video
  uploadsListEl.querySelectorAll<HTMLButtonElement>('.btn-remove-video').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const vidId = btn.getAttribute('data-video-id');
      if (!vidId) return;

      const confirmed = await showCustomConfirm({
        message: t('confirmRemoveVideo', lang),
        confirmText: t('confirmModalDelete', lang),
        isDanger: true,
      });

      if (confirmed) {
        selectedVideoIds.delete(vidId);
        newUploads = await removeNewUploadVideo(vidId);
        renderFolderNav();
        renderUploads();
        renderCurrentVideoCard();
      }
    });
  });
}

/**
 * Render the list of blocked channels.
 */
function renderBlockedChannels() {
  if (!blockedChannelsListEl || !blockedChannelsEmptyEl) return;
  const lang = currentSettings.language;
  const filtered = blockedChannels.filter((ch) => {
    if (!blockedSearchQuery) return true;
    const q = blockedSearchQuery.toLowerCase();
    return (
      ch.name.toLowerCase().includes(q) ||
      ch.handle.toLowerCase().includes(q) ||
      ch.id.toLowerCase().includes(q)
    );
  });

  if (badgeBlockedCount) {
    badgeBlockedCount.textContent = String(blockedChannels.length);
  }

  if (blockedChannels.length === 0) {
    blockedChannelsListEl.innerHTML = '';
    blockedChannelsEmptyEl.style.display = 'block';
    blockedChannelsEmptyEl.innerHTML = `
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
        </svg>
      </div>
      <div class="empty-title">${t('emptyBlockedTitle', lang)}</div>
      <div class="empty-desc">${t('emptyBlockedDesc', lang)}</div>
    `;
    return;
  }

  if (filtered.length === 0) {
    blockedChannelsListEl.innerHTML = '';
    blockedChannelsEmptyEl.style.display = 'block';
    blockedChannelsEmptyEl.innerHTML = `
      <div class="empty-icon">🔍</div>
      <div class="empty-title">${t('noResults', lang)}</div>
      <div class="empty-desc">${t('noResultsDesc', lang)}</div>
    `;
    return;
  }

  blockedChannelsEmptyEl.style.display = 'none';
  blockedChannelsListEl.innerHTML = filtered
    .map((ch) => {
      const avatarSrc = isValidChannelAvatar(ch.avatarUrl) ? ch.avatarUrl : null;
      const initial = (ch.name || ch.handle || '?').charAt(0).toUpperCase();
      const blockedDate = formatDate(new Date(ch.blockedAt).toISOString(), lang);

      return `
        <div class="channel-card" data-identifier="${ch.id || ch.handle}">
          <div class="channel-info-main">
            <div class="channel-avatar">
              ${
                avatarSrc
                  ? `<img src="${avatarSrc}" alt="${ch.name}" class="avatar-img" />`
                  : `<div class="avatar-placeholder" style="background: rgba(239, 68, 68, 0.2); color: #f87171;">${initial}</div>`
              }
            </div>
            <div class="channel-details">
              <span class="channel-name" title="${ch.name}">${ch.name}</span>
              <div class="channel-meta-row">
                <span class="channel-handle">${ch.handle || ch.id}</span>
                <span class="channel-meta-dot">•</span>
                <span class="channel-date">${blockedDate}</span>
              </div>
            </div>
          </div>
          <div class="channel-actions">
            <button type="button" class="btn-unblock-channel" data-identifier="${ch.id || ch.handle}" title="${t('btnUnblockChannel', lang)}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>${t('btnUnblockChannel', lang)}</span>
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  // Attach unblock handlers
  blockedChannelsListEl.querySelectorAll('.btn-unblock-channel').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const identifier = btn.getAttribute('data-identifier');
      if (!identifier) return;

      const confirmed = await showCustomConfirm({
        message: t('confirmUnblockChannel', lang),
        confirmText: t('btnUnblockChannel', lang),
        isDanger: false,
      });

      if (confirmed) {
        blockedChannels = await removeBlockedChannel(identifier);
        renderBlockedChannels();
        renderCurrentBlockedChannelCard();
        showToast(t('channelUnblockedSuccess', lang), 'success');
      }
    });
  });
}

/**
 * Render the active YouTube channel banner inside the Blocked Channels tab.
 */
function renderCurrentBlockedChannelCard() {
  if (!currentBlockedChannelCard) return;
  if (!activeTabChannelInfo) {
    currentBlockedChannelCard.style.display = 'none';
    return;
  }

  const lang = currentSettings.language;
  const info = activeTabChannelInfo;
  const isBlocked =
    (info.id && isChannelBlocked(info.id, blockedChannels)) ||
    (info.handle && isChannelBlocked(info.handle, blockedChannels));

  currentBlockedChannelCard.style.display = 'block';

  const rawName = info.name?.trim() || '';
  const displayName =
    rawName && !rawName.startsWith('@')
      ? rawName
      : rawName.replace(/^@/, '') || info.handle?.replace(/^@/, '') || info.id || 'Channel';

  const displayHandle = info.handle
    ? info.handle.startsWith('@')
      ? info.handle
      : `@${info.handle}`
    : info.id || '';

  const initial = displayName.charAt(0).toUpperCase();
  const channelUrl = info.handle
    ? `https://www.youtube.com/${info.handle.startsWith('@') ? info.handle : '@' + info.handle}`
    : `https://www.youtube.com/channel/${info.id}`;

  currentBlockedChannelCard.innerHTML = `
    <div class="current-channel-header">
      <span class="current-channel-title">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
        </svg>
        ${isBlocked ? t('channelIsBlocked', lang) : t('blockCurrentChannel', lang)}
      </span>
    </div>
    <div class="current-channel-body">
      <a href="${channelUrl}" target="_blank" rel="noopener" class="current-channel-main" title="${displayName}">
        <div class="channel-avatar-wrapper">
          ${
            info.avatarUrl && isValidChannelAvatar(info.avatarUrl)
              ? `<img src="${info.avatarUrl}" alt="${displayName}" class="channel-avatar-img" referrerpolicy="no-referrer" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';" /><div class="channel-avatar-pill current-pill" style="display: none; background: rgba(239, 68, 68, 0.2); color: #f87171;">${initial}</div>`
              : `<div class="channel-avatar-pill current-pill" style="background: rgba(239, 68, 68, 0.2); color: #f87171;">${initial}</div>`
          }
        </div>
        <div class="channel-meta">
          <div class="channel-name" title="${displayName}">${displayName}</div>
          <div class="channel-handle" dir="ltr">${displayHandle}</div>
        </div>
      </a>
      <div class="current-channel-action">
        ${
          isBlocked
            ? `<button type="button" id="btn-unblock-current-card" class="btn-unblock-channel">
                <span>${t('btnUnblockChannel', lang)}</span>
              </button>`
            : `<button type="button" id="btn-block-current-card" class="action-btn small-btn danger-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                </svg>
                <span>${t('btnBlockChannel', lang)}</span>
              </button>`
        }
      </div>
    </div>
  `;

  if (isBlocked) {
    const btnUnblock = document.getElementById('btn-unblock-current-card');
    btnUnblock?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const identifier = info.id || info.handle;
      if (!identifier) return;
      const confirmed = await showCustomConfirm({
        message: t('confirmUnblockChannel', lang),
        confirmText: t('btnUnblockChannel', lang),
        isDanger: false,
      });
      if (confirmed) {
        blockedChannels = await removeBlockedChannel(identifier);
        renderBlockedChannels();
        renderCurrentBlockedChannelCard();
        showToast(t('channelUnblockedSuccess', lang), 'success');
      }
    });
  } else {
    const btnBlock = document.getElementById('btn-block-current-card');
    btnBlock?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmed = await showCustomConfirm({
        message: t('confirmBlockChannel', lang),
        confirmText: t('btnBlockChannel', lang),
        isDanger: true,
      });
      if (confirmed) {
        blockedChannels = await addBlockedChannel({
          id: info.id || '',
          handle: info.handle || '',
          name: info.name || info.handle || 'Channel',
          avatarUrl: info.avatarUrl,
        });
        renderBlockedChannels();
        renderCurrentBlockedChannelCard();
        showToast(t('channelBlockedSuccess', lang), 'success');
      }
    });
  }
}

/**
 * Handle adding a blocked channel manually by handle or URL.
 */
async function handleAddBlockedChannel() {
  if (!inputBlockedChannel) return;
  const rawInput = inputBlockedChannel.value.trim();
  if (!rawInput) return;

  const lang = currentSettings.language;
  let id = '';
  let handle = '';

  if (rawInput.includes('/@')) {
    handle = rawInput.split('/@')[1]?.split(/[?#/]/)[0] || '';
  } else if (rawInput.includes('/channel/')) {
    id = rawInput.split('/channel/')[1]?.split(/[?#/]/)[0] || '';
  } else if (rawInput.startsWith('@')) {
    handle = rawInput;
  } else if (rawInput.startsWith('UC') && rawInput.length >= 20) {
    id = rawInput;
  } else {
    handle = rawInput;
  }

  if (handle && !handle.startsWith('@')) {
    handle = `@${handle}`;
  }

  let finalName = handle ? handle.replace(/^@/, '') : id;
  let finalAvatar: string | undefined = undefined;

  if (handle) {
    try {
      const resolved = await resolveChannelIdFromHandle(handle);
      if (resolved.id) id = resolved.id;
      if (resolved.name) finalName = resolved.name;
      if (resolved.avatarUrl) finalAvatar = resolved.avatarUrl;
    } catch {
      // Ignore resolution failure
    }
  }

  blockedChannels = await addBlockedChannel({
    id,
    handle,
    name: finalName || 'Blocked Channel',
    avatarUrl: finalAvatar,
  });

  inputBlockedChannel.value = '';
  renderBlockedChannels();
  renderCurrentBlockedChannelCard();
  showToast(t('channelBlockedSuccess', lang), 'success');
}

/**
 * Switch the active tab.
 */
function switchTab(tab: 'channels' | 'uploads' | 'blocked' | 'settings') {
  currentTab = tab;

  tabBtnChannels.classList.toggle('active', tab === 'channels');
  tabBtnUploads.classList.toggle('active', tab === 'uploads');
  if (tabBtnBlocked) tabBtnBlocked.classList.toggle('active', tab === 'blocked');
  tabBtnSettings.classList.toggle('active', tab === 'settings');

  panelChannels.classList.toggle('active', tab === 'channels');
  panelUploads.classList.toggle('active', tab === 'uploads');
  if (panelBlocked) panelBlocked.classList.toggle('active', tab === 'blocked');
  panelSettings.classList.toggle('active', tab === 'settings');
}

/**
 * Initialize application state and event listeners.
 */
async function init() {
  if (isTabMode()) {
    document.body.classList.add('tab-view');
  }

  currentSettings = await getSettings();
  approvedChannels = await getApprovedChannels();
  blockedChannels = await getBlockedChannels();
  newUploads = await getNewUploads();
  videoFolders = await getVideoFolders();

  await applyLocalization(currentSettings.language);
  renderChannels();
  renderBlockedChannels();
  renderFolderNav();
  renderUploads();
  await checkActiveTabChannel();

  // Auto-heal any existing channels that had invalid avatar (e.g. YouTube logo) or unparsed name
  const needsHealing = approvedChannels.some(
    (ch) => !ch.avatarUrl || !isValidChannelAvatar(ch.avatarUrl) || !ch.name || ch.name.startsWith('@')
  );
  if (needsHealing) {
    (async () => {
      let modified = false;
      for (const ch of approvedChannels) {
        const badAvatar = !ch.avatarUrl || !isValidChannelAvatar(ch.avatarUrl);
        const badName = !ch.name || ch.name.startsWith('@');
        if ((badAvatar || badName) && ch.handle) {
          try {
            const res = await browser.runtime.sendMessage({
              type: 'RESOLVE_CHANNEL',
              handle: ch.handle,
            });
            if (res?.name && (badName || ch.name !== res.name)) {
              ch.name = res.name;
              modified = true;
            }
            if (res?.avatarUrl && isValidChannelAvatar(res.avatarUrl) && badAvatar) {
              ch.avatarUrl = res.avatarUrl;
              modified = true;
            }
            if (res?.id && !ch.id) {
              ch.id = res.id;
              modified = true;
            }
          } catch {}
        }
      }
      if (modified) {
        await saveApprovedChannels(approvedChannels);
        renderChannels();
      }
    })();
  }

  // First-run onboarding setup
  const isFirstRun = !currentSettings.hasSeenOnboarding;
  if (isFirstRun && onboardingOverlay) {
    onboardingOverlay.style.display = 'flex';
  } else if (onboardingOverlay) {
    onboardingOverlay.style.display = 'none';
  }

  // Populate onboarding language selector
  if (onboardingSelectLanguage) {
    onboardingSelectLanguage.innerHTML = supportedLanguages
      .map((l) => `<option value="${l.code}">${l.nativeLanguageName}</option>`)
      .join('');
    onboardingSelectLanguage.value = currentSettings.language || 'ar';

    onboardingSelectLanguage.addEventListener('change', async () => {
      const newLang = onboardingSelectLanguage.value as SupportedLanguage;
      currentSettings = await saveSettings({ language: newLang });
      await applyLocalization(newLang);
      selectLanguage.value = newLang;
      renderChannels();
      renderFolderNav();
      renderUploads();
      renderCurrentChannelCard();
      renderCurrentVideoCard();
    });
  }

  // Onboarding understand button
  btnOnboardingUnderstand?.addEventListener('click', async () => {
    currentSettings = await saveSettings({
      hasSeenOnboarding: true,
      language: currentSettings.language,
    });
    if (onboardingOverlay) {
      onboardingOverlay.classList.add('closing');
      setTimeout(() => {
        onboardingOverlay.style.display = 'none';
        onboardingOverlay.classList.remove('closing');
      }, 250);
    }
  });

  // Populate 48 supported languages
  selectLanguage.innerHTML = supportedLanguages
    .map((l) => `<option value="${l.code}">${l.nativeLanguageName}</option>`)
    .join('');
  selectLanguage.value = currentSettings.language || 'ar';

  selectPollInterval.value = String(currentSettings.pollIntervalMinutes || 30);

  // Handle standalone tab detection and URL query parameters
  if (isTabMode()) {
    document.body.classList.add('tab-view');
  }
  txtBtnImport.textContent = isTabMode()
    ? t('btnRestoreList', currentSettings.language)
    : t('btnRestoreListPopup', currentSettings.language);

  window.addEventListener('resize', () => {
    if (isTabMode()) {
      document.body.classList.add('tab-view');
    } else {
      document.body.classList.remove('tab-view');
    }
    txtBtnImport.textContent = isTabMode()
      ? t('btnRestoreList', currentSettings.language)
      : t('btnRestoreListPopup', currentSettings.language);
  });

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('tab') === 'settings') {
    switchTab('settings');
    if (urlParams.get('openFile') === '1') {
      if (importPanel) importPanel.style.display = 'flex';
      setTimeout(() => {
        inputImportFile?.click();
      }, 350);
    }
  }

  // Tab navigation
  tabBtnChannels.addEventListener('click', () => switchTab('channels'));
  tabBtnUploads.addEventListener('click', () => switchTab('uploads'));
  tabBtnBlocked?.addEventListener('click', () => switchTab('blocked'));
  tabBtnSettings.addEventListener('click', () => switchTab('settings'));

  // Blocked Channels input & search
  btnAddBlockedChannel?.addEventListener('click', handleAddBlockedChannel);
  inputBlockedChannel?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddBlockedChannel();
    }
  });

  inputBlockedSearch?.addEventListener('input', () => {
    blockedSearchQuery = inputBlockedSearch.value.trim();
    if (btnClearBlockedSearch) {
      btnClearBlockedSearch.style.display = blockedSearchQuery ? 'block' : 'none';
    }
    renderBlockedChannels();
  });

  btnClearBlockedSearch?.addEventListener('click', () => {
    if (inputBlockedSearch) inputBlockedSearch.value = '';
    blockedSearchQuery = '';
    btnClearBlockedSearch.style.display = 'none';
    renderBlockedChannels();
  });

  // Settings Toggles (Shorts & Title translation)
  if (chkHideShorts) {
    chkHideShorts.checked = currentSettings.hideShorts !== false;
    chkHideShorts.addEventListener('change', async () => {
      currentSettings = await saveSettings({ hideShorts: chkHideShorts.checked });
      showToast(t('settingsSaved', currentSettings.language), 'success');
    });
  }

  if (chkDisableTranslation) {
    chkDisableTranslation.checked = currentSettings.disableTitleTranslation !== false;
    chkDisableTranslation.addEventListener('change', async () => {
      currentSettings = await saveSettings({ disableTitleTranslation: chkDisableTranslation.checked });
      showToast(t('settingsSaved', currentSettings.language), 'success');
    });
  }

  // Search channels input
  inputSearch.addEventListener('input', () => {
    searchQuery = inputSearch.value.trim();
    btnClearSearch.style.display = searchQuery ? 'block' : 'none';
    renderChannels();
  });

  btnClearSearch.addEventListener('click', () => {
    inputSearch.value = '';
    searchQuery = '';
    btnClearSearch.style.display = 'none';
    renderChannels();
  });

  // Search approved videos input
  if (inputVideoSearch) {
    inputVideoSearch.addEventListener('input', () => {
      videoSearchQuery = inputVideoSearch.value.trim();
      if (btnClearVideoSearch) {
        btnClearVideoSearch.style.display = videoSearchQuery ? 'block' : 'none';
      }
      renderUploads();
    });
  }

  if (btnClearVideoSearch) {
    btnClearVideoSearch.addEventListener('click', () => {
      if (inputVideoSearch) inputVideoSearch.value = '';
      videoSearchQuery = '';
      btnClearVideoSearch.style.display = 'none';
      renderUploads();
    });
  }

  // Refresh feeds button (if present)
  btnRefreshFeed?.addEventListener('click', async () => {
    const lang = currentSettings.language;
    if (txtBtnRefresh) txtBtnRefresh.textContent = t('refreshing', lang);
    btnRefreshFeed.setAttribute('disabled', 'true');

    try {
      const res = await browser.runtime.sendMessage({ type: 'POLL_FEEDS_NOW' });
      newUploads = await getNewUploads();
      approvedChannels = await getApprovedChannels();
      renderUploads();
      renderChannels();
      renderCurrentChannelCard();
      renderCurrentVideoCard();
      const count = res?.newCount || 0;
      if (count > 0) {
        showToast(
          t('newVideosFound', lang, { count }),
          'success'
        );
      }
    } catch (err) {
      console.error('[Haris] Manual refresh failed:', err);
    } finally {
      if (txtBtnRefresh) txtBtnRefresh.textContent = t('refreshNow', lang);
      btnRefreshFeed.removeAttribute('disabled');
    }
  });

  // Mark all as read button (if present)
  btnMarkAllRead?.addEventListener('click', async () => {
    await markAllUploadsAsRead();
    newUploads = await getNewUploads();
    renderUploads();
  });

  // Language selector
  selectLanguage.addEventListener('change', async () => {
    const newLang = selectLanguage.value as SupportedLanguage;
    currentSettings = await saveSettings({ language: newLang });
    await applyLocalization(newLang);
    renderChannels();
    renderFolderNav();
    renderUploads();
    renderCurrentChannelCard();
    renderCurrentVideoCard();
    showToast(t('settingsSaved', newLang), 'success');
  });

  // Poll interval selector
  selectPollInterval.addEventListener('change', async () => {
    const interval = parseInt(selectPollInterval.value, 10) || 30;
    currentSettings = await saveSettings({ pollIntervalMinutes: interval });
    await browser.runtime.sendMessage({ type: 'RESET_ALARM' });
    showToast(t('settingsSaved', currentSettings.language), 'success');
  });

  // Shared import processing helper
  async function processImport(text: string) {
    if (!text || !text.trim()) {
      showToast(t('importInvalidFile', currentSettings.language), 'error');
      return;
    }

    try {
      const res = await importApprovedChannelsJSON(text.trim());
      approvedChannels = await getApprovedChannels();
      blockedChannels = await getBlockedChannels();
      newUploads = await getNewUploads();
      videoFolders = await getVideoFolders();
      renderChannels();
      renderBlockedChannels();
      renderCurrentBlockedChannelCard();
      renderFolderNav();
      renderUploads();
      renderCurrentChannelCard();
      renderCurrentVideoCard();

      if (textareaImportJson) textareaImportJson.value = '';
      if (inputImportFile) inputImportFile.value = '';
      if (importPanel) importPanel.style.display = 'none';

      showToast(
        t('importFullSuccess', currentSettings.language, {
          channels: res.importedCount,
          blocked: res.importedBlockedCount || 0,
          videos: res.importedUploadsCount,
        }),
        'success'
      );

      // Trigger background check for newly imported channels
      browser.runtime.sendMessage({ type: 'POLL_FEEDS_NOW' });
    } catch (err) {
      console.warn('[Haris] Import failed:', err);
      showToast(t('importInvalidFile', currentSettings.language), 'error');
    }
  }

  // Export backup button (channels + videos + settings)
  btnExportChannels.addEventListener('click', async () => {
    try {
      const json = await exportApprovedChannelsJSON();
      const encodedUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
      const a = document.createElement('a');
      a.href = encodedUri;
      a.download = `haris-al-muhtawa-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      try {
        await navigator.clipboard.writeText(json);
      } catch {}

      showToast(t('exportSuccess', currentSettings.language), 'success');
    } catch (err) {
      showToast(String(err), 'error');
    }
  });

  // Open file import directly in the page or dedicated tab
  btnImportTab?.addEventListener('click', () => {
    if (isTabMode()) {
      if (importPanel) {
        importPanel.style.display = 'flex';
        importPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      inputImportFile?.click();
    } else {
      browser.tabs.create({
        url: browser.runtime.getURL('/popup.html?tab=settings&openFile=1&mode=tab'),
      });
      window.close();
    }
  });

  // Quick paste import directly from clipboard
  btnQuickPasteImport?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.includes('channels') || text.includes('approvedChannels') || text.includes('uploads') || text.startsWith('['))) {
        await processImport(text);
        return;
      }
    } catch (err) {
      console.warn('[Haris] Clipboard read access error:', err);
    }

    // Fallback: open import panel and focus textarea
    if (importPanel) importPanel.style.display = 'flex';
    if (textareaImportJson) {
      textareaImportJson.focus();
    }
    showToast(
      t('pasteBackupPrompt', currentSettings.language),
      'error'
    );
  });

  btnCloseImport?.addEventListener('click', () => {
    if (importPanel) importPanel.style.display = 'none';
  });

  // Paste from clipboard button
  btnPasteClipboard?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && textareaImportJson) {
        textareaImportJson.value = text;
      }
    } catch (err) {
      console.warn('[Haris] Clipboard read error:', err);
    }
  });

  // Confirm import from textarea button
  btnConfirmImportText?.addEventListener('click', async () => {
    const text = textareaImportJson?.value || '';
    await processImport(text);
  });

  // File input change
  inputImportFile?.addEventListener('change', async () => {
    const file = inputImportFile.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await processImport(text);
    } catch (err) {
      showToast(t('importInvalidFile', currentSettings.language), 'error');
    } finally {
      inputImportFile.value = '';
    }
  });

  // Drag & drop on import drop zone
  if (importDropZone) {
    importDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      importDropZone.classList.add('dragover');
    });

    importDropZone.addEventListener('dragleave', () => {
      importDropZone.classList.remove('dragover');
    });

    importDropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      importDropZone.classList.remove('dragover');
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        await processImport(text);
      } catch (err) {
        showToast(t('importInvalidFile', currentSettings.language), 'error');
      }
    });
  }

  // Toggle inline add folder box
  btnToggleAddFolder?.addEventListener('click', () => {
    if (!folderAddBox) return;
    const isHidden = folderAddBox.style.display === 'none';
    folderAddBox.style.display = isHidden ? 'flex' : 'none';
    if (isHidden && inputNewFolderName) {
      inputNewFolderName.value = '';
      inputNewFolderName.focus();
    }
  });

  btnCancelAddFolder?.addEventListener('click', () => {
    if (folderAddBox) folderAddBox.style.display = 'none';
  });

  async function handleCreateFolder() {
    const name = inputNewFolderName?.value.trim() || '';
    if (!name) return;
    videoFolders = await createVideoFolder(name);
    if (inputNewFolderName) inputNewFolderName.value = '';
    if (folderAddBox) folderAddBox.style.display = 'none';
    const newFolder = videoFolders[videoFolders.length - 1];
    currentFolderId = newFolder?.id || 'all';
    renderFolderNav();
    renderUploads();
    showToast(t('folderAdded', currentSettings.language), 'success');

    if (newFolder) {
      setTimeout(() => {
        const newChip = folderChipsList?.querySelector(`[data-folder-id="${newFolder.id}"]`);
        if (newChip) {
          newChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
        updateFolderScrollArrows();
      }, 60);
    }
  }

  btnConfirmAddFolder?.addEventListener('click', handleCreateFolder);
  inputNewFolderName?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateFolder();
    } else if (e.key === 'Escape') {
      if (folderAddBox) folderAddBox.style.display = 'none';
    }
  });

  // Folder scroll navigation buttons
  btnFolderScrollRight?.addEventListener('click', () => {
    folderChipsList?.scrollBy({ left: 140, behavior: 'smooth' });
  });

  btnFolderScrollLeft?.addEventListener('click', () => {
    folderChipsList?.scrollBy({ left: -140, behavior: 'smooth' });
  });

  // Folder chips mouse drag-to-scroll & wheel support
  if (folderChipsList) {
    folderChipsList.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('.folder-delete-btn')) return;
      isFolderMouseDown = true;
      isFolderDragging = false;
      folderStartX = e.pageX;
      folderStartScrollLeft = folderChipsList.scrollLeft;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isFolderMouseDown || !folderChipsList) return;
      const deltaX = e.pageX - folderStartX;
      if (Math.abs(deltaX) > 4) {
        if (!isFolderDragging) {
          isFolderDragging = true;
          folderChipsList.classList.add('is-dragging');
        }
        folderChipsList.scrollLeft = folderStartScrollLeft - deltaX;
        updateFolderScrollArrows();
      }
    });

    window.addEventListener('mouseup', () => {
      if (isFolderMouseDown) {
        isFolderMouseDown = false;
        folderChipsList?.classList.remove('is-dragging');
        if (isFolderDragging) {
          setTimeout(() => {
            isFolderDragging = false;
          }, 50);
        }
      }
    });

    folderChipsList.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        const isRtl = document.documentElement.dir === 'rtl' || document.body.dir === 'rtl';
        folderChipsList.scrollBy({
          left: isRtl ? -e.deltaY : e.deltaY,
          behavior: 'auto',
        });
        updateFolderScrollArrows();
      }
    }, { passive: false });

    folderChipsList.addEventListener('scroll', () => {
      updateFolderScrollArrows();
    });

    window.addEventListener('resize', () => {
      updateFolderScrollArrows();
    });
  }

  // Select all videos checkbox
  chkSelectAllVideos?.addEventListener('change', () => {
    const visibleVideos = getVisibleVideos();
    if (chkSelectAllVideos.checked) {
      for (const v of visibleVideos) {
        selectedVideoIds.add(v.videoId);
      }
    } else {
      for (const v of visibleVideos) {
        selectedVideoIds.delete(v.videoId);
      }
    }
    renderUploads();
  });

  // Open selected videos in browser
  btnOpenSelectedVideos?.addEventListener('click', async () => {
    const lang = currentSettings.language;
    const visibleVideos = getVisibleVideos();
    let targetVideos: NewUploadVideo[] = [];

    if (selectedVideoIds.size > 0) {
      targetVideos = newUploads.filter((v) => selectedVideoIds.has(v.videoId));
    } else if (visibleVideos.length > 0) {
      // If none specifically selected with checkboxes, open all visible videos
      targetVideos = visibleVideos;
    }

    if (targetVideos.length === 0) {
      showToast(t('noVideosSelected', lang), 'error');
      return;
    }

    for (const vid of targetVideos) {
      if (vid.url) {
        await browser.tabs.create({ url: vid.url });
      }
    }

    showToast(t('openedVideosInBrowser', lang, { count: targetVideos.length }), 'success');
  });

  // Developer contact links
  linkDevEmail?.addEventListener('click', (e) => {
    e.preventDefault();
    browser.tabs.create({ url: 'mailto:Hossam.Majrashi@gmail.com' });
  });

  linkDevWebsite?.addEventListener('click', (e) => {
    e.preventDefault();
    browser.tabs.create({ url: 'https://hossam-majrashi.github.io/Works/' });
  });

  // Listen to background or storage updates while popup is open
  browser.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local') {
      if (changes.approvedChannels) {
        const newVal = changes.approvedChannels.newValue;
        approvedChannels = Array.isArray(newVal) ? (newVal as ApprovedChannel[]) : [];
        renderChannels();
        renderCurrentChannelCard();
      }
      if (changes.newUploads) {
        const newVal = changes.newUploads.newValue;
        newUploads = Array.isArray(newVal) ? (newVal as NewUploadVideo[]) : [];
        renderUploads();
      }
      if (changes.videoFolders) {
        const newVal = changes.videoFolders.newValue;
        videoFolders = Array.isArray(newVal) ? (newVal as VideoFolder[]) : [];
        renderFolderNav();
        renderUploads();
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
