// Flow 3: the installed mobile verifier.
//
// Deliberately thin. The charter is explicit that the mobile UI "displays
// results; it does not independently trust claims or make cryptographic
// decisions", and that one reusable verification service serves both the web and
// mobile channels. So this screen does exactly three things:
//
//   1. POST /api/verifier/sessions        — ask the verifier service for a request
//   2. Linking.openURL(openid4vp://...)   — hand that request to the wallet
//   3. GET  /api/verifier/sessions/{id}   — poll, and render whatever it says
//
// There is no credential parsing here, no signature check, no age comparison.
// Every one of those happens server side, and the public gateway enforces it:
// /vp/* is refused on the citizen listener, so this app could not reach the
// protocol endpoints directly even if it tried.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';

const BASE = (Constants.expoConfig?.extra?.verifierBaseUrl ?? '').replace(/\/+$/, '');
const POLL_MS = 1500;

const COLOURS = {
  ivory: '#FDF9F0',
  ink: '#2E2A25',
  muted: '#7A736A',
  hairline: '#E5DED1',
  terracotta: '#B5502A',
  approved: '#1F6B4A',
  denied: '#540F3B',
  failed: '#A85236',
};

/** The seven checks the verifier service reports. Displayed, never evaluated. */
function Checks({ checks }) {
  const names = Object.keys(checks || {});
  if (!names.length) return null;
  return (
    <View style={styles.pills}>
      {names.map((name) => (
        <Text key={name} style={[styles.pill, checks[name] === 'OK' ? styles.pillOk : styles.pillBad]}>
          {name} {checks[name] === 'OK' ? '✓' : '✗'}
        </Text>
      ))}
    </View>
  );
}

