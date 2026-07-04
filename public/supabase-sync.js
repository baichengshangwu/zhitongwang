// Supabase → Surge sync service
// Polls Supabase for friend requests, profiles, friends list
// Writes to static JSON files for Surge deployment
const https = require('https');
const fs = require('fs');
const path = require('path');

const SUPABASE_HOST = 'ftucdwqmlzbmmbuiqsgo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0dWNkd3FtbHpibW1idWlxc2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDU2NTgsImV4cCI6MjA5NzE4MTY1OH0.ox3uZMZ87DNXBx-IyuZpE-MaQ0uP9eIbtp9dTFIuOTM';
const OUTPUT_DIR = __dirname + '/api_data';
const POLL_INTERVAL = 10000; // 10 seconds

function supabaseFetch(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: SUPABASE_HOST,
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
      },
    };
    https.get(opts, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { resolve(null); }
      });
    }).on('error', reject);
  });
}

async function syncData() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  try {
    // Sync profiles
    const profiles = await supabaseFetch('/rest/v1/profiles?select=*&limit=1000&order=id');
    if (profiles && Array.isArray(profiles)) {
      fs.writeFileSync(OUTPUT_DIR + '/profiles.json', JSON.stringify(profiles));
      console.log('Synced', profiles.length, 'profiles');
    }

    // Sync friend requests
    const requests = await supabaseFetch('/rest/v1/friend_requests?select=*&status=eq.pending&limit=500');
    if (requests && Array.isArray(requests)) {
      fs.writeFileSync(OUTPUT_DIR + '/friend_requests.json', JSON.stringify(requests));
      console.log('Synced', requests.length, 'friend requests');
    }

    // Sync friends
    const friends = await supabaseFetch('/rest/v1/friends?select=*&limit=2000');
    if (friends && Array.isArray(friends)) {
      fs.writeFileSync(OUTPUT_DIR + '/friends.json', JSON.stringify(friends));
      console.log('Synced', friends.length, 'friends');
    }

    // Sync last update timestamp
    fs.writeFileSync(OUTPUT_DIR + '/last_sync.json', JSON.stringify({ time: new Date().toISOString() }));
    
    console.log('Sync complete at', new Date().toISOString());
  } catch(e) {
    console.error('Sync error:', e.message);
  }
}

// Run immediately, then poll
syncData();
setInterval(syncData, POLL_INTERVAL);
console.log('Supabase sync service started, interval:', POLL_INTERVAL+'ms');
