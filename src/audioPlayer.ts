import { M3U8Info } from './types';

/**
 * 브라우저에서 오디오 세그먼트를 스트리밍 재생합니다.
 */
export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private mediaSource: MediaSource | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private segments: string[] = [];
  private currentSegmentIndex: number = 0;
  private isPlaying: boolean = false;
  private onProgressCallback?: (current: number, total: number) => void;
  private onEndedCallback?: () => void;
  private onErrorCallback?: (error: Error) => void;

  /**
   * 오디오 세그먼트를 브라우저에서 스트리밍 재생합니다.
   * @param segments 오디오 세그먼트 URL 배열
   * @param audioElement 재생에 사용할 HTMLAudioElement (선택사항, 없으면 자동 생성)
   * @param onProgress 진행률 콜백 (current, total)
   * @param onEnded 재생 완료 콜백
   * @param onError 오류 콜백
   */
  async playStream(
    segments: string[],
    audioElement?: HTMLAudioElement,
    onProgress?: (current: number, total: number) => void,
    onEnded?: () => void,
    onError?: (error: Error) => void
  ): Promise<HTMLAudioElement> {
    this.segments = segments;
    this.onProgressCallback = onProgress;
    this.onEndedCallback = onEnded;
    this.onErrorCallback = onError;
    this.currentSegmentIndex = 0;

    // AudioElement가 제공되지 않으면 생성
    if (!audioElement) {
      this.audioElement = document.createElement('audio');
      this.audioElement.controls = true;
      document.body.appendChild(this.audioElement);
    } else {
      this.audioElement = audioElement;
    }

    // MediaSource API를 사용하여 스트리밍 재생 시도
    if (this.supportsMediaSource()) {
      try {
        return await this.playWithMediaSource();
      } catch (error) {
        console.warn('MediaSource 재생 실패, 순차 재생으로 전환:', error);
        return await this.playSequentially();
      }
    } else {
      // MediaSource를 지원하지 않으면 순차 재생
      return await this.playSequentially();
    }
  }

  /**
   * MediaSource API를 사용하여 재생 (더 부드러운 재생)
   */
  private async playWithMediaSource(): Promise<HTMLAudioElement> {
    return new Promise((resolve, reject) => {
      if (!this.audioElement) {
        reject(new Error('Audio element가 없습니다.'));
        return;
      }

      this.mediaSource = new MediaSource();
      const url = URL.createObjectURL(this.mediaSource);
      this.audioElement.src = url;

      this.mediaSource.addEventListener('sourceopen', async () => {
        try {
          // 오디오 세그먼트의 MIME 타입 감지 (일반적으로 audio/mp4 또는 audio/aac)
          const mimeType = 'audio/mp4; codecs="mp4a.40.2"';
          
          if (!MediaSource.isTypeSupported(mimeType)) {
            // 다른 MIME 타입 시도
            const alternativeTypes = [
              'audio/mp4',
              'audio/aac',
              'audio/mpeg',
            ];
            
            let supportedType = null;
            for (const type of alternativeTypes) {
              if (MediaSource.isTypeSupported(type)) {
                supportedType = type;
                break;
              }
            }

            if (!supportedType) {
              throw new Error('지원되는 오디오 형식을 찾을 수 없습니다.');
            }

            this.sourceBuffer = this.mediaSource!.addSourceBuffer(supportedType);
          } else {
            this.sourceBuffer = this.mediaSource!.addSourceBuffer(mimeType);
          }

          // 첫 번째 세그먼트 로드
          await this.loadNextSegment();
          resolve(this.audioElement!);
        } catch (error) {
          reject(error);
        }
      });

      this.audioElement.addEventListener('error', (e) => {
        reject(new Error('오디오 재생 오류'));
      });
    });
  }

  /**
   * 다음 세그먼트를 로드합니다 (MediaSource용)
   */
  private async loadNextSegment(): Promise<void> {
    if (this.currentSegmentIndex >= this.segments.length) {
      if (this.mediaSource && this.mediaSource.readyState === 'open') {
        this.mediaSource.endOfStream();
      }
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
      return;
    }

    if (!this.sourceBuffer || !this.mediaSource) {
      return;
    }

    // SourceBuffer가 업데이트 중이면 대기
    if (this.sourceBuffer.updating) {
      this.sourceBuffer.addEventListener('updateend', () => this.loadNextSegment(), { once: true });
      return;
    }

    try {
      const segmentUrl = this.segments[this.currentSegmentIndex];
      const response = await fetch(segmentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`세그먼트 다운로드 실패: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      
      // SourceBuffer에 추가
      this.sourceBuffer.appendBuffer(arrayBuffer);
      
      this.currentSegmentIndex++;
      
      if (this.onProgressCallback) {
        this.onProgressCallback(this.currentSegmentIndex, this.segments.length);
      }

      // 다음 세그먼트 로드 준비
      this.sourceBuffer.addEventListener('updateend', () => this.loadNextSegment(), { once: true });
    } catch (error) {
      if (this.onErrorCallback) {
        this.onErrorCallback(error instanceof Error ? error : new Error(String(error)));
      }
      console.error('세그먼트 로드 오류:', error);
    }
  }

  /**
   * 순차적으로 세그먼트를 재생합니다 (간단한 방법)
   */
  private async playSequentially(): Promise<HTMLAudioElement> {
    if (!this.audioElement) {
      throw new Error('Audio element가 없습니다.');
    }

    this.isPlaying = true;
    this.currentSegmentIndex = 0;

    const playNext = async () => {
      if (!this.isPlaying || this.currentSegmentIndex >= this.segments.length) {
        this.isPlaying = false;
        if (this.onEndedCallback) {
          this.onEndedCallback();
        }
        return;
      }

      const segmentUrl = this.segments[this.currentSegmentIndex];
      
      try {
        // CORS 문제를 피하기 위해 직접 URL 사용
        this.audioElement!.src = segmentUrl;
        
        await new Promise<void>((resolve, reject) => {
          const onEnded = () => {
            this.audioElement!.removeEventListener('ended', onEnded);
            this.audioElement!.removeEventListener('error', onError);
            resolve();
          };

          const onError = (e: Event) => {
            this.audioElement!.removeEventListener('ended', onEnded);
            this.audioElement!.removeEventListener('error', onError);
            // 오류가 발생해도 다음 세그먼트로 진행
            console.warn(`세그먼트 ${this.currentSegmentIndex + 1} 재생 오류, 건너뜀`);
            resolve();
          };

          this.audioElement!.addEventListener('ended', onEnded, { once: true });
          this.audioElement!.addEventListener('error', onError, { once: true });
          
          this.audioElement!.play().catch(reject);
        });

        this.currentSegmentIndex++;
        
        if (this.onProgressCallback) {
          this.onProgressCallback(this.currentSegmentIndex, this.segments.length);
        }

        // 다음 세그먼트 재생
        await playNext();
      } catch (error) {
        if (this.onErrorCallback) {
          this.onErrorCallback(error instanceof Error ? error : new Error(String(error)));
        }
        console.error('재생 오류:', error);
        this.isPlaying = false;
      }
    };

    await playNext();
    return this.audioElement;
  }

  /**
   * 재생을 중지합니다.
   */
  stop(): void {
    this.isPlaying = false;
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
    }
    if (this.mediaSource && this.mediaSource.readyState === 'open') {
      this.mediaSource.endOfStream();
    }
    if (this.sourceBuffer) {
      this.sourceBuffer = null;
    }
    if (this.mediaSource) {
      URL.revokeObjectURL(this.audioElement?.src || '');
      this.mediaSource = null;
    }
  }

  /**
   * MediaSource API 지원 여부 확인
   */
  private supportsMediaSource(): boolean {
    return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported !== undefined;
  }

  /**
   * 현재 재생 중인 오디오 요소를 반환합니다.
   */
  getAudioElement(): HTMLAudioElement | null {
    return this.audioElement;
  }
}

