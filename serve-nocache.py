import http.server, socketserver, sys, os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8891
DIRECTORY = sys.argv[2] if len(sys.argv) > 2 else '.'
os.chdir(DIRECTORY)


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 開発中はキャッシュを完全無効化（ES module のヒューリスティックキャッシュ対策）
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', PORT), Handler) as httpd:
    print(f'no-cache server on http://127.0.0.1:{PORT} dir={DIRECTORY}')
    httpd.serve_forever()
