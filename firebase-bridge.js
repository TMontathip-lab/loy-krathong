// Firebase bridge for GitHub Pages. Works without npm or a bundler.
// Firestore SDK is loaded from Google's CDN; no secret service-account keys belong here.
const firebaseConfig = {
  apiKey: 'AIzaSyDboMWwpdSqcc0S9nUaPe2T-cxlG_Y_QHI',
  authDomain: 'loy-krathong-school.firebaseapp.com',
  projectId: 'loy-krathong-school',
  storageBucket: 'loy-krathong-school.firebasestorage.app',
  messagingSenderId: '642891957682',
  appId: '1:642891957682:web:5fb953164bcfe971ef50ab'
};

// Only the newest 18 submitted krathongs are replayed on the shared river.
// This caps reads and animation load on students' phones.
const MAX_LIVE_KRATHONGS = 18;
const MAX_DECORATIONS = 36;
// One krathong per anonymous Firebase UID every 60 seconds; enforced by Firestore Rules.
const ownCreatedIds = new Set();
let status = 'connecting', statusMessage = 'กำลังเชื่อมต่อฐานข้อมูล';
let notifyStatus = () => {};
let notifyFloats = () => {};
let db, auth, firestoreFns;
let isReady = false;

function updateStatus(next, message) {
  status = next;
  statusMessage = message;
  isReady = next === 'ready';
  notifyStatus(status, statusMessage);
}

window.krathongCloud = {
  onStatus(callback) { notifyStatus = callback; callback(status, statusMessage); },
  onFloats(callback) { notifyFloats = callback; },
  async publish({ name, wish, design }) {
    if (!isReady || !auth?.currentUser || !db || !firestoreFns) {
      throw new Error('ยังไม่ได้เชื่อมต่อ Firebase');
    }
    name = String(name || '').trim();
    wish = String(wish || '').trim();
    const checked = window.krathongGuard?.check(name, wish);
    if (!checked || !checked.ok) {
      throw new Error(checked?.message || 'กรุณาตรวจสอบคำอธิษฐานก่อนส่ง');
    }
    if (!Array.isArray(design) || design.length < 1 || design.length > MAX_DECORATIONS) {
      throw new Error('จำนวนของตกแต่งไม่ถูกต้อง');
    }
    name = checked.name;
    wish = checked.wish;
    const parts = design.map(({ kind, index, x, y, w, h }) => ({
      kind, index, x, y, w, h
    }));
    const ref = firestoreFns.doc(firestoreFns.collection(db, 'krathongs'));
    const rateRef = firestoreFns.doc(db, 'krathongLimits', auth.currentUser.uid);
    ownCreatedIds.add(ref.id);  // Hide this browser's release from the repeating remote stream.
    try {
      // Atomic pair: Firestore Rules verify the cooldown record and the new krathong.
      // Never store the visitor's name or wish in the cooldown record.
      const batch = firestoreFns.writeBatch(db);
      batch.set(ref, {
        uid: auth.currentUser.uid,
        name, wish, design: parts,
        createdAt: firestoreFns.serverTimestamp()
      });
      batch.set(rateRef, {
        lastCreatedAt: firestoreFns.serverTimestamp(),
        lastKrathongId: ref.id
      });
      await batch.commit();
    } catch (error) {
      ownCreatedIds.delete(ref.id);
      throw error;
    }
    return ref.id;
  }
};

async function startFirebase() {
  try {
    // This version matches the SDK version shown by Firebase Console for this app.
    const CDN = 'https://www.gstatic.com/firebasejs/13.1.0/';
    const [appFns, authFns, fsFns] = await Promise.all([
      import(CDN + 'firebase-app.js'),
      import(CDN + 'firebase-auth.js'),
      import(CDN + 'firebase-firestore.js')
    ]);
    firestoreFns = fsFns;
    const app = appFns.initializeApp(firebaseConfig);
    auth = authFns.getAuth(app);
    if (typeof auth.authStateReady === 'function') await auth.authStateReady();
    if (!auth.currentUser) await authFns.signInAnonymously(auth);
    db = fsFns.getFirestore(app);
    const recentQuery = fsFns.query(
      fsFns.collection(db, 'krathongs'),
      fsFns.orderBy('createdAt', 'desc'),
      fsFns.limit(MAX_LIVE_KRATHONGS)
    );
    fsFns.onSnapshot(recentQuery, { includeMetadataChanges: true }, snapshot => {
      const realRows = snapshot.docs
        .filter(d => !d.metadata.hasPendingWrites && !ownCreatedIds.has(d.id))
        .map(d => ({ id: d.id, ...d.data() }));
      if (!snapshot.metadata.fromCache) {
        updateStatus('ready', 'เชื่อมต่อแม่น้ำออนไลน์แล้ว');
        notifyFloats(realRows);
      } else {
        updateStatus('connecting', 'ยังไม่สามารถยืนยันข้อมูลล่าสุดจากเซิร์ฟเวอร์');
      }
    }, error => {
      console.error('Firestore listener failed', error);
      updateStatus('error', 'เชื่อมต่อ Firestore ไม่สำเร็จ ตรวจ Rules และ Authentication');
    });
  } catch (error) {
    console.error('Firebase initialization failed', error);
    updateStatus('error', 'เชื่อมต่อ Firebase ไม่สำเร็จ ตรวจการตั้งค่าเครือข่ายและโปรเจกต์');
  }
}
startFirebase();
