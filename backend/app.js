require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const { verifyToken, isAdmin, isSuperAdmin } = require('./middleware/auth');
const superAdminRouter = require('./routes/superAdmin');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/super', superAdminRouter);

const getRenewalMonths = (membershipTier) => {
  const tierDurations = {
    Standard: 1,
    Elite: 1,
  };

  return tierDurations[membershipTier] || 1;
};

const getTierFromAmount = (amount) => {
  if (Number(amount) === 1500) {
    return 'Elite';
  }

  return 'Standard';
};

const getAmountFromTier = (membershipTier) => {
  return membershipTier === 'Elite' ? 1500 : 800;
};

const getIsSuperAdmin = (user) => user?.role === 'super_admin';

const getTenantGymId = (req, explicitGymId = null) => {
  if (getIsSuperAdmin(req.user)) {
    return explicitGymId || null;
  }

  return req.user.gym_id || null;
};

const requireGymIdForTenant = (req, res, explicitGymId = null) => {
  const gymId = getTenantGymId(req, explicitGymId);

  if (!gymId) {
    res.status(400).json({ error: 'gym_id is required for this operation' });
    return null;
  }

  return gymId;
};

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await pool.query(
      `
        SELECT u.id, u.username, u.password_hash, u.role, u.gym_id, g.name AS gym_name
        FROM users u
        LEFT JOIN gyms g ON g.id = u.gym_id
        WHERE u.username = $1
      `,
      [username]
    );
    if (user.rows.length === 0) return res.status(404).json({ error: "User not found" });

    const validPass = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!validPass) return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign(
      { id: user.rows[0].id, role: user.rows[0].role, gym_id: user.rows[0].gym_id },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      role: user.rows[0].role,
      username: user.rows[0].username,
      gym_id: user.rows[0].gym_id,
      gym_name: user.rows[0].gym_name,
    });
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/create-staff', verifyToken, isAdmin, async (req, res) => {
  const { username, password, gym_id } = req.body;
  const targetGymId = requireGymIdForTenant(req, res, gym_id);
  if (!targetGymId) return;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role, gym_id) VALUES ($1, $2, $3, $4) RETURNING id, username, role, gym_id',
      [username, hashedPassword, 'staff', targetGymId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Username already exists" });
  }
});

app.post('/api/members', verifyToken, async (req, res) => {
  const { full_name, email, phone, membership_tier, duration_months, transaction_ref } = req.body;
  const targetGymId = requireGymIdForTenant(req, res, req.body.gym_id);
  if (!targetGymId) return;

  if (!full_name || !email || !membership_tier || !transaction_ref) {
    return res.status(400).json({ error: 'full_name, email, membership_tier, and transaction_ref are required' });
  }

  const months = Number.parseInt(duration_months, 10);
  const membershipDuration = Number.isFinite(months) && months > 0 ? months : 1;

  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + membershipDuration);

  try {
    const memberResult = await pool.query(
      `INSERT INTO members (full_name, email, phone, membership_tier, end_date, registered_by, gym_id, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending') RETURNING *`,
      [full_name, email, phone || null, membership_tier, endDate, req.user.id, targetGymId]
    );

    const member = memberResult.rows[0];
    const amount = getAmountFromTier(membership_tier);

    const paymentResult = await pool.query(
      'INSERT INTO payments (member_id, amount, transaction_ref, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [member.id, amount, String(transaction_ref).trim(), 'Pending']
    );

    res.status(201).json({
      ...member,
      payment: paymentResult.rows[0],
      transaction_ref: paymentResult.rows[0].transaction_ref,
    });
  } catch (err) {
    console.error('Create member failed:', err);

    if (err.code === '23505') {
      return res.status(409).json({ error: 'Member already exists' });
    }

    if (err.code === '23502') {
      return res.status(400).json({ error: 'Missing required member data' });
    }

    res.status(500).json({ error: 'Member creation failed' });
  }
});

