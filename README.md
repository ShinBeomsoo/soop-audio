<!-- Improved compatibility of back to top link: See: https://github.com/othneildrew/Best-README-Template/pull/73 -->

<a id="readme-top"></a>

<!-- PROJECT SHIELDS -->
<!--
*** I'm using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <h3 align="center">soop-audio 🎵</h3>
  <p align="center">
    soop VOD 링크에서 오디오만 추출하여 브라우저에서 바로 재생하는 오픈소스 라이브러리
    <br />
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>목차</summary>
  <ol>
    <li>
      <a href="#about-the-project">프로젝트 소개</a>
    </li>
    <li>
      <a href="#getting-started">시작하기</a>
      <ul>
        <li><a href="#prerequisites">필수 요구사항</a></li>
        <li><a href="#installation">설치</a></li>
      </ul>
    </li>
    <li><a href="#usage">사용법</a></li>
    <li><a href="#contributing">기여하기</a></li>
    <li><a href="#license">라이선스</a></li>
    <li><a href="#contact">연락처</a></li>
    <li><a href="#acknowledgments">감사의 말</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## 프로젝트 소개

soop-audio는 soop VOD 링크에서 오디오만 추출하여 브라우저에서 바로 재생할 수 있게 해주는 라이브러리입니다. 다운로드 없이 스트리밍 방식으로 음성을 재생합니다.

왜 soop-audio를 사용해야 할까요?

* 🎯 **간단한 API**: soop VOD URL만 제공하면 자동으로 오디오를 추출하여 재생
* 🚀 **스트리밍 재생**: 다운로드 없이 브라우저에서 바로 재생
* 📦 **경량화**: 최소한의 의존성으로 가볍고 빠름
* 🔧 **TypeScript 지원**: 완전한 타입 안정성 제공
* 🌐 **브라우저 호환**: 최신 브라우저와 구형 브라우저 모두 지원

<p align="right">(<a href="#readme-top">맨 위로</a>)</p>

<!-- GETTING STARTED -->
## 시작하기

프로젝트를 로컬에서 설정하고 실행하는 방법에 대한 예시입니다.

### 필수 요구사항

소프트웨어를 사용하는 데 필요한 것들과 설치 방법을 나열하는 예시입니다.

* npm
  ```sh
  npm install npm@latest -g
  ```

### 설치

아래는 사용자에게 앱을 설치하고 설정하는 방법을 안내하는 예시입니다.

1. 저장소 클론
   ```sh
   git clone https://github.com/your_username/soop-audio.git
   ```
2. NPM 패키지 설치
   ```sh
   npm install
   ```
3. 빌드
   ```sh
   npm run build
   ```

<p align="right">(<a href="#readme-top">맨 위로</a>)</p>

<!-- USAGE EXAMPLES -->
## 사용법

프로젝트를 사용하는 방법에 대한 유용한 예시를 보여주는 공간입니다. 추가 스크린샷, 코드 예시 및 데모가 이 공간에 잘 어울립니다.

### 기본 사용 (JavaScript/TypeScript)

```javascript
import { playSoopAudio, SoopAudio } from './dist/index.js';

// 간편 함수 사용
const audioElement = await playSoopAudio('https://vod.sooplive.co.kr/player/161404387');
// audioElement가 자동으로 document.body에 추가되어 재생됩니다.
```

### 클래스 사용 (더 많은 제어)

```javascript
import { SoopAudio } from './dist/index.js';

const soopAudio = new SoopAudio();
const audioElement = await soopAudio.playAudio(
  'https://vod.sooplive.co.kr/player/161404387',
  undefined, // audioElement (없으면 자동 생성)
  (current, total) => {
    console.log(`진행률: ${current}/${total}`);
  },
  () => {
    console.log('재생 완료!');
  },
  (error) => {
    console.error('오류:', error);
  }
);
```

### HTML에서 직접 사용

```html
<!DOCTYPE html>
<html>
<head>
  <title>soop-audio 예제</title>
</head>
<body>
  <button id="playBtn">재생</button>

  <script type="module">
    import { playSoopAudio } from './dist/index.js';
    
    document.getElementById('playBtn').addEventListener('click', async () => {
      try {
        const vodUrl = 'https://vod.sooplive.co.kr/player/161404387';
        const audioElement = await playSoopAudio(vodUrl);
        console.log('재생 시작!');
      } catch (error) {
        console.error('재생 실패:', error);
      }
    });
  </script>
</body>
</html>
```

### m3u8 URL 직접 사용

m3u8 URL을 직접 알고 있는 경우:

```javascript
import { playSoopAudio } from './dist/index.js';

const m3u8Url = 'https://vod-normal-kr-cdn-z01.sooplive.co.kr/.../manifest.m3u8?rp=o00';
const audioElement = await playSoopAudio(m3u8Url);
```

### 재생 제어

```javascript
import { SoopAudio } from './dist/index.js';

const soopAudio = new SoopAudio();
const audioElement = await soopAudio.playAudio('https://vod.sooplive.co.kr/player/161404387');

// 재생 중지
soopAudio.stop();

// 오디오 요소 가져오기
const element = soopAudio.getAudioElement();
if (element) {
  element.pause();
  element.currentTime = 0;
}
```

<p align="right">(<a href="#readme-top">맨 위로</a>)</p>

<!-- CONTRIBUTING -->
## 기여하기

개선 제안이 있으시면 저장소를 포크하고 Pull Request를 생성해주세요. 또는 "enhancement" 태그로 이슈를 열어주세요.

프로젝트에 별표를 주는 것도 잊지 마세요! 다시 한 번 감사합니다!

1. 프로젝트 포크
2. 기능 브랜치 생성 (`git checkout -b feature/AmazingFeature`)
3. 변경사항 커밋 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치에 푸시 (`git push origin feature/AmazingFeature`)
5. Pull Request 열기

<!-- LICENSE -->
## 라이선스

MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE.txt` 파일을 참고하세요.

<p align="right">(<a href="#readme-top">맨 위로</a>)</p>

<!-- CONTACT -->
## 연락처

프로젝트 링크: [https://github.com/your_username/soop-audio](https://github.com/your_username/soop-audio)

<p align="right">(<a href="#readme-top">맨 위로</a>)</p>