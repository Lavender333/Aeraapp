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
        error: 'validation failed',
        details: errors,
      });
    }
    
    // Replace req[source] with validated and coerced data
    req[source] = result.data;
    return next();
  };
};
