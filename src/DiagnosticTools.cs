using System;
using System.Diagnostics;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;

namespace GoodbyeDPILauncher
{
    public class DiagnosticTools
    {
        // Singleton HttpClient instance to avoid socket exhaustion
        private static readonly HttpClient _client;

        static DiagnosticTools()
        {
            var handler = new HttpClientHandler
            {
                // DPI filters can sometimes trigger certificate chain validation issues, bypass to measure actual connection latency
                ServerCertificateCustomValidationCallback = (sender, cert, chain, sslPolicyErrors) => true,
                AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate
            };

            _client = new HttpClient(handler)
            {
                Timeout = TimeSpan.FromMilliseconds(3500)
            };

            // Set user agent to resemble standard web browser
            _client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        }

        /// <summary>
        /// Asynchronously performs a web request to test reachability and latency.
        /// Her çağrıda yeni bir HttpClient kullanır — bypass aktifken eski
        /// keepalive bağlantılarının sonucu yanıltmaması için.
        /// </summary>
        public async Task<TestResult> TestUrlAsync(string url)
        {
            // Yeni handler + client — cached TCP bağlantısı bypass'ı atlatmasın
            var handler = new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback = (s, c, ch, e) => true,
                AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate,
                AllowAutoRedirect = true,
                MaxAutomaticRedirections = 3
            };

            var sw = Stopwatch.StartNew();
            try
            {
                ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;

                using (var client = new HttpClient(handler) { Timeout = TimeSpan.FromMilliseconds(5000) })
                {
                    client.DefaultRequestHeaders.Add("User-Agent",
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36");

                    var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
                    sw.Stop();

                    // 2xx, 3xx veya 4xx → sunucuya ulaşıldı (DPI bypass başarılı)
                    // Sadece bağlantı hatası (SocketException, timeout) → başarısız
                    bool ok = (int)response.StatusCode < 500;
                    return new TestResult(ok, sw.ElapsedMilliseconds);
                }
            }
            catch (TaskCanceledException)  // timeout
            {
                sw.Stop();
                return new TestResult(false, 0);
            }
            catch (HttpRequestException ex)
            {
                sw.Stop();
                // Eğer iç exception bir WebException ve response varsa → ulaşıldı
                var web = ex.InnerException as WebException;
                if (web != null && web.Response != null)
                    return new TestResult(true, sw.ElapsedMilliseconds);
                return new TestResult(false, 0);
            }
            catch (Exception)
            {
                sw.Stop();
                return new TestResult(false, 0);
            }
            finally
            {
                handler.Dispose();
            }
        }
    }

    public class TestResult
    {
        public bool Success { get; private set; }
        public long Latency { get; private set; }

        public TestResult(bool success, long latency)
        {
            Success = success;
            Latency = latency;
        }
    }
}
