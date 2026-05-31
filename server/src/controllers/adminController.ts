import { type Request, type Response } from 'express';
import { User } from '../models/User.js';

// =========================================================
// GET /api/admin/users
// =========================================================
export async function getAllUsers(_req: Request, res: Response) {
  try {
    const users = await User.find({}).sort({ createdAt: -1 }).lean();

    const safe = users.map((u) => ({
      uid: u._id.toString(),
      uniqueId: u.uniqueId,
      email: u.email || '',
      phone: u.phone || '',
      displayName: u.displayName,
      medicalInfo: u.medicalInfo,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    }));

    res.json({ total: safe.length, users: safe });
  } catch (err) {
    console.error('getAllUsers error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

// =========================================================
// GET /api/admin/users/:id
//    Find user by _id, email, or uniqueId
// =========================================================
export async function getUserById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Try by _id first
    let user = await User.findById(id).lean();
    if (!user) user = await User.findOne({ phone: id }).lean();
    if (!user) user = await User.findOne({ email: id.toLowerCase() }).lean();
    if (!user) user = await User.findOne({ uniqueId: id }).lean();

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        uid: user._id.toString(),
        uniqueId: user.uniqueId,
        email: user.email || '',
        phone: user.phone || '',
        displayName: user.displayName,
        medicalInfo: user.medicalInfo,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (err) {
    console.error('getUserById error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}
