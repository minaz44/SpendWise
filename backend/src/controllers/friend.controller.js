// backend/src/controllers/friend.controller.js

const mongoose = require('mongoose');
const User     = require('../models/User.model');
const Friend   = require('../models/Friend.model');
const { sendFriendRequestEmail } = require('../services/email.service');
const { sendFriendInviteSMS, sendFriendRequestSMS } = require('../services/sms.service');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — safe user projection
// ─────────────────────────────────────────────────────────────────────────────
const USER_FIELDS = 'name email avatar phone';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/friends/invite/email
// Send a friend request by email address
// ─────────────────────────────────────────────────────────────────────────────
const inviteByEmail = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Cannot add yourself
    if (normalizedEmail === req.user.email) {
      return res.status(400).json({
        success: false,
        message: 'You cannot send a friend request to yourself.',
      });
    }

    // Check if target user exists on SpendWise
    const targetUser = await User.findOne({ email: normalizedEmail });

    if (targetUser) {
      // ── Case 1: User exists — create in-app friend request ──────────────────

      // Check for existing relationship
      const existing = await Friend.findOne({
        $or: [
          { requester: req.user._id, recipient: targetUser._id },
          { requester: targetUser._id, recipient: req.user._id },
        ],
      });

      if (existing) {
        const messages = {
          pending:  'A friend request already exists between you and this user.',
          accepted: 'You are already friends with this user.',
          declined: 'This friend request was previously declined.',
          blocked:  'Unable to send a request to this user.',
        };
        return res.status(409).json({
          success: false,
          message: messages[existing.status] || 'Friend relationship already exists.',
        });
      }

      // Create the friend request
      const friendRequest = await Friend.create({
        requester:     req.user._id,
        recipient:     targetUser._id,
        inviteChannel: 'email',
      });

      // Send notification email to recipient
      try {
        await sendFriendRequestEmail({
          to:        targetUser.email,
          toName:    targetUser.name,
          fromName:  req.user.name,
          fromEmail: req.user.email,
        });
      } catch (emailErr) {
        // Non-fatal — request is still created even if email fails
        console.warn('Friend request email failed:', emailErr.message);
      }

      return res.status(201).json({
        success: true,
        message: `Friend request sent to ${targetUser.name}!`,
        data: {
          friendRequest: {
            _id:           friendRequest._id,
            status:        friendRequest.status,
            inviteChannel: friendRequest.inviteChannel,
            recipient: {
              name:  targetUser.name,
              email: targetUser.email,
            },
            createdAt: friendRequest.createdAt,
          },
        },
      });

    } else {
      // ── Case 2: User does NOT exist — send invite email to join SpendWise ──

      // Don't send duplicate invites in the same day
      const recentInvite = await Friend.findOne({
        requester:    req.user._id,
        invitedEmail: normalizedEmail,
        createdAt:    { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      if (recentInvite) {
        return res.status(429).json({
          success: false,
          message: 'You already sent an invite to this email today.',
        });
      }

      // Store the pending invite (no recipient userId since they don't exist yet)
      await Friend.create({
        requester:     req.user._id,
        recipient:     req.user._id, // placeholder — overwritten when they join
        inviteChannel: 'email',
        invitedEmail:  normalizedEmail,
        status:        'pending',
      });

      // Send invite email
      try {
        await sendFriendRequestEmail({
          to:        normalizedEmail,
          toName:    'there',
          fromName:  req.user.name,
          fromEmail: req.user.email,
        });
      } catch (emailErr) {
        console.warn('Invite email failed:', emailErr.message);
      }

      return res.status(200).json({
        success: true,
        message: `Invite sent to ${normalizedEmail}. They'll get an email to join SpendWise!`,
        data: { invited: true, email: normalizedEmail },
      });
    }
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/friends/invite/sms
// Send a friend request / invite via SMS (phone number)
// ─────────────────────────────────────────────────────────────────────────────
const inviteBySMS = async (req, res, next) => {
  try {
    let { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required.',
      });
    }

    // Normalize — strip +91 prefix, keep digits only
    const normalized = phone.replace(/^\+91/, '').replace(/^0/, '').replace(/\D/g, '');
    if (normalized.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid 10-digit Indian mobile number.',
      });
    }

    // Cannot invite your own number
    const myPhone = (req.user.phone || '').replace(/^\+91/, '').replace(/^0/, '').replace(/\D/g, '');
    if (myPhone && myPhone === normalized) {
      return res.status(400).json({
        success: false,
        message: 'You cannot invite yourself.',
      });
    }

    // Check if any SpendWise user has this phone
    const targetUser = await User.findOne({ phone: { $regex: normalized } });

    if (targetUser) {
      // ── Case 1: User exists — create in-app friend request + SMS notification

      const existing = await Friend.findOne({
        $or: [
          { requester: req.user._id, recipient: targetUser._id },
          { requester: targetUser._id, recipient: req.user._id },
        ],
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: existing.status === 'accepted'
            ? 'You are already friends with this user.'
            : 'A friend request already exists with this user.',
        });
      }

      const friendRequest = await Friend.create({
        requester:     req.user._id,
        recipient:     targetUser._id,
        inviteChannel: 'sms',
      });

      // Send SMS notification
      try {
        await sendFriendRequestSMS({
          phone:    normalized,
          fromName: req.user.name,
        });
      } catch (smsErr) {
        console.warn('Friend request SMS failed:', smsErr.message);
      }

      return res.status(201).json({
        success: true,
        message: `Friend request sent to ${targetUser.name} via SMS!`,
        data: {
          friendRequest: {
            _id:    friendRequest._id,
            status: friendRequest.status,
            recipient: { name: targetUser.name },
          },
        },
      });

    } else {
      // ── Case 2: User does NOT exist — send invite SMS to join SpendWise ────

      // Rate limit: one SMS invite per phone per day
      const recentInvite = await Friend.findOne({
        requester:    req.user._id,
        invitedPhone: normalized,
        createdAt:    { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      if (recentInvite) {
        return res.status(429).json({
          success: false,
          message: 'You already sent an SMS invite to this number today.',
        });
      }

      await Friend.create({
        requester:     req.user._id,
        recipient:     req.user._id, // placeholder
        inviteChannel: 'sms',
        invitedPhone:  normalized,
        status:        'pending',
      });

      // Send invite SMS
      try {
        await sendFriendInviteSMS({
          phone:     normalized,
          fromName:  req.user.name,
          inviteLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register`,
        });
      } catch (smsErr) {
        console.warn('Invite SMS failed:', smsErr.message);
      }

      return res.status(200).json({
        success: true,
        message: `Invite SMS sent to +91${normalized}. They'll get a link to join SpendWise!`,
        data: { invited: true, phone: `+91${normalized}` },
      });
    }
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/friends
// Get all friends (accepted) + pending requests received/sent
// ─────────────────────────────────────────────────────────────────────────────
const getFriends = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // All relationships involving this user
    const all = await Friend.find({
      $or: [{ requester: userId }, { recipient: userId }],
      recipient: { $ne: userId }, // exclude placeholder self-invites
    })
      .populate('requester', USER_FIELDS)
      .populate('recipient', USER_FIELDS)
      .sort({ updatedAt: -1 })
      .lean();

    const friends  = [];
    const received = []; // pending requests TO me
    const sent     = []; // pending requests FROM me

    for (const r of all) {
      const isRequester = r.requester._id.toString() === userId.toString();
      const other = isRequester ? r.recipient : r.requester;

      const entry = {
        _id:           r._id,
        status:        r.status,
        inviteChannel: r.inviteChannel,
        since:         r.acceptedAt || r.createdAt,
        friend: {
          _id:    other._id,
          name:   other.name,
          email:  other.email,
          avatar: other.avatar,
          phone:  other.phone,
        },
      };

      if (r.status === 'accepted') {
        friends.push(entry);
      } else if (r.status === 'pending') {
        if (isRequester) sent.push(entry);
        else             received.push(entry);
      }
    }

    // Also include external invites (SMS/email to non-users)
    const externalInvites = await Friend.find({
      requester: userId,
      $or: [
        { invitedEmail: { $ne: null } },
        { invitedPhone: { $ne: null } },
      ],
    }).lean();

    return res.status(200).json({
      success: true,
      data: {
        friends,
        pendingReceived: received,
        pendingSent:     sent,
        externalInvites: externalInvites.map(i => ({
          _id:     i._id,
          channel: i.inviteChannel,
          email:   i.invitedEmail,
          phone:   i.invitedPhone ? `+91${i.invitedPhone}` : null,
          sentAt:  i.createdAt,
        })),
        counts: {
          friends:  friends.length,
          received: received.length,
          sent:     sent.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/friends/:id/accept
// Accept a friend request
// ─────────────────────────────────────────────────────────────────────────────
const acceptRequest = async (req, res, next) => {
  try {
    const request = await Friend.findOne({
      _id:       req.params.id,
      recipient: req.user._id,
      status:    'pending',
    }).populate('requester', USER_FIELDS);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found or already handled.',
      });
    }

    request.status     = 'accepted';
    request.acceptedAt = new Date();
    await request.save();

    return res.status(200).json({
      success: true,
      message: `You are now friends with ${request.requester.name}!`,
      data: {
        friend: {
          _id:   request.requester._id,
          name:  request.requester.name,
          email: request.requester.email,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/friends/:id/decline
// Decline a friend request
// ─────────────────────────────────────────────────────────────────────────────
const declineRequest = async (req, res, next) => {
  try {
    const request = await Friend.findOne({
      _id:       req.params.id,
      recipient: req.user._id,
      status:    'pending',
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found.',
      });
    }

    request.status     = 'declined';
    request.declinedAt = new Date();
    await request.save();

    return res.status(200).json({
      success: true,
      message: 'Friend request declined.',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/friends/:id
// Remove a friend (unfriend) or cancel a sent request
// ─────────────────────────────────────────────────────────────────────────────
const removeFriend = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const relationship = await Friend.findOne({
      _id: req.params.id,
      $or: [{ requester: userId }, { recipient: userId }],
    });

    if (!relationship) {
      return res.status(404).json({
        success: false,
        message: 'Friend relationship not found.',
      });
    }

    await relationship.deleteOne();

    return res.status(200).json({
      success: true,
      message: relationship.status === 'accepted'
        ? 'Friend removed successfully.'
        : 'Friend request cancelled.',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/friends/search?q=name_or_email
// Search SpendWise users to add as friends
// ─────────────────────────────────────────────────────────────────────────────
const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters.',
      });
    }

    // Find users matching name or email (exclude self)
    const users = await User.find({
      _id:      { $ne: req.user._id },
      isActive: true,
      $or: [
        { name:  { $regex: q.trim(), $options: 'i' } },
        { email: { $regex: q.trim(), $options: 'i' } },
      ],
    })
      .select('name email avatar')
      .limit(10)
      .lean();

    // Check existing relationships for each result
    const existingRelationships = await Friend.find({
      $or: [
        { requester: req.user._id, recipient: { $in: users.map(u => u._id) } },
        { recipient: req.user._id, requester: { $in: users.map(u => u._id) } },
      ],
    }).lean();

    const relMap = {};
    for (const r of existingRelationships) {
      const otherId =
        r.requester.toString() === req.user._id.toString()
          ? r.recipient.toString()
          : r.requester.toString();
      relMap[otherId] = r.status;
    }

    const results = users.map(u => ({
      ...u,
      friendStatus: relMap[u._id.toString()] || null, // null = not friends yet
    }));

    return res.status(200).json({
      success: true,
      data: { users: results, count: results.length },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  inviteByEmail,
  inviteBySMS,
  getFriends,
  acceptRequest,
  declineRequest,
  removeFriend,
  searchUsers,
};