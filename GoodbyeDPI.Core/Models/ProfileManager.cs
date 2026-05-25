using System;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using System.Security.Cryptography;

namespace GoodbyeDPI.Core.Models
{
    public class ProfileManager
    {
        private readonly string _filePath;
        private readonly string _cloudUrl;
        private readonly string _publicKeyXml;

        public List<BypassProfile> Profiles { get; private set; }

        public ProfileManager(string filePath, string cloudUrl = "https://raw.githubusercontent.com/cagans/goodbyedpi-turkey-presets/main/profiles.json", string? publicKeyXml = null)
        {
            _filePath = filePath;
            _cloudUrl = cloudUrl;
            _publicKeyXml = publicKeyXml ?? "<RSAKeyValue><Modulus>sD...</Modulus><Exponent>AQAB</Exponent></RSAKeyValue>";
            Profiles = new List<BypassProfile>();
        }

        public void LoadProfiles()
        {
            Profiles.Clear();
            if (File.Exists(_filePath))
            {
                try
                {
                    string content = File.ReadAllText(_filePath);
                    var list = JsonSerializer.Deserialize<List<BypassProfile>>(content);
                    if (list != null)
                    {
                        Profiles = list;
                    }
                }
                catch
                {
                    LoadDefaultProfiles();
                }
            }

            if (Profiles.Count == 0)
            {
                LoadDefaultProfiles();
                SaveProfiles();
            }
        }

        public void LoadDefaultProfiles()
        {
            Profiles.Clear();
            Profiles.Add(new BypassProfile { Id = "preset_general", Name = "Varsayılan Türkiye (Genel) [-5 --set-ttl 5]", Arguments = "-5 --set-ttl 5", IsCustom = false });
            Profiles.Add(new BypassProfile { Id = "preset_so_alt1", Name = "Superonline Alternatif 1 [--set-ttl 3]", Arguments = "--set-ttl 3", IsCustom = false });
            Profiles.Add(new BypassProfile { Id = "preset_so_alt2", Name = "Superonline Alternatif 2 [-5]", Arguments = "-5", IsCustom = false });
            Profiles.Add(new BypassProfile { Id = "preset_so_alt3", Name = "Superonline Alternatif 3 [--set-ttl 3 + DNS]", Arguments = "--set-ttl 3", IsCustom = false });
            Profiles.Add(new BypassProfile { Id = "preset_so_alt4", Name = "Superonline Alternatif 4 [-5 + DNS]", Arguments = "-5", IsCustom = false });
            Profiles.Add(new BypassProfile { Id = "preset_so_alt5", Name = "Superonline Alternatif 5 [-9 + DNS]", Arguments = "-9", IsCustom = false });
            Profiles.Add(new BypassProfile { Id = "preset_so_alt6", Name = "Superonline Alternatif 6 [-9]", Arguments = "-9", IsCustom = false });
        }

        public void SaveProfiles()
        {
            try
            {
                var options = new JsonSerializerOptions { WriteIndented = true };
                string json = JsonSerializer.Serialize(Profiles, options);
                File.WriteAllText(_filePath, json, Encoding.UTF8);
            }
            catch {}
        }

        public async Task<bool> SyncWithCloudAsync()
        {
            try
            {
                using (var client = new HttpClient())
                {
                    client.Timeout = TimeSpan.FromSeconds(5);
                    string content = await client.GetStringAsync(_cloudUrl);
                    
                    var cloudProfiles = JsonSerializer.Deserialize<List<BypassProfile>>(content);
                    if (cloudProfiles != null && cloudProfiles.Count > 0)
                    {
                        Profiles = cloudProfiles;
                        SaveProfiles();
                        return true;
                    }
                }
            }
            catch {}
            return false;
        }

        public bool VerifyProfileIntegrity(string jsonContent, string hexSignature)
        {
            try
            {
                byte[] data = Encoding.UTF8.GetBytes(jsonContent);
                using (var rsa = new RSACryptoServiceProvider())
                {
                    rsa.FromXmlString(_publicKeyXml);
                    byte[] signature = Convert.FromBase64String(hexSignature);
                    return rsa.VerifyData(data, CryptoConfig.MapNameToOID("SHA256")!, signature);
                }
            }
            catch
            {
                return false;
            }
        }
    }
}
