// backend/src/models/Friend.model.js

const mongoose = require('mongoose');

const friendSchema = new mongoose.Schema(
  {
    // Who sent the request
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Who received the request
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'blocked'],
      default: 'pending',
    },
    // How was this friend added?
    inviteChannel: {
      type: String,
      enum: ['email', 'sms', 'in_app'],
      default: 'email',
    },
    // If recipient is not on SpendWise yet (SMS/email invite to non-user)
    invitedPhone: { type: String, default: null },
    invitedEmail: { type: String, default: null },

    acceptedAt: { type: Date, default: null },
    declinedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Prevent duplicate friend requests between same two users
friendSchema.index({ requester: 1, recipient: 1 }, { unique: true });
friendSchema.index({ recipient: 1, status: 1 });
friendSchema.index({ requester: 1, status: 1 });

const Friend = mongoose.model('Friend', friendSchema);
module.exports = Friend;