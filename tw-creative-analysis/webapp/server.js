const express = require('express');
const path = require('path');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 💡 첫 화면(대시보드)이 정상적으로 뜨도록 static 폴더 지정
app.use(express.static(path.join(__dirname, 'public')));

// API 라우터 연결 (Socket.IO 인스턴스를 넘겨줘야 실시간 브로드캐스트가 동작함)
app.use('/api', require('./routes/api')(io));

io.on('connection', (socket) => {
  console.log('[socket] client connected:', socket.id);
  socket.on('disconnect', () => console.log('[socket] client disconnected:', socket.id));
});

// DB 초기화(최초 1회 시드) 후 서버 실행 (Railway 호환용 0.0.0.0 바인딩)
db.init()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('DB 초기화 실패:', err);
    process.exit(1);
  });