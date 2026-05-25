using System;
using System.IO;
using System.IO.Pipes;
using System.Threading.Tasks;
using System.Windows.Input;
using System.Collections.ObjectModel;
using System.Windows.Threading;
using GoodbyeDPI.Core.ViewModels;
using GoodbyeDPI.Core.Commands;
using GoodbyeDPI.Core.Models;
using GoodbyeDPI.Core.Network;
using GoodbyeDPI.Core.Drivers;
using GoodbyeDPI.Core.IPC;
using StreamJsonRpc;

namespace GoodbyeDPI.UI.Wpf.ViewModels
{
    public class MainViewModel : BaseViewModel
    {
        private readonly ProfileManager _profileManager;
        private readonly DiagnosticTools _diagnosticTools;
        private readonly DohResolver _dohResolver;
        private readonly Dispatcher _dispatcher;
        private PipelinesProxyServer? _proxyServer;
        private LocalDnsServer? _dnsServer;

        private bool _isBypassActive;
        private string _statusText = "Bypass Pasif";
        private string _processStatus = "Uygulama: Pasif 🔴";
        private string _serviceStatus = "Servis: Kontrol Ediliyor...";
        private string _logContent = string.Empty;
        private string _diagStatus = "Durum: Test edilmedi.\n\nDiscord ve YouTube el sıkışma süreleri ölçülebilir.";
        private BypassProfile? _selectedPreset;
        private string _customDns = "1.1.1.1:53";
        private string _customSysDns = "94.140.14.14, 94.140.15.15";
        private int _selectedDnsModeIndex = 0;
        private int _selectedSysDnsIndex = 0;
        private bool _enableProxy;
        private string _proxyInfo = "Proxy kapalı. Mobil paylaşım pasif.";
        private string _newPresetName = string.Empty;
        private string _newPresetArgs = string.Empty;
        private bool _showAddPresetPanel;
        private bool _useBlacklist = true;
        private string _blacklistContent = string.Empty;

        // Named Pipe Client proxy helper
        private async Task<T?> CallSecureIpcAsync<T>(Func<IGoodbyeDpiService, Task<T>> ipcFunc) where T : class
        {
            try
            {
                using (var pipeStream = new NamedPipeClientStream(".", "GoodbyeDPI_Secure_IPC", PipeDirection.InOut, PipeOptions.Asynchronous))
                {
                    await pipeStream.ConnectAsync(1500);
                    using (var jsonRpc = JsonRpc.Attach<IGoodbyeDpiService>(pipeStream))
                    {
                        return await ipcFunc(jsonRpc);
                    }
                }
            }
            catch (Exception ex)
            {
                AppendLog("IPC Servis hatası (Servis çalışmıyor olabilir): " + ex.Message);
                return null;
            }
        }

        private async Task<bool> CallSecureIpcValAsync(Func<IGoodbyeDpiService, Task<bool>> ipcFunc)
        {
            try
            {
                using (var pipeStream = new NamedPipeClientStream(".", "GoodbyeDPI_Secure_IPC", PipeDirection.InOut, PipeOptions.Asynchronous))
                {
                    await pipeStream.ConnectAsync(1500);
                    using (var jsonRpc = JsonRpc.Attach<IGoodbyeDpiService>(pipeStream))
                    {
                        return await ipcFunc(jsonRpc);
                    }
                }
            }
            catch (Exception ex)
            {
                AppendLog("IPC Servis hatası (Servis çalışmıyor olabilir): " + ex.Message);
                return false;
            }
        }

        public ObservableCollection<BypassProfile> Presets { get; }

        public bool IsBypassActive
        {
            get => _isBypassActive;
            set
            {
                if (SetProperty(ref _isBypassActive, value))
                {
                    StatusText = value ? "Bypass Aktif" : "Bypass Pasif";
                    ProcessStatus = value ? "Uygulama: Aktif 🟢" : "Uygulama: Pasif 🔴";
                }
            }
        }

        public string StatusText { get => _statusText; set => SetProperty(ref _statusText, value); }
        public string ProcessStatus { get => _processStatus; set => SetProperty(ref _processStatus, value); }
        public string ServiceStatus { get => _serviceStatus; set => SetProperty(ref _serviceStatus, value); }
        public string LogContent { get => _logContent; set => SetProperty(ref _logContent, value); }
        public string DiagStatus { get => _diagStatus; set => SetProperty(ref _diagStatus, value); }
        public string CustomDns { get => _customDns; set => SetProperty(ref _customDns, value); }
        public string CustomSysDns { get => _customSysDns; set => SetProperty(ref _customSysDns, value); }
        public int SelectedDnsModeIndex { get => _selectedDnsModeIndex; set => SetProperty(ref _selectedDnsModeIndex, value); }
        public int SelectedSysDnsIndex { get => _selectedSysDnsIndex; set => SetProperty(ref _selectedSysDnsIndex, value); }
        public bool EnableProxy { get => _enableProxy; set { if (SetProperty(ref _enableProxy, value)) ToggleProxyServer(); } }
        public string ProxyInfo { get => _proxyInfo; set => SetProperty(ref _proxyInfo, value); }
        public string NewPresetName { get => _newPresetName; set => SetProperty(ref _newPresetName, value); }
        public string NewPresetArgs { get => _newPresetArgs; set => SetProperty(ref _newPresetArgs, value); }
        public bool ShowAddPresetPanel { get => _showAddPresetPanel; set => SetProperty(ref _showAddPresetPanel, value); }
        public bool UseBlacklist { get => _useBlacklist; set => SetProperty(ref _useBlacklist, value); }
        public string BlacklistContent { get => _blacklistContent; set => SetProperty(ref _blacklistContent, value); }

