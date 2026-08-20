import { NextResponse } from 'next/server'
import { execFile } from 'node:child_process'
import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Impression DIRECTE d'un ZPL vers une imprimante Windows (spouleur, mode RAW).
//
// Le navigateur ne peut pas envoyer de données brutes à une imprimante ; cette
// route serveur le fait à sa place. Elle ne fonctionne que là où l'app tourne sur
// la MÊME machine que l'imprimante (poste local, localhost) — pas sur un
// hébergement distant, ce qui est exactement le cas d'usage de l'étiquetage.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const psEscape = (s: string) => s.replace(/'/g, "''")

// Script PowerShell : RawPrinter en C# (winspool) envoyant des octets bruts (RAW).
// Le spouleur ne ré-interprète rien → le ZPL arrive tel quel à la Zebra. Le nom
// d'imprimante et le fichier sont injectés en littéraux (échappés) — pas d'arguments
// positionnels, pour éviter tout aléa de binding avec -EncodedCommand.
function buildScript(printer: string, file: string): string {
  return `
$ErrorActionPreference = 'Stop'
$Printer = '${psEscape(printer)}'
$File = '${psEscape(file)}'
$src = @'
using System;
using System.Runtime.InteropServices;
public static class RP {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DI { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool OpenPrinter(string s, out IntPtr h, IntPtr d);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool StartDocPrinter(IntPtr h, int l, [In] DI di);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr h, IntPtr b, int n, out int w);
  public static string Send(string printer, byte[] bytes) {
    IntPtr h;
    if(!OpenPrinter(printer, out h, IntPtr.Zero)) return "ERR_OPEN " + Marshal.GetLastWin32Error();
    var di = new DI(); di.pDocName = "Etiquette bon (ZPL)"; di.pDataType = "RAW";
    string res = "ERR_STARTDOC";
    if(StartDocPrinter(h, 1, di)) {
      if(StartPagePrinter(h)) {
        IntPtr p = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, p, bytes.Length);
        int w; bool ok = WritePrinter(h, p, bytes.Length, out w);
        Marshal.FreeCoTaskMem(p);
        EndPagePrinter(h);
        res = ok ? "OK" : "ERR_WRITE";
      }
      EndDocPrinter(h);
    }
    ClosePrinter(h);
    return res;
  }
}
'@
Add-Type -TypeDefinition $src -Language CSharp
$bytes = [System.IO.File]::ReadAllBytes($File)
$r = [RP]::Send($Printer, $bytes)
Write-Output $r
if ($r -ne 'OK') { exit 1 }
`
}

function run(printer: string, file: string): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    const b64 = Buffer.from(buildScript(printer, file), 'utf16le').toString('base64')
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', b64],
      { timeout: 15000, windowsHide: true },
      (err, stdout, stderr) => {
        const out = `${stdout || ''}${stderr || ''}`.trim()
        resolve({ ok: !err && /(^|\W)OK(\W|$)/.test(out), out })
      }
    )
  })
}

export async function POST(req: Request) {
  if (process.platform !== 'win32') {
    return NextResponse.json({ ok: false, error: 'os', message: "L'impression directe ZPL n'est disponible que sur le poste Windows local." }, { status: 400 })
  }
  let body: { zpl?: string; printer?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'json' }, { status: 400 }) }
  const zpl = (body.zpl ?? '').trim()
  const printer = (body.printer ?? '').trim()
  if (!zpl || !printer) return NextResponse.json({ ok: false, error: 'params', message: 'zpl et printer sont requis.' }, { status: 400 })
  if (!zpl.includes('^XA')) return NextResponse.json({ ok: false, error: 'zpl', message: 'Contenu ZPL invalide.' }, { status: 400 })

  const file = join(tmpdir(), `dp-zpl-${Date.now()}-${Math.floor(Math.random() * 1e6)}.zpl`)
  try {
    await writeFile(file, zpl, 'utf8')
    const { ok, out } = await run(printer, file)
    if (!ok) return NextResponse.json({ ok: false, error: 'print', message: out || "Échec de l'envoi à l'imprimante." }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'exec', message: e instanceof Error ? e.message : String(e) }, { status: 500 })
  } finally {
    try { await unlink(file) } catch { /* ignore */ }
  }
}
