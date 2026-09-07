import { Router } from 'express';
import { db } from '../db.js';
import { generateToken, authenticate, type AuthenticatedRequest } from '../middleware/auth.js';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email et mot de passe requis.' });
    return;
  }

  const user = db.getUserByEmail(email);
  if (!user || !db.verifyPassword(user, password)) {
    res.status(401).json({ error: 'Email ou mot de passe incorrect.', code: 'loginError' });
    return;
  }

  if (user.suspended) {
    res.status(403).json({ error: 'Ce compte a été suspendu.', code: 'suspendedError' });
    return;
  }

  const updated = db.updateUser(user.id, { lastLogin: new Date().toISOString() }) || user;
  const token = generateToken(updated);

  db.logActivity(updated.id, updated.name, 'Connexion / Login');

  // Strip password from response
  const { password: _, ...userWithoutPassword } = updated;
  res.json({
    user: userWithoutPassword,
    token
  });
});

// POST /api/auth/register-first-admin
authRouter.post('/register-first-admin', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Tous les champs sont requis.' });
    return;
  }

  const hasAdmin = db.getUsers().some(u => u.role === 'admin');
  if (hasAdmin) {
    res.status(400).json({ error: 'Le premier compte administrateur existe déjà.', code: 'registrationClosed' });
    return;
  }

  if (db.getUserByEmail(email)) {
    res.status(400).json({ error: 'Cette adresse email est déjà utilisée.', code: 'emailAlreadyUsed' });
    return;
  }

  const { user } = db.createUser({
    name,
    email,
    password,
    role: 'admin',
    createdBy: 'system'
  });

  const token = generateToken(user);
  db.logActivity(user.id, user.name, 'Création du premier administrateur / First administrator created');

  const { password: _, ...userWithoutPassword } = user;
  res.status(201).json({
    user: userWithoutPassword,
    token
  });
});

// GET /api/auth/has-admin
authRouter.get('/has-admin', (_req, res) => {
  const hasAdmin = db.getUsers().some(u => u.role === 'admin');
  res.json({ hasAdmin });
});

// GET /api/auth/me
authRouter.get('/me', authenticate, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Non authentifié.' });
    return;
  }
  const { password: _, ...userWithoutPassword } = req.user;
  res.json({ user: userWithoutPassword });
});

// POST /api/auth/logout
authRouter.post('/logout', authenticate, (req: AuthenticatedRequest, res) => {
  if (req.user) {
    db.logActivity(req.user.id, req.user.name, 'Déconnexion / Logout');
  }
  res.json({ success: true });
});
