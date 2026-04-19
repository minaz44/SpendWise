// backend/scripts/fixSplitUserIds.js
// ─────────────────────────────────────────────────────────────────────────────
// ONE-TIME MIGRATION — run once from the backend/ folder:
//   node scripts/fixSplitUserIds.js
//
// What it does:
//   For every split in the DB, checks each share entry.
//   If share.userId is null/missing, looks up the group member by name
//   and fills in the correct userId.
//   Also backfills paidByName on splits that are missing it.
//
// Safe to re-run — skips shares that already have a userId.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');
const path     = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Split = require('../src/models/Split.model');
const Group = require('../src/models/Group.model');

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_NAME || 'spendwise',
  });
  console.log('Connected to MongoDB\n');

  const groups = await Group.find({}).lean();
  const splits = await Split.find({}).lean();

  console.log(`Found ${groups.length} groups, ${splits.length} splits\n`);

  // Build groupId → members lookup
  const groupMap = {};
  groups.forEach(g => { groupMap[g._id.toString()] = g; });

  let fixed = 0;
  let skipped = 0;

  for (const sp of splits) {
    const group = groupMap[sp.groupId?.toString()];
    if (!group) { console.log(`⚠ No group for split "${sp.title}" — skipping`); skipped++; continue; }

    // Build name → userId and id → name from group members
    const userIdByName = {};
    const nameById     = {};
    group.members.forEach(m => {
      const uid = m.userId?.toString();
      if (!uid) return;
      nameById[uid] = m.name;
      if (m.name) userIdByName[norm(m.name)] = uid;
    });

    let changed = false;
    const newShares = sp.shares.map(share => {
      // Skip shares that already have a valid userId
      const existing = share.userId?.toString();
      if (existing && existing !== 'null' && existing !== 'undefined') return share;

      // Try to resolve from name
      const resolved = userIdByName[norm(share.name)];
      if (resolved) {
        console.log(`  ✓ Fixed share "${share.name}" in split "${sp.title}" → userId: ${resolved}`);
        changed = true;
        return { ...share, userId: new mongoose.Types.ObjectId(resolved) };
      }
      console.log(`  ✗ Could not resolve "${share.name}" in split "${sp.title}" — no matching member`);
      return share;
    });

    // Backfill paidByName if missing
    let newPaidByName = sp.paidByName;
    if (!sp.paidByName && sp.paidBy) {
      const payerName = nameById[sp.paidBy.toString()];
      if (payerName) {
        newPaidByName = payerName;
        changed = true;
        console.log(`  ✓ Backfilled paidByName="${payerName}" for split "${sp.title}"`);
      }
    }

    // Also fix isPaid on shares: payer's own share should always be isPaid:true
    const payerId = sp.paidBy?.toString();
    const fixedShares = newShares.map(share => {
      const sId = share.userId?.toString();
      if (sId && sId === payerId && !share.isPaid) {
        console.log(`  ✓ Fixed isPaid=true for payer share in "${sp.title}"`);
        changed = true;
        return { ...share, isPaid: true };
      }
      return share;
    });

    if (changed) {
      await Split.updateOne(
        { _id: sp._id },
        {
          $set: {
            shares:      fixedShares,
            paidByName:  newPaidByName,
          },
        }
      );
      fixed++;
      console.log(`  → Saved split "${sp.title}"\n`);
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ Done. Fixed: ${fixed} splits, Skipped (already clean): ${skipped} splits`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});