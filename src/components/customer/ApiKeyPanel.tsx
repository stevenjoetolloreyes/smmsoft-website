"use client";

import { useActionState, useState , useEffect } from "react";
import { useRouter } from "next/navigation";
import { regenerateApiKeyAction } from "@/lib/actions-customer";
import { emptyActionState } from "@/lib/action-state";
import { Check, Copy, Eye, EyeOff, KeyRound, RotateCw, Send } from "lucide-react";

export default function ApiKeyPanel({
  apiKey,
  createdAt,
  baseUrl,
}: {
  apiKey: string;
  createdAt: string;
  baseUrl: string;
}) {
  const [state, action, isPending] = useActionState(regenerateApiKeyAction, emptyActionState);
  const router = useRouter();
  useEffect(() => { if (state.ok) router.refresh(); }, [state, router]);
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = apiKey;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* clipboard unavailable */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const curlExample = `curl -X POST ${baseUrl}/api/send \\
  -d "apikey=${apiKey}" \\
  -d "number=09171234567" \\
  -d "message=Hello from SMMSOFT API"`;

  return (
    <>
      <div className="panel">
        <h2>
          <KeyRound aria-hidden="true" /> Your API Key
        </h2>
        {state.message !== "" && (
          <div className={`flash ${state.ok ? "ok" : "err"}`}>{state.message}</div>
        )}
        <div className="tablewrap">
          <table>
            <tbody>
              <tr>
                <th>Name</th>
                <th>API Key</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
              <tr>
                <td>Default key</td>
                <td className="mono">{shown ? apiKey : `${apiKey.slice(0, 8)}••••••••••••••••••••••••`}</td>
                <td>{createdAt}</td>
                <td>
                  <div className="rowflex">
                    <button className="btn small ghost" type="button" onClick={() => setShown(!shown)}>
                      {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />} {shown ? "Hide" : "Show"}
                    </button>
                    <button className="btn small ghost" type="button" onClick={copyKey}>
                      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? "Copied" : "Copy"}
                    </button>
                    <form
                      action={action}
                      style={{ display: "inline" }}
                      onSubmit={(e) => {
                        if (!window.confirm("Generate a new key? The old one stops working immediately.")) e.preventDefault();
                      }}
                    >
                      <button className="btn small danger" type="submit" disabled={isPending}>
                        <RotateCw aria-hidden="true" /> Regenerate
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="hint">Keep this key secret — anyone with it can send SMS using your credits.</p>
      </div>

      <div className="panel">
        <h2>
          <Send aria-hidden="true" /> Send an SMS
        </h2>
        <p className="hint">
          POST to <span className="mono">{baseUrl}/api/send</span> with these fields (form-encoded or JSON):
        </p>
        <table>
          <tbody>
            <tr>
              <th>Field</th>
              <th>Required</th>
              <th>Notes</th>
            </tr>
            <tr>
              <td className="mono">apikey</td>
              <td>Yes</td>
              <td>
                Your API key above (or send header <span className="mono">X-Api-Key</span>)
              </td>
            </tr>
            <tr>
              <td className="mono">number</td>
              <td>Yes</td>
              <td>One PH number, or many separated by commas (max 1,000 per call)</td>
            </tr>
            <tr>
              <td className="mono">message</td>
              <td>Yes</td>
              <td>Your text. Long messages are split into parts; each part costs credits.</td>
            </tr>
            <tr>
              <td className="mono">kind</td>
              <td>No</td>
              <td>
                <span className="mono">regular</span> (default), <span className="mono">priority</span>, or{" "}
                <span className="mono">otp</span>
              </td>
            </tr>
            <tr>
              <td className="mono">sender</td>
              <td>No</td>
              <td>
                A sender name from the approved pool — GET <span className="mono">/api/account</span> lists the pool. Omit to
                use the pool default; unknown names are rejected.
              </td>
            </tr>
            <tr>
              <td className="mono">otp_code</td>
              <td>No</td>
              <td>
                For kind=otp: your own code; replaces {"{otp}"} in the message. Omit to auto-generate.
              </td>
            </tr>
          </tbody>
        </table>
        <label>Example (cURL)</label>
        <textarea rows={6} readOnly className="mono" value={curlExample} />
        <label>Success response</label>
        <textarea rows={4} readOnly className="mono" value='{"ok":true,"sent":1,"cost":1,"balance":99,"sender":"SMMSOFT","message_ids":[12345]}' />
        <label>Check your balance</label>
        <textarea rows={2} readOnly className="mono" value={`GET ${baseUrl}/api/account?apikey=YOUR_KEY`} />
        <p className="hint">
          Errors return JSON like <span className="mono">{"{"}"ok":false,"error":"Insufficient credits...{"}"}</span> with an HTTP
          status code.
        </p>
      </div>
    </>
  );
}
