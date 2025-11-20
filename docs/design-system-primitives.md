# Design System Primitives – Usage Notes

This note captures the current state of the core primitives under
`src/components/design-system`. Use it as a quick reference while we build out
full Storybook coverage.

## Theme + Tokens

- Light/dark palettes live in `src/styles/design-system.css`.
- Prefer the CSS variables exposed there (`--ds-*`) instead of ad-hoc colors.
- New components already consume those tokens; when composing custom UI embed
  classes like `bg-[color:var(--ds-surface-muted)]`.

## Import Path

```ts
import {
  DesignButton,
  DesignCheckbox,
  DesignFormField,
  DesignInput,
  DesignRadioCard,
  DesignRadioGroup,
  DesignSwitch,
  DesignTable,
  DesignTableBody,
  DesignTableCell,
  DesignTableHead,
  DesignTableHeader,
  DesignTableRow,
  DesignTableWrapper,
  DesignTextarea,
  FilterChip,
  MediaCard,
  SegmentedControl,
  SegmentedControlItem,
  Surface,
  SurfaceCard,
  SurfaceMuted,
  SurfaceElevated,
  SurfacePopover,
  StatusPill,
} from "@/components/design-system";
```

The `index.ts` barrel exposes the primitives we want reused across Admin,
Partner, and Staff experiences.

## Component Guidelines

### Surface family

- `Surface`, `SurfaceCard`, `SurfaceMuted`, `SurfaceElevated`, `SurfacePopover`
  wrap content with consistent rounded corners and border/shadow treatments.
- Pick variants based on elevation requirements; avoid stacking multiple
  surfaces unless you need nested elevation.

### Buttons

- `DesignButton` supports `variant` (`primary`, `secondary`, `tonal`, `ghost`,
  `outline`, `destructive`) and `size` (`sm`, `md`, `lg`, `icon`).
- Use `asChild` when you need the button semantics applied to a link.

### Form inputs

- Wrap inputs with `DesignFormField` to get consistent label, helper text, and
  error rendering. Use `layout="horizontal"` when aligning labels in two-column
  forms.
- `DesignInput` handles optional `leadingIcon` / `trailingIcon`.
- `DesignTextarea` supports `resize` (`none`, `vertical`, `both`).
- `DesignSwitch` and `DesignCheckbox` are Radix wrappers; they are already
  keyboard-accessible and themed.
- `DesignRadioGroup` + `DesignRadioCard` pair provides card-like radio options.
- `FilterChip` implements a pill toggle; use `selected` to indicate active
  state.
- `SegmentedControl` / `SegmentedControlItem` wrap the existing shadcn toggle
  group, ensuring the rail matches the palette.

### Data presentation

- `DesignTableWrapper` adds border + rounded corners; nest the rest of the table
  primitives inside:

  ```tsx
  <DesignTableWrapper>
    <DesignTable>
      <DesignTableHead>
        <tr>
          <DesignTableHeader>Deal</DesignTableHeader>
          <DesignTableHeader>Status</DesignTableHeader>
        </tr>
      </DesignTableHead>
      <DesignTableBody>
        <DesignTableRow clickable>
          <DesignTableCell>Black Friday Flash</DesignTableCell>
          <DesignTableCell>
            <StatusPill tone="success" label="Live" />
          </DesignTableCell>
        </DesignTableRow>
      </DesignTableBody>
    </DesignTable>
  </DesignTableWrapper>
  ```

- Set `clickable` on rows that open drawers. Use `selected` when a table row
  reflects an active selection.

### MediaCard

- Wrap partner/deal thumbnails with `MediaCard`. It accepts slots for `media`,
  `badge`, `overlay`, and `footer` so the same component works for list cards
  and summary panels.
- Keeps a consistent rounded rectangle (28px) and hover elevation.

### StatusPill

- Use `tone` to map to semantic outcomes: `neutral`, `success`, `warning`,
  `danger`, `info`.
- Avoid custom coloring in downstream components; if a new tone is required,
  update the component here.

## Migration Checklist

- Replace legacy shadcn components with design-system primitives incrementally.
- Ensure feature flags guard visual experiments when moving production surfaces.
- Verify TypeScript compatibility — primitives export prop types.
- Run `bun run lint` before sending PRs; lint will catch missing imports and
  unused variables.

## Next Steps

- Stand up Storybook stories for each primitive (+ design tokens page).
- Add interaction/unit tests (React Testing Library) once component API
  stabilizes.
- Document layout primitives (grid, cards) and typography scale if we introduce
  them.

