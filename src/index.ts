import { SoopExtractor } from './extractor';
import { M3U8AudioParser } from './m3u8Parser';
import { AudioPlayer } from './audioPlayer';
import { SoopAudioOptions } from './types';

/**
 * soop VOD URL에서 오디오만 추출하는 메인 클래스
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
   * soop VOD URL에서 오디오 스트림을 추출합니다.
   */
  async extractAudio(options: SoopAudioOptions): Promise<void> {
    try {
      console.log('🔍 soop VOD URL 분석 중...');
      console.log(`URL: ${options.url}\n`);

      let m3u8Url: string | null = null;

      // m3u8 URL이 직접 제공된 경우
      if (this.extractor.isValidM3U8Url(options.url)) {
        m3u8Url = options.url;
        console.log('✅ m3u8 URL이 직접 제공되었습니다.');
      } else {
        // soop VOD URL에서 m3u8 추출
        console.log('📡 soop 페이지에서 m3u8 링크 추출 중...');
        m3u8Url = await this.extractor.extractM3U8FromUrl(options.url);
        
        if (!m3u8Url) {
          throw new Error('m3u8 URL을 찾을 수 없습니다. URL이 올바른지 확인해주세요.');
        }
        
        console.log(`✅ m3u8 URL 발견: ${m3u8Url}\n`);
      }

      // m3u8 파싱
      console.log('📦 m3u8 파일 파싱 중...');
      const m3u8Info = await this.parser.parseM3U8(m3u8Url);
      console.log(`✅ 파싱 완료: ${m3u8Info.segments.length}개 세그먼트 발견\n`);

      // 오디오 세그먼트 추출
      const segments = this.parser.getAudioSegments(m3u8Info);
      
      if (segments.length === 0) {
        throw new Error('오디오 세그먼트를 찾을 수 없습니다.');
      }

      // 재생 또는 다운로드
      if (options.output) {
        console.log(`💾 세그먼트 다운로드 중... (출력 경로: ${options.output})`);
        await this.player.downloadSegments(segments, options.output, (current, total) => {
          const percent = ((current / total) * 100).toFixed(1);
          process.stdout.write(`\r진행률: ${percent}% (${current}/${total})`);
        });
        console.log('\n✅ 다운로드 완료!');
      } else {
        await this.player.playStream(segments);
      }
    } catch (error) {
      console.error('❌ 오류 발생:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}

// 기본 export
export default SoopAudio;

