const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../db');
const { verifyToken, isSuperAdmin } = require('../middleware/auth');

const router = express.Router();

const buildTemporaryPassword = () => {
  return crypto.randomBytes(6).toString('base64url');
};

const buildSubdomainOrSlug = (gymName) => {
  const baseSlug = String(gymName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const suffix = crypto.randomBytes(3).toString('hex');
  return `${baseSlug || 'gym'}-${suffix}`;
};

router.post('/gyms', verifyToken, isSuperAdmin, async (req, res) => {
  const { gym_name, owner_username, initial_password } = req.body;

  if (!gym_name || !owner_username) {
    return res.status(400).json({
      error: 'gym_name and owner_username are required',
    });
  }

  const temporaryPassword = initial_password && String(initial_password).trim().length > 0
    ? String(initial_password).trim()
    : buildTemporaryPassword();
  const subdomainOrSlug = buildSubdomainOrSlug(gym_name);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const gymResult = await client.query(
      `
        INSERT INTO gyms (name, subdomain_or_slug)
        VALUES ($1, $2)
        RETURNING id, name, subdomain_or_slug, created_at
      `,
      [gym_name.trim(), subdomainOrSlug]
    );

    const gym = gymResult.rows[0];
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const ownerResult = await client.query(
      `
        INSERT INTO users (username, password_hash, role, gym_id)
        VALUES ($1, $2, 'admin', $3)
        RETURNING id, username, role, gym_id
      `,
      [owner_username.trim(), hashedPassword, gym.id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      gym,
      owner: ownerResult.rows[0],
      temporary_password: temporaryPassword,
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      return res.status(409).json({ error: 'Gym name or owner username already exists' });
    }

    console.error('Create gym tenant failed:', error);
    res.status(500).json({ error: 'Gym onboarding failed' });
  } finally {
    client.release();
  }
});

router.get('/analytics', verifyToken, isSuperAdmin, async (_req, res) => {
  try {
    const query = `
      SELECT
        g.id AS gym_id,
        g.name AS gym_name,
        'active' AS status,
        COUNT(DISTINCT p.id)::int AS total_transactions_processed,
        COALESCE(SUM(p.amount), 0)::numeric(12,2) AS total_gross_revenue,
        COALESCE(SUM(p.amount * 0.10), 0)::numeric(12,2) AS platform_earnings,
        COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'Active')::int AS active_member_count
      FROM gyms g
      LEFT JOIN members m ON m.gym_id = g.id
      LEFT JOIN payments p ON p.member_id = m.id
      GROUP BY g.id, g.name
      ORDER BY g.name ASC
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Super admin analytics failed:', error);
    res.status(500).json({ error: 'Unable to load platform analytics' });
  }
});

module.exports = router;