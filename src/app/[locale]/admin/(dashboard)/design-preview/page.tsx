"use client";

import {
  DesignButton,
  DesignFormField,
  DesignInput,
  DesignSelect,
  DesignSelectContent,
  DesignSelectItem,
  DesignSelectTrigger,
  DesignSelectValue,
  DesignTextarea,
  FilterChip,
  PageHeader,
  SectionCard,
  StatusPill,
  SurfaceCard,
  DesignDialog,
  DesignDialogBody,
  DesignDialogClose,
  DesignDialogContent,
  DesignDialogDescription,
  DesignDialogFooter,
  DesignDialogHeader,
  DesignDialogTitle,
  DesignDialogTrigger,
} from "@/components/design-system";
import {
  DesignTable,
  DesignTableBody,
  DesignTableCell,
  DesignTableHead,
  DesignTableHeader,
  DesignTableRow,
  DesignTableWrapper,
} from "@/components/design-system/data-table";
import { cn } from "@/lib/utils";

const TABLE_ROWS = [
  {
    product: "bad_Afrique",
    sku: "SKU #1031",
    price: "$153",
    size: "225 ml",
    date: "2023-1-1",
    status: { label: "Mexico | Error", tone: "danger" as const },
  },
  {
    product: "Seven Vales",
    sku: "SKU #1032",
    price: "$250",
    size: "225 ml",
    date: "2023-1-1",
    status: { label: "Not uploaded", tone: "warning" as const },
  },
  {
    product: "Rose on Land",
    sku: "SKU #1033",
    price: "$250",
    size: "225 ml",
    date: "2023-1-1",
    status: { label: "Uploaded", tone: "success" as const },
  },
  {
    product: "Copy of Copy of",
    sku: "SKU #1034",
    price: "$250",
    size: "225 ml",
    date: "2023-1-1",
    status: { label: "Mexico | Error", tone: "danger" as const },
  },
  {
    product: "Beautiful composition",
    sku: "SKU #1035",
    price: "$250",
    size: "225 ml",
    date: "2023-1-1",
    status: { label: "Uploaded", tone: "success" as const },
  },
  {
    product: "Black Friday Sale",
    sku: "SKU #1036",
    price: "$250",
    size: "225 ml",
    date: "2023-1-1",
    status: { label: "Mexico | Error", tone: "danger" as const },
  },
  {
    product: "Scarlett Skincare",
    sku: "SKU #1037",
    price: "$250",
    size: "225 ml",
    date: "2023-1-1",
    status: { label: "Uploaded", tone: "success" as const },
  },
  {
    product: "Strawberry Body Mist",
    sku: "SKU #1038",
    price: "$250",
    size: "225 ml",
    date: "2023-1-1",
    status: { label: "Uploaded", tone: "success" as const },
  },
  {
    product: "Customers who",
    sku: "SKU #1039",
    price: "$250",
    size: "225 ml",
    date: "2023-1-1",
    status: { label: "Mexico | Error", tone: "danger" as const },
  },
];

