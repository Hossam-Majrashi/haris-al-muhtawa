import type { ApprovedChannel, AppSettings, NewUploadVideo, VideoFolder, BlockedChannel } from './types';
import { getBrowserLanguage } from './i18n';
import { isValidChannelAvatar } from './youtube';

const STORAGE_KEYS = {
  APPROVED_CHANNELS: 'approvedChannels',
  SETTINGS: 'settings',
  NEW_UPLOADS: 'newUploads',
  VIDEO_FOLDERS: 'videoFolders',
  BLOCKED_CHANNELS: 'blockedChannels',
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  pollIntervalMinutes: 30,
  language: getBrowserLanguage(),
  hasSeenOnboarding: false,
  hideShorts: true,
  disableTitleTranslation: true,
};

/**
 * Normalizes a channel handle for consistent matching (e.g., "@User" -> "user").
 */
export function normalizeHandle(handle: string): string {
  if (!handle) return '';
  return handle.trim().replace(/^@/, '').toLowerCase();
}

/**
 * Retrieve the list of approved channels from browser.storage.local.
 */
export async function getApprovedChannels(): Promise<ApprovedChannel[]> {
  try {
    const data = await browser.storage.local.get(STORAGE_KEYS.APPROVED_CHANNELS);
    const channels = data[STORAGE_KEYS.APPROVED_CHANNELS];
    return Array.isArray(channels) ? channels : [];
  } catch (err) {
    console.error('[Haris] Failed to get approved channels:', err);
    return [];
  }
}

/**
 * Save the entire list of approved channels.
 */
export async function saveApprovedChannels(channels: ApprovedChannel[]): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEYS.APPROVED_CHANNELS]: channels,
  });
}

/**
 * Check if a channel (by ID or handle) is in the approved list.
 */
export function isChannelApproved(
  identifier: string,
  channels: ApprovedChannel[]
): boolean {
  if (!identifier) return false;
  const cleanId = identifier.trim();
  const normalized = normalizeHandle(cleanId);

  return channels.some((ch) => {
    if (ch.id && ch.id === cleanId) return true;
    if (ch.handle) {
      const chNorm = normalizeHandle(ch.handle);
      if (chNorm && chNorm === normalized) return true;
    }
    return false;
  });
}

/**
 * Check if a video (by video ID) is in the approved videos list.
 */
export function isVideoApproved(videoId: string, videos: NewUploadVideo[]): boolean {
  if (!videoId) return false;
  return videos.some((v) => v.videoId === videoId);
}

/**
 * Add an approved video to storage.
 */
export async function addApprovedVideo(video: NewUploadVideo): Promise<NewUploadVideo[]> {
  return await recordVideoUpload(video);
}

/**
 * Add an approved channel to storage.
 */
export async function addApprovedChannel(
  channel: Omit<ApprovedChannel, 'addedAt'> & { addedAt?: number }
): Promise<ApprovedChannel[]> {
  const current = await getApprovedChannels();
  const normalizedHandle = normalizeHandle(channel.handle);

  const existsIndex = current.findIndex((ch) => {
    if (channel.id && ch.id && ch.id === channel.id) return true;
    if (normalizedHandle && ch.handle && normalizeHandle(ch.handle) === normalizedHandle) return true;
    return false;
  });

  const existingItem = existsIndex >= 0 ? current[existsIndex] : undefined;

  const rawName = channel.name?.trim() || '';
  const cleanName = (rawName && !rawName.startsWith('@'))
    ? rawName
    : (rawName.replace(/^@/, '') || channel.handle?.replace(/^@/, '') || channel.id || 'Channel');

  const cleanAvatar = isValidChannelAvatar(channel.avatarUrl)
    ? channel.avatarUrl
    : (isValidChannelAvatar(existingItem?.avatarUrl) ? existingItem?.avatarUrl : undefined);

  const formattedHandle = channel.handle
    ? (channel.handle.startsWith('@') ? channel.handle : `@${channel.handle}`)
    : (existingItem?.handle || '');

  const entry: ApprovedChannel = {
    id: channel.id || existingItem?.id || '',
    handle: formattedHandle,
    name: cleanName !== 'Channel' ? cleanName : (existingItem?.name || cleanName),
    avatarUrl: cleanAvatar,
    addedAt: channel.addedAt || existingItem?.addedAt || Date.now(),
    lastKnownVideoId: channel.lastKnownVideoId || existingItem?.lastKnownVideoId,
  };

  let updated: ApprovedChannel[];
  if (existingItem) {
    // Update existing
    updated = [...current];
    updated[existsIndex] = entry;
  } else {
    updated = [entry, ...current];
  }

  await saveApprovedChannels(updated);
  return updated;
}

