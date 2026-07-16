import { ConvexClient } from 'convex/browser';
import { anyApi } from 'convex/server';
const client = new ConvexClient('http://127.0.0.1:3210');
let n = 0;
client.onUpdate(anyApi.memory.snapshot, {}, (snap) => {
  n += 1;
  console.log(`UPDATE ${n}: liveCount=${snap?.liveCount} chainLength=${snap?.chainLength} head=${(snap?.headHash ?? '').slice(0, 12)}`);
  if (n >= 2) { client.close(); process.exit(0); }
});
setTimeout(() => { console.log('TIMEOUT'); process.exit(2); }, 30000);