export default function AdminDesignPreviewPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Design kit"
        description="Reference implementations of the admin design system components."
      />

      <SectionCard
        title="Button variants"
        description="Primary actions, tonal actions, and ghost controls."
      >
        <div className="flex flex-wrap items-center gap-3">
          <DesignButton>Primary action</DesignButton>
          <DesignButton variant="secondary">Secondary</DesignButton>
          <DesignButton variant="tonal">Tonal</DesignButton>
          <DesignButton variant="ghost">Ghost</DesignButton>
          <DesignButton variant="outline">Outline</DesignButton>
          <DesignButton variant="destructive">Destructive</DesignButton>
          <DesignButton size="sm">Small</DesignButton>
          <DesignButton size="icon" aria-label="Icon button">
            <span>⤴︎</span>
          </DesignButton>
        </div>
      </SectionCard>

      <SectionCard
        title="Form controls"
        description="Inputs and selects used throughout configuration flows."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <DesignFormField
            label="Email address"
            helper="We’ll send the confirmation here."
            required
          >
            <DesignInput placeholder="name@example.com" type="email" />
          </DesignFormField>
          <DesignFormField
            label="Partner location"
            helper="Pick the venue you’re working with."
          >
            <DesignSelect defaultValue="prague">
              <DesignSelectTrigger>
                <DesignSelectValue placeholder="Select partner" />
              </DesignSelectTrigger>
              <DesignSelectContent>
                <DesignSelectItem value="prague">
                  Prague Lounge
                </DesignSelectItem>
                <DesignSelectItem value="vienna">
                  Vienna Terrace
                </DesignSelectItem>
                <DesignSelectItem value="berlin">Berlin Loft</DesignSelectItem>
              </DesignSelectContent>
            </DesignSelect>
          </DesignFormField>
          <DesignFormField
            label="Internal notes"
            className="md:col-span-2"
            helper="Visible to admins and partner managers only."
          >
            <DesignTextarea placeholder="Add context for your team…" rows={4} />
          </DesignFormField>
        </div>
      </SectionCard>

      <SectionCard
        title="Status tokens"
        description="Use status pills and filter chips for quick state indicators."
      >
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill tone="primary">Primary</StatusPill>
          <StatusPill tone="success">Success</StatusPill>
          <StatusPill tone="warning">Warning</StatusPill>
          <StatusPill tone="danger">Danger</StatusPill>
          <StatusPill>Neutral</StatusPill>
          <FilterChip>All deals</FilterChip>
          <FilterChip selected>Live now</FilterChip>
          <FilterChip leadingIcon={<span>★</span>}>Featured</FilterChip>
        </div>
      </SectionCard>

      <SectionCard
        title="Surfaces"
        description="Cards and elevated surfaces establish the soft, layered aesthetic."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SurfaceCard className="rounded-lg border border-border bg-card p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Surface card
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Use cards to group related inputs or data within a section.
            </p>
          </SurfaceCard>
          <SurfaceCard className="rounded-full border border-border bg-muted px-5 py-4">
            <p className="text-sm font-medium text-foreground">
              Capsule surface
            </p>
            <p className="text-xs text-muted-foreground">
              Capsule edges reinforce the soft, tactile layout.
            </p>
          </SurfaceCard>
          <SurfaceCard className="rounded-lg border border-border bg-muted p-6">
            <p className="text-sm font-medium text-foreground">
              Elevated modal
            </p>
            <p className="text-xs text-muted-foreground">
              Wrap draw-over experiences in rounded surfaces with generous
              padding.
            </p>
          </SurfaceCard>
        </div>
      </SectionCard>

      <SectionCard
        title="Modal / popover"
        description="Soft, elevated draw-over styled after the notification sheet in the reference."
      >
        <DesignDialog>
          <DesignDialogTrigger asChild>
            <DesignButton>Open notifications modal</DesignButton>
          </DesignDialogTrigger>
          <DesignDialogContent>
            <DesignDialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <DesignDialogTitle>Notifications</DesignDialogTitle>
                  <DesignDialogDescription>
                    Manage how your shoppers receive updates.
                  </DesignDialogDescription>
                </div>
                <DesignDialogClose asChild>
                  <DesignButton
                    variant="ghost"
                    size="icon"
                    aria-label="Close dialog"
                  >
                    ✕
                  </DesignButton>
                </DesignDialogClose>
              </div>
            </DesignDialogHeader>

            <DesignDialogBody className="space-y-4 pb-6 pt-4">
              <SurfaceCard className="flex items-center gap-3 rounded-lg border border-border bg-muted px-5 py-4">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    Push notifications
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Automatically send new notifications
                  </span>
                </div>
                <div className="ml-auto">
                  <FilterChip selected size="sm">
                    Enabled
                  </FilterChip>
                </div>
              </SurfaceCard>

              <div className="space-y-3">
                {[
                  "Denim Fabric Jacket",
                  "Beautiful composition",
                  "Strawberry Body Mist",
                  "Black Friday Sale",
                  "Customers who",
                ].map((item) => (
                  <SurfaceCard
                    key={item}
                    className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <SurfaceCard className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted text-xs text-muted-foreground">
                      Img
                    </SurfaceCard>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">
                        {item}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Size: M | Color: BW
                      </span>
                    </div>
                    <span className="ml-auto text-sm font-semibold text-foreground">
                      $45.90
                    </span>
                  </SurfaceCard>
                ))}
              </div>
            </DesignDialogBody>

            <DesignDialogFooter>
              <DesignButton className="h-12 w-full rounded-full">
                Connect store
              </DesignButton>
            </DesignDialogFooter>
          </DesignDialogContent>
        </DesignDialog>
      </SectionCard>

      <SectionCard
        title="Table pattern"
        description="Embed the design table primitives to present analytics and logs."
      >
        <SurfaceCard className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                Actions
              </h3>
              <p className="text-xs text-muted-foreground">
                Preview of the import list table.
              </p>
            </div>
            <DesignSelect defaultValue="all">
              <DesignSelectTrigger className="w-36">
                <DesignSelectValue placeholder="Select" />
              </DesignSelectTrigger>
              <DesignSelectContent>
                <DesignSelectItem value="all">All actions</DesignSelectItem>
                <DesignSelectItem value="active">Active</DesignSelectItem>
                <DesignSelectItem value="errors">Errors</DesignSelectItem>
              </DesignSelectContent>
            </DesignSelect>
          </div>

          <DesignTableWrapper className="bg-card p-0">
            <DesignTable>
              <DesignTableHead>
                <tr>
                  <DesignTableHeader />
                  <DesignTableHeader>Product name</DesignTableHeader>
                  <DesignTableHeader>Price</DesignTableHeader>
                  <DesignTableHeader>Size</DesignTableHeader>
                  <DesignTableHeader>Date</DesignTableHeader>
                  <DesignTableHeader>Mexico</DesignTableHeader>
                  <DesignTableHeader>Select</DesignTableHeader>
                  <DesignTableHeader className="text-right">
                    View
                  </DesignTableHeader>
                </tr>
              </DesignTableHead>
              <DesignTableBody>
                {TABLE_ROWS.map((row, index) => (
                  <DesignTableRow
                    key={row.product}
                    selected={index === 2}
                    className={
                      index === 2
                        ? "border-primary bg-card"
                        : ""
                    }
                  >
                    <DesignTableCell className="w-12">
                      <label className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card">
                        <input
                          type="checkbox"
                          className="sr-only"
                          defaultChecked={index === 2}
                        />
                        <span
                          className={cn(
                            "size-2 rounded-full bg-transparent transition",
                            index === 2 && "bg-primary"
                          )}
                        />
                      </label>
                    </DesignTableCell>
                    <DesignTableCell>
                      <div className="flex items-center gap-3">
                        <SurfaceCard className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted text-[11px] font-semibold text-muted-foreground">
                          {row.product.slice(0, 2)}
                        </SurfaceCard>
                        <div>
                          <p className="font-semibold text-foreground">
                            {row.product}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.sku}
                          </p>
                        </div>
                      </div>
                    </DesignTableCell>
                    <DesignTableCell className="font-medium text-foreground">
                      {row.price}
                    </DesignTableCell>
                    <DesignTableCell className="text-muted-foreground">
                      {row.size}
                    </DesignTableCell>
                    <DesignTableCell className="text-muted-foreground">
                      {row.date}
                    </DesignTableCell>
                    <DesignTableCell>
                      <StatusPill tone={row.status.tone} size="sm">
                        {row.status.label}
                      </StatusPill>
                    </DesignTableCell>
                    <DesignTableCell>
                      <DesignSelect defaultValue="select">
                        <DesignSelectTrigger className="w-32">
                          <DesignSelectValue placeholder="Select" />
                        </DesignSelectTrigger>
                        <DesignSelectContent>
                          <DesignSelectItem value="select">
                            Select
                          </DesignSelectItem>
                          <DesignSelectItem value="push">
                            Push to store
                          </DesignSelectItem>
                          <DesignSelectItem value="remove">
                            Remove
                          </DesignSelectItem>
                        </DesignSelectContent>
                      </DesignSelect>
                    </DesignTableCell>
                    <DesignTableCell className="text-right">
                      <DesignButton size="sm">View</DesignButton>
                    </DesignTableCell>
                  </DesignTableRow>
                ))}
              </DesignTableBody>
            </DesignTable>
          </DesignTableWrapper>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((page) => (
                <DesignButton
                  key={page}
                  variant={page === 1 ? "primary" : "tonal"}
                  size="sm"
                  className="h-8 rounded-full px-4 text-xs"
                >
                  {page}
                </DesignButton>
              ))}
              <span className="px-2 text-sm text-muted-foreground">
                … 10
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span>
                Go to page{" "}
                <strong className="mx-1 text-foreground">
                  01
                </strong>{" "}
                of 10
              </span>
              <div className="flex items-center gap-2">
                <span>Show entries</span>
                <DesignSelect defaultValue="10">
                  <DesignSelectTrigger className="w-24">
                    <DesignSelectValue />
                  </DesignSelectTrigger>
                  <DesignSelectContent>
                    <DesignSelectItem value="10">10</DesignSelectItem>
                    <DesignSelectItem value="25">25</DesignSelectItem>
                    <DesignSelectItem value="50">50</DesignSelectItem>
                  </DesignSelectContent>
                </DesignSelect>
              </div>
            </div>
          </div>
        </SurfaceCard>
      </SectionCard>
    </div>
  );
}