/**
 * Remove an approved channel by ID or handle.
 */
export async function removeApprovedChannel(identifier: string): Promise<ApprovedChannel[]> {
  const current = await getApprovedChannels();
  const cleanId = identifier.trim();
  const normalized = normalizeHandle(cleanId);

  const filtered = current.filter((ch) => {
    if (ch.id && ch.id === cleanId) return false;
    if (ch.handle && normalizeHandle(ch.handle) === normalized) return false;
    return true;
  });

  await saveApprovedChannels(filtered);
  return filtered;
}

/**
 * Retrieve the list of blocked channels from browser.storage.local.
 */
export async function getBlockedChannels(): Promise<BlockedChannel[]> {
  try {
    const data = await browser.storage.local.get(STORAGE_KEYS.BLOCKED_CHANNELS);
    const channels = data[STORAGE_KEYS.BLOCKED_CHANNELS];
    return Array.isArray(channels) ? channels : [];
  } catch (err) {
    console.error('[Haris] Failed to get blocked channels:', err);
    return [];
  }
}

/**
 * Save the entire list of blocked channels.
 */
export async function saveBlockedChannels(channels: BlockedChannel[]): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEYS.BLOCKED_CHANNELS]: channels,
  });
}

/**
 * Check if a channel (by ID, handle, or name) is in the blocked list.
 */
export function isChannelBlocked(
  identifier: string,
  channels: BlockedChannel[]
): boolean {
  if (!identifier) return false;
  const cleanId = identifier.trim();
  const normalized = normalizeHandle(cleanId);

  return channels.some((ch) => {
    if (ch.id && ch.id === cleanId) return true;
    if (ch.handle) {
      const chNorm = normalizeHandle(ch.handle);
      if (chNorm && chNorm === normalized) return true;
    }
    if (ch.name && ch.name.toLowerCase() === cleanId.toLowerCase()) return true;
    return false;
  });
}

/**
 * Add a blocked channel to storage.
 */
export async function addBlockedChannel(
  channel: Omit<BlockedChannel, 'blockedAt'> & { blockedAt?: number }
): Promise<BlockedChannel[]> {
  const current = await getBlockedChannels();
  const normalizedHandle = normalizeHandle(channel.handle);

  const existsIndex = current.findIndex((ch) => {
    if (channel.id && ch.id && ch.id === channel.id) return true;
    if (normalizedHandle && ch.handle && normalizeHandle(ch.handle) === normalizedHandle) return true;
    return false;
  });

  const existingItem = existsIndex >= 0 ? current[existsIndex] : undefined;

  const rawName = channel.name?.trim() || '';
  const cleanName = (rawName && !rawName.startsWith('@'))
    ? rawName
    : (rawName.replace(/^@/, '') || channel.handle?.replace(/^@/, '') || channel.id || 'Channel');

  const cleanAvatar = isValidChannelAvatar(channel.avatarUrl)
    ? channel.avatarUrl
    : (isValidChannelAvatar(existingItem?.avatarUrl) ? existingItem?.avatarUrl : undefined);

  const formattedHandle = channel.handle
    ? (channel.handle.startsWith('@') ? channel.handle : `@${channel.handle}`)
    : (existingItem?.handle || '');

  const entry: BlockedChannel = {
    id: channel.id || existingItem?.id || '',
    handle: formattedHandle,
    name: cleanName !== 'Channel' ? cleanName : (existingItem?.name || cleanName),
    avatarUrl: cleanAvatar,
    blockedAt: channel.blockedAt || existingItem?.blockedAt || Date.now(),
  };

  let updated: BlockedChannel[];
  if (existingItem) {
    updated = [...current];
    updated[existsIndex] = entry;
  } else {
    updated = [entry, ...current];
  }

  await saveBlockedChannels(updated);
  return updated;
}

