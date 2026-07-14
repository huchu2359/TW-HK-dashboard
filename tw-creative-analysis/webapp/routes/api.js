const express = require('express');
const db = require('../database');

module.exports = function (io) {
  const router = express.Router();

  // GET /api/dashboard — 전체 조회 (concepts + issues, 프론트에서 type/region으로 재구성)
  router.get('/dashboard', async (req, res) => {
    try {
      const items = await db.getAllItems();
      res.json(items);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/dashboard — 신규 소재/이슈 추가
  router.post('/dashboard', async (req, res) => {
    try {
      const item = await db.createItem(req.body || {});
      io.emit('dashboard:create', item);
      res.status(201).json(item);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // PUT /api/dashboard/:id — 수정 (메모/판정/승인/드래그 순서 등)
  router.put('/dashboard/:id', async (req, res) => {
    try {
      const item = await db.updateItem(Number(req.params.id), req.body || {});
      if (!item) return res.status(404).json({ error: 'not found' });
      io.emit('dashboard:update', item);
      res.json(item);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/dashboard/:id — 삭제
  router.delete('/dashboard/:id', async (req, res) => {
    try {
      const result = await db.deleteItem(Number(req.params.id));
      io.emit('dashboard:delete', result);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
