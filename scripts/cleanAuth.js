import fs from 'fs';
import path from 'path';

const authDir = path.resolve(process.cwd(), 'auth_info_baileys');

if (fs.existsSync(authDir)) {
  try {
    fs.rmSync(authDir, { recursive: true, force: true });
    console.log('✅ Successfully cleaned auth_info_baileys directory.');
  } catch (err) {
    console.error('⚠️ Could not remove auth folder (it may be in use by another running process):', err.message);
  }
} else {
  console.log('ℹ️ Auth directory does not exist or is already clean.');
}
