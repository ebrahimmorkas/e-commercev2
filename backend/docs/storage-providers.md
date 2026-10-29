# Storage providers

Images, videos and files (email attachments, etc.) are stored through a pluggable
provider. Supported providers:

| Provider     | Value        | Images | Videos | Files | Account needed |
|--------------|--------------|--------|--------|-------|----------------|
| Cloudinary   | `cloudinary` | yes    | yes    | yes   | yes            |
| Amazon S3    | `aws`        | yes    | yes    | yes   | yes            |
| Cloudflare R2| `r2`         | yes    | yes    | yes   | yes            |
| ImageKit     | `imagekit`   | yes    | yes    | yes   | yes            |
| Local disk   | `local`      | yes    | yes    | yes   | no             |

## Which provider and which account an upload uses

Each area (image / video / file) has its own provider choice:

- `CompanyMaster.imageService` / `videoService` / `fileService` - the vendor's provider.
- `WebsiteMaster.mainImageService` / `mainVideoService` / `mainFileService` - the
  website default, used instead when `enforceMain<Area>Service` is on or the
  vendor has none for that area.

If the provider in use is the vendor's own choice, the upload goes to the
**vendor's own account** (`CompanyMaster.storageCredentials.<area>.<provider>`,
secrets encrypted). If that account has not been saved, the upload is refused
with a message - there is no silent fallback. Otherwise it goes to the
**platform's account** from `.env` (`config/storageProviderConfig.js`).

Every `ImageAsset` / `VideoAsset` / `FileAsset` records `provider`, `url`, `key`
(what the provider needs to delete the file) and `storageAccount` (which
account holds it), so deletes and replaces always use the right account. All of
it is in `services/storageCredentialsService.js`.

Code layout:

- adapters: `services/providers/<provider>Provider.js` (images, and files where
  the same adapter fits), `<provider>VideoProvider.js`, `cloudinaryFileProvider.js`
- factories: `providerFactory.js` (images), `videoProviderFactory.js`, `fileProviderFactory.js`
- per-provider credential fields: `PROVIDER_CREDENTIAL_FIELDS` in `constants/storageConstants.js`
- credential validation: `middlewares/validations/storageCredentialsValidations.js`

## ImageKit

Uses the official SDK, `@imagekit/nodejs`.

### Credentials

From the ImageKit dashboard -> **Developer options**:

| Field         | Example                                   | Stored          |
|---------------|-------------------------------------------|-----------------|
| `urlEndpoint` | `https://ik.imagekit.io/your_imagekit_id` | plain           |
| `privateKey`  | `private_...`                             | encrypted       |

The public key is **not** needed: it is only for uploads made straight from the
browser, and this app always uploads from the server. `urlEndpoint` may be a
custom domain you added in ImageKit - file URLs are built from it.

**Platform account** (`.env`):

```
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_imagekit_id
IMAGEKIT_PRIVATE_KEY=private_...
```

**A vendor's own account** - per vendor and per area, so every vendor (and
even each of a vendor's areas) can use a different ImageKit account:

1. Copy `seeds/storageCredentials.example.json` to
   `seeds/private/storageCredentials.json` (git-ignored) and keep only the
   areas/providers you want to set, e.g.

   ```json
   {
       "image": {
           "imagekit": {
               "accountEmail": "owner@gmail.com",
               "notes": "Free plan",
               "urlEndpoint": "https://ik.imagekit.io/your_imagekit_id",
               "privateKey": "private_..."
           }
       }
   }
   ```

2. Make sure `CREDENTIALS_ENCRYPTION_KEY` is the same key the server runs with.
3. Run `node scripts/manageVendorStorageCredentials.js set <vendor-domain>`
   (or `seeds/seedCompanyMaster.js` for mouldmarket.in), then delete the file.
4. Set the vendor's `imageService` / `videoService` / `fileService` to
   `imagekit` (or the website's `main*Service` for the platform account).

`node scripts/manageVendorStorageCredentials.js view <vendor-domain>` shows
which account each area uses. No restart is needed - credentials are read from
the DB on every upload.

### How files are stored

- Folder: `/<vendorId>/<module>`.
- File name: the original name (characters ImageKit doesn't allow become `_`)
  with ImageKit's unique suffix, so uploads never overwrite each other.
- `key` = the ImageKit **fileId** (ImageKit deletes by fileId only).
- `url` = `<urlEndpoint>/<filePath>`.
- `storageAccount` = `imagekit:<urlEndpoint without https://>`, e.g.
  `imagekit:ik.imagekit.io/your_imagekit_id`. Changing a saved account's
  `urlEndpoint` (e.g. to a custom domain) means files uploaded before the change
  no longer match it: deleting them leaves the file in ImageKit (logged as a
  warning) instead of failing.
- Images and files share one adapter (ImageKit keeps every file byte-for-byte);
  videos are streamed from the upload's temp file instead of read into memory.
- Deleting a file that is already gone from ImageKit counts as deleted.

### Size limits

ImageKit's maximum upload size depends on your plan (the free plan is lower
than the paid ones) and it has no chunked upload, so a video goes up in a single
request. Set `WebsiteMaster.maxVideoSize` (or the vendor's
`CompanyMaster.maxVideoSize`) and the image/file size limits to **no more than
your ImageKit plan's limit**, so an oversized upload is refused with a clear
message before it is sent. Anything bigger that still reaches ImageKit is
rejected by ImageKit and the upload fails. When you change plans, just change
those limits - no code change is needed.

### Invoices

`services/invoicePdfService.js` fetches the logo and product images on
`ik.imagekit.io` as a resized JPG (`?tr=f-jpg,w-<width>`), because the PDF
library only embeds PNG/JPEG. Images on a custom ImageKit domain are fetched as
stored.
