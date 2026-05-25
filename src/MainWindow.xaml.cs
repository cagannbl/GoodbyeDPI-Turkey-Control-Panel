using System;
using System.IO;
using System.Diagnostics;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Effects;
using System.Windows.Shapes;
using System.Windows.Input;
using System.Windows.Media.Imaging;
using System.ServiceProcess;

namespace GoodbyeDPILauncher
{
    public partial class MainWindow : Window
    {
        private bool _isBypassActive = false;
        private bool _isExiting = false;
        private string _activeArch = "x86_64";
        private string _exePath = "";
        private string _blacklistFilePath = "";

        private readonly CommandExecutor _executor;
        private readonly DnsHelper _dnsHelper;
        private readonly DiagnosticTools _diagnosticTools;
        private readonly DohResolver _dohResolver;
        private readonly ServiceManager _serviceManager;
        private readonly ProcessManager _processManager;
        private readonly ProfileManager _profileManager;
        private ProxyServer _proxyServer;

        private SolidColorBrush _ledBrush;

        private System.Windows.Forms.NotifyIcon _notifyIcon;

        private readonly SolidColorBrush _bgBrush = new SolidColorBrush(Color.FromRgb(24, 24, 28));
        private readonly SolidColorBrush _sidebarBg = new SolidColorBrush(Color.FromRgb(18, 18, 22));
        private readonly SolidColorBrush _cardBg = new SolidColorBrush(Color.FromRgb(32, 32, 38));
        private readonly SolidColorBrush _cardBorder = new SolidColorBrush(Color.FromRgb(45, 45, 52));
        private readonly SolidColorBrush _accentBrush = new SolidColorBrush(Color.FromRgb(0, 173, 181));
        private readonly SolidColorBrush _accentHoverBrush = new SolidColorBrush(Color.FromRgb(0, 200, 210));
        private readonly SolidColorBrush _redBrush = new SolidColorBrush(Color.FromRgb(231, 76, 60));
        private readonly SolidColorBrush _redHoverBrush = new SolidColorBrush(Color.FromRgb(250, 90, 80));
        private readonly SolidColorBrush _textBrush = new SolidColorBrush(Color.FromRgb(240, 240, 240));
        private readonly SolidColorBrush _subTextBrush = new SolidColorBrush(Color.FromRgb(160, 160, 160));

        public MainWindow()
        {
            InitializeComponent();

            // LED durum renk fırçasını ayarla
            _ledBrush = new SolidColorBrush(Color.FromRgb(231, 76, 60)); // Varsayılan olarak kırmızı
            statusLed.Fill = _ledBrush;

            _executor = new CommandExecutor();
            _dnsHelper = new DnsHelper(_executor);
            _diagnosticTools = new DiagnosticTools();
            _dohResolver = new DohResolver();
            _serviceManager = new ServiceManager();

            DetectEnvironment();

            _processManager = new ProcessManager(_exePath);
            _processManager.OnLogReceived += (log) => AppendLog("[GoodbyeDPI] " + log);
            _processManager.OnProcessExited += () =>
            {
                this.Dispatcher.BeginInvoke(new Action(delegate
                {
                    if (_isBypassActive)
                    {
                        AppendLog("UYARI: Sürücü veya bypass süreci sonlandı.");
                        StopBypass();
                    }
                }));
            };

            string profilesPath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "profiles.json");
            _profileManager = new ProfileManager(profilesPath);
            _profileManager.LoadProfiles();

            // Hazır ayarlar açılır menüsünü yenile
            RefreshPresetsDropdown();

            // Varsayılan açılır kutu seçimlerini ayarla
            cmbDns.SelectedIndex = 0;
            cmbSysDns.SelectedIndex = 0;

            // Sistem tepsisi simgesini ayarla
            SetupTray();

            // Başlangıç onay kutusu değerini yükle
            chkStartup.IsChecked = StartupHelper.IsStartupEnabled();

            // Arka planda bulut senkronizasyonunu tetikle
            var ignoredSync = Task.Run(async () =>
            {
                bool synced = await _profileManager.SyncWithCloudAsync();
                if (synced)
                {
                    var ignoredOp = this.Dispatcher.BeginInvoke(new Action(delegate
                    {
                        AppendLog("Bulut preset güncellemeleri başarıyla uygulandı.");
                        RefreshPresetsDropdown();
                    }));
                }
            });

            // Filtre kara listesini yükle
            LoadBlacklist();

            // İlk durum güncellemesini yap
            UpdateStatus();

            this.Closing += MainWindow_Closing;
            System.Windows.Application.Current.SessionEnding += (s, e) =>
            {
                _isExiting = true;
            };
        }

        private static bool IsAdministrator()
        {
            using (var identity = System.Security.Principal.WindowsIdentity.GetCurrent())
            {
                var principal = new System.Security.Principal.WindowsPrincipal(identity);
                return principal.IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
            }
        }

        private void DetectEnvironment()
        {
            _activeArch = Environment.Is64BitOperatingSystem ? "x86_64" : "x86";
            string relativePath = System.IO.Path.Combine(_activeArch, "goodbyedpi.exe");
            _exePath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, relativePath);

