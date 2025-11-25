import { parse } from 'hls-parser';
import { M3U8Info, M3U8Variant } from './types';

/**
 * Master Playlist 타입 가드
 */
interface MasterPlaylist {
  isMasterPlaylist: true;
  variants?: Array<{
    uri: string;
    bandwidth?: number;
    resolution?: { width: number; height: number };
    codecs?: string[];
    audio?: string;
  }>;
}

/**
 * Media Playlist 타입 가드
 */
interface MediaPlaylist {
  isMasterPlaylist: false;
  segments?: Array<{
    uri: string;
  }>;
}

/**
 * m3u8 파일을 파싱하고 오디오 트랙 정보를 추출합니다.
 */
export class M3U8AudioParser {
  /**
   * m3u8 파일을 다운로드하고 파싱합니다.
   */
  async parseM3U8(m3u8Url: string): Promise<M3U8Info> {
    try {
      const response = await fetch(m3u8Url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const manifestText = await response.text();
      const manifest = parse(manifestText) as MasterPlaylist | MediaPlaylist;

      // Master Playlist인 경우
      if (manifest.isMasterPlaylist) {
        const masterPlaylist = manifest as any; // hls-parser 타입이 정확하지 않음
        if (masterPlaylist.variants && masterPlaylist.variants.length > 0) {
          const variants: M3U8Variant[] = masterPlaylist.variants.map((variant: any) => {
            // codecs가 배열인지 문자열인지 확인
            let codecsStr: string | undefined;
            if (variant.codecs) {
              if (Array.isArray(variant.codecs)) {
                codecsStr = variant.codecs.join(',');
              } else if (typeof variant.codecs === 'string') {
                codecsStr = variant.codecs;
              }
            }

            return {
              uri: this.resolveUrl(m3u8Url, variant.uri),
              bandwidth: variant.bandwidth,
              resolution: variant.resolution ? 
                (typeof variant.resolution === 'string' ? variant.resolution : 
                 `${variant.resolution.width}x${variant.resolution.height}`) : 
                undefined,
              codecs: codecsStr,
              audioGroup: variant.audio
            };
          });

          // 오디오 전용 또는 오디오 그룹이 있는 variant 찾기
          const audioVariant = variants.find(v => 
            v.codecs?.includes('audio') || 
            v.audioGroup || 
            !v.resolution // 해상도가 없으면 오디오 전용일 가능성
          );

          if (audioVariant) {
            // 오디오 variant의 m3u8을 재귀적으로 파싱
            return this.parseM3U8(audioVariant.uri);
          }

          // 오디오 variant가 없으면 첫 번째 variant 사용
          return this.parseM3U8(variants[0].uri);
        }
      }

      // Media Playlist인 경우
      const mediaPlaylist = manifest as MediaPlaylist;
      const segments = mediaPlaylist.segments?.map((segment) => 
        this.resolveUrl(m3u8Url, segment.uri)
      ) || [];

      return {
        url: m3u8Url,
        segments,
        isMasterPlaylist: false
      };
    } catch (error) {
      console.error('Error parsing m3u8:', error);
      throw error;
    }
  }

  /**
   * 상대 URL을 절대 URL로 변환합니다.
   */
  private resolveUrl(baseUrl: string, relativeUrl: string): string {
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
      return relativeUrl;
    }

    const base = new URL(baseUrl);
    if (relativeUrl.startsWith('/')) {
      return `${base.origin}${relativeUrl}`;
    }

    const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/'));
    return `${base.origin}${basePath}/${relativeUrl}`;
  }

  /**
   * 세그먼트 URL 목록을 반환합니다.
   */
  getAudioSegments(m3u8Info: M3U8Info): string[] {
    return m3u8Info.segments;
  }
}

