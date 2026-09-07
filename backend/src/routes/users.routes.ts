import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';

export const usersRouter = Router();

// GET /api/users (Admin ou soignants)
usersRouter.get('/', authenticate, (req: AuthenticatedRequest, res) => {
  const users = db.getUsers().map(({ password, ...u }) => u);
  res.json(users);
});

// GET /api/users/:id
usersRouter.get('/:id', authenticate, (req, res) => {
  const userId = String(req.params.id);
  const user = db.getUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  const { password, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

// POST /api/users (Admin crée un utilisateur)
usersRouter.post('/', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res) => {
  const { name, email, password, role, serviceId } = req.body;

  if (!name || !email || !role) {
    res.status(400).json({ error: 'Nom, email et rôle requis' });
    return;
  }

  const existing = db.getUserByEmail(email);
  if (existing) {
    res.status(400).json({ error: 'Cette adresse email est déjà utilisée.' });
    return;
  }

  const { user, rawPassword } = db.createUser({
    name,
    email,
    password,
    role,
    serviceId,
    createdBy: req.user?.id
  });

  if (req.user) {
    db.logActivity(req.user.id, req.user.name, `Création du compte ${user.name} (${user.role})`, user.id);
  }

  // Notifier l'utilisateur
  db.createNotification(
    user.id,
    `Votre compte HosQUEUE (${user.role}) a été créé avec succès.`,
    `Your HosQUEUE account (${user.role}) has been successfully created.`,
    'account_created'
  );

  const { password: _, ...userWithoutPassword } = user;
  res.status(201).json({
    user: userWithoutPassword,
    generatedPassword: rawPassword
  });
});

// PATCH /api/users/:id (Admin modifie ou suspend un utilisateur)
usersRouter.patch('/:id', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res) => {
  const userId = String(req.params.id);
  const updated = db.updateUser(userId, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }

  if (req.user) {
    const actionDesc = req.body.suspended !== undefined
      ? (req.body.suspended ? `Suspension du compte ${updated.name}` : `Réactivation du compte ${updated.name}`)
      : `Modification du compte ${updated.name}`;
    db.logActivity(req.user.id, req.user.name, actionDesc, updated.id);
  }

  const { password, ...userWithoutPassword } = updated;
  res.json(userWithoutPassword);
});

// DELETE /api/users/:id (Admin supprime un utilisateur)
usersRouter.delete('/:id', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res) => {
  const userId = String(req.params.id);
  const user = db.getUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }

  if (user.id === req.user?.id) {
    res.status(400).json({ error: 'Impossible de supprimer son propre compte administrateur.' });
    return;
  }

  db.deleteUser(userId);

  if (req.user) {
    db.logActivity(req.user.id, req.user.name, `Suppression du compte ${user.name}`, user.id);
  }

  res.json({ success: true });
});

// GET /api/users/:id/activity
usersRouter.get('/:id/activity', authenticate, (req, res) => {
  const userId = String(req.params.id);
  const activities = db.getUserActivity(userId);
  res.json(activities);
});
