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
 * Resolve a YouTube channel handle, URL, ID, or search query to its canonical Channel ID, name, avatar, and handle.
 */
export async function resolveChannelIdFromHandle(
  handle: string
): Promise<{ id?: string; name?: string; avatarUrl?: string; handle?: string }> {
  if (!handle || !handle.trim()) return {};
  const query = handle.trim();

  try {
    let directUrl: string | null = null;
    let fallbackHandle: string | undefined = undefined;

    if (query.startsWith('http://') || query.startsWith('https://')) {
      try {
        const parsed = new URL(query);
        if (parsed.pathname.startsWith('/channel/')) {
          const parts = parsed.pathname.split('/');
          const cId = parts[2]?.split('?')[0];
          if (cId) directUrl = `https://www.youtube.com/channel/${cId}`;
        } else if (parsed.pathname.startsWith('/@')) {
          const h = parsed.pathname.split('/')[1]?.split('?')[0];
          if (h) {
            directUrl = `https://www.youtube.com/${h}`;
            fallbackHandle = h;
          }
        } else {
          directUrl = query;
        }
      } catch {
        directUrl = query;
      }
    } else if (query.startsWith('UC') && query.length >= 20) {
      directUrl = `https://www.youtube.com/channel/${query}`;
    } else if (query.startsWith('@')) {
      directUrl = `https://www.youtube.com/${query}`;
      fallbackHandle = query;
    } else if (!query.includes(' ') && !/[\u0600-\u06FF]/.test(query)) {
      // Single latin word without spaces - likely a handle
      directUrl = `https://www.youtube.com/@${query}`;
      fallbackHandle = `@${query}`;
    }

    const headers = {
      'Accept': 'text/html,application/xhtml+xml',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ar,en;q=0.9',
    };

    if (directUrl) {
      const response = await fetch(directUrl, { headers });
      if (response.ok) {
        const html = await response.text();

        const matchParam = html.match(/channel_id=([a-zA-Z0-9_-]+)/);
        const matchCanonical = html.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/);
        const matchJson =
          html.match(/"externalChannelId":"(UC[a-zA-Z0-9_-]+)"/) ||
          html.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/);
        const id = matchCanonical?.[1] || matchParam?.[1] || matchJson?.[1];

        if (id) {
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

          let avatarUrl: string | undefined;
          const matchLinkImage = html.match(/<link\s+rel="image_src"\s+href="([^"]*)"/i);
          if (matchLinkImage?.[1] && isValidChannelAvatar(matchLinkImage[1])) {
            avatarUrl = matchLinkImage[1].trim();
          }
          if (!avatarUrl) {
            const matchOgImage = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i);
            if (matchOgImage?.[1] && isValidChannelAvatar(matchOgImage[1])) {
              avatarUrl = matchOgImage[1].trim();
            }
          }
          if (!avatarUrl) {
            const matchJsonAvatar = html.match(
              /https:\/\/yt3\.(?:googleusercontent\.com|ggpht\.com)\/[a-zA-Z0-9_-]+[=a-zA-Z0-9_-]*/
            );
            if (matchJsonAvatar?.[0] && isValidChannelAvatar(matchJsonAvatar[0])) {
              avatarUrl = matchJsonAvatar[0];
            }
          }

          const matchBaseUrl = html.match(/"canonicalBaseUrl":"\/(@[^"]+)"/);
          const resolvedHandle =
            matchBaseUrl?.[1] || fallbackHandle || (name ? `@${name.replace(/\s+/g, '')}` : undefined);

          return { id, name, avatarUrl, handle: resolvedHandle };
        }
      }
    }

    // Fallback: search YouTube for channel by name/query
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%253D%253D`;
    const searchRes = await fetch(searchUrl, { headers });
    if (!searchRes.ok) return {};

    const searchHtml = await searchRes.text();

    const rendererMatch = searchHtml.match(
      /"channelRenderer":\{([\s\S]*?)(?:,"descriptionSnippet"|,"videoCountText"|,"subscriptionButton")/
    );
    const rendererText = (rendererMatch && rendererMatch[1]) ? rendererMatch[1] : searchHtml;

    const idMatch =
      rendererText.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/) || searchHtml.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/);
    const id = idMatch?.[1];

    if (!id) return {};

    let name: string | undefined;
    const titleMatch =
      rendererText.match(/"title":\{"simpleText":"([^"]+)"\}/) ||
      rendererText.match(/"title":\{"runs":\[\{"text":"([^"]+)"\}\]\}/);
    if (titleMatch?.[1]) {
      name = decodeXmlEntities(titleMatch[1].trim());
    }

    const handleMatch =
      rendererText.match(/"canonicalBaseUrl":"\/(@[^"]+)"/) || searchHtml.match(/"canonicalBaseUrl":"\/(@[^"]+)"/);
    const resolvedHandle = handleMatch?.[1] || (name ? `@${name.replace(/\s+/g, '')}` : undefined);

    let avatarUrl: string | undefined;
    const avatarMatch = rendererText.match(
      /(?:https:)?\/\/(?:yt3\.googleusercontent\.com|yt3\.ggpht\.com)\/[a-zA-Z0-9_-]+[=a-zA-Z0-9_.-]*/
    );
    if (avatarMatch?.[0]) {
      const fullAvatar = avatarMatch[0].startsWith('//') ? `https:${avatarMatch[0]}` : avatarMatch[0];
      if (isValidChannelAvatar(fullAvatar)) {
        avatarUrl = fullAvatar;
      }
    }

    return { id, name, avatarUrl, handle: resolvedHandle };
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