        public BypassProfile? SelectedPreset
        {
            get => _selectedPreset;
            set => SetProperty(ref _selectedPreset, value);
        }

        // Commands
        public ICommand ToggleBypassCommand { get; }
        public ICommand AutoTuneCommand { get; }
        public ICommand ApplySysDnsCommand { get; }
        public ICommand TroubleshootCommand { get; }
        public ICommand TestConnectionCommand { get; }
        public ICommand ShowAddPresetCommand { get; }
        public ICommand SaveNewPresetCommand { get; }

        public MainViewModel()
        {
            _dispatcher = Dispatcher.CurrentDispatcher;
            
            string profilesPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "profiles.json");
            _profileManager = new ProfileManager(profilesPath);
            _profileManager.LoadProfiles();

            Presets = new ObservableCollection<BypassProfile>(_profileManager.Profiles);
            if (Presets.Count > 0) SelectedPreset = Presets[0];

            _diagnosticTools = new DiagnosticTools();
            _dohResolver = new DohResolver();

            // Commands Wireup
            ToggleBypassCommand = new RelayCommandAsync(ExecuteToggleBypassAsync);
            AutoTuneCommand = new RelayCommandAsync(ExecuteAutoTuneAsync);
            ApplySysDnsCommand = new RelayCommandAsync(ExecuteApplySysDnsAsync);
            TroubleshootCommand = new RelayCommandAsync(ExecuteTroubleshootAsync);
            TestConnectionCommand = new RelayCommandAsync(ExecuteTestConnectionAsync);
            ShowAddPresetCommand = new RelayCommandAsync(async () => { ShowAddPresetPanel = true; await Task.CompletedTask; });
            SaveNewPresetCommand = new RelayCommandAsync(ExecuteSaveNewPresetAsync);

            // Fetch profiles updates in background
            Task.Run(async () =>
            {
                bool synced = await _profileManager.SyncWithCloudAsync();
                if (synced)
                {
                    _dispatcher.Invoke(() =>
                    {
                        AppendLog("Bulut profilleri güncellendi.");
                        Presets.Clear();
                        foreach (var p in _profileManager.Profiles) Presets.Add(p);
                        if (Presets.Count > 0) SelectedPreset = Presets[0];
                    });
                }
            });

            UpdateStatus();
        }

        private async Task ExecuteToggleBypassAsync()
        {
            if (IsBypassActive)
            {
                AppendLog("Bypass durduruluyor...");
                bool success = await CallSecureIpcValAsync(s => s.StopBypassAsync());
                if (success)
                {
                    IsBypassActive = false;
                    AppendLog("Bypass pasif.");
                }
            }
            else
            {
                AppendLog("Bypass başlatılıyor...");
                string args = BuildArguments();
                bool success = await CallSecureIpcValAsync(s => s.StartBypassAsync(args));
                if (success)
                {
                    IsBypassActive = true;
                    AppendLog("Bypass aktif. Sürücü yüklendi.");
                }
            }
            UpdateStatus();
        }

        private string BuildArguments()
        {
            if (SelectedPreset == null) return string.Empty;
            string baseArgs = SelectedPreset.Arguments;
            string dnsArgs = string.Empty;

            if (SelectedDnsModeIndex == 0) // Yandex
            {
                dnsArgs = "--dns-addr 77.88.8.8 --dns-port 1253 --dnsv6-addr 2a02:6b8::feed:0ff --dnsv6-port 1253";
            }
            else if (SelectedDnsModeIndex == 2)
            {
                dnsArgs = "--dns-addr " + CustomDns;
            }

            return baseArgs + " " + dnsArgs;
        }

        private async Task ExecuteAutoTuneAsync()
        {
            AppendLog("Auto-Tune başlatıldı. Lütfen bekleyin...");
            try
            {
                var tuner = new HeuristicTuner(
                    async (preset) => await CallSecureIpcValAsync(s => s.StartBypassAsync(preset)),
                    () => { CallSecureIpcValAsync(s => s.StopBypassAsync()).Wait(); },
                    _diagnosticTools,
                    (log) => _dispatcher.Invoke(() => AppendLog(log))
                );

                string bestPreset = await tuner.TuneAsync(System.Threading.CancellationToken.None);
                
                _dispatcher.Invoke(() => {
                    AppendLog("Auto-Tune başarıyla tamamlandı. En iyi parametre uygulandı: " + bestPreset);
                    // Match and select the preset in the dropdown list if possible
                    foreach (var p in Presets)
                    {
                        if (p.Arguments == bestPreset)
                        {
                            SelectedPreset = p;
                            break;
                        }
                    }
                });
            }
            catch (Exception ex)
            {
                AppendLog("Auto-Tune sırasında hata: " + ex.Message);
            }
        }