/**
 * Remove a blocked channel by ID or handle.
 */
export async function removeBlockedChannel(identifier: string): Promise<BlockedChannel[]> {
  const current = await getBlockedChannels();
  const cleanId = identifier.trim();
  const normalized = normalizeHandle(cleanId);

  const filtered = current.filter((ch) => {
    if (ch.id && ch.id === cleanId) return false;
    if (ch.handle && normalizeHandle(ch.handle) === normalized) return false;
    if (ch.name && ch.name.toLowerCase() === cleanId.toLowerCase()) return false;
    return true;
  });

  await saveBlockedChannels(filtered);
  return filtered;
}

/**
 * Retrieve user settings.
 */
export async function getSettings(): Promise<AppSettings> {
  try {
    const data = await browser.storage.local.get(STORAGE_KEYS.SETTINGS);
    const settings = data[STORAGE_KEYS.SETTINGS];
    return {
      ...DEFAULT_SETTINGS,
      ...(settings || {}),
    };
  } catch (err) {
    console.error('[Haris] Failed to get settings:', err);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save user settings.
 */
export async function saveSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const updated: AppSettings = {
    ...current,
    ...partial,
  };
  await browser.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
  return updated;
}

/**
 * Retrieve stored new uploads.
 */
export async function getNewUploads(): Promise<NewUploadVideo[]> {
  try {
    const data = await browser.storage.local.get(STORAGE_KEYS.NEW_UPLOADS);
    const uploads = data[STORAGE_KEYS.NEW_UPLOADS];
    return Array.isArray(uploads) ? uploads : [];
  } catch (err) {
    console.error('[Haris] Failed to get new uploads:', err);
    return [];
  }
}

/**
 * Save new uploads list.
 */
export async function saveNewUploads(videos: NewUploadVideo[]): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.NEW_UPLOADS]: videos });
  await updateBadgeCount(videos.filter((v) => !v.isRead).length);
}

/**
 * Record a video into the uploads/recent videos list.
 * Prepends the video to the list, prevents duplicates, and caps at 150 items.
 */
export async function recordVideoUpload(video: NewUploadVideo): Promise<NewUploadVideo[]> {
  if (!video || !video.videoId) return await getNewUploads();
  const current = await getNewUploads();
  const existingIndex = current.findIndex((v) => v.videoId === video.videoId);

  let updated: NewUploadVideo[];
  if (existingIndex >= 0 && current[existingIndex]) {
    const existing = current[existingIndex];
    const merged: NewUploadVideo = {
      videoId: existing.videoId,
      channelId: video.channelId || existing.channelId,
      publishedAt: video.publishedAt || existing.publishedAt,
      isRead: existing.isRead,
      title: video.title && video.title !== 'Video' ? video.title : existing.title,
      channelName: video.channelName && video.channelName !== 'YouTube' ? video.channelName : existing.channelName,
      thumbnail: video.thumbnail || existing.thumbnail,
      url: video.url || existing.url,
      folderId: existing.folderId || video.folderId,
    };
    updated = [merged, ...current.filter((_, i) => i !== existingIndex)].slice(0, 150);
  } else {
    updated = [video, ...current].slice(0, 150);
  }

  await saveNewUploads(updated);
  return updated;
}

/**
 * Remove a video from the new uploads / recent videos list by videoId.
 */
export async function removeNewUploadVideo(videoId: string): Promise<NewUploadVideo[]> {
  const current = await getNewUploads();
  const filtered = current.filter((v) => v.videoId !== videoId);
  await saveNewUploads(filtered);
  return filtered;
}

/**
 * Retrieve all video folders from storage.
 */
