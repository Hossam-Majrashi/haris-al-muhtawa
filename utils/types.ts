export interface ApprovedChannel {
  id: string; // e.g. "UCBR8-60-B28hp2BmDPdntcQ"
  handle: string; // e.g. "@YouTube" or "YouTube"
  name: string; // e.g. "YouTube"
  avatarUrl?: string; // Channel avatar / logo URL
  addedAt: number; // timestamp in milliseconds
  lastKnownVideoId?: string; // most recent video ID seen
}

export interface NewUploadVideo {
  videoId: string;
  title: string;
  channelId: string;
  channelName: string;
  publishedAt: string;
  url: string;
  thumbnail: string;
  isRead?: boolean;
  folderId?: string; // ID of the folder this video belongs to
}

export interface VideoFolder {
  id: string;
  name: string;
  createdAt: number;
}

export interface AppLanguage {
  nativeLanguageName: string;
  code: string;
  isRtl: boolean;
}

export interface BlockedChannel {
  id: string; // e.g. "UCBR8-60-B28hp2BmDPdntcQ"
  handle: string; // e.g. "@YouTube" or "YouTube"
  name: string; // e.g. "YouTube"
  avatarUrl?: string; // Channel avatar / logo URL
  blockedAt: number; // timestamp in milliseconds
}

export interface AppSettings {
  pollIntervalMinutes: number;
  language: string;
  hasSeenOnboarding?: boolean;
  hideShorts?: boolean;
  disableTitleTranslation?: boolean;
}

export interface ChannelInfo {
  id: string;
  handle: string;
  name: string;
  avatarUrl?: string;
}

