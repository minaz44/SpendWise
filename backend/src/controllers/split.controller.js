// backend/src/controllers/split.controller.js

const Split       = require('../models/Split.model');
const Group       = require('../models/Group.model');
const Transaction = require('../models/Transaction.model'); // ← NEW

//─────────────────────────────────────
// HELPER — calculate balances for a group
// Handles legacy splits where share.userId was stored as null.
//─────────────────────────────────────
const calculateBalances = (splits, members) => {
  const net = {};

  // Build name → userId map for resolving legacy null-userId shares
  const userIdByName = {};
  members.forEach(m => {
    const key = m.userId?.toString();
    if (key) {
      net[key] = 0;
      if (m.name) userIdByName[m.name.trim().toLowerCase()] = key;
    }
  });

  splits.forEach(split => {
    const payerId = split.paidBy?.toString();
    if (!payerId || !(payerId in net)) return;

    split.shares.forEach(share => {
      // Primary: use userId. Fallback: resolve from name (legacy data)
      let shareUserId = share.userId?.toString();
      if (!shareUserId && share.name) {
        shareUserId = userIdByName[share.name.trim().toLowerCase()];
      }

      if (!shareUserId || !(shareUserId in net)) return;
      if (shareUserId === payerId) return; // payer's own share is not a debt

      if (!share.isPaid) {
        net[payerId]     = (net[payerId]     || 0) + share.amount;
        net[shareUserId] = (net[shareUserId] || 0) - share.amount;
      }
    });
  });

  // Simplify debts using greedy min-cash-flow algorithm
  const debts = [];
  const c = Object.entries(net).filter(([, v]) => v >  0.005).map(([id, amt]) => ({ id, amt })).sort((a, b) => b.amt - a.amt);
  const d = Object.entries(net).filter(([, v]) => v < -0.005).map(([id, amt]) => ({ id, amt: -amt })).sort((a, b) => b.amt - a.amt);

  let i = 0, j = 0;
  while (i < c.length && j < d.length) {
    const settle = Math.min(c[i].amt, d[j].amt);
    debts.push({ from: d[j].id, to: c[i].id, amount: parseFloat(settle.toFixed(2)) });
    c[i].amt -= settle;
    d[j].amt -= settle;
    if (c[i].amt < 0.005) i++;
    if (d[j].amt < 0.005) j++;
  }

  return { net, debts };
};

