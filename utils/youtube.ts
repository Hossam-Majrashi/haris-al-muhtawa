/**
 * YouTube RSS and Channel Resolution utilities.
 * Completely local, no external libraries or API keys required.
 */

export interface ParsedVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  url: string;
  thumbnail: string;
}

/**
 * Decode basic XML/HTML entities
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Parse YouTube Atom RSS XML feed into an array of parsed video entries.
 * Uses safe regex parsing so it works seamlessly in service worker (no DOMParser needed).
 */
export function parseYouTubeRss(xmlText: string): ParsedVideo[] {
  const videos: ParsedVideo[] = [];
  const entryRegex = /<entry[\s\S]*?<\/entry>/gi;
  const entries = xmlText.match(entryRegex) || [];

  for (const entry of entries) {
    const idMatch = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/i);
    const titleMatch = entry.match(/<title>(.*?)<\/title>/i);
    const publishedMatch = entry.match(/<published>(.*?)<\/published>/i);
    const linkMatch = entry.match(/<link[^>]*href="([^"]*)"/i);
    const thumbMatch = entry.match(/<media:thumbnail[^>]*url="([^"]*)"/i);

    const videoId = idMatch?.[1]?.trim() || '';
    if (!videoId) continue;

    const rawTitle = titleMatch?.[1]?.trim() || 'Video';
    const title = decodeXmlEntities(rawTitle);
    const publishedAt = publishedMatch?.[1]?.trim() || '';
    const url = linkMatch?.[1]?.trim() || `https://www.youtube.com/watch?v=${videoId}`;
    const thumbnail = thumbMatch?.[1]?.trim() || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    videos.push({
      videoId,
      title,
      publishedAt,
      url,
      thumbnail,
    });
  }

  return videos;
}

/**
 * Validate that an avatar image URL is a real channel avatar and not the generic YouTube logo.
 */
export function isValidChannelAvatar(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (
    trimmed.includes('yt_1200.png') ||
    trimmed.includes('/img/desktop/') ||
    trimmed.includes('wxt.svg') ||
    trimmed.includes('favicon')
  ) {
    return false;
  }
  return (
    trimmed.includes('googleusercontent.com') ||
    trimmed.includes('ggpht.com') ||
    trimmed.includes('ytimg.com')
  );
}

/**
 * Resolve a YouTube channel handle (e.g. "@Channel" or "Channel") to its canonical "UC..." Channel ID.
 */
export async function resolveChannelIdFromHandle(
  handle: string
): Promise<{ id?: string; name?: string; avatarUrl?: string }> {
  try {
    const formattedHandle = handle.startsWith('@') ? handle : `@${handle}`;
    const url = `https://www.youtube.com/${formattedHandle}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) return {};

    const html = await response.text();

    // 1. Check channel_id=UC...
    const matchParam = html.match(/channel_id=([a-zA-Z0-9_-]+)/);
    // 2. Check og:url or channel link
    const matchCanonical = html.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/);
    // 3. Check JSON externalChannelId or channelId
    const matchJson = html.match(/"externalChannelId":"(UC[a-zA-Z0-9_-]+)"/) ||
      html.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/);

    const id = matchCanonical?.[1] || matchParam?.[1] || matchJson?.[1];

    // Extract title (display name, NOT generic "YouTube" and NOT containing "- YouTube")
    let name: string | undefined;
    const matchOgTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i);
    if (matchOgTitle?.[1]) {
      const clean = decodeXmlEntities(matchOgTitle[1].trim());
      if (clean && clean.toLowerCase() !== 'youtube') {
        name = clean;
      }
    }
    if (!name) {
      const matchTitle = html.match(/<title>([^<]*)<\/title>/i);
      if (matchTitle?.[1]) {
        const clean = decodeXmlEntities(
          matchTitle[1].replace(/^\(\d+\)\s*/, '').replace(/\s*-\s*YouTube$/i, '').trim()
        );
        if (clean && clean.toLowerCase() !== 'youtube') {
          name = clean;
        }
      }
    }

    // Extract real channel avatar (must NOT be the generic YouTube logo)
    let avatarUrl: string | undefined;

    // 1. Try link[rel="image_src"]
    const matchLinkImage = html.match(/<link\s+rel="image_src"\s+href="([^"]*)"/i);
    if (matchLinkImage?.[1] && isValidChannelAvatar(matchLinkImage[1])) {
      avatarUrl = matchLinkImage[1].trim();
    }

    // 2. Try og:image
    if (!avatarUrl) {
      const matchOgImage = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i);
      if (matchOgImage?.[1] && isValidChannelAvatar(matchOgImage[1])) {
        avatarUrl = matchOgImage[1].trim();
      }
    }

    // 3. Try avatarViewModel or googleusercontent URL in page JSON
    if (!avatarUrl) {
      const matchJsonAvatar = html.match(
        /https:\/\/yt3\.(?:googleusercontent\.com|ggpht\.com)\/[a-zA-Z0-9_-]+[=a-zA-Z0-9_-]*/
      );
      if (matchJsonAvatar?.[0] && isValidChannelAvatar(matchJsonAvatar[0])) {
        avatarUrl = matchJsonAvatar[0];
      }
    }

    return { id, name, avatarUrl };
  } catch (err) {
    console.warn('[Haris] Failed to resolve channel handle:', handle, err);
    return {};
  }
}

/**
 * Fetch video uploads for a YouTube channel ID from its public RSS feed.
 */
export async function fetchChannelUploads(channelId: string): Promise<ParsedVideo[]> {
  if (!channelId) return [];

  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  try {
    const res = await fetch(feedUrl, {
      cache: 'no-cache',
    });
    if (!res.ok) {
      console.warn(`[Haris] RSS feed returned status ${res.status} for ${channelId}`);
      return [];
    }

    const xml = await res.text();
    return parseYouTubeRss(xml);
  } catch (err) {
    console.warn(`[Haris] Failed to fetch RSS feed for ${channelId}:`, err);
    return [];
  }
}
