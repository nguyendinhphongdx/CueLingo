/* eslint-disable no-console -- a CI measurement script: printing is its output */
// Spike S2 (docs: 06-delivery/2026-11-13-windows-desktop/02-plan.md): how fast and how big is Parakeet on this
// machine? Runs `cuelingo-audio --file ... --bench` over a few English recordings and prints p50/p95 per
// sentence, peak memory and model load time, to the log and to the job summary.
//
//   node scripts/stt-bench.mjs --exe <path to cuelingo-audio[.exe]> [--runs 2] [--threads 2] [--realtime] [--enforce]
//
// --realtime feeds the audio at the speed it was recorded, so partials appear at their real cadence and share the
// CPU with the finals, as in a meeting (slower: the run takes as long as the audio).
// --threads sets CUELINGO_STT_THREADS (default: the sidecar's own choice, min(cores, 4)); a run with 2 stands in
// for a weaker office laptop.
//
// Recordings (nothing is committed; all are made or fetched here):
//   - one human sample from the model's own repository, pinned by revision and SHA-256;
//   - eight meeting-style sentences spoken by the Windows voice (System.Speech), when the machine has one.
// The recognised text is never printed, only its word error rate against the known script.
//
// S2 passes when p95 <= 1000 ms for sentences up to 8 s and the peak working set is <= 1.5 GB. The script
// reports the verdict and fails on a miss only with --enforce: the CI runner is not the target machine.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const value = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const exe = value('--exe');
if (!exe) throw new Error('--exe <path to cuelingo-audio> is required');
const runs = Number(value('--runs', '2'));
const threads = value('--threads');
const realtime = args.includes('--realtime');
const enforce = args.includes('--enforce');

const SAMPLE = {
  url: 'https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8/resolve/84b478d541cdbf0c296a7ab5f1e20a6f8f998114/test_wavs/0.wav',
  sha256: '5fceacff0315d49cb59fcc505bcecf1ed5f2f35c2897b1e65a59f30e5d922150',
  script:
    "Well, I don't wish to see it any more, observed Phebe, turning away her eyes. It is certainly very like the old portrait.",
};
const SENTENCES = [
  "Let's go through the agenda and then look at the open action items from last week.",
  'I think the service level agreement is too tight for the support team to meet.',
  'Can you share your screen so everyone can see the latest numbers on the dashboard?',
  'We need to finish the migration before the end of the quarter, otherwise we will miss the deadline.',
  "Thanks for joining, everyone. Let's start with a quick update from the engineering side.",
  'The customer asked whether we can deliver the new feature by the middle of next month.',
  "I'll send the meeting notes and the follow up tasks right after this call.",
  'Could you repeat the last point? The connection dropped for a moment on my side.',
];

const dir = mkdtempSync(join(os.tmpdir(), 'cuelingo-stt-bench-'));
const recordings = []; // { path, script }

// 1. The human sample.
const sample = Buffer.from(await (await fetch(SAMPLE.url)).arrayBuffer());
if (createHash('sha256').update(sample).digest('hex') !== SAMPLE.sha256) {
  throw new Error('the sample recording does not match its pinned SHA-256');
}
writeFileSync(join(dir, 'sample.wav'), sample);
recordings.push({ path: join(dir, 'sample.wav'), script: SAMPLE.script });

// 2. The spoken sentences, on Windows only.
if (process.platform === 'win32') {
  mkdirSync(join(dir, 'tts'));
  writeFileSync(join(dir, 'sentences.json'), JSON.stringify(SENTENCES));
  const ps = `
    Add-Type -AssemblyName System.Speech
    $texts = Get-Content -Raw -Path '${join(dir, 'sentences.json').replaceAll('\\', '/')}' | ConvertFrom-Json
    $voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
    Write-Output ('voice: ' + $voice.Voice.Name)
    $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
    for ($i = 0; $i -lt $texts.Count; $i++) {
      $voice.SetOutputToWaveFile(('${join(dir, 'tts').replaceAll('\\', '/')}/' + $i + '.wav'), $format)
      $voice.Speak($texts[$i])
      $voice.SetOutputToNull()
    }
    $voice.Dispose()`;
  const made = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    encoding: 'utf8',
  });
  console.log(made.stdout.trim() || made.stderr.trim());
  if (made.status === 0) {
    SENTENCES.forEach((script, i) =>
      recordings.push({ path: join(dir, 'tts', `${i}.wav`), script }),
    );
  } else {
    console.log('no spoken sentences on this machine; only the human sample is measured');
  }
}

