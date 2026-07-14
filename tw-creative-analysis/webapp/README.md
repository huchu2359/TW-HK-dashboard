# 대만/홍콩 소재분석 대시보드 (실시간 협업판)

Express + SQLite + Socket.IO 기반 실시간 협업 웹앱입니다. Firebase는 사용하지 않습니다.

## 실행 방법

```bash
npm install
npm start
```

실행 후 브라우저에서 `http://localhost:3000` 접속.

첫 실행 시 `dashboard.db`(SQLite 파일)가 자동 생성되고, 기존 대만/홍콩 소재 데이터가 자동으로 시드(seed)됩니다.

## 구조

```
webapp/
├── server.js              Express + Socket.IO 서버 진입점
├── database.js            SQLite 연결, CRUD 헬퍼, 최초 1회 시드
├── package.json
├── routes/
│   └── api.js              GET/POST/PUT/DELETE /api/dashboard
├── database_seed_source/   최초 시드용 원본 데이터(JSON)
└── public/
    ├── index.html          화면 마크업 (기존 디자인 그대로 유지)
    ├── style.css            기존 스타일 그대로 유지
    └── app.js               화면 렌더링 + REST/Socket.IO 클라이언트 로직
```

## 실시간 협업 동작 방식

- 브라우저가 접속하면 `GET /api/dashboard`로 전체 데이터를 한 번 받아온 뒤, Socket.IO에 연결합니다.
- 팀 메모 수정 / 성과판정·승인상태 변경 / 소재 추가 / 소재 삭제 / 일별 스냅샷 기록은 모두 REST API(`POST`/`PUT`/`DELETE /api/dashboard`)를 호출합니다.
- 서버는 SQLite에 반영한 뒤 `dashboard:create` / `dashboard:update` / `dashboard:delete` 소켓 이벤트를 **접속한 모든 클라이언트**에게 브로드캐스트합니다.
- 그래서 한 사람이 수정하면 새로고침 없이 다른 모든 사람의 화면에 즉시 반영됩니다.
- 새로고침해도 `GET /api/dashboard`가 SQLite에서 다시 읽어오므로 데이터는 그대로 유지됩니다.

## API

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/dashboard` | 전체 소재/이슈/일별로그 조회 |
| POST | `/api/dashboard` | 신규 항목 생성 (`type: 'concept' \| 'issue' \| 'dailylog'`) |
| PUT | `/api/dashboard/:id` | 항목 부분 수정 |
| DELETE | `/api/dashboard/:id` | 항목 삭제 |

## 데이터 초기화가 필요할 때

`dashboard.db` 파일을 삭제하고 서버를 다시 시작하면(`npm start`) 기존 시드 데이터로 다시 초기화됩니다.