//─────────────────────────────────────
// POST /api/groups/:groupId/splits
// Add expense split
//─────────────────────────────────────
const createSplit = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const {
      title, description, totalAmount, currency,
      category, date, splitType, shares,
    } = req.body;

    const group = await Group.findById(groupId).lean();
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    if (!group.members.some(m => m.userId?.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'You are not a member of this group.' });
    }

    if (!title || !totalAmount) {
      return res.status(400).json({ success: false, message: 'title and totalAmount are required.' });
    }

    // Resolve paidBy — use req.body.paidBy if provided and valid, else current user
    // Always resolve to the actual member entry so we get the correct userId
    const requestedPayer = req.body.paidBy?.toString();
    const paidByMember   = requestedPayer
      ? group.members.find(m => m.userId?.toString() === requestedPayer)
      : group.members.find(m => m.userId?.toString() === req.user._id.toString());

    // If the requested payer isn't a recognised member, fall back to current user
    const resolvedPayer = paidByMember || group.members.find(m => m.userId?.toString() === req.user._id.toString());
    const paidByUserId  = resolvedPayer?.userId?.toString() || req.user._id.toString();
    const paidByName    = resolvedPayer?.name || req.user.name;

    let finalShares = [];

    if (splitType === 'equal' || !splitType) {
      const memberList = shares?.length > 0 ? shares : group.members;
      const count      = memberList.length;
      const perPerson  = parseFloat((totalAmount / count).toFixed(2));
      const remainder  = parseFloat((totalAmount - perPerson * (count - 1)).toFixed(2));

      finalShares = memberList.map((m, idx) => ({
        userId: m.userId || null,
        name:   m.name,
        amount: idx === 0 ? remainder : perPerson,
        // The payer's own share is already "paid" — everyone else owes
        isPaid: m.userId?.toString() === paidByUserId,
      }));

    } else if (splitType === 'custom') {
      if (!shares?.length) {
        return res.status(400).json({ success: false, message: 'shares array is required for custom split.' });
      }
      const total = shares.reduce((s, sh) => s + (sh.amount || 0), 0);
      if (Math.abs(total - totalAmount) > 0.5) {
        return res.status(400).json({
          success: false,
          message: `Share amounts (₹${total}) must equal total amount (₹${totalAmount}).`,
        });
      }
      finalShares = shares.map(sh => ({
        userId: sh.userId || null,
        name:   sh.name,
        amount: sh.amount,
        isPaid: sh.userId?.toString() === paidByUserId,
      }));

    } else if (splitType === 'percentage') {
      if (!shares?.length) {
        return res.status(400).json({ success: false, message: 'shares array is required for percentage split.' });
      }
      const totalPct = shares.reduce((s, sh) => s + (sh.percentage || 0), 0);
      if (Math.abs(totalPct - 100) > 0.1) {
        return res.status(400).json({ success: false, message: 'Percentages must add up to 100%.' });
      }
      finalShares = shares.map(sh => ({
        userId:     sh.userId || null,
        name:       sh.name,
        percentage: sh.percentage,
        amount:     parseFloat((totalAmount * sh.percentage / 100).toFixed(2)),
        isPaid:     sh.userId?.toString() === paidByUserId,
      }));
    }

    const split = await Split.create({
      groupId,
      paidBy:      paidByUserId,
      paidByName,              // ← stored so list view doesn't need a join
      title,
      description: description || null,
      totalAmount,
      currency:    currency || group.currency || 'INR',
      category:    category || 'General',
      date:        date     || new Date(),
      splitType:   splitType || 'equal',
      shares:      finalShares,
    });

    // Update group running total
    await Group.findByIdAndUpdate(groupId, {
      $inc: { totalExpenses: totalAmount },
    });

    // ── AUTO-CREATE TRANSACTION FOR THE PAYER ──────────────────────────────
    // Records the full payment in the payer's transaction history and stores
    // how much they'll get back. Only runs when the logged-in user is the
    // payer (we can't create transactions on behalf of other users).
    // Non-fatal: if it fails the split is still saved successfully.
    // ───────────────────────────────────────────────────────────────────────
    try {
      if (paidByUserId === req.user._id.toString()) {
        // Payer's own share of the expense
        const payerShareEntry = finalShares.find(
          s => s.userId?.toString() === paidByUserId
        );
        const myShare         = payerShareEntry ? payerShareEntry.amount : 0;
        // What others owe back to the payer
        const amountToGetBack = parseFloat((totalAmount - myShare).toFixed(2));
        const otherCount      = finalShares.filter(
          s => s.userId?.toString() !== paidByUserId
        ).length;

        const noteParts = [];
        if (amountToGetBack > 0) {
          noteParts.push(`You'll get back ₹${amountToGetBack.toFixed(2)} from ${otherCount} member(s).`);
        }
        noteParts.push(`Your personal share: ₹${myShare.toFixed(2)}.`);

        await Transaction.create({
          userId:       req.user._id,
          type:         'expense',
          amount:       totalAmount,                        // full amount paid e.g. ₹600
          currency:     currency || group.currency || 'INR',
          merchant:     group.name,                         // group name as merchant
          description:  `[Group] ${title}`,
          categoryName: category || 'Group Expense',
          date:         date ? new Date(date) : new Date(),
          source:       'group',
          tags:         ['group-expense', 'split'],
          notes:        noteParts.join(' '),
          groupId:      group._id,
          splitId:      split._id,
          isGroupExpense: true,
          groupExpenseMeta: {
            groupId:         group._id,
            groupName:       group.name,
            splitId:         split._id,
            splitTitle:      title,
            amountToGetBack: amountToGetBack,
            myShare:         myShare,
            memberCount:     finalShares.length,
          },
        });
      }
    } catch (txnErr) {
      console.error('[createSplit] Auto-transaction failed:', txnErr.message);
    }
    // ───────────────────────────────────────────────────────────────────────

    return res.status(201).json({
      success: true,
      message: 'Expense split created.',
      data: { split },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// GET /api/groups/:groupId/splits
// Get all splits for a group — includes full shares[] so frontend
// can determine involvement without an extra detail request.
//─────────────────────────────────────
const getSplits = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const page  = Math.max(1, parseInt(req.query.page  || '1'));
    const limit = Math.min(50, parseInt(req.query.limit || '50')); // default 50 to show all
    const skip  = (page - 1) * limit;

    const group = await Group.findById(groupId).lean();
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    if (!group.members.some(m => m.userId?.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Not a group member.' });
    }

    // Normalise helper — strips extra whitespace and lowercases
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

    // Build bidirectional lookups from group members
    const nameById     = {};  // userId → display name
    const userIdByName = {};  // normalised name → userId string
    group.members.forEach(m => {
      const uid = m.userId?.toString();
      if (!uid) return;
      nameById[uid] = m.name;
      if (m.name) userIdByName[norm(m.name)] = uid;
    });

    const [splits, total] = await Promise.all([
      Split.find({ groupId }).sort({ date: -1 }).skip(skip).limit(limit).lean(),
      Split.countDocuments({ groupId }),
    ]);

    // Enrich each split:
    // 1. Backfill paidByName for old documents
    // 2. Resolve share.userId from name for legacy equal splits (stored as null)
    const enriched = splits.map(sp => {
      const paidByName = sp.paidByName || nameById[sp.paidBy?.toString()] || 'Someone';

      const shares = (sp.shares || []).map(share => {
        // Already has a valid userId — leave it
        const existingId = share.userId?.toString?.();
        if (existingId && existingId !== 'null' && existingId !== 'undefined') return share;

        // Resolve from name
        const resolvedId = userIdByName[norm(share.name)];
        return resolvedId ? { ...share, userId: resolvedId } : share;
      });

      return { ...sp, paidByName, shares };
    });

    return res.status(200).json({
      success: true,
      data: {
        splits: enriched,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// GET /api/groups/:groupId/balances
// Returns:
//   myBalance    — net balance for the requesting user
//   iOwe         — debts where current user owes someone { from, to, amount }
//   owedToMe     — debts where someone owes current user { from, to, amount }
//   allDebts     — all simplified debts in the group (for Balances tab)
//   netBalances  — { userId: netAmount } map (positive = owed, negative = owes)
//   memberBalances — array version for rendering, with names resolved
//─────────────────────────────────────
const getBalances = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId).lean();
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    if (!group.members.some(m => m.userId?.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Not a group member.' });
    }

    const splits = await Split.find({ groupId, isSettled: false }).lean();
    const { net, debts } = calculateBalances(splits, group.members);

    const myId      = req.user._id.toString();
    const myBalance = net[myId] || 0;

    // Debts for the current user specifically
    const iOwe    = debts.filter(d => d.from === myId);
    const owedToMe = debts.filter(d => d.to   === myId);

    // Resolve member names for the full member balance list
    const nameById = {};
    group.members.forEach(m => {
      if (m.userId) nameById[m.userId.toString()] = m.name;
    });

    // memberBalances: one entry per group member, with name + net
    const memberBalances = group.members
      .filter(m => m.userId)
      .map(m => ({
        userId:     m.userId.toString(),
        name:       m.name,
        netBalance: net[m.userId.toString()] || 0,
      }))
      .filter(m => Math.abs(m.netBalance) > 0.005 || debts.some(
        d => d.from === m.userId || d.to === m.userId
      ));

    return res.status(200).json({
      success: true,
      data: {
        myBalance,
        iOwe,
        owedToMe,
        allDebts:       debts,
        netBalances:    net,
        memberBalances,
        totalGroupExpenses: group.totalExpenses,
      },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// PUT /api/groups/:groupId/splits/:splitId/settle
// Mark a share as paid / settle
//─────────────────────────────────────
const settleSplit = async (req, res, next) => {
  try {
    const { groupId, splitId } = req.params;
    const { userId } = req.body;

    const split = await Split.findOne({ _id: splitId, groupId });
    if (!split) {
      return res.status(404).json({ success: false, message: 'Split not found.' });
    }

    const targetUserId = userId || req.user._id.toString();

    const share = split.shares.find(s => s.userId?.toString() === targetUserId);
    if (!share) {
      return res.status(404).json({ success: false, message: 'Share not found for this user.' });
    }

    share.isPaid = true;
    share.paidAt = new Date();

    const allPaid = split.shares.every(s =>
      s.isPaid || s.userId?.toString() === split.paidBy?.toString()
    );
    if (allPaid) {
      split.isSettled = true;
      split.settledAt = new Date();
    }

    await split.save();

    return res.status(200).json({
      success: true,
      message: allPaid ? 'Split fully settled!' : 'Share marked as paid.',
      data: { split },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// POST /api/groups/:groupId/settle-all
//─────────────────────────────────────
const settleAll = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { withUserId } = req.body;

    if (!withUserId) {
      return res.status(400).json({ success: false, message: 'withUserId is required.' });
    }

    const splits = await Split.find({ groupId, isSettled: false, paidBy: withUserId });

    let settledCount = 0;
    for (const split of splits) {
      const share = split.shares.find(
        s => s.userId?.toString() === req.user._id.toString() && !s.isPaid
      );
      if (share) {
        share.isPaid = true;
        share.paidAt = new Date();
        settledCount++;

        const allPaid = split.shares.every(
          s => s.isPaid || s.userId?.toString() === split.paidBy?.toString()
        );
        if (allPaid) {
          split.isSettled = true;
          split.settledAt = new Date();
        }
        await split.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: `Settled ${settledCount} expense(s).`,
      data: { settledCount },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// GET /api/groups/:groupId/analytics
//─────────────────────────────────────
const getGroupAnalytics = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const group  = await Group.findById(groupId).lean();
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });

    const splits = await Split.find({ groupId }).lean();

    const byCategory = {};
    splits.forEach(s => { byCategory[s.category || 'General'] = (byCategory[s.category || 'General'] || 0) + s.totalAmount; });

    const byMember = {};
    splits.forEach(s => {
      const k = s.paidBy?.toString();
      if (k) byMember[k] = (byMember[k] || 0) + s.totalAmount;
    });

    const byMonth = {};
    splits.forEach(s => {
      const key = new Date(s.date).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      byMonth[key] = (byMonth[key] || 0) + s.totalAmount;
    });

    return res.status(200).json({
      success: true,
      data: {
        totalExpenses:  group.totalExpenses,
        totalSplits:    splits.length,
        settledSplits:  splits.filter(s => s.isSettled).length,
        pendingSplits:  splits.filter(s => !s.isSettled).length,
        byCategory, byMember, byMonth,
        perMemberAvg: group.members.length > 0
          ? parseFloat((group.totalExpenses / group.members.length).toFixed(2))
          : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// GET /api/groups/:groupId/splits/:splitId/detail
//─────────────────────────────────────
const getSplitDetail = async (req, res, next) => {
  try {
    const { groupId, splitId } = req.params;

    const group = await Group.findById(groupId).lean();
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });

    if (!group.members.some(m => m.userId?.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Not a group member.' });
    }

    const split = await Split.findOne({ _id: splitId, groupId }).lean();
    if (!split) return res.status(404).json({ success: false, message: 'Split not found.' });

    // Backfill paidByName if missing
    if (!split.paidByName) {
      const payer = group.members.find(m => m.userId?.toString() === split.paidBy?.toString());
      split.paidByName = payer?.name || 'Someone';
    }

    return res.status(200).json({ success: true, data: { split } });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// Comments
//─────────────────────────────────────
const addComment = async (req, res, next) => {
  try {
    const { groupId, splitId } = req.params;
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, message: 'Comment text is required.' });

    const split = await Split.findOne({ _id: splitId, groupId });
    if (!split) return res.status(404).json({ success: false, message: 'Split not found.' });

    const comment = { userId: req.user._id, userName: req.user.name, text: text.trim(), createdAt: new Date() };
    split.comments = split.comments || [];
    split.comments.push(comment);
    await split.save();

    // Emit socket event
    try {
      const io = req.app.get('io');
      if (io) io.to(`split:${splitId}`).emit('new_comment', { splitId, comment });
    } catch (_) {}

    return res.status(201).json({ success: true, message: 'Comment added.', data: { comment } });
  } catch (error) {
    next(error);
  }
};

const deleteComment = async (req, res, next) => {
  try {
    const { groupId, splitId, commentId } = req.params;
    const split = await Split.findOne({ _id: splitId, groupId });
    if (!split) return res.status(404).json({ success: false, message: 'Split not found.' });

    const idx = (split.comments || []).findIndex(c => c._id?.toString() === commentId);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Comment not found.' });

    if (split.comments[idx].userId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised to delete this comment.' });
    }

    split.comments.splice(idx, 1);
    await split.save();

    try {
      const io = req.app.get('io');
      if (io) io.to(`split:${splitId}`).emit('delete_comment', { splitId, commentId });
    } catch (_) {}

    return res.status(200).json({ success: true, message: 'Comment deleted.' });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// Bill upload / delete
//─────────────────────────────────────
const uploadBill = async (req, res, next) => {
  try {
    const { groupId, splitId } = req.params;
    const split = await Split.findOne({ _id: splitId, groupId });
    if (!split) return res.status(404).json({ success: false, message: 'Split not found.' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    split.billUrl = req.file.path || req.file.location || req.file.filename;
    split.billOrigName = req.file.originalname;
    await split.save();

    return res.status(200).json({ success: true, message: 'Bill uploaded.', data: { billUrl: split.billUrl } });
  } catch (error) {
    next(error);
  }
};

const deleteBill = async (req, res, next) => {
  try {
    const { groupId, splitId } = req.params;
    const split = await Split.findOne({ _id: splitId, groupId });
    if (!split) return res.status(404).json({ success: false, message: 'Split not found.' });

    split.billUrl = undefined;
    split.billOrigName = undefined;
    await split.save();

    return res.status(200).json({ success: true, message: 'Bill removed.' });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// Update split
//─────────────────────────────────────
const updateSplit = async (req, res) => {
  try {
    const { groupId, splitId } = req.params;
    const { title, totalAmount, category, splitType, paidBy, notes, shares } = req.body;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const member = group.members.find(m => m.userId?.toString() === req.user._id?.toString());
    if (!member) return res.status(403).json({ message: 'Not a member of this group' });

    const split = await Split.findOne({ _id: splitId, groupId });
    if (!split) return res.status(404).json({ message: 'Expense not found' });

    if (title       !== undefined) split.title      = title.trim();
    if (totalAmount !== undefined) split.totalAmount = parseFloat(totalAmount);
    if (category    !== undefined) split.category    = category.trim();
    if (notes       !== undefined) split.notes       = notes;

    if (paidBy !== undefined) {
      const paidByMember = group.members.find(m => m.userId?.toString() === paidBy?.toString());
      split.paidBy     = paidBy;
      split.paidByName = paidByMember?.name || split.paidByName;
    }

    if (splitType !== undefined) {
      const paidByStr = split.paidBy?.toString();
      split.splitType = splitType;
      if (splitType === 'equal') {
        const memberList = (shares && shares.length > 0) ? shares : group.members;
        const perPerson  = split.totalAmount / memberList.length;
        split.shares = memberList.map(m => ({
          userId: m.userId,
          name:   m.name,
          amount: parseFloat(perPerson.toFixed(2)),
          isPaid: m.userId?.toString() === paidByStr,
        }));
      } else if (shares && Array.isArray(shares)) {
        split.shares = shares.map(s => ({
          userId:     s.userId,
          name:       s.name,
          amount:     s.amount     ? parseFloat(s.amount)     : parseFloat((split.totalAmount / group.members.length).toFixed(2)),
          percentage: s.percentage ? parseFloat(s.percentage) : undefined,
          isPaid:     s.userId?.toString() === paidByStr,
        }));
      }
    }

    await split.save();

    const io = req.app.get('io');
    if (io) io.to(`group_${groupId}`).emit('split_updated', { groupId, split });

    return res.status(200).json({ success: true, message: 'Expense updated successfully.', data: { split } });
  } catch (err) {
    console.error('[updateSplit]', err);
    res.status(500).json({ message: err.message });
  }
};

//─────────────────────────────────────
// Delete split
//─────────────────────────────────────
const deleteSplit = async (req, res) => {
  try {
    const { groupId, splitId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const member = group.members.find(m => m.userId?.toString() === req.user._id?.toString());
    if (!member) return res.status(403).json({ message: 'Not a member' });

    const split = await Split.findOneAndDelete({ _id: splitId, groupId });
    if (!split) return res.status(404).json({ message: 'Expense not found' });

    group.totalExpenses = Math.max(0, (group.totalExpenses || 0) - split.totalAmount);
    await group.save();

    const io = req.app.get('io');
    if (io) io.to(`group_${groupId}`).emit('split_deleted', { groupId, splitId });

    return res.status(200).json({ success: true, message: 'Expense deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//─────────────────────────────────────────────────────────────────────────────
// GET /api/groups/owed-summary                                           ← NEW
//
// Dashboard widget: returns how much the current user is owed across ALL
// groups, and how much they owe others across all groups.
//
// Response: { totalOwedToMe, totalIOwe, netBalance, groupCount, groupBreakdown[] }
//─────────────────────────────────────────────────────────────────────────────
const getOwedSummary = async (req, res, next) => {
  try {
    const myId = req.user._id.toString();

    // All active groups this user belongs to
    const groups = await Group.find({
      'members.userId': req.user._id,
      isActive: true,
    }).lean();

    let totalOwedToMe = 0;
    let totalIOwe     = 0;
    const groupBreakdown = [];

    for (const group of groups) {
      const splits = await Split.find({ groupId: group._id, isSettled: false }).lean();

      // Build name→userId map for legacy null-userId shares
      const userIdByName = {};
      group.members.forEach(m => {
        if (m.userId && m.name) {
          userIdByName[m.name.trim().toLowerCase()] = m.userId.toString();
        }
      });

      let groupOwedToMe = 0;
      let groupIOwe     = 0;

      splits.forEach(split => {
        const paidById = split.paidBy?.toString();

        split.shares.forEach(share => {
          // Resolve userId — handle legacy null
          let shareUserId = share.userId?.toString();
          if (!shareUserId && share.name) {
            shareUserId = userIdByName[share.name.trim().toLowerCase()];
          }

          if (!shareUserId || share.isPaid) return;

          if (paidById === myId && shareUserId !== myId) {
            // I paid — this person owes me
            groupOwedToMe += share.amount;
          } else if (paidById !== myId && shareUserId === myId) {
            // Someone else paid — I owe my share
            groupIOwe += share.amount;
          }
        });
      });

      totalOwedToMe += groupOwedToMe;
      totalIOwe     += groupIOwe;

      if (groupOwedToMe > 0.005 || groupIOwe > 0.005) {
        groupBreakdown.push({
          groupId:   group._id,
          groupName: group.name,
          groupIcon: group.icon || '👥',
          groupType: group.type,
          owedToMe:  parseFloat(groupOwedToMe.toFixed(2)),
          iOwe:      parseFloat(groupIOwe.toFixed(2)),
          net:       parseFloat((groupOwedToMe - groupIOwe).toFixed(2)),
        });
      }
    }

    // Biggest absolute net balance first
    groupBreakdown.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

    return res.status(200).json({
      success: true,
      data: {
        totalOwedToMe:  parseFloat(totalOwedToMe.toFixed(2)),
        totalIOwe:      parseFloat(totalIOwe.toFixed(2)),
        netBalance:     parseFloat((totalOwedToMe - totalIOwe).toFixed(2)),
        groupBreakdown,
        groupCount:     groupBreakdown.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};