app.post('/api/payments', verifyToken, async (req, res) => {
  const { member_id, amount, transaction_ref } = req.body;
  const targetGymId = requireGymIdForTenant(req, res, req.body.gym_id);
  if (!targetGymId) return;

  try {
    const memberResult = await pool.query(
      `SELECT id FROM members WHERE id = $1 AND gym_id = $2`,
      [member_id, targetGymId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const result = await pool.query(
      'INSERT INTO payments (member_id, amount, transaction_ref, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [member_id, amount, transaction_ref, 'Pending']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Transaction ID already used" });
  }
});

app.post('/api/members/renew', verifyToken, async (req, res) => {
  const { member_id, amount, transaction_ref, membership_tier } = req.body;
  const targetGymId = requireGymIdForTenant(req, res, req.body.gym_id);
  if (!targetGymId) return;

  if (!member_id || !amount || !transaction_ref) {
    return res.status(400).json({ error: 'member_id, amount, and transaction_ref are required' });
  }

  try {
    const memberResult = await pool.query(
      'SELECT id, membership_tier, status, end_date FROM members WHERE id = $1 AND gym_id = $2',
      [member_id, targetGymId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const result = await pool.query(
      'INSERT INTO payments (member_id, amount, transaction_ref, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [member_id, amount, transaction_ref, 'Pending']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create renewal payment failed:', err);

    if (err.code === '23505') {
      return res.status(409).json({ error: 'Transaction reference already used' });
    }

    res.status(500).json({ error: 'Renewal request failed' });
  }
});

app.get('/api/admin/verify-queue', verifyToken, isAdmin, async (req, res) => {
  try {
    const isSuper = getIsSuperAdmin(req.user);
    const query = isSuper
      ? `
        SELECT p.id as payment_id, m.full_name, p.amount, p.transaction_ref, m.membership_tier, m.gym_id
        FROM payments p
        JOIN members m ON p.member_id = m.id
        WHERE p.status = 'Pending'
      `
      : `
        SELECT p.id as payment_id, m.full_name, p.amount, p.transaction_ref, m.membership_tier, m.gym_id
        FROM payments p
        JOIN members m ON p.member_id = m.id
        WHERE p.status = 'Pending' AND m.gym_id = $1
      `;

    const result = isSuper
      ? await pool.query(query)
      : await pool.query(query, [req.user.gym_id]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/confirm-payment/:payment_id', verifyToken, isAdmin, async (req, res) => {
  const { payment_id } = req.params;
  const client = await pool.connect();
  const isSuper = getIsSuperAdmin(req.user);
  const gymId = req.user.gym_id;

  try {
    await client.query('BEGIN');

    const paymentResult = await client.query(
      isSuper
        ? 'SELECT id, member_id, amount, status FROM payments WHERE id = $1 FOR UPDATE'
        : 'SELECT p.id, p.member_id, p.amount, p.status FROM payments p JOIN members m ON p.member_id = m.id WHERE p.id = $1 AND m.gym_id = $2 FOR UPDATE',
      isSuper ? [payment_id] : [payment_id, gymId]
    );

    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = paymentResult.rows[0];
    const renewedTier = getTierFromAmount(payment.amount);

    const memberResult = await client.query(
      isSuper
        ? 'SELECT id, status, end_date, membership_tier FROM members WHERE id = $1 FOR UPDATE'
        : 'SELECT id, status, end_date, membership_tier FROM members WHERE id = $1 AND gym_id = $2 FOR UPDATE',
      isSuper ? [payment.member_id] : [payment.member_id, gymId]
    );

    if (memberResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Member not found' });
    }

    const member = memberResult.rows[0];
    const renewalMonths = getRenewalMonths(renewedTier);

    await client.query(
      'UPDATE payments SET status = $1, verified_by = $2 WHERE id = $3',
      ['Verified', req.user.id, payment_id]
    );

    await client.query(
      `
        UPDATE members
        SET status = 'Active',
            membership_tier = $2,
            end_date = (CASE WHEN end_date > CURRENT_DATE THEN end_date ELSE CURRENT_DATE END) + ($1 * INTERVAL '1 month')
        WHERE id = $3
      `,
      [renewalMonths, renewedTier, member.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Payment verified successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Confirm payment failed:', err);
    res.status(500).json({ error: 'Verification failed' });
  } finally {
    client.release();
  }
});

app.get('/api/members', verifyToken, async (req, res) => {
  try {
    const isSuper = getIsSuperAdmin(req.user);
    const result = await pool.query(
      isSuper
        ? `
          SELECT m.*, g.name AS gym_name,
          CASE
            WHEN (m.end_date - CURRENT_DATE) <= 4 AND (m.end_date - CURRENT_DATE) >= 0 THEN true
            ELSE false
          END as is_expiring,
          (m.end_date - CURRENT_DATE) as days_left,
          EXTRACT(MONTH FROM AGE(CURRENT_DATE, m.created_at)) +
          (EXTRACT(YEAR FROM AGE(CURRENT_DATE, m.created_at)) * 12) as total_months_active
          FROM members m
          LEFT JOIN gyms g ON g.id = m.gym_id
          ORDER BY m.end_date ASC
        `
        : `
          SELECT *,
          CASE
            WHEN (end_date - CURRENT_DATE) <= 4 AND (end_date - CURRENT_DATE) >= 0 THEN true
            ELSE false
          END as is_expiring,
          (end_date - CURRENT_DATE) as days_left,
          EXTRACT(MONTH FROM AGE(CURRENT_DATE, created_at)) +
          (EXTRACT(YEAR FROM AGE(CURRENT_DATE, created_at)) * 12) as total_months_active
          FROM members
          WHERE gym_id = $1
          ORDER BY end_date ASC
        `,
      isSuper ? [] : [req.user.gym_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/", (req, res) => {
    res.send("Gym Management API is running...");
});

app.listen(3000, () => console.log(' Gym Server running on 3000'));