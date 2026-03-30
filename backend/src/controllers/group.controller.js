// backend/src/controllers/group.controller.js

const Group = require('../models/Group.model');
const Split = require('../models/Split.model');
const User  = require('../models/User.model');

//─────────────────────────────────────
// HELPER — check if user is group member
//─────────────────────────────────────
const isMember = (group, userId) =>
  group.members.some(m => m.userId?.toString() === userId.toString());

const isAdmin = (group, userId) =>
  group.members.some(m => m.userId?.toString() === userId.toString() && m.role === 'admin');

//─────────────────────────────────────
// POST /api/groups
// Create group
//─────────────────────────────────────
const createGroup = async (req, res, next) => {
  try {
    const { name, description, icon, color, type, currency, memberEmails } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Group name is required.' });
    }

    // Resolve member emails to user IDs
    const members = [{
      userId:  req.user._id,
      name:    req.user.name,
      email:   req.user.email,
      role:    'admin',
    }];

    if (Array.isArray(memberEmails) && memberEmails.length > 0) {
      const users = await User.find({ email: { $in: memberEmails } }).lean();
      users.forEach(u => {
        if (u._id.toString() !== req.user._id.toString()) {
          members.push({ userId: u._id, name: u.name, email: u.email, role: 'member' });
        }
      });

      // Add non-registered members by email (name only)
      memberEmails.forEach(email => {
        const found = users.find(u => u.email === email);
        if (!found) {
          members.push({ userId: null, name: email.split('@')[0], email, role: 'member' });
        }
      });
    }

    const group = await Group.create({
      name,
      description: description || null,
      icon:        icon        || '👥',
      color:       color       || '#1D9E75',
      type:        type        || 'other',
      currency:    currency    || req.user.currency || 'INR',
      createdBy:   req.user._id,
      members,
    });

    return res.status(201).json({
      success: true,
      message: 'Group created successfully.',
      data: { group },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// GET /api/groups
// List all groups for current user
//─────────────────────────────────────
const getGroups = async (req, res, next) => {
  try {
    const groups = await Group.find({
      'members.userId': req.user._id,
      isActive: true,
    }).sort({ updatedAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      data: { groups, total: groups.length },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// GET /api/groups/:id
// Get single group with balances
//─────────────────────────────────────
const getGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id).lean();

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    if (!isMember(group, req.user._id)) {
      return res.status(403).json({ success: false, message: 'You are not a member of this group.' });
    }

    // Get recent splits
    const splits = await Split.find({ groupId: group._id })
      .sort({ date: -1 }).limit(10).lean();

    return res.status(200).json({
      success: true,
      data: { group, recentSplits: splits },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// PUT /api/groups/:id
// Update group
//─────────────────────────────────────
const updateGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    if (!isAdmin(group, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only admins can update the group.' });
    }

    const allowed = ['name', 'description', 'icon', 'color', 'type'];
    allowed.forEach(field => {
      if (req.body[field] !== undefined) group[field] = req.body[field];
    });

    await group.save();

    return res.status(200).json({
      success: true,
      message: 'Group updated.',
      data: { group },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// POST /api/groups/:id/members
// Add member to group
//─────────────────────────────────────
const addMember = async (req, res, next) => {
  try {
    const { email, name } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    if (!isAdmin(group, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only admins can add members.' });
    }

    // Check already a member
    const alreadyMember = group.members.some(m => m.email === email);
    if (alreadyMember) {
      return res.status(409).json({ success: false, message: 'This person is already in the group.' });
    }

    // Try to find user account
    const user = await User.findOne({ email }).lean();

    group.members.push({
      userId:  user?._id || null,
      name:    user?.name || name || email.split('@')[0],
      email,
      role:    'member',
    });

    await group.save();

    return res.status(200).json({
      success: true,
      message: 'Member added.',
      data: { group },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// DELETE /api/groups/:id/members/:memberId
// Remove member
//─────────────────────────────────────
const removeMember = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    if (!isAdmin(group, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only admins can remove members.' });
    }

    group.members = group.members.filter(
      m => m._id?.toString() !== req.params.memberId
    );

    await group.save();

    return res.status(200).json({
      success: true,
      message: 'Member removed.',
      data: { group },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// DELETE /api/groups/:id
// Deactivate group
//─────────────────────────────────────
const deleteGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    if (!isAdmin(group, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only admins can delete the group.' });
    }

    group.isActive = false;
    await group.save();

    return res.status(200).json({
      success: true,
      message: 'Group deleted.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createGroup,
  getGroups,
  getGroup,
  updateGroup,
  addMember,
  removeMember,
  deleteGroup,
};