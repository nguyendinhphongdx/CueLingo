# Expected code signatures

`app.requirement` and `sidecar.requirement` hold the designated requirement that a release build signed with the
fixed CueLingo certificate must have. They do not exist until the certificate does:

```bash
node scripts/signing-requirements.mjs "<SHA-1 of the certificate>"   # from apps/desktop
```

The release workflow compares them with `codesign -d -r-` of the built app and sidecar. Without the signing secrets
the build is ad-hoc and this check is skipped (ADR 0023).
