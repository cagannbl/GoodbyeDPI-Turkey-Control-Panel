using System;
using System.IO;
using System.Collections.Generic;
using System.Text;
using System.Net.Http;
using System.Threading.Tasks;

namespace GoodbyeDPILauncher
{
    public class BypassProfile
    {
        public string Name { get; set; }
        public string Arguments { get; set; }

        public BypassProfile() { }
        public BypassProfile(string name, string arguments)
        {
            Name = name;
            Arguments = arguments;
        }
    }

    public class ProfileManager
    {
        private readonly string _filePath;
        private readonly string _cloudUrl;

        public List<BypassProfile> Profiles { get; private set; }

        public ProfileManager(string filePath, string cloudUrl = "https://raw.githubusercontent.com/cagans/goodbyedpi-turkey-presets/main/profiles.json")
        {
            _filePath = filePath;
            _cloudUrl = cloudUrl;
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
                    Profiles = ParseJson(content);
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
            Profiles.Add(new BypassProfile("Varsayılan Türkiye (Genel) [-5 --set-ttl 5]", "-5 --set-ttl 5"));
            Profiles.Add(new BypassProfile("Superonline Alternatif 1 [--set-ttl 3]", "--set-ttl 3"));
            Profiles.Add(new BypassProfile("Superonline Alternatif 2 [-5]", "-5"));
            Profiles.Add(new BypassProfile("Superonline Alternatif 3 [--set-ttl 3 + DNS]", "--set-ttl 3"));
            Profiles.Add(new BypassProfile("Superonline Alternatif 4 [-5 + DNS]", "-5"));
            Profiles.Add(new BypassProfile("Superonline Alternatif 5 [-9 + DNS]", "-9"));
            Profiles.Add(new BypassProfile("Superonline Alternatif 6 [-9]", "-9"));
        }

        public void SaveProfiles()
        {
            try
            {
                string json = SerializeJson(Profiles);
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
                    var cloudProfiles = ParseJson(content);
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

        public static List<BypassProfile> ParseJson(string json)
        {
            var list = new List<BypassProfile>();
            if (string.IsNullOrEmpty(json)) return list;

            try
            {
                int index = 0;
                while (true)
                {
                    index = json.IndexOf("{", index);
                    if (index == -1) break;

                    int end = json.IndexOf("}", index);
                    if (end == -1) break;

                    string objStr = json.Substring(index, end - index + 1);
                    string name = ExtractValue(objStr, "name");
                    string args = ExtractValue(objStr, "arguments");

                    if (name != null && args != null)
                    {
                        list.Add(new BypassProfile(name, args));
                    }
                    index = end + 1;
                }
            }
            catch {}
            return list;
        }

        private static string ExtractValue(string json, string key)
        {
            string keyPattern = "\"" + key + "\":";
            int idx = json.IndexOf(keyPattern);
            if (idx == -1) return null;

            int valStart = json.IndexOf("\"", idx + keyPattern.Length);
            if (valStart == -1) return null;

            int valEnd = json.IndexOf("\"", valStart + 1);
            if (valEnd == -1) return null;

            return json.Substring(valStart + 1, valEnd - valStart - 1)
                       .Replace("\\\"", "\"")
                       .Replace("\\\\", "\\");
        }

        public static string SerializeJson(List<BypassProfile> profiles)
        {
            StringBuilder sb = new StringBuilder();
            sb.AppendLine("[");
            for (int i = 0; i < profiles.Count; i++)
            {
                var p = profiles[i];
                sb.AppendLine("  {");
                sb.AppendFormat("    \"name\": \"{0}\",\n", p.Name.Replace("\\", "\\\\").Replace("\"", "\\\""));
                sb.AppendFormat("    \"arguments\": \"{0}\"\n", p.Arguments.Replace("\\", "\\\\").Replace("\"", "\\\""));
                sb.Append("  }");
                if (i < profiles.Count - 1) sb.AppendLine(",");
                else sb.AppendLine();
            }
            sb.AppendLine("]");
            return sb.ToString();
        }
    }
}
