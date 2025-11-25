// 브라우저 환경 체크
const isBrowser = typeof window !== 'undefined';

/**
 * soop VOD URL에서 m3u8 링크를 추출합니다.
 * 브라우저와 Node.js 환경 모두에서 동작합니다.
 */
export class SoopExtractor {
  /**
   * soop VOD 페이지에서 m3u8 링크를 추출합니다.
   */
  async extractM3U8FromUrl(vodUrl: string): Promise<string | null> {
    try {
      // URL에서 player ID 추출
      const playerIdMatch = vodUrl.match(/\/player\/(\d+)/);
      if (!playerIdMatch) {
        throw new Error('Invalid soop VOD URL format');
      }

      const playerId = playerIdMatch[1];
      
      // 방법 1: 다양한 API 엔드포인트 시도
      const apiEndpoints = [
        `https://vod.sooplive.co.kr/api/player/${playerId}`,
        `https://vod.sooplive.co.kr/api/vod/${playerId}`,
        `https://api.sooplive.co.kr/vod/${playerId}`,
        `https://vod.sooplive.co.kr/player/api/${playerId}`,
      ];

      for (const apiUrl of apiEndpoints) {
        try {
          const response = await fetch(apiUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': vodUrl,
              'Accept': 'application/json'
            }
          });

          if (!response.ok) continue;

          const data = await response.json();
          const jsonStr = JSON.stringify(data);
          
          // 다양한 패턴으로 m3u8 찾기
          const patterns = [
            /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g,
            /"url"\s*:\s*"([^"]+\.m3u8[^"]*)"/g,
            /"src"\s*:\s*"([^"]+\.m3u8[^"]*)"/g,
            /"source"\s*:\s*"([^"]+\.m3u8[^"]*)"/g,
            /"manifest"\s*:\s*"([^"]+\.m3u8[^"]*)"/g,
            /"hls"\s*:\s*"([^"]+\.m3u8[^"]*)"/g,
            /"playlist"\s*:\s*"([^"]+\.m3u8[^"]*)"/g,
          ];

          for (const pattern of patterns) {
            const matches = jsonStr.match(pattern);
            if (matches && matches.length > 0) {
              let url = matches[0];
              if (pattern.source.includes('(')) {
                const groupMatch = jsonStr.match(pattern);
                if (groupMatch && groupMatch[1]) {
                  url = groupMatch[1];
                }
              } else {
                url = url.replace(/^["']|["']$/g, '');
              }
              
              if (url && url.includes('.m3u8')) {
                return url;
              }
            }
          }
        } catch (apiError) {
          // API 호출 실패는 무시하고 다음 시도
          continue;
        }
      }

      // 방법 2: 페이지 HTML 가져오기 (CORS 문제가 있을 수 있음)
      try {
        const response = await fetch(vodUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const htmlContent = await response.text();

        // Script 태그에서 m3u8 링크 찾기
        const patterns = [
          /https?:\/\/[^"'\s\)\]\}]+\.m3u8[^"'\s\)\]\}]*/g,
          /["']([^"']+\.m3u8[^"']*)["']/g,
          /(?:url|src|source|manifest|hls|playlist|stream|videoUrl|video_url|videoSrc|video_src)\s*[:=]\s*["']([^"']+\.m3u8[^"']*)["']/gi,
          /"(?:url|src|source|manifest|hls|playlist|stream)"\s*:\s*["']([^"']+\.m3u8[^"']*)["']/gi,
        ];

        // 브라우저 환경에서는 DOMParser 사용
        if (isBrowser) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlContent, 'text/html');
          const scripts = Array.from(doc.querySelectorAll('script'));
          
          for (const script of scripts) {
            const scriptContent = script.innerHTML || '';
            
            for (const pattern of patterns) {
              const matches = scriptContent.matchAll(pattern);
              for (const match of matches) {
                let url = match[0];
                if (match.length > 1 && match[1]) {
                  url = match[1];
                } else {
                  url = url.replace(/^["']|["']$/g, '');
                }
                
                try {
                  url = decodeURIComponent(url);
                } catch (e) {
                  // 디코딩 실패는 무시
                }
                
                if (url && url.includes('.m3u8') && (url.startsWith('http://') || url.startsWith('https://'))) {
                  return url;
                }
              }
            }
          }
        } else {
          // Node.js 환경에서는 cheerio 사용 (동적 import)
          const cheerio = await import('cheerio');
          const $ = cheerio.load(htmlContent);
          const scripts = $('script');
          
          for (const script of scripts) {
            const scriptContent = $(script).html() || '';
            
            for (const pattern of patterns) {
              const matches = scriptContent.matchAll(pattern);
              for (const match of matches) {
                let url = match[0];
                if (match.length > 1 && match[1]) {
                  url = match[1];
                } else {
                  url = url.replace(/^["']|["']$/g, '');
                }
                
                try {
                  url = decodeURIComponent(url);
                } catch (e) {
                  // 디코딩 실패는 무시
                }
                
                if (url && url.includes('.m3u8') && (url.startsWith('http://') || url.startsWith('https://'))) {
                  return url;
                }
              }
            }
          }
        }

        // 전체 HTML에서 직접 찾기
        const htmlPatterns = [
          /https?:\/\/[^"'\s<>\]\}]+\.m3u8[^"'\s<>\]\}]*/g,
        ];

        for (const pattern of htmlPatterns) {
          const matches = htmlContent.matchAll(pattern);
          const foundUrls: string[] = [];
          
          for (const match of matches) {
            let url = match[0];
            try {
              url = decodeURIComponent(url);
            } catch (e) {
              // 디코딩 실패는 원본 사용
            }
            
            if (url && url.includes('.m3u8') && (url.startsWith('http://') || url.startsWith('https://'))) {
              foundUrls.push(url);
            }
          }
          
          const uniqueUrls = [...new Set(foundUrls)];
          if (uniqueUrls.length > 0) {
            return uniqueUrls[0];
          }
        }
      } catch (htmlError) {
        // HTML 파싱 실패는 무시 (CORS 문제일 수 있음)
        console.warn('HTML 파싱 실패 (CORS 문제일 수 있음):', htmlError);
      }

      // 방법 3: Player ID 기반으로 m3u8 URL 패턴 추론 시도
      const today = new Date();
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      
      const possiblePatterns = [
        `https://vod-normal-kr-cdn-z01.sooplive.co.kr/spkt/review_clip/${dateStr}/${playerId}/`,
        `https://vod-normal-kr-cdn-z01.sooplive.co.kr/spkt/review_clip/${dateStr}/${playerId}_1.smil/manifest.m3u8?rp=o00`,
        `https://vod-normal-kr-cdn-z01.sooplive.co.kr/spkt/review_clip/${dateStr}/${playerId}/${dateStr}_${playerId}_1.smil/manifest.m3u8?rp=o00`,
      ];

      for (const pattern of possiblePatterns) {
        try {
          const testResponse = await fetch(pattern, {
            method: 'HEAD',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            }
          });
          
          if (testResponse.ok || testResponse.status === 302) {
            return pattern;
          }
        } catch (e) {
          // 시도 실패는 무시
        }
      }

      return null;
    } catch (error) {
      console.error('m3u8 추출 오류:', error);
      return null;
    }
  }

  /**
   * m3u8 URL이 직접 제공된 경우 검증합니다.
   */
  isValidM3U8Url(url: string): boolean {
    return url.includes('.m3u8');
  }
}
