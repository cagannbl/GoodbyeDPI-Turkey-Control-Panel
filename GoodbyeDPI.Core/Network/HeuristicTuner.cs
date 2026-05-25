using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace GoodbyeDPI.Core.Network
{
    public class HeuristicTuner
    {
        private readonly Func<string, Task<bool>> _startBypassFunc;
        private readonly Action _stopBypassFunc;
        private readonly DiagnosticTools _diagnosticTools;
        private readonly Action<string> _logCallback;

        private CancellationTokenSource? _monitorCts;
        private bool _isMonitoring;
        private string _currentTunedArgs = "-5 --set-ttl 5";

        private readonly List<string> _candidatePresets = new List<string>
        {
            "--set-ttl 3",
            "--set-ttl 5",
            "-5",
            "-5 --set-ttl 3",
            "-5 --set-ttl 5",
            "-9",
            "-9 --set-ttl 3",
            "-9 --set-ttl 5"
        };

        private readonly string[] _testUrls = new[]
        {
            "https://www.youtube.com:443",
            "https://discord.com:443"
        };

        public HeuristicTuner(
            Func<string, Task<bool>> startBypassFunc,
            Action stopBypassFunc,
            DiagnosticTools diagnosticTools,
            Action<string> logCallback)
        {
            _startBypassFunc = startBypassFunc;
            _stopBypassFunc = stopBypassFunc;
            _diagnosticTools = diagnosticTools;
            _logCallback = logCallback;
        }

        public async Task<string> TuneAsync(CancellationToken ct)
        {
            _logCallback("Sezgisel Auto-Tune başlatılıyor... Uygun profiller taranıyor.");
            string? bestPreset = null;
            long bestLatency = long.MaxValue;

            foreach (var preset in _candidatePresets)
            {
                if (ct.IsCancellationRequested) break;

                _logCallback(string.Format("Test ediliyor: {0}", preset));

                _stopBypassFunc();
                await Task.Delay(500, ct);

                bool started = await _startBypassFunc(preset);
                if (!started)
                {
                    _logCallback(string.Format("Preset {0} başlatılamadı, geçiliyor.", preset));
                    continue;
                }

                await Task.Delay(1500, ct);

                bool success = true;
                long totalLatency = 0;

                foreach (var url in _testUrls)
                {
                    var res = await _diagnosticTools.TestUrlAsync(url);
                    if (!res.Success)
                    {
                        success = false;
                        break;
                    }
                    totalLatency += res.Latency;
                }

                if (success)
                {
                    long avgLatency = totalLatency / _testUrls.Length;
                    _logCallback(string.Format("✓ BAŞARILI: {0} (Ort. Gecikme: {1} ms)", preset, avgLatency));
                    if (avgLatency < bestLatency)
                    {
                        bestLatency = avgLatency;
                        bestPreset = preset;
                    }
                }
                else
                {
                    _logCallback(string.Format("✕ BAŞARISIZ: {0}", preset));
                }
            }

            if (bestPreset != null)
            {
                _currentTunedArgs = bestPreset;
                _logCallback(string.Format("En uygun profil seçildi: {0} (Gecikme: {1} ms)", bestPreset, bestLatency));
                return bestPreset;
            }

            _logCallback("Uyarı: Hiçbir profil testleri geçemedi. Varsayılan profil kullanılıyor.");
            return _currentTunedArgs;
        }

        public void StartBackgroundMonitoring(int intervalSeconds)
        {
            if (_isMonitoring) return;
            _isMonitoring = true;
            _monitorCts = new CancellationTokenSource();

            _ = Task.Run(() => MonitorLoopAsync(intervalSeconds, _monitorCts.Token));
        }

        public void StopBackgroundMonitoring()
        {
            if (!_isMonitoring) return;
            _isMonitoring = false;
            _monitorCts?.Cancel();
            _logCallback("Bağlantı izleme motoru durduruldu.");
        }

        private async Task MonitorLoopAsync(int intervalSeconds, CancellationToken ct)
        {
            _logCallback("Gerçek zamanlı blok analizi ve izleme motoru başlatıldı.");
            int failCount = 0;

            while (!ct.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(intervalSeconds * 1000, ct);

                    bool anyBlocked = false;
                    foreach (var url in _testUrls)
                    {
                        var res = await _diagnosticTools.TestUrlAsync(url);
                        if (!res.Success)
                        {
                            anyBlocked = true;
                            break;
                        }
                    }

                    if (anyBlocked)
                    {
                        failCount++;
                        _logCallback(string.Format("Bağlantı kontrolü başarısız ({0}/3). Bloklanma şüphesi var.", failCount));

                        if (failCount >= 3)
                        {
                            _logCallback("ISS engellemesi tespit edildi! Profil dinamik olarak yeniden ayarlanıyor...");
                            string newArgs = await TuneAsync(ct);
                            
                            _stopBypassFunc();
                            await Task.Delay(500, ct);
                            await _startBypassFunc(newArgs);
                            
                            failCount = 0;
                        }
                    }
                    else
                    {
                        failCount = 0;
                    }
                }
                catch (TaskCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logCallback("İzleme motoru döngü hatası: " + ex.Message);
                }
            }
        }
    }
}
