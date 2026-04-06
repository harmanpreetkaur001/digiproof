module.exports = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({ error: `Access denied. Required roles: ${allowedRoles.join(', ')}` });
  }
  next();
};
