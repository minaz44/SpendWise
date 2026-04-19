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
  leaveGroup,
} = require('../controllers/group.controller');

const {
  createSplit,
  getSplits,
  getSplitDetail,
  updateSplit,
  deleteSplit,
  getBalances,
  settleSplit,
  settleAll,
  getGroupAnalytics,
  addComment,
  deleteComment,
  uploadBill,
  deleteBill,
  getOwedSummary,   // ← NEW
} = require('../controllers/split.controller');

const { protect } = require('../middleware/auth.middleware');

router.use(protect);

//─────────────────────────────────────
// Dashboard summary — MUST be before /:id so Express doesn't treat
// "owed-summary" as a group ID param
//─────────────────────────────────────
router.get('/owed-summary', getOwedSummary);   // ← NEW

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
router.delete('/:id/members/:memberId', removeMember);  // memberId = member._id (subdoc)
router.post('/:id/leave',               leaveGroup);

// Invite link
router.post('/:id/invite/regenerate',   async (req, res) => {
  try {
    const Group  = require('../models/Group');
    const crypto = require('crypto');
    const group  = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const member = group.members.find(m => m.userId?.toString() === req.user._id?.toString());
    if (!member || member.role !== 'admin') return res.status(403).json({ message: 'Only admin can regenerate invite link' });
    group.inviteToken = crypto.randomBytes(16).toString('hex');
    await group.save();
    res.json({ inviteToken: group.inviteToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Join via invite link
router.post('/join/:token', async (req, res) => {
  try {
    const Group = require('../models/Group');
    const group = await Group.findOne({ inviteToken: req.params.token });
    if (!group) return res.status(404).json({ message: 'Invalid or expired invite link' });
    const already = group.members.some(m => m.userId?.toString() === req.user._id?.toString());
    if (already) return res.json({ message: 'Already a member', group });
    group.members.push({ userId: req.user._id, name: req.user.name, email: req.user.email, role: 'member' });
    await group.save();
    res.json({ message: 'Joined group!', group });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//─────────────────────────────────────
// Split / expense routes (nested under group)
//─────────────────────────────────────
router.post('/:groupId/splits',                             createSplit);
router.get('/:groupId/splits',                              getSplits);
router.get('/:groupId/splits/:splitId/detail',              getSplitDetail);
router.put('/:groupId/splits/:splitId',                     updateSplit);      // ← EDIT EXPENSE
router.delete('/:groupId/splits/:splitId',                  deleteSplit);      // ← DELETE EXPENSE
router.get('/:groupId/balances',                            getBalances);
router.get('/:groupId/analytics',                           getGroupAnalytics);
router.put('/:groupId/splits/:splitId/settle',              settleSplit);
router.post('/:groupId/settle-all',                         settleAll);

// Comments
router.post('/:groupId/splits/:splitId/comments',                    addComment);
router.delete('/:groupId/splits/:splitId/comments/:commentId',       deleteComment);

// Bill upload
router.post('/:groupId/splits/:splitId/bill',   uploadBill);
router.delete('/:groupId/splits/:splitId/bill', deleteBill);

module.exports = router;