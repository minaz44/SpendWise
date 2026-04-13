// backend/src/controllers/splitDetail.controller.js
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// We reuse the existing Split model — just extend it with comments & billImage
// These fields will be added to the Split schema (see splitDetail.model.patch.js)

let Split, Group;
try {
  Split = mongoose.model('Split');
} catch {
  Split = require('../models/Split.model');
}
try {
  Group = mongoose.model('Group');
} catch {
  Group = require('../models/Group.model');
}

// ── GET /groups/:groupId/splits/:splitId/detail ───────────────────────────────
exports.getSplitDetail = async (req, res) => {
  try {
    const { groupId, splitId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    const isMember = group.members.some(m => m.userId?.toString() === userId.toString());
    if (!isMember) return res.status(403).json({ success: false, message: 'Not a group member' });

    const split = await Split.findById(splitId).lean();
    if (!split) return res.status(404).json({ success: false, message: 'Split not found' });

    // Build spending trends for this split's category across last 3 months
    const category = split.category || 'General';
    const now = new Date();
    const trends = [];

    for (let i = 2; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      const monthSplits = await Split.find({
        groupId,
        category,
        date: { $gte: start, $lte: end },
        isDeleted: { $ne: true },
      }).lean();

      const total = monthSplits.reduce((s, sp) => s + (sp.totalAmount || 0), 0);
      trends.push({
        month: start.toLocaleString('en-IN', { month: 'short' }),
        amount: parseFloat(total.toFixed(2)),
      });
    }

    res.json({ success: true, split, trends });
  } catch (err) {
    console.error('getSplitDetail error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── PUT /groups/:groupId/splits/:splitId ─────────────────────────────────────
exports.updateSplit = async (req, res) => {
  try {
    const { groupId, splitId } = req.params;
    const userId = req.user._id;
    const { title, totalAmount, category, notes } = req.body;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    const isMember = group.members.some(m => m.userId?.toString() === userId.toString());
    if (!isMember) return res.status(403).json({ success: false, message: 'Not a group member' });

    const split = await Split.findById(splitId);
    if (!split) return res.status(404).json({ success: false, message: 'Split not found' });

    if (title)       split.title       = title.trim();
    if (category)    split.category    = category.trim();
    if (notes !== undefined) split.notes = notes;
    if (totalAmount && !isNaN(totalAmount)) split.totalAmount = parseFloat(totalAmount);

    await split.save();
    res.json({ success: true, split });
  } catch (err) {
    console.error('updateSplit error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /groups/:groupId/splits/:splitId/bill ────────────────────────────────
exports.uploadBill = async (req, res) => {
  try {
    const { splitId } = req.params;

    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const split = await Split.findById(splitId);
    if (!split) return res.status(404).json({ success: false, message: 'Split not found' });

    // Store relative path — serve statically from /uploads
    split.billImage = `/uploads/bills/${req.file.filename}`;
    await split.save();

    res.json({ success: true, billImage: split.billImage });
  } catch (err) {
    console.error('uploadBill error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── DELETE /groups/:groupId/splits/:splitId/bill ──────────────────────────────
exports.deleteBill = async (req, res) => {
  try {
    const { splitId } = req.params;
    const split = await Split.findById(splitId);
    if (!split) return res.status(404).json({ success: false, message: 'Split not found' });

    if (split.billImage) {
      const filePath = path.join(__dirname, '../../public', split.billImage);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      split.billImage = null;
      await split.save();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── POST /groups/:groupId/splits/:splitId/comments ───────────────────────────
exports.addComment = async (req, res) => {
  try {
    const { groupId, splitId } = req.params;
    const userId = req.user._id;
    const { text } = req.body;

    if (!text?.trim()) return res.status(400).json({ success: false, message: 'Comment text required' });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    const member = group.members.find(m => m.userId?.toString() === userId.toString());
    if (!member) return res.status(403).json({ success: false, message: 'Not a group member' });

    const split = await Split.findById(splitId);
    if (!split) return res.status(404).json({ success: false, message: 'Split not found' });

    if (!split.comments) split.comments = [];

    const comment = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      userName: member.name,
      text: text.trim(),
      createdAt: new Date(),
    };

    split.comments.push(comment);
    await split.save();

    res.json({ success: true, comment });
  } catch (err) {
    console.error('addComment error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── DELETE /groups/:groupId/splits/:splitId/comments/:commentId ───────────────
exports.deleteComment = async (req, res) => {
  try {
    const { splitId, commentId } = req.params;
    const userId = req.user._id;

    const split = await Split.findById(splitId);
    if (!split) return res.status(404).json({ success: false, message: 'Split not found' });

    const commentIdx = split.comments?.findIndex(
      c => c._id?.toString() === commentId && c.userId?.toString() === userId.toString()
    );

    if (commentIdx === -1 || commentIdx === undefined) {
      return res.status(403).json({ success: false, message: 'Cannot delete this comment' });
    }

    split.comments.splice(commentIdx, 1);
    await split.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};