// 3. Run the sidecar over every recording, `runs` times in one session (one model load).
const order = Array.from({ length: runs }, () => recordings).flat();
const fileArgs = order.flatMap((r) => ['--file', r.path]);
const started = Date.now();
const run = spawnSync(exe, [...fileArgs, '--bench', ...(realtime ? ['--realtime'] : [])], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  env: {
    ...process.env,
    CUELINGO_LANGUAGE: 'en',
    ...(threads ? { CUELINGO_STT_THREADS: threads } : {}),
  },
});
const wallMs = Date.now() - started;
if (run.status !== 0) {
  console.error(run.stdout.slice(-2000), run.stderr.slice(-2000));
  throw new Error(`the sidecar exited with ${run.status}`);
}
const lines = run.stdout
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const bench = lines.find((l) => l.type === 'bench');
if (!bench) throw new Error('the sidecar printed no bench line');
const finals = lines.filter((l) => l.type === 'segment' && !l.partial).map((l) => l.text);
const stats = lines.find((l) => l.type === 'stats');

// 4. Word error rate of the finals against the scripts, in order.
const words = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
function editDistance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next.push(
        Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)),
      );
    }
    row = next;
  }
  return row[b.length];
}
const reference = words(order.map((r) => r.script).join(' '));
const heard = words(finals.join(' '));
const wer = editDistance(reference, heard) / reference.length;

// 5. Verdict.
const cpu = os.cpus();
const peakMb = bench.peakWorkingSetMb;
const p95 = bench.sentences.p95Ms;
const speedOk = p95 !== null && p95 <= 1000;
const memoryOk = peakMb === null || peakMb <= 1536;
const ok = speedOk && memoryOk;
const rows = [
  ['CPU', `${cpu[0]?.model.trim()} x ${cpu.length}`],
  ['Feeding', realtime ? 'real time' : 'as fast as it reads'],
  ['Recognition threads', threads ?? `default (min(cores, 4) = ${Math.min(cpu.length, 4)})`],
  ['RAM of the machine', `${(os.totalmem() / 1024 ** 3).toFixed(1)} GB`],
  [
    'Recordings',
    `${recordings.length} x ${runs} runs (${(bench.audioMs / 1000).toFixed(0)} s of audio)`,
  ],
  [
    'Sentences measured (up to 8 s)',
    `${bench.sentences.count} (longest ${bench.sentences.maxAudioMs} ms)`,
  ],
  ['Recognition p50 / p95 per sentence', `${bench.sentences.p50Ms} ms / ${p95} ms (limit 1000 ms)`],
  [
    'All recognitions incl. partials',
    stats ? `${stats.count} calls, p50 ${stats.p50Ms} ms, p95 ${stats.p95Ms} ms` : 'n/a',
  ],
  [
    'Partials recognised',
    `${bench.partials.count} recognised, p50 ${bench.partials.p50Ms ?? 'n/a'} ms, p95 ${bench.partials.p95Ms ?? 'n/a'} ms`,
  ],
  ['Peak working set', peakMb === null ? 'n/a' : `${peakMb.toFixed(0)} MB (limit 1536 MB)`],
  [
    'Model ready in',
    `${bench.load.totalMs} ms (download ${bench.load.downloadMs}, hash check ${bench.load.verifyMs}, runtime ${bench.load.createMs})`,
  ],
  ['Word error rate', `${(wer * 100).toFixed(1)} % over ${reference.length} words`],
  ['Whole run', `${(wallMs / 1000).toFixed(1)} s`],
  [
    'S2',
    ok ? 'PASS' : `FAIL (${[!speedOk && 'p95', !memoryOk && 'memory'].filter(Boolean).join(', ')})`,
  ],
];
const table = [
  '| Measure | Value |',
  '| --- | --- |',
  ...rows.map(([k, v]) => `| ${k} | ${v} |`),
].join('\n');
const mode = [threads && `${threads} threads`, realtime && 'real time'].filter(Boolean).join(', ');
const title = `S2 speech recognition on this machine${mode ? ` (${mode})` : ''}`;
console.log(`\n${title}\n\n${table}\n`);
console.log(JSON.stringify(bench));
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${title}\n\n${table}\n`);
}
if (enforce && !ok) process.exit(1);
