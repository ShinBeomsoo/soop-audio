#!/usr/bin/env node

import { Command } from 'commander';
import { SoopAudio } from './index';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const program = new Command();

program
  .name('soop-audio')
  .description('soop VOD 링크에서 오디오만 추출하여 재생하는 도구')
  .version('0.1.0');

program
  .argument('<url>', 'soop VOD URL 또는 m3u8 URL')
  .option('-o, --output <path>', '출력 오디오 파일 경로 (예: output.mp3)')
  .option('-q, --quality <quality>', '품질 선택 (low, medium, high)', 'medium')
  .action(async (url: string, options) => {
    try {
      const soopAudio = new SoopAudio();
      
      // 출력 경로가 지정된 경우 디렉토리 생성
      if (options.output) {
        const outputDir = dirname(options.output);
        if (outputDir !== '.' && !existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }
      }

      await soopAudio.extractAudio({
        url,
        output: options.output,
        quality: options.quality as 'low' | 'medium' | 'high'
      });
    } catch (error) {
      console.error('\n❌ 실행 실패:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();

