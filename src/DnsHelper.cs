using System;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace GoodbyeDPILauncher
{
    public class DnsHelper
    {
        private readonly CommandExecutor _executor;

        public DnsHelper(CommandExecutor executor)
        {
            _executor = executor;
        }

        private static bool IsIPv4(string ip)
        {
            System.Net.IPAddress addr;
            return System.Net.IPAddress.TryParse(ip, out addr) && addr.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork;
        }

        private static bool IsIPv6(string ip)
        {
            System.Net.IPAddress addr;
            return System.Net.IPAddress.TryParse(ip, out addr) && addr.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6;
        }

        public async Task<string> SetDnsAsync(string[] dnsServers)
        {
            if (dnsServers == null || dnsServers.Length == 0)
            {
                return await ResetDnsAsync();
            }

            var ipv4List = dnsServers
                .Where(ip => IsIPv4(ip))
                .Select(ip => string.Format("'{0}'", ip.Trim()))
                .ToList();

            var ipv6List = dnsServers
                .Where(ip => IsIPv6(ip))
                .Select(ip => string.Format("'{0}'", ip.Trim()))
                .ToList();

            if (ipv6List.Count == 0)
            {
                ipv6List.Add("'::1'"); // IPv6 DNS sızıntılarını varsayılan olarak engelle
            }

            string ipv4String = string.Join(",", ipv4List);
            string ipv6String = string.Join(",", ipv6List);

            string psScript = string.Format(
                "Get-NetAdapter | Where-Object {{ $_.Status -eq 'Up' }} | ForEach-Object {{ " +
                "Set-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -ServerAddresses @({0}) -AddressFamily IPv4 -ErrorAction SilentlyContinue; " +
                "Set-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -ServerAddresses @({1}) -AddressFamily IPv6 -ErrorAction SilentlyContinue }}", 
                ipv4String, ipv6String
            );

            return await ExecutePowerShellScriptAsync(psScript);
        }

        /// <summary>
        /// Aktif ağ bağdaştırıcılarını otomatik DNS (DHCP) kullanacak şekilde sıfırlar.
        /// </summary>
        public async Task<string> ResetDnsAsync()
        {
            string psScript = "Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { " +
                             "Set-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -ResetServerAddresses -AddressFamily IPv4 -ErrorAction SilentlyContinue; " +
                             "Set-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -ResetServerAddresses -AddressFamily IPv6 -ErrorAction SilentlyContinue }";
            return await ExecutePowerShellScriptAsync(psScript);
        }

        /// <summary>
        /// PowerShell betiğini Base64 ile kodlayarak EncodedCommand parametresiyle güvenli bir şekilde çalıştırır.
        /// </summary>
        private async Task<string> ExecutePowerShellScriptAsync(string script)
        {
            // Betiğin Base64 olarak kodlanması, komut satırı ayrıştırma hatalarını ve enjeksiyonları önler
            byte[] bytes = Encoding.Unicode.GetBytes(script);
            string base64Script = Convert.ToBase64String(bytes);

            string[] args = new[]
            {
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy", "Bypass",
                "-EncodedCommand", base64Script
            };

            return await _executor.RunCommandAsync("powershell.exe", args);
        }
    }
}
