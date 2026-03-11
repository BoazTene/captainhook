# CaptainHook Frontend

This is the frontend dashboard for CaptainHook.
It shows a calendar, daily tasks, and lets you open full session details in a modal.
You can also mark tasks as done.

## Local HTTPS

Web push on Android requires the frontend to be served from a secure origin.

1. Start the backend normally on port `8000`.
2. Start the frontend with HTTPS:

```bash
npm run dev:https
```

Or, to use the generated local certificate in `frontend/certs/`:

```bash
npm run dev:https:cert
```

3. Open the frontend from your phone using `https://<your-computer-lan-ip>:3000`.

Notes:
- The frontend proxies API requests server-side, so the backend can stay on `http://localhost:8000` during local development.
- `dev:https` uses Next.js's self-signed development certificate.
- `dev:https:cert` uses the generated files `certs/dev.crt` and `certs/dev.key`.
- On Android, you may need to accept the browser warning before the page loads.
- If service workers or push still fail on the phone, use a trusted certificate instead of the generated self-signed one. Next.js supports this with:

```bash
npm run dev:https -- --experimental-https-key /path/to/key.pem --experimental-https-cert /path/to/cert.pem
```

## ngrok Tunnel

For Android push testing, `ngrok` is the simpler option because the phone already trusts the tunnel's HTTPS certificate.

1. Start the backend:

```bash
cd /home/boaz/Documents/captainhook/backend
python main.py
```

2. Start the frontend:

```bash
cd /home/boaz/Documents/captainhook/frontend
npm run dev
```

3. Export your ngrok authtoken:

```bash
export NGROK_AUTHTOKEN=your_token_here
```

4. Start the tunnel:

```bash
cd /home/boaz/Documents/captainhook/frontend
npm run tunnel:ngrok
```

5. Open the `https://...ngrok...` URL on your Android phone.

Notes:
- The tunnel only needs to expose the frontend on port `3000`.
- Next.js API routes continue talking to the backend locally on `http://localhost:8000`.
- The local `ngrok` binary is installed under `.tools/ngrok/` and is ignored by git.
- If you want a different frontend port, set `PORT` before starting both the Next.js dev server and the tunnel.
