using System;
using System.Windows.Forms;
using Microsoft.Win32;

namespace GoodbyeDPILauncher
{
    public static class StartupHelper
    {
        private const string KeyName = "GoodbyeDPITurkey";

        /// <summary>
        /// Uygulamayı Windows başlangıç kayıt defteri (registry) yoluna kaydeder veya kaldırır.
        /// </summary>
        public static void SetStartup(bool enable)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true))
                {
                    if (key == null) return;
                    if (enable)
                    {
                        string appPath = string.Format("\"{0}\" -silent", Application.ExecutablePath);
                        key.SetValue(KeyName, appPath);
                    }
                    else
                    {
                        key.DeleteValue(KeyName, false);
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Başlangıç ayarı güncellenemedi: " + ex.Message, "Hata", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        /// <summary>
        /// Uygulamanın Windows başlangıcında otomatik olarak çalışacak şekilde ayarlanıp ayarlanmadığını kontrol eder.
        /// </summary>
        public static bool IsStartupEnabled()
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", false))
                {
                    return key != null && key.GetValue(KeyName) != null;
                }
            }
            catch
            {
                return false;
            }
        }
    }
}
