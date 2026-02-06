import jwt from 'jsonwebtoken';

/**
 * Authentication middleware that validates JWT tokens.
 * Requires JWT_SECRET to be properly configured on server boot.
 * 
 * Sets req.user with decoded token payload: { sub, role, orgId }
 */
export const auth = (req, res, next) => {
  const header = req.headers.authorization;
  
  if (!header) {
    return res.status(401).json({ error: 'missing authorization header' });
  }
  
  const token = header.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'missing token' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'invalid token' });
    }
    return res.status(401).json({ error: 'authentication failed' });
  }
};

/**
 * Role-based authorization middleware factory.
 * Use after auth middleware to restrict routes to specific roles.
 * 
 * @param {string[]} allowedRoles - Array of role strings
 * @returns {Function} Express middleware
 */
export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'authentication required' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'insufficient permissions' });
    }
    
    return next();
  };
};

/**
 * Middleware to enforce org-based access control.
 * Ensures user can only access resources for their own orgId.
 * 
 * @param {string} paramName - The route parameter name containing orgId (default: 'orgId')
 * @returns {Function} Express middleware
 */
export const requireOrgAccess = (paramName = 'orgId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'authentication required' });
    }
    
    const resourceOrgId = req.params[paramName];
    
    // ADMIN role can access any org
    if (req.user.role === 'ADMIN') {
      return next();
    }
    
    // Other users must match their orgId
    if (req.user.orgId !== resourceOrgId) {
      return res.status(403).json({ error: 'access denied to this organization' });
    }
    
    return next();
  };
};
