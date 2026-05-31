import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { isEncryptedPayload, decryptPayload } from '../lib/payloadCrypto';

// ---------------------------------------------------------------------------
// API client — single base URL pulled from .env. All persistence flows through
// the FastAPI backend → MongoDB.  React state mirrors the backend so existing
// synchronous getX() / saveX() signatures continue to work for components.
// ---------------------------------------------------------------------------
const API_BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;
const api = axios.create({ baseURL: API_BASE, timeout: 30000 });

// ── Bearer token plumbing ───────────────────────────────────────────────
// Token is held in sessionStorage (NOT localStorage) + an in-memory ref so
// it's automatically scoped to the tab and never appears alongside the
// user record. An axios interceptor attaches it to every outbound request.
const TOKEN_KEY = 'eco_auth_token';
const getStoredToken = () => {
  try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
};
const setStoredToken = (token) => {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore quota / privacy-mode errors */ }
};
api.interceptors.request.use((config) => {
  const t = getStoredToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});
// Decrypt AES-GCM-encrypted response bodies in-place so callers receive
// plain JS objects while DevTools Network still shows only ciphertext.
async function decryptResponseInPlace(response) {
  if (response && isEncryptedPayload(response.data)) {
    try {
      response.data = await decryptPayload(response.data);
    } catch (err) {
      // Surface the error to the caller — do not silently hand back ciphertext.
      // eslint-disable-next-line no-console
      console.error('Payload decryption failed', err);
      throw err;
    }
  }
  return response;
}
api.interceptors.response.use(
  (r) => decryptResponseInPlace(r),
  async (error) => {
    if (error?.response) {
      try { await decryptResponseInPlace(error.response); } catch { /* ignore */ }
    }
    return Promise.reject(error);
  },
);
// Same interceptor for the bare `axios` instance (some legacy callers
// use `axios` directly with a full URL — keep them authenticated too).
axios.interceptors.request.use((config) => {
  const t = getStoredToken();
  if (t && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});
axios.interceptors.response.use(
  (r) => decryptResponseInPlace(r),
  async (error) => {
    if (error?.response) {
      try { await decryptResponseInPlace(error.response); } catch { /* ignore */ }
    }
    return Promise.reject(error);
  },
);

export const DEFAULT_COMPANY = {
  name: 'ECO PEST SOLUTIONS',
  gstNumber: '29DYSPM4565D2ZS',
  sacCode: '998531',
  cgst: 9,
  sgst: 9,
  address: 'No. 281, Ground floor, 4th cross 3rd main, B-Block,\nVijayanandanagar, Nandini Layout Post, Bangalore - 560096',
  phone1: '9731066971',
  phone2: '9481566971',
  phone3: '9663996594',
  email: 'mge.ecopestsolutions@gmail.com',
  website: 'www.ecopestsolutions.org',
  bankHolder: 'ECO PEST SOLUTIONS',
  bankName: '',
  bankAccount: '',
  ifscCode: '',
  micrCode: '',
  logoUrl: 'https://customer-assets.emergentagent.com/job_pest-bill-pro/artifacts/6rlfc41s_Eco_logo.png',
  signUrl: '',   // Authorised signature image (shown above the seal on invoice)
  sealUrl: '',   // Company seal / stamp image (shown below the signature)
};

// Location options for the description dropdown — used in BillGenerate
// (default list; the live list can be extended/edited by the user and is
// persisted under company.locations so it syncs across devices).
export const LOCATION_OPTIONS = [
  'Apartment', 'Home', 'Industry', 'Factory', 'College', 'Office', 'Hotel', 'Restaurant', 'Other',
];

// Default services with {LOCATION} placeholder support
const DEFAULT_SERVICES = [
  { id: '1', name: 'Fumigation Treatment for Wooden Pallets', description: 'Fumigation Treatment for Wooden Pallets carried out at your {LOCATION} premises.', descriptionTemplate: 'Fumigation Treatment for Wooden Pallets carried out at your {LOCATION} premises.' },
  { id: '2', name: 'General Disinfestation Service for Bedbug Control', description: 'General Disinfestation Service carried out at your entire {LOCATION} premises for Bedbug control.', descriptionTemplate: 'General Disinfestation Service carried out at your entire {LOCATION} premises for Bedbug control.' },
  { id: '3', name: 'Smoke Fumigation Treatment for Cockroaches Control', description: 'Smoke Fumigation Treatment carried out at your entire {LOCATION} premises for Cockroaches Control.', descriptionTemplate: 'Smoke Fumigation Treatment carried out at your entire {LOCATION} premises for Cockroaches Control.' },
  { id: '4', name: 'General Disinfestation Service and Herbal Jell Treatment for Cockroaches', description: 'General disinfestation service and Herbal Jell Treatment carried out at your entire {LOCATION} premises for Cockroaches Control.', descriptionTemplate: 'General disinfestation service and Herbal Jell Treatment carried out at your entire {LOCATION} premises for Cockroaches Control.' },
  { id: '5', name: 'General Disinfestation Service for Mosquitoes, Flies and Rodent Control', description: 'General disinfestation service carried out at your {LOCATION} premises for Mosquitoes, Flies and Rodent Control service.', descriptionTemplate: 'General disinfestation service carried out at your {LOCATION} premises for Mosquitoes, Flies and Rodent Control service.' },
  { id: '6', name: 'General Disinfestation Service and Rodent Control Service', description: 'General disinfestation service and Rodent Control Service carried out at your entire {LOCATION} premises.', descriptionTemplate: 'General disinfestation service and Rodent Control Service carried out at your entire {LOCATION} premises.' },
  { id: '7', name: 'General Disinfestation Service for Mosquitoes and Cockroaches', description: 'General disinfestation service carried out at your {LOCATION} premises for Mosquitoes and Cockroaches.', descriptionTemplate: 'General disinfestation service carried out at your {LOCATION} premises for Mosquitoes and Cockroaches.' },
  { id: '8', name: 'Herbal Jell Treatment', description: 'Herbal Jell Treatment, Anti-Termite Treatment & Rat Glue Board for Rat Control carried out at your {LOCATION} premises.', descriptionTemplate: 'Herbal Jell Treatment, Anti-Termite Treatment & Rat Glue Board for Rat Control carried out at your {LOCATION} premises.' },
  { id: '9', name: 'General Disinfestation Service for Bedbug, Flies and Mosquitoes', description: 'General disinfestation service carried out at your entire {LOCATION} premises for Bedbug control, Flies Control and Mosquitoes.', descriptionTemplate: 'General disinfestation service carried out at your entire {LOCATION} premises for Bedbug control, Flies Control and Mosquitoes.' },
  { id: '10', name: 'Rodent Control Service', description: 'Rodent Control Service carried out at your {LOCATION} Premises by Using Spot Traps and Glue Boards.', descriptionTemplate: 'Rodent Control Service carried out at your {LOCATION} Premises by Using Spot Traps and Glue Boards.' },
  { id: '11', name: 'General Disinfestation Service for Mosquitoes, Cockroaches, Ants and Rodent', description: 'General disinfestation service carried out at your {LOCATION} premises for Mosquitoes, Cockroaches, Ants Control and Rodent Control service.', descriptionTemplate: 'General disinfestation service carried out at your {LOCATION} premises for Mosquitoes, Cockroaches, Ants Control and Rodent Control service.' },
  { id: '12', name: 'Pest Control (Post-construction)', description: 'Anti-Cockroach Gel Treatment, Bed Bug Control, General Disinfection Treatment, Termite Control Treatment carried out at your {LOCATION} premises.', descriptionTemplate: 'Anti-Cockroach Gel Treatment, Bed Bug Control, General Disinfection Treatment, Termite Control Treatment carried out at your {LOCATION} premises.' },
  { id: '13', name: 'Snake Control Service', description: 'Snake Control Service carried out at your {LOCATION} premises.', descriptionTemplate: 'Snake Control Service carried out at your {LOCATION} premises.' },
  { id: '14', name: 'Honey Bee Hive Removed', description: 'Honey Bee Hive Removed safely from your {LOCATION} premises.', descriptionTemplate: 'Honey Bee Hive Removed safely from your {LOCATION} premises.' },
  { id: '15', name: 'Anti-Termite Treatment By Drilling And Chemical Filling', description: 'Anti-Termite Treatment by Drilling and Chemical Filling carried out at your {LOCATION} premises.', descriptionTemplate: 'Anti-Termite Treatment by Drilling and Chemical Filling carried out at your {LOCATION} premises.' },
  { id: '16', name: 'General Disinfestation Service for Ants Control', description: 'General Disinfestation service carried out for Ants Control at your {LOCATION} premises.', descriptionTemplate: 'General Disinfestation service carried out for Ants Control at your {LOCATION} premises.' },
  { id: '17', name: 'Fogging Treatment', description: 'Fogging Treatment carried out at your {LOCATION} premises for pest control.', descriptionTemplate: 'Fogging Treatment carried out at your {LOCATION} premises for pest control.' },
  { id: '18', name: 'Fogging Machine Issued', description: 'Fogging Machine Issued for pest control use.', descriptionTemplate: 'Fogging Machine Issued for pest control use.' },
  { id: '19', name: 'Fogging Gas Can Issued', description: 'Fogging Gas Can Issued for fogging treatment.', descriptionTemplate: 'Fogging Gas Can Issued for fogging treatment.' },
  { id: '20', name: 'Fogging Chemical Issued', description: 'Fogging Chemical Issued for treatment.', descriptionTemplate: 'Fogging Chemical Issued for treatment.' },
  { id: '21', name: 'Cockroaches Chemical (Propoxer 20% EC)', description: 'Cockroaches Chemical (Propoxer 20% EC) supplied.', descriptionTemplate: 'Cockroaches Chemical (Propoxer 20% EC) supplied.' },
  { id: '22', name: 'Rat Traps', description: 'Rat Traps supplied for rodent control.', descriptionTemplate: 'Rat Traps supplied for rodent control.' },
];

const AppContext = createContext(null);

// In-app toast helper — replaces browser-level Notification API so users get a
// consistent visual cue inside the dashboard rather than an OS-level popup.
const showInAppNotif = (notif) => {
  const title = notif?.title || 'Notification';
  const message = notif?.message || '';
  const type = notif?.type || 'info';
  const opts = message ? { description: message } : undefined;
  if (type === 'bill_approved') return toast.success(title, opts);
  if (type === 'bill_rejected') return toast.error(title, opts);
  if (type === 'verification_request') return toast.warning(title, opts);
  return toast.info(title, opts);
};

// Deep equality good enough for our diffing — JSON-stringify is fine since
// our payloads are pure JSON (no Dates / Maps / Sets / functions).
const sameDoc = (a, b) => {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
};

export const AppProvider = ({ children }) => {
  // ── React state mirrors MongoDB ──────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [bills, setBills] = useState([]);
  const [services, setServices] = useState(DEFAULT_SERVICES);
  const [companyProfile, setCompanyProfile] = useState(DEFAULT_COMPANY);
  const [notificationsByUser, setNotificationsByUser] = useState({});
  const [loaded, setLoaded] = useState(false);

  // Refs hold the *latest* state synchronously so getX() never returns stale
  // data (React state updates are async — refs let us read immediately after
  // a setX call, which several callers rely on).
  const usersRef     = useRef([]);
  const customersRef = useRef([]);
  const billsRef     = useRef([]);
  const servicesRef  = useRef(DEFAULT_SERVICES);
  const companyRef   = useRef(DEFAULT_COMPANY);
  const notifsRef    = useRef({});

  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { customersRef.current = customers; }, [customers]);
  useEffect(() => { billsRef.current = bills; }, [bills]);
  useEffect(() => { servicesRef.current = services; }, [services]);
  useEffect(() => { companyRef.current = companyProfile; }, [companyProfile]);
  useEffect(() => { notificationsByUser; notifsRef.current = notificationsByUser; }, [notificationsByUser]);

  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('eco_current_user')); } catch { return null; }
  });
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('eco_language');
    // Only English is supported now; coerce legacy 'hi' / 'kn' values to 'en'.
    return saved === 'en' ? saved : 'en';
  });
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('eco_dark') === 'true');
  const [tick, setTick] = useState(0);
  const bumpTick = useCallback(() => setTick(t => t + 1), []);

  // ── Initial load: pull everything from the API ────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // Ensure superior admin exists in MongoDB (idempotent on backend)
        await api.post('/seed').catch(() => {});

        const [u, c, b, s, comp] = await Promise.all([
          api.get('/users').then(r => r.data).catch(() => []),
          api.get('/customers').then(r => r.data).catch(() => []),
          api.get('/bills').then(r => r.data).catch(() => []),
          api.get('/services').then(r => r.data).catch(() => []),
          api.get('/company').then(r => r.data).catch(() => null),
        ]);
        if (cancelled) return;

        const usersData     = Array.isArray(u) ? u : [];
        const customersData = Array.isArray(c) ? c : [];
        const billsData     = Array.isArray(b) ? b : [];

        // Refs MUST be set synchronously here, before React commits the render
        // triggered by setLoaded(true). Otherwise getBills()/getCustomers()/...
        // (which read from refs) return [] on the first render after refresh
        // and pages like Bill Summary appear blank until the user navigates.
        usersRef.current     = usersData;
        customersRef.current = customersData;
        billsRef.current     = billsData;

        setUsers(usersData);
        setCustomers(customersData);
        setBills(billsData);

        // Seed default services on first run
        if (Array.isArray(s) && s.length === 0) {
          await api.put('/services', DEFAULT_SERVICES).catch(() => {});
          servicesRef.current = DEFAULT_SERVICES;
          setServices(DEFAULT_SERVICES);
        } else if (Array.isArray(s)) {
          servicesRef.current = s;
          setServices(s);
        }

        if (comp && comp.name) {
          // Merge with DEFAULT_COMPANY so legacy phone1/phone2/phone3 fields used
          // by the invoice template remain populated even if backend stores them flat.
          const merged = { ...DEFAULT_COMPANY, ...comp };
          companyRef.current = merged;
          setCompanyProfile(merged);
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
          // Force a re-render so any consumer reading from refs picks up the
          // newly hydrated data on the very first paint after `loaded` flips.
          setTick(t => t + 1);
        }
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load notifications for current user when they log in
  useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;
    api.get(`/notifications/${currentUser.id}`)
      .then(r => {
        if (cancelled) return;
        setNotificationsByUser(prev => ({ ...prev, [String(currentUser.id)]: r.data || [] }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  // ── Refetch all data once the user logs in ──────────────────────────────
  // The initial /users /customers /bills /services /company fetch runs on
  // app mount BEFORE the user has a token, so every request returns 401 and
  // the dashboard shows zeros. Trigger a fresh fetch the moment a userId
  // appears so the dashboard hydrates immediately after login / page refresh
  // with a valid session.
  useEffect(() => {
    if (!currentUser?.id) return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // ── Live sync: keep every tab / device in lock-step with MongoDB ───────
  // Strategy:
  //   1. Polling every 5 s (paused while the tab is hidden) — covers other
  //      devices / other users.
  //   2. Re-fetch immediately on tab focus / visibility-change — covers the
  //      "switched back to the tab" case so users see fresh data instantly.
  //   3. BroadcastChannel within the same browser — any tab that writes
  //      pushes a "dirty" ping so other tabs refetch in the same event loop.
  //
  // We diff against the previous state via JSON.stringify and only setState
  // when something actually changed, so renders stay cheap.
  const refreshAll = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const reqs = [
        api.get('/users').then(r => r.data).catch(() => null),
        api.get('/customers').then(r => r.data).catch(() => null),
        api.get('/bills').then(r => r.data).catch(() => null),
        api.get('/services').then(r => r.data).catch(() => null),
        api.get('/company').then(r => r.data).catch(() => null),
      ];
      if (currentUser?.id) {
        reqs.push(api.get(`/notifications/${currentUser.id}`).then(r => r.data).catch(() => null));
      }
      const [u, c, b, s, comp, n] = await Promise.all(reqs);

      // IMPORTANT: update the ref AND setState together. Components read
      // data via getCustomers()/getBills()/... which return the ref; if we
      // only setState, the ref-sync useEffect runs AFTER the consumer's
      // re-render — so the very next paint shows stale data until another
      // render is triggered. Updating the ref synchronously alongside
      // setState guarantees consumers see fresh data on the next paint.
      let changed = false;
      if (Array.isArray(u) && !sameDoc(u, usersRef.current))         { usersRef.current = u;     setUsers(u);         changed = true; }
      if (Array.isArray(c) && !sameDoc(c, customersRef.current))     { customersRef.current = c; setCustomers(c);     changed = true; }
      if (Array.isArray(b) && !sameDoc(b, billsRef.current))         { billsRef.current = b;     setBills(b);         changed = true; }
      if (Array.isArray(s) && !sameDoc(s, servicesRef.current))      { servicesRef.current = s;  setServices(s);      changed = true; }
      if (comp && comp.name) {
        const merged = { ...DEFAULT_COMPANY, ...comp };
        if (!sameDoc(merged, companyRef.current)) {
          companyRef.current = merged;
          setCompanyProfile(merged);
          changed = true;
        }
      }
      if (Array.isArray(n) && currentUser?.id) {
        const uid = String(currentUser.id);
        const prev = notifsRef.current[uid] || [];
        if (!sameDoc(n, prev)) {
          notifsRef.current = { ...notifsRef.current, [uid]: n };
          setNotificationsByUser(prevState => ({ ...prevState, [uid]: n }));
          changed = true;
        }
      }
      if (changed) bumpTick();
    } catch (_) { /* silent — next tick will retry */ }
  }, [currentUser?.id, bumpTick]);

  // Scope-aware refresh — only re-fetch the collection that actually changed,
  // so a tiny notification mutation doesn't repaint customers/bills/users etc.
  // Falls back to refreshAll() for unknown scopes.
  const refreshScope = useCallback(async (scope) => {
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      switch (scope) {
        case 'users': {
          const u = await api.get('/users').then(r => r.data).catch(() => null);
          if (Array.isArray(u) && !sameDoc(u, usersRef.current)) {
            usersRef.current = u;
            setUsers(u);
            bumpTick();
          }
          break;
        }
        case 'customers': {
          const c = await api.get('/customers').then(r => r.data).catch(() => null);
          if (Array.isArray(c) && !sameDoc(c, customersRef.current)) {
            customersRef.current = c;
            setCustomers(c);
            bumpTick();
          }
          break;
        }
        case 'bills': {
          const b = await api.get('/bills').then(r => r.data).catch(() => null);
          if (Array.isArray(b) && !sameDoc(b, billsRef.current)) {
            billsRef.current = b;
            setBills(b);
            bumpTick();
          }
          break;
        }
        case 'services': {
          const s = await api.get('/services').then(r => r.data).catch(() => null);
          if (Array.isArray(s) && !sameDoc(s, servicesRef.current)) {
            servicesRef.current = s;
            setServices(s);
            bumpTick();
          }
          break;
        }
        case 'company': {
          const comp = await api.get('/company').then(r => r.data).catch(() => null);
          if (comp && comp.name) {
            const merged = { ...DEFAULT_COMPANY, ...comp };
            if (!sameDoc(merged, companyRef.current)) {
              companyRef.current = merged;
              setCompanyProfile(merged);
              bumpTick();
            }
          }
          break;
        }
        case 'notifications': {
          if (!currentUser?.id) return;
          const n = await api.get(`/notifications/${currentUser.id}`).then(r => r.data).catch(() => null);
          if (Array.isArray(n)) {
            const uid = String(currentUser.id);
            const prev = notifsRef.current[uid] || [];
            if (!sameDoc(n, prev)) {
              notifsRef.current = { ...notifsRef.current, [uid]: n };
              setNotificationsByUser(prevState => ({ ...prevState, [uid]: n }));
              bumpTick();
            }
          }
          break;
        }
        default:
          // Unknown scope — be conservative and fall back to full sync.
          refreshAll();
      }
    } catch (_) { /* silent */ }
  }, [currentUser?.id, refreshAll, bumpTick]);

  // BroadcastChannel: instant nudge between tabs of the same browser.
  const bcRef = useRef(null);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('eco-billing-sync');
    bcRef.current = ch;
    ch.onmessage = (ev) => {
      if (ev?.data?.type === 'mutate') {
        if (ev.data.scope) refreshScope(ev.data.scope);
        else refreshAll();
      }
    };
    return () => { try { ch.close(); } catch (_) { /* ignore */ } bcRef.current = null; };
  }, [refreshAll, refreshScope]);

  // ── WebSocket: instant push from the backend whenever any client mutates
  // a tracked collection. Falls back gracefully — the polling effect below
  // continues to run, so we still recover even if the socket is blocked by
  // a proxy / corporate firewall.
  const wsRef = useRef(null);
  const wsRetryRef = useRef(0);
  // Tracks whether the WS is currently open & receiving — used to disable the
  // 30 s polling fallback when realtime push is already covering us.
  const wsHealthyRef = useRef(false);
  useEffect(() => {
    if (!loaded) return undefined;
    let cancelled = false;
    let socket = null;
    let reconnectTimer = null;

    const wsUrl = (() => {
      try {
        const base = new URL(API_BASE);
        const proto = base.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${proto}//${base.host}${base.pathname.replace(/\/$/, '')}/ws`;
      } catch (_) {
        return null;
      }
    })();
    if (!wsUrl) return undefined;

    const connect = () => {
      if (cancelled) return;
      let heartbeatTimer = null;
      let lastPongAt = Date.now();

      const stopHeartbeat = () => {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
      };

      try {
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          wsRetryRef.current = 0;
          wsHealthyRef.current = true;
          lastPongAt = Date.now();
          // 25 s heartbeat — keeps idle WS alive through reverse proxies
          // (Kubernetes nginx ingress typically closes idle WS at 60 s) AND
          // probes for silent disconnects (send() throws if the socket
          // is dead, even when onclose hasn't fired yet).
          stopHeartbeat();
          heartbeatTimer = setInterval(() => {
            if (!socket || socket.readyState !== 1) {
              stopHeartbeat();
              return;
            }
            try {
              socket.send('ping');
            } catch (_) {
              // Socket is dead — force reconnect
              stopHeartbeat();
              wsHealthyRef.current = false;
              try { socket.close(); } catch (__) { /* ignore */ }
            }
            // If we haven't seen ANY frame from the server in > 70 s the
            // connection is almost certainly half-open; force a reconnect.
            if (Date.now() - lastPongAt > 70000) {
              stopHeartbeat();
              wsHealthyRef.current = false;
              try { socket.close(); } catch (__) { /* ignore */ }
            }
          }, 25000);
        };
        socket.onmessage = (ev) => {
          // Any frame from the server (mutation broadcast OR a server-side
          // keepalive) refreshes our "connection alive" timestamp.
          lastPongAt = Date.now();
          try {
            const payload = JSON.parse(ev.data);
            // Any mutation from any client → re-fetch JUST the affected
            // collection. refreshScope() diffs against current state and
            // only setState() if it actually changed, so React re-renders
            // only the affected sections.
            if (payload && payload.scope) {
              // Server-initiated keepalive — ignore (lastPongAt was already
              // refreshed above when this frame arrived).
              if (payload.scope === '_heartbeat') return;
              refreshScope(payload.scope);
              // Also nudge other tabs of the same browser.
              try { bcRef.current?.postMessage({ type: 'mutate', scope: payload.scope, at: payload.at }); } catch (_) { /* ignore */ }
            }
          } catch (_) { /* ignore malformed frames */ }
        };
        socket.onclose = () => {
          stopHeartbeat();
          wsRef.current = null;
          wsHealthyRef.current = false;
          if (cancelled) return;
          // Exponential backoff capped at 30 s. Polling resumes
          // immediately as the safety net.
          const attempt = Math.min(wsRetryRef.current + 1, 8);
          wsRetryRef.current = attempt;
          const delay = Math.min(1000 * Math.pow(1.6, attempt - 1), 30000);
          reconnectTimer = setTimeout(connect, delay);
        };
        socket.onerror = () => {
          stopHeartbeat();
          // Trigger onclose path
          try { socket.close(); } catch (_) { /* ignore */ }
        };
      } catch (_) {
        // network blocked entirely — back off and retry
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { socket && socket.close(); } catch (_) { /* ignore */ }
      wsRef.current = null;
    };
  }, [loaded, refreshScope]);

  // Polling + focus/visibility listeners — only active once initial load
  // completes. When WebSocket is healthy, the polling tick is a no-op (we'd
  // just be re-fetching data the server already pushed). It still runs every
  // 30 s as a heartbeat so if the WS dies silently (proxy idle timeout) we
  // recover automatically.
  useEffect(() => {
    if (!loaded) return undefined;
    const POLL_MS = 30000;
    const tick = () => { if (!wsHealthyRef.current) refreshAll(); };
    let interval = setInterval(tick, POLL_MS);
    const onFocus = () => refreshAll();
    const onVisible = () => { if (!document.hidden) refreshAll(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loaded, refreshAll]);

  // Helper used inside every save* function so other tabs refetch immediately.
  const broadcastMutation = useCallback((scope = 'any') => {
    try { bcRef.current?.postMessage({ type: 'mutate', scope, at: Date.now() }); } catch (_) { /* ignore */ }
  }, []);

  // ── Synchronous getters (read from refs → always up-to-date) ─────────
  const getUsers     = () => usersRef.current;
  const getCustomers = () => customersRef.current;
  const getBills     = () => billsRef.current;
  const getServices  = () => servicesRef.current;
  const getCompanyProfile = () => ({ ...DEFAULT_COMPANY, ...companyRef.current });

  // ── Diff-based save helpers ──────────────────────────────────────────
  const syncCollection = async ({ oldArr, newArr, key, postPath, putPath, delPath, mapToCreate }) => {
    const oldByKey = new Map(oldArr.map(item => [String(item[key]), item]));
    const newByKey = new Map(newArr.map(item => [String(item[key]), item]));

    const tasks = [];

    // Deletes
    for (const [k, oldItem] of oldByKey) {
      if (!newByKey.has(k)) {
        tasks.push(api.delete(delPath(oldItem)).catch(err => console.warn('delete failed', err)));
      }
    }
    // Inserts + updates
    for (const [k, newItem] of newByKey) {
      const oldItem = oldByKey.get(k);
      if (!oldItem) {
        const payload = mapToCreate ? mapToCreate(newItem) : newItem;
        tasks.push(api.post(postPath, payload).catch(err => console.warn('create failed', err)));
      } else if (!sameDoc(oldItem, newItem)) {
        const payload = mapToCreate ? mapToCreate(newItem) : newItem;
        tasks.push(api.put(putPath(newItem), payload).catch(err => console.warn('update failed', err)));
      }
    }
    await Promise.all(tasks);
  };

  const saveUsers = (newArr) => {
    const oldArr = usersRef.current;
    // Defense-in-depth: ensure ids are strings (Date.now() returns numbers).
    const normalized = newArr.map(u => ({ ...u, id: String(u.id ?? '') }));
    setUsers(normalized); usersRef.current = normalized; bumpTick();
    syncCollection({
      oldArr, newArr: normalized, key: 'id',
      postPath: '/users',
      putPath: (it) => `/users/${encodeURIComponent(it.id)}`,
      delPath: (it) => `/users/${encodeURIComponent(it.id)}`,
    });
    broadcastMutation('users');
  };

  const saveCustomers = (newArr) => {
    const oldArr = customersRef.current;
    const normalized = newArr.map(c => ({ ...c, id: String(c.id ?? '') }));
    setCustomers(normalized); customersRef.current = normalized; bumpTick();
    syncCollection({
      oldArr, newArr: normalized, key: 'id',
      postPath: '/customers',
      putPath: (it) => `/customers/${encodeURIComponent(it.id)}`,
      delPath: (it) => `/customers/${encodeURIComponent(it.id)}`,
    });
    broadcastMutation('customers');
  };

  const saveBills = (newArr) => {
    const oldArr = billsRef.current;
    const normalized = newArr.map(b => ({ ...b, id: b.id != null ? String(b.id) : undefined }));
    setBills(normalized); billsRef.current = normalized; bumpTick();
    // Bills key by billNumber (frontend invariant) — the backend supports
    // upsert / delete by billNumber for exactly this flow.
    syncCollection({
      oldArr, newArr: normalized, key: 'billNumber',
      postPath: '/bills',
      putPath: (it) => `/bills/number/${encodeURIComponent(it.billNumber)}`,
      delPath: (it) => `/bills/number/${encodeURIComponent(it.billNumber)}`,
    });
    broadcastMutation('bills');
  };

  const saveServices = (newArr) => {
    setServices(newArr); servicesRef.current = newArr; bumpTick();
    api.put('/services', newArr).catch(err => console.warn('services save failed', err));
    broadcastMutation('services');
  };

  const saveCompanyProfile = (profile) => {
    const cleaned = { ...profile };
    setCompanyProfile({ ...DEFAULT_COMPANY, ...cleaned });
    companyRef.current = { ...DEFAULT_COMPANY, ...cleaned };
    bumpTick();
    api.put('/company', cleaned).catch(err => console.warn('company save failed', err));
    broadcastMutation('company');
  };

  // ── Bill locations — stored alongside the company profile so they
  // persist & sync via the same /api/company endpoint and live-sync layer.
  const getLocations = () => {
    const list = companyRef.current?.locations;
    return Array.isArray(list) && list.length ? list : LOCATION_OPTIONS;
  };
  const saveLocations = (newList) => {
    // De-duplicate (case-insensitive) and drop empties / whitespace.
    const seen = new Set();
    const cleaned = [];
    for (const raw of newList || []) {
      const v = String(raw || '').trim();
      if (!v) continue;
      const key = v.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(v);
    }
    const next = { ...(companyRef.current || {}), locations: cleaned };
    saveCompanyProfile(next);
  };

  // Stub for legacy verification-requests collection (no component uses it now)
  const getRequests = () => [];
  const saveRequests = () => {};

  // ── Notifications (per-user, persisted to MongoDB) ────────────────────
  const getNotifications = (userId) => {
    if (!userId) return [];
    const list = notifsRef.current[String(userId)] || [];
    return list.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  };

  const getUnreadCount = (userId) => getNotifications(userId).filter(n => !n.read).length;

  const addNotificationFor = (userIds, notif) => {
    const ids = (Array.isArray(userIds) ? userIds : [userIds]).map(String).filter(Boolean);
    if (!ids.length) return;
    const ts = new Date().toISOString();
    const baseId = `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const updates = { ...notifsRef.current };
    const apiCalls = [];
    ids.forEach(uid => {
      const id = `${baseId}_${uid}`;
      const item = {
        id,
        userId: uid,
        type: notif.type || 'info',
        title: notif.title || 'Notification',
        message: notif.message || '',
        billNumber: notif.billNumber || '',
        link: notif.link || '',
        read: false,
        createdAt: ts,
      };
      const list = updates[uid] || [];
      updates[uid] = [item, ...list].slice(0, 100);
      apiCalls.push(api.post('/notifications', item).catch(err => console.warn('notif failed', err)));
    });
    notifsRef.current = updates;
    setNotificationsByUser(updates);
    Promise.all(apiCalls);
    broadcastMutation('notifications');

    if (currentUser && ids.includes(String(currentUser.id))) {
      showInAppNotif(notif);
    }
  };

  const markAllRead = (userId) => {
    const uid = String(userId);
    const list = notifsRef.current[uid] || [];
    const updated = list.map(n => ({ ...n, read: true }));
    const next = { ...notifsRef.current, [uid]: updated };
    notifsRef.current = next;
    setNotificationsByUser(next);
    api.put(`/notifications/user/${uid}/read-all`).catch(() => {});
    broadcastMutation('notifications');
  };

  const clearNotifications = (userId) => {
    const uid = String(userId);
    const next = { ...notifsRef.current };
    delete next[uid];
    notifsRef.current = next;
    setNotificationsByUser(next);
    api.delete(`/notifications/${uid}`).catch(() => {});
    broadcastMutation('notifications');
  };

  // ── Auth (session-only via localStorage; user records live in MongoDB) ──
  const login  = (payload) => {
    // Separate the JWT from the user record. The token lives in
    // sessionStorage; the user record (without password / token) lives in
    // localStorage as before so the existing UX (remember-me, role gates)
    // is preserved.
    const { access_token, token_type, password, ...user } = payload || {};
    if (access_token) setStoredToken(access_token);
    setCurrentUser(user);
    localStorage.setItem('eco_current_user', JSON.stringify(user));
  };
  const logout = () => {
    setCurrentUser(null);
    setStoredToken('');
    localStorage.removeItem('eco_current_user');
  };

  const updateCurrentUser = (updates) => {
    // Never let a stray password / token field re-enter local storage.
    const { password, access_token, token_type, ...clean } = updates || {};
    const updated = { ...currentUser, ...clean };
    setCurrentUser(updated);
    localStorage.setItem('eco_current_user', JSON.stringify(updated));
    const list = usersRef.current;
    saveUsers(list.map(u => String(u.id) === String(updated.id) ? { ...u, ...clean } : u));
  };

  // ── Role helpers ──────────────────────────────────────────────────────
  const isSuperior  = () => currentUser?.role === 'superior';
  const isAssistant = () => currentUser?.role === 'assistant';
  const isFirstUser = () => usersRef.current.length === 0;
  const getAssistants = () => usersRef.current.filter(u => u.role === 'assistant');

  // ── Bill numbering — EPS000001 format (sequence starts at EPS000410) ─
  const BILL_START_SEQ = 410;
  const generateBillNumber = () => {
    const nums = billsRef.current
      .map(b => parseInt(String(b.billNumber || '').replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n));
    const next = Math.max(BILL_START_SEQ - 1, ...nums) + 1;
    return `EPS${String(next).padStart(6, '0')}`;
  };

  const getBillByNumber = (billNumber) =>
    billsRef.current.find(b => b.billNumber === billNumber) || null;

  // ── Verification helpers ──────────────────────────────────────────────
  const getVerificationRequestsFor = (userId) => {
    if (!userId) return [];
    const uid = String(userId);
    return billsRef.current.filter(b => (b.verificationRequestedTo || []).map(String).includes(uid));
  };
  const getVerificationRequestsSentBy = (userId) => {
    if (!userId) return [];
    return billsRef.current.filter(b => String(b.verificationRequestedById) === String(userId));
  };
  const getPendingVerificationsCount = (userId) => {
    if (!userId) return 0;
    const uid = String(userId);
    return billsRef.current.filter(b => {
      const status = b.status || 'pending';
      if (status !== 'pending') return false;
      const requestedTo = (b.verificationRequestedTo || []).map(String);
      const requestedBy = String(b.verificationRequestedById || '');
      return requestedTo.includes(uid) || requestedBy === uid;
    }).length;
  };

  // ── Approval helpers (with notifications) ───────────────────────────
  const getPendingBillsCount = () => billsRef.current.filter(b => b.status === 'pending').length;

  const approveBill = (billNumber, opts = {}) => {
    const list = billsRef.current;
    const target = list.find(b => b.billNumber === billNumber);
    const selfApproved = !!opts.selfApproved;
    saveBills(list.map(b => b.billNumber === billNumber
      ? {
          ...b,
          status: 'approved',
          approvedBy: currentUser?.name,
          approvedById: currentUser?.id,
          approvedByRole: currentUser?.role || '',
          approvedAt: new Date().toISOString(),
          selfApproved,
          selfApprovedAt: selfApproved ? new Date().toISOString() : b.selfApprovedAt,
        }
      : b
    ));
    // Notify the bill sender — prefer createdById, fall back to the user who
    // raised the verification request, then to legacy `createdBy` lookup by name.
    const senderId = target?.createdById
      || target?.verificationRequestedById
      || usersRef.current.find(u => u.name === target?.createdBy)?.id;
    // Skip self-notification when the approver is the same person as the sender.
    if (senderId && String(senderId) !== String(currentUser?.id)) {
      addNotificationFor([senderId], {
        type: 'bill_approved',
        title: `Bill ${billNumber} approved`,
        message: `${currentUser?.name || 'Assistant'} approved invoice ${billNumber}.`,
        billNumber,
        link: '/dashboard/bill-summary',
      });
    }
  };

  const rejectBill = (billNumber, reason = '') => {
    const list = billsRef.current;
    const target = list.find(b => b.billNumber === billNumber);
    saveBills(list.map(b => b.billNumber === billNumber
      ? { ...b, status: 'rejected', rejectedBy: currentUser?.name, rejectedById: currentUser?.id, rejectedAt: new Date().toISOString(), rejectReason: reason }
      : b
    ));
    const senderId = target?.createdById
      || target?.verificationRequestedById
      || usersRef.current.find(u => u.name === target?.createdBy)?.id;
    if (senderId) {
      addNotificationFor([senderId], {
        type: 'bill_rejected',
        title: `Bill ${billNumber} rejected`,
        message: `${currentUser?.name || 'Assistant'} rejected invoice ${billNumber}.${reason ? ' Reason: ' + reason : ''}`,
        billNumber,
        link: '/dashboard/bill-summary',
      });
    }
  };

  const cancelBill = (billNumber, reason = '') => {
    const list = billsRef.current;
    const target = list.find(b => b.billNumber === billNumber);
    saveBills(list.map(b => b.billNumber === billNumber
      ? {
          ...b,
          status: 'cancelled',
          cancelledBy: currentUser?.name,
          cancelledById: currentUser?.id,
          cancelledAt: new Date().toISOString(),
          cancelReason: reason,
        }
      : b
    ));
    // Notify the original creator (if known and different from the canceller)
    const senderId = target?.createdById
      || target?.verificationRequestedById
      || usersRef.current.find(u => u.name === target?.createdBy)?.id;
    if (senderId && String(senderId) !== String(currentUser?.id)) {
      addNotificationFor([senderId], {
        type: 'bill_cancelled',
        title: `Bill ${billNumber} cancelled`,
        message: `${currentUser?.name || 'A user'} cancelled invoice ${billNumber}.${reason ? ' Reason: ' + reason : ''}`,
        billNumber,
        link: '/dashboard/bill-summary',
      });
    }
  };

  // ── Send tracking (WhatsApp / Email) ──────────────────────────────────
  // Records that a bill was dispatched to the customer via the given channel.
  // The Bill Summary uses this to switch the "Send" button label to "Resend".
  const markBillSent = (billNumber, channel) => {
    if (!['whatsapp', 'email'].includes(channel)) return;
    const list = billsRef.current;
    saveBills(list.map(b => {
      if (b.billNumber !== billNumber) return b;
      const sentChannels = Array.from(new Set([...(b.sentChannels || []), channel]));
      return {
        ...b,
        sentChannels,
        lastSentChannel: channel,
        lastSentAt: new Date().toISOString(),
        lastSentBy: currentUser?.name || '',
        lastSentById: currentUser?.id || null,
      };
    }));
  };

  const requestVerification = (billNumber, assistantUserIds, reason = '') => {
    const list = billsRef.current;
    const target = list.find(b => b.billNumber === billNumber);
    if (!target) return null;
    const ids = (assistantUserIds || []).map(String);
    const updated = {
      ...target,
      verificationRequestedTo: ids,
      verificationRequestedAt: new Date().toISOString(),
      verificationRequestedBy: currentUser?.name || '',
      verificationRequestedById: currentUser?.id || null,
      verificationReason: (reason || '').trim(),
    };
    saveBills(list.map(b => b.billNumber === billNumber ? updated : b));
    const reasonLine = updated.verificationReason ? ` Reason: "${updated.verificationReason}".` : '';
    addNotificationFor(ids, {
      type: 'verification_request',
      title: `Verification requested for ${billNumber}`,
      message: `${currentUser?.name || 'Sender'} has requested your verification on invoice ${billNumber} (₹${(updated.grandTotal || updated.total || 0).toLocaleString('en-IN')}).${reasonLine}`,
      billNumber,
      link: '/dashboard/verification-requests',
    });
    return updated;
  };

  const notifyEditAfterVerification = (bill) => {
    if (!bill) return;
    const currentId = currentUser?.id ? String(currentUser.id) : '';
    const toIds     = (bill.verificationRequestedTo || []).map(String);
    const senderId  = bill.verificationRequestedById ? String(bill.verificationRequestedById) : '';
    const recipients = Array.from(new Set([...toIds, senderId].filter(Boolean)))
      .filter(id => id !== currentId);
    if (recipients.length === 0) return;
    addNotificationFor(recipients, {
      type: 'edit_after_verification',
      title: `Bill ${bill.billNumber} updated`,
      message: `${currentUser?.name || 'A user'} edited ${bill.billNumber}. Please review the updated invoice.`,
      billNumber: bill.billNumber,
      link: '/dashboard/verification-requests',
    });
  };

  const notifyNewBillPending = (bill) => {
    const assistantIds = getAssistants().map(a => a.id);
    if (assistantIds.length === 0) return;
    addNotificationFor(assistantIds, {
      type: 'new_bill_pending',
      title: `New bill awaiting approval`,
      message: `${currentUser?.name || 'Superior'} created ${bill.billNumber} for ${bill.customerName}. Awaiting approval.`,
      billNumber: bill.billNumber,
      link: '/dashboard/bill-approvals',
    });
  };

  // ── Effects ───────────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('eco_language', language); }, [language]);
  useEffect(() => {
    localStorage.setItem('eco_dark', darkMode);
    if (darkMode) document.documentElement.classList.add('dark');
    else          document.documentElement.classList.remove('dark');
  }, [darkMode]);

  return (
    <AppContext.Provider value={{
      loaded,
      currentUser, login, logout, updateCurrentUser,
      language, setLanguage,
      darkMode, setDarkMode,
      tick,
      getUsers, saveUsers,
      getCustomers, saveCustomers,
      getBills, saveBills,
      getRequests, saveRequests,
      getServices, saveServices,
      getCompanyProfile, saveCompanyProfile,
      getLocations, saveLocations,
      generateBillNumber, getBillByNumber,
      getVerificationRequestsFor, getVerificationRequestsSentBy, getPendingVerificationsCount,
      isSuperior, isAssistant, isFirstUser, getAssistants,
      getPendingBillsCount,
      approveBill, rejectBill, cancelBill, markBillSent,
      // notifications
      getNotifications, getUnreadCount, addNotificationFor, markAllRead, clearNotifications,
      // verification
      requestVerification, notifyEditAfterVerification, notifyNewBillPending,
      // live sync
      refreshAll,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
