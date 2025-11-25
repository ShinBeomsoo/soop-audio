import axios from 'axios';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { M3U8Info } from './types';

/**
 * 오디오 세그먼트를 다운로드하고 재생합니다.
 */
export class AudioPlayer {
  /**
   * m3u8 세그먼트를 다운로드하여 로컬 파일로 저장합니다.
   */
  async downloadSegments(
    segments: string[],
    outputPath: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    console.log(`다운로드 시작: ${segments.length}개 세그먼트`);

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      try {
        const response = await axios({
          method: 'GET',
          url: segment,
          responseType: 'stream',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const segmentPath = join(outputPath, `segment_${i.toString().padStart(6, '0')}.ts`);
        const writer = createWriteStream(segmentPath);
        
        response.data.pipe(writer);

        await new Promise<void>((resolve, reject) => {
          writer.on('finish', () => resolve());
          writer.on('error', reject);
        });

        if (onProgress) {
          onProgress(i + 1, segments.length);
        }

        console.log(`[${i + 1}/${segments.length}] 다운로드 완료: ${segment}`);
      } catch (error) {
        console.error(`세그먼트 ${i + 1} 다운로드 실패:`, error);
        // 계속 진행
      }
    }

    console.log('모든 세그먼트 다운로드 완료');
  }

  /**
   * 세그먼트 정보를 출력합니다 (재생을 위한 정보 제공).
   */
  async playStream(segments: string[]): Promise<void> {
    console.log('\n=== 오디오 스트림 정보 ===');
    console.log(`총 세그먼트 수: ${segments.length}`);
    console.log('\n세그먼트 URL 목록:');
    
    segments.slice(0, 5).forEach((segment, index) => {
      console.log(`  ${index + 1}. ${segment}`);
    });
    
    if (segments.length > 5) {
      console.log(`  ... 외 ${segments.length - 5}개`);
    }

    console.log('\n💡 참고: 실제 오디오 재생을 위해서는 다음 방법을 사용할 수 있습니다:');
    console.log('   1. ffmpeg를 사용하여 세그먼트를 합치고 오디오 추출');
    console.log('   2. HLS.js 같은 라이브러리를 사용하여 브라우저에서 재생');
    console.log('   3. VLC 같은 미디어 플레이어에서 m3u8 URL 직접 재생');
  }
}

