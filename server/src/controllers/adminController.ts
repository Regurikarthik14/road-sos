import { type Request, type Response } from 'express';
import { User } from '../models/User.js';
import { isConnected } from '../config/db.js';

// =========================================================
// GET /api/admin/users
// =========================================================
export async function getAllUsers(_req: Request, res: Response) {
  try {
    if (!isConnected()) {
      res.status(503).json({ error: 'Database not connected' });
      return;
    }

    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json({
      total: users.length,
      users: users.map((u) => ({
        uid: u._id.toString(),
        uniqueId: u.uniqueId,
        email: u.email,
        phone: u.phone,
        displayName: u.displayName,
        medicalInfo: u.medicalInfo,
        createdAt: u.createdAt.getTime(),
        lastLoginAt: u.lastLoginAt.getTime(),
      })),
    });
  } catch (err) {
    console.error('getAllUsers error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

// =========================================================
// GET /api/admin/users/:id
//    Find user by MongoDB _id OR uniqueId
// =========================================================
export async function getUserById(req: Request, res: Response) {
  try {
    if (!isConnected()) {
      res.status(503).json({ error: 'Database not connected' });
      return;
    }

    const { id } = req.params;

    // Try to find by MongoDB _id first, then by uniqueId
    let user;
    if (/^[a-f0-9]{24}$/i.test(id)) {
      user = await User.findById(id).select('-password');
    }
    if (!user) {
      user = await User.findOne({ uniqueId: id }).select('-password');
    }

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        uid: user._id.toString(),
        uniqueId: user.uniqueId,
        email: user.email,
        phone: user.phone,
        displayName: user.displayName,
        medicalInfo: user.medicalInfo,
        createdAt: user.createdAt.getTime(),
        lastLoginAt: user.lastLoginAt.getTime(),
      },
    });
  } catch (err) {
    console.error('getUserById error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}
