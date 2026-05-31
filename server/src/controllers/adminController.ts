import { type Request, type Response } from 'express';
import { getAllUsers as getUsers, findUserById, findUserByPhone, findUserByEmail } from '../config/jsonDb.js';

// =========================================================
// GET /api/admin/users
// =========================================================
export async function getAllUsers(_req: Request, res: Response) {
  try {
    const users = getUsers();
    const safe = users
      .map((u) => ({
        uid: u._id,
        uniqueId: u.uniqueId,
        email: u.email || '',
        phone: u.phone || '',
        displayName: u.displayName,
        medicalInfo: u.medicalInfo,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      }))
      .reverse(); // newest first

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

    let user = findUserById(id);
    if (!user) user = findUserByPhone(id);
    if (!user) user = findUserByEmail(id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        uid: user._id,
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