            _blacklistFilePath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "custom_blacklist.txt");

            if (!File.Exists(_exePath))
            {
                MessageBox.Show("goodbyedpi.exe bulunamadı!\nUygulama klasörünün düzgün çıkartıldığından emin olun.\nAranan konum: " + _exePath, 
                    "Hata", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void RefreshPresetsDropdown()
        {
            if (cmbPreset == null) return;
            cmbPreset.Items.Clear();
            foreach (var p in _profileManager.Profiles)
            {
                cmbPreset.Items.Add(p.Name);
            }
            cmbPreset.Items.Add("Özel / Gelişmiş Parametreler");
            cmbPreset.SelectedIndex = 0;
        }

        private void SetupTray()
        {
            var trayMenu = new System.Windows.Forms.ContextMenuStrip();
            trayMenu.BackColor = System.Drawing.Color.FromArgb(24, 24, 28);
            trayMenu.ForeColor = System.Drawing.Color.White;

            var mnuToggle = new System.Windows.Forms.ToolStripMenuItem("Bypass Başlat/Durdur");
            mnuToggle.Click += (s, e) => ToggleBypassState();

            var mnuShow = new System.Windows.Forms.ToolStripMenuItem("Paneli Göster");
            mnuShow.Click += (s, e) => ShowWindow();

            var mnuExit = new System.Windows.Forms.ToolStripMenuItem("Çıkış");
            mnuExit.Click += (s, e) => {
                _isExiting = true;
                this.Close();
            };

            trayMenu.Items.Add(mnuToggle);
            trayMenu.Items.Add(mnuShow);
            trayMenu.Items.Add(new System.Windows.Forms.ToolStripSeparator());
            trayMenu.Items.Add(mnuExit);

            _notifyIcon = new System.Windows.Forms.NotifyIcon();
            _notifyIcon.Icon = System.Drawing.SystemIcons.Shield;
            _notifyIcon.ContextMenuStrip = trayMenu;
            _notifyIcon.Text = "GoodbyeDPI Türkiye Kontrol Paneli";
            _notifyIcon.Visible = true;
            _notifyIcon.DoubleClick += (s, e) => ShowWindow();
        }

        private void ShowWindow()
        {
            this.Show();
            this.WindowState = WindowState.Normal;
            this.Activate();
        }

        private void MainWindow_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            if (!_isExiting)
            {
                e.Cancel = true;
                this.Hide();
                _notifyIcon.ShowBalloonTip(1500, "GoodbyeDPI Arka Planda", "Sistem tepsisinde simgeye sağ tıklayarak yönetebilirsiniz.", System.Windows.Forms.ToolTipIcon.Info);
            }
            else
            {
                StopBypass();
                if (_proxyServer != null)
                {
                    _proxyServer.Stop();
                }
                _notifyIcon.Visible = false;
            }
        }

        private void CmbPreset_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (cmbPreset.SelectedIndex == _profileManager.Profiles.Count)
            {
                lblCustomDns.Text = "Özel Parametreler:";
                lblCustomDns.Visibility = Visibility.Visible;
                txtCustomDns.Visibility = Visibility.Visible;
                txtCustomDns.Text = "-5 --set-ttl 5";
            }
            else
            {
                UpdateCustomDnsVisibility();
            }
        }

        private void CmbDns_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            UpdateCustomDnsVisibility();
        }

        private void UpdateCustomDnsVisibility()
        {
            if (cmbPreset.SelectedIndex == _profileManager.Profiles.Count) return;

            if (cmbDns.SelectedIndex == 2)
            {
                lblCustomDns.Text = "Özel DNS:";
                lblCustomDns.Visibility = Visibility.Visible;
                txtCustomDns.Visibility = Visibility.Visible;
                txtCustomDns.Text = "1.1.1.1:53";
            }
            else
            {
                lblCustomDns.Visibility = Visibility.Collapsed;
                txtCustomDns.Visibility = Visibility.Collapsed;
            }
        }

        private void CmbSysDns_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (cmbSysDns.SelectedIndex == 4)
            {
                lblCustomSysDns.Visibility = Visibility.Visible;
                txtCustomSysDns.Visibility = Visibility.Visible;
            }
            else
            {
                lblCustomSysDns.Visibility = Visibility.Collapsed;
                txtCustomSysDns.Visibility = Visibility.Collapsed;
            }
        }

        private void BtnNewPreset_Click(object sender, RoutedEventArgs e)
        {
            borderCustomPresetCard.Visibility = Visibility.Visible;
        }

        private void BtnSaveNewPreset_Click(object sender, RoutedEventArgs e)
        {
            string name = txtNewPresetName.Text.Trim();
            string args = txtNewPresetArgs.Text.Trim();

            if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(args))
            {
                MessageBox.Show("Profil adı ve parametre boş bırakılamaz.", "Uyarı", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            _profileManager.Profiles.Insert(_profileManager.Profiles.Count, new BypassProfile(name, args));
            _profileManager.SaveProfiles();

            RefreshPresetsDropdown();
            borderCustomPresetCard.Visibility = Visibility.Collapsed;

            // Select the newly added preset
            for (int i = 0; i < cmbPreset.Items.Count; i++)
            {
                if (cmbPreset.Items[i].ToString() == name)
                {
                    cmbPreset.SelectedIndex = i;
                    break;
                }
            }

            AppendLog("Yeni özel profil eklendi: " + name);
        }

        private void BtnCancelNewPreset_Click(object sender, RoutedEventArgs e)
        {
            borderCustomPresetCard.Visibility = Visibility.Collapsed;
        }

        private string BuildArguments()
        {
            if (cmbPreset.SelectedIndex == _profileManager.Profiles.Count)
            {
                return txtCustomDns.Text;
            }

            string baseArgs = _profileManager.Profiles[cmbPreset.SelectedIndex].Arguments;
            string dnsArgs = "";

            if (cmbDns.SelectedIndex == 0) // Yandex DNS
            {
                dnsArgs = "--dns-addr 77.88.8.8 --dns-port 1253 --dnsv6-addr 2a02:6b8::feed:0ff --dnsv6-port 1253";
            }
            else if (cmbDns.SelectedIndex == 2) // Özel DNS
            {
                string rawDns = txtCustomDns.Text.Trim();
                if (rawDns.Contains(":"))
                {
                    string[] parts = rawDns.Split(':');
                    dnsArgs = string.Format("--dns-addr {0} --dns-port {1}", parts[0], parts[1]);
                }
                else
                {
                    dnsArgs = string.Format("--dns-addr {0} --dns-port 53", rawDns);
                }
            }

            string blacklistArgs = "";
            if (chkUseBlacklist.IsChecked == true && File.Exists(_blacklistFilePath))
            {
                blacklistArgs = string.Format(" --blacklist \"{0}\"", _blacklistFilePath);
            }

            string fullArgs = baseArgs;
            if (!string.IsNullOrEmpty(dnsArgs)) fullArgs += " " + dnsArgs;
            if (!string.IsNullOrEmpty(blacklistArgs)) fullArgs += blacklistArgs;

            return fullArgs;
        }

        private void ToggleBypassState()
        {
            this.Dispatcher.BeginInvoke(new Action(delegate
            {
                if (_isBypassActive) StopBypass();
                else StartBypass();
            }));
        }

        private void BtnToggleBypass_Click(object sender, RoutedEventArgs e)
        {
            if (_isBypassActive) StopBypass();
            else StartBypass();
        }

        private async void StartBypass()
        {
            if (!File.Exists(_exePath))
            {
                AppendLog("Başlatılamadı: goodbyedpi.exe eksik.");
                return;
            }

            btnToggleBypass.IsEnabled = false;
            try
            {
                var serviceStatus = await _serviceManager.GetStatusAsync();
                if (serviceStatus.HasValue && serviceStatus.Value == ServiceControllerStatus.Running)
                {
                    AppendLog("Çakışmayı önlemek için Windows Servisi durduruluyor...");
                    await _serviceManager.StopServiceAsync();
                    await Task.Delay(800);
                }

                string args = BuildArguments();
                AppendLog("Bypass başlatılıyor...");
                AppendLog("Parametreler: " + args);

                await _processManager.StartProcessAsync(args);
                _isBypassActive = true;
                btnToggleBypass.Content = "Bypass'ı Durdur";
                btnToggleBypass.Background = _redBrush;

                AppendLog("DPI atlatma aktif hale getirildi.");
                UpdateStatus();
            }
            catch (Exception ex)
            {
                AppendLog("HATA: " + ex.Message);
                _isBypassActive = false;
                UpdateStatus();
            }
            finally
            {
                btnToggleBypass.IsEnabled = true;
            }
        }

        private void StopBypass()
        {
            AppendLog("Bypass durduruluyor...");
            _processManager.StopProcess();

            _isBypassActive = false;
            btnToggleBypass.Content = "Bypass'ı Başlat";
            btnToggleBypass.Background = _accentBrush;

            AppendLog("DPI atlatma pasif.");
            UpdateStatus();
        }

        private async void BtnInstallService_Click(object sender, RoutedEventArgs e)
        {
            if (!File.Exists(_exePath))
            {
                AppendLog("Servis yüklenemedi: goodbyedpi.exe bulunamadı.");
                return;
            }

            btnInstallService.IsEnabled = false;
            try
            {
                StopBypass();
                AppendLog("Windows Hizmeti kuruluyor... UAC izni istenebilir.");

                string args = BuildArguments();
                bool success = await _serviceManager.InstallServiceAsync(_exePath, args);

                if (success)
                {
                    AppendLog("Servis kurulumu başarıyla tamamlandı ve başlatıldı.");
                }
                else
                {
                    AppendLog("Hizmet kurulumunda hata oluştu veya yetki verilmedi.");
                }

                await Task.Delay(800);
                UpdateStatus();
            }
            finally
            {
                btnInstallService.IsEnabled = true;
            }
        }

        private async void BtnRemoveService_Click(object sender, RoutedEventArgs e)
        {
            btnRemoveService.IsEnabled = false;
            try
            {
                AppendLog("Hizmetler kaldırılıyor... UAC izni istenebilir.");
                bool success = await _serviceManager.RemoveServiceAsync();

                if (success)
                {
                    AppendLog("GoodbyeDPI ve WinDivert hizmetleri silindi.");
                }
                else
                {
                    AppendLog("Hizmetler kaldırılamadı.");
                }

                await Task.Delay(800);
                UpdateStatus();
            }
            finally
            {
                btnRemoveService.IsEnabled = true;
            }
        }

        private async void BtnAutoTune_Click(object sender, RoutedEventArgs e)
        {
            btnAutoTune.IsEnabled = false;
            
            if (!IsAdministrator())
            {
                MessageBoxResult adminResult = MessageBox.Show(
                    "Bu özellik WinDivert sürücüsünü yüklemek için Yönetici yetkisi gerektiriyor.\n\n" +
                    "Uygulama yönetici olarak yeniden başlatılsın mı?\n" +
                    "(Mevcut oturum kapanacak, ayarlarınız korunacak.)",
                    "Yönetici Yetkisi Gerekli",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Warning);

                if (adminResult == MessageBoxResult.Yes)
                {
                    try
                    {
                        var psi = new System.Diagnostics.ProcessStartInfo
                        {
                            FileName = System.Diagnostics.Process.GetCurrentProcess().MainModule.FileName,
                            Verb = "runas",
                            UseShellExecute = true
                        };
                        System.Diagnostics.Process.Start(psi);
                        _isExiting = true;
                        this.Close();
                    }
                    catch
                    {
                        AppendLog("Yönetici olarak yeniden başlatma iptal edildi.");
                        btnAutoTune.IsEnabled = true;
                    }
                }
                else
                {
                    AppendLog("UYARI: Yönetici yetkisi olmadan bypass testleri çalışmayacak.");
                    btnAutoTune.IsEnabled = true;
                }
                return;
            }

            btnAutoTune.IsEnabled = false;
            btnToggleBypass.IsEnabled = false;
            btnInstallService.IsEnabled = false;
            btnRemoveService.IsEnabled = false;
            cmbPreset.IsEnabled = false;
            cmbDns.IsEnabled = false;

            AppendLog("============== OTOMATİK AYARLAMA (TEST) BAŞLATILDI ==============");
            AppendLog("Tüm ayar modları test edilecek. Lütfen bekleyin...");

            int? presetToApply = null;
            try
            {
                StopBypass();
                await _serviceManager.StopServiceAsync();
                await Task.Delay(1500);

                string targetUrl = "https://discord.com";
                string[] probeUrls = new string[] { "https://discord.com", "https://www.youtube.com", "https://tr.wikipedia.org" };
                AppendLog("1. Adım: Filtresiz Durum (Bypass Kapalıyken) Test Ediliyor...");
                
                var baseline = await _diagnosticTools.TestUrlAsync(targetUrl);
                if (baseline.Success)
                {
                    AppendLog(string.Format("Durum: BAŞARILI ({0} ms). Engelleme bulunmuyor.", baseline.Latency));
                    return;
                }
                else
                {
                    AppendLog("Durum: BAŞARISIZ (Web sitesi engelli, testler başlıyor...)");
                }

                int bestPresetIndex = -1;
                long bestLatency = 99999;

                for (int i = 0; i < _profileManager.Profiles.Count; i++)
                {
                    string presetName = _profileManager.Profiles[i].Name;
                    string baseArgs = _profileManager.Profiles[i].Arguments;
                    string testArgs = baseArgs;
                    
                    testArgs += " --dns-addr 77.88.8.8 --dns-port 1253 --dnsv6-addr 2a02:6b8::feed:0ff --dnsv6-port 1253";
                    
                    AppendLog(string.Format("\nDenetlenen Profil: {0}", presetName));
                    
                    ProcessManager tempManager = new ProcessManager(_exePath);
                    try
                    {
                        try
                        {
                            await tempManager.StartProcessAsync(testArgs);
                        }
                        catch (Exception ex)
                        {
                            AppendLog("Başlatma hatası: " + ex.Message);
                            continue;
                        }

                        await Task.Delay(3500); // Sürücünün yüklenmesini bekle

                        int successes = 0;
                        long totalLatency = 0;
                        foreach (string probe in probeUrls)
                        {
                            var r = await _diagnosticTools.TestUrlAsync(probe);
                            if (r.Success)
                            {
                                successes++;
                                totalLatency += r.Latency;
                                AppendLog(string.Format("   ✓ {0} ({1} ms)", probe, r.Latency));
                            }
                            else
                            {
                                AppendLog(string.Format("   ✗ {0} (yanıt yok)", probe));
                            }
                        }

                        bool anySuccess = successes > 0;
                        long avgLatency = anySuccess ? (totalLatency / successes) : 0;
                        var testResult = new TestResult(anySuccess, avgLatency);

                        if (testResult.Success)
                        {
                            AppendLog(string.Format("--> SONUÇ: ERİŞİM BAŞARILI! Ortalama: {0} ms ({1}/{2} URL)", testResult.Latency, successes, probeUrls.Length));
                            if (testResult.Latency < bestLatency)
                            {
                                bestLatency = testResult.Latency;
                                bestPresetIndex = i;
                            }
                        }
                        else
                        {
                            AppendLog("--> SONUÇ: BAŞARISIZ (Tüm URL'ler yanıt vermedi)");
                        }
                    }
                    finally
                    {
                        tempManager.StopProcess();
                    }
                    await Task.Delay(1000);
                }

                AppendLog("\n================ TEST SONUÇLARI ================");
                if (bestPresetIndex != -1)
                {
                    AppendLog(string.Format("En stabil profil: {0} ({1} ms)", _profileManager.Profiles[bestPresetIndex].Name, bestLatency));
                    
                    MessageBoxResult dialogResult = MessageBox.Show(
                        string.Format("En uygun profil tespit edildi:\n{0}\nGecikme: {1} ms\n\nBu ayarları kaydetmek ve bypass sürecini hemen başlatmak ister misiniz?", 
                        _profileManager.Profiles[bestPresetIndex].Name, bestLatency), 
                        "Auto-Tune Başarılı", MessageBoxButton.YesNo, MessageBoxImage.Question);

                    if (dialogResult == MessageBoxResult.Yes)
                    {
                        presetToApply = bestPresetIndex;
                    }
                }
                else
                {
                    AppendLog("UYARI: Hiçbir bypass yöntemi başarılı olamadı. Bağlantınızı kontrol edin.");
                    MessageBox.Show("Üzgünüz, test edilen bypass yöntemlerinin hiçbiri Discord bağlantısı kuramadı.", 
                        "Başarısız", MessageBoxButton.OK, MessageBoxImage.Warning);
                }
            }
            catch (Exception ex)
            {
                AppendLog("Auto-Tune hatası: " + ex.Message);
            }
            finally
            {
                ResetUiAfterTune(presetToApply);
            }
        }

        private void ResetUiAfterTune(int? selectPresetIndex)
        {
            btnAutoTune.IsEnabled = true;
            btnToggleBypass.IsEnabled = true;
            btnInstallService.IsEnabled = true;
            btnRemoveService.IsEnabled = true;
            cmbPreset.IsEnabled = true;
            cmbDns.IsEnabled = true;

            if (selectPresetIndex.HasValue)
            {
                cmbPreset.SelectedIndex = selectPresetIndex.Value;
                cmbDns.SelectedIndex = 0; // Varsayılan olarak Yandex yönlendirmesi
                StartBypass();
            }
        }

        private async void BtnApplySysDns_Click(object sender, RoutedEventArgs e)
        {
            btnApplySysDns.IsEnabled = false;
            AppendLog("Sistem ağ kartı DNS ayarları güncelleniyor... UAC izni istenebilir.");

            string dnsValue = "";
            string ipv6Value = "";

            if (cmbSysDns.SelectedIndex == 0) // Yandex DNS
            {
                dnsValue = "77.88.8.8, 77.88.8.1";
                ipv6Value = "2a02:6b8::fed:9, 2a02:6b8:0:1::fed:9";
            }
            else if (cmbSysDns.SelectedIndex == 1) // Cloudflare DNS
            {
                dnsValue = "1.1.1.1, 1.0.0.1";
                ipv6Value = "2606:4700:4700::1111, 2606:4700:4700::1001";
            }
            else if (cmbSysDns.SelectedIndex == 2) // Google DNS
            {
                dnsValue = "8.8.8.8, 8.8.4.4";
                ipv6Value = "2001:4860:4860::8888, 2001:4860:4860::8844";
            }
            else if (cmbSysDns.SelectedIndex == 3) // DHCP varsayılan
            {
                dnsValue = ""; 
                ipv6Value = "";
            }
            else if (cmbSysDns.SelectedIndex == 4) // Özel DNS
            {
                dnsValue = txtCustomSysDns.Text.Trim();
                ipv6Value = "";
            }

            try
            {
                var list = new List<string>();
                if (!string.IsNullOrEmpty(dnsValue))
                {
                    foreach (var ip in dnsValue.Split(',')) list.Add(ip.Trim());
                }
                if (!string.IsNullOrEmpty(ipv6Value))
                {
                    foreach (var ip in ipv6Value.Split(',')) list.Add(ip.Trim());
                }

                bool success;
                if (list.Count > 0)
                {
                    string argString = string.Join(",", list.ToArray());
                    success = await RunElevatedProgramTaskAsync("dns-set", argString);
                }
                else
                {
                    success = await RunElevatedProgramTaskAsync("dns-reset", "");
                }

                if (success)
                {
                    AppendLog("Sistem DNS ayarları başarıyla güncellendi.");
                    MessageBox.Show("Sistem DNS ayarlarınız başarıyla güncellenmiştir.", 
                        "DNS Güncellendi", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                else
                {
                    AppendLog("DNS güncellenemedi veya UAC izni verilmedi.");
                }
            }
            catch (Exception ex)
            {
                AppendLog("DNS güncellenemedi: " + ex.Message);
            }
            finally
            {
                btnApplySysDns.IsEnabled = true;
            }
        }

        private async void BtnTroubleshoot_Click(object sender, RoutedEventArgs e)
        {
            btnTroubleshoot.IsEnabled = false;
            AppendLog("============== AĞ VE SÜRÜCÜ ONARIMI (SELF-HEALING) BAŞLATILDI ==============");

            try
            {
                await PerformSelfHealingLocalAsync();

                AppendLog("Sürücü ve servis kilitleri temizleniyor... UAC izni istenebilir.");
                await RunElevatedProgramTaskAsync("service-remove", "");
                await RunElevatedProgramTaskAsync("winsock-reset", "");

                AppendLog("Onarım başarıyla tamamlandı! Ağ önbelleği sıfırlandı.");
                MessageBox.Show("Ağ onarımı ve sürücü kilit açma işlemleri başarıyla tamamlandı.\nBağlantıların tam oturması için tarayıcılarınızı kapatıp açmanız gerekebilir.", 
                    "Onarım Başarılı", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                AppendLog("Onarım hatası: " + ex.Message);
            }
            finally
            {
                btnTroubleshoot.IsEnabled = true;
                UpdateStatus();
            }
        }

        private async Task PerformSelfHealingLocalAsync()
        {
            AppendLog("1. Port 8085 SOCKS Proxy çakışma denetimi yapılıyor...");
            try
            {
                string netstatOut = await _executor.RunCommandAsync("cmd.exe", new[] { "/c", "netstat -ano | findstr :8085" });
                if (!string.IsNullOrEmpty(netstatOut) && netstatOut.Contains("LISTENING"))
                {
                    AppendLog("UYARI: Port 8085 çakışması tespit edildi!");
                    string[] lines = netstatOut.Split(new[] { "\n", "\r" }, StringSplitOptions.RemoveEmptyEntries);
                    foreach (var line in lines)
                    {
                        if (line.Contains("LISTENING"))
                        {
                            string[] tokens = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                            if (tokens.Length >= 5)
                            {
                                string pidStr = tokens[tokens.Length - 1].Trim();
                                int pid = int.Parse(pidStr);
                                if (pid != Process.GetCurrentProcess().Id)
                                {
                                    AppendLog("Self-Healing: Çakışan süreç sonlandırılıyor (PID: " + pid + ")...");
                                    var proc = Process.GetProcessById(pid);
                                    proc.Kill();
                                    AppendLog("Çakışan süreç temizlendi.");
                                }
                            }
                        }
                    }
                }
                else
                {
                    AppendLog("Port 8085 serbest.");
                }
            }
            catch (Exception ex)
            {
                AppendLog("Port kontrol hatası: " + ex.Message);
            }
        }

        private async Task<bool> RunElevatedProgramTaskAsync(string taskName, string arguments)
        {
            var tcs = new TaskCompletionSource<bool>();
            try
            {
                string selfPath = Process.GetCurrentProcess().MainModule.FileName;
                string argString = string.Format("--elevated-task {0} \"{1}\"", taskName, arguments).Trim();

                var psi = new ProcessStartInfo
                {
                    FileName = selfPath,
                    Arguments = argString,
                    Verb = "runas",
                    UseShellExecute = true,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };

                var proc = new Process { StartInfo = psi };
                proc.EnableRaisingEvents = true;
                proc.Exited += (s, e) =>
                {
                    tcs.TrySetResult(proc.ExitCode == 0);
                    proc.Dispose();
                };

                if (proc.Start())
                {
                    await tcs.Task;
                    return true;
                }
            }
            catch {}
            return false;
        }

        private async void BtnTestConnection_Click(object sender, RoutedEventArgs e)
        {
            btnTestConnection.IsEnabled = false;
            lblDiagStatus.Text = "Bağlantı durumları test ediliyor, lütfen bekleyin...";
            AppendLog("Erişilebilirlik testi başlatıldı...");

            try
            {
                AppendLog("DoH DNS Çözümleme testi yapılıyor...");
                var dohStart = DateTime.Now;
                string discordIp = await _dohResolver.ResolveIpAsync("discord.com");
                var dohTime = (DateTime.Now - dohStart).TotalMilliseconds;

                if (!string.IsNullOrEmpty(discordIp))
                {
                    AppendLog(string.Format("DoH Başarılı! discord.com IP: {0} ({1:F0} ms)", discordIp, dohTime));
                }
                else
                {
                    AppendLog("DoH Sorgusu Yanıtsız ❌");
                }

                var discordResult = await _diagnosticTools.TestUrlAsync("https://discord.com");
                var youtubeResult = await _diagnosticTools.TestUrlAsync("https://www.youtube.com");

                StringBuilder sb = new StringBuilder();
                sb.AppendLine("=== ERİŞİM DENETİM RAPORU ===");
                sb.AppendLine();
                if (!string.IsNullOrEmpty(discordIp))
                {
                    sb.AppendLine(string.Format("• DoH DNS Çözümleyici: AKTİF ({0:F0} ms)  ✅", dohTime));
                }
                else
                {
                    sb.AppendLine("• DoH DNS Çözümleyici: BAŞARISIZ ❌");
                }
                sb.AppendLine();
                sb.Append("• Discord Bağlantısı: ");
                sb.AppendLine(discordResult.Success ? string.Format("AKTİF (TLS: {0} ms)  " + (_isBypassActive ? "✅ [Engelsiz]" : "✅"), discordResult.Latency) : "ENGELLEDİ / BAŞARISIZ ❌");
                sb.AppendLine();
                sb.Append("• YouTube Bağlantısı: ");
                sb.AppendLine(youtubeResult.Success ? string.Format("AKTİF (TLS: {0} ms)  " + (_isBypassActive ? "✅ [Engelsiz]" : "✅"), youtubeResult.Latency) : "ENGELLEDİ / BAŞARISIZ ❌");
                sb.AppendLine();
                sb.AppendLine("============================");
                sb.AppendLine(_isBypassActive ? "Not: GoodbyeDPI bypass aktif durumdayken test edilmiştir." : "Not: Sistem bypass kapalıyken test edilmiştir.");

                lblDiagStatus.Text = sb.ToString();
                AppendLog("Erişim Testi Sonucu:\n" + sb.ToString());
            }
            catch (Exception ex)
            {
                AppendLog("Erişim testi sırasında hata: " + ex.Message);
            }
            finally
            {
                btnTestConnection.IsEnabled = true;
            }
        }

        private async void ChkEnableProxy_CheckedChanged(object sender, RoutedEventArgs e)
        {
            if (chkEnableProxy.IsChecked == true)
            {
                try
                {
                    _proxyServer = new ProxyServer(8085, _blacklistFilePath, AppendLog);
                    var startTask = Task.Run(async () => {
                        await _proxyServer.StartAsync();
                    });
                    
                    await Task.Delay(150);
                    if (startTask.IsFaulted)
                    {
                        if (startTask.Exception != null)
                        {
                            throw startTask.Exception.InnerException ?? startTask.Exception;
                        }
                    }
                    
                    UpdateLocalIpDisplay();
                }
                catch (Exception ex)
                {
                    AppendLog("Proxy Server başlatılamadı: " + ex.Message);
                    
                    chkEnableProxy.Checked -= ChkEnableProxy_CheckedChanged;
                    chkEnableProxy.Unchecked -= ChkEnableProxy_CheckedChanged;
                    
                    chkEnableProxy.IsChecked = false;
                    
                    chkEnableProxy.Checked += ChkEnableProxy_CheckedChanged;
                    chkEnableProxy.Unchecked += ChkEnableProxy_CheckedChanged;
                }
            }
            else
            {
                if (_proxyServer != null)
                {
                    _proxyServer.Stop();
                    _proxyServer = null;
                }
                UpdateLocalIpDisplay();
            }
        }

        private void UpdateLocalIpDisplay()
        {
            if (chkEnableProxy.IsChecked == true)
            {
                string localIp = "127.0.0.1";
                try
                {
                    foreach (var ip in System.Net.Dns.GetHostEntry(System.Net.Dns.GetHostName()).AddressList)
                    {
                        if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork && !ip.ToString().StartsWith("127."))
                        {
                            localIp = ip.ToString();
                            break;
                        }
                    }
                }
                catch {}
                
                string pacUrl = string.Format("http://{0}:8085/proxy.pac", localIp);
                lblProxyInfo.Text = string.Format(
                    "PAC URL (Telefon Ayarı):\n{0}\n\n" +
                    "Telefonunuzun Wi-Fi ayarlarından 'Proxy Auto-Config' veya 'PAC' seçip bu URL'yi girin ya da sağdaki QR kodu taratın.", 
                    pacUrl
                );
                lblProxyInfo.Foreground = _accentBrush;

                try
                {
                    string qrApiUrl = string.Format("https://api.qrserver.com/v1/create-qr-code/?size=150x150&data={0}", Uri.EscapeDataString(pacUrl));
                    var bitmap = new BitmapImage();
                    bitmap.BeginInit();
                    bitmap.UriSource = new Uri(qrApiUrl, UriKind.Absolute);
                    bitmap.EndInit();
                    imgQrCode.Source = bitmap;
                }
                catch (Exception ex)
                {
                    AppendLog("QR Kod resmi yüklenemedi: " + ex.Message);
                }
            }
            else
            {
                lblProxyInfo.Text = "Proxy kapalı. Mobil paylaşım pasif.";
                lblProxyInfo.Foreground = _subTextBrush;
                imgQrCode.Source = null;
            }
        }

        private void BtnSaveBlacklist_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                File.WriteAllText(_blacklistFilePath, txtBlacklist.Text);
                AppendLog("Kara liste başarıyla kaydedildi: " + _blacklistFilePath);
                MessageBox.Show("Filtre kara listesi başarıyla kaydedildi.", "Kaydedildi", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Yazma Hatası: " + ex.Message, "Hata", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void LoadBlacklist()
        {
            try
            {
                if (File.Exists(_blacklistFilePath))
                {
                    txtBlacklist.Text = File.ReadAllText(_blacklistFilePath);
                }
                else
                {
                    var sb = new StringBuilder();
                    sb.AppendLine("discord.com");
                    sb.AppendLine("gateway.discord.gg");
                    sb.AppendLine("cdn.discordapp.com");
                    sb.AppendLine("wikipedia.org");
                    sb.AppendLine("tr.wikipedia.org");
                    txtBlacklist.Text = sb.ToString();
                    File.WriteAllText(_blacklistFilePath, txtBlacklist.Text);
                }
            }
            catch {}
        }

        private async void UpdateStatus()
        {
            bool isProcessRunning = _processManager.IsRunning;
            if (isProcessRunning)
            {
                lblProcessStatus.Text = "Uygulama: Aktif 🟢";
                lblProcessStatus.Foreground = new SolidColorBrush(Color.FromRgb(46, 204, 113));
                btnToggleBypass.Content = "Bypass'ı Durdur";
                btnToggleBypass.Background = _redBrush;
                _isBypassActive = true;
                txtStatusLedInfo.Text = "Bypass Aktif";
                _ledBrush.Color = Color.FromRgb(46, 204, 113); // Yeşil LED
            }
            else
            {
                lblProcessStatus.Text = "Uygulama: Pasif 🔴";
                lblProcessStatus.Foreground = _redBrush;
                btnToggleBypass.Content = "Bypass'ı Başlat";
                btnToggleBypass.Background = _accentBrush;
                _isBypassActive = false;
                txtStatusLedInfo.Text = "Bypass Pasif";
                _ledBrush.Color = Color.FromRgb(231, 76, 60); // Kırmızı LED
            }

            if (IsAdministrator())
            {
                this.Title = "GoodbyeDPI Türkiye Kontrol Paneli  ✅ Yönetici";
                if (lblSub != null)
                {
                    lblSub.Text = "Türkiye Kontrol Paneli v3.0  [Yönetici] 🛡️";
                    lblSub.Foreground = _accentBrush;
                }
            }
            else
            {
                this.Title = "GoodbyeDPI Türkiye Kontrol Paneli  ⚠️ Sınırlı Yetki — Sağ tık → Yönetici olarak çalıştır";
                if (lblSub != null)
                {
                    lblSub.Text = "Türkiye Kontrol Paneli v3.0  [Sınırlı Yetki] ⚠️";
                    lblSub.Foreground = _redBrush;
                }
            }

            var serviceStatus = await _serviceManager.GetStatusAsync();
            if (serviceStatus.HasValue)
            {
                if (serviceStatus.Value == ServiceControllerStatus.Running)
                {
                    lblServiceStatus.Text = "Servis: Çalışıyor 🟢";
                    lblServiceStatus.Foreground = new SolidColorBrush(Color.FromRgb(46, 204, 113));
                }
                else
                {
                    lblServiceStatus.Text = "Servis: Durdu 🔴";
                    lblServiceStatus.Foreground = new SolidColorBrush(Color.FromRgb(230, 126, 34));
                }
            }
            else
            {
                lblServiceStatus.Text = "Servis: Yüklü Değil 🔘";
                lblServiceStatus.Foreground = _subTextBrush;
            }
        }

        private void AppendLog(string text)
        {
            if (txtLog == null) return;
            string timeStamp = DateTime.Now.ToString("HH:mm:ss");
            txtLog.AppendText(string.Format("[{0}] {1}\n", timeStamp, text));
            txtLog.ScrollToEnd();
        }

        private void BtnDashboardNav_Click(object sender, RoutedEventArgs e)
        {
            SetNavActive(btnDashboardNav, new[] { btnNetworkNav, btnBlacklistNav });
            panelDashboard.Visibility = Visibility.Visible;
            panelNetwork.Visibility = Visibility.Collapsed;
            panelBlacklist.Visibility = Visibility.Collapsed;
        }

        private void BtnNetworkNav_Click(object sender, RoutedEventArgs e)
        {
            SetNavActive(btnNetworkNav, new[] { btnDashboardNav, btnBlacklistNav });
            panelDashboard.Visibility = Visibility.Collapsed;
            panelNetwork.Visibility = Visibility.Visible;
            panelBlacklist.Visibility = Visibility.Collapsed;
        }

        private void BtnBlacklistNav_Click(object sender, RoutedEventArgs e)
        {
            SetNavActive(btnBlacklistNav, new[] { btnDashboardNav, btnNetworkNav });
            panelDashboard.Visibility = Visibility.Collapsed;
            panelNetwork.Visibility = Visibility.Collapsed;
            panelBlacklist.Visibility = Visibility.Visible;
        }

        private void TitleBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            if (e.ButtonState == MouseButtonState.Pressed)
            {
                this.DragMove();
            }
        }

        private void BtnMin_Click(object sender, RoutedEventArgs e)
        {
            this.WindowState = WindowState.Minimized;
        }

        private void BtnMin_MouseEnter(object sender, MouseEventArgs e)
        {
            btnMin.Background = new SolidColorBrush(Color.FromArgb(30, 255, 255, 255));
        }

        private void BtnMin_MouseLeave(object sender, MouseEventArgs e)
        {
            btnMin.Background = Brushes.Transparent;
        }

        private void BtnClose_Click(object sender, RoutedEventArgs e)
        {
            this.Close();
        }

        private void BtnClose_MouseEnter(object sender, MouseEventArgs e)
        {
            btnClose.Background = _redBrush;
        }

        private void BtnClose_MouseLeave(object sender, MouseEventArgs e)
        {
            btnClose.Background = Brushes.Transparent;
        }

        private void NavButton_MouseEnter(object sender, MouseEventArgs e)
        {
            var btn = (Button)sender;
            if (btn.Background != _accentBrush)
            {
                btn.Background = new SolidColorBrush(Color.FromRgb(40, 40, 48));
            }
        }

        private void NavButton_MouseLeave(object sender, MouseEventArgs e)
        {
            var btn = (Button)sender;
            if (btn.Background != _accentBrush)
            {
                btn.Background = Brushes.Transparent;
            }
        }

        private void StyledButton_MouseEnter(object sender, MouseEventArgs e)
        {
            var btn = (Button)sender;
            if (btn == btnToggleBypass)
            {
                btn.Background = _isBypassActive ? _redHoverBrush : _accentHoverBrush;
            }
            else if (btn == btnNewPreset || btn == btnSaveNewPreset || btn == btnApplySysDns || btn == btnSaveBlacklist)
            {
                btn.Background = _accentHoverBrush;
            }
            else if (btn == btnCancelNewPreset)
            {
                btn.Background = new SolidColorBrush(Color.FromRgb(80, 80, 85));
            }
            else if (btn == btnTroubleshoot)
            {
                btn.Background = _redHoverBrush;
            }
            else
            {
                btn.Background = new SolidColorBrush(Color.FromRgb(70, 70, 78));
            }
        }

        private void StyledButton_MouseLeave(object sender, MouseEventArgs e)
        {
            var btn = (Button)sender;
            if (btn == btnToggleBypass)
            {
                btn.Background = _isBypassActive ? _redBrush : _accentBrush;
            }
            else if (btn == btnNewPreset || btn == btnSaveNewPreset || btn == btnApplySysDns || btn == btnSaveBlacklist)
            {
                btn.Background = _accentBrush;
            }
            else if (btn == btnCancelNewPreset)
            {
                btn.Background = new SolidColorBrush(Color.FromRgb(60, 60, 65));
            }
            else if (btn == btnTroubleshoot)
            {
                btn.Background = _redBrush;
            }
            else
            {
                btn.Background = new SolidColorBrush(Color.FromRgb(50, 50, 58));
            }
        }

        private void ChkStartup_Checked(object sender, RoutedEventArgs e)
        {
            StartupHelper.SetStartup(true);
        }

        private void ChkStartup_Unchecked(object sender, RoutedEventArgs e)
        {
            StartupHelper.SetStartup(false);
        }

        private void BtnClearLogs_Click(object sender, RoutedEventArgs e)
        {
            txtLog.Clear();
        }
    }
}
