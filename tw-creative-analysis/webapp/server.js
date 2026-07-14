const express = require('express');
const path = require('path');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 💡 첫 화면(대시보드)이 정상적으로 뜨도록 static 폴더 지정
app.use(express.static(path.join(__dirname, 'public')));

// API 라우터 연결
app.use('/api', apiRouter);

// 서버 실행 (Railway 호환용 0.0.0.0 바인딩)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});