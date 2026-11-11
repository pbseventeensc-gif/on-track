// Generate an explicit UID allowlist from a Firebase Authentication JSON export.
// Review the exported accounts before running; new accounts are never auto-approved.
// Usage: node scripts/build_database_rules.cjs /path/to/reviewed-auth-export.json
const fs = require('node:fs');
const path = require('node:path');

const input = process.argv[2];
if (!input) throw new Error('Provide a reviewed Firebase Authentication JSON export.');
const { users } = JSON.parse(fs.readFileSync(input, 'utf8'));
if (!Array.isArray(users)) throw new Error('Invalid Authentication export.');
const uids = [...new Set(users
  .filter(user => !user.disabled && user.email && user.localId)
  .map(user => user.localId))].sort();
if (!uids.length || uids.some(uid => !/^[A-Za-z0-9_-]+$/.test(uid))) {
  throw new Error('Expected at least one approved account with a valid UID.');
}
const allowed = `auth != null && auth.token.firebase.sign_in_provider != 'anonymous' && !root.child('_deleted_accounts').child(auth.uid).exists() && (${uids.map(uid => `auth.uid === '${uid}'`).join(' || ')})`;
// Child writes preserve internal access while keeping revocation markers server-owned.
const rules = { rules: { '.read': allowed, '.write': false, '$node': {'.write': `$node !== '_deleted_accounts' && (${allowed})`} } };
const output = path.join(__dirname, '..', 'database.rules.json');
fs.writeFileSync(output, JSON.stringify(rules, null, 2) + '\n');
console.log(`Generated Realtime Database rules for ${uids.length} approved UIDs.`);
