/**
 * Validation middleware factory using Zod schemas.
 * Validates request body, params, or query against a schema.
 * Returns 400 with structured error details on validation failure.
 * 
 * @param {Object} schema - Zod schema object
 * @param {string} source - Which part of the request to validate: 'body', 'params', or 'query'
 * @returns {Function} Express middleware
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    
    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      
      return res.status(400).json({
        error: {
          code: 400,
          message: 'validation failed',
          details: errors,
          requestId: req.requestId,
        },
      });
    }
    
    // Express 5 exposes req.query as a getter. Mutate its object instead of
    // assigning to the request property; body and params remain assignable.
    if (source === 'query') {
      for (const key of Object.keys(req.query || {})) delete req.query[key];
      Object.assign(req.query, result.data);
    } else {
      req[source] = result.data;
    }
    return next();
  };
};
