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
    public class MainWindow : Window
    {
        // State variables
        private bool isBypassActive = false;
        private bool isExiting = false;
        private string activeArch = "x86_64";
        private string exePath = "";
        private string blacklistFilePath = "";

        // Services
        private readonly CommandExecutor _executor;
        private readonly DnsHelper _dnsHelper;
        private readonly DiagnosticTools _diagnosticTools;
        private readonly DohResolver _dohResolver;
        private readonly ServiceManager _serviceManager;
        private readonly ProcessManager _processManager;
        private readonly ProfileManager _profileManager;
        private ProxyServer _proxyServer;

        // UI Controls
        private TextBlock txtStatusLedInfo;
        private TextBlock lblSub;
        private Ellipse statusLed;
        private SolidColorBrush ledBrush;

        // Panels
        private Grid panelDashboard;
        private Grid panelNetwork;
        private Grid panelBlacklist;

        // Controls Dashboard
        private ComboBox cmbPreset;
        private ComboBox cmbDns;
        private TextBox txtCustomDns;
        private TextBlock lblCustomDns;
        private Button btnToggleBypass;
        private Button btnAutoTune;
        private TextBlock lblProcessStatus;
        private TextBlock lblServiceStatus;
        private Button btnInstallService;
        private Button btnRemoveService;
        private CheckBox chkEnableProxy;
        private TextBlock lblProxyInfo;
        private Image imgQrCode;
        private TextBox txtLog;

        // Controls Network
        private ComboBox cmbSysDns;
        private TextBox txtCustomSysDns;
        private TextBlock lblCustomSysDns;
        private Button btnApplySysDns;
        private CheckBox chkStartup;
        private Button btnTroubleshoot;
        private Button btnTestConnection;
        private TextBlock lblDiagStatus;

        // Controls Blacklist
        private CheckBox chkUseBlacklist;
        private TextBox txtBlacklist;
        private Button btnSaveBlacklist;

        // Custom preset creation controls
        private Border borderCustomPresetCard;
        private TextBox txtNewPresetName;
        private TextBox txtNewPresetArgs;
        private Button btnSaveNewPreset;

        // System Tray
        private System.Windows.Forms.NotifyIcon notifyIcon;

        // Colors
        private readonly SolidColorBrush bgBrush = new SolidColorBrush(Color.FromRgb(24, 24, 28));
        private readonly SolidColorBrush sidebarBg = new SolidColorBrush(Color.FromRgb(18, 18, 22));
        private readonly SolidColorBrush cardBg = new SolidColorBrush(Color.FromRgb(32, 32, 38));
        private readonly SolidColorBrush cardBorder = new SolidColorBrush(Color.FromRgb(45, 45, 52));
        private readonly SolidColorBrush accentBrush = new SolidColorBrush(Color.FromRgb(0, 173, 181));
        private readonly SolidColorBrush accentHoverBrush = new SolidColorBrush(Color.FromRgb(0, 200, 210));
        private readonly SolidColorBrush redBrush = new SolidColorBrush(Color.FromRgb(231, 76, 60));
        private readonly SolidColorBrush redHoverBrush = new SolidColorBrush(Color.FromRgb(250, 90, 80));
        private readonly SolidColorBrush textBrush = new SolidColorBrush(Color.FromRgb(240, 240, 240));
        private readonly SolidColorBrush subTextBrush = new SolidColorBrush(Color.FromRgb(160, 160, 160));

        public MainWindow()
        {
            // Set window properties for modern transparent custom chrome
            this.Title = "GoodbyeDPI - Türkiye Kontrol Paneli";
            this.Width = 840;
            this.Height = 640;
            this.WindowStartupLocation = WindowStartupLocation.CenterScreen;
            this.Background = bgBrush;
            this.Foreground = textBrush;
            this.WindowStyle = WindowStyle.None;
            this.AllowsTransparency = true;
            this.FontFamily = new FontFamily("Segoe UI");

            // Load Custom Styles to resolve ComboBox contrast issues in dark mode
            try
            {
                string styleXaml = @"
<ResourceDictionary xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation'
                    xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml'>
    <ControlTemplate x:Key='ComboBoxToggleButton' TargetType='ToggleButton'>
        <Grid>
            <Grid.ColumnDefinitions>
                <ColumnDefinition />
                <ColumnDefinition Width='24' />
            </Grid.ColumnDefinitions>
            <Border x:Name='Border' Grid.ColumnSpan='2' CornerRadius='4' Background='{TemplateBinding Background}' BorderBrush='{TemplateBinding BorderBrush}' BorderThickness='1' />
            <Path x:Name='Arrow' Grid.Column='1' Fill='{TemplateBinding Foreground}' HorizontalAlignment='Center' VerticalAlignment='Center' Data='M0,0 L4,4 L8,0 Z' />
        </Grid>
        <ControlTemplate.Triggers>
            <Trigger Property='IsMouseOver' Value='True'>
                <Setter TargetName='Border' Property='Background' Value='#32323D' />
            </Trigger>
            <Trigger Property='IsEnabled' Value='False'>
                <Setter TargetName='Border' Property='Background' Value='#1E1E24' />
                <Setter TargetName='Border' Property='BorderBrush' Value='#2A2A32' />
                <Setter TargetName='Arrow' Property='Fill' Value='#707070' />
            </Trigger>
        </ControlTemplate.Triggers>
    </ControlTemplate>

    <Style TargetType='ComboBox'>
        <Setter Property='SnapsToDevicePixels' Value='true'/>
        <Setter Property='OverridesDefaultStyle' Value='true'/>
        <Setter Property='ScrollViewer.HorizontalScrollBarVisibility' Value='Auto'/>
        <Setter Property='ScrollViewer.VerticalScrollBarVisibility' Value='Auto'/>
        <Setter Property='ScrollViewer.CanContentScroll' Value='true'/>
        <Setter Property='Background' Value='#282830'/>
        <Setter Property='BorderBrush' Value='#3D3D48'/>
        <Setter Property='Foreground' Value='#F0F0F0'/>
        <Setter Property='Template'>
            <Setter.Value>
                <ControlTemplate TargetType='ComboBox'>
                    <Grid>
                        <ToggleButton Name='ToggleButton' 
                                       Template='{StaticResource ComboBoxToggleButton}' 
                                       Focusable='false'
                                       Background='{TemplateBinding Background}'
                                       BorderBrush='{TemplateBinding BorderBrush}'
                                       Foreground='{TemplateBinding Foreground}'
                                       IsChecked='{Binding Path=IsDropDownOpen,Mode=TwoWay,RelativeSource={RelativeSource TemplatedParent}}' 
                                       ClickMode='Press'/>
                        <ContentPresenter Name='ContentSite' 
                                           Content='{TemplateBinding SelectionBoxItem}'
                                           ContentTemplate='{TemplateBinding SelectionBoxItemTemplate}'
                                           ContentTemplateSelector='{TemplateBinding ItemTemplateSelector}'
                                           Margin='8,3,28,3'
                                           VerticalAlignment='Center'
                                           HorizontalAlignment='Left'
                                           TextElement.Foreground='{TemplateBinding Foreground}' />
                        <Popup Name='Popup' Placement='Bottom' IsOpen='{TemplateBinding IsDropDownOpen}' AllowsTransparency='True' Focusable='False' PopupAnimation='Slide'>
                            <Grid Name='DropDown' SnapsToDevicePixels='True' MinWidth='{TemplateBinding ActualWidth}' MaxHeight='{TemplateBinding MaxDropDownHeight}'>
                                <Border Name='DropDownBorder' Background='#202026' BorderThickness='1' BorderBrush='#3D3D48' CornerRadius='4' Margin='0,2,0,0'/>
                                <ScrollViewer Margin='4,6,4,6' SnapsToDevicePixels='True'>
                                    <StackPanel IsItemsHost='True' KeyboardNavigation.DirectionalNavigation='Contained' />
                                </ScrollViewer>
                            </Grid>
                        </Popup>
                    </Grid>
                    <ControlTemplate.Triggers>
                        <Trigger Property='IsEnabled' Value='False'>
                            <Setter Property='Foreground' Value='#707070' />
                            <Setter Property='Background' Value='#1E1E24' />
                            <Setter Property='BorderBrush' Value='#2A2A32' />
                        </Trigger>
                    </ControlTemplate.Triggers>
                </ControlTemplate>
            </Setter.Value>
        </Setter>
    </Style>

    <Style TargetType='ComboBoxItem'>
        <Setter Property='SnapsToDevicePixels' Value='true'/>
        <Setter Property='OverridesDefaultStyle' Value='true'/>
        <Setter Property='Foreground' Value='#F0F0F0'/>
        <Setter Property='Padding' Value='8,4,8,4'/>
        <Setter Property='Template'>
            <Setter.Value>
                <ControlTemplate TargetType='ComboBoxItem'>
                    <Border Name='Border' Background='Transparent' Padding='{TemplateBinding Padding}' CornerRadius='3' Margin='0,1,0,1' SnapsToDevicePixels='true'>
                        <ContentPresenter TextElement.Foreground='{TemplateBinding Foreground}' />
                    </Border>
                    <ControlTemplate.Triggers>
                        <Trigger Property='IsMouseOver' Value='true'>
                            <Setter TargetName='Border' Property='Background' Value='#00ADB5'/>
                            <Setter Property='Foreground' Value='White'/>
                        </Trigger>
                        <Trigger Property='IsHighlighted' Value='true'>
                            <Setter TargetName='Border' Property='Background' Value='#00ADB5'/>
                            <Setter Property='Foreground' Value='White'/>
                        </Trigger>
                        <Trigger Property='IsSelected' Value='true'>
                            <Setter TargetName='Border' Property='Background' Value='#00ADB5'/>
                            <Setter Property='Foreground' Value='White'/>
                        </Trigger>
                    </ControlTemplate.Triggers>
                </ControlTemplate>
            </Setter.Value>
        </Setter>
    </Style>
</ResourceDictionary>";
                var resourceDict = (ResourceDictionary)System.Windows.Markup.XamlReader.Parse(styleXaml);
                this.Resources.MergedDictionaries.Add(resourceDict);
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error parsing resources: " + ex.Message);
            }

            // Instantiation
            _executor = new CommandExecutor();
            _dnsHelper = new DnsHelper(_executor);
            _diagnosticTools = new DiagnosticTools();
            _dohResolver = new DohResolver();
            _serviceManager = new ServiceManager();

            DetectEnvironment();

            _processManager = new ProcessManager(exePath);
            _processManager.OnLogReceived += (log) => AppendLog("[GoodbyeDPI] " + log);
            _processManager.OnProcessExited += () =>
            {
                this.Dispatcher.BeginInvoke(new Action(delegate
                {
                    if (isBypassActive)
                    {
                        AppendLog("UYARI: Sürücü veya bypass süreci sonlandı.");
                        StopBypass();
                    }
                }));
            };

            string profilesPath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "profiles.json");
            _profileManager = new ProfileManager(profilesPath);
            _profileManager.LoadProfiles();

            // Initialize UI elements
            InitializeUi();

            // Setup Tray Icon
            SetupTray();

            // Trigger background cloud sync
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

            UpdateStatus();

            this.Closing += MainWindow_Closing;
            System.Windows.Application.Current.SessionEnding += (s, e) =>
            {
                isExiting = true;
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
            activeArch = Environment.Is64BitOperatingSystem ? "x86_64" : "x86";
            string relativePath = System.IO.Path.Combine(activeArch, "goodbyedpi.exe");
            exePath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, relativePath);

            blacklistFilePath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "custom_blacklist.txt");

            if (!File.Exists(exePath))
            {
                MessageBox.Show("goodbyedpi.exe bulunamadı!\nUygulama klasörünün düzgün çıkartıldığından emin olun.\nAranan konum: " + exePath, 
                    "Hata", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void InitializeUi()
        {
            // Main Grid
            var mainGrid = new Grid();
            mainGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(220) });
            mainGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            this.Content = mainGrid;

            // --- SIDEBAR (Column 0) ---
            var sidebar = new Border
            {
                Background = sidebarBg,
                BorderThickness = new Thickness(0, 0, 1, 0),
                BorderBrush = cardBorder
            };
            mainGrid.Children.Add(sidebar);
            Grid.SetColumn(sidebar, 0);

            var sidebarStack = new StackPanel { Margin = new Thickness(15, 20, 15, 20) };
            sidebar.Child = sidebarStack;

            // Logo
            var lblLogo = new TextBlock
            {
                Text = "GoodbyeDPI",
                FontSize = 22,
                FontWeight = FontWeights.Bold,
                Foreground = accentBrush,
                HorizontalAlignment = HorizontalAlignment.Left
            };
            sidebarStack.Children.Add(lblLogo);

            lblSub = new TextBlock
            {
                Text = "Türkiye Kontrol Paneli v3.0",
                FontSize = 10,
                Foreground = subTextBrush,
                Margin = new Thickness(0, 2, 0, 25)
            };
            sidebarStack.Children.Add(lblSub);

            // LED Status Card
            var statusBorder = new Border
            {
                Background = cardBg,
                BorderThickness = new Thickness(1),
                BorderBrush = cardBorder,
                CornerRadius = new CornerRadius(6),
                Padding = new Thickness(10, 8, 10, 8),
                Margin = new Thickness(0, 0, 0, 20)
            };
            sidebarStack.Children.Add(statusBorder);

            var statusPanel = new StackPanel { Orientation = Orientation.Horizontal };
            statusBorder.Child = statusPanel;

            statusLed = new Ellipse
            {
                Width = 12,
                Height = 12,
                Margin = new Thickness(2, 0, 8, 0),
                VerticalAlignment = VerticalAlignment.Center
            };
            ledBrush = new SolidColorBrush(Color.FromRgb(231, 76, 60)); // Red by default
            statusLed.Fill = ledBrush;
            statusPanel.Children.Add(statusLed);

            // breathing animation on GPU
            var breathAnimation = new DoubleAnimation
            {
                From = 0.3,
                To = 1.0,
                Duration = new Duration(TimeSpan.FromSeconds(1.2)),
                AutoReverse = true,
                RepeatBehavior = RepeatBehavior.Forever
            };
            statusLed.BeginAnimation(UIElement.OpacityProperty, breathAnimation);

            txtStatusLedInfo = new TextBlock
            {
                Text = "Bypass Pasif",
                FontSize = 11,
                FontWeight = FontWeights.Bold,
                Foreground = textBrush,
                VerticalAlignment = VerticalAlignment.Center
            };
            statusPanel.Children.Add(txtStatusLedInfo);

            // Navigation Buttons
            var btnDashboardNav = CreateNavButton("Kontrol Paneli", true);
            var btnNetworkNav = CreateNavButton("Ağ ve DNS Ayarları", false);
            var btnBlacklistNav = CreateNavButton("Filtre Kara Listesi", false);

            sidebarStack.Children.Add(btnDashboardNav);
            sidebarStack.Children.Add(btnNetworkNav);
            sidebarStack.Children.Add(btnBlacklistNav);

            // --- MAIN VIEW AREA (Column 1) ---
            var mainContentGrid = new Grid();
            mainContentGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(40) });
            mainContentGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            mainGrid.Children.Add(mainContentGrid);
            Grid.SetColumn(mainContentGrid, 1);

            // TitleBar Header (Window Controls)
            var titleBar = new Grid { Background = bgBrush };
            titleBar.MouseLeftButtonDown += (s, e) => { if (e.ButtonState == MouseButtonState.Pressed) this.DragMove(); };
            mainContentGrid.Children.Add(titleBar);
            Grid.SetRow(titleBar, 0);

            var windowControlsPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
            titleBar.Children.Add(windowControlsPanel);

            var btnMin = new Button
            {
                Content = "—",
                Width = 45,
                Height = 35,
                Background = Brushes.Transparent,
                Foreground = textBrush,
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand
            };
            btnMin.Click += (s, e) => this.WindowState = WindowState.Minimized;
            btnMin.MouseEnter += (s, e) => btnMin.Background = new SolidColorBrush(Color.FromArgb(30, 255, 255, 255));
            btnMin.MouseLeave += (s, e) => btnMin.Background = Brushes.Transparent;
            windowControlsPanel.Children.Add(btnMin);

            var btnClose = new Button
            {
                Content = "✕",
                Width = 45,
                Height = 35,
                Background = Brushes.Transparent,
                Foreground = textBrush,
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand
            };
            btnClose.Click += (s, e) => this.Close();
            btnClose.MouseEnter += (s, e) => btnClose.Background = redBrush;
            btnClose.MouseLeave += (s, e) => btnClose.Background = Brushes.Transparent;
            windowControlsPanel.Children.Add(btnClose);

            // Navigation Frame Panels
            var panelsFrame = new Grid();
            mainContentGrid.Children.Add(panelsFrame);
            Grid.SetRow(panelsFrame, 1);

            // Build Panels
            BuildDashboardPanel();
            BuildNetworkPanel();
            BuildBlacklistPanel();

            panelsFrame.Children.Add(panelDashboard);
            panelsFrame.Children.Add(panelNetwork);
            panelsFrame.Children.Add(panelBlacklist);

            // Default visible panel
            panelDashboard.Visibility = Visibility.Visible;
            panelNetwork.Visibility = Visibility.Collapsed;
            panelBlacklist.Visibility = Visibility.Collapsed;

            // Nav event bindings
            btnDashboardNav.Click += (s, e) => {
                SetNavActive(btnDashboardNav, new[] { btnNetworkNav, btnBlacklistNav });
                panelDashboard.Visibility = Visibility.Visible;
                panelNetwork.Visibility = Visibility.Collapsed;
                panelBlacklist.Visibility = Visibility.Collapsed;
            };
            btnNetworkNav.Click += (s, e) => {
                SetNavActive(btnNetworkNav, new[] { btnDashboardNav, btnBlacklistNav });
                panelDashboard.Visibility = Visibility.Collapsed;
                panelNetwork.Visibility = Visibility.Visible;
                panelBlacklist.Visibility = Visibility.Collapsed;
            };
            btnBlacklistNav.Click += (s, e) => {
                SetNavActive(btnBlacklistNav, new[] { btnDashboardNav, btnNetworkNav });
                panelDashboard.Visibility = Visibility.Collapsed;
                panelNetwork.Visibility = Visibility.Collapsed;
                panelBlacklist.Visibility = Visibility.Visible;
            };
        }

        private Button CreateNavButton(string content, bool isActive)
        {
            var btn = new Button
            {
                Content = content,
                Height = 36,
                Background = isActive ? accentBrush : Brushes.Transparent,
                Foreground = isActive ? Brushes.White : textBrush,
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand,
                FontWeight = FontWeights.Bold,
                HorizontalContentAlignment = HorizontalAlignment.Left,
                Padding = new Thickness(15, 0, 0, 0),
                Margin = new Thickness(0, 0, 0, 8)
            };

            // Custom round border style
            var template = new ControlTemplate(typeof(Button));
            var borderFactory = new FrameworkElementFactory(typeof(Border));
            borderFactory.SetValue(Border.CornerRadiusProperty, new CornerRadius(5));
            borderFactory.SetValue(Border.BackgroundProperty, new TemplateBindingExtension(Button.BackgroundProperty));
            
            var contentPresenterFactory = new FrameworkElementFactory(typeof(ContentPresenter));
            contentPresenterFactory.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            contentPresenterFactory.SetValue(ContentPresenter.MarginProperty, new TemplateBindingExtension(Button.PaddingProperty));
            borderFactory.AppendChild(contentPresenterFactory);

            template.VisualTree = borderFactory;
            btn.Template = template;

            if (!isActive)
            {
                btn.MouseEnter += (s, e) => { if (btn.Background != accentBrush) btn.Background = new SolidColorBrush(Color.FromRgb(40, 40, 48)); };
                btn.MouseLeave += (s, e) => { if (btn.Background != accentBrush) btn.Background = Brushes.Transparent; };
            }

            return btn;
        }

        private void SetNavActive(Button active, Button[] others)
        {
            active.Background = accentBrush;
            active.Foreground = Brushes.White;
            foreach (var b in others)
            {
                b.Background = Brushes.Transparent;
                b.Foreground = textBrush;
            }
        }

        private void BuildDashboardPanel()
        {
            panelDashboard = new Grid { Margin = new Thickness(15, 0, 15, 15) };
            panelDashboard.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(380) });
            panelDashboard.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

            // LEFT SIDE: CONTROL ACTIONS (Column 0)
            var leftStack = new StackPanel();
            panelDashboard.Children.Add(leftStack);
            Grid.SetColumn(leftStack, 0);

            // Card 1: Configuration
            var cardConfig = CreateCard("Bağlantı Ayarları");
            leftStack.Children.Add(cardConfig);
            var configStack = (StackPanel)cardConfig.Child;

            var lblPresetTitle = new TextBlock { Text = "Bypass Yöntemi (Preset):", Foreground = textBrush, Margin = new Thickness(0, 0, 0, 4), FontSize = 12 };
            configStack.Children.Add(lblPresetTitle);

            var presetGrid = new Grid();
            presetGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            presetGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(80) });
            configStack.Children.Add(presetGrid);

            cmbPreset = CreateStyledComboBox();
            RefreshPresetsDropdown();
            cmbPreset.SelectionChanged += CmbPreset_SelectionChanged;
            presetGrid.Children.Add(cmbPreset);
            Grid.SetColumn(cmbPreset, 0);

            var btnNewPreset = CreateStyledButton("Yeni Ekle", accentBrush, accentHoverBrush, 12);
            btnNewPreset.Margin = new Thickness(8, 0, 0, 10);
            btnNewPreset.Height = 28;
            btnNewPreset.Click += BtnNewPreset_Click;
            presetGrid.Children.Add(btnNewPreset);
            Grid.SetColumn(btnNewPreset, 1);

            // Add Custom Preset Border (Hidden by default)
            borderCustomPresetCard = new Border
            {
                Background = sidebarBg,
                BorderBrush = cardBorder,
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(4),
                Padding = new Thickness(8),
                Margin = new Thickness(0, 0, 0, 10),
                Visibility = Visibility.Collapsed
            };
            configStack.Children.Add(borderCustomPresetCard);
            var customPresetStack = new StackPanel();
            borderCustomPresetCard.Child = customPresetStack;

            var lblNewName = new TextBlock { Text = "Yeni Profil Adı:", Foreground = textBrush, FontSize = 11 };
            customPresetStack.Children.Add(lblNewName);
            txtNewPresetName = CreateStyledTextBox("Özel Profil 1");
            txtNewPresetName.Height = 24;
            customPresetStack.Children.Add(txtNewPresetName);

            var lblNewArgs = new TextBlock { Text = "Parametreler (örn. -5 --set-ttl 4):", Foreground = textBrush, FontSize = 11 };
            customPresetStack.Children.Add(lblNewArgs);
            txtNewPresetArgs = CreateStyledTextBox("-5 --set-ttl 4");
            txtNewPresetArgs.Height = 24;
            customPresetStack.Children.Add(txtNewPresetArgs);

            var customPresetButtons = new Grid { Margin = new Thickness(0, 5, 0, 0) };
            customPresetButtons.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            customPresetButtons.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            customPresetStack.Children.Add(customPresetButtons);

            btnSaveNewPreset = CreateStyledButton("Kaydet", accentBrush, accentHoverBrush, 11);
            btnSaveNewPreset.Height = 24;
            btnSaveNewPreset.Click += BtnSaveNewPreset_Click;
            customPresetButtons.Children.Add(btnSaveNewPreset);
            Grid.SetColumn(btnSaveNewPreset, 0);

            var btnCancelNewPreset = CreateStyledButton("İptal", new SolidColorBrush(Color.FromRgb(60, 60, 65)), new SolidColorBrush(Color.FromRgb(80, 80, 85)), 11);
            btnCancelNewPreset.Height = 24;
            btnCancelNewPreset.Margin = new Thickness(5, 0, 0, 0);
            btnCancelNewPreset.Click += (s, e) => borderCustomPresetCard.Visibility = Visibility.Collapsed;
            customPresetButtons.Children.Add(btnCancelNewPreset);
            Grid.SetColumn(btnCancelNewPreset, 1);

            var lblDnsTitle = new TextBlock { Text = "DNS Yönlendirme Modu:", Foreground = textBrush, Margin = new Thickness(0, 0, 0, 4), FontSize = 12 };
            configStack.Children.Add(lblDnsTitle);

            cmbDns = CreateStyledComboBox();
            cmbDns.Items.Add("Yandex DNS (Bypass Port 1253) [Önerilen]");
            cmbDns.Items.Add("Sistem DNS Ayarını Koru");
            cmbDns.Items.Add("Özel DNS Tanımla...");
            cmbDns.SelectedIndex = 0;
            cmbDns.SelectionChanged += CmbDns_SelectionChanged;
            configStack.Children.Add(cmbDns);

            lblCustomDns = new TextBlock { Text = "Özel DNS:", Foreground = textBrush, Margin = new Thickness(0, 0, 0, 4), FontSize = 12, Visibility = Visibility.Collapsed };
            configStack.Children.Add(lblCustomDns);

            txtCustomDns = CreateStyledTextBox("1.1.1.1:53");
            txtCustomDns.Visibility = Visibility.Collapsed;
            configStack.Children.Add(txtCustomDns);

            // Card 2: Actions
            var cardActions = CreateCard("Bypass İşlemleri");
            leftStack.Children.Add(cardActions);
            var actionsStack = (StackPanel)cardActions.Child;

            var actionButtonsGrid = new Grid();
            actionButtonsGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            actionButtonsGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            actionsStack.Children.Add(actionButtonsGrid);

            btnToggleBypass = CreateStyledButton("Bypass'ı Başlat", accentBrush, accentHoverBrush, 14);
            btnToggleBypass.Height = 40;
            btnToggleBypass.Click += BtnToggleBypass_Click;
            actionButtonsGrid.Children.Add(btnToggleBypass);
            Grid.SetColumn(btnToggleBypass, 0);

            btnAutoTune = CreateStyledButton("Otomatik Ayarla\n(Bağlantı Analizi)", new SolidColorBrush(Color.FromRgb(50, 50, 58)), new SolidColorBrush(Color.FromRgb(70, 70, 78)), 11);
            btnAutoTune.Height = 40;
            btnAutoTune.Margin = new Thickness(10, 0, 0, 0);
            btnAutoTune.Click += BtnAutoTune_Click;
            actionButtonsGrid.Children.Add(btnAutoTune);
            Grid.SetColumn(btnAutoTune, 1);

            var statusLayout = new Grid { Margin = new Thickness(0, 10, 0, 0) };
            statusLayout.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            statusLayout.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            actionsStack.Children.Add(statusLayout);

            lblProcessStatus = new TextBlock { Text = "Uygulama: Pasif 🔴", Foreground = redBrush, FontSize = 12, FontWeight = FontWeights.Bold };
            statusLayout.Children.Add(lblProcessStatus);
            Grid.SetColumn(lblProcessStatus, 0);

            lblServiceStatus = new TextBlock { Text = "Servis: Yüklü Değil 🔘", Foreground = subTextBrush, FontSize = 12, FontWeight = FontWeights.Bold, HorizontalAlignment = HorizontalAlignment.Right };
            statusLayout.Children.Add(lblServiceStatus);
            Grid.SetColumn(lblServiceStatus, 1);

            // Card 3: Service & Proxy Split
            var splitGrid = new Grid();
            splitGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            leftStack.Children.Add(splitGrid);

            var cardService = CreateCard("Windows Servis Yönetimi");
            splitGrid.Children.Add(cardService);
            var serviceStack = (StackPanel)cardService.Child;

            var serviceButtonsGrid = new Grid();
            serviceButtonsGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            serviceButtonsGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            serviceStack.Children.Add(serviceButtonsGrid);

            btnInstallService = CreateStyledButton("Hizmet Olarak Yükle", new SolidColorBrush(Color.FromRgb(50, 50, 58)), new SolidColorBrush(Color.FromRgb(70, 70, 78)), 11);
            btnInstallService.Height = 32;
            btnInstallService.Click += BtnInstallService_Click;
            serviceButtonsGrid.Children.Add(btnInstallService);
            Grid.SetColumn(btnInstallService, 0);

            btnRemoveService = CreateStyledButton("Hizmeti Kaldır", new SolidColorBrush(Color.FromRgb(50, 50, 58)), new SolidColorBrush(Color.FromRgb(70, 70, 78)), 11);
            btnRemoveService.Height = 32;
            btnRemoveService.Margin = new Thickness(10, 0, 0, 0);
            btnRemoveService.Click += BtnRemoveService_Click;
            serviceButtonsGrid.Children.Add(btnRemoveService);
            Grid.SetColumn(btnRemoveService, 1);

            // Card 4: Local PAC / Proxy
            var cardProxy = CreateCard("Mobil Paylaşım (Yerel Ağ Proxy & PAC)");
            leftStack.Children.Add(cardProxy);
            var proxyStack = (StackPanel)cardProxy.Child;

            chkEnableProxy = new CheckBox
            {
                Content = "Proxy ve PAC Sunucusunu Aç",
                Foreground = textBrush,
                Margin = new Thickness(0, 0, 0, 8),
                FontWeight = FontWeights.Bold
            };
            chkEnableProxy.Checked += ChkEnableProxy_CheckedChanged;
            chkEnableProxy.Unchecked += ChkEnableProxy_CheckedChanged;
            proxyStack.Children.Add(chkEnableProxy);

            var proxyGrid = new Grid();
            proxyGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            proxyGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(70) });
            proxyStack.Children.Add(proxyGrid);

            lblProxyInfo = new TextBlock
            {
                Text = "Proxy kapalı. Mobil paylaşım pasif.",
                Foreground = subTextBrush,
                TextWrapping = TextWrapping.Wrap,
                FontSize = 11
            };
            proxyGrid.Children.Add(lblProxyInfo);
            Grid.SetColumn(lblProxyInfo, 0);

            imgQrCode = new Image
            {
                Width = 65,
                Height = 65,
                HorizontalAlignment = HorizontalAlignment.Right,
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(5, 0, 0, 0)
            };
            proxyGrid.Children.Add(imgQrCode);
            Grid.SetColumn(imgQrCode, 1);

            // RIGHT SIDE: LOG CONSOLE (Column 1)
            var rightStack = new Grid { Margin = new Thickness(10, 10, 0, 10) };
            rightStack.RowDefinitions.Add(new RowDefinition { Height = new GridLength(30) });
            rightStack.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            panelDashboard.Children.Add(rightStack);
            Grid.SetColumn(rightStack, 1);

            // Log header
            var logHeader = new Grid();
            rightStack.Children.Add(logHeader);
            Grid.SetRow(logHeader, 0);

            var lblLogTitle = new TextBlock { Text = "Sistem Log Kayıtları", Foreground = textBrush, FontWeight = FontWeights.Bold, VerticalAlignment = VerticalAlignment.Center };
            logHeader.Children.Add(lblLogTitle);

            var btnClearLogs = CreateStyledButton("Temizle", new SolidColorBrush(Color.FromRgb(50, 50, 58)), new SolidColorBrush(Color.FromRgb(70, 70, 78)), 11);
            btnClearLogs.Width = 65;
            btnClearLogs.Height = 24;
            btnClearLogs.HorizontalAlignment = HorizontalAlignment.Right;
            btnClearLogs.Click += (s, e) => txtLog.Clear();
            logHeader.Children.Add(btnClearLogs);

            // Log Console TextBox
            txtLog = new TextBox
            {
                IsReadOnly = true,
                AcceptsReturn = true,
                TextWrapping = TextWrapping.Wrap,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                Background = new SolidColorBrush(Color.FromRgb(16, 16, 20)),
                Foreground = new SolidColorBrush(Color.FromRgb(142, 227, 235)),
                BorderBrush = cardBorder,
                FontFamily = new FontFamily("Consolas"),
                FontSize = 11,
                Margin = new Thickness(0, 5, 0, 0),
                Padding = new Thickness(8)
            };
            rightStack.Children.Add(txtLog);
            Grid.SetRow(txtLog, 1);
        }

        private void BuildNetworkPanel()
        {
            panelNetwork = new Grid { Margin = new Thickness(15, 0, 15, 15) };
            panelNetwork.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            panelNetwork.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

            // LEFT COLUMN (DNS Changer & Troubleshoot)
            var leftStack = new StackPanel { Margin = new Thickness(0, 0, 10, 0) };
            panelNetwork.Children.Add(leftStack);
            Grid.SetColumn(leftStack, 0);

            var cardSysDns = CreateCard("Sistem Ağ Kartı DNS Değiştirici");
            leftStack.Children.Add(cardSysDns);
            var sysDnsStack = (StackPanel)cardSysDns.Child;

            var lblSysDnsInfo = new TextBlock
            {
                Text = "Seçtiğiniz DNS profilini doğrudan aktif internet adaptörlerinize uygular. Windows ayarlarına gitmeye gerek kalmaz. IPv4 ve IPv6'yı aynı anda yapılandırır.",
                Foreground = subTextBrush,
                TextWrapping = TextWrapping.Wrap,
                FontSize = 11,
                Margin = new Thickness(0, 0, 0, 10)
            };
            sysDnsStack.Children.Add(lblSysDnsInfo);

            cmbSysDns = CreateStyledComboBox();
            cmbSysDns.Items.Add("Yandex DNS (77.88.8.8, 77.88.8.1 | IPv6 aktif)");
            cmbSysDns.Items.Add("Cloudflare DNS (1.1.1.1, 1.0.0.1 | IPv6 aktif)");
            cmbSysDns.Items.Add("Google DNS (8.8.8.8, 8.8.4.4 | IPv6 aktif)");
            cmbSysDns.Items.Add("Otomatik DNS (DHCP'ye Döndür)");
            cmbSysDns.Items.Add("Özel DNS Adresi gir...");
            cmbSysDns.SelectedIndex = 0;
            cmbSysDns.SelectionChanged += CmbSysDns_SelectionChanged;
            sysDnsStack.Children.Add(cmbSysDns);

            lblCustomSysDns = new TextBlock { Text = "Virgülle ayırın (Örn: 94.140.14.14, 94.140.15.15):", Foreground = textBrush, Margin = new Thickness(0, 0, 0, 4), FontSize = 11, Visibility = Visibility.Collapsed };
            sysDnsStack.Children.Add(lblCustomSysDns);

            txtCustomSysDns = CreateStyledTextBox("94.140.14.14, 94.140.15.15");
            txtCustomSysDns.Visibility = Visibility.Collapsed;
            sysDnsStack.Children.Add(txtCustomSysDns);

            btnApplySysDns = CreateStyledButton("Sistem DNS Ayarını Güncelle", accentBrush, accentHoverBrush, 12);
            btnApplySysDns.Height = 35;
            btnApplySysDns.Click += BtnApplySysDns_Click;
            sysDnsStack.Children.Add(btnApplySysDns);

            // Onarım & Başlangıç ayarı card
            var cardTrouble = CreateCard("Sistem Otomasyonu & Bağlantı Onarıcı");
            leftStack.Children.Add(cardTrouble);
            var troubleStack = (StackPanel)cardTrouble.Child;

            var lblTroubleInfo = new TextBlock
            {
                Text = "Bağlantı kopukluklarında, 'WinDivert driver busy' hatalarında veya DNS kilitlenmelerinde bu onarımı çalıştırın.\n" + 
                       "• SOCKS Port 8085'i meşgul eden diğer süreçler kapatılır.\n" + 
                       "• Kilitli zombi süreçler ve driver handle'ları temizlenir.\n" + 
                       "• DNS Önbelleği temizlenir ve Winsock soketleri sıfırlanır.",
                Foreground = subTextBrush,
                TextWrapping = TextWrapping.Wrap,
                FontSize = 11,
                Margin = new Thickness(0, 0, 0, 10)
            };
            troubleStack.Children.Add(lblTroubleInfo);

            chkStartup = new CheckBox
            {
                Content = "Windows Açıldığında Otomatik Başlat (Sistem Tepsisi)",
                Foreground = textBrush,
                Margin = new Thickness(0, 0, 0, 10),
                IsChecked = StartupHelper.IsStartupEnabled()
            };
            chkStartup.Checked += (s, e) => StartupHelper.SetStartup(true);
            chkStartup.Unchecked += (s, e) => StartupHelper.SetStartup(false);
            troubleStack.Children.Add(chkStartup);

            btnTroubleshoot = CreateStyledButton("Bağlantıyı ve Sürücü Kilitlerini Onar", redBrush, redHoverBrush, 12);
            btnTroubleshoot.Height = 35;
            btnTroubleshoot.Click += BtnTroubleshoot_Click;
            troubleStack.Children.Add(btnTroubleshoot);

            // RIGHT COLUMN (Diagnostics Test)
            var rightStack = new StackPanel { Margin = new Thickness(10, 0, 0, 0) };
            panelNetwork.Children.Add(rightStack);
            Grid.SetColumn(rightStack, 1);

            var cardDiag = CreateCard("Bağlantı Durumu & Erişim Testi");
            rightStack.Children.Add(cardDiag);
            var diagStack = (StackPanel)cardDiag.Child;

            btnTestConnection = CreateStyledButton("Erişilebilirlik Testini Başlat", new SolidColorBrush(Color.FromRgb(50, 50, 58)), new SolidColorBrush(Color.FromRgb(70, 70, 78)), 13);
            btnTestConnection.Height = 40;
            btnTestConnection.Click += BtnTestConnection_Click;
            diagStack.Children.Add(btnTestConnection);

            lblDiagStatus = new TextBlock
            {
                Text = "Durum: Test edilmedi.\n\n" + 
                       "Discord ve YouTube servislerine şifreli bağlantı (TLS Handshake) kurularak, servis sağlayıcının paketi kesip kesmediği ölçümlenir. Test sonucunda bypass'ın başarısı doğrulanabilir.",
                Foreground = textBrush,
                TextWrapping = TextWrapping.Wrap,
                FontSize = 12,
                Margin = new Thickness(0, 15, 0, 0),
                FontFamily = new FontFamily("Consolas")
            };
            diagStack.Children.Add(lblDiagStatus);
        }

        private void BuildBlacklistPanel()
        {
            panelBlacklist = new Grid { Margin = new Thickness(15, 0, 15, 15) };
            var cardBlacklist = CreateCard("Filtre Kara Listesi");
            panelBlacklist.Children.Add(cardBlacklist);

            var blacklistStack = (StackPanel)cardBlacklist.Child;

            chkUseBlacklist = new CheckBox
            {
                Content = "Sadece Kara Listedeki Siteleri İşle (Blacklist Filtre Modu)",
                Foreground = textBrush,
                FontWeight = FontWeights.Bold,
                Margin = new Thickness(0, 0, 0, 8),
                IsChecked = true
            };
            blacklistStack.Children.Add(chkUseBlacklist);

            var lblInfo = new TextBlock
            {
                Text = "Aşağıdaki kutuya, paket manipülasyonunun sadece hangi sitelerde geçerli olmasını istiyorsanız onları ekleyin (Her satıra bir site, örn: discord.com).\n" + 
                       "Bu kutu boşsa veya seçeneği kapatırsanız GoodbyeDPI tüm bağlantıları genel olarak filtreler (önerilen budur).",
                Foreground = subTextBrush,
                TextWrapping = TextWrapping.Wrap,
                FontSize = 11,
                Margin = new Thickness(0, 0, 0, 10)
            };
            blacklistStack.Children.Add(lblInfo);

            txtBlacklist = new TextBox
            {
                AcceptsReturn = true,
                TextWrapping = TextWrapping.NoWrap,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                HorizontalScrollBarVisibility = ScrollBarVisibility.Auto,
                Background = new SolidColorBrush(Color.FromRgb(16, 16, 20)),
                Foreground = Brushes.White,
                BorderBrush = cardBorder,
                FontFamily = new FontFamily("Consolas"),
                FontSize = 12,
                Height = 280,
                Margin = new Thickness(0, 0, 0, 12),
                Padding = new Thickness(8)
            };
            blacklistStack.Children.Add(txtBlacklist);
            LoadBlacklist();

            btnSaveBlacklist = CreateStyledButton("Kara Listeyi Kaydet ve Güncelle", accentBrush, accentHoverBrush, 13);
            btnSaveBlacklist.Height = 40;
            btnSaveBlacklist.Click += BtnSaveBlacklist_Click;
            blacklistStack.Children.Add(btnSaveBlacklist);
        }

        private Border CreateCard(string header)
        {
            var card = new Border
            {
                Background = cardBg,
                BorderThickness = new Thickness(1),
                BorderBrush = cardBorder,
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(15),
                Margin = new Thickness(0, 0, 0, 12)
            };

            var stack = new StackPanel();
            card.Child = stack;

            var lblHeader = new TextBlock
            {
                Text = header,
                FontWeight = FontWeights.Bold,
                Foreground = accentBrush,
                Margin = new Thickness(0, 0, 0, 10),
                FontSize = 13
            };
            stack.Children.Add(lblHeader);

            return card;
        }

        private ComboBox CreateStyledComboBox()
        {
            return new ComboBox
            {
                Background = new SolidColorBrush(Color.FromRgb(40, 40, 48)),
                Foreground = Brushes.White,
                BorderBrush = new SolidColorBrush(Color.FromRgb(60, 60, 70)),
                Padding = new Thickness(6, 4, 6, 4),
                Margin = new Thickness(0, 0, 0, 10),
                Height = 28
            };
        }

        private TextBox CreateStyledTextBox(string defaultText)
        {
            return new TextBox
            {
                Text = defaultText,
                Background = new SolidColorBrush(Color.FromRgb(16, 16, 20)),
                Foreground = Brushes.White,
                BorderBrush = new SolidColorBrush(Color.FromRgb(45, 45, 55)),
                CaretBrush = Brushes.White,
                Padding = new Thickness(6),
                Margin = new Thickness(0, 0, 0, 10),
                Height = 28
            };
        }

        private Button CreateStyledButton(string content, Brush background, Brush hoverBackground, double fontSize)
        {
            var btn = new Button
            {
                Content = content,
                Background = background,
                Foreground = Brushes.White,
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand,
                FontWeight = FontWeights.Bold,
                FontSize = fontSize
            };

            var template = new ControlTemplate(typeof(Button));
            var borderFactory = new FrameworkElementFactory(typeof(Border));
            borderFactory.SetValue(Border.CornerRadiusProperty, new CornerRadius(6));
            borderFactory.SetValue(Border.BackgroundProperty, new TemplateBindingExtension(Button.BackgroundProperty));
            
            var contentPresenterFactory = new FrameworkElementFactory(typeof(ContentPresenter));
            contentPresenterFactory.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            contentPresenterFactory.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            borderFactory.AppendChild(contentPresenterFactory);

            template.VisualTree = borderFactory;
            btn.Template = template;

            btn.MouseEnter += (s, e) =>
            {
                if (btn == btnToggleBypass)
                {
                    btn.Background = isBypassActive ? redHoverBrush : accentHoverBrush;
                }
                else
                {
                    btn.Background = hoverBackground;
                }
            };
            btn.MouseLeave += (s, e) =>
            {
                if (btn == btnToggleBypass)
                {
                    btn.Background = isBypassActive ? redBrush : accentBrush;
                }
                else
                {
                    btn.Background = background;
                }
            };

            return btn;
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
                isExiting = true;
                this.Close();
            };

            trayMenu.Items.Add(mnuToggle);
            trayMenu.Items.Add(mnuShow);
            trayMenu.Items.Add(new System.Windows.Forms.ToolStripSeparator());
            trayMenu.Items.Add(mnuExit);

            notifyIcon = new System.Windows.Forms.NotifyIcon();
            notifyIcon.Icon = System.Drawing.SystemIcons.Shield;
            notifyIcon.ContextMenuStrip = trayMenu;
            notifyIcon.Text = "GoodbyeDPI Türkiye Kontrol Paneli";
            notifyIcon.Visible = true;
            notifyIcon.DoubleClick += (s, e) => ShowWindow();
        }

        private void ShowWindow()
        {
            this.Show();
            this.WindowState = WindowState.Normal;
            this.Activate();
        }

        private void MainWindow_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            if (!isExiting)
            {
                e.Cancel = true;
                this.Hide();
                notifyIcon.ShowBalloonTip(1500, "GoodbyeDPI Arka Planda", "Sistem tepsisinde simgeye sağ tıklayarak yönetebilirsiniz.", System.Windows.Forms.ToolTipIcon.Info);
            }
            else
            {
                StopBypass();
                if (_proxyServer != null)
                {
                    _proxyServer.Stop();
                }
                notifyIcon.Visible = false;
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

        private string BuildArguments()
        {
            if (cmbPreset.SelectedIndex == _profileManager.Profiles.Count)
            {
                return txtCustomDns.Text;
            }

            string baseArgs = _profileManager.Profiles[cmbPreset.SelectedIndex].Arguments;
            string dnsArgs = "";

            if (cmbDns.SelectedIndex == 0) // Yandex
            {
                dnsArgs = "--dns-addr 77.88.8.8 --dns-port 1253 --dnsv6-addr 2a02:6b8::feed:0ff --dnsv6-port 1253";
            }
            else if (cmbDns.SelectedIndex == 2) // Custom
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
            if (chkUseBlacklist.IsChecked == true && File.Exists(blacklistFilePath))
            {
                blacklistArgs = string.Format(" --blacklist \"{0}\"", blacklistFilePath);
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
                if (isBypassActive) StopBypass();
                else StartBypass();
            }));
        }

        private void BtnToggleBypass_Click(object sender, RoutedEventArgs e)
        {
            if (isBypassActive) StopBypass();
            else StartBypass();
        }

        private async void StartBypass()
        {
            if (!File.Exists(exePath))
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
                isBypassActive = true;
                btnToggleBypass.Content = "Bypass'ı Durdur";
                btnToggleBypass.Background = redBrush;

                AppendLog("DPI atlatma aktif hale getirildi.");
                UpdateStatus();
            }
            catch (Exception ex)
            {
                AppendLog("HATA: " + ex.Message);
                isBypassActive = false;
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

            isBypassActive = false;
            btnToggleBypass.Content = "Bypass'ı Başlat";
            btnToggleBypass.Background = accentBrush;

            AppendLog("DPI atlatma pasif.");
            UpdateStatus();
        }

        private async void BtnInstallService_Click(object sender, RoutedEventArgs e)
        {
            if (!File.Exists(exePath))
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
                bool success = await _serviceManager.InstallServiceAsync(exePath, args);

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
            
            // WinDivert kernel driver requires administrator privileges.
            // If not admin, offer to restart as admin before running tests.
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
                        isExiting = true;
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
                    
                    // Include default Yandex DNS helper inside test parameters
                    testArgs += " --dns-addr 77.88.8.8 --dns-port 1253 --dnsv6-addr 2a02:6b8::feed:0ff --dnsv6-port 1253";
                    
                    AppendLog(string.Format("\nDenetlenen Profil: {0}", presetName));
                    
                    ProcessManager tempManager = new ProcessManager(exePath);
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

                        await Task.Delay(3500); // WinDivert sürücüsü yüklenene kadar bekle

                        // Birden fazla URL test et — tek engelli domain tüm profili başarısız saymasın
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
                cmbDns.SelectedIndex = 0; // Default to Yandex Redirect
                StartBypass();
            }
        }

        private async void BtnApplySysDns_Click(object sender, RoutedEventArgs e)
        {
            btnApplySysDns.IsEnabled = false;
            AppendLog("Sistem ağ kartı DNS ayarları güncelleniyor... UAC izni istenebilir.");

            string dnsValue = "";
            string ipv6Value = "";

            if (cmbSysDns.SelectedIndex == 0) // Yandex
            {
                dnsValue = "77.88.8.8, 77.88.8.1";
                ipv6Value = "2a02:6b8::fed:9, 2a02:6b8:0:1::fed:9";
            }
            else if (cmbSysDns.SelectedIndex == 1) // Cloudflare
            {
                dnsValue = "1.1.1.1, 1.0.0.1";
                ipv6Value = "2606:4700:4700::1111, 2606:4700:4700::1001";
            }
            else if (cmbSysDns.SelectedIndex == 2) // Google
            {
                dnsValue = "8.8.8.8, 8.8.4.4";
                ipv6Value = "2001:4860:4860::8888, 2001:4860:4860::8844";
            }
            else if (cmbSysDns.SelectedIndex == 3) // DHCP
            {
                dnsValue = ""; 
                ipv6Value = "";
            }
            else if (cmbSysDns.SelectedIndex == 4) // Custom
            {
                dnsValue = txtCustomSysDns.Text.Trim();
                ipv6Value = ""; // No custom IPv6 parsed for simplicity
            }

            try
            {
                // Gather active DNS list (both IPv4 and IPv6)
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
                // 1. Kill socket conflicts
                await PerformSelfHealingLocalAsync();

                // 2. Stop processes and reset registry/drivers using UAC
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
                // Check conflicts on 8085 locally (we don't need UAC to check netstat or kill local user sockets)
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
                sb.AppendLine(discordResult.Success ? string.Format("AKTİF (TLS: {0} ms)  " + (isBypassActive ? "✅ [Engelsiz]" : "✅"), discordResult.Latency) : "ENGELLEDİ / BAŞARISIZ ❌");
                sb.AppendLine();
                sb.Append("• YouTube Bağlantısı: ");
                sb.AppendLine(youtubeResult.Success ? string.Format("AKTİF (TLS: {0} ms)  " + (isBypassActive ? "✅ [Engelsiz]" : "✅"), youtubeResult.Latency) : "ENGELLEDİ / BAŞARISIZ ❌");
                sb.AppendLine();
                sb.AppendLine("============================");
                sb.AppendLine(isBypassActive ? "Not: GoodbyeDPI bypass aktif durumdayken test edilmiştir." : "Not: Sistem bypass kapalıyken test edilmiştir.");

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
                    _proxyServer = new ProxyServer(8085, blacklistFilePath, AppendLog);
                    // Run proxy server startup and accept loop in a background task
                    var startTask = Task.Run(async () => {
                        await _proxyServer.StartAsync();
                    });
                    
                    // Give it a brief moment (150ms) to check if socket binding succeeds or throws SocketException
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
                    
                    // Temporarily remove events to prevent recursive loops
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
                lblProxyInfo.Foreground = accentBrush;

                // Load QR Code Image from API asynchronously using WPF BitmapImage
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
                lblProxyInfo.Foreground = subTextBrush;
                imgQrCode.Source = null;
            }
        }

        private void BtnSaveBlacklist_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                File.WriteAllText(blacklistFilePath, txtBlacklist.Text);
                AppendLog("Kara liste başarıyla kaydedildi: " + blacklistFilePath);
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
                if (File.Exists(blacklistFilePath))
                {
                    txtBlacklist.Text = File.ReadAllText(blacklistFilePath);
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
                    File.WriteAllText(blacklistFilePath, txtBlacklist.Text);
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
                btnToggleBypass.Background = redBrush;
                isBypassActive = true;
                txtStatusLedInfo.Text = "Bypass Aktif";
                ledBrush.Color = Color.FromRgb(46, 204, 113); // Green LED
            }
            else
            {
                lblProcessStatus.Text = "Uygulama: Pasif 🔴";
                lblProcessStatus.Foreground = redBrush;
                btnToggleBypass.Content = "Bypass'ı Başlat";
                btnToggleBypass.Background = accentBrush;
                isBypassActive = false;
                txtStatusLedInfo.Text = "Bypass Pasif";
                ledBrush.Color = Color.FromRgb(231, 76, 60); // Red LED
            }

            // Başlık çubuğunda ve sidebar üzerinde yönetici durumunu göster
            if (IsAdministrator())
            {
                this.Title = "GoodbyeDPI Türkiye Kontrol Paneli  ✅ Yönetici";
                if (lblSub != null)
                {
                    lblSub.Text = "Türkiye Kontrol Paneli v3.0  [Yönetici] 🛡️";
                    lblSub.Foreground = accentBrush;
                }
            }
            else
            {
                this.Title = "GoodbyeDPI Türkiye Kontrol Paneli  ⚠️ Sınırlı Yetki — Sağ tık → Yönetici olarak çalıştır";
                if (lblSub != null)
                {
                    lblSub.Text = "Türkiye Kontrol Paneli v3.0  [Sınırlı Yetki] ⚠️";
                    lblSub.Foreground = redBrush;
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
                lblServiceStatus.Foreground = subTextBrush;
            }
        }

        private void AppendLog(string text)
        {
            if (txtLog == null) return;
            string timeStamp = DateTime.Now.ToString("HH:mm:ss");
            txtLog.AppendText(string.Format("[{0}] {1}\n", timeStamp, text));
            txtLog.ScrollToEnd();
        }
    }
}
