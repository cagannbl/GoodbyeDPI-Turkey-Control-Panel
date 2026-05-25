using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading.Tasks;

namespace GoodbyeDPI.Core.Network
{
    public class DohResponse
    {
        public List<DohAnswer>? Answer { get; set; }
    }

    public class DohAnswer
    {
        public string? Name { get; set; }
        public int Type { get; set; }
        public int Ttl { get; set; }
        public string? Data { get; set; }
    }

    public class HttpClientDohClient : IDohClient
    {
        private static readonly HttpClient _httpClient;

        static HttpClientDohClient()
        {
            var handler = new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback = (sender, cert, chain, sslPolicyErrors) => true
            };
            _httpClient = new HttpClient(handler)
            {
                Timeout = TimeSpan.FromMilliseconds(2500)
            };
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        }

        public async Task<string?> QueryAsync(string endpoint, string hostname)
        {
            try
            {
                string url = string.Format("{0}?name={1}&type=A", endpoint, Uri.EscapeDataString(hostname));
                var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/dns-json"));

                using (var response = await _httpClient.SendAsync(request))
                {
                    if (!response.IsSuccessStatusCode) return null;
                    string json = await response.Content.ReadAsStringAsync();
                    
                    var options = new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    };
                    var dnsResponse = JsonSerializer.Deserialize<DohResponse>(json, options);
                    if (dnsResponse?.Answer != null)
                    {
                        foreach (var answer in dnsResponse.Answer)
                        {
                            if (answer.Type == 1 && !string.IsNullOrEmpty(answer.Data))
                            {
                                return answer.Data;
                            }
                        }
                    }
                }
            }
            catch
            {
                // Handle parsing or HTTP client exceptions safely to avoid crashes
            }
            return null;
        }
    }

    public class FallbackDohResolver
    {
        private readonly IDohClient _dohClient;
        private readonly string[] _dohEndpoints = new[]
        {
            "https://cloudflare-dns.com/dns-query",
            "https://dns.google/dns-query",
            "https://dns.adguard-dns.com/dns-query",
            "https://dns.quad9.net/dns-query"
        };

        public FallbackDohResolver(IDohClient? dohClient = null)
        {
            _dohClient = dohClient ?? new HttpClientDohClient();
        }

        public async Task<string?> ResolveIpWithFallbackAsync(string hostname)
        {
            foreach (var endpoint in _dohEndpoints)
            {
                try
                {
                    string? ip = await _dohClient.QueryAsync(endpoint, hostname);
                    if (!string.IsNullOrEmpty(ip))
                    {
                        return ip;
                    }
                }
                catch
                {
                    // Failover to the next endpoint
                }
            }
            return null;
        }
    }
}
