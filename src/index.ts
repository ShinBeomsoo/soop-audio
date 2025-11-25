import { SoopExtractor } from './extractor';
import { M3U8AudioParser } from './m3u8Parser';
import { AudioPlayer } from './audioPlayer';

/**
 * soop VOD URL에서 오디오만 추출하여 재생하는 메인 클래스
 */
export class SoopAudio {
  private extractor: SoopExtractor;
  private parser: M3U8AudioParser;
  private player: AudioPlayer;

  constructor() {
    this.extractor = new SoopExtractor();
    this.parser = new M3U8AudioParser();
    this.player = new AudioPlayer();
  }

  /**
   * soop VOD URL에서 오디오를 추출하여 브라우저에서 재생합니다.
   * @param vodUrl soop VOD URL 또는 m3u8 URL
   * @param audioElement 재생에 사용할 HTMLAudioElement (선택사항, 없으면 자동 생성)
   * @param onProgress 진행률 콜백 (current, total)
   * @param onEnded 재생 완료 콜백
   * @param onError 오류 콜백
   * @returns 재생 중인 HTMLAudioElement
   */
  async playAudio(
    vodUrl: string,
    audioElement?: HTMLAudioElement,
    onProgress?: (current: number, total: number) => void,
    onEnded?: () => void,
    onError?: (error: Error) => void
  ): Promise<HTMLAudioElement> {
    try {
      let m3u8Url: string | null = null;

      // m3u8 URL이 직접 제공된 경우
      if (this.extractor.isValidM3U8Url(vodUrl)) {
        m3u8Url = vodUrl;
      } else {
        // soop VOD URL에서 m3u8 추출
        m3u8Url = await this.extractor.extractM3U8FromUrl(vodUrl);
        
        if (!m3u8Url) {
          throw new Error('m3u8 URL을 찾을 수 없습니다. URL이 올바른지 확인해주세요.');
        }
      }

      // m3u8 파싱
      const m3u8Info = await this.parser.parseM3U8(m3u8Url);

      // 오디오 세그먼트 추출
      const segments = this.parser.getAudioSegments(m3u8Info);
      
      if (segments.length === 0) {
        throw new Error('오디오 세그먼트를 찾을 수 없습니다.');
      }

      // 오디오 재생
      return await this.player.playStream(
        segments,
        audioElement,
        onProgress,
        onEnded,
        onError
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (onError) {
        onError(err);
      }
      throw err;
    }
  }

  /**
   * 재생을 중지합니다.
   */
  stop(): void {
    this.player.stop();
  }

  /**
   * 현재 재생 중인 오디오 요소를 반환합니다.
   */
  getAudioElement(): HTMLAudioElement | null {
    return this.player.getAudioElement();
  }
}

// 기본 export
export default SoopAudio;

// 간편 함수 export
/**
 * soop VOD URL에서 오디오를 추출하여 재생하는 간편 함수
 * @param vodUrl soop VOD URL 또는 m3u8 URL
 * @param audioElement 재생에 사용할 HTMLAudioElement (선택사항)
 * @returns 재생 중인 HTMLAudioElement
 */
export async function playSoopAudio(
  vodUrl: string,
  audioElement?: HTMLAudioElement
): Promise<HTMLAudioElement> {
  const soopAudio = new SoopAudio();
  return await soopAudio.playAudio(vodUrl, audioElement);
}
