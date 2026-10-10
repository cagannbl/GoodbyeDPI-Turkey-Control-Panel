#!/usr/bin/env python3
"""sounds/*.ogg dosyalarını js/sounds-data.js içine base64 olarak göm.

Böylece oyun dosyaya çift tıklanarak (file://) açıldığında da, ek dosya indirmeye izin
vermeyen sayfalarda da gerçek sesler çalar. Ses ekleyip çıkardıktan sonra yeniden çalıştır:
    python3 tools/build_sounds_data.py
"""
import base64, glob, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'sounds', '*.ogg'))):
    m = re.match(r'(.+?)(\d+)\.ogg$', os.path.basename(f))
    data.setdefault(m.group(1), []).append((int(m.group(2)), base64.b64encode(open(f, 'rb').read()).decode()))
lines = ["'use strict';", '// Otomatik üretildi: tools/build_sounds_data.py (elle düzenleme). Kaynaklar: sounds/CREDITS.md',
         'const SOUND_DATA = {']
for k in sorted(data):
    lines.append(f"  {k}: [{', '.join(repr(b) for _, b in sorted(data[k]))}],")
lines.append('};')
open(os.path.join(ROOT, 'js', 'sounds-data.js'), 'w').write('\n'.join(lines) + '\n')
print(len(data), 'ses,', sum(len(v) for v in data.values()), 'dosya')