export async function getVideoFolders(): Promise<VideoFolder[]> {
  try {
    const data = await browser.storage.local.get(STORAGE_KEYS.VIDEO_FOLDERS);
    const folders = data[STORAGE_KEYS.VIDEO_FOLDERS];
    return Array.isArray(folders) ? folders : [];
  } catch (err) {
    console.error('[Haris] Failed to get video folders:', err);
    return [];
  }
}

/**
 * Save video folders to storage.
 */
export async function saveVideoFolders(folders: VideoFolder[]): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.VIDEO_FOLDERS]: folders });
}

/**
 * Create a new video folder.
 */
export async function createVideoFolder(name: string): Promise<VideoFolder[]> {
  const trimmed = name.trim();
  if (!trimmed) return await getVideoFolders();
  const current = await getVideoFolders();
  const newFolder: VideoFolder = {
    id: `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: trimmed,
    createdAt: Date.now(),
  };
  const updated = [...current, newFolder];
  await saveVideoFolders(updated);
  return updated;
}

/**
 * Delete a video folder and clear folderId on associated videos.
 */
export async function deleteVideoFolder(folderId: string): Promise<VideoFolder[]> {
  const folders = await getVideoFolders();
  const updatedFolders = folders.filter((f) => f.id !== folderId);
  await saveVideoFolders(updatedFolders);

  // Clear folderId on videos that belonged to this folder
  const videos = await getNewUploads();
  const hasVideos = videos.some((v) => v.folderId === folderId);
  if (hasVideos) {
    const updatedVideos = videos.map((v) =>
      v.folderId === folderId ? { ...v, folderId: undefined } : v
    );
    await saveNewUploads(updatedVideos);
  }

  return updatedFolders;
}

/**
 * Move/assign a video to a specific folder (or undefined for uncategorized).
 */
export async function moveVideoToFolder(
  videoId: string,
  folderId?: string
): Promise<NewUploadVideo[]> {
  const current = await getNewUploads();
  const updated = current.map((v) => {
    if (v.videoId === videoId) {
      return { ...v, folderId: folderId || undefined };
    }
    return v;
  });
  await saveNewUploads(updated);
  return updated;
}

/**
 * Mark all new uploads as read and clear the badge.
 */
export async function markAllUploadsAsRead(): Promise<void> {
  const current = await getNewUploads();
  const updated = current.map((v) => ({ ...v, isRead: true }));
  await browser.storage.local.set({ [STORAGE_KEYS.NEW_UPLOADS]: updated });
  await updateBadgeCount(0);
}

/**
 * Update the extension icon badge text with the count of unread uploads.
 */
export async function updateBadgeCount(unreadCount?: number): Promise<void> {
  try {
    let count = unreadCount;
    if (typeof count !== 'number') {
      const uploads = await getNewUploads();
      count = uploads.filter((v) => !v.isRead).length;
    }

    if (count > 0) {
      const text = count > 99 ? '99+' : String(count);
      await browser.action.setBadgeText({ text });
      await browser.action.setBadgeBackgroundColor({ color: '#16a34a' }); // emerald green
    } else {
      await browser.action.setBadgeText({ text: '' });
    }
  } catch (err) {
    console.error('[Haris] Failed to update badge:', err);
  }
}

/**
 * Export approved channels, videos, and settings to a JSON backup string.
 */
export async function exportApprovedChannelsJSON(): Promise<string> {
  const channels = await getApprovedChannels();
  const blockedChannels = await getBlockedChannels();
  const uploads = await getNewUploads();
  const folders = await getVideoFolders();
  const settings = await getSettings();

  const backupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    channels,
    approvedChannels: channels,
    blockedChannels,
    uploads,
    newUploads: uploads,
    videos: uploads,
    folders,
    videoFolders: folders,
    settings,
  };

  return JSON.stringify(backupData, null, 2);
}

/**
 * Import and validate backup data from a JSON string.
 * Supports both full-backup format (channels + uploads), storage dumps, and legacy array-only formats.
 * Merges with existing data without duplicates.
 */
export async function importApprovedChannelsJSON(
  jsonString: string
): Promise<{ importedCount: number; importedUploadsCount: number; importedBlockedCount?: number; totalCount: number }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON format');
  }

  let rawChannels: unknown[] = [];
  let rawBlockedChannels: unknown[] = [];
  let rawUploads: unknown[] = [];
  let rawFolders: unknown[] = [];

  if (Array.isArray(parsed)) {
    // Array format: might be an array of channels, an array of videos, or mixed items
    for (const item of parsed) {
      if (typeof item === 'object' && item !== null) {
        const anyItem = item as Record<string, unknown>;
        if (
          anyItem.videoId ||
          anyItem.video_id ||
          (typeof anyItem.url === 'string' && anyItem.url.includes('watch?v='))
        ) {
          rawUploads.push(anyItem);
        } else if (anyItem.blockedAt || anyItem.isBlocked || anyItem.blocked) {
          rawBlockedChannels.push(anyItem);
        } else {
          rawChannels.push(anyItem);
        }
      }
    }
  } else if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;

    // Channels array candidate keys (prioritize non-empty array)
    if (Array.isArray(obj.channels) && obj.channels.length > 0) {
      rawChannels = obj.channels;
    } else if (Array.isArray(obj.approvedChannels) && obj.approvedChannels.length > 0) {
      rawChannels = obj.approvedChannels;
    } else if (Array.isArray(obj.approved_channels) && obj.approved_channels.length > 0) {
      rawChannels = obj.approved_channels;
    } else if (Array.isArray(obj.channels)) {
      rawChannels = obj.channels;
    } else if (Array.isArray(obj.approvedChannels)) {
      rawChannels = obj.approvedChannels;
    }

    // Blocked Channels array candidate keys
    if (Array.isArray(obj.blockedChannels) && obj.blockedChannels.length > 0) {
      rawBlockedChannels = obj.blockedChannels;
    } else if (Array.isArray(obj.blocked_channels) && obj.blocked_channels.length > 0) {
      rawBlockedChannels = obj.blocked_channels;
    } else if (Array.isArray(obj.blocked) && obj.blocked.length > 0) {
      rawBlockedChannels = obj.blocked;
    } else if (Array.isArray(obj.blockedChannels)) {
      rawBlockedChannels = obj.blockedChannels;
    } else if (Array.isArray(obj.blocked_channels)) {
      rawBlockedChannels = obj.blocked_channels;
    } else if (Array.isArray(obj.blocked)) {
      rawBlockedChannels = obj.blocked;
    }

    // Uploads/Videos array candidate keys (prioritize non-empty array)
    if (Array.isArray(obj.uploads) && obj.uploads.length > 0) {
      rawUploads = obj.uploads;
    } else if (Array.isArray(obj.newUploads) && obj.newUploads.length > 0) {
      rawUploads = obj.newUploads;
    } else if (Array.isArray(obj.videos) && obj.videos.length > 0) {
      rawUploads = obj.videos;
    } else if (Array.isArray(obj.approvedVideos) && obj.approvedVideos.length > 0) {
      rawUploads = obj.approvedVideos;
    } else if (Array.isArray(obj.approved_videos) && obj.approved_videos.length > 0) {
      rawUploads = obj.approved_videos;
    } else if (Array.isArray(obj.new_uploads) && obj.new_uploads.length > 0) {
      rawUploads = obj.new_uploads;
    } else if (Array.isArray(obj.uploads)) {
      rawUploads = obj.uploads;
    } else if (Array.isArray(obj.newUploads)) {
      rawUploads = obj.newUploads;
    } else if (Array.isArray(obj.videos)) {
      rawUploads = obj.videos;
    }

    if (Array.isArray(obj.folders) && obj.folders.length > 0) {
      rawFolders = obj.folders;
    } else if (Array.isArray(obj.videoFolders) && obj.videoFolders.length > 0) {
      rawFolders = obj.videoFolders;
    } else if (Array.isArray(obj.folders)) {
      rawFolders = obj.folders;
    } else if (Array.isArray(obj.videoFolders)) {
      rawFolders = obj.videoFolders;
    }

    if (obj.settings && typeof obj.settings === 'object') {
      await saveSettings(obj.settings as Partial<AppSettings>);
    }
  } else {
    throw new Error('Expected an array of channels or a backup object');
  }

  // 1. Process Channels
  const validChannels: ApprovedChannel[] = [];
  for (const item of rawChannels) {
    if (typeof item === 'object' && item !== null) {
      const anyItem = item as Record<string, unknown>;
      const id = String(anyItem.id || anyItem.channelId || anyItem.channel_id || '').trim();
      const rawHandle = String(
        anyItem.handle || anyItem.channelHandle || anyItem.channel_handle || ''
      ).trim();
      const handle = rawHandle ? (rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`) : '';
      const rawName = String(
        anyItem.name ||
          anyItem.title ||
          anyItem.channelTitle ||
          anyItem.channel_name ||
          handle ||
          id ||
          'Channel'
      ).trim();
      const name = rawName.startsWith('@') ? rawName.substring(1) : rawName;
      const addedAt = typeof anyItem.addedAt === 'number' ? anyItem.addedAt : Date.now();
      const lastKnownVideoId =
        typeof anyItem.lastKnownVideoId === 'string'
          ? anyItem.lastKnownVideoId
          : typeof anyItem.latestVideoId === 'string'
          ? anyItem.latestVideoId
          : undefined;

      const rawAvatar =
        anyItem.avatarUrl || anyItem.avatar || anyItem.thumbnail || anyItem.thumbnailUrl;
      const avatarUrl =
        typeof rawAvatar === 'string' && isValidChannelAvatar(rawAvatar)
          ? rawAvatar.trim()
          : undefined;

      if (id || handle || (name && name !== 'Channel')) {
        validChannels.push({ id, handle, name, avatarUrl, addedAt, lastKnownVideoId });
      }
    }
  }

  const existingChannels = await getApprovedChannels();
  const mergedMap = new Map<string, ApprovedChannel>();

  for (const ch of existingChannels) {
    const key = ch.id || (ch.handle ? normalizeHandle(ch.handle) : '') || ch.name.toLowerCase();
    if (key) mergedMap.set(key, ch);
  }

  let addedNewChannels = 0;
  for (const ch of validChannels) {
    const key = ch.id || (ch.handle ? normalizeHandle(ch.handle) : '') || ch.name.toLowerCase();
    if (key) {
      if (!mergedMap.has(key)) {
        addedNewChannels++;
      }
      const current = mergedMap.get(key);
      mergedMap.set(key, {
        id: ch.id || current?.id || '',
        handle: ch.handle || current?.handle || '',
        name: ch.name && ch.name !== 'Channel' ? ch.name : current?.name || ch.name,
        avatarUrl: ch.avatarUrl || current?.avatarUrl,
        addedAt: current?.addedAt || ch.addedAt,
        lastKnownVideoId: ch.lastKnownVideoId || current?.lastKnownVideoId,
      });
    }
  }

  const mergedChannels = Array.from(mergedMap.values());
  await saveApprovedChannels(mergedChannels);

  // 2. Process Videos (Uploads)
  let addedNewUploads = 0;
  let validUploadsCount = 0;
  if (rawUploads.length > 0) {
    const existingUploads = await getNewUploads();
    const existingVidMap = new Map<string, NewUploadVideo>();
    for (const v of existingUploads) {
      if (v.videoId) existingVidMap.set(v.videoId, v);
    }

    const validUploads: NewUploadVideo[] = [];
    for (const item of rawUploads) {
      if (typeof item === 'object' && item !== null) {
        const anyItem = item as Record<string, unknown>;
        let videoId = String(
          anyItem.videoId || anyItem.id || anyItem.video_id || ''
        ).trim();
        const rawUrl = String(anyItem.url || anyItem.link || '').trim();

        if (!videoId && rawUrl) {
          const match = rawUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
          if (match?.[1]) {
            videoId = match[1];
          }
        }

        if (videoId) {
          const title = String(anyItem.title || anyItem.videoTitle || 'Video').trim();
          const channelId = String(anyItem.channelId || anyItem.channel_id || '').trim();
          const channelName = String(
            anyItem.channelName || anyItem.channelTitle || 'YouTube'
          ).trim();
          const publishedAt = String(
            anyItem.publishedAt || anyItem.published_at || new Date().toISOString()
          );
          const url = rawUrl || `https://www.youtube.com/watch?v=${videoId}`;
          const thumbnail = String(
            anyItem.thumbnail ||
              anyItem.thumbnailUrl ||
              `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
          );
          const isRead = Boolean(anyItem.isRead);
          const rawFolderId = typeof anyItem.folderId === 'string' ? anyItem.folderId.trim() : undefined;
          const folderId = rawFolderId || existingVidMap.get(videoId)?.folderId;

          if (!existingVidMap.has(videoId)) {
            addedNewUploads++;
          }
          validUploads.push({
            videoId,
            title,
            channelId,
            channelName,
            publishedAt,
            url,
            thumbnail,
            isRead,
            folderId: folderId || undefined,
          });
        }
      }
    }

    validUploadsCount = validUploads.length;
    const combinedMap = new Map<string, NewUploadVideo>();
    for (const v of validUploads) {
      combinedMap.set(v.videoId, v);
    }
    for (const v of existingUploads) {
      if (!combinedMap.has(v.videoId)) {
        combinedMap.set(v.videoId, v);
      }
    }
    const mergedUploads = Array.from(combinedMap.values()).slice(0, 150);
    await saveNewUploads(mergedUploads);
  }

  // 3. Process Folders
  if (rawFolders.length > 0) {
    const existingFolders = await getVideoFolders();
    const folderMap = new Map<string, VideoFolder>();
    for (const f of existingFolders) {
      folderMap.set(f.id, f);
    }
    for (const item of rawFolders) {
      if (typeof item === 'object' && item !== null) {
        const anyItem = item as Record<string, unknown>;
        const id = String(anyItem.id || '').trim();
        const name = String(anyItem.name || '').trim();
        const createdAt = typeof anyItem.createdAt === 'number' ? anyItem.createdAt : Date.now();
        if (id && name) {
          folderMap.set(id, { id, name, createdAt });
        }
      }
    }
    await saveVideoFolders(Array.from(folderMap.values()));
  }

  // 4. Process Blocked Channels
  let addedBlockedCount = 0;
  if (rawBlockedChannels.length > 0) {
    const existingBlocked = await getBlockedChannels();
    const blockedMap = new Map<string, BlockedChannel>();
    for (const b of existingBlocked) {
      const key = b.id || (b.handle ? normalizeHandle(b.handle) : '') || b.name.toLowerCase();
      if (key) blockedMap.set(key, b);
    }
    for (const item of rawBlockedChannels) {
      if (typeof item === 'object' && item !== null) {
        const anyItem = item as Record<string, unknown>;
        const id = String(anyItem.id || anyItem.channelId || anyItem.channel_id || '').trim();
        const rawHandle = String(anyItem.handle || anyItem.channelHandle || '').trim();
        const handle = rawHandle ? (rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`) : '';
        const name = String(anyItem.name || anyItem.title || handle || id || 'Blocked Channel').trim();
        const rawAvatar = anyItem.avatarUrl || anyItem.avatar || anyItem.thumbnail;
        const avatarUrl = typeof rawAvatar === 'string' && isValidChannelAvatar(rawAvatar) ? rawAvatar.trim() : undefined;
        const blockedAt = typeof anyItem.blockedAt === 'number' ? anyItem.blockedAt : Date.now();

        const key = id || (handle ? normalizeHandle(handle) : '') || name.toLowerCase();
        if (key) {
          if (!blockedMap.has(key)) {
            addedBlockedCount++;
          }
          blockedMap.set(key, { id, handle, name, avatarUrl, blockedAt });
        }
      }
    }
    await saveBlockedChannels(Array.from(blockedMap.values()));
  }

  return {
    importedCount: addedNewChannels > 0 ? addedNewChannels : validChannels.length,
    importedUploadsCount: addedNewUploads > 0 ? addedNewUploads : validUploadsCount,
    importedBlockedCount: addedBlockedCount,
    totalCount: mergedChannels.length,
  };
}
