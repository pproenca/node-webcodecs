/**
 * Web UI Server
 *
 * Simple Express server to display demo results:
 * - Dashboard with demo status
 * - Video playback for outputs
 * - Console log display
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const OUTPUT_DIR = path.join(__dirname, '..', '.demo-assets');

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/output', express.static(OUTPUT_DIR));

// API: Get demo status
app.get('/api/status', (_req, res) => {
  try {
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
  } catch (e) {
    console.error('Error in /api/status:', e);
    res.status(500).json({error: 'Failed to get demo status'});
  }
});

// API: Get output files
app.get('/api/outputs', (_req, res) => {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      return res.json({files: []});
    }

    const files = [];
    for (const file of fs.readdirSync(OUTPUT_DIR)) {
      try {
        const stat = fs.statSync(path.join(OUTPUT_DIR, file));
        files.push({
          name: file,
          size: stat.size,
          url: `/output/${file}`,
          isVideo: /\.(mp4|h264|webm)$/i.test(file),
        });
      } catch (statErr) {
        // File may have been deleted between readdir and stat
        console.warn(`Skipping file ${file}: ${statErr.message}`);
      }
    }

    res.json({files});
  } catch (e) {
    console.error('Error in /api/outputs:', e);
    res.status(500).json({error: 'Failed to list output files'});
  }
});

// Error handling middleware (must be last)
app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({error: 'Internal server error'});
});

// Start server with error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔════════════════════════════════════════════════════╗`);
  console.log(`║       node-webcodecs Demo Dashboard                ║`);
  console.log(`╠════════════════════════════════════════════════════╣`);
  console.log(`║  Open in browser: http://localhost:${PORT}            ║`);
  console.log(`╚════════════════════════════════════════════════════╝\n`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Error: Port ${PORT} is already in use`);
    console.error(`Try: PORT=${Number(PORT) + 1} npm run demo`);
  } else {
    console.error('Server error:', e);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
