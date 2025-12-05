"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function StaffSettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Staff settings</CardTitle>
        <CardDescription>Settings are currently handled by administrators.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Please contact an administrator if you need to update your profile or access rights.
        </p>
      </CardContent>
    </Card>
  );
}
