const { ZodError } = require('zod');

// Generic validator: schema is a zod object, target can be 'body' | 'query' | 'params'
function validate(schema, target = 'body') {
  return (req, _res, next) => {
    try {
      const data = schema.parse(req[target]);
      req[target] = data; // sanitized
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
