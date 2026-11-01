# @cuelingo/ui

Component React và design token dùng chung cho desktop và web.

```tsx
import '@cuelingo/ui/globals.css';
import { Button } from '@cuelingo/ui/components/button';
import { CaptionLine } from '@cuelingo/ui/components/caption-line';
```

Các export hiện có: `Button`, `Input`, nhóm `Card`, `CaptionLine` và `cn`.

```bash
pnpm --filter @cuelingo/ui typecheck
pnpm --filter @cuelingo/ui build:css
```

Thiết kế: [apps/docs/docs/04-modules/05-packages/ui.md](../../apps/docs/docs/04-modules/05-packages/ui.md)
