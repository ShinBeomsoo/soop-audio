# soop-audio 🎵

soop VOD 링크에서 오디오만 추출하여 재생하는 오픈소스 도구입니다.

## ✨ 기능

- soop VOD URL을 입력받아 m3u8 스트림을 자동으로 추출
- HLS 스트림에서 오디오 트랙만 필터링
- CLI 인터페이스 제공
- 세그먼트 다운로드 지원

## 📦 설치

```bash
npm install
npm run build
```

## 🚀 사용법

### 기본 사용 (soop VOD URL)

```bash
npm run build
node dist/cli.js https://vod.sooplive.co.kr/player/161404387
```

### 직접 m3u8 URL 사용 (권장)

브라우저에서 m3u8 URL을 직접 찾아서 사용하는 것이 더 안정적입니다:

1. 브라우저에서 soop VOD 페이지 열기
2. 개발자 도구 열기 (F12 또는 Cmd+Option+I)
3. Network 탭 선택
4. "VOD 보기" 버튼 클릭
5. 필터에 `.m3u8` 입력
6. 나타나는 m3u8 파일의 URL 복사
7. 다음 명령으로 실행:

```bash
node dist/cli.js "https://vod-normal-kr-cdn-z01.sooplive.co.kr/.../manifest.m3u8?rp=o00"
```

### 세그먼트 다운로드

```bash
node dist/cli.js https://vod.sooplive.co.kr/player/161404387 -o ./output
```

### 품질 선택

```bash
node dist/cli.js https://vod.sooplive.co.kr/player/161404387 -q high
```

## 🛠️ 개발

```bash
# 개발 모드 실행
npm run dev

# 빌드
npm run build

# 빌드 제거
npm run clean
```

## 📝 작동 원리

1. **URL 추출**: soop VOD 페이지에서 m3u8 링크를 자동으로 추출합니다.
2. **m3u8 파싱**: HLS manifest 파일을 파싱하여 세그먼트 정보를 얻습니다.
3. **오디오 필터링**: Master Playlist인 경우 오디오 전용 variant를 찾아 재귀적으로 파싱합니다.
4. **세그먼트 처리**: 오디오 세그먼트 URL 목록을 제공하거나 다운로드합니다.

## 🔧 기술 스택

- **TypeScript**: 타입 안정성
- **axios**: HTTP 요청
- **cheerio**: HTML 파싱
- **hls-parser**: m3u8 파일 파싱
- **commander**: CLI 인터페이스

## 📄 라이선스

MIT

## 🤝 기여

이슈와 PR을 환영합니다!

