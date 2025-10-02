'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

const Drawer = Dialog.Root;
const DrawerTrigger = Dialog.Trigger;
const DrawerPortal = Dialog.Portal;
const DrawerClose = Dialog.Close;

const DrawerOverlay = React.forwardRef<React.ElementRef<typeof Dialog.Overlay>, React.ComponentPropsWithoutRef<typeof Dialog.Overlay>>(
  ({ className, ...props }, ref) => (
    <Dialog.Overlay
      ref={ref}
      className={cn('fixed inset-0 bg-black/70 backdrop-blur-sm', className)}
      {...props}
    />
  )
);
DrawerOverlay.displayName = Dialog.Overlay.displayName;

const DrawerContent = React.forwardRef<React.ElementRef<typeof Dialog.Content>, React.ComponentPropsWithoutRef<typeof Dialog.Content>>(
  ({ className, children, ...props }, ref) => (
    <DrawerPortal>
      <DrawerOverlay />
      <Dialog.Content
        ref={ref}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto w-full flex-col rounded-t-3xl border border-slate-800 bg-slate-900 shadow-xl',
          'sm:left-1/2 sm:top-1/2 sm:mt-0 sm:h-[80vh] sm:w-[600px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
          className
        )}
        {...props}
      >
        {children}
      </Dialog.Content>
    </DrawerPortal>
  )
);
DrawerContent.displayName = Dialog.Content.displayName;

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('grid gap-1 px-6 py-4', className)} {...props} />
);
DrawerHeader.displayName = 'DrawerHeader';

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-auto flex items-center justify-end gap-2 px-6 py-4', className)} {...props} />
);
DrawerFooter.displayName = 'DrawerFooter';

const DrawerTitle = React.forwardRef<React.ElementRef<typeof Dialog.Title>, React.ComponentPropsWithoutRef<typeof Dialog.Title>>(
  ({ className, ...props }, ref) => (
    <Dialog.Title ref={ref} className={cn('text-lg font-semibold text-slate-100', className)} {...props} />
  )
);
DrawerTitle.displayName = Dialog.Title.displayName;

const DrawerDescription = React.forwardRef<React.ElementRef<typeof Dialog.Description>, React.ComponentPropsWithoutRef<typeof Dialog.Description>>(
  ({ className, ...props }, ref) => (
    <Dialog.Description ref={ref} className={cn('text-sm text-slate-400', className)} {...props} />
  )
);
DrawerDescription.displayName = Dialog.Description.displayName;

export {
  Drawer,
  DrawerTrigger,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
};
