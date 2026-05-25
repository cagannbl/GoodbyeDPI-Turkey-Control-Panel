using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;

namespace GoodbyeDPILauncher
{
    public class DohResolver
    {
        private static readonly HttpClient _httpClient;
        private readonly string _endpoint;

        static DohResolver()
        {
            var handler = new HttpClientHandler
            {
                // Bypass local intercept certificates to get clean DoH query
                ServerCertificateCustomValidationCallback = (sender, cert, chain, sslPolicyErrors) => true
            };

            _httpClient = new HttpClient(handler)
            {
                Timeout = TimeSpan.FromMilliseconds(3000)
            };

            _httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        }

        public DohResolver(string endpoint = "https://cloudflare-dns.com/dns-query")
        {
            _endpoint = endpoint;
        }

        /// <summary>
        /// Asynchronously resolves the hostname's IPv4 address via Cloudflare/Google DoH JSON endpoint.
        /// </summary>
        public async Task<string> ResolveIpAsync(string hostname)
        {
            try
            {
                string url = string.Format("{0}?name={1}&type=A", _endpoint, Uri.EscapeDataString(hostname));
                
                var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/dns-json"));

                using (var response = await _httpClient.SendAsync(request))
                {
                    if (!response.IsSuccessStatusCode) return null;
                    string json = await response.Content.ReadAsStringAsync();

                    // Iterate all "data" entries in the JSON Answer array, skipping CNAME (type 5).
                    // We look for {"type":1, ... "data":"<ip>"} patterns.
                    int searchFrom = 0;
                    string typePattern = "\"type\":";
                    string dataPattern = "\"data\":\"";
                    while (searchFrom < json.Length)
                    {
                        int typeIdx = json.IndexOf(typePattern, searchFrom);
                        if (typeIdx == -1) break;

                        int typeValStart = typeIdx + typePattern.Length;
                        int typeValEnd = json.IndexOf(",", typeValStart);
                        if (typeValEnd == -1) typeValEnd = json.IndexOf("}", typeValStart);
                        if (typeValEnd == -1) break;

                        string typeValStr = json.Substring(typeValStart, typeValEnd - typeValStart).Trim();
                        int typeVal;
                        if (!int.TryParse(typeValStr, out typeVal))
                        {
                            searchFrom = typeValEnd;
                            continue;
                        }

                        // Look for the "data" field in the same answer block (within next 512 chars)
                        int dataIdx = json.IndexOf(dataPattern, typeValEnd);
                        if (dataIdx == -1 || dataIdx > typeValEnd + 512)
                        {
                            searchFrom = typeValEnd;
                            continue;
                        }

                        int dataStart = dataIdx + dataPattern.Length;
                        int dataEnd = json.IndexOf("\"", dataStart);
                        if (dataEnd == -1) break;

                        string dataVal = json.Substring(dataStart, dataEnd - dataStart);

                        // Only return if this is an A record (type 1) and looks like an IP
                        if (typeVal == 1)
                        {
                            System.Net.IPAddress parsed;
                            if (System.Net.IPAddress.TryParse(dataVal, out parsed))
                                return dataVal;
                        }

                        searchFrom = dataEnd;
                    }
                }
            }
            catch {}
            return null;
        }
    }
}
