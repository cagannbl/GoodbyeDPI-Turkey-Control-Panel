using System.Text.Json.Serialization;

namespace GoodbyeDPI.Core.Models
{
    public class BypassProfile
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("arguments")]
        public string Arguments { get; set; } = string.Empty;

        [JsonPropertyName("isCustom")]
        public bool IsCustom { get; set; }

        [JsonPropertyName("sha256Signature")]
        public string Sha256Signature { get; set; } = string.Empty;
    }
}
