const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const dir = path.join(__dirname, '..'); // Project root
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js app
const app = next({ dev, hostname, port, dir, customServer: true });
const handle = app.getRequestHandler();

console.log(`Starting server in ${dev ? 'development' : 'production'} mode...`);

app.prepare().then(() => {
    createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    })
        .once('error', (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
            if (process.send) {
                process.send('ready');
            }
        });
}).catch((ex) => {
    console.error(ex.stack);
    process.exit(1);
});
