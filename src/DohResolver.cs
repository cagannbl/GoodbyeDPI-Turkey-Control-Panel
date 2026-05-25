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
                // Temiz DoH sorgusu alabilmek için yerel sertifika doğrulamasını yoksay
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
        /// Belirtilen alan adının IPv4 adresini DoH (DNS over HTTPS) JSON uç noktası üzerinden asenkron olarak çözer.
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

                    // JSON yanıtındaki tüm "Answer" dizisini tarar ve CNAME kayıtlarını (tip 5) atlar.
                    // {"type":1, ... "data":"<ip>"} desenlerini arar.
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

                        // Aynı yanıt bloğunda yer alan "data" alanını ara (sonraki 512 karakter içinde)
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

                        // Yalnızca A kaydı (tip 1) ise ve geçerli bir IP adresi ise geri döndür
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
