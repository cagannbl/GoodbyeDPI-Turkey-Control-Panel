using System;
using System.Diagnostics;
using System.Text;
using System.Threading.Tasks;

namespace GoodbyeDPILauncher
{
    public class CommandExecutor
    {
        /// <summary>
        /// Runs a program asynchronously and safely returns its combined standard output and error stream.
        /// </summary>
        public async Task<string> RunCommandAsync(string fileName, string[] arguments)
        {
            var tcs = new TaskCompletionSource<string>();

            try
            {
                string escapedArgs = EscapeArguments(arguments);
                var psi = new ProcessStartInfo
                {
                    FileName = fileName,
                    Arguments = escapedArgs,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                };

                var process = new Process { StartInfo = psi };
                process.EnableRaisingEvents = true;

                process.Exited += async (sender, e) =>
                {
                    try
                    {
                        string output = await process.StandardOutput.ReadToEndAsync();
                        string error = await process.StandardError.ReadToEndAsync();
                        process.Dispose();
                        tcs.TrySetResult(output + "\n" + error);
                    }
                    catch (Exception ex)
                    {
                        tcs.TrySetException(ex);
                    }
                };

                if (!process.Start())
                {
                    tcs.TrySetResult("Hata: Süreç başlatılamadı.");
                }
            }
            catch (Exception ex)
            {
                tcs.TrySetResult("Komut çalıştırma hatası: " + ex.Message);
            }

            return await tcs.Task;
        }

        /// <summary>
        /// Safely escapes command line arguments to prevent command injection under Windows.
        /// </summary>
        public static string EscapeArguments(params string[] args)
        {
            if (args == null || args.Length == 0) return string.Empty;

            StringBuilder sb = new StringBuilder();
            foreach (var arg in args)
            {
                if (sb.Length > 0) sb.Append(" ");

                if (string.IsNullOrEmpty(arg))
                {
                    sb.Append("\"\"");
                    continue;
                }

                // If argument contains no spaces, tabs, or double quotes, it doesn't need quote protection
                if (arg.IndexOfAny(new[] { ' ', '\t', '\"' }) == -1)
                {
                    sb.Append(arg);
                    continue;
                }

                sb.Append("\"");
                for (int i = 0; i < arg.Length; i++)
                {
                    char c = arg[i];
                    if (c == '\\')
                    {
                        int backslashes = 1;
                        while (i + 1 < arg.Length && arg[i + 1] == '\\')
                        {
                            backslashes++;
                            i++;
                        }

                        if (i + 1 == arg.Length)
                        {
                            sb.Append('\\', backslashes * 2);
                        }
                        else if (arg[i + 1] == '\"')
                        {
                            sb.Append('\\', backslashes * 2 + 1);
                        }
                        else
                        {
                            sb.Append('\\', backslashes);
                        }
                    }
                    else if (c == '\"')
                    {
                        sb.Append("\\\"");
                    }
                    else
                    {
                        sb.Append(c);
                    }
                }
                sb.Append("\"");
            }
            return sb.ToString();
        }
    }
}
