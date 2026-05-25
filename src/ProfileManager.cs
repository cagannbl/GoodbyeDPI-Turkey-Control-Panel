using System;
using System.IO;
using System.Collections.Generic;
using System.Text;
using System.Net.Http;
using System.Threading.Tasks;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Encodings.Web;

namespace GoodbyeDPILauncher
{
    /// <summary>
    /// Engel aşma profillerini temsil eden sınıf.
    /// </summary>
    public class BypassProfile
    {
        /// <summary>
        /// Profilin kullanıcı arayüzünde gösterilecek adı.
        /// </summary>
        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// GoodbyeDPI aracı için kullanılacak komut satırı argümanları.
        /// </summary>
        [JsonPropertyName("arguments")]
        public string Arguments { get; set; } = string.Empty;

        /// <summary>
        /// Sınıfın varsayılan yapıcı metodu.
        /// </summary>
        public BypassProfile() { }

        /// <summary>
        /// Belirtilen ad ve argümanlarla yeni bir profil örneği oluşturur.
        /// </summary>
        /// <param name="name">Profil adı.</param>
        /// <param name="arguments">Profil argümanları.</param>
        public BypassProfile(string name, string arguments)
        {
            Name = name;
            Arguments = arguments;
        }
    }

    /// <summary>
    /// Profil dosyalarının yüklenmesi, kaydedilmesi ve bulut ile senkronizasyon işlemlerini yöneten sınıf.
    /// </summary>
    public class ProfileManager
    {
        private readonly string _filePath;
        private readonly string _cloudUrl;

        /// <summary>
        /// Mevcut bypass profillerinin listesi.
        /// </summary>
        public List<BypassProfile> Profiles { get; private set; }

        /// <summary>
        /// Belirtilen dosya yolu ve bulut adresi ile bir profil yöneticisi örneği oluşturur.
        /// </summary>
        /// <param name="filePath">Yerel profil dosyasının yolu.</param>
        /// <param name="cloudUrl">Güncel profillerin çekileceği bulut URL'si.</param>
        public ProfileManager(string filePath, string cloudUrl = "https://raw.githubusercontent.com/cagans/goodbyedpi-turkey-presets/main/profiles.json")
        {
            _filePath = filePath;
            _cloudUrl = cloudUrl;
            Profiles = new List<BypassProfile>();
        }

        /// <summary>
        /// Yerel dosyadan profilleri yükler. Dosya yoksa veya geçersizse varsayılan profilleri yükler.
        /// </summary>
        public void LoadProfiles()
        {
            Profiles.Clear();
            if (File.Exists(_filePath))
            {
                try
                {
                    string content = File.ReadAllText(_filePath);
                    Profiles = ParseJson(content);
                }
                catch
                {
                    LoadDefaultProfiles();
                }
            }

            // Eğer liste boş kaldıysa varsayılan profilleri yükle ve yerel dosyaya kaydet.
            if (Profiles.Count == 0)
            {
                LoadDefaultProfiles();
                SaveProfiles();
            }
        }

        /// <summary>
        /// Uygulamanın varsayılan Türkiye preseti profillerini yükler.
        /// </summary>
        public void LoadDefaultProfiles()
        {
            Profiles.Clear();
            Profiles.Add(new BypassProfile("Varsayılan Türkiye (Genel) [-5 --set-ttl 5]", "-5 --set-ttl 5"));
            Profiles.Add(new BypassProfile("Superonline Alternatif 1 [--set-ttl 3]", "--set-ttl 3"));
            Profiles.Add(new BypassProfile("Superonline Alternatif 2 [-5]", "-5"));
            Profiles.Add(new BypassProfile("Superonline Alternatif 3 [--set-ttl 3 + DNS]", "--set-ttl 3"));
            Profiles.Add(new BypassProfile("Superonline Alternatif 4 [-5 + DNS]", "-5"));
            Profiles.Add(new BypassProfile("Superonline Alternatif 5 [-9 + DNS]", "-9"));
            Profiles.Add(new BypassProfile("Superonline Alternatif 6 [-9]", "-9"));
        }

        /// <summary>
        /// Mevcut profilleri yerel JSON dosyasına kaydeder.
        /// </summary>
        public void SaveProfiles()
        {
            try
            {
                string json = SerializeJson(Profiles);
                File.WriteAllText(_filePath, json, Encoding.UTF8);
            }
            catch
            {
                // Dosyaya yazma hatasını sessizce yut.
            }
        }

        /// <summary>
        /// Profilleri bulut üzerindeki JSON dosyasıyla senkronize eder.
        /// </summary>
        /// <returns>Senkronizasyon başarılı ise true, aksi takdirde false döner.</returns>
        public async Task<bool> SyncWithCloudAsync()
        {
            try
            {
                using (var client = new HttpClient())
                {
                    client.Timeout = TimeSpan.FromSeconds(5);
                    string content = await client.GetStringAsync(_cloudUrl);
                    var cloudProfiles = ParseJson(content);
                    
                    if (cloudProfiles != null && cloudProfiles.Count > 0)
                    {
                        Profiles = cloudProfiles;
                        SaveProfiles();
                        return true;
                    }
                }
            }
            catch
            {
                // Senkronizasyon hatalarını yut ve başarısız döndür.
            }
            return false;
        }

        /// <summary>
        /// Verilen JSON metnini ayrıştırarak profil listesine dönüştürür.
        /// </summary>
        /// <param name="json">Ayrıştırılacak JSON metni.</param>
        /// <returns>Ayrıştırılan bypass profilleri listesi. Hata durumunda boş liste döner.</returns>
        public static List<BypassProfile> ParseJson(string json)
        {
            var list = new List<BypassProfile>();
            if (string.IsNullOrWhiteSpace(json))
            {
                return list;
            }

            try
            {
                // Büyük-küçük harf duyarlılığını devre dışı bırakarak daha esnek eşleşme sağlıyoruz.
                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                var deserializedList = JsonSerializer.Deserialize<List<BypassProfile>>(json, options);
                if (deserializedList != null)
                {
                    foreach (var profile in deserializedList)
                    {
                        // Geçersiz veya eksik alanları olan profilleri dahil etmiyoruz.
                        if (profile != null && !string.IsNullOrEmpty(profile.Name) && profile.Arguments != null)
                        {
                            list.Add(profile);
                        }
                    }
                }
            }
            catch (JsonException)
            {
                // JSON biçimi geçersiz olduğunda boş liste döner.
            }
            catch (Exception)
            {
                // Olası diğer beklenmedik istisnaları ele al.
            }

            return list;
        }

        /// <summary>
        /// Profil listesini JSON biçimli bir metne dönüştürür.
        /// </summary>
        /// <param name="profiles">Serileştirilecek profil listesi.</param>
        /// <returns>JSON biçimindeki metin.</returns>
        public static string SerializeJson(List<BypassProfile> profiles)
        {
            if (profiles == null)
            {
                return "[]";
            }

            try
            {
                // Okunabilirliği artırmak için girintili yazdırıyoruz ve Türkçe karakterlerin kaçış karakterine dönüştürülmesini önlüyoruz.
                var options = new JsonSerializerOptions
                {
                    WriteIndented = true,
                    Encoder = JavaScriptEncoder.Unescaped
                };

                return JsonSerializer.Serialize(profiles, options);
            }
            catch (Exception)
            {
                return "[]";
            }
        }
    }
}
