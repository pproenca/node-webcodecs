/**
 * Web UI Server
 *
 * Simple Express server to display demo results:
 * - Dashboard with demo status
 * - Video playback for outputs
 * - Console log display
 */

const express = require('express');
const path = require('node:path');
const fs = require('node:fs');

const app = express();
const PORT = process.env.PORT || 3000;
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/output', express.static(OUTPUT_DIR));

// API: Get demo status
app.get('/api/status', (_req, res) => {
  const demos = [
    {id: '01', name: 'Encode-Decode', file: null},
    {id: '02', name: 'Video Pipeline', file: 'watermarked.mp4'},
    {id: '03', name: 'Content Moderation', file: 'moderated.h264'},
    {id: '04', name: 'Codec Comparison', file: null},
  ];

  const status = demos.map(demo => {
    const hasOutput = demo.file
      ? fs.existsSync(path.join(OUTPUT_DIR, demo.file))
      : fs.existsSync(OUTPUT_DIR);

    return {
      ...demo,
      status: hasOutput ? 'completed' : 'pending',
      outputUrl: demo.file ? `/output/${demo.file}` : null,
    };
  });

  res.json({demos: status, outputDir: OUTPUT_DIR});
});

// API: Get output files
app.get('/api/outputs', (_req, res) => {
  if (!fs.existsSync(OUTPUT_DIR)) {
    return res.json({files: []});
  }

  const files = fs.readdirSync(OUTPUT_DIR).map(file => {
    const stat = fs.statSync(path.join(OUTPUT_DIR, file));
    return {
      name: file,
      size: stat.size,
      url: `/output/${file}`,
      isVideo: /\.(mp4|h264|webm)$/i.test(file),
    };
  });

  res.json({files});
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔════════════════════════════════════════════════════╗`);
  console.log(`║       node-webcodecs Demo Dashboard                ║`);
  console.log(`╠════════════════════════════════════════════════════╣`);
  console.log(`║  Open in browser: http://localhost:${PORT}            ║`);
  console.log(`╚════════════════════════════════════════════════════╝\n`);
});
