"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/lib/utils";

export const DesignDialog = DialogPrimitive.Root;
export const DesignDialogTrigger = DialogPrimitive.Trigger;
export const DesignDialogClose = DialogPrimitive.Close;

export const DesignDialogPortal = DialogPrimitive.Portal;

export const DesignDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-[color:var(--ds-overlay)] backdrop-blur-sm",
      className,
    )}
    {...props}
  />
));
DesignDialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DesignDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DesignDialogPortal>
    <DesignDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-[min(500px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[44px] border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-popover)] shadow-[0_46px_92px_rgba(111,102,75,0.22)] focus:outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DesignDialogPortal>
));
DesignDialogContent.displayName = DialogPrimitive.Content.displayName;

export const DesignDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col gap-3 px-8 pt-8", className)}
    {...props}
  />
);

export const DesignDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-xl font-semibold text-[color:var(--ds-text-strong)]", className)}
    {...props}
  />
));
DesignDialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DesignDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-[color:var(--ds-text-muted)]", className)}
    {...props}
  />
));
DesignDialogDescription.displayName = DialogPrimitive.Description.displayName;

export const DesignDialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-8", className)} {...props} />
);

export const DesignDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-8 pb-8", className)} {...props} />
);
