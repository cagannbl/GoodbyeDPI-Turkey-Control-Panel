using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace GoodbyeDPILauncher
{
    public class ProcessManager
    {
        private Process _process;
        private CancellationTokenSource _cts;
        private readonly string _exePath;
        private readonly string _logFilePath;

        public event Action<string> OnLogReceived;
        public event Action OnProcessExited;

        public bool IsRunning
        {
            get
            {
                try
                {
                    return Process.GetProcessesByName("goodbyedpi").Length > 0;
                }
                catch
                {
                    return false;
                }
            }
        }

        public ProcessManager(string exePath)
        {
            _exePath = exePath;
            _logFilePath = Path.Combine(Path.GetTempPath(), "goodbyedpi_bypass.log");
        }

        private static bool IsAdministrator()
        {
            using (var identity = System.Security.Principal.WindowsIdentity.GetCurrent())
            {
                var principal = new System.Security.Principal.WindowsPrincipal(identity);
                return principal.IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
            }
        }

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

        /// <summary>
        /// goodbyedpi.exe sürecini asenkron olarak başlatır.
        /// </summary>
        public async Task StartProcessAsync(string arguments)
        {
            await Task.Yield();
            if (!File.Exists(_exePath))
            {
                if (OnLogReceived != null)
                {
                    OnLogReceived("Hata: goodbyedpi.exe bulunamadı.");
                }
                return;
            }

            _cts = new CancellationTokenSource();
            var token = _cts.Token;

            var psi = new ProcessStartInfo();
            psi.FileName = _exePath;
            psi.Arguments = arguments;
            psi.WorkingDirectory = Path.GetDirectoryName(_exePath);
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.RedirectStandardOutput = true;
            psi.RedirectStandardError = true;
            psi.StandardOutputEncoding = Encoding.UTF8;
            psi.StandardErrorEncoding = Encoding.UTF8;

            try
            {
                _process = new Process { StartInfo = psi };
                _process.EnableRaisingEvents = true;

                _process.OutputDataReceived += (sender, e) =>
                {
                    if (e.Data != null && OnLogReceived != null)
                    {
                        OnLogReceived(e.Data);
                    }
                };

                _process.ErrorDataReceived += (sender, e) =>
                {
                    if (e.Data != null && OnLogReceived != null)
                    {
                        OnLogReceived(e.Data);
                    }
                };

                _process.Start();
                _process.BeginOutputReadLine();
                _process.BeginErrorReadLine();

                var ignored = MonitorExitDirectAsync(token);
            }
            catch (Exception ex)
            {
                if (OnLogReceived != null)
                {
                    OnLogReceived("Bypass başlatma hatası: " + ex.Message);
                }
                if (OnProcessExited != null)
                {
                    OnProcessExited();
                }
            }
        }

        /// <summary>
        /// Süreci sonlandırır.
        /// </summary>
        public void StopProcess()
        {
            if (_cts != null)
            {
                _cts.Cancel();
            }

            if (IsAdministrator())
            {
                try
                {
                    if (_process != null && !_process.HasExited)
                    {
                        _process.Kill();
                    }
                }
                catch {}
                KillProcessesByNameDirect("goodbyedpi");
            }
            else
            {
                RunElevatedKill();
            }
        }

        private void RunElevatedKill()
        {
            try
            {
                // Her durdurma çağrısında UAC yetkilendirme penceresinin açılmasını önlemek için doğrudan taskkill.exe kullanılır
                var psi = new ProcessStartInfo
                {
                    FileName = "taskkill.exe",
                    Arguments = "/F /IM goodbyedpi.exe",
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };
                Process.Start(psi);
            }
            catch {}
        }

        private async Task ReadStreamDirectAsync(StreamReader reader, CancellationToken ct)
        {
            try
            {
                while (!ct.IsCancellationRequested && _process != null && !_process.HasExited)
                {
                    string line = await reader.ReadLineAsync();
                    if (line == null) break;
                    
                    if (OnLogReceived != null)
                    {
                        OnLogReceived(line);
                    }
                }
            }
            catch {}
        }

        private async Task MonitorExitDirectAsync(CancellationToken ct)
        {
            var tcs = new TaskCompletionSource<bool>();
            
            _process.Exited += (sender, e) => tcs.TrySetResult(true);
            ct.Register(() => tcs.TrySetCanceled());

            try
            {
                await tcs.Task;

                // Exit kodunu logla — hata tespiti için kritik
                try
                {
                    int exitCode = _process.ExitCode;
                    if (exitCode != 0 && OnLogReceived != null)
                    {
                        OnLogReceived(string.Format(
                            "[Hata] goodbyedpi süreci çıkış kodu: {0}. WinDivert sürücüsü yüklenememiş olabilir.",
                            exitCode));
                    }
                }
                catch {}

                if (OnProcessExited != null)
                {
                    OnProcessExited();
                }
            }
            catch {}
        }

        private async Task MonitorExitIndirectAsync(CancellationToken ct)
        {
            try
            {
                while (!ct.IsCancellationRequested)
                {
                    if (Process.GetProcessesByName("goodbyedpi").Length == 0)
                    {
                        if (OnProcessExited != null)
                        {
                            OnProcessExited();
                        }
                        break;
                    }
                    await Task.Delay(1000, ct);
                }
            }
            catch {}
        }

        private async Task ReadLogFileTailAsync(string filePath, CancellationToken ct)
        {
            int retries = 30;
            while (!File.Exists(filePath) && retries-- > 0 && !ct.IsCancellationRequested)
            {
                await Task.Delay(100);
            }

            if (!File.Exists(filePath)) return;

            try
            {
                using (var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                using (var reader = new StreamReader(stream, Encoding.UTF8))
                {
                    while (!ct.IsCancellationRequested)
                    {
                        string line = await reader.ReadLineAsync();
                        if (line != null)
                        {
                            if (OnLogReceived != null)
                            {
                                OnLogReceived(line);
                            }
                        }
                        else
                        {
                            await Task.Delay(150, ct);
                        }
                    }
                }
            }
            catch {}
        }

        private void KillProcessesByNameDirect(string name)
        {
            foreach (var process in Process.GetProcessesByName(name))
            {
                try
                {
                    process.Kill();
                }
                catch {}
            }
        }
    }
}