        private async Task ExecuteApplySysDnsAsync()
        {
            AppendLog("Ağ adaptörü DNS ayarları güncelleniyor...");
            string dnsVal = string.Empty;
            if (SelectedSysDnsIndex == 0) dnsVal = "77.88.8.8,77.88.8.1,2a02:6b8::fed:9";
            else if (SelectedSysDnsIndex == 1) dnsVal = "1.1.1.1,1.0.0.1,2606:4700:4700::1111";
            else if (SelectedSysDnsIndex == 2) dnsVal = "8.8.8.8,8.8.4.4,2001:4860:4860::8888";
            else if (SelectedSysDnsIndex == 4) dnsVal = CustomSysDns;

            string[] dnsIps = dnsVal.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
            bool success;
            if (dnsIps.Length > 0)
            {
                success = await CallSecureIpcValAsync(s => s.SetDnsAsync(dnsIps));
            }
            else
            {
                success = await CallSecureIpcValAsync(s => s.ResetDnsAsync());
            }

            if (success) AppendLog("DNS güncellendi.");
            else AppendLog("Hata: DNS uygulanamadı.");
        }

        private async Task ExecuteTroubleshootAsync()
        {
            AppendLog("Ağ onarımı tetikleniyor...");
            await CallSecureIpcValAsync(s => s.ResetDnsAsync());
            // run other local diagnostics
            AppendLog("Onarım bitti.");
        }

        private async Task ExecuteTestConnectionAsync()
        {
            DiagStatus = "Test ediliyor...";
            AppendLog("Erişim testi başlatıldı...");
            var res = await _diagnosticTools.TestUrlAsync("https://discord.com");
            DiagStatus = string.Format("Discord Latency: {0} ms (Success: {1})", res.Latency, res.Success);
            AppendLog(DiagStatus);
        }

        private async Task ExecuteSaveNewPresetAsync()
        {
            if (string.IsNullOrEmpty(NewPresetName) || string.IsNullOrEmpty(NewPresetArgs)) return;

            var newProfile = new BypassProfile { Id = Guid.NewGuid().ToString("N"), Name = NewPresetName, Arguments = NewPresetArgs, IsCustom = true };
            _profileManager.Profiles.Add(newProfile);
            _profileManager.SaveProfiles();

            Presets.Add(newProfile);
            SelectedPreset = newProfile;
            ShowAddPresetPanel = false;
            AppendLog("Yeni preset kaydedildi: " + NewPresetName);
            await Task.CompletedTask;
        }

        private void ToggleProxyServer()
        {
            if (EnableProxy)
            {
                AppendLog("Mobil Paylaşım Sunucuları başlatılıyor...");
                string blacklistPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "custom_blacklist.txt");

                try
                {
                    // SOCKS5 + HTTP Proxy on Port 8085
                    _proxyServer = new PipelinesProxyServer(8085, blacklistPath, (msg) => _dispatcher.Invoke(() => AppendLog("[Proxy] " + msg)));
                    Task.Run(() => _proxyServer.StartAsync());

                    // DNS Resolver on Port 53 using FallbackDohResolver
                    var dohResolver = new FallbackDohResolver();
                    _dnsServer = new LocalDnsServer(dohResolver, (msg) => _dispatcher.Invoke(() => AppendLog("[DNS Sunucusu] " + msg)));
                    Task.Run(() => _dnsServer.StartAsync());

                    ProxyInfo = "Proxy aktif (Port 8085) ve Yerel DNS aktif (Port 53).";
                    AppendLog("Mobil Paylaşım sunucuları başarıyla başlatıldı.");
                }
                catch (Exception ex)
                {
                    AppendLog("Mobil paylaşım sunucuları başlatılırken hata: " + ex.Message);
                    ProxyInfo = "Sunucu başlatılamadı. Detaylar logda.";
                }
            }
            else
            {
                AppendLog("Mobil Paylaşım Sunucuları durduruluyor...");
                try
                {
                    _proxyServer?.Stop();
                    _proxyServer = null;

                    _dnsServer?.Stop();
                    _dnsServer = null;

                    ProxyInfo = "Proxy kapalı. Mobil paylaşım pasif.";
                    AppendLog("Mobil Paylaşım sunucuları durduruldu.");
                }
                catch (Exception ex)
                {
                    AppendLog("Mobil paylaşım sunucuları durdurulurken hata: " + ex.Message);
                }
            }
        }

        private void UpdateStatus()
        {
            // Call IPC service to fetch active status
            Task.Run(async () =>
            {
                string? status = await CallSecureIpcAsync(s => s.GetServiceStatusAsync());
                _dispatcher.Invoke(() =>
                {
                    ServiceStatus = "Servis: " + (status ?? "Bağlantı Kesik 🔘");
                });
            });
        }

        private void AppendLog(string text)
        {
            string timeStamp = DateTime.Now.ToString("HH:mm:ss");
            LogContent += string.Format("[{0}] {1}\n", timeStamp, text);
        }
    }
}
