# Server tĩnh MÔ PHỎNG cách extension Live Server phục vụ trang: chèn một <script> tự tải lại (WebSocket) trước </body>
# và tắt cache. Dùng để kiểm tra ứng dụng không bị lỗi khi có script lạ được chèn vào HTML.
# Đây KHÔNG phải Live Server thật; vẫn cần kiểm thử thủ công bằng VS Code + Live Server.
#   python tests/serve_like_live_server.py [port] [thư_mục_gốc]
import sys, http.server, functools, os
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
ROOT = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else '.')
SNIPPET = b"""<!-- Code injected by local live-server simulation -->
<script>
(function(){ if(!('WebSocket' in window)) return;
  try { var s=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');
        s.onmessage=function(m){ if(m.data==='reload') location.reload(); };
        s.onerror=function(){}; console.log('Live reload enabled.'); } catch(e) {} })();
</script>
"""
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache'); super().end_headers()
    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path): path = os.path.join(path, 'index.html')
        if path.endswith('.html') and os.path.isfile(path):
            body = open(path, 'rb').read().replace(b'</body>', SNIPPET + b'</body>', 1)
            self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body))); self.end_headers()
            import io; return io.BytesIO(body)
        return super().send_head()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(H, directory=ROOT)).serve_forever()
