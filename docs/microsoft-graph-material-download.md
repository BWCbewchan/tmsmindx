# Microsoft Graph Material folder download

TPS can download a SharePoint/OneDrive folder Material by reading the folder through Microsoft Graph and returning a ZIP file.

## Required environment variables

Add these variables to `.env` or your deployment secrets:

```env
MICROSOFT_TENANT_ID=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
```

Restart the Next.js server after changing environment variables.

## Azure app permissions

The Azure app used by `MICROSOFT_CLIENT_ID` needs Microsoft Graph application permissions that can read the target SharePoint/OneDrive content.

Recommended options:

- `Sites.Selected` with explicit access granted to the target site/drive.
- Or `Files.Read.All` / `Sites.Read.All` if your tenant policy allows broader read access.

After adding permissions, an admin must grant admin consent.

## Link format supported

The current implementation supports SharePoint personal OneDrive folder links such as:

```text
https://<tenant>-my.sharepoint.com/:f:/r/personal/<user_slug>/Documents/...
```

When the link points to a folder, TPS lists its children, downloads files recursively, and returns a `.zip`.

## Safety limits

- Maximum files per ZIP: `200`
- Maximum source size per ZIP: `300MB`
- Microsoft Graph request timeout: `30s`

