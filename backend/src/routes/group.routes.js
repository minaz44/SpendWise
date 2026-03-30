// backend/src/routes/group.routes.js

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
router.post('/:id/members',                addMember);
router.delete('/:id/members/:memberId',    removeMember);

//─────────────────────────────────────
// Split routes (nested under group)
//─────────────────────────────────────
router.post('/:groupId/splits',                        createSplit);
router.get('/:groupId/splits',                         getSplits);
router.get('/:groupId/balances',                       getBalances);
router.get('/:groupId/analytics',                      getGroupAnalytics);
router.put('/:groupId/splits/:splitId/settle',         settleSplit);
router.post('/:groupId/settle-all',                    settleAll);

module.exports = router;