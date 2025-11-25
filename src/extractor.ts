import axios from 'axios';
import * as cheerio from 'cheerio';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import puppeteer, { Browser, Page } from 'puppeteer';

/**
 * soop VOD URL에서 m3u8 링크를 추출합니다.
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
      console.log(`   Player ID: ${playerId}`);
      
      // 방법 1: 다양한 API 엔드포인트 시도
      const apiEndpoints = [
        `https://vod.sooplive.co.kr/api/player/${playerId}`,
        `https://vod.sooplive.co.kr/api/vod/${playerId}`,
        `https://api.sooplive.co.kr/vod/${playerId}`,
        `https://vod.sooplive.co.kr/player/api/${playerId}`,
      ];

      for (const apiUrl of apiEndpoints) {
        try {
          console.log(`   API 시도: ${apiUrl}`);
          const apiResponse = await axios.get(apiUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': vodUrl,
              'Accept': 'application/json'
            },
            timeout: 5000
          });
          
          // JSON 응답에서 m3u8 찾기
          const jsonStr = JSON.stringify(apiResponse.data);
          
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
              // 첫 번째 매치에서 URL 추출 (그룹이 있으면 그룹 사용)
              let url = matches[0];
              if (pattern.source.includes('(')) {
                // 그룹 캡처가 있는 경우
                const groupMatch = jsonStr.match(pattern);
                if (groupMatch && groupMatch[1]) {
                  url = groupMatch[1];
                }
              } else {
                // 전체 매치에서 따옴표 제거
                url = url.replace(/^["']|["']$/g, '');
              }
              
              if (url && url.includes('.m3u8')) {
                console.log(`   ✅ API에서 m3u8 발견: ${url}`);
                return url;
              }
            }
          }
        } catch (apiError: any) {
          // API 호출 실패는 무시하고 다음 시도
          if (apiError.response?.status !== 404) {
            console.log(`   ⚠️  API 오류 (${apiError.response?.status || 'timeout'}): ${apiUrl}`);
          }
        }
      }

      // 방법 2: 페이지 HTML 가져오기
      console.log(`   페이지 HTML 분석 중...`);
      const response = await axios.get(vodUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 10000
      });

      const htmlContent = response.data;
      const $ = cheerio.load(htmlContent);

      // 디버깅: HTML 저장 (선택적)
      if (process.env.DEBUG) {
        try {
          writeFileSync(join(process.cwd(), 'debug-page.html'), htmlContent, 'utf-8');
          console.log(`   💾 디버그: HTML이 debug-page.html에 저장되었습니다.`);
        } catch (e) {
          // 무시
        }
      }

      // 방법 2-1: script 태그에서 m3u8 링크 찾기 (더 강력한 패턴)
      console.log(`   Script 태그 분석 중...`);
      let foundM3U8: string | null = null;
      $('script').each((_, element) => {
        if (foundM3U8) return false; // 이미 찾았으면 중단
        
        const scriptContent = $(element).html() || '';
        
        // 다양한 패턴으로 m3u8 찾기 (더 포괄적인 패턴)
        const patterns = [
          // 기본 URL 패턴
          /https?:\/\/[^"'\s\)\]\}]+\.m3u8[^"'\s\)\]\}]*/g,
          // 따옴표로 감싸진 URL
          /["']([^"']+\.m3u8[^"']*)["']/g,
          // JavaScript 변수 할당
          /(?:url|src|source|manifest|hls|playlist|stream|videoUrl|video_url|videoSrc|video_src)\s*[:=]\s*["']([^"']+\.m3u8[^"']*)["']/gi,
          // JSON 형식
          /"(?:url|src|source|manifest|hls|playlist|stream)"\s*:\s*["']([^"']+\.m3u8[^"']*)["']/gi,
          // Base64나 인코딩된 URL (일단 기본 패턴만)
          /(?:https?%3A%2F%2F|https?:\/\/)[^"'\s]+\.m3u8[^"'\s]*/gi,
        ];

        for (const pattern of patterns) {
          const matches = scriptContent.matchAll(pattern);
          for (const match of matches) {
            let url = match[0];
            // 그룹 캡처가 있는 경우 첫 번째 그룹 사용
            if (match.length > 1 && match[1]) {
              url = match[1];
            } else {
              // 따옴표 제거
              url = url.replace(/^["']|["']$/g, '');
            }
            
            // URL 디코딩
            try {
              url = decodeURIComponent(url);
            } catch (e) {
              // 디코딩 실패는 무시
            }
            
            if (url && url.includes('.m3u8') && (url.startsWith('http://') || url.startsWith('https://'))) {
              foundM3U8 = url;
              console.log(`   ✅ Script에서 m3u8 발견: ${url}`);
              return false; // break
            }
          }
        }
      });
      
      if (foundM3U8) {
        return foundM3U8;
      }

      // 방법 2-2: 전체 HTML에서 직접 찾기 (더 포괄적인 패턴)
      console.log(`   전체 HTML에서 패턴 검색 중...`);
      const htmlPatterns = [
        /https?:\/\/[^"'\s<>\]\}]+\.m3u8[^"'\s<>\]\}]*/g,
        /https?%3A%2F%2F[^"'\s]+\.m3u8[^"'\s]*/gi, // URL 인코딩된 경우
      ];

      for (const pattern of htmlPatterns) {
        const matches = htmlContent.matchAll(pattern);
        const foundUrls: string[] = [];
        
        for (const match of matches) {
          let url = match[0];
          // URL 디코딩
          try {
            url = decodeURIComponent(url);
          } catch (e) {
            // 디코딩 실패는 원본 사용
          }
          
          if (url && url.includes('.m3u8') && (url.startsWith('http://') || url.startsWith('https://'))) {
            foundUrls.push(url);
          }
        }
        
        // 중복 제거
        const uniqueUrls = [...new Set(foundUrls)];
        if (uniqueUrls.length > 0) {
          console.log(`   ✅ HTML에서 m3u8 발견: ${uniqueUrls[0]}`);
          return uniqueUrls[0];
        }
      }

      // 방법 2-3: data 속성이나 다른 속성에서 찾기
      let foundInAttributes: string | null = null;
      $('[data-src*=".m3u8"], [src*=".m3u8"], [href*=".m3u8"], [data-url*=".m3u8"], [data-source*=".m3u8"]').each((_, element) => {
        if (foundInAttributes) return false;
        
        const url = $(element).attr('data-src') || 
                   $(element).attr('src') || 
                   $(element).attr('href') ||
                   $(element).attr('data-url') ||
                   $(element).attr('data-source');
        if (url && url.includes('.m3u8') && url.startsWith('http')) {
          foundInAttributes = url;
          console.log(`   ✅ 속성에서 m3u8 발견: ${url}`);
          return false;
        }
      });
      
      if (foundInAttributes) {
        return foundInAttributes;
      }

      // 방법 3: player ID 기반으로 m3u8 URL 패턴 추론 시도
      // 사용자가 제공한 패턴: https://vod-normal-kr-cdn-z01.sooplive.co.kr/spkt/review_clip/20250528/30826607/...
      console.log(`   Player ID 기반 URL 패턴 시도 중...`);
      const today = new Date();
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      
      // 여러 가능한 패턴 시도
      const possiblePatterns = [
        `https://vod-normal-kr-cdn-z01.sooplive.co.kr/spkt/review_clip/${dateStr}/${playerId}/`,
        `https://vod-normal-kr-cdn-z01.sooplive.co.kr/spkt/review_clip/${dateStr}/${playerId}_1.smil/manifest.m3u8?rp=o00`,
        `https://vod-normal-kr-cdn-z01.sooplive.co.kr/spkt/review_clip/${dateStr}/${playerId}/${dateStr}_${playerId}_1.smil/manifest.m3u8?rp=o00`,
      ];

      for (const pattern of possiblePatterns) {
        try {
          const testResponse = await axios.head(pattern, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            timeout: 3000,
            validateStatus: (status) => status < 500, // 4xx는 허용 (존재 여부 확인용)
          });
          
          if (testResponse.status === 200 || testResponse.status === 302) {
            console.log(`   ✅ 패턴 기반 m3u8 발견: ${pattern}`);
            return pattern;
          }
        } catch (e) {
          // 시도 실패는 무시
        }
      }

      // 방법 4: HTML에서 모든 URL 추출 후 m3u8 필터링
      console.log(`   모든 URL 추출 후 필터링 중...`);
      const allUrlsMatch = htmlContent.match(/https?:\/\/[^\s"'<>]+/g);
      const allUrls: string[] = allUrlsMatch || [];
      const m3u8Urls = allUrls.filter((url: string) => url.includes('.m3u8'));
      if (m3u8Urls.length > 0) {
        const uniqueM3U8: string[] = [...new Set(m3u8Urls)];
        console.log(`   ✅ URL 필터링으로 m3u8 발견: ${uniqueM3U8[0]}`);
        return uniqueM3U8[0];
      }

      // 방법 5: Puppeteer를 사용하여 브라우저에서 동적으로 로드되는 m3u8 찾기
      console.log(`   🌐 브라우저 자동화로 동적 콘텐츠 로드 중...`);
      const browserM3U8 = await this.extractM3U8WithBrowser(vodUrl);
      if (browserM3U8) {
        return browserM3U8;
      }

      console.log(`   ❌ m3u8 URL을 찾을 수 없습니다.`);
      console.log(`   💡 디버깅을 위해 DEBUG=1 환경변수를 설정하고 다시 시도해보세요.`);
      console.log(`   💡 또는 브라우저 개발자 도구에서 네트워크 탭을 확인하여 m3u8 URL을 찾아 직접 입력해주세요.`);
      return null;
    } catch (error) {
      console.error('   ❌ 오류 발생:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Puppeteer를 사용하여 브라우저에서 동적으로 로드되는 m3u8 URL을 추출합니다.
   */
  private async extractM3U8WithBrowser(vodUrl: string): Promise<string | null> {
    let browser: Browser | null = null;
    try {
      console.log(`      브라우저 시작 중...`);
      
      // macOS에서 시스템 Chrome 사용 시도
      const launchOptions: any = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      };

      // macOS에서 시스템 Chrome 경로 시도
      const possibleChromePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'
      ];

      for (const chromePath of possibleChromePaths) {
        if (existsSync(chromePath)) {
          launchOptions.executablePath = chromePath;
          console.log(`      시스템 Chrome 사용: ${chromePath}`);
          break;
        }
      }

      try {
        browser = await puppeteer.launch(launchOptions);
      } catch (error) {
        // 기본 설정으로 재시도
        console.log(`      기본 설정으로 재시도 중...`);
        delete launchOptions.executablePath;
        browser = await puppeteer.launch(launchOptions);
      }

      const page = await browser.newPage();
      
      // User-Agent 설정 (봇 감지 방지)
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      const m3u8Urls: string[] = [];

      // 네트워크 요청 모니터링
      page.on('request', (request) => {
        const url = request.url();
        if (url.includes('.m3u8')) {
          console.log(`      📡 m3u8 요청 발견: ${url}`);
          m3u8Urls.push(url);
        }
      });

      // 응답도 모니터링 (리다이렉트된 경우)
      page.on('response', (response) => {
        const url = response.url();
        if (url.includes('.m3u8')) {
          console.log(`      📡 m3u8 응답 발견: ${url}`);
          m3u8Urls.push(url);
        }
      });
      
      // 페이지 오류 로깅
      page.on('pageerror', (error) => {
        console.log(`      ⚠️  페이지 오류: ${error.message}`);
      });
      
      // 콘솔 메시지 로깅 (디버깅용)
      page.on('console', (msg) => {
        if (process.env.DEBUG) {
          console.log(`      [브라우저 콘솔] ${msg.text()}`);
        }
      });

      console.log(`      페이지 로드 중: ${vodUrl}`);
      try {
        await page.goto(vodUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        console.log(`      ✅ 페이지 로드 완료`);
      } catch (error) {
        console.log(`      ⚠️  페이지 로드 오류: ${error instanceof Error ? error.message : error}`);
        // 계속 진행
      }
      
      // 페이지가 완전히 로드될 때까지 추가 대기
      await page.waitForTimeout(3000);

      // "VOD 보기" 버튼 찾기 및 클릭
      console.log(`      "VOD 보기" 버튼 찾는 중...`);
      try {
        // 다양한 선택자로 버튼 찾기
        const buttonSelectors = [
          'a:contains("VOD 보기")',
          'button:contains("VOD 보기")',
          'a[href*="vod"]',
          'button[onclick*="vod"]',
          'a:contains("보기")',
          'button:contains("보기")',
          '[class*="vod"][class*="button"]',
          '[class*="play"][class*="button"]',
        ];

        let buttonClicked = false;
        for (const selector of buttonSelectors) {
          try {
            // XPath를 사용하여 텍스트로 찾기
            const xpathSelectors = [
              '//a[contains(text(), "VOD 보기")]',
              '//button[contains(text(), "VOD 보기")]',
              '//a[contains(text(), "보기")]',
              '//button[contains(text(), "보기")]',
            ];

            for (const xpath of xpathSelectors) {
              const elements = await page.$x(xpath);
              if (elements.length > 0) {
                await elements[0].click();
                buttonClicked = true;
                console.log(`      ✅ "VOD 보기" 버튼 클릭 완료`);
                break;
              }
            }

            if (buttonClicked) break;

            // 일반 선택자로도 시도
            const button = await page.$(selector);
            if (button) {
              await button.click();
              buttonClicked = true;
              console.log(`      ✅ "VOD 보기" 버튼 클릭 완료`);
              break;
            }
          } catch (e) {
            // 다음 선택자 시도
          }
        }

        if (buttonClicked) {
          // 버튼 클릭 후 페이지 변화 대기
          await page.waitForTimeout(2000);
        } else {
          console.log(`      ⚠️  "VOD 보기" 버튼을 찾을 수 없습니다. 계속 진행합니다...`);
        }
      } catch (error) {
        console.log(`      ⚠️  버튼 클릭 중 오류: ${error instanceof Error ? error.message : error}`);
      }

      // 광고 대기 (광고가 있으면 광고가 끝날 때까지 대기)
      console.log(`      광고 확인 중...`);
      let adFinished = false;
      const maxAdWaitTime = 60000; // 최대 60초 대기
      const startTime = Date.now();

      // 광고 관련 요소 확인
      while (!adFinished && (Date.now() - startTime) < maxAdWaitTime) {
        try {
          // 광고 스킵 버튼이나 광고 종료 표시 확인
          const adSkipSelectors = [
            '[class*="skip"]',
            '[class*="ad-skip"]',
            '[id*="skip"]',
            'button:contains("건너뛰기")',
            'button:contains("Skip")',
            '[class*="close"][class*="ad"]',
          ];

          let skipButtonFound = false;
          for (const selector of adSkipSelectors) {
            try {
              const skipButton = await page.$(selector);
              if (skipButton) {
                const isVisible = await skipButton.isIntersectingViewport();
                if (isVisible) {
                  await skipButton.click();
                  console.log(`      ✅ 광고 건너뛰기 버튼 클릭`);
                  await page.waitForTimeout(2000);
                }
              }
            } catch (e) {
              // 다음 선택자 시도
            }
          }

          // 광고가 끝났는지 확인 (비디오 플레이어가 나타났는지)
          const videoPlayer = await page.$('video, [class*="player"], [id*="player"]');
          if (videoPlayer) {
            // m3u8이 이미 수집되었는지 확인
            if (m3u8Urls.length > 0) {
              adFinished = true;
              console.log(`      ✅ 광고 종료 확인 (m3u8 발견)`);
              break;
            }
          }

          // 짧은 대기 후 다시 확인
          await page.waitForTimeout(1000);
        } catch (error) {
          // 오류 발생 시 계속 진행
          break;
        }
      }

      // 플레이어가 초기화될 때까지 추가 대기
      console.log(`      플레이어 초기화 대기 중...`);
      await page.waitForTimeout(3000);

      // JavaScript 실행 후 DOM에서 m3u8 찾기
      const m3u8FromDOM = await page.evaluate(() => {
        // 브라우저 컨텍스트에서 실행되므로 DOM API 사용 가능
        // @ts-ignore - 브라우저 컨텍스트에서 실행됨
        const scripts = Array.from(document.querySelectorAll('script'));
        const m3u8Pattern = /https?:\/\/[^"'\s\)]+\.m3u8[^"'\s\)]*/g;
        const found: string[] = [];

        scripts.forEach((script: any) => {
          const content = script.innerHTML || '';
          const matches = content.match(m3u8Pattern);
          if (matches) {
            found.push(...matches);
          }
        });

        // 페이지 소스에서도 찾기
        // @ts-ignore - 브라우저 컨텍스트에서 실행됨
        const pageSource = document.documentElement.outerHTML;
        const sourceMatches = pageSource.match(m3u8Pattern);
        if (sourceMatches) {
          found.push(...sourceMatches);
        }

        return [...new Set(found)];
      });

      if (m3u8FromDOM && m3u8FromDOM.length > 0) {
        m3u8Urls.push(...m3u8FromDOM);
      }

      // 중복 제거
      const uniqueM3U8 = [...new Set(m3u8Urls)].filter(url => 
        url.startsWith('http') && url.includes('.m3u8')
      );

      if (uniqueM3U8.length > 0) {
        console.log(`      ✅ 브라우저에서 m3u8 발견: ${uniqueM3U8[0]}`);
        return uniqueM3U8[0];
      }

      return null;
    } catch (error) {
      if (error instanceof Error) {
        console.log(`      ⚠️  브라우저 자동화 오류: ${error.message}`);
        
        // Puppeteer 설치 문제인 경우 안내
        if (error.message.includes('Failed to launch') || error.message.includes('browser process')) {
          console.log(`\n   💡 해결 방법:`);
          console.log(`      1. Chrome이 설치되어 있는지 확인하세요.`);
          console.log(`      2. 다음 명령으로 Puppeteer를 재설치해보세요:`);
          console.log(`         npm install puppeteer --force`);
          console.log(`      3. 또는 브라우저에서 직접 m3u8 URL을 찾아 입력하세요:`);
          console.log(`         - 브라우저 개발자 도구 (F12) 열기`);
          console.log(`         - Network 탭에서 .m3u8 파일 찾기`);
          console.log(`         - 해당 URL을 직접 입력: node dist/cli.js "<m3u8-url>"`);
        }
      } else {
        console.log(`      ⚠️  브라우저 자동화 오류: ${JSON.stringify(error)}`);
      }
      return null;
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          // 브라우저 종료 오류는 무시
        }
      }
    }
  }

  /**
   * m3u8 URL이 직접 제공된 경우 검증합니다.
   */
  isValidM3U8Url(url: string): boolean {
    return url.includes('.m3u8');
  }
}


