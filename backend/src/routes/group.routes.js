// backend/src/routes/group.routes.js
// ── REPLACE your existing group.routes.js with this file ─────────────────────

const express = require('express');
const router  = express.Router();

const {
  createGroup,
  getGroups,
  getGroup,
  updateGroup,
  addMember,
  removeMember,
  deleteGroup,
} = require('../controllers/group.controller');

const {
  createSplit,
  getSplits,
  getBalances,
  settleSplit,
  settleAll,
  getGroupAnalytics,
} = require('../controllers/split.controller');

const {
  getSplitDetail,
  updateSplit,
  uploadBill,
  deleteBill,
  addComment,
  deleteComment,
} = require('../controllers/splitDetail.controller');

const upload  = require('../middleware/upload.middleware');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

//─────────────────────────────────────
// Group routes
//─────────────────────────────────────
router.get('/',    getGroups);
router.post('/',   createGroup);
router.get('/:id', getGroup);
router.put('/:id', updateGroup);
router.delete('/:id', deleteGroup);

// Members
router.post('/:id/members',             addMember);
router.delete('/:id/members/:memberId', removeMember);

//─────────────────────────────────────
// Split routes (nested under group)
//─────────────────────────────────────
router.post('/:groupId/splits',                  createSplit);
router.get('/:groupId/splits',                   getSplits);
router.get('/:groupId/balances',                 getBalances);
router.get('/:groupId/analytics',                getGroupAnalytics);
router.put('/:groupId/splits/:splitId/settle',   settleSplit);
router.post('/:groupId/settle-all',              settleAll);

//─────────────────────────────────────
// Split Detail routes  ← NEW
//─────────────────────────────────────
// Get full detail + spending trends
router.get('/:groupId/splits/:splitId/detail',   getSplitDetail);

// Edit a split's title / amount / category / notes
router.put('/:groupId/splits/:splitId',          updateSplit);

// Bill image upload / delete
router.post(
  '/:groupId/splits/:splitId/bill',
  upload.single('bill'),
  uploadBill
);
router.delete('/:groupId/splits/:splitId/bill',  deleteBill);

// Comments
router.post('/:groupId/splits/:splitId/comments',              addComment);
router.delete('/:groupId/splits/:splitId/comments/:commentId', deleteComment);

module.exports = router;