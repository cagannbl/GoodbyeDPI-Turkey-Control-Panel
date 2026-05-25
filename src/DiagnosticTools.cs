using System;
using System.Diagnostics;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;

namespace GoodbyeDPILauncher
{
    public class DiagnosticTools
    {
        // Soket tükenmesini önlemek için statik HttpClient örneği
        private static readonly HttpClient _client;

        static DiagnosticTools()
        {
            var handler = new HttpClientHandler
            {
                // Sertifika zinciri doğrulama hatalarını yoksay
                ServerCertificateCustomValidationCallback = (sender, cert, chain, sslPolicyErrors) => true,
                AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate
            };

            _client = new HttpClient(handler)
            {
                Timeout = TimeSpan.FromMilliseconds(3500)
            };

            // Standart tarayıcı User-Agent bilgisi tanımla
            _client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        }

        /// <summary>
        /// Erişilebilirliği ve gecikme süresini test etmek için asenkron bir web isteği gerçekleştirir.
        /// Bypass aktifken eski keepalive bağlantılarının sonucu yanıltmaması için her çağrıda yeni HttpClient kullanılır.
        /// </summary>
        public async Task<TestResult> TestUrlAsync(string url)
        {
            // Önbelleğe alınmış TCP bağlantılarının bypass mekanizmasını atlatmasını önlemek için yeni handler ve istemci
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

                    // 2xx, 3xx veya 4xx -> sunucuya ulaşıldı (DPI bypass başarılı)
                    // Sadece bağlantı hatası (SocketException, zaman aşımı) -> başarısız
                    bool ok = (int)response.StatusCode < 500;
                    return new TestResult(ok, sw.ElapsedMilliseconds);
                }
            }
            catch (TaskCanceledException)  // Zaman aşımı
            {
                sw.Stop();
                return new TestResult(false, 0);
            }
            catch (HttpRequestException ex)
            {
                sw.Stop();
                // İç hata WebException ise ve yanıt varsa sunucuya ulaşılmıştır
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
