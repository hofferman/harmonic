import json, http.server
class H(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0)); body = json.loads(self.rfile.read(n) or b'{}')
        with open('/tmp/evo_log.jsonl', 'a') as f:
            f.write(json.dumps({'path': self.path, 'apikey': self.headers.get('apikey'), 'body': body}) + '\n')
        if body.get('number', '').endswith('0000'):
            self.send_response(500); self.end_headers(); self.wfile.write(b'{"error":"instancia desconectada"}')
        else:
            self.send_response(201); self.send_header('Content-Type','application/json'); self.end_headers(); self.wfile.write(b'{"key":{"id":"ABC"}}')
    def log_message(self, *a): pass
http.server.HTTPServer(('127.0.0.1', 8099), H).serve_forever()
