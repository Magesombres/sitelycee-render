const { ZodError } = require('zod');

// Generic validator: schema is a zod object, target can be 'body' | 'query' | 'params'
function validate(schema, target = 'body') {
  return (req, _res, next) => {
    console.log('[DEBUG VALIDATE] BEFORE parse - req.user:', req.user ? JSON.stringify(req.user) : 'UNDEFINED');
    try {
      const data = schema.parse(req[target]);
      console.log('[DEBUG VALIDATE] AFTER parse, BEFORE assignment - req.user:', req.user ? JSON.stringify(req.user) : 'UNDEFINED');
      req[target] = data; // sanitized
      console.log('[DEBUG VALIDATE] AFTER assignment - req.user:', req.user ? JSON.stringify(req.user) : 'UNDEFINED');
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        const err = new Error('Validation échouée');
        err.status = 400;
        err.publicMessage = 'Entrées invalides';
        err.details = e.issues.map(i => ({ path: i.path, message: i.message }));
        return next(err);
      }
      return next(e);
    }
  };
}

module.exports = { validate };
