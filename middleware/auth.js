import jwt from 'jsonwebtoken';
import { RevokedToken } from '../models/revokedToken.js';
import { logger } from '../utils/logger.js';

/**
 * Authentication middleware that validates JWT tokens.
 * Requires JWT_SECRET to be properly configured on server boot.
 * 
 * Sets req.user with decoded token payload: { sub, role, orgId }
 */
export const auth = async (req, res, next) => {
  const header = req.headers.authorization;
  
  if (!header) {
    logger.warn('Auth failed: missing authorization header', { requestId: req.requestId });
    return res.status(401).json({ error: 'missing authorization header' });
  }
  
  const token = header.replace('Bearer ', '');
  
  if (!token) {
    logger.warn('Auth failed: missing token', { requestId: req.requestId });
    return res.status(401).json({ error: 'missing token' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded?.jti) {
      const revoked = await RevokedToken.findOne({ jti: decoded.jti }).lean();
      if (revoked) {
        logger.warn('Auth failed: token revoked', { requestId: req.requestId, jti: decoded.jti });
        return res.status(401).json({ error: 'token revoked' });
      }
    }
    req.user = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      logger.warn('Auth failed: token expired', { requestId: req.requestId });
      return res.status(401).json({ error: 'token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      logger.warn('Auth failed: invalid token', { requestId: req.requestId });
      return res.status(401).json({ error: 'invalid token' });
    }
    logger.warn('Auth failed: authentication failed', { requestId: req.requestId });
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
      logger.warn('Authorization failed: insufficient permissions', { requestId: req.requestId, role: req.user.role });
      return res.status(403).json({ error: 'insufficient permissions' });
    }
    
    return next();
  };
};

/**
 * RBAC permission matrix by role.
 */
export const ROLE_PERMISSIONS = {
  ADMIN: ['*'],
  INSTITUTION_ADMIN: [
    'org:read',
    'org:update',
    'inventory:read',
    'inventory:update',
    'requests:read',
    'requests:create',
    'requests:update',
    'members:read',
    'members:create',
    'members:update',
    'members:delete',
    'broadcast:read',
    'broadcast:update',
  ],
  FIRST_RESPONDER: ['org:read', 'inventory:read', 'requests:read', 'members:read', 'broadcast:read'],
  LOCAL_AUTHORITY: ['org:read', 'inventory:read', 'requests:read', 'members:read', 'broadcast:read'],
  CONTRACTOR: ['org:read', 'inventory:read', 'requests:read'],
  GENERAL_USER: ['org:read', 'broadcast:read'],
};

/**
 * Permission-based authorization middleware.
 * @param {string} permission
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'authentication required' });
    }

    const role = req.user.role;
    const perms = ROLE_PERMISSIONS[role] || [];

    if (perms.includes('*') || perms.includes(permission)) {
      return next();
    }

    logger.warn('Authorization failed: permission denied', { requestId: req.requestId, role, permission });
    return res.status(403).json({ error: 'insufficient permissions' });
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
      logger.warn('Authorization failed: org access denied', { requestId: req.requestId, role: req.user.role, orgId: req.user.orgId, resourceOrgId });
      return res.status(403).json({ error: 'access denied to this organization' });
    }
    
    return next();
  };
};
