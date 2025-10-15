const router = require('./routes/hangman');

console.log('=== ROUTES HANGMAN ===');
router.stack.forEach((r, i) => {
  const method = r.route.stack[0].method.toUpperCase();
  const path = r.route.path;
  console.log(`${i+1}. ${method} /hangman${path}`);
});
console.log(`\nTotal: ${router.stack.length} routes`);
