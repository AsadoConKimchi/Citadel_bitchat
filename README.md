# Citadel Bitchat - Discord 익명채팅 Activity

디스코드 음성채널에서 [bitchat.land](https://bitchat.land) 익명 채팅을 사용할 수 있는 Discord Activity입니다.

Discord Embedded App SDK를 활용하여 bitchat.land를 디스코드 UI 안에 iframe으로 임베딩합니다. 사용자는 디스코드 프로필과 무관하게 bitchat의 익명 pseudonym으로 채팅할 수 있습니다.

## 주요 기능

- 디스코드 음성채널에서 Activity로 bitchat 익명 채팅 실행
- 지오해시(geohash) 기반 채팅 채널 자동 접속 (기본값: `wy`)
- 채팅 중 지오해시 변경 가능
- 디스코드 프로필 정보가 채팅에 노출되지 않음

## 프로젝트 구조

```
├── client/             # 프론트엔드 (Vite + Discord SDK)
│   ├── index.html
│   ├── src/
│   │   ├── main.js     # Discord SDK 초기화 + bitchat iframe 로직
│   │   └── style.css   # Discord 테마 스타일링
│   ├── package.json
│   └── vite.config.js
├── server/             # 백엔드 (Express)
│   ├── src/
│   │   └── app.js      # OAuth2 토큰 교환 엔드포인트
│   └── package.json
├── .env.example        # 환경변수 템플릿
└── package.json        # 루트 (스크립트 통합)
```

## 설정 가이드

### 1. Discord Developer Portal 설정

1. [Discord Developer Portal](https://discord.com/developers/applications)에서 **New Application** 생성
2. **General Information** 탭에서 `APPLICATION ID` (= Client ID) 복사
3. **OAuth2** 탭에서 `CLIENT SECRET` 복사
4. **OAuth2** > **Redirects**에 리다이렉트 URL 추가:
   - 개발: `https://your-tunnel-url.trycloudflare.com`
   - 프로덕션: 배포된 URL
5. **Activities** 탭 활성화:
   - URL Mappings에서 `/` 경로를 Activity URL로 매핑
   - 개발 시: Target을 tunnel URL로 설정
   - 프로덕션: 배포 URL로 설정

### 2. 환경변수 설정

프로젝트 루트에 `.env` 파일 생성:

```bash
cp .env.example .env
```

`.env` 파일 편집:

```env
VITE_DISCORD_CLIENT_ID=여기에_클라이언트_ID_입력
DISCORD_CLIENT_SECRET=여기에_클라이언트_시크릿_입력
```

### 3. 의존성 설치

```bash
npm run install:all
```

### 4. 개발 서버 실행

터미널 1 - 개발 서버:
```bash
npm run dev
```

터미널 2 - Cloudflare 터널 (로컬 개발 시 HTTPS 필요):
```bash
npm run tunnel
```

터널이 생성한 URL을 Discord Developer Portal의 URL Mapping에 등록하세요.

### 5. 프로덕션 빌드 및 배포

```bash
npm run build
npm start
```

## 배포 옵션

### Cloudflare Pages
1. GitHub 리포지토리 연결
2. 빌드 명령: `cd client && npm install && npm run build`
3. 출력 디렉토리: `client/dist`
4. 서버는 별도 Cloudflare Worker 또는 다른 호스팅에 배포

### Vercel
1. GitHub 리포지토리 연결
2. Root Directory: `client`
3. 서버는 Vercel Serverless Functions 또는 별도 배포

### Railway
1. GitHub 리포지토리 연결
2. 서버와 클라이언트를 함께 배포 가능
3. 환경변수를 Railway 대시보드에서 설정

## 지오해시 설정

기본 지오해시는 `wy` (한국 전체 영역)입니다. Activity 화면 상단에서 다른 지오해시로 변경할 수 있습니다.

유용한 지오해시 예시:
| 지오해시 | 지역 |
|----------|------|
| `wy` | 한국 전체 |
| `wydm` | 서울 근처 |
| `wydn` | 서울 동부 |
| `wy6` | 부산 근처 |

[지오해시 탐색기](https://geohash.softeng.co/)에서 원하는 지역의 지오해시를 찾을 수 있습니다.

## 기술 스택

- **프론트엔드**: Vite + Vanilla JavaScript
- **Discord SDK**: @discord/embedded-app-sdk
- **백엔드**: Node.js + Express
- **채팅**: bitchat.land (Nostr 프로토콜 기반 P2P 메신저)

## 라이선스

MIT