export default function App() {
  const [phase, setPhase] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const session = useRef(null);
  const timers = useRef([]);

  const stop = useCallback(() => {
    timers.current.forEach(clearInterval);
    timers.current = [];
  }, []);

  useEffect(() => stop, [stop]);

  const finish = useCallback(
    (nextPhase, body) => {
      stop();
      setResult(body ?? null);
      setPhase(nextPhase);
    },
    [stop],
  );

  const poll = useCallback(async () => {
    if (!session.current) return;
    try {
      const res = await fetch(`${BASE}/api/verifier/sessions/${session.current}`);
      const body = res.status === 404 ? { state: 'expired' } : await res.json();
      switch (body.state) {
        case 'waiting':
          return;
        case 'decided':
          return finish('decided', body);
        case 'declined':
        case 'cancelled':
          return finish('nothing', body);
        case 'expired':
          return finish('nothing', {
            reason: 'No presentation arrived before the request expired.',
          });
        default:
          return finish('rejected', body);
      }
    } catch (err) {
      finish('error', null);
      setError(`Could not reach the verifier service: ${err.message}`);
    }
  }, [finish]);

  const start = useCallback(async () => {
    setError(null);
    setResult(null);
    setPhase('starting');
    try {
      const res = await fetch(`${BASE}/api/verifier/sessions`, { method: 'POST' });
      if (res.status !== 201) throw new Error(`the verifier service answered ${res.status}`);
      const body = await res.json();
      session.current = body.sessionId;
      setSecondsLeft(body.expiresInSeconds ?? null);
      setPhase('waiting');

      // Hand the request to the wallet. Same openid4vp:// URL the web page puts
      // in its QR — the wallet cannot tell which channel asked, which is the
      // point of a standards deep link.
      //
      // Deliberately NOT gated on canOpenURL: under Android 11+ package
      // visibility that answers false unless the scheme is declared in <queries>
      // (see plugins/with-openid4vp-query.js), and it answered false on a device
      // with the wallet installed and handling openid4vp:// correctly. openURL
      // is the call that matters, and it fails loudly enough on its own.
      try {
        await Linking.openURL(body.qrData);
      } catch {
        throw new Error('No wallet on this device could open the request. Is the wallet installed?');
      }

      timers.current.push(setInterval(poll, POLL_MS));
      timers.current.push(
        setInterval(() => setSecondsLeft((n) => (typeof n === 'number' && n > 0 ? n - 1 : 0)), 1000),
      );
    } catch (err) {
      stop();
      setPhase('error');
      setError(err.message);
    }
  }, [poll, stop]);

  /**
   * Give up on this request.
   *
   * A wallet that declines posts nothing back, so the service cannot tell a
   * refusal from silence — the verifier has to decide to stop waiting. Told to
   * the service rather than handled locally, so the session genuinely will not
   * report a decision afterwards.
   */
  const cancel = useCallback(async () => {
    const id = session.current;
    stop();
    if (id) {
      try {
        await fetch(`${BASE}/api/verifier/sessions/${id}/cancel`, { method: 'POST' });
      } catch {
        // The screen is honest either way: nothing was shared.
      }
    }
    setResult({ reason: 'The check was cancelled. Nothing was disclosed and no approval was produced.' });
    setPhase('nothing');
  }, [stop]);

  const reset = () => {
    stop();
    session.current = null;
    setResult(null);
    setError(null);
    setPhase('idle');
  };

  const verdict = phase === 'decided' ? result?.decision : phase === 'nothing' ? 'NO DATA SHARED' : 'NOT VERIFIED';
  const verdictColour =
    verdict === 'APPROVED'
      ? COLOURS.approved
      : verdict === 'DENIED'
        ? COLOURS.denied
        : phase === 'nothing'
          ? COLOURS.muted
          : COLOURS.failed;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.brand}>sunbird</Text>
        <Text style={styles.eyebrow}>AGE-RESTRICTED SERVICE</Text>
        <Text style={styles.title}>Prove you are over 18</Text>
        <Text style={styles.lede}>
          This app asks your wallet for one thing only — whether you are over 18. Not your date of
          birth, not your name.
        </Text>

        {phase === 'idle' && (
          <Pressable style={styles.primary} onPress={start}>
            <Text style={styles.primaryText}>Start age check</Text>
          </Pressable>
        )}

        {(phase === 'starting' || phase === 'waiting') && (
          <View style={styles.card}>
            <ActivityIndicator color={COLOURS.terracotta} />
            <Text style={styles.waiting}>
              {phase === 'starting' ? 'Asking the verifier service…' : 'Waiting for your wallet…'}
            </Text>
            {typeof secondsLeft === 'number' && phase === 'waiting' && (
              <Text style={styles.muted}>{secondsLeft}s left</Text>
            )}
            {phase === 'waiting' && (
              <Pressable style={styles.secondary} onPress={cancel}>
                <Text style={styles.secondaryText}>Cancel this check</Text>
              </Pressable>
            )}
          </View>
        )}

        {(phase === 'decided' || phase === 'nothing' || phase === 'rejected') && (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>
              {phase === 'decided' ? 'VERIFIED RESULT' : phase === 'nothing' ? 'NO RESULT' : 'REJECTED'}
            </Text>
            <Text style={[styles.verdict, { color: verdictColour }]}>{verdict}</Text>
            {!!result?.reason && <Text style={styles.reason}>{result.reason}</Text>}

            {!!result?.issuer && (
              <View style={styles.row}>
                <Text style={styles.rowKey}>Issuer</Text>
                <Text style={styles.rowValue}>{result.issuer}</Text>
              </View>
            )}
            {!!result?.disclosed && (
              <View style={styles.row}>
                <Text style={styles.rowKey}>Shared with us</Text>
                <Text style={styles.rowValue}>
                  {Object.entries(result.disclosed)
                    .map(([k, v]) => `${k} = ${v}`)
                    .join(', ')}
                </Text>
              </View>
            )}
            {phase === 'nothing' && (
              <Text style={styles.muted}>Nothing was disclosed and no approval was produced.</Text>
            )}
            <Checks checks={result?.checks} />

            <Pressable style={styles.secondary} onPress={reset}>
              <Text style={styles.secondaryText}>Run another check</Text>
            </Pressable>
          </View>
        )}

        {phase === 'error' && (
          <View style={styles.card}>
            <Text style={[styles.verdict, { color: COLOURS.failed }]}>NOT VERIFIED</Text>
            <Text style={styles.reason}>{error}</Text>
            <Pressable style={styles.secondary} onPress={reset}>
              <Text style={styles.secondaryText}>Try again</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.footer}>
          Synthetic demonstration data. The decision is made by the verifier service, not by this
          app.
        </Text>
        <Text style={styles.footer}>{BASE.replace(/^https?:\/\//, '')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOURS.ivory },
  scroll: { padding: 24, paddingTop: 64, gap: 12 },
  brand: { color: COLOURS.terracotta, fontSize: 18, fontWeight: '700' },
  eyebrow: { color: COLOURS.muted, fontSize: 12, letterSpacing: 1.2, fontWeight: '700' },
  title: { color: COLOURS.ink, fontSize: 32, fontWeight: '800', marginTop: 4 },
  lede: { color: COLOURS.muted, fontSize: 15, lineHeight: 22, marginBottom: 8 },
  primary: {
    backgroundColor: COLOURS.terracotta,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  secondary: {
    borderWidth: 1,
    borderColor: COLOURS.hairline,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  secondaryText: { color: COLOURS.ink, fontSize: 15, fontWeight: '600' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLOURS.hairline,
    padding: 20,
    gap: 6,
  },
  waiting: { color: COLOURS.ink, fontSize: 16, fontWeight: '600', marginTop: 8 },
  muted: { color: COLOURS.muted, fontSize: 13 },
  verdict: { fontSize: 34, fontWeight: '800', marginVertical: 4 },
  reason: { color: COLOURS.muted, fontSize: 14, lineHeight: 20 },
  row: { marginTop: 10 },
  rowKey: { color: COLOURS.muted, fontSize: 12, letterSpacing: 0.6, fontWeight: '700' },
  rowValue: { color: COLOURS.ink, fontSize: 15, fontWeight: '600' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  pill: { fontSize: 11, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  pillOk: { backgroundColor: '#E8F2EC', color: COLOURS.approved },
  pillBad: { backgroundColor: '#F6E7E1', color: COLOURS.failed },
  footer: { color: COLOURS.muted, fontSize: 11, marginTop: 18, lineHeight: 16 },
});
