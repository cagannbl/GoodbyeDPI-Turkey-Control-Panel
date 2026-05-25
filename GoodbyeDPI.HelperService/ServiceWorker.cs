using System;
using System.IO;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using GoodbyeDPI.Core.IPC;
using GoodbyeDPI.Core.Network;
using GoodbyeDPI.Core.Drivers;

namespace GoodbyeDPI.HelperService
{
    public class ServiceWorker : BackgroundService, IGoodbyeDpiService
    {
        private readonly ILogger<ServiceWorker> _logger;
        private SecurePipeServer? _pipeServer;
        private Process? _bypassProcess;
        private readonly CommandExecutor _executor;
        private readonly DnsHelper _dnsHelper;

        public ServiceWorker(ILogger<ServiceWorker> logger)
        {
            _logger = logger;
            _executor = new CommandExecutor();
            _dnsHelper = new DnsHelper(_executor);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("GoodbyeDPI Helper Service başlatılıyor...");
            
            // Start Secure JSON-RPC Pipe Server
            _pipeServer = new SecurePipeServer(this);
            _pipeServer.Start();

            _logger.LogInformation("IPC Named Pipe dinleyicisi aktif.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(1000, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }

            _logger.LogInformation("Helper Service durduruluyor...");
            _pipeServer.Stop();
            await StopBypassAsync();
        }

        // --- IGoodbyeDpiService IPC Implementation ---

        private static int GetActiveInterfaceIndex()
        {
            try
            {
                foreach (var ni in System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (ni.OperationalStatus == System.Net.NetworkInformation.OperationalStatus.Up && 
                        ni.NetworkInterfaceType != System.Net.NetworkInformation.NetworkInterfaceType.Loopback && 
                        ni.NetworkInterfaceType != System.Net.NetworkInformation.NetworkInterfaceType.Tunnel)
                    {
                        var ipProps = ni.GetIPProperties();
                        if (ipProps == null) continue;
                        
                        var ipv4Props = ipProps.GetIPv4Properties();
                        if (ipv4Props != null)
                        {
                            return ipv4Props.Index;
                        }
                    }
                }
            }
            catch {}
            return -1;
        }

        public async Task<bool> StartBypassAsync(string arguments)
        {
            try
            {
                int ifIndex = GetActiveInterfaceIndex();
                if (ifIndex > 0 && !arguments.Contains("-i "))
                {
                    arguments += " -i " + ifIndex;
                    _logger.LogInformation("WinDivert için aktif ağ adaptörü indeksi (ifindex: {Index}) otomatik eklendi.", ifIndex);
                }

                _logger.LogInformation("Bypass başlatılıyor. Parametreler: {Args}", arguments);
                
                await StopBypassAsync();

                string activeArch = Environment.Is64BitOperatingSystem ? "x86_64" : "x86";
                string exePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, activeArch, "goodbyedpi.exe");

                if (!File.Exists(exePath))
                {
                    _logger.LogError("Bypass exe bulunamadı: {Path}", exePath);
                    return false;
                }

                var psi = new ProcessStartInfo
                {
                    FileName = exePath,
                    Arguments = arguments,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                };

                _bypassProcess = new Process { StartInfo = psi };
                _bypassProcess.Start();

                _logger.LogInformation("goodbyedpi.exe süreci başlatıldı. PID: {Pid}", _bypassProcess.Id);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Bypass başlatma hatası.");
                return false;
            }
        }

        public async Task<bool> StopBypassAsync()
        {
            try
            {
                if (_bypassProcess != null && !_bypassProcess.HasExited)
                {
                    _bypassProcess.Kill();
                    await _bypassProcess.WaitForExitAsync();
                    _bypassProcess.Dispose();
                    _bypassProcess = null;
                }

                foreach (var p in Process.GetProcessesByName("goodbyedpi"))
                {
                    try { p.Kill(); } catch {}
                }

                DriverHelper.ForceUnloadWinDivert();

                _logger.LogInformation("Bypass süreci durduruldu.");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Bypass durdurma hatası.");
                return false;
            }
        }

        public async Task<bool> SetDnsAsync(string[] dnsServers)
        {
            try
            {
                _logger.LogInformation("DNS güncelleme isteği alındı: {DNS}", string.Join(", ", dnsServers));
                await _dnsHelper.SetDnsAsync(dnsServers);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DNS güncelleme hatası.");
                return false;
            }
        }

        public async Task<bool> ResetDnsAsync()
        {
            try
            {
                _logger.LogInformation("DNS sıfırlama isteği alındı.");
                await _dnsHelper.ResetDnsAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DNS sıfırlama hatası.");
                return false;
            }
        }

        public Task<string> GetServiceStatusAsync()
        {
            if (_bypassProcess != null && !_bypassProcess.HasExited)
            {
                return Task.FromResult("Aktif 🟢");
            }
            return Task.FromResult("Pasif 🔴");
        }
    }
}
