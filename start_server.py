#!/usr/bin/env python3
"""Simple mock agentpet HTTP server to allow Claude hooks to succeed."""
import http.server
import json

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/ping':
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'pong')
    def do_POST(self):
        self.send_response(200)
        self.end_headers()
    def log_message(self, fmt, *args):
        pass

server = http.server.HTTPServer(('127.0.0.1', 43127), Handler)
print('agentpet mock server on 127.0.0.1:43127', flush=True)
server.serve_forever()
